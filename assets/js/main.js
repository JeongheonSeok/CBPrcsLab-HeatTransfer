// 진입점: 화면 모듈 초기화, 라우터와 리사이즈 연결

import { initRouter } from "./core/router.js";
import { initAssumptionDialog } from "./core/ui.js";
import { initApparatusView } from "./views/apparatus.js";
import { initExperimentAView, drawAChart } from "./views/experiment-a.js";
import { initExperimentBView, drawBChart } from "./views/experiment-b.js";
import { initTransientView, updateLumped, drawLumpedChart } from "./views/transient.js";
import { initFieldViewer, resizeFieldCanvas, updateCfdSummary, drawCfdComparison } from "./views/field-viewer.js";
import { initDataView } from "./views/data-table.js";

initAssumptionDialog();
initApparatusView();
initExperimentAView();
initExperimentBView();
initTransientView();
initDataView();
initFieldViewer();

// 숨겨진 동안에는 캔버스 크기를 잴 수 없으므로 표시 직후에 다시 그림
initRouter({
  "experiment-a": drawAChart,
  "experiment-b": drawBChart,
  transient: updateLumped,
  "field-viewer": () => { resizeFieldCanvas(); updateCfdSummary(); }
});

window.addEventListener("resize", () => {
  drawAChart();
  drawBChart();
  drawLumpedChart();
  resizeFieldCanvas();
  drawCfdComparison();
});
