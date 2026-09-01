// 캔버스 선 그래프 공통 도구. 축 여백과 색을 전체에서 통일

export const PLOT_MARGIN = { left: 46, right: 16, top: 19, bottom: 34 };

export const SERIES_COLOR = {
  conv: "#2f6fed",
  rad: "#d94f5c",
  surface: "#e66b37",
  marker: "#ad7b14"     // 학생이 입력한 조건을 가리키는 선. 측정값이 아니다
};

// 그래프 크롬. 데이터가 아니라 눈금과 표시다.
// assets/css/tokens.css의 --chart-* 와 값이 같아야 하며 테스트가 검사한다.
// plate는 캔버스 뒤에 비치는 --well 과 같아야 한다. 글자를 곡선 위에 얹을 때 깔개로 쓴다.
export const CHART_INK = { ink: "#5c6a76", grid: "#dbe2e8", mark: "#46525e", plate: "#f4f7f9" };

// 그래프 안에서 서체를 섞지 않는다. 축 숫자와 계열 이름이 달라 보이면 안 된다.
export const CHART_FONT = "11px 'IBM Plex Sans KR', system-ui, sans-serif";

// 표시 크기와 devicePixelRatio에 맞춤. 화면이 숨겨져 크기를 못 재면 null
export function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: rect.width, h: rect.height };
}

// 값 구간을 캔버스 좌표로 옮기는 매핑 함수 한 쌍
export function makeScales(w, h, xRange, yRange) {
  const { left, right, top, bottom } = PLOT_MARGIN;
  const [minX, maxX] = xRange;
  const [minY, maxY] = yRange;
  return {
    xMap: x => left + (x - minX) / (maxX - minX) * (w - left - right),
    yMap: y => h - bottom - (y - minY) / (maxY - minY) * (h - top - bottom)
  };
}

export function drawAxes(ctx, w, h, xLabel, yLabel, xTicks, yTicks, xMap, yMap) {
  const { left, right, top, bottom } = PLOT_MARGIN;
  ctx.clearRect(0, 0, w, h);
  ctx.font = CHART_FONT;
  ctx.fillStyle = CHART_INK.ink;
  ctx.strokeStyle = CHART_INK.grid;
  ctx.lineWidth = 1;
  yTicks.forEach(value => {
    const y = yMap(value);
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(w - right, y); ctx.stroke();
    ctx.textAlign = "left"; ctx.fillText(String(value), 5, y + 4);
  });
  xTicks.forEach(value => {
    const x = xMap(value);
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, h - bottom); ctx.stroke();
    ctx.textAlign = "center"; ctx.fillText(String(value), x, h - 13);
  });
  ctx.textAlign = "left"; ctx.fillText(yLabel, left, 11);
  ctx.textAlign = "right"; ctx.fillText(xLabel, w - right, h - 2);
  ctx.textAlign = "left";
}

export function drawLine(ctx, points, stroke, width = 2.2, dash = []) {
  if (!points.length) return;
  ctx.beginPath();
  points.forEach((point, index) => index ? ctx.lineTo(point[0], point[1]) : ctx.moveTo(point[0], point[1]));
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** 색을 못 읽는 사람도 계열을 구분할 수 있도록 선 종류를 함께 쓴다. */
export const SERIES_DASH = { solid: [], dashed: [7, 4], dotted: [2, 3] };

// assets/css/tokens.css의 --sensor-* 와 값이 같아야 하며 테스트가 검사한다.
export const SENSOR_COLOR = { grey: "#78848f", black: "#2f3e4b" };

// 열전쌍은 물리량이 아니라 장치이므로 계열 색을 빌려 쓰지 않는다.
// 색은 비드 표면을, 굵기는 비드 지름을 나타낸다. 표면이 같은 T7과 T8은
// 색도 같고 굵기만 다르다. 선 종류는 색을 보조한다 (계획서 6절).
export function sensorStyle({ epsilon, d }) {
  const black = epsilon >= 0.7;          // 교안이 회색체(0.40)와 흑체(0.95)로만 나눈다
  return {
    color: black ? SENSOR_COLOR.black : SENSOR_COLOR.grey,
    width: d >= 0.002 ? 3.2 : 1.8,       // 0.5 mm와 3 mm
    dash: black ? SERIES_DASH.solid : SERIES_DASH.dotted
  };
}

/** 두 곡선이 만나는 지점을 표시한다. 어느 쪽이 언제 우세해지는지가 읽히도록. */
export function drawCrossing(ctx, x, y, label, h) {
  const { left, right, top, bottom } = PLOT_MARGIN;
  ctx.strokeStyle = CHART_INK.mark;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, h - bottom); ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = "#fff"; ctx.fill();
  ctx.strokeStyle = CHART_INK.mark; ctx.lineWidth = 1.6; ctx.stroke();

  // 계열 이름은 곡선 끝인 오른쪽 위에 붙으므로, 교차 설명은 아래쪽에 둔다.
  // 그러지 않으면 셋이 같은 모서리에서 겹친다.
  ctx.font = CHART_FONT;
  ctx.fillStyle = CHART_INK.mark;
  const width = ctx.canvas.clientWidth;
  const fitsRight = x + 7 + ctx.measureText(label).width <= width - right;
  ctx.textAlign = fitsRight ? "left" : "right";
  ctx.fillText(label, fitsRight ? x + 7 : Math.max(x - 7, left), h - bottom - 7);
  ctx.textAlign = "left";
}

// 곡선 위에 글자를 얹으면 선과 겹쳐 읽히지 않는다. 배경색 깔개를 먼저 깐다.
export function labelOnPlot(ctx, text, x, y, color, align = "left") {
  const width = ctx.measureText(text).width;
  ctx.fillStyle = CHART_INK.plate;
  ctx.fillRect((align === "right" ? x - width : x) - 3, y - 9, width + 6, 12);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}

// 곡선 오른쪽 끝에 계열 이름을 붙인다. 범례로 눈을 왕복시키지 않기 위해서다.
// 곡선이 서로 가까우면 이름표끼리 겹치므로 최소 간격을 두고 아래로 밀어낸다.
export function labelEnds(ctx, items) {
  ctx.font = CHART_FONT;
  let lastY = -Infinity;
  [...items].sort((a, b) => a.y - b.y).forEach(item => {
    const y = Math.max(item.y - 5, lastY + 12);
    lastY = y;
    labelOnPlot(ctx, item.name, item.x - 3, y, item.color, "right");
  });
}

export function drawVerticalMarker(ctx, x, h, stroke = SERIES_COLOR.marker) {
  const { top, bottom } = PLOT_MARGIN;
  ctx.strokeStyle = stroke; ctx.lineWidth = 1.4; ctx.setLineDash([4, 5]);
  ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, h - bottom); ctx.stroke();
  ctx.setLineDash([]);
}

export function drawHorizontalGuide(ctx, y, w, stroke, dash = [5, 5], width = 1.3) {
  const { left, right } = PLOT_MARGIN;
  ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(w - right, y); ctx.stroke();
  ctx.setLineDash([]);
}
