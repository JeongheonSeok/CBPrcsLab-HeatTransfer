// 캔버스 선 그래프 공통 도구. 축 여백과 색을 전체에서 통일

export const PLOT_MARGIN = { left: 46, right: 16, top: 19, bottom: 34 };

export const SERIES_COLOR = {
  conv: "#2f6fed",
  rad: "#d94f5c",
  surface: "#e66b37",
  marker: "#ad7b14",
  muted: "#8a98a4",
  guide: "#aeb8c0"
};

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
  ctx.font = "11px system-ui";
  ctx.fillStyle = "#74818c";
  ctx.strokeStyle = "#e4e9ed";
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

export function drawLine(ctx, points, stroke, width = 2.2) {
  if (!points.length) return;
  ctx.beginPath();
  points.forEach((point, index) => index ? ctx.lineTo(point[0], point[1]) : ctx.moveTo(point[0], point[1]));
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
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
