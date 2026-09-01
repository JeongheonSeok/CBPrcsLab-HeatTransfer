// 진입점.
//
// 화면 하나를 추가하려면 세 곳만 손대면 된다.
//   1. assets/views/<id>.html    마크업
//   2. assets/js/views/<id>.js   입출력
//   3. 아래 SCREENS와 data/views.js의 status
// 나머지 화면과 파일이 겹치지 않으므로 각자 맡아서 나란히 작업할 수 있다.

import { initRouter } from "./core/router.js";
import { initAssumptionDialog } from "./core/ui.js";
import { VIEWS } from "./data/views.js";
import { initExperimentAView, drawAChart } from "./views/experiment-a.js";
import { initExperimentBView, drawBChart } from "./views/experiment-b.js";

const SCREENS = {
  "experiment-a": { mount: initExperimentAView, redraw: drawAChart },
  "experiment-b": { mount: initExperimentBView, redraw: drawBChart }
};

const ready = id => VIEWS.find(view => view.id === id)?.status === "ready";
const handlers = Object.fromEntries(Object.entries(SCREENS).filter(([id]) => ready(id)));

initAssumptionDialog();
initRouter(handlers);

let resizeFrame = null;
window.addEventListener("resize", () => {
  // 창을 끄는 동안 매 픽셀마다 다시 그리지 않는다.
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() =>
    Object.values(handlers).forEach(screen => screen.redraw?.()));
});
