// 사이드바 메뉴와 화면 전환. 화면별 갱신 함수는 main.js가 등록

import { $, $$ } from "./dom.js";

const viewTitles = {
  apparatus: "장치 이해",
  "experiment-a": "실험 A · 대류와 복사",
  "experiment-b": "실험 B · 온도 측정 오차",
  transient: "시간 변화 · Lumped model",
  "field-viewer": "CFD 결과·모델 비교",
  data: "내 실험 데이터"
};

// 화면이 활성화될 때 실행할 콜백. main.js가 주입
let onActivate = {};

export function switchView(viewId, updateHash = true) {
  const target = document.getElementById(viewId) ? viewId : "apparatus";
  $$(".view").forEach(view => view.classList.toggle("active", view.id === target));
  $$(".nav-button").forEach(button => button.classList.toggle("active", button.dataset.view === target));
  $("#pageTitle").textContent = viewTitles[target] || viewTitles.apparatus;
  if (updateHash) history.replaceState(null, "", `#${target}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
  // 화면이 보이기 전에는 캔버스 크기가 0이므로 표시 직후에 다시 그림
  if (onActivate[target]) setTimeout(onActivate[target], 40);
}

export function initRouter(activationHandlers = {}) {
  onActivate = activationHandlers;
  $$(".nav-button").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
  const initialView = location.hash.replace("#", "");
  if (initialView) switchView(initialView, false);
}
