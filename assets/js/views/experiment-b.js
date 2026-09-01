// 실험 B 화면: 선택한 열전쌍의 측정 온도·오차와 유속별 비교 그래프

import { $, $$, numberValue, formatSmallHeat } from "../core/dom.js";
import { setupCanvas, drawAxes, drawLine, makeScales, drawVerticalMarker, drawHorizontalGuide, SERIES_COLOR, sensorStyle } from "../core/chart.js";
import { solveSensor } from "../physics/experiment-b.js";

const SENSOR_NAMES = ["T6", "T7", "T8"];

let selectedSensor = "T7";

function readConditions() {
  return {
    wallC: numberValue("#bWallTemp", 120),
    gasC: numberValue("#bGasTemp", 25),
    velocity: numberValue("#bVelocity", 0.4),
    t6Emissivity: numberValue("#bT6Emissivity", 0.4)
  };
}

export function drawBChart() {
  const canvas = $("#bChart");
  const setup = setupCanvas(canvas);
  if (!setup) return;
  const { ctx, w, h } = setup;
  const conditions = readConditions();

  const minX = 0.05, maxX = 1.8;
  const series = { T6: [], T7: [], T8: [] };
  // 곡선의 색과 굵기는 비드의 표면과 지름에서 나온다. T6은 방사율이 입력값이라
  // 학생이 그 값을 올리면 곡선도 흑체 쪽으로 어두워진다.
  const style = {};
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < 90; i += 1) {
    const velocity = minX + (maxX - minX) * i / 89;
    SENSOR_NAMES.forEach(name => {
      const result = solveSensor(name, { ...conditions, velocity });
      series[name].push({ velocity, temperature: result.tcC });
      style[name] ??= sensorStyle(result);
      minY = Math.min(minY, result.tcC);
      maxY = Math.max(maxY, result.tcC);
    });
  }

  minY = Math.min(minY, conditions.gasC);
  maxY = Math.min(Math.max(maxY, conditions.gasC + 1), conditions.wallC);
  const pad = Math.max((maxY - minY) * 0.14, 1);
  minY -= pad * 0.25;
  maxY += pad;

  const { xMap, yMap } = makeScales(w, h, [minX, maxX], [minY, maxY]);
  drawAxes(ctx, w, h, "U (m/s)", "T (°C)", [0.2, 0.8, 1.6],
    [+minY.toFixed(0), +((minY + maxY) / 2).toFixed(0), +maxY.toFixed(0)], xMap, yMap);
  SENSOR_NAMES.forEach(name =>
    drawLine(ctx, series[name].map(item => [xMap(item.velocity), yMap(item.temperature)]),
      style[name].color, style[name].width, style[name].dash));

  // 공기 온도선이 무엇인지 그래프 안에서 바로 읽히게 한다.
  ctx.font = "11px 'IBM Plex Sans KR', system-ui, sans-serif";
  ctx.fillStyle = SERIES_COLOR.guide;
  ctx.fillText("Air temperature", 50, yMap(conditions.gasC) - 5);
  ctx.font = "11px 'IBM Plex Sans KR', system-ui, sans-serif";
  ctx.textAlign = "right";
  SENSOR_NAMES.forEach(name => {
    const last = series[name][series[name].length - 1];
    ctx.fillStyle = style[name].color;
    ctx.fillText(name, xMap(last.velocity) - 3, yMap(last.temperature) - 5);
  });
  ctx.textAlign = "left";
  drawVerticalMarker(ctx, xMap(conditions.velocity), h);
  drawHorizontalGuide(ctx, yMap(conditions.gasC), w, SERIES_COLOR.guide, [2, 5], 1);
}

export function updateB() {
  const conditions = readConditions();
  const result = solveSensor(selectedSensor, conditions);

  $("#bVelocityValue").textContent = result.velocity.toFixed(2);
  $("#bSensorTemp").innerHTML = `${result.tcC.toFixed(2)} <small>°C</small>`;
  $("#bSensorSub").textContent = `${result.name} · ε=${result.epsilon.toFixed(2)} · d=${(result.d * 1000).toFixed(1)} mm`;
  $("#bError").innerHTML = `${result.error >= 0 ? "+" : ""}${result.error.toFixed(2)} <small>°C</small>`;
  $("#bH").innerHTML = `${result.h.toFixed(1)} <small>W/m²K</small>`;
  $("#bRe").textContent = `Re = ${result.re.toFixed(1)} · Nu = ${result.Nu.toFixed(2)}`;
  $("#bHeat").innerHTML = formatSmallHeat(Math.abs(result.qRad)).replace(/\s([a-zA-Zµ]+)$/, " <small>$1</small>");
  $("#bRadValue").textContent = formatSmallHeat(result.qRad);
  $("#bConvValue").textContent = formatSmallHeat(result.qConv);

  const maxQ = Math.max(Math.abs(result.qRad), Math.abs(result.qConv), 1e-15);
  $("#bRadBar").style.width = `${Math.abs(result.qRad) / maxQ * 100}%`;
  $("#bConvBar").style.width = `${Math.abs(result.qConv) / maxQ * 100}%`;
  drawBChart();
}

export function initExperimentBView() {
  ["#bWallTemp", "#bGasTemp", "#bVelocity", "#bT6Emissivity"]
    .forEach(id => $(id).addEventListener("input", updateB));

  $$(".sensor-button").forEach(button => button.addEventListener("click", () => {
    selectedSensor = button.dataset.sensor;
    $$(".sensor-button").forEach(item => item.classList.toggle("is-active", item === button));
    updateB();
  }));

  $$(".b-velocity").forEach(button => button.addEventListener("click", () => {
    $("#bVelocity").value = button.dataset.value;
    $$(".b-velocity").forEach(item => item.classList.toggle("is-active", item === button));
    updateB();
  }));

  updateB();
}
