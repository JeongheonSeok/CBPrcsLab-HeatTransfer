// 사이드바 메뉴 렌더링과 화면 전환. 화면별 갱신 함수는 main.js가 등록

import { $, $$ } from "./dom.js";
import { VIEWS, DEFAULT_VIEW } from "../data/views.js";

// 화면이 활성화될 때 실행할 콜백. main.js가 주입
let onActivate = {};

function renderNav() {
  const list = $("#navList");
  if (!list) return;
  list.innerHTML = VIEWS.map(view => `
    <button class="nav-item" type="button" data-view="${view.id}">
      <strong>${view.label}</strong><span>${view.sub}</span>
    </button>`).join("");
}

export function switchView(viewId, updateHash = true) {
  const view = VIEWS.find(item => item.id === viewId) ?? VIEWS.find(item => item.id === DEFAULT_VIEW);
  const target = view.id;

  $$(".view").forEach(section => section.classList.toggle("is-active", section.id === target));
  $$(".nav-item").forEach(button => {
    const active = button.dataset.view === target;
    button.classList.toggle("is-active", active);
    // 이 사이드바는 화면 안의 탭이 아니라 페이지 이동이므로 aria-current가 맞다.
    // role="tab"은 화살표 키 이동까지 구현해야 올바르다.
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  $("#pageTitle").textContent = view.title;
  if (updateHash) history.replaceState(null, "", `#${target}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
  // 화면이 보이기 전에는 캔버스 크기가 0이므로 표시 직후에 다시 그림
  if (onActivate[target]) setTimeout(onActivate[target], 40);
}

export function initRouter(activationHandlers = {}) {
  onActivate = activationHandlers;
  renderNav();
  $$(".nav-item").forEach(button =>
    button.addEventListener("click", () => switchView(button.dataset.view)));
  switchView(location.hash.replace("#", "") || DEFAULT_VIEW, false);
}
