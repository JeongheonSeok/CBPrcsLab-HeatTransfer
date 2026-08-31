// 내 데이터 화면: 측정값 입력 표와 CSV 내보내기

import { $, $$ } from "../core/dom.js";
import { showToast } from "../core/ui.js";
import { schemas } from "../data/schemas.js";

let dataset = "A";

export function renderDataTable(fill = false) {
  const schema = schemas[dataset];
  const head = schema.headers.map(header => `<th>${header}</th>`).join("");
  let html = `<table class="data-table"><thead><tr>${head}</tr></thead><tbody>`;
  for (let rowIndex = 0; rowIndex < schema.rows; rowIndex += 1) {
    const row = fill
      ? schema.examples[rowIndex]
      : [String.fromCharCode(97 + rowIndex), ...Array(schema.headers.length - 1).fill("")];
    html += `<tr>${row.map((value, index) => `<td ${index ? 'contenteditable="true"' : ""}>${value}</td>`).join("")}</tr>`;
  }
  html += "</tbody></table>";
  $("#dataTableWrap").innerHTML = html;
}

function exportCsv() {
  const table = $(".data-table");
  const rows = [...table.rows].map(row =>
    [...row.cells].map(cell => `"${cell.textContent.trim().replaceAll('"', '""')}"`).join(","));
  // 엑셀에서 한글이 깨지지 않도록 BOM을 붙임
  const blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `heat-transfer-experiment-${dataset}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("CSV 파일을 만들었습니다");
}

export function initDataView() {
  $$(".dataset-button").forEach(button => button.addEventListener("click", () => {
    dataset = button.dataset.dataset;
    $$(".dataset-button").forEach(item => item.classList.toggle("active", item === button));
    renderDataTable(false);
  }));

  $("#fillExample").addEventListener("click", () => { renderDataTable(true); showToast("예시값을 채웠습니다"); });
  $("#clearData").addEventListener("click", () => { renderDataTable(false); showToast("입력값을 지웠습니다"); });
  $("#exportCsv").addEventListener("click", exportCsv);

  renderDataTable(false);
}
