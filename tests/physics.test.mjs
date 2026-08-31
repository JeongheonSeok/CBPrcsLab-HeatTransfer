// 물리 모델이 지켜야 할 성질을 확인한다.
// 특정 숫자를 외워 두는 대신, 부호·단조성·열수지처럼 모델이 틀리면 반드시 깨지는 것을 본다.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { morganCN, cylinderHeat, experimentASteady, cylinderArea } from "../assets/js/physics/experiment-a.js";
import { solveSensor, sensorSpec, beadConvection } from "../assets/js/physics/experiment-b.js";
import { simulateCylinder, simulateSensors } from "../assets/js/physics/lumped.js";
import { rk4Scalar, bisect } from "../assets/js/core/numeric.js";
import { CYLINDER, SIGMA } from "../assets/js/physics/constants.js";

const close = (a, b, tol, message) =>
  assert.ok(Math.abs(a - b) <= tol, `${message}: ${a} vs ${b} (허용 ${tol})`);

describe("수치 해석 루틴", () => {
  test("RK4는 dy/dt = -y 를 exp(-t)로 적분한다", () => {
    let y = 1;
    const dt = 0.01;
    for (let i = 0; i < 100; i += 1) y = rk4Scalar(y, dt, v => -v);
    close(y, Math.exp(-1), 1e-9, "RK4 1초 적분");
  });

  test("이분법은 알려진 근을 찾는다", () => {
    close(bisect(x => x * x - 2, 0, 2), Math.SQRT2, 1e-12, "√2");
  });
});

describe("실험 A · 실린더 대류와 복사", () => {
  test("온도차가 없으면 열전달도 없다", () => {
    const heat = cylinderHeat({ tsC: 25, taC: 25, model: "mcadams" });
    assert.equal(heat.qConv, 0);
    assert.equal(heat.qRad, 0);
  });

  test("표면이 뜨거우면 열이 나가고, 차가우면 들어온다", () => {
    for (const model of ["mcadams", "morgan"]) {
      const hot = cylinderHeat({ tsC: 90, taC: 25, model });
      assert.ok(hot.qConv > 0 && hot.qRad > 0, `${model}: 뜨거운 표면에서 열이 나가야 함`);
      const cold = cylinderHeat({ tsC: 10, taC: 25, model });
      assert.ok(cold.qConv < 0 && cold.qRad < 0, `${model}: 차가운 표면으로 열이 들어와야 함`);
    }
  });

  test("표면 온도가 오르면 대류·복사가 모두 단조 증가한다", () => {
    for (const model of ["mcadams", "morgan"]) {
      let prevConv = -Infinity, prevRad = -Infinity;
      for (let ts = 30; ts <= 200; ts += 5) {
        const { qConv, qRad } = cylinderHeat({ tsC: ts, taC: 25, model });
        assert.ok(qConv > prevConv, `${model}: Ts=${ts}에서 대류가 단조가 아님`);
        assert.ok(qRad > prevRad, `${model}: Ts=${ts}에서 복사가 단조가 아님`);
        prevConv = qConv; prevRad = qRad;
      }
    }
  });

  test("복사 열전달 계수가 Stefan-Boltzmann 정의와 일치한다", () => {
    const tsC = 120, taC = 25;
    const { hRad, qRad, area } = cylinderHeat({ tsC, taC });
    const tsK = tsC + 273.15, taK = taC + 273.15;
    const direct = CYLINDER.epsilon * CYLINDER.F * SIGMA * area * (tsK ** 4 - taK ** 4);
    close(qRad, direct, Math.abs(direct) * 1e-12, "선형화 hRad와 T⁴ 직접 계산");
    assert.ok(hRad > 0);
  });

  test("McAdams 상관식이 정의된 값을 낸다", () => {
    const dT = 65;
    const { hConv } = cylinderHeat({ tsC: 25 + dT, taC: 25, model: "mcadams" });
    close(hConv, 1.32 * Math.pow(dT / CYLINDER.D, 0.25), 1e-12, "h = 1.32 (ΔT/D)^0.25");
  });

  test("Morgan 계수표의 구간 경계와 범위 밖 처리", () => {
    assert.deepEqual(morganCN(0), { c: 1.020, n: 0.148, extrapolated: false });
    assert.deepEqual(morganCN(3), { c: 0.850, n: 0.188, extrapolated: false });
    assert.deepEqual(morganCN(9), { c: 0.125, n: 0.333, extrapolated: false });
    assert.equal(morganCN(-20).extrapolated, true, "표 아래쪽 범위 밖");
    assert.equal(morganCN(30).extrapolated, true, "표 위쪽 범위 밖");
  });

  test("표면적은 원통 옆면 πDL 이다", () => {
    close(cylinderArea(), Math.PI * CYLINDER.D * CYLINDER.L, 1e-15, "πDL");
  });

  test("잔차는 공급 전력에서 모델 열전달량을 뺀 값이다", () => {
    const r = experimentASteady({ V: 11, I: 0.25, tsC: 90, taC: 25, model: "mcadams" });
    close(r.qIn, 11 * 0.25, 1e-15, "Qin = VI");
    close(r.residual, r.qIn - r.qConv - r.qRad, 1e-15, "잔차 정의");
  });
});

