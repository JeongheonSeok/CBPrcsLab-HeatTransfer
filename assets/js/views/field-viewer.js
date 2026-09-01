// 유동장 화면. case 선택, 시간 탐색, 표면 열전달 표시.
//
// 실제 CFD 결과는 아직 없다. 값을 지어내는 대신 자리만 두고 "—"를 그린다.
// cfd-cases.js에 계산 결과가 채워지면 이 화면이 그대로 살아난다.

import { $, clamp, numberValue } from "../core/dom.js";
import { CFD_CASES } from "../data/cfd-cases.js";
import { fieldSample, PALETTE_CSS } from "../data/synthetic-field.js";
import { createOffscreen, renderField } from "./field-renderer.js";

const TIME_SCALE = 45;      // fieldSample에 넘길 t = 초 / TIME_SCALE
const PLAY_SPEED = 0.06;    // 실시간 1 ms 당 늘어나는 모의 시간 [s]
const MAX_SECONDS = 600;

let canvas = null;
let ctx = null;
let offscreen = null;
let playing = false;
let frame = null;
let lastFrameTime = 0;

const currentCase = () => CFD_CASES[$("#fieldCase").value] || CFD_CASES.A11;

export function resizeFieldCanvas() {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 10) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawField();
}

export function drawField() {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 10) return;
  renderField(ctx, offscreen, {
    w: rect.width, h: rect.height,
    caseId: $("#fieldCase").value,
    type: $("#fieldType").value,
    t: numberValue("#fieldTime", 180) / TIME_SCALE
  });
  updateLabels();
}

function updateLabels() {
  const meta = currentCase();
  const isTemperature = $("#fieldType").value === "temperature";
  $("#viewerStatus").textContent = `${meta.label} · ${isTemperature ? "Temperature" : "Speed"}`;

  const seconds = Math.round(numberValue("#fieldTime", 180));
  $("#fieldFrame").textContent = `t = ${seconds} s`;
  $("#fieldTimeValue").textContent = `t = ${seconds} s`;

  $("#colorbarMax").textContent = isTemperature ? "hot" : "fast";
  $("#colorbarMid").textContent = isTemperature ? "T" : "|U|";
  $("#colorbarMin").textContent = isTemperature ? "cold" : "slow";
  $("#colorbarGradient").style.background = isTemperature ? PALETTE_CSS.temperature : PALETTE_CSS.speed;
}

/** case에 계산 결과가 없는 동안은 자리만 보여 준다. */
export function updateCfdSummary() {
  if (!$("#cfdQConv")) return;
  const meta = currentCase();
  const pending = meta.status === "pending";

  $("#cfdRadMethod").textContent = pending ? "Awaiting CFD data" : meta.radMethod;
  $("#cmpTemperatureLabel").textContent = meta.quantity;

  const blanks = ["#cfdQConv", "#cfdQRad", "#cfdQTotal", "#cfdRadFraction",
                  "#cmpTCfd", "#cmpTLumped", "#cmpDeltaT",
                  "#cmpConvCfd", "#cmpConvLumped", "#cmpDeltaConv",
                  "#cmpRadCfd", "#cmpRadLumped", "#cmpDeltaRad"];
  if (pending) {
    blanks.forEach(id => { $(id).textContent = "—"; });
    $("#cfdHeatMethodNote").textContent =
      `${meta.label} has not been computed yet. These rows list what the case will report once the lab runs it.`;
  }
}

function animate(now) {
  if (!playing) return;
  const dt = now - lastFrameTime;
  lastFrameTime = now;
  let value = numberValue("#fieldTime", 0) + dt * PLAY_SPEED;
  if (value > MAX_SECONDS) value = 0;
  $("#fieldTime").value = value;
  drawField();
  frame = requestAnimationFrame(animate);
}

function handleProbe(event) {
  const rect = canvas.getBoundingClientRect();
  const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
  const sample = fieldSample(x, y, numberValue("#fieldTime", 0) / TIME_SCALE, $("#fieldCase").value);
  // 합성장이라 물리 단위를 붙이지 않는다. 0~1 상대값으로만 읽는다.
  const value = $("#fieldType").value === "temperature" ? sample.temp : sample.speed;
  $("#fieldReadout").textContent =
    `x ${(x * 100).toFixed(0)}% · y ${(y * 100).toFixed(0)}% · relative ${value.toFixed(2)}`;
}

export function initFieldViewer() {
  canvas = $("#fieldCanvas");
  if (!canvas) return;
  ctx = canvas.getContext("2d");
  offscreen = createOffscreen();

  $("#fieldCase").addEventListener("change", () => { drawField(); updateCfdSummary(); });
  $("#fieldType").addEventListener("change", drawField);
  $("#fieldTime").addEventListener("input", drawField);
  $("#fieldReset").addEventListener("click", () => { $("#fieldTime").value = 0; drawField(); });
  $("#fieldPlay").addEventListener("click", () => {
    playing = !playing;
    $("#fieldPlay").textContent = playing ? "Pause" : "Play";
    if (playing) { lastFrameTime = performance.now(); frame = requestAnimationFrame(animate); }
    else cancelAnimationFrame(frame);
  });
  canvas.addEventListener("pointermove", handleProbe);

  resizeFieldCanvas();
  updateCfdSummary();
}
