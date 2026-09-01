// 사전 계산 CFD case 목록.
// 여기 있는 것은 실험 조건(정체성)뿐이고 계산 결과는 아직 없다.
// 지어낸 숫자를 두면 학생이 결과로 읽으므로 status: "pending"으로 비워 둔다.
// 연구실에서 case를 계산하면 이 파일에 값을 채우는 것만으로 화면이 살아난다.

export const CFD_CASES = {
  A5:  { kind: "A", mode: "natural", label: "A · 5 V", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Mean cylinder surface temperature" },
  A11: { kind: "A", mode: "natural", label: "A · 11 V", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Mean cylinder surface temperature" },
  A17: { kind: "A", mode: "natural", label: "A · 17 V", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Mean cylinder surface temperature" },
  BN5:  { kind: "B", mode: "natural", label: "B · fan off · 5 V", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Mean heated wall temperature" },
  BN11: { kind: "B", mode: "natural", label: "B · fan off · 11 V", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Mean heated wall temperature" },
  BN17: { kind: "B", mode: "natural", label: "B · fan off · 17 V", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Mean heated wall temperature" },
  B02: { kind: "B", mode: "forced", label: "B · 17 V · 0.2 m/s", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Mean heated wall temperature" },
  B04: { kind: "B", mode: "forced", label: "B · 17 V · 0.4 m/s", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Mean heated wall temperature" },
  B08: { kind: "B", mode: "forced", label: "B · 17 V · 0.8 m/s", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Mean heated wall temperature" },
  B16: { kind: "B", mode: "forced", label: "B · 17 V · 1.6 m/s", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Mean heated wall temperature" }
};
