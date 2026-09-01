// 디자인 토큰의 일관성을 검사한다.
// 데이터 색은 CSS와 JS 두 곳에 있으므로 어긋나면 표와 그래프의 색이 달라진다.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { SERIES_COLOR } from "../assets/js/core/chart.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const cssFiles = (function collect(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (entry.endsWith(".css")) out.push([full.replace(ROOT + "/", ""), readFileSync(full, "utf8")]);
  }
  return out;
})(join(ROOT, "assets", "css"));

const base = cssFiles.find(([name]) => name.endsWith("tokens.css"))[1];
const token = name => base.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim();

/** 상대 휘도 (WCAG). */
function luminance(hex) {
  const [r, g, b] = hex.replace("#", "").match(/../g).map(v => {
    const c = parseInt(v, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("디자인 토큰 · 데이터 색의 단일 출처", () => {
  const pairs = [
    ["series-conv", "conv"],
    ["series-rad", "rad"],
    ["series-surface", "surface"],
    ["series-marker", "marker"],
    ["series-muted", "muted"]
  ];

  for (const [cssName, jsKey] of pairs) {
    test(`--${cssName} 와 SERIES_COLOR.${jsKey} 가 같다`, () => {
      const css = token(cssName);
      assert.ok(css, `base.css에 --${cssName}가 없음`);
      assert.equal(css.toLowerCase(), SERIES_COLOR[jsKey].toLowerCase(),
        `표는 CSS 색, 그래프는 JS 색을 쓰므로 두 값이 같아야 한다`);
    });
  }
});

describe("디자인 토큰 · 대비", () => {
  test("UI 강조색이 본문 대비 기준을 넘는다", () => {
    const accent = token("accent");
    for (const bg of ["#ffffff", token("bg")]) {
      const r = contrast(accent, bg);
      assert.ok(r >= 4.5, `--accent ${accent} on ${bg}: ${r.toFixed(2)}:1 (기준 4.5)`);
    }
  });

  test("선택 상태의 글자가 읽힌다", () => {
    const r = contrast(token("accent-ink"), token("accent-soft"));
    assert.ok(r >= 4.5, `--accent-ink on --accent-soft: ${r.toFixed(2)}:1`);
  });

  test("강조색 위의 흰 글자가 읽힌다", () => {
    const r = contrast("#ffffff", token("accent"));
    assert.ok(r >= 4.5, `#fff on --accent: ${r.toFixed(2)}:1`);
  });

  test("데이터 색이 큰 글자 기준을 넘는다", () => {
    // 지표 카드의 큰 숫자에 쓰이므로 3:1이 기준이다.
    for (const [, key] of [["", "conv"], ["", "rad"], ["", "surface"], ["", "marker"]]) {
      const r = contrast(SERIES_COLOR[key], "#ffffff");
      assert.ok(r >= 3.0, `SERIES_COLOR.${key} ${SERIES_COLOR[key]}: ${r.toFixed(2)}:1 (기준 3.0)`);
    }
  });

  test("정의된 상태색이 각자의 배경에서 읽힌다", () => {
    // 쓸 자리가 없는 상태색은 토큰을 두지 않으므로, 있는 짝만 검사한다.
    const pairs = [["status-ok", "status-ok-soft"], ["status-warn", "status-warn-soft"]]
      .filter(([fg, bg]) => token(fg) && token(bg));
    assert.ok(pairs.length > 0, "상태색이 하나도 정의되지 않았다");
    for (const [fg, bg] of pairs) {
      const r = contrast(token(fg), token(bg));
      assert.ok(r >= 4.5, `--${fg} on --${bg}: ${r.toFixed(2)}:1`);
    }
  });
});

describe("디자인 토큰 · 규칙 준수", () => {
  test("모서리 반경은 정해진 단계만 쓴다", () => {
    const allowed = /^(var\(--radius-(sm|md|pill)\)|999px|50%|inherit)$/;
    const offenders = [];
    for (const [name, css] of cssFiles) {
      for (const m of css.matchAll(/border-radius:\s*([^;]+);/g)) {
        const value = m[1].trim();
        if (!allowed.test(value)) offenders.push(`${name}: ${value}`);
      }
    }
    assert.deepEqual(offenders, [], `정해진 단계 밖의 반경:\n  ${offenders.join("\n  ")}`);
  });

  test("데이터 색을 UI 요소에 쓰지 않는다", () => {
    // 물리량 색이 버튼이나 메뉴에 새어 나오면 학생이 UI를 데이터로 읽는다.
    const uiSelectors = /\.(nav-button|primary-button|ghost-button|small-button|chip-button|toggle-button|tab-btn)[^{]*\{([^}]*)\}/g;
    const offenders = [];
    for (const [name, css] of cssFiles) {
      for (const m of css.matchAll(uiSelectors)) {
        if (/var\(--series-/.test(m[2])) offenders.push(`${name}: ${m[0].slice(0, 60)}`);
      }
    }
    assert.deepEqual(offenders, [], "UI 요소가 데이터 색을 씀");
  });

  test("UI 규칙이 데이터 계열 색값을 직접 쓰지 않는다", () => {
    // --accent 계열이어야 할 자리에 --series-* 의 hex가 새어 들어오면
    // 버튼에 마우스를 올리는 순간 UI가 "대류" 색으로 변한다. 실제로 있었던 결함이다.
    const seriesHex = Object.values(SERIES_COLOR).map(v => v.toLowerCase());
    const offenders = [];
    for (const [name, css] of cssFiles) {
      if (name.endsWith("tokens.css")) continue;   // 토큰 정의부는 예외
      css.split("\n").forEach((line, i) => {
        for (const hex of seriesHex) {
          if (line.toLowerCase().includes(hex)) offenders.push(`${name}:${i + 1}  ${line.trim().slice(0, 70)}`);
        }
      });
    }
    assert.deepEqual(offenders, [], `데이터 색을 직접 쓴 곳:\n  ${offenders.join("\n  ")}`);
  });

  test("정의만 되고 안 쓰는 토큰이 없다", () => {
    // --series-*는 CSS에 안 나와도 JS 차트가 쓴다. 위의 단일 출처 검사가 이미 지킨다.
    // --accent-rgb는 rgba(var(--accent-rgb), a) 형태라 별도로 찾는다.
    const all = [...base.matchAll(/^\s*--([a-z0-9-]+):/gm)].map(m => m[1]);
    const body = cssFiles.map(([, c]) => c).join("\n");
    const unused = all.filter(name =>
      !name.startsWith("series-") && !new RegExp(`var\\(--${name}[),\\s]`).test(body));
    assert.deepEqual(unused, [], `쓰이지 않는 토큰: ${unused.join(", ")}`);
  });
});
