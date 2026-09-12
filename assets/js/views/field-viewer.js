// 유동장 화면: 미리 계산한 CFD 단면을 시간에 따라 재생한다.

import { $, $$, clamp, numberValue } from "../core/dom.js";
import { setupCanvas, drawAxes, drawLine, makeScales, drawVerticalMarker, labelOnPlot, CHART_INK, CHART_FONT, SERIES_COLOR } from "../core/chart.js";
import { CFD_CASES } from "../data/cfd-cases.js";
import { loadCase, ensureField, frameData, physical } from "../core/cfd-loader.js";

// 색 램프. 둘 다 밝기가 단조 증가한다. 밝기가 곧 크기라야 색맹인 사람도 읽는다.
// 온도는 열화상 카메라의 관례(검정→보라→빨강→노랑→흰색)를 따른다. 색상이 함께 바뀌어
// 한 색상 램프보다 작은 온도차가 훨씬 잘 구분된다. 무지개와 달리 밝기 순서는 지킨다.
// 속력은 어두운 남색에서 흰색으로, 온도와 겹쳐 보이지 않게 찬 색 쪽을 쓴다.
const RAMP = {
  temperature: ["#000004", "#160b39", "#420a68", "#6a176e", "#932667", "#bc3754",
                "#dd513a", "#f37819", "#fca50a", "#f6d746", "#fcffa4"],
  speed: ["#0d2035", "#1d4c7f", "#279fc3", "#6bd8c2", "#eefbff"]
};
const PLANES = ["yz", "xz"];
const PLANE_LABEL = { yz: "Side view · x = 0", xz: "Front view · y = 0" };
const FRAMES_PER_SECOND = 20;     // 프레임 간격이 0.5 s이므로 실시간의 10배. 180 s가 18초에 돈다

let data = null;                  // 현재 case의 산출물
let field = "temperature";
let frameIndex = 0;
let playing = false;
let playTimer = null;
let busy = false;
let loadVersion = 0;
const scratch = document.createElement("canvas");
const tinted = document.createElement("canvas");
const lut = {};

function hexToRgb(hex) {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}

// 5개 정지점을 256단계로 편다. sRGB 선형 보간이지만 램프가 단조라 충분하다.
function buildLut(stops) {
  const rgb = stops.map(hexToRgb);
  const table = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i += 1) {
    const pos = i / 255 * (stops.length - 1);
    const a = Math.floor(pos), b = Math.min(a + 1, stops.length - 1), u = pos - a;
    for (let k = 0; k < 3; k += 1) table[i * 3 + k] = rgb[a][k] + (rgb[b][k] - rgb[a][k]) * u;
  }
  return table;
}

function currentCaseId() {
  return $("#fieldCase").value;
}

// 단면 비율을 유지하면서 캔버스의 폭과 높이 모두에 맞춘다.
function layout(w, h) {
  const { w: tw, h: th } = data.index.tile;
  const gap = 18, margin = 8;
  const stripH = Math.max(1, Math.min(h - 2 * margin - 20, (w - 2 * margin - gap) / PLANES.length * th / tw));
  const stripW = stripH * tw / th;
  const total = PLANES.length * stripW + (PLANES.length - 1) * gap;
  const left = Math.max(margin, Math.round((w - total) / 2));
  const top = Math.max(margin, (h - stripH - 20) / 2);
  return PLANES.map((plane, i) => ({ plane, x: left + i * (stripW + gap), y: top, w: stripW, h: stripH }));
}

