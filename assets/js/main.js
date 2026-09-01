// 진입점. status가 "ready"인 화면만 초기화한다.
// planned 화면은 마크업이 비어 있으므로 그 뷰 모듈을 부르면 없는 id를 찾다가 멈춘다.

import { initRouter } from "./core/router.js";
import { initAssumptionDialog } from "./core/ui.js";
import { VIEWS } from "./data/views.js";
import { initExperimentAView, drawAChart } from "./views/experiment-a.js";
import { initExperimentBView, drawBChart } from "./views/experiment-b.js";

const ready = id => VIEWS.find(view => view.id === id)?.status === "ready";

// 화면이 완성되면 여기에 한 줄을 더하고 views.js의 status를 "ready"로 바꾼다.
const SCREENS = {
  "experiment-a": { init: initExperimentAView, redraw: drawAChart },
  "experiment-b": { init: initExperimentBView, redraw: drawBChart }
};

initAssumptionDialog();

const activation = {};
for (const [id, screen] of Object.entries(SCREENS)) {
  if (!ready(id)) continue;
  screen.init();
  if (screen.redraw) activation[id] = screen.redraw;
}

// 화면이 보이기 전에는 캔버스 크기가 0이므로 표시 직후에 다시 그린다.
initRouter(activation);

let resizeFrame = null;
window.addEventListener("resize", () => {
  // 창을 끄는 동안 매 픽셀마다 다시 그리지 않는다.
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    Object.values(activation).forEach(redraw => redraw());
  });
});
