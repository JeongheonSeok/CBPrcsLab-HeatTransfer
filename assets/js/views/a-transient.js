// 실험 A 시간 화면: CFD 이력으로 공급 전력이 매 순간 어디로 가는지, 표면 온도가 어떻게 오르는지.

import { $, $$, clamp, numberValue } from "../core/dom.js";
import { setupCanvas, drawAxes, drawLine, drawArea, makeScales, drawVerticalMarker, labelOnPlot, CHART_INK, CHART_FONT, SERIES_COLOR } from "../core/chart.js";
import { CFD_CASES } from "../data/cfd-cases.js";
import { loadHistory } from "../core/cfd-loader.js";

let data = null;
let sample = 0;                   // 이력의 인덱스. 0.5 s 간격
let loadVersion = 0;

// 공급 전력이 매 순간 어디로 가는지. Calculate 화면의 누적 막대를 시간축으로 편 것이다.
// 대류와 복사로 아직 나가지 못한 몫은 히터 자체를 데우고 있다. CFD에서는 그 정체를 안다.
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
  drawVerticalMarker(ctx, xMap(t[sample]), h);
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
  const now = t[sample];
  drawVerticalMarker(ctx, xMap(now), h);
  ctx.font = CHART_FONT;
  const label = `${now.toFixed(1)} s`;
  const right = xMap(now) + 6 + ctx.measureText(label).width < w - 16;
  labelOnPlot(ctx, label, xMap(now) + (right ? 6 : -6), 30, CHART_INK.ink, right ? "left" : "right");
}

function showNumbers() {
  const { time_s: t, T10_C: T10, Q_in_W: qIn, Q_heater_to_air_conv_W: conv, Q_heater_to_air_rad_W: rad } = data.history;
  $("#historyTimeValue").textContent = `${t[sample].toFixed(1)} s`;
  $("#historyTime").setAttribute("aria-valuetext", `${t[sample].toFixed(1)} seconds`);
  $("#historyQConv").innerHTML = `${conv[sample].toFixed(2)} <small>W</small>`;
  $("#historyQRad").innerHTML = `${rad[sample].toFixed(2)} <small>W</small>`;
  $("#historyStored").innerHTML = `${(qIn[sample] - conv[sample] - rad[sample]).toFixed(2)} <small>W</small>`;
  $("#historyT10").innerHTML = `${T10[sample].toFixed(1)} <small>°C</small>`;
  // 기울기는 앞뒤 10 s 차분. 정상상태라면 0에 가깝다.
  const lo = Math.max(0, sample - 10), hi = Math.min(t.length - 1, sample + 10);
  const slope = hi > lo ? (T10[hi] - T10[lo]) / (t[hi] - t[lo]) : 0;
  $("#historySlope").innerHTML = `${slope.toFixed(2)} <small>K/s</small>`;
}

export function drawTransientView() {
  if (!data) return;
  drawPower();
  drawTemperature();
  showNumbers();
}

async function switchCase(caseId) {
  const version = ++loadVersion;
  data = null;
  $$("#a-transient .case-pick").forEach(b => b.classList.toggle("is-active", b.dataset.case === caseId));
  $("#historyPending").hidden = true;
  try {
    const loaded = await loadHistory(caseId);
    if (version !== loadVersion) return;
    if (!loaded) { $("#historyPending").hidden = false; $("#historyPending").textContent = `${CFD_CASES[caseId].label} is not available yet.`; return; }
    data = loaded;
    $("#historyTime").max = data.history.time_s.length - 1;
    sample = data.history.time_s.length - 1;
    $("#historyTime").value = sample;
    drawTransientView();
  } catch (error) {
    if (version === loadVersion) { $("#historyPending").hidden = false; $("#historyPending").textContent = "Could not load this case. Pick another voltage or reload to retry."; }
  }
}

export function initTransientView() {
  const picks = $$("#a-transient .case-pick");
  picks.forEach(b => { b.disabled = true; });
  Promise.all(picks.map(async button => {
    let ok = false;
    try { ok = (await fetch(`assets/data/cfd/${button.dataset.case}/index.json`, { method: "HEAD" })).ok; } catch { /* 연결 실패도 선택 불가 */ }
    button.disabled = !ok;
    return ok ? button.dataset.case : null;
  })).then(ids => { const first = ids.find(Boolean); if (first) switchCase(first); });
  picks.forEach(button => button.addEventListener("click", () => switchCase(button.dataset.case)));
  $("#historyTime").addEventListener("input", () => {
    if (!data) return;
    sample = clamp(Math.round(numberValue("#historyTime", 0)), 0, data.history.time_s.length - 1);
    drawTransientView();
  });
}
