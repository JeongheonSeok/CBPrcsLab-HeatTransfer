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

// 각 평면을 세로로 긴 띠로, 두 띠를 나란히 놓는다. 히터 위 25 cm가 한 화면이다.
function layout(w, h) {
  const { w: tw, h: th } = data.index.tile;
  const gap = 18, margin = 8;
  const stripH = h - 2 * margin - 16;                  // 아래 16px는 평면 이름
  const stripW = Math.round(stripH * tw / th);
  const total = PLANES.length * stripW + (PLANES.length - 1) * gap;
  const left = Math.max(margin, Math.round((w - total) / 2));
  return PLANES.map((plane, i) => ({ plane, x: left + i * (stripW + gap), y: margin, w: stripW, h: stripH }));
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
  ctx.fillText(PLANE_LABEL[strip.plane], strip.x + strip.w / 2, strip.y + strip.h + 13);
  ctx.textAlign = "left";
}

export function drawFieldView() {
  const canvas = $("#fieldCanvas");
  const setup = setupCanvas(canvas);
  if (!setup || !data) return;
  const { ctx, w, h } = setup;
  ctx.clearRect(0, 0, w, h);
  layout(w, h).forEach(strip => paintStrip(ctx, strip));
  drawHistory();
  updateLabels();
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
  const right = xMap(now) + 6 + ctx.measureText("180 s").width < w - 16;
  labelOnPlot(ctx, `${now.toFixed(0)} s`, xMap(now) + (right ? 6 : -6), 30, CHART_INK.ink, right ? "left" : "right");
}

function updateLabels() {
  const { index } = data;
  const now = index.frames[frameIndex];
  $("#fieldTimeValue").textContent = `${now.toFixed(0)} / ${index.frames[index.frames.length - 1].toFixed(0)} s`;
  const range = field === "temperature" ? index.temperatureC : index.speed;
  const unit = field === "temperature" ? "°C" : "m/s";
  $("#colorbarMax").textContent = `${range.max.toFixed(field === "temperature" ? 0 : 2)} ${unit}`;
  $("#colorbarMin").textContent = `${range.min.toFixed(field === "temperature" ? 0 : 2)} ${unit}`;
  $("#colorbarGradient").style.background = `linear-gradient(to top, ${RAMP[field].join(",")})`;
}

// 180 s에서 아직 오르는 중이다. 정상상태처럼 읽히지 않게 기울기를 함께 적는다.
function showSummary() {
  const { index } = data;
  const f = index.final;
  $("#cfdQIn").innerHTML = `${f.qInW.toFixed(2)} <small>W</small>`;
  $("#cfdQConv").innerHTML = `${f.qConvW.toFixed(2)} <small>W</small>`;
  $("#cfdQRad").innerHTML = `${f.qRadW.toFixed(2)} <small>W</small>`;
  $("#cfdT10").innerHTML = `${f.T10C.toFixed(1)} <small>°C</small>`;
  const stored = f.qInW - f.qConvW - f.qRadW;
  $("#cfdNote").textContent =
    `At ${f.timeS.toFixed(0)} s the heater is still warming at ${f.T10SlopeKPerS.toFixed(2)} K/s: ` +
    `${stored.toFixed(2)} W of the supply is going into the heater's own heat capacity, not into the air. ` +
    `This is a transient, not a steady state.`;
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
  playing = true;
  $("#fieldPlay").textContent = "Pause";
  if (frameIndex >= data.index.frames.length - 1) setFrame(0);
  playTimer = setInterval(() => {
    if (document.hidden) return;             // 숨긴 탭에서는 헛돌지 않는다
    setFrame((frameIndex + 1) % data.index.frames.length);
  }, 1000 / FRAMES_PER_SECOND);
}

async function switchCase() {
  stop();
  const caseId = currentCaseId();
  data = null;
  $("#fieldPending").hidden = true;
  $("#fieldReadout").textContent = "—";
  const loaded = await loadCase(caseId);
  if (currentCaseId() !== caseId) return;    // 기다리는 동안 다른 case를 골랐다
  if (!loaded) {
    $("#fieldPending").hidden = false;
    $("#fieldPending").textContent = `${CFD_CASES[caseId].label} has not been computed yet. The case is listed so the format is agreed; the frames arrive when the lab runs it.`;
    const ctx = $("#fieldCanvas").getContext("2d");
    ctx.clearRect(0, 0, $("#fieldCanvas").width, $("#fieldCanvas").height);
    return;
  }
  data = loaded;
  $("#fieldTime").max = data.index.frames.length - 1;
  showSummary();
  setFrame(data.index.frames.length - 1);
}

export function initFieldViewer() {
  lut.temperature = buildLut(RAMP.temperature);
  lut.speed = buildLut(RAMP.speed);

  // 목록은 합의된 조건 전체다. 산출물이 있는 case만 고를 수 있게 한다.
  const select = $("#fieldCase");
  Promise.all(Object.keys(CFD_CASES).map(async id => {
    const ok = (await fetch(`assets/data/cfd/${id}/index.json`, { method: "HEAD" })).ok;
    select.querySelector(`option[value="${id}"]`).disabled = !ok;
    return ok ? id : null;
  })).then(ids => {
    const first = ids.find(Boolean);
    if (first) { select.value = first; switchCase(); }
  });

  select.addEventListener("change", switchCase);
  $$(".field-type").forEach(button => button.addEventListener("click", async () => {
    field = button.dataset.field;
    $$(".field-type").forEach(item => item.classList.toggle("is-active", item === button));
    if (data) await ensureField(data, field);
    drawFieldView();
  }));
  const step = delta => { stop(); setFrame(frameIndex + delta); };
  $("#fieldTime").addEventListener("input", () => { stop(); setFrame(numberValue("#fieldTime", 0)); });
  $("#fieldPlay").addEventListener("click", () => (playing ? stop() : play()));
  $("#fieldStepBack").addEventListener("click", () => step(-1));
  $("#fieldStepForward").addEventListener("click", () => step(1));
  $("#fieldReset").addEventListener("click", () => { stop(); setFrame(0); });
  $("#fieldCanvas").addEventListener("pointermove", event => { if (data) handleProbe(event); });

  // 이 화면이 보일 때만. 입력 칸에 타이핑하는 중이면 건드리지 않는다.
  document.addEventListener("keydown", event => {
    if (!data || !$("#field-viewer").classList.contains("is-active")) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName) && event.target.type !== "range") return;
    if (event.key === " ") { event.preventDefault(); playing ? stop() : play(); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
    else if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
  });
}
