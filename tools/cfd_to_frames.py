#!/usr/bin/env python3
"""Resample OpenFOAM cutting-plane npz into browser-sized PNG sprites."""
# /// script
# dependencies = ["numpy", "scipy", "pillow"]
# ///

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.interpolate import LinearNDInterpolator
from scipy.ndimage import gaussian_filter
from scipy.spatial import Delaunay, cKDTree

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets" / "js" / "data" / "rawdata"
OUT = ROOT / "assets" / "data" / "cfd"

# 히터(z = 1.05) 아래는 정지한 유입 공기다. 실린더를 감싸는 열경계층은 5 mm 안에 있으므로
# 아래로 3 cm, 위로 duct 끝까지 15 cm면 물리가 전부 들어온다.
Z_LO, Z_HI = 1.02, 1.20          # [m]
HALF_WIDTH = 0.035               # duct 반폭 [m]
PX_PER_M = 1000                  # 1 mm/px
FRAME_STEP = 1                   # 0.5 s 간격 361개를 전부 쓴다. 솎으면 플룸의 흔들림이 끊겨 보인다
SMOOTH_SIGMA = 1.0               # px. 삼각화 흔적만 지운다. 더 세게 하면 열경계층이 뭉개진다

# 평면마다 가로축이 다르다. yz 평면(x=0)은 y가 가로, xz 평면(y=0)은 x가 가로.
PLANES = {"yz": 1, "xz": 0}


def grid_axes():
    w = int(round(2 * HALF_WIDTH * PX_PER_M))
    h = int(round((Z_HI - Z_LO) * PX_PER_M))
    # 픽셀 중심. 이미지 0행이 위(z = Z_HI)가 되도록 z는 내림차순.
    lateral = (np.arange(w) + 0.5) / PX_PER_M - HALF_WIDTH
    z = Z_HI - (np.arange(h) + 0.5) / PX_PER_M
    return w, h, np.meshgrid(lateral, z)


class Resampler:
    # 점의 위치는 프레임마다 같으므로 삼각분할과 최근접 탐색을 한 번만 한다.
    # 프레임마다 다시 하면 조건 하나에 2분이 넘게 걸린다.
    def __init__(self, points, lateral_axis, grid_lat, grid_z):
        xy = np.column_stack([points[:, lateral_axis], points[:, 2]])
        self.tri = Delaunay(xy)
        self.targets = np.column_stack([grid_lat.ravel(), grid_z.ravel()])
        self.shape = grid_lat.shape
        # 볼록 껍질 밖(모서리)은 최근접값으로 채운다. NaN이 남으면 PNG에 구멍이 난다.
        outside = self.tri.find_simplex(self.targets) < 0
        self.outside = outside
        self.nearest = cKDTree(xy).query(self.targets[outside])[1]

    def __call__(self, values):
        out = LinearNDInterpolator(self.tri, values)(self.targets)
        out[self.outside] = values[self.nearest]
        return out.reshape(self.shape)


def to_sprite(frames, lo, hi, w, h):
    # 조건 안에서 범위를 고정한다. 프레임마다 정규화하면 재생 중 색이 숨쉰다.
    cols = int(np.ceil(np.sqrt(len(frames))))
    rows = int(np.ceil(len(frames) / cols))
    sheet = np.zeros((rows * h, cols * w), dtype=np.uint8)
    for i, frame in enumerate(frames):
        r, c = divmod(i, cols)
        scaled = np.clip((frame - lo) / max(hi - lo, 1e-9), 0, 1)
        sheet[r * h:(r + 1) * h, c * w:(c + 1) * w] = np.round(scaled * 255).astype(np.uint8)
    return sheet, cols, rows


def convert_plane(case_dir, plane, lateral_axis, frame_idx, w, h, grid_lat, grid_z):
    air = np.load(case_dir / f"{plane}_air.npz")
    heater = np.load(case_dir / f"{plane}_heater.npz")
    # 히터 점을 함께 넣어야 히터 내부에도 온도가 찍힌다. 속도는 히터 안에서 0이다.
    pts = np.vstack([air["points_m"], heater["points_m"]])
    lat_mask = np.abs(pts[:, lateral_axis]) <= HALF_WIDTH + 0.002
    z_mask = (pts[:, 2] >= Z_LO - 0.01) & (pts[:, 2] <= Z_HI + 0.01)
    keep = lat_mask & z_mask
    pts = pts[keep]
    resample = Resampler(pts, lateral_axis, grid_lat, grid_z)

    # npz는 인덱싱할 때마다 배열 전체를 다시 압축 해제한다. 한 번만 꺼낸다.
    air_T, heater_T = air["T_K"], heater["T_K"]
    air_speed = np.linalg.norm(air["U_m_per_s"], axis=2)
    heater_zero = np.zeros(len(heater["points_m"]), dtype=np.float32)

    temp_frames, speed_frames = [], []
    for i in frame_idx:
        t_all = np.concatenate([air_T[i], heater_T[i]])[keep] - 273.15
        u_all = np.concatenate([air_speed[i], heater_zero])[keep]
        temp = gaussian_filter(resample(t_all), SMOOTH_SIGMA)
        speed = gaussian_filter(resample(u_all), SMOOTH_SIGMA)
        temp_frames.append(temp.astype(np.float32))
        speed_frames.append(speed.astype(np.float32))
    print(f"  {plane}: {len(temp_frames)} frames")
    return temp_frames, speed_frames


