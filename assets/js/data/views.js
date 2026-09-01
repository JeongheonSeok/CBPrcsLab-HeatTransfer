// 화면 목록. 사이드바 메뉴와 상단 제목이 모두 여기서 나온다.
//
// status는 협업하는 사람에게 무엇이 실제로 동작하는지 알린다.
//   "ready"   — 계산과 화면이 모두 검증되어 그대로 쓸 수 있다
//   "planned" — 자리만 잡혀 있다. placeholder를 그리고 무엇이 들어올지 적는다
// 화면이 완성되면 이 한 단어만 바꾸면 된다.

export const VIEWS = [
  {
    id: "experiment-a", status: "ready",
    label: "Experiment A", sub: "Convection and radiation",
    title: "Experiment A · Combined convection and radiation"
  },
  {
    id: "experiment-b", status: "ready",
    label: "Experiment B", sub: "Thermocouple error",
    title: "Experiment B · Radiation error in temperature measurement"
  },
  {
    id: "apparatus", status: "planned",
    label: "Apparatus", sub: "Sensors and heat paths",
    title: "Apparatus",
    plan: "An interactive schematic of both rigs. Click a sensor or component to read what it measures, where it sits, and what it does. Air flow, convection and radiation paths can be toggled. The diagram is drawn and the descriptions are written; it needs the measured sensor coordinates before it goes live."
  },
  {
    id: "transient", status: "planned",
    label: "Transient", sub: "Lumped-parameter model",
    title: "Transient · Lumped-parameter model",
    plan: "Temperature against time for the cylinder and for each thermocouple bead, integrated from the same models used in Experiments A and B. The model runs, but the effective heat capacity and the extra loss coefficient are not in the course notes and have not been fitted to a recorded run, so the time axis would be misleading. It needs one temperature-versus-time record from the rig."
  },
  {
    id: "field-viewer", status: "planned",
    label: "Field", sub: "Pre-computed CFD",
    title: "Field · Pre-computed CFD",
    plan: "Temperature and velocity fields for ten representative cases, computed in the lab and shipped as compressed slices, plus the convective and radiative heat transfer integrated over the heated surface. Nothing has been computed yet. The case list and the comparison layout are in place so the format can be agreed before the runs start."
  },
  {
    id: "data", status: "planned",
    label: "My data", sub: "Enter and export",
    title: "My measurements",
    plan: "A table for the values measured on the rig, with CSV import and export and a browser-local draft. Entry and export work; import, validation and saving do not exist yet."
  }
];

export const DEFAULT_VIEW = VIEWS[0].id;