describe("실험 B · 열전쌍 복사 오차", () => {
  const base = { wallC: 120, gasC: 25, velocity: 0.4, t6Emissivity: 0.4 };

  test("벽과 공기가 같은 온도면 센서도 그 온도를 읽는다", () => {
    for (const name of ["T6", "T7", "T8"]) {
      const r = solveSensor(name, { ...base, wallC: 40, gasC: 40 });
      close(r.tcC, 40, 1e-9, `${name} 평형 온도`);
      close(r.error, 0, 1e-9, `${name} 측정 오차`);
    }
  });

  test("센서 온도는 항상 공기와 벽 사이에 있다", () => {
    for (const name of ["T6", "T7", "T8"]) {
      for (const velocity of [0, 0.2, 0.4, 0.8, 1.6, 5]) {
        const r = solveSensor(name, { ...base, velocity });
        assert.ok(r.tcC >= base.gasC - 1e-9 && r.tcC <= base.wallC + 1e-9,
          `${name} U=${velocity}: Tc=${r.tcC}가 [${base.gasC}, ${base.wallC}] 밖`);
      }
    }
  });

  test("풀린 해에서 복사 유입과 대류 냉각이 균형을 이룬다", () => {
    for (const name of ["T6", "T7", "T8"]) {
      const r = solveSensor(name, base);
      close(r.qRad, r.qConv, Math.abs(r.qRad) * 1e-6, `${name} 열수지 Qrad = Qconv`);
    }
  });

  test("유속이 빨라지면 측정 오차가 줄어든다", () => {
    // 실험 B가 가르치려는 핵심 현상. 대류 냉각이 강해지면 센서가 공기 온도에 가까워진다.
    for (const name of ["T6", "T7", "T8"]) {
      let prev = Infinity;
      for (const velocity of [0.1, 0.2, 0.4, 0.8, 1.6, 3.2]) {
        const { error } = solveSensor(name, { ...base, velocity });
        assert.ok(error < prev, `${name} U=${velocity}: 오차가 줄지 않음 (${error} >= ${prev})`);
        prev = error;
      }
    }
  });

  test("복사율이 낮은 T6은 같은 크기의 T7보다 오차가 작다", () => {
    const t6 = solveSensor("T6", base);
    const t7 = solveSensor("T7", base);
    assert.equal(t6.d, t7.d, "T6와 T7은 비드 크기가 같아야 함");
    assert.ok(t6.epsilon < t7.epsilon, "T6의 복사율이 더 낮아야 함");
    assert.ok(t6.error < t7.error, `복사율이 낮은 쪽 오차가 커짐: T6 ${t6.error} vs T7 ${t7.error}`);
  });

  test("비드가 큰 T8은 같은 복사율의 T7보다 오차가 크다", () => {
    const t7 = solveSensor("T7", base);
    const t8 = solveSensor("T8", base);
    assert.equal(t7.epsilon, t8.epsilon, "T7과 T8은 복사율이 같아야 함");
    assert.ok(t8.d > t7.d, "T8의 비드가 더 커야 함");
    assert.ok(t8.error > t7.error, `큰 비드 쪽 오차가 작아짐: T8 ${t8.error} vs T7 ${t7.error}`);
    assert.ok(t8.h < t7.h, "큰 비드의 대류 계수가 더 작아야 함");
  });

  test("T6의 복사율만 사용자 입력을 따른다", () => {
    close(sensorSpec("T6", { t6Emissivity: 0.7 }).epsilon, 0.7, 1e-15, "T6 복사율 반영");
    close(sensorSpec("T7", { t6Emissivity: 0.7 }).epsilon, 0.95, 1e-15, "T7은 영향 없음");
    // 물리적으로 불가능한 값은 잘라 낸다
    close(sensorSpec("T6", { t6Emissivity: 5 }).epsilon, 1, 1e-15, "복사율 상한");
    close(sensorSpec("T6", { t6Emissivity: -1 }).epsilon, 0.01, 1e-15, "복사율 하한");
  });

  test("정지 공기에서도 Nusselt 수가 2 아래로 내려가지 않는다", () => {
    const { Nu, re } = beadConvection(sensorSpec("T7"), 0);
    close(re, 0, 1e-15, "정지 공기의 Reynolds 수");
    close(Nu, 2, 1e-15, "구 주위 순수 전도 극한 Nu = 2");
  });
});

