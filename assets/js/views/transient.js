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
  $("#lumpedMetric1Label").textContent = "Final surface temp";
  $("#lumpedMetric1").innerHTML = `${sim.finalTemp.toFixed(1)} <small>°C</small>`;
  $("#lumpedMetric1Sub").textContent = "Tₛ(tend)";
  $("#lumpedMetric2Label").textContent = "Time to 95%";
  $("#lumpedMetric2").innerHTML = `${sim.t95.toFixed(0)} <small>s</small>`;
  $("#lumpedMetric2Sub").textContent = "of the total rise";
  $("#lumpedMetric3Label").textContent = "Radiation at end";
  $("#lumpedMetric3").innerHTML = formatW(sim.qRad);
  $("#lumpedMetric3Sub").textContent = "Qr(tend)";
  $("#lumpedMetric4Label").textContent = "Convection at end";
  $("#lumpedMetric4").innerHTML = formatW(sim.qConv);
  $("#lumpedMetric4Sub").textContent = "Qc(tend)";
  $("#lumpedChartTitle").textContent = "Cylinder mean temperature";
  $("#lumpedLegend").innerHTML =
    `<span class=""><i class="" style="border-color:${SERIES_COLOR.surface}"></i>Cylinder mean</span>` +
    `<span class=""><i class="" style="border-color:${SERIES_COLOR.conv}"></i>Air temperature</span>`;
  $("#lumpedNote").textContent = "Effective heat capacity and extra loss are not in the course notes and have not been fitted to measurements. Treat the time axis as indicative only.";
}

function updateBPanel() {
  const sim = simulateSensors(readBInputs());
  const [s6, s7, s8] = sim.sensors;
  [["#lumpedMetric1Label", "T6 equilibrium"], ["#lumpedMetric2Label", "T7 equilibrium"],
   ["#lumpedMetric3Label", "T8 equilibrium"], ["#lumpedMetric4Label", "Slowest time constant"]]
    .forEach(([id, value]) => { $(id).textContent = value; });
  $("#lumpedMetric1").innerHTML = `${s6.equilibrium.toFixed(1)} <small>°C</small>`;
  $("#lumpedMetric2").innerHTML = `${s7.equilibrium.toFixed(1)} <small>°C</small>`;
  $("#lumpedMetric3").innerHTML = `${s8.equilibrium.toFixed(1)} <small>°C</small>`;
  $("#lumpedMetric4").innerHTML = `${Math.max(...sim.sensors.map(s => s.tau)).toFixed(1)} <small>s</small>`;
  $("#lumpedMetric1Sub").textContent = `τ = ${s6.tau.toFixed(2)} s`;
  $("#lumpedMetric2Sub").textContent = `τ = ${s7.tau.toFixed(2)} s`;
  $("#lumpedMetric3Sub").textContent = `τ = ${s8.tau.toFixed(2)} s`;
  $("#lumpedMetric4Sub").textContent = "set by bead heat capacity";
  $("#lumpedChartTitle").textContent = "Thermocouple bead response";
  $("#lumpedLegend").innerHTML =
    `<span class=""><i class="" style="border-color:${SENSOR_COLOR.T6}"></i>T6</span>` +
    `<span class=""><i class="" style="border-color:${SENSOR_COLOR.T7}"></i>T7</span>` +
    `<span class=""><i class="" style="border-color:${SENSOR_COLOR.T8}"></i>T8</span>` +
    `<span class=""><i class="" style="border-color:${SERIES_COLOR.marker}"></i>Air temperature</span>`;
  $("#lumpedNote").textContent = "Bead material properties are placeholder values and wire conduction is not modelled, so the response is faster than the real sensor.";
}

export function updateLumped() {
  if (!$("#lumpedChart")) return;
  $("#lumpedAControls").hidden = lumpedMode !== "A";
  $("#lumpedBControls").hidden = lumpedMode !== "B";
  $$(".lumped-mode").forEach(button => button.classList.toggle("is-active", button.dataset.mode === lumpedMode));
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
