// Lumped-parameter 시간응답 모델.
// 유효 열용량과 추가 열손실 계수는 교안에 없으므로 실측 시간 기록으로 보정 필요.

import { rk4Scalar } from "../core/numeric.js";
import { cylinderHeat } from "./experiment-a.js";
import { solveSensor } from "./experiment-b.js";

// 실린더·히터 1-node: C dTs/dt = V·I - Qconv(Ts) - Qrad(Ts) - UA·(Ts - Ta)
export function simulateCylinder({ V, I, ta, initial, capacity, ua, duration, model = "mcadams", dt = Math.min(0.5, duration / 1200) }) {
  const input = V * I;
  const outputEvery = Math.max(1, Math.round((duration / dt) / 300));  // 그래프에 남길 점의 개수를 제한합니다

  const derivative = value => {
    const heat = cylinderHeat({ tsC: value, taC: ta, model });
    return (input - heat.qConv - heat.qRad - ua * (value - ta)) / capacity;
  };

  let temp = initial;
  const points = [{ t: 0, temp }];
  let step = 0;

  for (let t = 0; t < duration - 1e-9; t += dt) {
    // dt가 duration을 정확히 나누지 못하면 마지막 구간을 잘라 duration에 맞춘다.
    // 그러지 않으면 마지막 점의 라벨과 실제 적분 시각이 어긋난다.
    const h = Math.min(dt, duration - t);
    temp = rk4Scalar(temp, h, derivative);
    step += 1;
    if (step % outputEvery === 0 || t + h >= duration - 1e-9) points.push({ t: t + h, temp });
  }

  const finalHeat = cylinderHeat({ tsC: temp, taC: ta, model });
  const target = initial + 0.95 * (temp - initial);
  const t95Point = points.find(point => (temp >= initial ? point.temp >= target : point.temp <= target));

  return {
    points, finalTemp: temp, t95: t95Point?.t ?? duration,
    qConv: finalHeat.qConv, qRad: finalHeat.qRad, ta, duration, input
  };
}

// 비드 1-node를 1차 지수 응답으로 근사. 평형 온도와 시간상수는 solveSensor 값
export function simulateSensors({ wall, gas, velocity, initial, t6Emissivity, duration, names = ["T6", "T7", "T8"], samples = 300 }) {
  const sensors = names.map(name => solveSensor(name, { wallC: wall, gasC: gas, velocity, t6Emissivity }));
  const series = {};

  names.forEach((name, index) => {
    const sensor = sensors[index];
    series[name] = [];
    for (let i = 0; i <= samples; i += 1) {
      const t = duration * i / samples;
      const temp = sensor.equilibrium + (initial - sensor.equilibrium) * Math.exp(-t / Math.max(sensor.tau, 1e-9));
      series[name].push({ t, temp });
    }
  });

  return { wall, gas, velocity, initial, duration, sensors, series };
}
