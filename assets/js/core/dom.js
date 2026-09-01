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

// quick-set 버튼의 선택 표시. 클릭할 때만 표시를 옮기면 직접 타이핑한 뒤에도
// 버튼이 옛 값을 주장하므로, 표시는 언제나 입력 칸의 현재 값에서 나와야 한다.
export function syncQuickSet(selector, value) {
  $$(selector).forEach(button =>
    button.classList.toggle("is-active", Number(button.dataset.value) === value));
}

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
