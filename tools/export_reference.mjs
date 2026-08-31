// 웹의 물리 모델을 여러 조건에서 계산해 tools/reference.json으로 내보낸다.
// verify_physics.py가 이 값을 scipy로 독립 계산한 값과 비교한다.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { CYLINDER, AIR, AIR_A_DEFAULT, SENSOR_DEFS, BEAD_MATERIAL, SIGMA, GRAVITY } from "../assets/js/physics/constants.js";
import { experimentASteady } from "../assets/js/physics/experiment-a.js";
import { solveSensor } from "../assets/js/physics/experiment-b.js";
import { simulateCylinder } from "../assets/js/physics/lumped.js";

const here = dirname(fileURLToPath(import.meta.url));

// 상수는 두 구현이 공유하는 입력이다. 검증 대상은 상수값이 아니라 식과 풀이 방법이다.
const constants = { CYLINDER, AIR, AIR_A_DEFAULT, SENSOR_DEFS, BEAD_MATERIAL, SIGMA, GRAVITY };

const experimentA = [];
for (const V of [5, 11, 17])
  for (const I of [0.11, 0.25, 0.39])
    for (const taC of [20, 25, 30])
      for (const tsC of [26, 45, 90, 143, 200])
        for (const model of ["mcadams", "morgan"]) {
          const inputs = { V, I, taC, tsC, model, ...(model === "morgan" ? { k: AIR_A_DEFAULT.k, nu: AIR_A_DEFAULT.nu, pr: AIR_A_DEFAULT.Pr } : {}) };
          const r = experimentASteady(inputs);
          experimentA.push({ inputs, qConv: r.qConv, qRad: r.qRad, hConv: r.hConv, hRad: r.hRad, ra: r.ra, residual: r.residual });
        }

const experimentB = [];
for (const name of ["T6", "T7", "T8"])
  for (const wallC of [67, 105, 145])
    for (const gasC of [25, 30])
      for (const velocity of [0, 0.2, 0.4, 0.8, 1.6])
        for (const t6Emissivity of [0.2, 0.4, 0.9]) {
          const inputs = { name, wallC, gasC, velocity, t6Emissivity };
          const r = solveSensor(name, inputs);
          experimentB.push({ inputs, tcC: r.tcC, h: r.h, re: r.re, Nu: r.Nu, qRad: r.qRad, qConv: r.qConv, tau: r.tau });
        }

const lumpedA = [];
for (const [V, I, duration] of [[5, 0.11, 600], [11, 0.25, 600], [17, 0.39, 900], [11, 0.25, 120]])
  for (const ua of [0, 0.006]) {
    const inputs = { V, I, ta: 25, initial: 25, capacity: 18, ua, duration, model: "mcadams" };
    // 파이썬의 적응형 적분과 비교하려면 웹 쪽도 충분히 촘촘해야 한다.
    const r = simulateCylinder({ ...inputs, dt: 0.01 });
    lumpedA.push({ inputs: { ...inputs, dt: 0.01 }, finalTemp: r.finalTemp, qConv: r.qConv, qRad: r.qRad });
  }

const payload = { generated: new Date().toISOString(), constants, experimentA, experimentB, lumpedA };
const out = join(here, "reference.json");
writeFileSync(out, JSON.stringify(payload, null, 2));
console.log(`${out}\n실험 A ${experimentA.length}건 · 실험 B ${experimentB.length}건 · lumped A ${lumpedA.length}건`);
