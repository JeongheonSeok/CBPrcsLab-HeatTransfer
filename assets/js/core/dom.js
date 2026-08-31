// DOM 조회와 숫자 표시 형식 유틸리티

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export const numberValue = (id, fallback = 0) => {
  const el = $(id);
  if (!el) return fallback;
  const value = Number(el.value);
  return Number.isFinite(value) ? value : fallback;
};

export function formatW(value, digits = 2) {
  return `${value.toFixed(digits)} <small>W</small>`;
}

export function formatSmallHeat(value) {
  const abs = Math.abs(value);
  if (abs >= 1) return `${value.toFixed(2)} W`;
  if (abs >= 1e-3) return `${(value * 1e3).toFixed(2)} mW`;
  if (abs >= 1e-6) return `${(value * 1e6).toFixed(2)} µW`;
  return `${(value * 1e9).toFixed(2)} nW`;
}
