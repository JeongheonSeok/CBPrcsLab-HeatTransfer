# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy"]
# ///
"""웹의 열전달 계산을 scipy로 독립 검증한다.

웹은 이분법과 고정 간격 RK4로 푼다. 여기서는 일부러 다른 방법을 쓴다.
Brent 법으로 근을 찾고 적응형 Runge-Kutta로 적분한다.
같은 알고리즘을 두 번 구현하면 같은 실수를 두 번 하기 때문이다.

    uv run tools/verify_physics.py        # uv가 있으면 의존성까지 알아서 처리
    python3 tools/verify_physics.py       # numpy, scipy가 이미 있으면 그냥 실행

reference.json이 없거나 오래되었으면 먼저 만든다.

    node tools/export_reference.mjs
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import brentq

HERE = Path(__file__).resolve().parent
REFERENCE = HERE / "reference.json"
KELVIN = 273.15


# --- 실험 A: 수평 가열 실린더 -------------------------------------------------

def cylinder_heat(ts_c, ta_c, model, const, k=None, nu=None, pr=None):
    """대류·복사 열전달량 [W]. 웹 구현을 보지 않고 식에서 바로 세운다."""
    cyl, sigma, g = const["CYLINDER"], const["SIGMA"], const["GRAVITY"]
    ts_k, ta_k = ts_c + KELVIN, ta_c + KELVIN
    d_t = ts_c - ta_c
    area = np.pi * cyl["D"] * cyl["L"]

    # 복사는 T⁴ 차이로 직접 계산한다. 웹은 선형화한 hRad를 쓰므로 서로 다른 경로다.
    q_rad = cyl["epsilon"] * cyl["F"] * sigma * area * (ts_k**4 - ta_k**4)

    if abs(d_t) <= 1e-12:
        return 0.0, 0.0, 0.0

    if model == "mcadams":
        h_conv = 1.32 * (abs(d_t) / cyl["D"]) ** 0.25
    else:
        film = (ts_k + ta_k) / 2
        gr = g * (1 / film) * abs(d_t) * cyl["D"] ** 3 / nu**2
        ra = gr * pr
        c, n = morgan_cn(np.log10(max(ra, 1e-30)))
        h_conv = k * c * max(ra, 0.0) ** n / cyl["D"]

    return h_conv * area * d_t, q_rad, h_conv


def morgan_cn(log_ra):
    for lo, hi, c, n in [(-9, -2, .675, .058), (-2, 2, 1.020, .148), (2, 4, .850, .188),
                         (4, 7, .480, .250), (7, 12, .125, .333)]:
        if lo <= log_ra < hi:
            return c, n
    return (.675, .058) if log_ra < -9 else (.125, .333)


# --- 실험 B: 열전쌍 비드 ------------------------------------------------------

def solve_sensor(name, wall_c, gas_c, velocity, t6_emissivity, const):
    """열수지 Qrad = Qconv 를 Brent 법으로 푼다 (웹은 이분법 80회)."""
    air, sigma = const["AIR"], const["SIGMA"]
    spec = dict(const["SENSOR_DEFS"][name])
    if name == "T6":
        spec["epsilon"] = min(1.0, max(0.01, t6_emissivity))

    d = spec["d"]
    re = max(velocity, 0.0) * d / air["nu"]
    nu_num = 2 + 0.6 * np.sqrt(max(re, 0.0)) * air["Pr"] ** (1 / 3)
    h = air["k"] * nu_num / d
    area = np.pi * d * d
    wall_k, gas_k = wall_c + KELVIN, gas_c + KELVIN

    def balance(tc_c):
        tc_k = tc_c + KELVIN
        return (spec["epsilon"] * sigma * air["F"] * area * (wall_k**4 - tc_k**4)
                - h * area * (tc_k - gas_k))

    lo, hi = min(wall_c, gas_c), max(wall_c, gas_c)
    tc_c = wall_c if abs(wall_c - gas_c) < 1e-12 else brentq(balance, lo, hi, xtol=1e-14, rtol=1e-15)

    tc_k = tc_c + KELVIN
    q_rad = spec["epsilon"] * sigma * air["F"] * area * (wall_k**4 - tc_k**4)
    q_conv = h * area * (tc_k - gas_k)
    return tc_c, h, re, nu_num, q_rad, q_conv


# --- Lumped 시간응답 ----------------------------------------------------------

def simulate_cylinder(p, const):
    """적응형 Runge-Kutta로 적분한다 (웹은 고정 간격 RK4)."""
    def rhs(_t, y):
        q_conv, q_rad, _ = cylinder_heat(y[0], p["ta"], p["model"], const)
        return [(p["V"] * p["I"] - q_conv - q_rad - p["ua"] * (y[0] - p["ta"])) / p["capacity"]]

    sol = solve_ivp(rhs, (0.0, p["duration"]), [p["initial"]],
                    method="RK45", rtol=1e-11, atol=1e-12, dense_output=True)
    if not sol.success:
        raise RuntimeError(f"적분 실패: {sol.message}")
    return float(sol.y[0, -1])


# --- 비교 --------------------------------------------------------------------

class Report:
    def __init__(self):
        self.checks = 0
        self.failures = []

    def compare(self, label, expected, actual, rtol):
        self.checks += 1
        scale = max(abs(expected), abs(actual), 1e-12)
        if not np.isfinite(actual) or abs(expected - actual) / scale > rtol:
            self.failures.append(f"{label}: web={expected!r} python={actual!r}")

    def section(self, title, count):
        print(f"  {title:<34} {count:>4}건")


def main() -> int:
    if not REFERENCE.exists():
        print(f"reference.json이 없습니다. 먼저 실행하세요:\n  node tools/export_reference.mjs", file=sys.stderr)
        return 2

    data = json.loads(REFERENCE.read_text(encoding="utf-8"))
    const = data["constants"]
    r = Report()

    print(f"기준 파일 생성 시각: {data['generated']}")
    print("\n독립 계산으로 비교합니다 (Brent 법 · 적응형 Runge-Kutta)")

    for case in data["experimentA"]:
        i = case["inputs"]
        q_conv, q_rad, h_conv = cylinder_heat(
            i["tsC"], i["taC"], i["model"], const,
            k=i.get("k"), nu=i.get("nu"), pr=i.get("pr"))
        tag = f"A {i['model']} V={i['V']} Ts={i['tsC']} Ta={i['taC']}"
        r.compare(f"{tag} qConv", case["qConv"], q_conv, 1e-12)
        r.compare(f"{tag} hConv", case["hConv"], h_conv, 1e-12)
        # 복사는 웹이 선형화한 hRad로, 여기서는 T⁴ 차이로 계산한다. 대수적으로 같아야 한다.
        r.compare(f"{tag} qRad", case["qRad"], q_rad, 1e-10)
    r.section("실험 A 정상상태", len(data["experimentA"]))

    for case in data["experimentB"]:
        i = case["inputs"]
        tc, h, re, nu_num, q_rad, q_conv = solve_sensor(
            i["name"], i["wallC"], i["gasC"], i["velocity"], i["t6Emissivity"], const)
        tag = f"B {i['name']} wall={i['wallC']} U={i['velocity']} e={i['t6Emissivity']}"
        r.compare(f"{tag} Tc", case["tcC"], tc, 1e-9)
        r.compare(f"{tag} h", case["h"], h, 1e-12)
        r.compare(f"{tag} Nu", case["Nu"], nu_num, 1e-12)
        r.compare(f"{tag} qRad", case["qRad"], q_rad, 1e-7)
        r.compare(f"{tag} qConv", case["qConv"], q_conv, 1e-7)
    r.section("실험 B 센서 열수지", len(data["experimentB"]))

    for case in data["lumpedA"]:
        i = case["inputs"]
        final = simulate_cylinder(i, const)
        tag = f"lumped V={i['V']} UA={i['ua']} t={i['duration']}"
        # 고정 간격 RK4(dt=0.01)와 적응형 적분의 차이만큼은 허용한다.
        r.compare(f"{tag} finalTemp", case["finalTemp"], final, 1e-8)
    r.section("Lumped 시간적분", len(data["lumpedA"]))

    print()
    if r.failures:
        print(f"검사 {r.checks}건 · 불일치 {len(r.failures)}건\n")
        for line in r.failures[:20]:
            print(f"  {line}")
        if len(r.failures) > 20:
            print(f"  … 외 {len(r.failures) - 20}건")
        return 1

    print(f"검사 {r.checks}건 · 불일치 0건")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
