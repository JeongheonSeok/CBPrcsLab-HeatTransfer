// 실험 B: 벽 복사와 공기 대류가 함께 작용할 때 열전쌍 비드가 읽는 온도

import { SIGMA, toK, AIR, SENSOR_DEFS, BEAD_MATERIAL } from "./constants.js";
import { bisect } from "../core/numeric.js";

// T6 복사율만 사용자가 조절하므로 호출 시점에 사양을 만듦
export function sensorSpec(name, { t6Emissivity } = {}) {
  const base = SENSOR_DEFS[name];
  if (!base) return null;
  if (name === "T6" && Number.isFinite(t6Emissivity)) {
    return { ...base, epsilon: Math.min(1, Math.max(0.01, t6Emissivity)) };
  }
  return { ...base };
}

// 구형 비드의 대류 열전달 계수 (Ranz-Marshall 형태)
export function beadConvection(spec, velocity) {
  const re = Math.max(velocity, 0) * spec.d / AIR.nu;
  const Nu = 2 + 0.6 * Math.sqrt(Math.max(re, 0)) * Math.pow(AIR.Pr, 1 / 3);
  return { re, Nu, h: AIR.k * Nu / spec.d, area: Math.PI * spec.d * spec.d };
}

// 열수지 Qrad = Qconv 를 풀어 Tc를 구함. 전선 전도 손실은 미포함
export function solveSensor(name, { wallC, gasC, velocity, t6Emissivity } = {}) {
  const spec = sensorSpec(name, { t6Emissivity });
  const { re, Nu, h, area } = beadConvection(spec, velocity);
  const wallK = toK(wallC);
  const gasK = toK(gasC);

  const balance = tcC => {
    const tcK = toK(tcC);
    const qRad = spec.epsilon * SIGMA * AIR.F * area * (Math.pow(wallK, 4) - Math.pow(tcK, 4));
    const qConv = h * area * (tcK - gasK);
    return qRad - qConv;
  };

  const tcC = Math.abs(wallC - gasC) < 1e-12
    ? wallC
    : bisect(balance, Math.min(wallC, gasC), Math.max(wallC, gasC));

  const tcK = toK(tcC);
  const qRad = spec.epsilon * SIGMA * AIR.F * area * (Math.pow(wallK, 4) - Math.pow(tcK, 4));
  const qConv = h * area * (tcK - gasK);

  // 선형화한 복사 계수. 시간상수 계산용
  const hRad = spec.epsilon * SIGMA * AIR.F * (wallK + tcK) * (wallK * wallK + tcK * tcK);
  const volume = Math.PI / 6 * Math.pow(spec.d, 3);
  const thermalCapacity = BEAD_MATERIAL.density * volume * BEAD_MATERIAL.cp;
  const tau = thermalCapacity / Math.max(area * (h + hRad), 1e-12);

  return {
    ...spec, wallC, gasC, velocity, re, Nu, h, hRad, area,
    tcC, equilibrium: tcC, error: tcC - gasC, qRad, qConv, tau, thermalCapacity
  };
}