function paintStrip(ctx, strip) {
  const { index } = data;
  const image = frameData(data, strip.plane, field, frameIndex, scratch);
  const table = lut[field];
  const out = new ImageData(image.width, image.height);
  for (let i = 0, j = 0; i < image.data.length; i += 4, j += 4) {
    const v = image.data[i] * 3;
    out.data[j] = table[v]; out.data[j + 1] = table[v + 1]; out.data[j + 2] = table[v + 2]; out.data[j + 3] = 255;
  }
  tinted.width = image.width; tinted.height = image.height;
  tinted.getContext("2d").putImageData(out, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tinted, strip.x, strip.y, strip.w, strip.h);

  // 히터 윤곽. 속력장에서는 히터가 0이라 배경과 같은 색이므로 윤곽이 있어야 위치가 읽힌다.
  const { roi, heater } = index;
  const scale = strip.h / (roi.zHi - roi.zLo);
  const cy = strip.y + (roi.zHi - heater.centerZ) * scale;
  const r = heater.radius * scale;
  ctx.beginPath();
  if (strip.plane === "yz") ctx.arc(strip.x + strip.w / 2, cy, r, 0, Math.PI * 2);
  else ctx.rect(strip.x, cy - r, strip.w, 2 * r);
  // 바탕이 검정(찬 공기)일 수도 노랑(히터)일 수도 있어 흰 테두리 위에 검은 선을 얹는다.
  ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.strokeStyle = CHART_INK.mark; ctx.lineWidth = 1; ctx.stroke();

  ctx.strokeStyle = CHART_INK.grid; ctx.strokeRect(strip.x + 0.5, strip.y + 0.5, strip.w - 1, strip.h - 1);
  ctx.font = CHART_FONT; ctx.fillStyle = CHART_INK.ink; ctx.textAlign = "center";
  ctx.fillText(strip.w < 135 ? `${strip.plane} plane` : PLANE_LABEL[strip.plane], strip.x + strip.w / 2, strip.y + strip.h + 13);
  ctx.textAlign = "left";
}

export function drawFieldView() {
  const canvas = $("#fieldCanvas");
  const setup = setupCanvas(canvas);
  if (!setup || !data || busy) return;
  const { ctx, w, h } = setup;
  ctx.clearRect(0, 0, w, h);
  layout(w, h).forEach(strip => paintStrip(ctx, strip));
  drawHistory();
  updateLabels();
  showSummary();
  $("#fieldReadout").textContent = "—";
}

// T10(t)에 현재 시각을 표시한다. 애니메이션의 어느 순간이 숫자의 어디인지 이어 준다.
function drawHistory() {
  const setup = setupCanvas($("#historyChart"));
  if (!setup) return;
  const { ctx, w, h } = setup;
  const { time_s: t, T10_C: T10 } = data.history;
  const maxT = Math.max(...T10), minT = Math.min(...T10);
  const pad = (maxT - minT) * 0.1 || 1;
  const { xMap, yMap } = makeScales(w, h, [0, t[t.length - 1]], [minT - pad, maxT + pad]);
  const end = t[t.length - 1];
  drawAxes(ctx, w, h, "t (s)", "T₁₀ (°C)", [0, Math.round(end / 2), end],
    [+minT.toFixed(0), +((minT + maxT) / 2).toFixed(0), +maxT.toFixed(0)], xMap, yMap);
  drawLine(ctx, t.map((s, i) => [xMap(s), yMap(T10[i])]), SERIES_COLOR.surface, 2.2);
  const now = data.index.frames[frameIndex];
  drawVerticalMarker(ctx, xMap(now), h);
  ctx.font = CHART_FONT;
  // 오른쪽 끝에서는 라벨이 잘리므로 선의 왼쪽에 붙인다.
  const label = `${now.toFixed(1)} s`;
  const right = xMap(now) + 6 + ctx.measureText(label).width < w - 16;
  labelOnPlot(ctx, label, xMap(now) + (right ? 6 : -6), 30, CHART_INK.ink, right ? "left" : "right");
}

function updateLabels() {
  const { index } = data;
  const now = index.frames[frameIndex];
  $("#fieldTimeValue").textContent = `${now.toFixed(1)} / ${index.frames[index.frames.length - 1].toFixed(0)} s`;
  $("#fieldTime").setAttribute("aria-valuetext", `${now.toFixed(1)} seconds`);
  const range = field === "temperature" ? index.temperatureC : index.speed;
  const unit = field === "temperature" ? "°C" : "m/s";
  $("#colorbarMax").textContent = `${range.max.toFixed(field === "temperature" ? 0 : 2)} ${unit}`;
  $("#colorbarMin").textContent = `${range.min.toFixed(field === "temperature" ? 0 : 2)} ${unit}`;
  $("#colorbarMid").textContent = `${((range.min + range.max) / 2).toFixed(field === "temperature" ? 0 : 2)} ${unit}`;
  $("#colorbarGradient").style.background = `linear-gradient(to top, ${RAMP[field].join(",")})`;
  $("#fieldPlay").textContent = playing ? "Pause" : frameIndex === index.frames.length - 1 ? "Replay" : "Play";
}

