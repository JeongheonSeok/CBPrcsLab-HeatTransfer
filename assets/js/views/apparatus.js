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
  $$(".component-chip").forEach(chip => chip.classList.toggle("active", chip.dataset.part === partId));
}

function renderComponentList(mode) {
  $("#componentList").innerHTML = componentOrder[mode]
    .map(id => `<button class="component-chip" data-part="${id}">${componentData[id].label}</button>`)
    .join("");
  $$(".component-chip").forEach(button => button.addEventListener("click", () => selectPart(button.dataset.part)));
}

function updateFlowLayers() {
  $$(".toggle-button").forEach(button => {
    const visible = button.classList.contains("active");
    $$(`[data-layer-group="${button.dataset.layer}"]`)
      .forEach(layer => layer.classList.toggle("layer-hidden", !visible));
  });
}

function switchApparatus(mode) {
  apparatusMode = mode;
  $$(".apparatus-mode").forEach(button => button.classList.toggle("active", button.dataset.mode === mode));
  $$(".apparatus-diagram").forEach(svg => svg.classList.toggle("is-hidden", svg.dataset.apparatus !== mode));
  $("#apparatusHeading").textContent = mode === "A"
    ? "실험 A · Combined Convection and Radiation"
    : "실험 B · Radiation Errors in Temperature Measurement";
  $("#apparatusSubheading").textContent = mode === "A"
    ? "수평 가열 실린더와 자연대류"
    : "가열 외벽, 세 종류의 열전쌍과 강제대류";
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

  $$(".toggle-button").forEach(button =>
    button.addEventListener("click", () => { button.classList.toggle("active"); updateFlowLayers(); }));

  switchApparatus("A");
}

export { apparatusMode, selectedPart };
