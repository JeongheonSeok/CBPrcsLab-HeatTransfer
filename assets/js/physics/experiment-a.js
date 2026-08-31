// 실험 A: 수평 가열 실린더의 정상상태 자연대류·복사 열전달

import { SIGMA, GRAVITY, toK, CYLINDER, AIR_A_DEFAULT } from "./constants.js";

// 가열 구간 표면적 [m²]
export const cylinderArea = () => Math.PI * CYLINDER.D * CYLINDER.L;

// log10(Ra) 구간별 계수 C, n. 교안 표 범위 밖이면 extrapolated로 표시
export function morganCN(logRa) {
  const rows = [
    [-9, -2, 0.675, 0.058], [-2, 2, 1.020, 0.148], [2, 4, 0.850, 0.188],
    [4, 7, 0.480, 0.250], [7, 12, 0.125, 0.333]
  ];
  const row = rows.find((item, index) => logRa >= item[0] && (logRa < item[1] || (index === rows.length - 1 && logRa <= item[1])));
  if (row) return { c: row[2], n: row[3], extrapolated: false };
  const edge = logRa < -9 ? rows[0] : rows[rows.length - 1];
  return { c: edge[2], n: edge[3], extrapolated: true };
}

// model은 "mcadams" 또는 "morgan". morgan일 때만 공기 물성 k, nu, pr를 사용
export function cylinderHeat({ tsC, taC, model = "mcadams", k, nu, pr }) {
  const tsK = toK(tsC);
  const taK = toK(taC);
  const dT = tsC - taC;
  const area = cylinderArea();
  const hRad = SIGMA * CYLINDER.epsilon * CYLINDER.F * (tsK + taK) * (tsK * tsK + taK * taK);

  let hConv = 0;
  let ra = null;
  let extrapolated = false;

  if (Math.abs(dT) > 1e-12) {
    if (model === "morgan") {
      const kAir = Math.max(k ?? AIR_A_DEFAULT.k, 1e-8);
      const nuAir = Math.max(nu ?? AIR_A_DEFAULT.nu, 1e-12);
      const prAir = Math.max(pr ?? AIR_A_DEFAULT.Pr, 1e-8);
      const film = (tsK + taK) / 2;      // 물성을 평가하는 film 온도
      const beta = 1 / film;             // 이상기체 가정의 열팽창계수
      const gr = GRAVITY * beta * Math.abs(dT) * Math.pow(CYLINDER.D, 3) / (nuAir * nuAir);
      ra = gr * prAir;
      const coefficient = morganCN(Math.log10(Math.max(ra, 1e-30)));
      extrapolated = coefficient.extrapolated;
      const Nu = coefficient.c * Math.pow(Math.max(ra, 0), coefficient.n);
      hConv = kAir * Nu / CYLINDER.D;
    } else {
      hConv = 1.32 * Math.pow(Math.abs(dT) / CYLINDER.D, 0.25);
    }
  }

  return {
    qConv: hConv * area * dT,
    qRad: hRad * area * dT,
    hConv, hRad, area, ra, extrapolated, model, tsC, taC
  };
}

// residual은 실험 오차가 아니라 '모델에 포함되지 않은 열량'
export function experimentASteady({ V, I, tsC, taC, model, k, nu, pr }) {
  const heat = cylinderHeat({ tsC, taC, model, k, nu, pr });
  const qIn = V * I;
  const total = heat.qConv + heat.qRad;
  return { ...heat, qIn, total, residual: qIn - total };
}