// 표시용 픽셀 대신 원본 시계열에서 선택 시점의 수치를 읽는다.
function showSummary() {
  const { index, history } = data;
  const now = index.frames[frameIndex];
  const i = history.time_s.findIndex(t => t >= now);
  if (i < 0) return;
  const qIn = history.Q_in_W[i], qConv = history.Q_heater_to_air_conv_W[i], qRad = history.Q_heater_to_air_rad_W[i];
  $("#cfdSummaryTime").textContent = `${now.toFixed(1)} s`;
  $("#cfdQIn").innerHTML = `${qIn.toFixed(2)} <small>W</small>`;
  $("#cfdQConv").innerHTML = `${qConv.toFixed(2)} <small>W</small>`;
  $("#cfdQRad").innerHTML = `${qRad.toFixed(2)} <small>W</small>`;
  $("#cfdT10").innerHTML = `${history.T10_C[i].toFixed(1)} <small>°C</small>`;
  $("#cfdNote").textContent = `Supply − convection − radiation = ${(qIn - qConv - qRad).toFixed(2)} W at this time.`;
}

function handleProbe(event) {
  const canvas = $("#fieldCanvas");
  const rect = canvas.getBoundingClientRect();
  const px = event.clientX - rect.left, py = event.clientY - rect.top;
  const strip = layout(rect.width, rect.height).find(s => px >= s.x && px < s.x + s.w && py >= s.y && py < s.y + s.h);
  if (!strip) { $("#fieldReadout").textContent = "—"; return; }
  const { index } = data;
  const image = frameData(data, strip.plane, field, frameIndex, scratch);
  const col = clamp(Math.floor((px - strip.x) / strip.w * image.width), 0, image.width - 1);
  const row = clamp(Math.floor((py - strip.y) / strip.h * image.height), 0, image.height - 1);
  const byte = image.data[(row * image.width + col) * 4];
  const value = physical(index, field, byte);
  const z = index.roi.zHi - (row + 0.5) / index.roi.pxPerM;
  const lateral = (col + 0.5) / index.roi.pxPerM - index.roi.halfWidth;
  const unit = field === "temperature" ? "°C" : "m/s";
  $("#fieldReadout").textContent =
    `${strip.plane} · ${(lateral * 1000).toFixed(0)} mm, z ${z.toFixed(3)} m · ${value.toFixed(field === "temperature" ? 1 : 3)} ${unit}`;
}

function setFrame(i) {
  if (!data || busy) return;
  frameIndex = clamp(Math.round(i), 0, data.index.frames.length - 1);
  $("#fieldTime").value = frameIndex;
  drawFieldView();
}

function stop() {
  playing = false;
  clearInterval(playTimer);
  $("#fieldPlay").textContent = "Play";
}

function play() {
  if (!data || busy) return;
  playing = true;
  $("#fieldPlay").textContent = "Pause";
  if (frameIndex >= data.index.frames.length - 1) setFrame(0);
  playTimer = setInterval(() => {
    if (document.hidden || !$("#field-viewer").classList.contains("is-active")) { stop(); return; }
    setFrame((frameIndex + 1) % data.index.frames.length);
  }, 1000 / FRAMES_PER_SECOND);
}

function setLoading(value, message = "") {
  busy = value;
  $("#fieldPending").hidden = !message;
  $("#fieldPending").textContent = message;
  $("#field-viewer").setAttribute("aria-busy", String(value));
  $$("#field-viewer .transport-row button, #fieldTime, #field-viewer .field-type")
    .forEach(control => { control.disabled = value || !data; });
}

