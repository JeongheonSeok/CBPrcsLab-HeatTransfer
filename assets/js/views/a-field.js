// 실험 A 관찰 화면: 가열 실린더 주위의 CFD 단면을 시간에 따라 재생한다.

import { $, $$, clamp, numberValue } from "../core/dom.js";
import { setupCanvas, drawAxes, drawLine, drawArea, makeScales, drawVerticalMarker, labelOnPlot, CHART_INK, CHART_FONT, SERIES_COLOR } from "../core/chart.js";
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
let highlighted = null;           // 절개 도식에서 가리키는 평면
const scratch = document.createElement("canvas");
const tinted = document.createElement("canvas");
const lut = {};

function hexToRgb(hex) {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}

// 정지점을 256단계로 편다. sRGB 선형 보간이지만 램프가 단조라 충분하다.
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
  if (highlighted === strip.plane) {
    ctx.strokeStyle = SERIES_COLOR.marker; ctx.lineWidth = 2.5;
    ctx.strokeRect(strip.x + 1, strip.y + 1, strip.w - 2, strip.h - 2);
  }

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
  drawPower();
  drawTemperature();
  updateLabels();
  showBalance();
  describeFrame(canvas);
  hideTip();
}

// 공급 전력이 매 순간 어디로 가는지. Calculate 화면의 누적 막대를 시간축으로 편 것이다.
function drawPower() {
  const setup = setupCanvas($("#powerChart"));
  if (!setup) return;
  const { ctx, w, h } = setup;
  const { time_s: t, Q_in_W: qIn, Q_heater_to_air_conv_W: conv, Q_heater_to_air_rad_W: rad } = data.history;
  const end = t[t.length - 1], top = Math.max(...qIn) * 1.08;
  const { xMap, yMap } = makeScales(w, h, [0, end], [0, top]);
  drawAxes(ctx, w, h, "t (s)", "Q (W)", [0, Math.round(end / 2), end], [0, +(top / 2).toFixed(1), +top.toFixed(1)], xMap, yMap);
  const base = t.map(s => [xMap(s), yMap(0)]);
  const convTop = t.map((s, i) => [xMap(s), yMap(conv[i])]);
  const radTop = t.map((s, i) => [xMap(s), yMap(conv[i] + rad[i])]);
  const inTop = t.map((s, i) => [xMap(s), yMap(qIn[i])]);
  drawArea(ctx, convTop, base, SERIES_COLOR.conv);
  drawArea(ctx, radTop, convTop, SERIES_COLOR.rad);
  drawArea(ctx, inTop, radTop, SERIES_COLOR.residual);
  drawVerticalMarker(ctx, xMap(data.index.frames[frameIndex]), h);
}

function drawTemperature() {
  const setup = setupCanvas($("#historyChart"));
  if (!setup) return;
  const { ctx, w, h } = setup;
  const { time_s: t, T10_C: T10 } = data.history;
  const maxT = Math.max(...T10), minT = Math.min(...T10);
  const pad = (maxT - minT) * 0.1 || 1;
  const end = t[t.length - 1];
  const { xMap, yMap } = makeScales(w, h, [0, end], [minT - pad, maxT + pad]);
  drawAxes(ctx, w, h, "t (s)", "T₁₀ (°C)", [0, Math.round(end / 2), end],
    [+minT.toFixed(0), +((minT + maxT) / 2).toFixed(0), +maxT.toFixed(0)], xMap, yMap);
  drawLine(ctx, t.map((s, i) => [xMap(s), yMap(T10[i])]), SERIES_COLOR.surface, 2.2);
  const now = data.index.frames[frameIndex];
  drawVerticalMarker(ctx, xMap(now), h);
  ctx.font = CHART_FONT;
  const label = `${now.toFixed(1)} s`;
  const right = xMap(now) + 6 + ctx.measureText(label).width < w - 16;
  labelOnPlot(ctx, label, xMap(now) + (right ? 6 : -6), 30, CHART_INK.ink, right ? "left" : "right");
}

