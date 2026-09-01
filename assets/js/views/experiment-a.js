// 실험 A 화면: 정상상태 계산 결과와 그래프

import { $, $$, clamp, numberValue, formatW, syncQuickSet } from "../core/dom.js";
import { setupCanvas, drawAxes, drawLine, makeScales, drawVerticalMarker, drawCrossing, SERIES_COLOR, SERIES_DASH } from "../core/chart.js";
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
  drawLine(ctx, values.map(item => [xMap(item.t), yMap(item.qc)]), SERIES_COLOR.conv, 2.2, SERIES_DASH.solid);
  drawLine(ctx, values.map(item => [xMap(item.t), yMap(item.qr)]), SERIES_COLOR.rad, 2.2, SERIES_DASH.dashed);

  // 복사가 대류를 다시 앞지르는 온도만 표시한다. 실험 A가 가르치려는 지점이다.
  // 상온 근처의 첫 교차는 ΔT가 작아 생기는 것이라 표시하지 않는다.
  const crossing = findCrossings(values).find(c => c.radiationTakesOver && c.t > input.taC + 20);
  if (crossing) {
    drawCrossing(ctx, xMap(crossing.t), yMap(crossing.q), `radiation leads above ${crossing.t.toFixed(0)} °C`, h);
  }

  // 계열 이름을 곡선 끝에 직접 붙인다. 범례로 눈을 왕복시키지 않는다.
  labelSeries(ctx, values, xMap, yMap, w);

  drawVerticalMarker(ctx, xMap(clamp(input.tsC, minX, maxX)), h);
}

/**
 * 대류와 복사가 뒤바뀌는 온도를 모두 찾는다.
 * 교차는 두 번 일어난다. ΔT가 작을 때는 복사가 앞서고, 중간 구간은 대류가,
 * 온도가 더 오르면 T⁴ 때문에 복사가 다시 앞선다. 실험 조건은 가운데 구간에 있다.
 */
function findCrossings(values) {
  const found = [];
  for (let i = 1; i < values.length; i += 1) {
    const a = values[i - 1], b = values[i];
    const da = a.qr - a.qc, db = b.qr - b.qc;
    if (da * db < 0) {
      const u = da / (da - db);
      found.push({
        t: a.t + (b.t - a.t) * u,
        q: a.qc + (b.qc - a.qc) * u,
        // 복사가 위로 올라서는 교차인지
        radiationTakesOver: db > 0
      });
    }
  }
  return found;
}

/** 곡선 오른쪽 끝에 계열 이름을 붙인다. */
function labelSeries(ctx, values, xMap, yMap, w) {
  const last = values[values.length - 1];
  ctx.font = "11px 'IBM Plex Sans KR', system-ui, sans-serif";
  ctx.textAlign = "right";
  for (const [value, color, name] of [[last.qc, SERIES_COLOR.conv, "Convection"], [last.qr, SERIES_COLOR.rad, "Radiation"]]) {
    ctx.fillStyle = color;
    ctx.fillText(name, xMap(last.t) - 3, yMap(value) - 5);
  }
  ctx.textAlign = "left";
}

/**
 * 공급 전력이 대류·복사·나머지로 어떻게 갈리는지 그린다.
 *
 * 배분이라는 말이 성립하지 않는 두 경우에는 막대를 비우고 이유를 적는다.
 * 표면이 공기보다 차가우면 실린더는 열을 잃는 쪽이 아니라 얻는 쪽이고,
 * 전력이 0이면 나눌 것이 없다. 앞의 경우는 리그에서 T8과 T10을 바꿔 적는
 * 흔한 실수인데, 침묵하면 학생은 음수 옆에 그려진 양의 막대를 믿는다.
 */
function showSplit(input, result) {
  const qIn = Math.abs(result.qIn);
  const reversed = input.tsC <= input.taC;
  const noPower = qIn <= 1e-12;
  const note = $("#aSplitNote");

  if (reversed) {
    note.textContent = "Surface T10 sits at or below air T8, so the cylinder is gaining heat rather than losing it. There is no supplied power to split. Check whether T8 and T10 went into the right boxes.";
  } else if (noPower) {
    note.textContent = "No electrical power is entering the cylinder, so there is nothing to split. Enter the voltage and current you measured.";
  }
  note.hidden = !(reversed || noPower);

  if (reversed || noPower) {
    ["#aConvPct", "#aRadPct", "#aLossPct"].forEach(id => { $(id).textContent = "—"; });
    ["#aConvBar", "#aRadBar", "#aLossBar"].forEach(id => { $(id).style.width = "0%"; });
    $("#aStackBar").classList.remove("is-over");
    $("#aOverflowNote").hidden = true;
    return;
  }

  // 분모는 대류+복사 합이 아니라 공급 전력이어야 막대가 100%를 뜻한다.
  const share = value => value / qIn * 100;
  const convPct = share(Math.abs(result.qConv));
  const radPct = share(Math.abs(result.qRad));
  const residualPct = share(result.residual);

  $("#aConvPct").textContent = `${convPct.toFixed(1)}%`;
  $("#aRadPct").textContent = `${radPct.toFixed(1)}%`;
  $("#aLossPct").textContent = `${residualPct.toFixed(1)}%`;

  // 모델 합이 공급 전력을 넘으면 잔차가 음수가 된다. 막대를 100%에서 끊고 빗금으로 알린다.
  const over = residualPct < 0;
  const scale = over ? 100 / Math.max(convPct + radPct, 1e-9) : 1;
  $("#aConvBar").style.width = `${clamp(convPct * scale, 0, 100)}%`;
  $("#aRadBar").style.width = `${clamp(radPct * scale, 0, 100)}%`;
  $("#aLossBar").style.width = `${over ? 0 : clamp(residualPct, 0, 100)}%`;
  $("#aStackBar").classList.toggle("is-over", over);
  $("#aOverflowNote").hidden = !over;
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

  syncQuickSet(".a-voltage", input.V);
  showSplit(input, result);

  if (result.model === "morgan") {
    $("#aWarning").textContent = `Morgan correlation, Ra = ${result.ra ? result.ra.toExponential(2) : "0"}, using the k, ν and Pr you entered.${result.extrapolated ? " This Ra falls outside the table in the course notes." : ""}`;
  } else {
    $("#aWarning").textContent = "McAdams simple correlation. Cylinder dimensions and emissivity are still placeholder values.";
  }
  drawAChart();
}

// 상세 패널은 <div hidden>이므로 <details>의 open 속성으로는 열리지 않는다.
function setAdvanced(open) {
  $("#aAdvanced").hidden = !open;
  $("#aAdvancedToggle").setAttribute("aria-expanded", String(open));
}

export function initExperimentAView() {
  ["#aVoltage", "#aCurrent", "#aAirTemp", "#aSurfaceTemp", "#aModel", "#aK", "#aNu", "#aPr"]
    .forEach(id => $(id).addEventListener("input", updateA));

  // 선택 표시는 updateA가 값에서 다시 계산하므로 여기서는 값만 바꾼다.
  $$(".a-voltage").forEach(button => button.addEventListener("click", () => {
    $("#aVoltage").value = button.dataset.value;
    updateA();
  }));

  $("#aAdvancedToggle").addEventListener("click", () => setAdvanced($("#aAdvanced").hidden));

  // Morgan은 공기 물성 입력이 필요하므로 상세 패널을 펼침
  $("#aModel").addEventListener("change", () => {
    if ($("#aModel").value === "morgan") setAdvanced(true);
  });

  updateA();
}
