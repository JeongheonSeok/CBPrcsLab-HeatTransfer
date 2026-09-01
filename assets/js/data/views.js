// 화면 목록. 사이드바 메뉴와 상단 제목이 모두 여기서 나온다.
// 화면을 추가하려면 여기에 항목 하나와 index.html에 <section class="view" id="…">를 넣는다.
// 둘 중 하나만 하면 tests/markup-contract.test.mjs가 잡아낸다.

export const VIEWS = [
  { id: "apparatus",    label: "Apparatus",  sub: "Sensors and heat paths",     title: "Apparatus" },
  { id: "experiment-a", label: "Experiment A", sub: "Convection and radiation", title: "Experiment A · Convection and radiation" },
  { id: "experiment-b", label: "Experiment B", sub: "Thermocouple error",       title: "Experiment B · Radiation error in temperature measurement" },
  { id: "transient",    label: "Transient",  sub: "Lumped-parameter model",     title: "Transient · Lumped-parameter model" },
  { id: "field-viewer", label: "Field",      sub: "Pre-computed CFD",           title: "Field · Pre-computed CFD" },
  { id: "data",         label: "My data",    sub: "Enter and export",           title: "My measurements" }
];

export const DEFAULT_VIEW = VIEWS[0].id;