// 보이지 않는 사람에게 이 프레임이 무엇인지 말한다. 히터와 플룸의 온도로 요약한다.
function describeFrame(canvas) {
  const { index } = data;
  const now = index.frames[frameIndex];
  if (field !== "temperature") {
    canvas.setAttribute("aria-label", `Air speed around the heater at ${now.toFixed(1)} s, up to ${index.speed.max.toFixed(2)} m/s.`);
    return;
  }
  const image = frameData(data, "yz", "temperature", frameIndex, scratch);
  const heaterTopRow = Math.floor((index.roi.zHi - index.heater.centerZ - index.heater.radius) * index.roi.pxPerM);
  let heater = 0, plume = 0;
  for (let row = 0; row < image.height; row += 1) {
    for (let col = 0; col < image.width; col += 1) {
      const byte = image.data[(row * image.width + col) * 4];
      if (row < heaterTopRow) plume = Math.max(plume, byte); else heater = Math.max(heater, byte);
    }
  }
  canvas.setAttribute("aria-label",
    `Temperature around the heater at ${now.toFixed(1)} s. Heater surface about ${physical(index, "temperature", heater).toFixed(0)} °C; ` +
    `warmest air in the plume about ${physical(index, "temperature", plume).toFixed(0)} °C; inlet air ${index.temperatureC.min.toFixed(0)} °C.`);
}

function updateLabels() {
  const { index } = data;
  const now = index.frames[frameIndex];
  $("#fieldTimeValue").textContent = `${now.toFixed(1)} / ${index.frames[index.frames.length - 1].toFixed(0)} s`;
  $("#fieldTime").setAttribute("aria-valuetext", `${now.toFixed(1)} seconds`);
  const range = field === "temperature" ? index.temperatureC : index.speed;
  const unit = field === "temperature" ? "°C" : "m/s";
  const digits = field === "temperature" ? 0 : 2;
  $("#colorbarMax").textContent = `${range.max.toFixed(digits)} ${unit}`;
  $("#colorbarMid").textContent = `${((range.min + range.max) / 2).toFixed(digits)} ${unit}`;
  $("#colorbarMin").textContent = `${range.min.toFixed(digits)} ${unit}`;
  $("#colorbarGradient").style.background = `linear-gradient(to top, ${RAMP[field].join(",")})`;
  $("#fieldPlay").textContent = playing ? "Pause" : frameIndex === index.frames.length - 1 ? "Replay" : "Play";
}

// 이 순간의 열수지. 표시용 픽셀이 아니라 원본 시계열에서 읽는다.
// 대류·복사로 아직 나가지 못한 몫은 히터를 데우고 있다. CFD에서는 그 정체를 안다.
function showBalance() {
  const { index, history } = data;
  const now = index.frames[frameIndex];
  const i = history.time_s.findIndex(t => t >= now);
  if (i < 0) return;
  const qIn = history.Q_in_W[i], qConv = history.Q_heater_to_air_conv_W[i], qRad = history.Q_heater_to_air_rad_W[i];
  $("#cfdQIn").innerHTML = `${qIn.toFixed(2)} <small>W</small>`;
  $("#cfdQConv").innerHTML = `${qConv.toFixed(2)} <small>W</small>`;
  $("#cfdQRad").innerHTML = `${qRad.toFixed(2)} <small>W</small>`;
  $("#cfdStored").innerHTML = `${(qIn - qConv - qRad).toFixed(2)} <small>W</small>`;
  $("#cfdT10").innerHTML = `${history.T10_C[i].toFixed(1)} <small>°C</small>`;
  // 기울기는 앞뒤 10 s 차분. 정상상태라면 0에 가깝다.
  const lo = Math.max(0, i - 10), hi = Math.min(history.time_s.length - 1, i + 10);
  const slope = hi > lo ? (history.T10_C[hi] - history.T10_C[lo]) / (history.time_s[hi] - history.time_s[lo]) : 0;
  $("#cfdSlope").textContent = `${slope.toFixed(2)} K/s`;
}

