// 장치 이해 화면: SVG 도식의 부품 선택과 흐름 레이어 표시

import { $, $$ } from "../core/dom.js";
import { componentData, componentOrder } from "../data/components.js";

let apparatusMode = "A";
let selectedPart = "a-t10";

function selectPart(partId) {
  const data = componentData[partId];
  if (!data) return;
  selectedPart = partId;
  $$(".apparatus-part").forEach(part => part.classList.toggle("selected", part.dataset.part === partId));
  $("#componentBadge").textContent = data.badge;
  $("#componentTitle").textContent = data.label;
  $("#componentSummary").textContent = data.summary;
  $("#componentMeasure").textContent = data.measure;
  $("#componentLocation").textContent = data.location;
  $("#componentRole").textContent = data.role;
  $$("#componentList .btn").forEach(chip => chip.classList.toggle("is-active", chip.dataset.part === partId));
}

function renderComponentList(mode) {
  $("#componentList").innerHTML = componentOrder[mode]
    .map(id => `<button class="btn" type="button" data-part="${id}">${componentData[id].label}</button>`)
    .join("");
  $$("#componentList .btn").forEach(button => button.addEventListener("click", () => selectPart(button.dataset.part)));
}

function updateFlowLayers() {
  $$(".toggle-layer").forEach(button => {
    const visible = button.classList.contains("is-active");
    $$(`[data-layer-group="${button.dataset.layer}"]`)
      .forEach(layer => layer.classList.toggle("layer-hidden", !visible));
  });
}

function switchApparatus(mode) {
  apparatusMode = mode;
  $$(".apparatus-mode").forEach(button => button.classList.toggle("is-active", button.dataset.mode === mode));
  $$(".apparatus-diagram").forEach(svg => svg.classList.toggle("is-hidden", svg.dataset.apparatus !== mode));
  $("#apparatusHeading").textContent = mode === "A"
    ? "Experiment A · Combined convection and radiation"
    : "Experiment B · Radiation errors in temperature measurement";
  renderComponentList(mode);
  selectPart(mode === "A" ? "a-t10" : "b-t7");
  updateFlowLayers();
}

export function initApparatusView() {
  $$(".apparatus-mode").forEach(button =>
    button.addEventListener("click", () => switchApparatus(button.dataset.mode)));

  $$(".apparatus-part").forEach(part => {
    part.addEventListener("click", () => selectPart(part.dataset.part));
    part.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectPart(part.dataset.part); }
    });
  });

  $$(".toggle-layer").forEach(button =>
    button.addEventListener("click", () => { button.classList.toggle("is-active"); updateFlowLayers(); }));

  switchApparatus("A");
}

export { apparatusMode, selectedPart };
