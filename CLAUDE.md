# 프로젝트 규약

## 커밋

한 줄 영어 제목. 본문 없음. 제목 50자 안쪽, 마침표 없이.

```
<prefix>: <summary>
```

제목 한 줄이 전부다. `Co-Authored-By`나 세션 링크 같은 trailer는 붙이지 않는다.

| prefix | 쓰는 경우 |
|---|---|
| `feat` | 새 화면, 새 계산 기능 |
| `fix` | 잘못된 동작이나 계산 수정 |
| `refactor` | 동작은 그대로, 구조만 변경 |
| `style` | 화면 스타일과 서식만 |
| `data` | 물성값, 실측값, CFD case 데이터 갱신 |
| `docs` | 문서 |
| `chore` | 설정 파일, 정리 |

`data:`를 따로 두는 이유는 코드를 고치지 않아도 `physics/constants.js`의 숫자
하나로 계산 결과가 바뀌기 때문이다. `git log --oneline --grep='^data'`로 계산
결과가 달라진 지점을 찾을 수 있어야 한다.

scope는 기본적으로 붙이지 않는다. 한 커밋이 특정 모듈에만 닿을 때만
`fix(physics): ...`처럼 쓴다.

```
refactor: split monolithic HTML into markup, styles, modules
fix: stop redrawing comparison chart during field playback
data: update cylinder dimensions and sensor coordinates
```

## 주석

한국어. 다음 세 가지를 지킨다.

1. 함수 이름과 인자로 알 수 있는 내용은 쓰지 않는다.
2. 한 줄을 기본으로 하고, 여러 줄은 "왜 이렇게 했는지"를 설명할 때만 쓴다.
3. 단위, 물리적 가정, 예시값 표시는 짧게라도 남긴다.

세 번째는 교육용 도구라서 지키는 예외다. 학생과 조교가 잘못된 값을 확정값으로
믿고 쓰는 것을 막아야 한다.

```js
export const SIGMA = 5.67e-8;   // Stefan-Boltzmann 상수 [W·m⁻²·K⁻⁴]
epsilon: 0.95,                  // 예시값

// log10(Ra) 구간별 계수 C, n. 교안 표 범위 밖이면 extrapolated로 표시
function morganCN(logRa) {
```

JSDoc 블록(`/** */`)은 쓰지 않는다.

파일 맨 앞의 docstring이나 헤더 주석은 되도록 쓰지 않는다. 꼭 필요하면 한 줄, 영어로
쓴다. 파일이 무엇인지는 경로와 이름으로 드러나야 하고, 설명이 길어진다면 그건 파일이
잘못 나뉜 것이다. 본문 안의 "왜"를 설명하는 주석은 한국어 그대로 쓴다.

## 코드

- 의존성과 빌드 단계를 두지 않는다. ES module과 표준 브라우저 API만 쓴다.
- `physics/`는 DOM에 접근하지 않는다. 화면이 입력값을 모아서 넘긴다.
- 물리 상수와 장치 치수는 `physics/constants.js` 한 곳에만 둔다.
- `physics/`를 고치면 계산 결과가 바뀔 수 있으므로 아래를 돌리고 커밋한다.

```
npm test        # 모델이 지켜야 할 성질
npm run verify  # scipy 독립 구현과 교차 비교
```

교차 검증은 일부러 다른 알고리즘을 쓴다. 웹은 이분법과 고정 간격 RK4로 풀고,
파이썬은 Brent 법과 적응형 Runge-Kutta로 푼다. 같은 방법을 두 번 구현하면
같은 실수를 두 번 하므로 검증이 되지 않는다.
