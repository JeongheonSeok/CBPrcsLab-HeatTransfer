// 사이드바 메뉴와 화면 전환.
//
// 화면 마크업은 assets/views/<id>.html에 따로 있고 처음 열 때 한 번만 불러온다.
// 그래서 화면 하나를 맡은 사람은 자기 파일만 건드리면 되고, 서로 충돌하지 않는다.

import { $, $$ } from "./dom.js";
import { VIEWS, DEFAULT_VIEW } from "../data/views.js";

let onActivate = {};
const loaded = new Set();

function renderNav() {
  const list = $("#navList");
  if (!list) return;
  list.innerHTML = VIEWS.map(view => `
    <button class="nav-item" type="button" data-view="${view.id}">
      <strong>${view.label}${view.status === "planned" ? '<span class="nav-flag">planned</span>' : ""}</strong>
      <span>${view.sub}</span>
    </button>`).join("");
}

/**
 * 아직 만들지 않은 화면은 지어낸 내용 대신 무엇이 들어올지 적는다.
 * 협업하는 사람이 어디까지 되어 있는지 화면만 보고 알 수 있어야 한다.
 */
function planPlaceholder(view) {
  return `
    <div class="content">
      <div class="card card--planned">
        <header><h2>${view.title}</h2><span class="badge badge--warn">Not built yet</span></header>
        <div class="card-body"><p class="assumption">${view.plan}</p></div>
      </div>
    </div>`;
}

/** 화면 전용 CSS가 있으면 그 화면을 처음 열 때 붙인다. 없으면 조용히 넘어간다. */
function loadViewStyles(id) {
  const href = `assets/css/views/${id}.css`;
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.append(link);
}

async function loadView(view) {
  if (loaded.has(view.id)) return;
  const section = document.getElementById(view.id);
  if (!section) return;

  if (view.status === "planned") {
    loaded.add(view.id);
    section.innerHTML = planPlaceholder(view);
    return;
  }
  loadViewStyles(view.id);

  // 실패한 화면은 loaded에 넣지 않는다. 넣어 두면 다시 눌러도 빈 화면이 그대로 남는다.
  let markup;
  try {
    const response = await fetch(`assets/views/${view.id}.html`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    markup = await response.text();
  } catch (error) {
    section.innerHTML = `<div class="content"><p class="caution" role="status">Could not load assets/views/${view.id}.html (${error.message}). Check the connection and pick this screen again.</p></div>`;
    return;
  }

  loaded.add(view.id);
  section.innerHTML = `<div class="content">${markup}</div>`;
  if (onActivate[view.id]?.mount) onActivate[view.id].mount();
}

export async function switchView(viewId, updateHash = true) {
  const view = VIEWS.find(item => item.id === viewId) ?? VIEWS.find(item => item.id === DEFAULT_VIEW);
  const target = view.id;

  await loadView(view);

  $$(".view").forEach(section => section.classList.toggle("is-active", section.id === target));
  $$(".nav-item").forEach(button => {
    const active = button.dataset.view === target;
    button.classList.toggle("is-active", active);
    // 화면 안의 탭이 아니라 페이지 이동이므로 aria-current가 맞다.
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  $("#pageTitle").textContent = view.title;
  if (updateHash) history.replaceState(null, "", `#${target}`);
  window.scrollTo({ top: 0 });
  // 화면이 보이기 전에는 캔버스 크기가 0이므로 표시 직후에 다시 그린다.
  if (onActivate[target]?.redraw) setTimeout(onActivate[target].redraw, 40);
}

export function initRouter(handlers = {}) {
  onActivate = handlers;
  renderNav();
  $$(".nav-item").forEach(button =>
    button.addEventListener("click", () => switchView(button.dataset.view)));
  switchView(location.hash.replace("#", "") || DEFAULT_VIEW, false);
}
