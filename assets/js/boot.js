// Failure surface for module errors. Not a module itself: main.js never runs when the
// module graph breaks, so nothing inside it can report the failure.

(function () {
  var shown = false;

  function show(detail) {
    if (shown) return;
    shown = true;
    var main = document.querySelector("main") || document.body;
    var box = document.createElement("div");
    box.className = "content";
    box.innerHTML =
      '<div class="card"><header><h2>This page did not start</h2>' +
      '<span class="badge badge--warn">Script error</span></header>' +
      '<div class="card-body">' +
      '<p class="caution" role="status">The scripts did not load, so nothing on this page is live. ' +
      'A stale copy in the browser cache is the usual cause. ' +
      'Reload with <strong>Ctrl+Shift+R</strong> (<strong>Cmd+Shift+R</strong> on a Mac).</p>' +
      '<p class="assumption">' + String(detail || "").slice(0, 200) + "</p>" +
      "</div></div>";
    // 화면 아래에 붙이면 스크롤해야 보인다. 첫 화면 자리에 넣는다.
    main.insertBefore(box, main.querySelector(".view"));
    var title = document.getElementById("pageTitle");
    if (title) title.textContent = "Not loaded";
  }

  // 모듈의 파싱 오류와 import 실패는 둘 다 error 이벤트를 남긴다.
  // capture 단계라야 <script> 요소에서 나는 것까지 잡힌다.
  window.addEventListener("error", function (event) {
    if (document.documentElement.dataset.appReady) return;   // 시작한 뒤의 오류는 다른 문제다
    var target = event.target;
    var fromScript = target && target !== window && target.tagName === "SCRIPT";
    if (target && target !== window && !fromScript) return;   // 이미지 하나 실패는 무시
    show(event.message || (fromScript ? "Could not load " + target.src : ""));
  }, true);
})();