function handleProbe(event) {
  const canvas = $("#fieldCanvas");
  const rect = canvas.getBoundingClientRect();
  const px = event.clientX - rect.left, py = event.clientY - rect.top;
  const strip = layout(rect.width, rect.height).find(s => px >= s.x && px < s.x + s.w && py >= s.y && py < s.y + s.h);
  if (!strip) { hideTip(); return; }
  setHighlight(strip.plane, false);
  const { index } = data;
  const image = frameData(data, strip.plane, field, frameIndex, scratch);
  const col = clamp(Math.floor((px - strip.x) / strip.w * image.width), 0, image.width - 1);
  const row = clamp(Math.floor((py - strip.y) / strip.h * image.height), 0, image.height - 1);
  const byte = image.data[(row * image.width + col) * 4];
  const value = physical(index, field, byte);
  const z = index.roi.zHi - (row + 0.5) / index.roi.pxPerM;
  const lateral = (col + 0.5) / index.roi.pxPerM - index.roi.halfWidth;
  const unit = field === "temperature" ? "°C" : "m/s";
  const reading = `${value.toFixed(field === "temperature" ? 1 : 3)} ${unit}`;
  $("#fieldReadout").textContent = `${strip.plane} · ${(lateral * 1000).toFixed(0)} mm, z ${z.toFixed(3)} m · ${reading}`;

  // 값은 커서 옆에, 십자선은 띠 안에서만. 그림이 아니라 데이터라는 것이 손끝에서 느껴져야 한다.
  const tip = $("#fieldTip");
  tip.hidden = false;
  tip.textContent = reading;
  tip.style.left = `${px}px`; tip.style.top = `${py}px`;
  tip.style.transform = px > rect.width - 90 ? "translate(calc(-100% - 10px), -50%)" : "translate(10px, -50%)";
  const crossH = $("#fieldCrossH"), crossV = $("#fieldCrossV");
  crossH.hidden = crossV.hidden = false;
  crossH.style.top = `${py}px`; crossH.style.left = `${strip.x}px`; crossH.style.right = `${rect.width - strip.x - strip.w}px`;
  crossV.style.left = `${px}px`; crossV.style.top = `${strip.y}px`; crossV.style.bottom = `${rect.height - strip.y - strip.h}px`;
}

function hideTip() {
  $("#fieldReadout").textContent = "—";
  setHighlight(null, false);
  ["#fieldTip", "#fieldCrossH", "#fieldCrossV"].forEach(id => { $(id).hidden = true; });
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
  const noLoop = matchMedia("(prefers-reduced-motion: reduce)").matches;
  playTimer = setInterval(() => {
    if (document.hidden || !$("#a-field").classList.contains("is-active")) { stop(); return; }
    if (noLoop && frameIndex >= data.index.frames.length - 1) { stop(); return; }
    setFrame((frameIndex + 1) % data.index.frames.length);
  }, 1000 / FRAMES_PER_SECOND);
}

function setLoading(value, message = "") {
  busy = value;
  $("#fieldPending").hidden = !message;
  $("#fieldPending").textContent = message;
  $("#a-field").setAttribute("aria-busy", String(value));
  $$("#fieldPlay, #fieldTime, #a-field .field-type").forEach(control => { control.disabled = value || !data; });
}