def history(case_dir):
    h = np.load(case_dir / "integrated_histories.npz")
    keys = ["time_s", "T10_C", "T_heater_avg_C", "Q_in_W",
            "Q_heater_to_air_conv_W", "Q_heater_to_air_rad_W"]
    return {k: [round(float(v), 4) for v in h[k]] for k in keys}


def convert(case):
    case_dir = RAW / case
    out_dir = OUT / case
    out_dir.mkdir(parents=True, exist_ok=True)
    meta = json.loads((case_dir / "metadata.json").read_text(encoding="utf-8"))

    w, h, (grid_lat, grid_z) = grid_axes()
    time_s = np.load(case_dir / "yz_air.npz")["time_s"]
    frame_idx = list(range(0, len(time_s), FRAME_STEP))
    print(f"{case}: {w}×{h} px, {len(frame_idx)} frames")

    index = {
        "case": case,
        "label": meta["voltage_label"],
        "source": meta["case"],
        "electricalInputW": meta["electrical_input_W"],
        "tile": {"w": w, "h": h},
        "roi": {"zLo": Z_LO, "zHi": Z_HI, "halfWidth": HALF_WIDTH, "pxPerM": PX_PER_M},
        "heater": {"centerZ": 1.05, "radius": 0.005},
        "frames": [round(float(time_s[i]), 2) for i in frame_idx],
        "planes": {},
    }

    temp_lo = temp_hi = speed_hi = None
    planes = {}
    for plane, lateral_axis in PLANES.items():
        temps, speeds = convert_plane(case_dir, plane, lateral_axis, frame_idx, w, h, grid_lat, grid_z)
        planes[plane] = (temps, speeds)
        lo, hi = min(f.min() for f in temps), max(f.max() for f in temps)
        temp_lo = lo if temp_lo is None else min(temp_lo, lo)
        temp_hi = hi if temp_hi is None else max(temp_hi, hi)
        s = max(f.max() for f in speeds)
        speed_hi = s if speed_hi is None else max(speed_hi, s)

    # 두 평면이 같은 색 범위를 써야 전환할 때 색의 뜻이 유지된다.
    index["temperatureC"] = {"min": round(float(temp_lo), 2), "max": round(float(temp_hi), 2)}
    index["speed"] = {"min": 0.0, "max": round(float(speed_hi), 4)}

    for plane, (temps, speeds) in planes.items():
        sheet, cols, rows = to_sprite(temps, temp_lo, temp_hi, w, h)
        Image.fromarray(sheet, "L").save(out_dir / f"{plane}_T.png", optimize=True)
        sheet, _, _ = to_sprite(speeds, 0.0, speed_hi, w, h)
        Image.fromarray(sheet, "L").save(out_dir / f"{plane}_U.png", optimize=True)
        index["planes"][plane] = {"cols": cols, "rows": rows,
                                  "temperature": f"{plane}_T.png", "speed": f"{plane}_U.png"}

    hist = history(case_dir)
    (out_dir / "history.json").write_text(json.dumps(hist), encoding="utf-8")
    last = -1
    # 180 s는 정상상태가 아니다. 기울기를 같이 남겨 화면이 그 사실을 말할 수 있게 한다.
    slope = (hist["T10_C"][last] - hist["T10_C"][last - 20]) / (hist["time_s"][last] - hist["time_s"][last - 20])
    index["final"] = {
        "timeS": hist["time_s"][last],
        "T10C": hist["T10_C"][last],
        "T10SlopeKPerS": round(slope, 4),
        "qConvW": hist["Q_heater_to_air_conv_W"][last],
        "qRadW": hist["Q_heater_to_air_rad_W"][last],
        "qInW": hist["Q_in_W"][last],
    }
    (out_dir / "index.json").write_text(json.dumps(index, indent=1), encoding="utf-8")

    total = sum(p.stat().st_size for p in out_dir.iterdir())
    print(f"  → {out_dir.relative_to(ROOT)}  {total / 1e6:.2f} MB")


if __name__ == "__main__":
    cases = sys.argv[1:] or sorted(p.name for p in RAW.iterdir() if (p / "metadata.json").exists())
    for case in cases:
        convert(case)
