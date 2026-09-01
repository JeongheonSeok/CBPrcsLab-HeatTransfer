// 시간 변화 화면: 실험 A 실린더 평균 온도, 실험 B 열전쌍 응답

import { $, $$, clamp, numberValue, formatW } from "../core/dom.js";
import { setupCanvas, drawAxes, drawLine, makeScales, drawHorizontalGuide, SERIES_COLOR } from "../core/chart.js";
import { simulateCylinder, simulateSensors } from "../physics/lumped.js";

const SENSOR_COLOR = { T6: SERIES_COLOR.muted, T7: SERIES_COLOR.conv, T8: SERIES_COLOR.rad };

let lumpedMode = "A";

function readAInputs() {
  return {
    V: Math.max(0, numberValue("#lumpedAVoltage", 11)),
    I: Math.max(0, numberValue("#lumpedACurrent", 0.25)),
    ta: numberValue("#lumpedAAir", 25),
    initial: numberValue("#lumpedAInitial", 25),
    capacity: Math.max(0.1, numberValue("#lumpedACapacity", 18)),
    ua: Math.max(0, numberValue("#lumpedAUA", 0.006)),
    duration: clamp(numberValue("#lumpedADuration", 600), 30, 3600)
  };
}

function readBInputs() {
  const gas = numberValue("#lumpedBGas", 25);
  return {
    wall: numberValue("#lumpedBWall", 120),
    gas,
    velocity: Math.max(0, numberValue("#lumpedBVelocity", 0.4)),
    initial: numberValue("#lumpedBInitial", gas),
    t6Emissivity: clamp(numberValue("#lumpedBT6Epsilon", 0.4), 0.01, 1),
    duration: clamp(numberValue("#lumpedBDuration", 180), 10, 1200)
  };
}

export function drawLumpedChart() {
  const canvas = $("#lumpedChart");
  const setup = setupCanvas(canvas);
  if (!setup) return;
  const { ctx, w, h } = setup;

  if (lumpedMode === "A") {
    const sim = simulateCylinder(readAInputs());
    let minY = Math.min(sim.ta, ...sim.points.map(p => p.temp));
    let maxY = Math.max(sim.ta, ...sim.points.map(p => p.temp));
    const pad = Math.max((maxY - minY) * 0.12, 1);
    minY -= pad * 0.25; maxY += pad;

    const { xMap, yMap } = makeScales(w, h, [0, sim.duration], [minY, maxY]);
    drawAxes(ctx, w, h, "t (s)", "T (°C)", [0, Math.round(sim.duration / 2), sim.duration],
      [+minY.toFixed(0), +((minY + maxY) / 2).toFixed(0), +maxY.toFixed(0)], xMap, yMap);
    drawLine(ctx, sim.points.map(p => [xMap(p.t), yMap(p.temp)]), SERIES_COLOR.surface, 2.5);
    drawHorizontalGuide(ctx, yMap(sim.ta), w, SERIES_COLOR.conv);
  } else {
    const sim = simulateSensors(readBInputs());
    const all = Object.values(sim.series).flat();
    let minY = Math.min(sim.gas, ...all.map(p => p.temp));
    let maxY = Math.max(sim.wall, ...all.map(p => p.temp));
    const pad = Math.max((maxY - minY) * 0.08, 1);
    minY -= pad * 0.15; maxY += pad * 0.35;

    const { xMap, yMap } = makeScales(w, h, [0, sim.duration], [minY, maxY]);
    drawAxes(ctx, w, h, "t (s)", "T (°C)", [0, Math.round(sim.duration / 2), sim.duration],
      [+minY.toFixed(0), +((minY + maxY) / 2).toFixed(0), +maxY.toFixed(0)], xMap, yMap);
    Object.keys(SENSOR_COLOR).forEach(name =>
      drawLine(ctx, sim.series[name].map(p => [xMap(p.t), yMap(p.temp)]), SENSOR_COLOR[name], 2.3));
    drawHorizontalGuide(ctx, yMap(sim.gas), w, SERIES_COLOR.marker, [5, 5], 1.2);
  }
}

