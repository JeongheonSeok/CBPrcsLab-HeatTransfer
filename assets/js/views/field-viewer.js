// 유동장 화면: case 선택, 시간 탐색, CFD·lumped 비교

import { $, clamp, numberValue, formatW } from "../core/dom.js";
import { setupCanvas, drawAxes, drawLine, makeScales, drawVerticalMarker, SERIES_COLOR } from "../core/chart.js";
import { CFD_CASES } from "../data/cfd-cases.js";
import { fieldSample, PALETTE_CSS } from "../data/synthetic-field.js";
import { createOffscreen, renderField } from "./field-renderer.js";

// 화면 시간을 물리 시간으로 옮기는 축척
const TIME_SCALE = 45;          // fieldSample에 넘길 t = 초 / TIME_SCALE
const PLAY_SPEED = 0.06;        // 실시간 1 ms 당 늘어나는 모의 시간 [s]
const MAX_SECONDS = 600;

let fieldCanvas = null;
let fieldCtx = null;
let offscreen = null;
let playing = false;
let animationFrame = null;
let lastFrameTime = 0;

// 지수 형태의 시간 응답은 UI 확인용 근사. 단계 4에서 실제 데이터로 교체
export function currentCfdState(caseId = $("#fieldCase").value, seconds = numberValue("#fieldTime", 180)) {
  const meta = CFD_CASES[caseId] || CFD_CASES.A11;
  const elapsed = Math.max(seconds, 0);
  const heatRamp = 1 - Math.exp(-elapsed / meta.heatTau);
  const approach = (target, tau) => meta.temp0 + (target - meta.temp0) * (1 - Math.exp(-elapsed / tau));
  return {
    meta, seconds,
    cfdTemp: approach(meta.tempCfd, meta.tauCfd),
    lumpedTemp: approach(meta.tempLumped, meta.tauLumped),
    qConv: meta.qConv * heatRamp,
    qRad: meta.qRad * heatRamp,
    qTotal: (meta.qConv + meta.qRad) * heatRamp,
    qConvLumped: meta.qConv * 0.94 * (1 - Math.exp(-elapsed / (meta.heatTau * 0.88))),
    qRadLumped: meta.qRad * 1.06 * (1 - Math.exp(-elapsed / (meta.heatTau * 0.95)))
  };
}

export function resizeFieldCanvas() {
  const rect = fieldCanvas.getBoundingClientRect();
  if (rect.width < 10) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  fieldCanvas.width = Math.round(rect.width * dpr);
  fieldCanvas.height = Math.round(rect.height * dpr);
  fieldCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawField();
}

export function drawField() {
  const rect = fieldCanvas.getBoundingClientRect();
  if (rect.width < 10) return;
  const seconds = numberValue("#fieldTime", 180);
  renderField(fieldCtx, offscreen, {
    w: rect.width, h: rect.height,
    caseId: $("#fieldCase").value,
    type: $("#fieldType").value,
    t: seconds / TIME_SCALE
  });
  updateViewerLabels();
  updateCfdSummary();
}

function updateViewerLabels() {
  const caseText = $("#fieldCase").selectedOptions[0].textContent.trim();
  const isTemperature = $("#fieldType").value === "temperature";
  $("#viewerStatus").textContent = `${caseText} · ${isTemperature ? "온도장" : "속도 크기"}`;

  const seconds = Math.round(numberValue("#fieldTime", 180));
  $("#fieldFrame").textContent = `t = ${seconds} s`;
  $("#fieldTimeValue").textContent = `t = ${seconds} s`;

  $("#colorbarMax").textContent = isTemperature ? "hot" : "fast";
  $("#colorbarMid").textContent = isTemperature ? "T" : "|U|";
  $("#colorbarMin").textContent = isTemperature ? "cold" : "slow";
  $("#colorbarGradient").style.background = isTemperature ? PALETTE_CSS.temperature : PALETTE_CSS.speed;
}

function drawCfdComparison() {
  const canvas = $("#cfdCompareChart");
  const setup = setupCanvas(canvas);
  if (!setup) return;
  const { ctx, w, h } = setup;
  const meta = CFD_CASES[$("#fieldCase").value] || CFD_CASES.A11;
  const duration = MAX_SECONDS;

  const cfd = [], lumped = [];
  for (let i = 0; i <= 120; i += 1) {
    const t = duration * i / 120;
    cfd.push({ t, temp: meta.temp0 + (meta.tempCfd - meta.temp0) * (1 - Math.exp(-t / meta.tauCfd)) });
    lumped.push({ t, temp: meta.temp0 + (meta.tempLumped - meta.temp0) * (1 - Math.exp(-t / meta.tauLumped)) });
  }

  let minY = meta.temp0;
  let maxY = Math.max(meta.tempCfd, meta.tempLumped);
  const pad = Math.max((maxY - minY) * 0.12, 1);
  minY -= pad * 0.2; maxY += pad;

  const { xMap, yMap } = makeScales(w, h, [0, duration], [minY, maxY]);
  drawAxes(ctx, w, h, "t (s)", "T (°C)", [0, 300, 600],
    [+minY.toFixed(0), +((minY + maxY) / 2).toFixed(0), +maxY.toFixed(0)], xMap, yMap);
  drawLine(ctx, cfd.map(p => [xMap(p.t), yMap(p.temp)]), SERIES_COLOR.conv, 2.5);
  drawLine(ctx, lumped.map(p => [xMap(p.t), yMap(p.temp)]), SERIES_COLOR.surface, 2.5);
  drawVerticalMarker(ctx, xMap(clamp(numberValue("#fieldTime", 180), 0, duration)), h);
}

