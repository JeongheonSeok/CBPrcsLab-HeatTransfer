// 실험 A 화면: 정상상태 계산 결과와 그래프

import { $, $$, clamp, numberValue, formatW } from "../core/dom.js";
import { setupCanvas, drawAxes, drawLine, makeScales, drawVerticalMarker, SERIES_COLOR } from "../core/chart.js";
import { experimentASteady, cylinderHeat } from "../physics/experiment-a.js";

// 화면 입력값을 물리 모델의 인자 형태로 변환
function readInputs() {
  return {
    V: numberValue("#aVoltage", 0),
    I: numberValue("#aCurrent", 0),
    taC: numberValue("#aAirTemp", 25),
    tsC: numberValue("#aSurfaceTemp", 90),
    model: $("#aModel").value,
    k: numberValue("#aK", 0.027),
    nu: numberValue("#aNu", 1.75e-5),
    pr: numberValue("#aPr", 0.707)
  };
}

export function drawAChart() {
  const canvas = $("#aChart");
  const setup = setupCanvas(canvas);
  if (!setup) return;
  const { ctx, w, h } = setup;
  const input = readInputs();

  const minX = Math.floor(input.taC + 1);
  const maxX = Math.max(180, Math.ceil(input.tsC + 30));
  const values = [];
  let maxY = 1;
  for (let i = 0; i < 100; i += 1) {
    const t = minX + (maxX - minX) * i / 99;
    const heat = cylinderHeat({ ...input, tsC: t });
    values.push({ t, qc: Math.abs(heat.qConv), qr: Math.abs(heat.qRad) });
    maxY = Math.max(maxY, Math.abs(heat.qConv), Math.abs(heat.qRad));
  }
  maxY *= 1.12;

  const { xMap, yMap } = makeScales(w, h, [minX, maxX], [0, maxY]);
  drawAxes(ctx, w, h, "Tₛ (°C)", "Q (W)",
    [minX, Math.round((minX + maxX) / 2), maxX],
    [0, +(maxY / 2).toFixed(1), +maxY.toFixed(1)], xMap, yMap);
  drawLine(ctx, values.map(item => [xMap(item.t), yMap(item.qc)]), SERIES_COLOR.conv);
  drawLine(ctx, values.map(item => [xMap(item.t), yMap(item.qr)]), SERIES_COLOR.rad);
  drawVerticalMarker(ctx, xMap(clamp(input.tsC, minX, maxX)), h);
}

export function updateA() {
  const input = readInputs();
  const result = experimentASteady(input);

  $("#aPower").innerHTML = formatW(result.qIn);
  $("#aConv").innerHTML = formatW(result.qConv);
  $("#aRad").innerHTML = formatW(result.qRad);
  $("#aResidual").innerHTML = formatW(result.residual);
  $("#aConvSub").textContent = `h = ${result.hConv.toFixed(2)} W·m⁻²·K⁻¹`;
  $("#aRadSub").textContent = `hr = ${result.hRad.toFixed(2)} W·m⁻²·K⁻¹`;

  const totalAbs = Math.abs(result.qConv) + Math.abs(result.qRad);
  const convPct = totalAbs > 0 ? Math.abs(result.qConv) / totalAbs * 100 : 0;
  const radPct = totalAbs > 0 ? Math.abs(result.qRad) / totalAbs * 100 : 0;
  const lossPct = Math.abs(result.qIn) > 1e-12 ? Math.abs(result.residual) / Math.abs(result.qIn) * 100 : 0;
  $("#aConvPct").textContent = `${convPct.toFixed(1)}%`;
  $("#aRadPct").textContent = `${radPct.toFixed(1)}%`;
  $("#aLossPct").textContent = `${lossPct.toFixed(1)}%`;
  $("#aConvBar").style.width = `${clamp(convPct, 0, 100)}%`;
  $("#aRadBar").style.width = `${clamp(radPct, 0, 100)}%`;
  $("#aLossBar").style.width = `${clamp(lossPct, 0, 100)}%`;

  if (result.model === "morgan") {
    $("#aWarning").textContent = `Morgan 계산: Ra = ${result.ra ? result.ra.toExponential(2) : "0"}. 입력한 k, ν, Pr를 사용합니다.${result.extrapolated ? " 현재 Ra는 교안 표 범위 밖입니다." : ""}`;
  } else {
    $("#aWarning").textContent = "McAdams 단순 경험식을 사용합니다. 입력값은 UI 작동을 확인하기 위한 예시입니다.";
  }
  drawAChart();
}

export function initExperimentAView() {
  ["#aVoltage", "#aCurrent", "#aAirTemp", "#aSurfaceTemp", "#aModel", "#aK", "#aNu", "#aPr"]
    .forEach(id => $(id).addEventListener("input", updateA));

  $$(".a-voltage").forEach(button => button.addEventListener("click", () => {
    $("#aVoltage").value = button.dataset.value;
    $$(".a-voltage").forEach(item => item.classList.toggle("active", item === button));
    updateA();
  }));

  // Morgan은 공기 물성 입력이 필요하므로 상세 패널을 펼침
  $("#aModel").addEventListener("change", () => {
    if ($("#aModel").value === "morgan") $("#aAdvanced").open = true;
  });

  updateA();
}
