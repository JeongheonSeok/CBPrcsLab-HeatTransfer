// index.html과 JS 사이의 계약을 검사한다.
// 마크업을 다시 쓸 때 배선이 끊기면 여기서 잡힌다.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { componentData, componentOrder } from "../assets/js/data/components.js";
import { CFD_CASES } from "../assets/js/data/cfd-cases.js";
import { VIEWS, DEFAULT_VIEW } from "../assets/js/data/views.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const jsSources = (function collect(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (entry.endsWith(".js")) out.push([full, readFileSync(full, "utf8")]);
  }
  return out;
})(join(ROOT, "assets", "js"));

const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
const attrValues = name =>
  new Set([...html.matchAll(new RegExp(`\\bdata-${name}="([^"]+)"`, "g"))].map(m => m[1]));
const classCount = cls =>
  [...html.matchAll(new RegExp(`class="[^"]*\\b${cls}\\b`, "g"))].length;

describe("마크업 계약 · 자산", () => {
  // index.html이 가리키는 파일이 하나라도 없으면 화면이 통째로 무너진다.
  // CSS 경로가 잘못돼 스타일이 전부 빠진 채 배포된 적이 있어 검사로 남긴다.
  test("참조하는 CSS와 JS가 모두 존재한다", () => {
    const refs = [...html.matchAll(/(?:href|src)="((?!https?:)[^"#]+)"/g)].map(m => m[1]);
    const missing = refs.filter(ref => !existsSync(join(ROOT, ref)));
    assert.deepEqual(missing, [], `index.html이 없는 파일을 가리킴:\n  ${missing.join("\n  ")}`);
    assert.ok(refs.length >= 5, "스타일시트가 연결되지 않았다");
  });

  test("스타일시트가 올바른 순서로 연결된다", () => {
    // 토큰이 먼저 와야 나머지가 var()를 해석할 수 있다.
    const sheets = [...html.matchAll(/href="assets\/css\/([a-z-]+)\.css"/g)].map(m => m[1]);
    assert.ok(sheets.indexOf("tokens") < sheets.indexOf("base"), "tokens.css가 base.css보다 먼저여야 함");
    assert.ok(sheets.indexOf("base") < sheets.indexOf("components"), "base.css가 components.css보다 먼저여야 함");
  });

  test("fonts.css가 참조하는 폰트 파일이 모두 존재한다", () => {
    const css = readFileSync(join(ROOT, "assets/css/fonts.css"), "utf8");
    const files = [...new Set([...css.matchAll(/url\(\.\.\/fonts\/([^)]+)\)/g)].map(m => m[1]))];
    const missing = files.filter(f => !existsSync(join(ROOT, "assets/fonts", f)));
    assert.deepEqual(missing, [], `없는 폰트 파일: ${missing.join(", ")}`);
    assert.ok(files.length > 0, "@font-face가 하나도 없다");
  });
});

describe("마크업 계약 · id", () => {
  test("JS가 부르는 id가 전부 존재한다", () => {
    const missing = [];
    for (const [file, source] of jsSources) {
      for (const m of source.matchAll(/\$\("#([A-Za-z0-9_-]+)"/g)) {
        if (!htmlIds.has(m[1])) missing.push(`${m[1]}  (${file.replace(ROOT + "/", "")})`);
      }
    }
    assert.deepEqual(missing, [], `index.html에 없는 id:\n  ${missing.join("\n  ")}`);
  });

  test("id가 중복되지 않는다", () => {
    const all = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    const dupes = all.filter((v, i) => all.indexOf(v) !== i);
    assert.deepEqual([...new Set(dupes)], [], "중복된 id");
  });
});

describe("마크업 계약 · 화면 전환", () => {
  const sections = [...html.matchAll(/<section class="view[^"]*"\s+id="([^"]+)"/g)].map(m => m[1]);

  test("레지스트리의 모든 화면이 마크업에 있다", () => {
    for (const view of VIEWS) {
      assert.ok(sections.includes(view.id),
        `VIEWS의 "${view.id}"에 대응하는 <section class="view" id="${view.id}">가 없음`);
    }
  });

  test("마크업의 모든 화면이 레지스트리에 있다", () => {
    const ids = VIEWS.map(v => v.id);
    for (const id of sections) {
      assert.ok(ids.includes(id), `#${id} 화면으로 갈 메뉴 항목이 VIEWS에 없음`);
    }
  });

  test("레지스트리 항목에 빠진 값이 없다", () => {
    for (const view of VIEWS) {
      for (const key of ["id", "label", "sub", "title"]) {
        assert.ok(view[key], `VIEWS의 "${view.id}"에 ${key}가 없음`);
      }
    }
  });

  test("화면 id가 중복되지 않는다", () => {
    const ids = VIEWS.map(v => v.id);
    assert.equal(new Set(ids).size, ids.length, "VIEWS에 중복된 id");
  });

  test("기본 화면이 레지스트리에 있다", () => {
    assert.ok(VIEWS.some(v => v.id === DEFAULT_VIEW), `DEFAULT_VIEW "${DEFAULT_VIEW}"가 VIEWS에 없음`);
  });

  test("처음 열릴 때 활성 화면이 하나다", () => {
    assert.equal(classCount("view is-active"), 1, "활성 화면은 하나여야 함");
  });

  test("메뉴를 그릴 자리가 있다", () => {
    assert.ok(htmlIds.has("navList"), "#navList가 없으면 메뉴가 렌더링되지 않음");
  });
});

describe("마크업 계약 · 장치 도식", () => {
  test("설명 데이터가 있는 부품이 도식에 전부 그려져 있다", () => {
    const drawn = attrValues("part");
    for (const id of Object.keys(componentData)) {
      assert.ok(drawn.has(id), `componentData에 있는 "${id}"가 SVG에 없음`);
    }
  });

  test("도식의 부품에 설명 데이터가 전부 있다", () => {
    for (const id of attrValues("part")) {
      assert.ok(componentData[id], `SVG의 data-part="${id}"에 componentData가 없음`);
    }
  });

  test("목록 순서에 빠지거나 없는 부품이 없다", () => {
    const listed = [...componentOrder.A, ...componentOrder.B];
    assert.deepEqual([...listed].sort(), Object.keys(componentData).sort(),
      "componentOrder와 componentData가 어긋남");
  });

  test("실험 A·B 도식과 전환 버튼이 짝을 이룬다", () => {
    assert.deepEqual([...attrValues("apparatus")].sort(), ["A", "B"]);
    assert.equal(classCount("apparatus-diagram"), 2);
    assert.equal(classCount("apparatus-mode"), 2);
  });

  test("흐름 레이어 토글과 레이어가 짝을 이룬다", () => {
    const toggles = attrValues("layer");
    const groups = new Set([...html.matchAll(/data-layer-group="([^"]+)"/g)].map(m => m[1]));
    for (const t of toggles) assert.ok(groups.has(t), `토글 "${t}"에 대응하는 레이어가 없음`);
    for (const g of groups) assert.ok(toggles.has(g), `레이어 "${g}"를 켜고 끌 토글이 없음`);
  });
});

describe("마크업 계약 · 입력 요소", () => {
  test("실험 B 센서 버튼이 물리 모델의 센서와 일치한다", () => {
    assert.deepEqual([...attrValues("sensor")].sort(), ["T6", "T7", "T8"]);
    assert.equal(classCount("sensor-button"), 3);
  });

  test("CFD case 선택지가 메타데이터와 일치한다", () => {
    const options = new Set([...html.matchAll(/<option value="([^"]+)"/g)].map(m => m[1]));
    for (const id of Object.keys(CFD_CASES)) {
      assert.ok(options.has(id), `CFD_CASES의 "${id}"를 고를 수 있는 option이 없음`);
    }
  });

  test("빠른 선택 버튼이 존재한다", () => {
    assert.ok(classCount("a-voltage") >= 3, "실험 A 전압 버튼");
    assert.ok(classCount("b-velocity") >= 4, "실험 B 유속 버튼");
    assert.equal(classCount("dataset-button"), 2, "데이터셋 전환 버튼");
    assert.equal(classCount("lumped-mode"), 2, "시간 변화 모드 버튼");
  });
});

describe("마크업 계약 · 클래스 이름", () => {
  // JS가 붙이는 클래스에 CSS 규칙이 없으면 화면은 조용히 무너진다.
  // 사이드바 메뉴가 통째로 안 보이는 사고가 실제로 났다.
  const cssText = (function collect(dir, out = []) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) collect(full, out);
      else if (entry.endsWith(".css") && entry !== "fonts.css") out.push(readFileSync(full, "utf8"));
    }
    return out;
  })(join(ROOT, "assets", "css")).join("\n");

  const cssClasses = new Set([...cssText.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]));

  // 이벤트를 걸기 위한 표식일 뿐 모양을 담당하지 않는 클래스
  const hooks = new Set([
    "a-voltage", "b-velocity", "sensor-button", "dataset-button", "lumped-mode",
    "apparatus-mode", "toggle-layer", "selected", "is-hidden", "layer-hidden"
  ]);

  test("JS가 붙이는 클래스에 CSS 규칙이 있다", () => {
    const applied = new Set();
    for (const [, source] of jsSources) {
      for (const m of source.matchAll(/classList\.(?:add|remove|toggle)\("([a-z][\w-]*)"/g)) applied.add(m[1]);
      for (const m of source.matchAll(/class="([^"$]+)"/g)) m[1].split(/\s+/).forEach(c => c && applied.add(c));
    }
    const orphans = [...applied].filter(c => !cssClasses.has(c) && !hooks.has(c)).sort();
    assert.deepEqual(orphans, [], `CSS에 규칙이 없는 클래스: ${orphans.join(", ")}`);
  });

  test("마크업의 클래스에 CSS 규칙이 있다", () => {
    const inMarkup = new Set();
    for (const m of html.matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach(c => c && inMarkup.add(c));
    const orphans = [...inMarkup].filter(c => !cssClasses.has(c) && !hooks.has(c)).sort();
    assert.deepEqual(orphans, [], `CSS에 규칙이 없는 클래스: ${orphans.join(", ")}`);
  });
});
