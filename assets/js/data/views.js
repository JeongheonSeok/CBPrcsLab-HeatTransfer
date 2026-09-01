// 화면 목록. 사이드바 메뉴와 상단 제목이 모두 여기서 나온다.
// 화면을 추가하려면 여기에 항목 하나와 index.html에 <section class="view" id="…">를 넣으면 된다.
// 둘 중 하나만 하면 tests/markup-contract.test.mjs가 잡아낸다.

export const VIEWS = [
  {
    id: "apparatus",
    label: "장치 이해",
    sub: "센서와 열전달 경로",
    title: "장치 이해"
  },
  {
    id: "experiment-a",
    label: "실험 A",
    sub: "대류와 복사",
    title: "실험 A · 대류와 복사"
  },
  {
    id: "experiment-b",
    label: "실험 B",
    sub: "열전쌍 측정 오차",
    title: "실험 B · 온도 측정 오차"
  },
  {
    id: "transient",
    label: "시간 변화",
    sub: "Lumped-parameter model",
    title: "시간 변화 · Lumped model"
  },
  {
    id: "field-viewer",
    label: "유동장",
    sub: "CFD 결과·모델 비교",
    title: "CFD 결과·모델 비교"
  },
  {
    id: "data",
    label: "내 데이터",
    sub: "측정값 입력·저장",
    title: "내 실험 데이터"
  }
];

export const DEFAULT_VIEW = VIEWS[0].id;
