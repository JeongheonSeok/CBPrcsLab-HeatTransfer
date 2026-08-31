// 물리 상수와 장치 치수. 실측값이 확보되면 이 파일만 수정하면 됨

export const SIGMA = 5.67e-8;   // Stefan-Boltzmann 상수 [W·m⁻²·K⁻⁴]
export const GRAVITY = 9.81;    // 중력가속도 [m/s²]
export const KELVIN = 273.15;

export const toK = tC => tC + KELVIN;

// 실험 A 가열 실린더. D, L은 실측값으로 교체 필요
export const CYLINDER = {
  D: 0.01,        // 지름 [m]
  L: 0.07,        // 가열 구간 길이 [m]
  epsilon: 0.95,  // 표면 복사율 (예시값)
  F: 1            // view factor (예시값)
};

// 실험 B 공기 물성 (상온 기준 대표값)
export const AIR = {
  k: 0.027,       // 열전도도 [W·m⁻¹·K⁻¹]
  nu: 1.7e-5,     // 동점성계수 [m²/s]
  Pr: 0.707,      // Prandtl 수
  F: 1            // 센서-벽 view factor (예시값)
};

// Morgan 상관식 기본 공기 물성 (화면에서 수정 가능)
export const AIR_A_DEFAULT = { k: 0.027, nu: 1.75e-5, Pr: 0.707 };

// 열전쌍 비드 사양. 복사율은 교육용 예시값
export const SENSOR_DEFS = {
  T6: { name: "T6", d: 0.0005, epsilon: 0.40, desc: "작은 회색체 · 0.5 mm" },
  T7: { name: "T7", d: 0.0005, epsilon: 0.95, desc: "작은 흑체 · 0.5 mm" },
  T8: { name: "T8", d: 0.0030, epsilon: 0.95, desc: "큰 흑체 · 3 mm" }
};

// 비드 열용량 계산용 재료 물성 (보정 대상)
export const BEAD_MATERIAL = { density: 8000, cp: 500 };