async function switchCase(caseId) {
  stop();
  const version = ++loadVersion;
  data = null;
  $$(".case-pick").forEach(b => b.classList.toggle("is-active", b.dataset.case === caseId));
  setLoading(true, `Loading ${CFD_CASES[caseId].label}…`);
  ["fieldReadout", "cfdQIn", "cfdQConv", "cfdQRad", "cfdStored", "cfdT10", "cfdSlope", "fieldTimeValue", "colorbarMax", "colorbarMid", "colorbarMin"]
    .forEach(id => { $(`#${id}`).textContent = "—"; });
  ["fieldCanvas", "powerChart", "historyChart"].forEach(id => {
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
    setFrame(data.index.frames.length - 1);     // 처음엔 다 자란 플룸부터. Play는 0부터 다시 돈다
  } catch (error) {
    if (version === loadVersion) setLoading(false, "Could not load this case. Pick another voltage or reload to retry.");
  }
}

// 도식의 면과 띠의 강조를 한 번에 맞춘다.
function setHighlight(plane, redraw = true) {
  highlighted = plane;
  $$(".cut").forEach(el => el.classList.toggle("is-highlighted", el.dataset.plane === plane));
  if (redraw) drawFieldView();
}

// 절개 위치 도식. 가로로만 돌고, 면을 누르면 그 면을 정면으로 본다. 다시 누르면 비스듬히 돌아온다.
// 값을 읽는 곳이 아니라 위치를 보는 곳이라 aria-hidden이다. 키보드 사용자는 띠의 이름표로 안다.
function initCutaway() {
  const scene = $("#cutawayScene"), box = $("#cutawayBox"), rod = $("#cutawayRod"), tube = $("#cutawayTube");
  if (!scene) return;
  const OBLIQUE = -34, FACING = { yz: 90, xz: 0 };
  let ry = OBLIQUE, drag = null;

  // 원형 관: 판 36장을 세로축 둘레에 세운다. 시선과 비스듬한 판일수록 유리가 두꺼워 보이므로 진하게.
  const STAVES = 36, R = 49;
  for (let i = 0; i < STAVES; i += 1) {
    const stave = document.createElement("i");
    stave.className = "stave";
    stave.style.transform = `rotateY(${i * 360 / STAVES}deg) translateZ(${R}px)`;
    tube.append(stave);
  }
  const shadeTube = () => {
    tube.querySelectorAll(".stave").forEach((stave, i) => {
      const facing = Math.abs(Math.cos((i * 360 / STAVES + ry) * Math.PI / 180));
      stave.style.background = `rgba(92, 106, 118, ${(0.04 + 0.30 * (1 - facing)).toFixed(3)})`;
    });
  };
  const apply = () => { box.style.setProperty("--ry", `${ry}deg`); shadeTube(); };

  // 히터 원통: 24개 판을 축 둘레에 세운다. 밝기는 위·앞에서 오는 빛을 흉내 낸다.
  const N = 24, r = 7;
  for (let i = 0; i < N; i += 1) {
    const facet = document.createElement("i");
    facet.className = "facet";
    const angle = i * 360 / N;
    const light = 0.35 + 0.65 * Math.max(0, Math.cos((angle - 300) * Math.PI / 180));
    facet.style.background = `rgb(${Math.round(70 + 120 * light)}, ${Math.round(78 + 120 * light)}, ${Math.round(86 + 120 * light)})`;
    facet.style.transform = `rotateX(${angle}deg) translateZ(${r}px)`;
    rod.append(facet);
  }
  [-49, 49].forEach(x => {
    const disc = document.createElement("i");
    disc.className = "disc";
    disc.style.transform = `translateX(${x}px) rotateY(90deg)`;
    rod.append(disc);
  });

  scene.addEventListener("pointerdown", event => {
    // 캡처를 걸면 pointerup의 target이 scene이 되므로 누른 면은 여기서 기억한다.
    drag = { x: event.clientX, ry, moved: false, cut: event.target.closest(".cut") };
    scene.setPointerCapture(event.pointerId);
  });
  scene.addEventListener("pointermove", event => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    if (Math.abs(dx) > 4) drag.moved = true;
    ry = clamp(drag.ry + dx * 0.5, -70, 110);
    box.classList.remove("is-snapping");
    apply();
  });
  scene.addEventListener("pointerup", () => {
    if (drag && !drag.moved && drag.cut) {
      const plane = drag.cut.dataset.plane;
      ry = ry === FACING[plane] ? OBLIQUE : FACING[plane];
      box.classList.toggle("is-snapping", !matchMedia("(prefers-reduced-motion: reduce)").matches);
      apply();
    }
    drag = null;
  });
  scene.addEventListener("pointercancel", () => { drag = null; });
  $$(".cut").forEach(cut => {
    cut.addEventListener("pointerenter", () => setHighlight(cut.dataset.plane));
    cut.addEventListener("pointerleave", () => setHighlight(null));
  });
  apply();
}

export function initFieldViewer() {
  lut.temperature = buildLut(RAMP.temperature);
  lut.speed = buildLut(RAMP.speed);
  initCutaway();

  // 산출물이 있는 전압만 누를 수 있다. 처음 것을 바로 연다.
  const picks = $$(".case-pick");
  picks.forEach(b => { b.disabled = true; });
  Promise.all(picks.map(async button => {
    let ok = false;
    try { ok = (await fetch(`assets/data/cfd/${button.dataset.case}/index.json`, { method: "HEAD" })).ok; } catch { /* 연결 실패도 선택 불가 */ }
    button.disabled = !ok;
    return ok ? button.dataset.case : null;
  })).then(ids => {
    const first = ids.find(Boolean);
    if (first) switchCase(first);
    else setLoading(false, "No computed case could be loaded. Reload to retry.");
  });
  picks.forEach(button => button.addEventListener("click", () => switchCase(button.dataset.case)));

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
  $("#fieldCanvas").addEventListener("pointermove", event => { if (data && !busy) handleProbe(event); });
  $("#fieldCanvas").addEventListener("pointerleave", hideTip);

  // 이 화면이 보일 때만. 입력 칸에 타이핑하는 중이면 건드리지 않는다.
  document.addEventListener("keydown", event => {
    if (!data || busy || document.querySelector("dialog[open]") || !$("#a-field").classList.contains("is-active")) return;
    const target = event.target;
    const typing = (target.tagName === "INPUT" && target.type !== "range")
      || target.tagName === "SELECT" || target.tagName === "TEXTAREA" || target.isContentEditable;
    if (typing) return;
    // Space는 focus된 버튼이 있으면 그 버튼의 것이다. 화살표는 어디에 focus가 있든 프레임을 옮긴다.
    if (event.key === " ") {
      if (target.tagName === "BUTTON") return;
      event.preventDefault(); playing ? stop() : play();
    } else if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
    else if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
  });
}
