// 토스트 알림과 모델·가정 다이얼로그

import { $ } from "./dom.js";

let toastTimer;

export function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-shown");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-shown"), 1700);
}

export function initAssumptionDialog() {
  const dialog = $("#assumptionDialog");
  if (!dialog) return;
  $("#openAssumptions").addEventListener("click", () => dialog.showModal());
  $("#closeAssumptions").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
}
