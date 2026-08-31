// 유동장 뷰어의 임시 필드 생성기. 실제 CFD 결과가 아닌 합성 함수.
// 단계 4에서 case 파일을 읽는 cfd-loader.js로 교체 예정.

const clamp01 = v => Math.min(1, Math.max(0, v));

// 실험 A: 수평 가열 실린더 주위의 자연대류 plume
function sampleCylinderPlume(x, y, t, caseId) {
  const level = { A5: .42, A11: .68, A17: 1 }[caseId] || .68;
  const cx = .5 + .018 * Math.sin(t * .7 + y * 5), cy = .67;
  const local = Math.exp(-(((x - .5) / .13) ** 2 + ((y - cy) / .09) ** 2));
  const above = Math.max(0, cy - y);
  const width = .07 + .11 * above;
  const plume = y < cy ? Math.exp(-Math.pow((x - cx) / width, 2)) * Math.exp(-above * .55) : 0;
  const temp = clamp01(.05 + level * (.64 * local + .72 * plume));
  const vy = -(.08 + .92 * plume) * level;
  const vx = .12 * Math.sin((y * 6 + t) * 1.1) * (plume + .18 * local) + (x < .5 ? -.08 : .08) * local;
  return { temp, speed: clamp01(Math.sqrt(vx * vx + vy * vy)), vx, vy };
}

// 실험 B 자연대류: 가열 벽면을 따라 올라가는 경계층
function sampleWallNatural(x, y, t, caseId) {
  const level = { BN5: .42, BN11: .7, BN17: 1 }[caseId] || .7;
  const heatedBand = Math.exp(-Math.pow((y - .33) / .2, 8));
  const leftWall = Math.exp(-Math.pow((x - .22) / .055, 2));
  const rightWall = Math.exp(-Math.pow((x - .78) / .055, 2));
  const wallHeat = heatedBand * (leftWall + rightWall);
  const risingLayers = y < .55 ? (leftWall + rightWall) * Math.exp(-Math.max(0, .55 - y) * .55) : 0;
  const temp = clamp01(.05 + level * (.7 * wallHeat + .42 * risingLayers) + .018 * Math.sin(t + y * 11));
  const vy = -level * (.08 + .68 * risingLayers);
  const vx = level * .08 * (leftWall - rightWall) * Math.sin(t + y * 7);
  return { temp, speed: clamp01(Math.sqrt(vx * vx + vy * vy)), vx, vy };
}

// 실험 B 강제대류: 유속이 올라갈수록 중심부가 차가워지는 관 유동
function sampleWallForced(x, y, t, caseId) {
  const velocity = { B02: .25, B04: .42, B08: .66, B16: 1 }[caseId] || .42;
  const wallBand = Math.exp(-Math.pow((y - .31) / .18, 8));
  const nearWall = Math.exp(-Math.min((x - .18) ** 2, (x - .82) ** 2) / .012);
  const centerCool = Math.exp(-Math.pow((x - .5) / .24, 2));
  const temp = clamp01(.06 + .55 * wallBand * nearWall + .32 * wallBand * (1 - centerCool) * (1 - velocity * .4) + .02 * Math.sin(t * 1.4 + y * 14 + x * 4));
  const profile = clamp01(1 - ((x - .5) / .34) ** 4);
  const vy = -(.12 + .82 * velocity * profile);
  const vx = .02 * Math.sin(y * 18 + t * 1.5) * (1 - profile);
  return { temp, speed: clamp01(Math.sqrt(vx * vx + vy * vy)), vx, vy };
}

// 정규화 좌표 [0,1]²의 표본. temp·speed는 0~1 표시값이며 물리 단위가 아님
export function fieldSample(x, y, t, caseId) {
  if (caseId.startsWith("BN")) return sampleWallNatural(x, y, t, caseId);
  if (caseId.startsWith("A")) return sampleCylinderPlume(x, y, t, caseId);
  return sampleWallForced(x, y, t, caseId);
}

// 온도장과 속도장의 색상 스케일
export function palette(t, speed = false) {
  const value = clamp01(t);
  const stops = speed
    ? [[0, [13, 32, 53]], [.25, [29, 76, 127]], [.52, [39, 159, 195]], [.76, [107, 216, 194]], [1, [238, 251, 255]]]
    : [[0, [33, 55, 122]], [.25, [37, 139, 187]], [.5, [91, 200, 181]], [.74, [246, 196, 91]], [1, [222, 75, 87]]];
  for (let i = 1; i < stops.length; i += 1) {
    if (value <= stops[i][0]) {
      const a = stops[i - 1], b = stops[i];
      const u = (value - a[0]) / (b[0] - a[0]);
      return a[1].map((item, index) => Math.round(item + (b[1][index] - item) * u));
    }
  }
  return stops[stops.length - 1][1];
}

export const PALETTE_CSS = {
  temperature: "linear-gradient(to top,#21377a,#258bbb,#5bc8b5,#f6c45b,#de4b57)",
  speed: "linear-gradient(to top,#0d2035,#1d4c7f,#279fc3,#6bd8c2,#eefbff)"
};