export function updateCfdSummary() {
  if (!$("#cfdQConv")) return;
  const state = currentCfdState();
  const { meta } = state;

  $("#cfdQConv").innerHTML = formatW(state.qConv);
  $("#cfdQRad").innerHTML = formatW(state.qRad);
  $("#cfdQTotal").innerHTML = formatW(state.qTotal);

  const radPct = state.qTotal > 1e-12 ? state.qRad / state.qTotal * 100 : 0;
  const convPct = state.qTotal > 1e-12 ? state.qConv / state.qTotal * 100 : 0;
  $("#cfdRadFraction").innerHTML = `${radPct.toFixed(1)} <small>%</small>`;
  $("#cfdRadMethod").textContent = meta.radMethod;
  $("#cfdConvPct").textContent = `${convPct.toFixed(1)}%`;
  $("#cfdRadPct").textContent = `${radPct.toFixed(1)}%`;
  $("#cfdConvBar").style.width = `${convPct}%`;
  $("#cfdRadBar").style.width = `${radPct}%`;
  $("#cfdHeatMethodNote").textContent = `${meta.label}: ${meta.radMethod}. 현재 숫자는 UI 확인용 예시이며, 실제 배포에서는 원본 CFD 표면 적분 결과로 교체합니다.`;

  $("#cmpTemperatureLabel").textContent = meta.quantity;
  $("#cfdCompareSub").textContent = meta.quantity;
  $("#cmpTCfd").textContent = `${state.cfdTemp.toFixed(1)} °C`;
  $("#cmpTLumped").textContent = `${state.lumpedTemp.toFixed(1)} °C`;
  $("#cmpDeltaT").textContent = `${(state.cfdTemp - state.lumpedTemp).toFixed(1)} °C`;
  $("#cmpConvCfd").textContent = `${state.qConv.toFixed(2)} W`;
  $("#cmpConvLumped").textContent = `${state.qConvLumped.toFixed(2)} W`;
  $("#cmpDeltaConv").textContent = `${(state.qConv - state.qConvLumped).toFixed(2)} W`;
  $("#cmpRadCfd").textContent = `${state.qRad.toFixed(2)} W`;
  $("#cmpRadLumped").textContent = `${state.qRadLumped.toFixed(2)} W`;
  $("#cmpDeltaRad").textContent = `${(state.qRad - state.qRadLumped).toFixed(2)} W`;
  drawCfdComparison();
}

function animate(now) {
  if (!playing) return;
  const dt = now - lastFrameTime;
  lastFrameTime = now;
  let value = numberValue("#fieldTime", 0) + dt * PLAY_SPEED;
  if (value > MAX_SECONDS) value = 0;
  $("#fieldTime").value = value;
  drawField();
  animationFrame = requestAnimationFrame(animate);
}

function handleProbe(event) {
  const rect = fieldCanvas.getBoundingClientRect();
  const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
  const sample = fieldSample(x, y, numberValue("#fieldTime", 0) / TIME_SCALE, $("#fieldCase").value);
  // 정규화 값을 표시 단위로 환산. 실제 데이터에서는 case metadata의 범위를 사용
  const value = $("#fieldType").value === "temperature"
    ? `${(20 + sample.temp * 125).toFixed(1)} °C`
    : `${(sample.speed * 1.6).toFixed(2)} m/s`;
  $("#fieldReadout").textContent = `x = ${(x * 100).toFixed(1)}% · y = ${(y * 100).toFixed(1)}% · ${value}`;
}

export function initFieldViewer() {
  fieldCanvas = $("#fieldCanvas");
  if (!fieldCanvas) return;
  fieldCtx = fieldCanvas.getContext("2d");
  offscreen = createOffscreen();

  $("#fieldCase").addEventListener("change", drawField);
  $("#fieldType").addEventListener("change", drawField);
  $("#fieldTime").addEventListener("input", drawField);
  $("#fieldReset").addEventListener("click", () => { $("#fieldTime").value = 0; drawField(); });
  $("#fieldPlay").addEventListener("click", () => {
    playing = !playing;
    $("#fieldPlay").textContent = playing ? "Ⅱ 일시정지" : "▶ 재생";
    if (playing) { lastFrameTime = performance.now(); animationFrame = requestAnimationFrame(animate); }
    else cancelAnimationFrame(animationFrame);
  });
  fieldCanvas.addEventListener("pointermove", handleProbe);

  resizeFieldCanvas();
  updateCfdSummary();
}

export { drawCfdComparison };