describe("Lumped-parameter 시간응답", () => {
  test("가열은 초기 온도에서 시작해 단조 상승한다", () => {
    const sim = simulateCylinder({ V: 11, I: 0.25, ta: 25, initial: 25, capacity: 18, ua: 0.006, duration: 600 });
    close(sim.points[0].temp, 25, 1e-15, "초기 온도");
    for (let i = 1; i < sim.points.length; i += 1) {
      assert.ok(sim.points[i].temp >= sim.points[i - 1].temp - 1e-12, `t=${sim.points[i].t}에서 하강`);
    }
    assert.ok(sim.finalTemp > 25, "가열되어야 함");
  });

  test("충분히 오래 돌리면 정상상태 열수지를 만족한다", () => {
    const p = { V: 11, I: 0.25, ta: 25, initial: 25, capacity: 18, ua: 0.006, duration: 5000 };
    const sim = simulateCylinder(p);
    const out = sim.qConv + sim.qRad + p.ua * (sim.finalTemp - p.ta);
    close(sim.input, out, sim.input * 1e-3, "Qin = Qconv + Qrad + UA·ΔT");
  });

  test("적분 시간 간격을 줄이면 결과가 수렴한다", () => {
    const p = { V: 11, I: 0.25, ta: 25, initial: 25, capacity: 18, ua: 0.006, duration: 600 };
    const at = dt => simulateCylinder({ ...p, dt }).finalTemp;
    const [coarse, medium, fine] = [0.5, 0.05, 0.005].map(at);
    // RK4는 4차 정확도이므로 dt를 10배 줄이면 오차가 급격히 작아져야 한다.
    const errCoarse = Math.abs(coarse - fine);
    const errMedium = Math.abs(medium - fine);
    assert.ok(errMedium < errCoarse, `dt를 줄여도 오차가 안 줄어듦: ${errMedium} vs ${errCoarse}`);
    close(coarse, fine, 1e-6, "dt = 0.5와 0.005의 차이");
  });

  test("dt가 계산 시간을 정확히 나누지 못해도 마지막 점의 시각이 맞는다", () => {
    // 마지막 구간을 자르지 않으면 t = 601.5의 온도를 t = 601.3으로 표시하게 된다.
    const p = { V: 11, I: 0.25, ta: 25, initial: 25, capacity: 18, ua: 0.006 };
    const odd = simulateCylinder({ ...p, duration: 601.3 });
    close(odd.points.at(-1).t, 601.3, 1e-9, "마지막 점의 시각");
    const reference = simulateCylinder({ ...p, duration: 601.3, dt: 0.0067 }).finalTemp;
    close(odd.finalTemp, reference, 1e-6, "잘라 낸 마지막 구간의 정확도");
  });

  test("전력이 클수록 정상상태 온도가 높다", () => {
    const at = V => simulateCylinder({ V, I: 0.25, ta: 25, initial: 25, capacity: 18, ua: 0.006, duration: 3000 }).finalTemp;
    assert.ok(at(5) < at(11) && at(11) < at(17), "전압에 따른 온도 순서");
  });

  test("센서 응답은 평형 온도로 수렴하고 큰 비드가 더 느리다", () => {
    const sim = simulateSensors({ wall: 120, gas: 25, velocity: 0.4, initial: 25, t6Emissivity: 0.4, duration: 3000 });
    const [t6, t7, t8] = sim.sensors;
    for (const s of sim.sensors) {
      const last = sim.series[s.name].at(-1).temp;
      close(last, s.equilibrium, Math.abs(s.equilibrium) * 1e-6, `${s.name} 평형 수렴`);
    }
    assert.ok(t8.tau > t7.tau, `큰 비드의 시간상수가 더 커야 함: T8 ${t8.tau} vs T7 ${t7.tau}`);
    assert.ok(t6.tau > 0 && t7.tau > 0, "시간상수는 양수");
  });

  test("센서 응답 곡선이 초기 온도에서 시작한다", () => {
    const sim = simulateSensors({ wall: 120, gas: 25, velocity: 0.4, initial: 30, t6Emissivity: 0.4, duration: 180 });
    for (const name of ["T6", "T7", "T8"]) {
      close(sim.series[name][0].temp, 30, 1e-12, `${name} 초기값`);
    }
  });
});
