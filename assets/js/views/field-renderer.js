// 유동장 캔버스 렌더러. UI 상태 관리는 field-viewer.js가 담당

import { fieldSample, palette } from "../data/synthetic-field.js";

// 픽셀 계산량을 줄이려고 낮은 해상도로 만든 뒤 확대해 그림
const OFFSCREEN = { width: 180, height: 110 };

// duct 내부로 표시할 가로 구간 비율
const DUCT = { left: 0.18, right: 0.82 };

export function createOffscreen() {
  const canvas = document.createElement("canvas");
  canvas.width = OFFSCREEN.width;
  canvas.height = OFFSCREEN.height;
  return { canvas, ctx: canvas.getContext("2d") };
}

function paintFieldImage(offscreen, caseId, type, t) {
  const { canvas, ctx } = offscreen;
  const image = ctx.createImageData(canvas.width, canvas.height);
  for (let py = 0; py < canvas.height; py += 1) {
    for (let px = 0; px < canvas.width; px += 1) {
      const x = px / (canvas.width - 1);
      const y = py / (canvas.height - 1);
      const sample = fieldSample(x, y, t, caseId);
      const color = palette(type === "temperature" ? sample.temp : sample.speed, type === "speed");
      const index = (py * canvas.width + px) * 4;
      image.data[index] = color[0];
      image.data[index + 1] = color[1];
      image.data[index + 2] = color[2];
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function paintDuctWalls(ctx, w, h, left, right) {
  ctx.fillStyle = "rgba(112, 128, 141, .72)";
  ctx.fillRect(0, 0, left, h);
  ctx.fillRect(right, 0, w - right, h);
  ctx.fillStyle = "rgba(225, 232, 236, .16)";
  ctx.fillRect(left - 8, 0, 8, h);
  ctx.fillRect(right, 0, 8, h);
  ctx.strokeStyle = "rgba(255,255,255,.60)";
  ctx.lineWidth = 2;
  ctx.strokeRect(left, 1, right - left, h - 2);
}

// 실험 A: 관을 가로지르는 가열 실린더
function paintCylinder(ctx, w, h, left, right) {
  const cy = h * 0.67, fullX = w * 0.09, fullW = w * 0.82, ch = 30;
  const metal = ctx.createLinearGradient(0, cy - ch / 2, 0, cy + ch / 2);
  metal.addColorStop(0, "#edf1f3"); metal.addColorStop(0.48, "#9daab3"); metal.addColorStop(1, "#dce3e7");
  ctx.fillStyle = metal;
  ctx.beginPath(); ctx.roundRect(fullX, cy - ch / 2, fullW, ch, 15); ctx.fill();

  const heated = ctx.createLinearGradient(0, cy - ch / 2, 0, cy + ch / 2);
  heated.addColorStop(0, "#f5b172"); heated.addColorStop(0.5, "#e66b37"); heated.addColorStop(1, "#b83d3d");
  ctx.fillStyle = heated;
  ctx.beginPath(); ctx.roundRect(left, cy - ch / 2 + 2, right - left, ch - 4, 13); ctx.fill();

  ctx.fillStyle = "#7f8d97";
  ctx.fillRect(left - 5, cy - ch / 2 - 3, 10, ch + 6);
  ctx.fillRect(right - 5, cy - ch / 2 - 3, 10, ch + 6);
}

// 실험 B: 가열 벽면과 T6·T7·T8 비드
function paintHeatedWall(ctx, w, h, left, right) {
  ctx.fillStyle = "rgba(230,107,55,.62)";
  ctx.fillRect(left - 8, h * 0.17, 10, h * 0.32);
  ctx.fillRect(right - 2, h * 0.17, 10, h * 0.32);
  // [x 비율, 반지름]. 첫 항목이 회색체 T6, 나머지가 흑체 T7·T8
  [[0.44, 4], [0.50, 4], [0.57, 10]].forEach((item, index) => {
    ctx.fillStyle = index ? "#17212b" : "#9aa6af";
    ctx.beginPath(); ctx.arc(w * item[0], h * 0.35, item[1], 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.stroke();
  });
}

function drawArrow(ctx, x, y, vx, vy, scale) {
  const ex = x + vx * scale, ey = y + vy * scale;
  const angle = Math.atan2(ey - y, ex - x), head = 4;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey);
  ctx.lineTo(ex - head * Math.cos(angle - 0.55), ey - head * Math.sin(angle - 0.55));
  ctx.moveTo(ex, ey); ctx.lineTo(ex - head * Math.cos(angle + 0.55), ey - head * Math.sin(angle + 0.55));
  ctx.stroke();
}

function paintVelocityArrows(ctx, w, h, caseId, t) {
  ctx.strokeStyle = "rgba(255,255,255,.72)";
  ctx.lineWidth = 1;
  for (let j = 1; j < 7; j += 1) {
    for (let i = 2; i < 9; i += 1) {
      const x = i / 9, y = j / 7;
      const sample = fieldSample(x, y, t, caseId);
      drawArrow(ctx, x * w, y * h, sample.vx, sample.vy, 18);
    }
  }
}

export function renderField(ctx, offscreen, { w, h, caseId, type, t }) {
  paintFieldImage(offscreen, caseId, type, t);
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(offscreen.canvas, 0, 0, w, h);

  const left = w * DUCT.left, right = w * DUCT.right;
  paintDuctWalls(ctx, w, h, left, right);
  if (caseId.startsWith("A")) paintCylinder(ctx, w, h, left, right);
  else paintHeatedWall(ctx, w, h, left, right);
  paintVelocityArrows(ctx, w, h, caseId, t);
}