async function switchCase() {
  stop();
  const version = ++loadVersion;
  const caseId = currentCaseId();
  data = null;
  setLoading(true, `Loading ${CFD_CASES[caseId].label}…`);
  ["fieldReadout", "cfdSummaryTime", "cfdQIn", "cfdQConv", "cfdQRad", "cfdT10", "cfdNote", "fieldTimeValue", "colorbarMax", "colorbarMid", "colorbarMin"]
    .forEach(id => { $(`#${id}`).textContent = "—"; });
  ["fieldCanvas", "historyChart"].forEach(id => {
    const canvas = $(`#${id}`);
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  });
  try {
    const loaded = await loadCase(caseId);
    if (version !== loadVersion) return;
    if (!loaded) { setLoading(false, `${CFD_CASES[caseId].label} is not available yet.`); return; }
    await ensureField(loaded, field);
    if (version !== loadVersion) return;
    data = loaded;
    $("#fieldTime").max = data.index.frames.length - 1;
    setLoading(false);
    setFrame(data.index.frames.length - 1);
  } catch (error) {
    if (version === loadVersion) setLoading(false, "Could not load this case. Select another case or reload to retry.");
  }
}

export function initFieldViewer() {
  lut.temperature = buildLut(RAMP.temperature);
  lut.speed = buildLut(RAMP.speed);

  // 목록은 합의된 조건 전체다. 산출물이 있는 case만 고를 수 있게 한다.
  const select = $("#fieldCase");
  select.disabled = true;
  setLoading(true, "Checking available cases…");
  Promise.all(Object.keys(CFD_CASES).map(async id => {
    let ok = false;
    try { ok = (await fetch(`assets/data/cfd/${id}/index.json`, { method: "HEAD" })).ok; } catch { /* 연결 실패도 선택 불가로 표시 */ }
    select.querySelector(`option[value="${id}"]`).disabled = !ok;
    return ok ? id : null;
  })).then(ids => {
    select.disabled = false;
    const first = ids.find(Boolean);
    if (first) { select.value = first; switchCase(); }
    else setLoading(false, "No cases could be loaded. Reload to retry.");
  });

  select.addEventListener("change", switchCase);
  $$(".field-type").forEach(button => button.addEventListener("click", async () => {
    if (!data || busy) return;
    stop();
    const version = ++loadVersion;
    const nextField = button.dataset.field;
    setLoading(true, `Loading ${button.textContent.toLowerCase()}…`);
    try {
      await ensureField(data, nextField);
      if (version !== loadVersion) return;
      field = nextField;
      $$(".field-type").forEach(item => {
        item.classList.toggle("is-active", item === button);
        item.setAttribute("aria-pressed", String(item === button));
      });
      setLoading(false);
      drawFieldView();
    } catch (error) {
      if (version === loadVersion) setLoading(false, "Could not load this field. Select it again to retry.");
    }
  }));
  const step = delta => { stop(); setFrame(frameIndex + delta); };
  $("#fieldTime").addEventListener("input", () => { stop(); setFrame(numberValue("#fieldTime", 0)); });
  $("#fieldPlay").addEventListener("click", () => (playing ? stop() : play()));
  $("#fieldStepBack").addEventListener("click", () => step(-1));
  $("#fieldStepForward").addEventListener("click", () => step(1));
  $("#fieldReset").addEventListener("click", () => { stop(); setFrame(0); });
  $("#fieldCanvas").addEventListener("pointermove", event => { if (data && !busy) handleProbe(event); });
  $("#fieldCanvas").addEventListener("pointerleave", () => { $("#fieldReadout").textContent = "—"; });

  // 이 화면이 보일 때만. 입력 칸에 타이핑하는 중이면 건드리지 않는다.
  document.addEventListener("keydown", event => {
    if (!data || busy || document.querySelector("dialog[open]") || !$("#field-viewer").classList.contains("is-active")) return;
    if (event.target.closest("button, summary, [contenteditable]")) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName) && event.target.type !== "range") return;
    if (event.key === " ") { event.preventDefault(); playing ? stop() : play(); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
    else if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
  });
}
