// 장치 도식 구성요소의 설명 데이터.
// 센서 좌표가 확정되면 좌표 항목 추가 (CFD probe 위치와 공유)

export const componentData = {
  "a-duct": { mode: "A", label: "수직 관과 관벽", badge: "실험 A · 장치", summary: "두꺼운 관벽 내부의 유로를 따라 공기가 자연대류로 이동합니다.", measure: "관 내부 공기 흐름", location: "가열 실린더와 송풍기 사이의 수직 관", role: "관벽과 내부 공기 영역을 구분하고, 가열된 공기의 상승 경로와 센서 위치를 정의합니다." },
  "a-heater": { mode: "A", label: "가열 실린더", badge: "실험 A · 열원", summary: "관 내부의 주황색 구간이 가열되고, 회색 구간은 관벽 밖으로 이어지는 일반 지지관입니다.", measure: "공급 전력 V·I, 표면 온도 T10", location: "수직 관을 수평으로 관통하는 실린더", role: "관 내부 heated zone에서 자연대류와 복사가 동시에 발생합니다." },
  "a-t10": { mode: "A", label: "T10 표면 온도 센서", badge: "실험 A · 센서", summary: "가열 실린더 중앙의 표면 온도를 측정합니다.", measure: "T10 = Tₛ", location: "가열 실린더 표면 중앙", role: "복사 및 자연대류 열전달량 계산에 사용됩니다." },
  "a-t8": { mode: "A", label: "T8 공기 온도 센서", badge: "실험 A · 센서", summary: "가열 실린더 아래쪽 관 내부 공기 온도를 측정합니다.", measure: "T8 = Tₐ", location: "가열 실린더 아래쪽의 관 내부", role: "실린더와 공기 사이의 온도차를 계산하는 기준 온도입니다." },
  "a-throttle": { mode: "A", label: "Throttle plate", badge: "실험 A · 유로", summary: "송풍기 앞쪽에서 공기 유입 통로를 조절하는 장치입니다.", measure: "개방 상태", location: "송풍기 입구 부근", role: "실험 A에서는 공기가 관에 들어갈 수 있도록 열어 둡니다." },
  "a-fan": { mode: "A", label: "Fan", badge: "실험 A · 장치", summary: "관 내부에 강제 흐름을 만들 수 있는 송풍기입니다.", measure: "실험 A에서는 OFF", location: "수직 관 하부", role: "실험 A의 자연대류 조건에서는 전원과 풍속계를 연결하지 않습니다." },

  "b-duct": { mode: "B", label: "Duct", badge: "실험 B · 장치", summary: "가열된 외벽 안으로 공기가 흐르고 여러 열전쌍이 배치된 수직 관입니다.", measure: "공기 온도와 유속", location: "히터와 센서가 설치된 수직 관", role: "벽 복사와 공기 대류가 센서에 동시에 작용하는 실험 공간입니다." },
  "b-heater-wall": { mode: "B", label: "가열 외벽", badge: "실험 B · 열원", summary: "전기 밴드 히터로 가열되어 내부 열전쌍에 복사 열을 전달합니다.", measure: "외벽 온도 T10", location: "T6·T7·T8을 둘러싼 관 벽", role: "센서의 복사 오차를 만드는 주위 고온 표면입니다." },
  "b-t10": { mode: "B", label: "T10 외벽 온도 센서", badge: "실험 B · 센서", summary: "열전쌍을 둘러싼 가열 외벽 온도를 측정합니다.", measure: "T10 = Tₛ", location: "가열 외벽", role: "센서가 받는 복사 열전달의 벽 온도로 사용됩니다." },
  "b-t5": { mode: "B", label: "T5 유입 공기 온도 센서", badge: "실험 B · 센서", summary: "가열 구간에 들어가기 전 공기의 온도를 측정합니다.", measure: "T5 = T_g", location: "히터와 시험 열전쌍 아래쪽", role: "열전쌍이 측정해야 하는 실제 기체 온도의 기준으로 사용됩니다." },
  "b-t6": { mode: "B", label: "T6 · 작은 회색체 비드", badge: "실험 B · 시험 센서", summary: "복사율이 1보다 작은 0.5 mm 회색체 열전쌍입니다.", measure: "T6 = T_c", location: "가열 외벽 내부의 시험 센서 위치", role: "T7과 비교하여 비드 크기는 같고 복사율만 다른 영향을 살펴봅니다." },
  "b-t7": { mode: "B", label: "T7 · 작은 흑체 비드", badge: "실험 B · 시험 센서", summary: "흑체에 가까운 0.5 mm 열전쌍입니다.", measure: "T7 = T_c", location: "가열 외벽 내부의 시험 센서 위치", role: "T6와는 복사율, T8과는 비드 크기의 차이를 비교합니다." },
  "b-t8": { mode: "B", label: "T8 · 큰 흑체 비드", badge: "실험 B · 시험 센서", summary: "흑체에 가까운 3 mm 열전쌍으로, T7보다 비드가 큽니다.", measure: "T8 = T_c", location: "가열 외벽 내부의 시험 센서 위치", role: "비드 크기가 측정 온도와 냉각 효과에 미치는 영향을 살펴봅니다." },
  "b-shield": { mode: "B", label: "Shield", badge: "실험 B · 장치", summary: "교안 장치 구조도 상단에 표시된 차폐부입니다.", measure: "차폐 상태", location: "가열 구간 상부", role: "장치의 상부 경계와 복사 환경을 구성합니다." },
  "b-anemometer": { mode: "B", label: "Anemometer", badge: "실험 B · 센서", summary: "관 내부 공기 유속을 측정하는 풍속계입니다.", measure: "Uₐ", location: "시험 열전쌍 아래쪽 관 내부", role: "강제대류 조건 0.2, 0.4, 0.8, 1.6 m/s를 맞추는 데 사용됩니다." },
  "b-fan": { mode: "B", label: "Fan", badge: "실험 B · 장치", summary: "관 내부에 강제대류를 만드는 송풍기입니다.", measure: "ON/OFF 및 유속", location: "수직 관 하부", role: "강제대류 단계에서 켜고 throttle plate와 함께 유속을 조절합니다." }
};

// 목록 패널 표시 순서
export const componentOrder = {
  A: ["a-t10", "a-t8", "a-heater", "a-duct", "a-throttle", "a-fan"],
  B: ["b-t5", "b-t6", "b-t7", "b-t8", "b-t10", "b-heater-wall", "b-anemometer", "b-fan", "b-shield", "b-duct"]
};