function updateAPanel() {
  const sim = simulateCylinder(readAInputs());
  $("#lumpedMetric1Label").textContent = "최종 표면 온도";
  $("#lumpedMetric1").innerHTML = `${sim.finalTemp.toFixed(1)} <small>°C</small>`;
  $("#lumpedMetric1Sub").textContent = "Tₛ(tend)";
  $("#lumpedMetric2Label").textContent = "95% 도달 시간";
  $("#lumpedMetric2").innerHTML = `${sim.t95.toFixed(0)} <small>s</small>`;
  $("#lumpedMetric2Sub").textContent = "최종 온도 변화량 기준";
  $("#lumpedMetric3Label").textContent = "최종 복사 열전달";
  $("#lumpedMetric3").innerHTML = formatW(sim.qRad);
  $("#lumpedMetric3Sub").textContent = "Qr(tend)";
  $("#lumpedMetric4Label").textContent = "최종 대류 열전달";
  $("#lumpedMetric4").innerHTML = formatW(sim.qConv);
  $("#lumpedMetric4Sub").textContent = "Qc(tend)";
  $("#lumpedChartTitle").textContent = "실험 A · 실린더 평균 온도 응답";
  $("#lumpedChartSub").textContent = "전력 입력 이후 Tₛ(t)의 변화";
  $("#lumpedLegend").innerHTML =
    `<span class="legend-item"><i class="legend-swatch" style="border-color:${SERIES_COLOR.surface}"></i>실린더 평균 온도</span>` +
    `<span class="legend-item"><i class="legend-swatch" style="border-color:${SERIES_COLOR.conv}"></i>공기 온도</span>`;
  $("#lumpedNote").textContent = "유효 열용량과 추가 열손실 계수는 교안에 제시되지 않으므로 실제 T8·T10 시간 기록으로 보정해야 합니다.";
}

function updateBPanel() {
  const sim = simulateSensors(readBInputs());
  const [s6, s7, s8] = sim.sensors;
  [["#lumpedMetric1Label", "T6 평형 온도"], ["#lumpedMetric2Label", "T7 평형 온도"],
   ["#lumpedMetric3Label", "T8 평형 온도"], ["#lumpedMetric4Label", "가장 긴 시간상수"]]
    .forEach(([id, value]) => { $(id).textContent = value; });
  $("#lumpedMetric1").innerHTML = `${s6.equilibrium.toFixed(1)} <small>°C</small>`;
  $("#lumpedMetric2").innerHTML = `${s7.equilibrium.toFixed(1)} <small>°C</small>`;
  $("#lumpedMetric3").innerHTML = `${s8.equilibrium.toFixed(1)} <small>°C</small>`;
  $("#lumpedMetric4").innerHTML = `${Math.max(...sim.sensors.map(s => s.tau)).toFixed(1)} <small>s</small>`;
  $("#lumpedMetric1Sub").textContent = `τ = ${s6.tau.toFixed(2)} s`;
  $("#lumpedMetric2Sub").textContent = `τ = ${s7.tau.toFixed(2)} s`;
  $("#lumpedMetric3Sub").textContent = `τ = ${s8.tau.toFixed(2)} s`;
  $("#lumpedMetric4Sub").textContent = "비드 열용량 영향";
  $("#lumpedChartTitle").textContent = "실험 B · 열전쌍 비드 온도 응답";
  $("#lumpedChartSub").textContent = "T6·T7·T8의 평형 온도와 응답 속도 비교";
  $("#lumpedLegend").innerHTML =
    `<span class="legend-item"><i class="legend-swatch" style="border-color:${SENSOR_COLOR.T6}"></i>T6</span>` +
    `<span class="legend-item"><i class="legend-swatch" style="border-color:${SENSOR_COLOR.T7}"></i>T7</span>` +
    `<span class="legend-item"><i class="legend-swatch" style="border-color:${SENSOR_COLOR.T8}"></i>T8</span>` +
    `<span class="legend-item"><i class="legend-swatch" style="border-color:${SERIES_COLOR.marker}"></i>공기 온도</span>`;
  $("#lumpedNote").textContent = "센서 재료 물성은 교육용 예시이며 전선 전도는 포함하지 않았습니다. 실제 응답 곡선으로 보정하는 구성이 필요합니다.";
}

export function updateLumped() {
  if (!$("#lumpedChart")) return;
  $("#lumpedAControls").classList.toggle("mode-panel-hidden", lumpedMode !== "A");
  $("#lumpedBControls").classList.toggle("mode-panel-hidden", lumpedMode !== "B");
  $$(".lumped-mode").forEach(button => button.classList.toggle("active", button.dataset.mode === lumpedMode));
  if (lumpedMode === "A") updateAPanel(); else updateBPanel();
  drawLumpedChart();
}

export function initTransientView() {
  $$(".lumped-mode").forEach(button =>
    button.addEventListener("click", () => { lumpedMode = button.dataset.mode; updateLumped(); }));

  ["#lumpedAVoltage", "#lumpedACurrent", "#lumpedAAir", "#lumpedAInitial", "#lumpedACapacity",
   "#lumpedAUA", "#lumpedADuration", "#lumpedBWall", "#lumpedBGas", "#lumpedBVelocity",
   "#lumpedBInitial", "#lumpedBT6Epsilon", "#lumpedBDuration"]
    .forEach(id => $(id)?.addEventListener("input", updateLumped));

  updateLumped();
}
