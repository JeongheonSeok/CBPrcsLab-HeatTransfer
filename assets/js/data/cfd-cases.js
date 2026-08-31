// 사전 계산 CFD case의 메타데이터.
// 현재 수치는 UI 확인용 예시값. 단계 3~4에서 실제 표면 적분 결과로 교체.

export const CFD_CASES = {
  A5:  { kind: "A", mode: "natural", label: "A · 5 V", qConv: .32, qRad: .12, temp0: 25, tempCfd: 49, tempLumped: 51, tauCfd: 170, tauLumped: 145, heatTau: 130, radMethod: "CFD 온도장 + 복사 후처리", quantity: "실린더 평균 표면 온도" },
  A11: { kind: "A", mode: "natural", label: "A · 11 V", qConv: 1.10, qRad: .85, temp0: 25, tempCfd: 89, tempLumped: 92, tauCfd: 205, tauLumped: 178, heatTau: 160, radMethod: "CFD 온도장 + 복사 후처리", quantity: "실린더 평균 표면 온도" },
  A17: { kind: "A", mode: "natural", label: "A · 17 V", qConv: 2.20, qRad: 2.80, temp0: 25, tempCfd: 143, tempLumped: 148, tauCfd: 245, tauLumped: 215, heatTau: 190, radMethod: "CFD 온도장 + 복사 후처리", quantity: "실린더 평균 표면 온도" },
  BN5:  { kind: "B", mode: "natural", label: "B · fan off · 5 V", qConv: .45, qRad: .12, temp0: 25, tempCfd: 67, tempLumped: 69, tauCfd: 185, tauLumped: 165, heatTau: 145, radMethod: "CFD 온도장 + 복사 후처리", quantity: "가열 벽 평균 온도" },
  BN11: { kind: "B", mode: "natural", label: "B · fan off · 11 V", qConv: 1.35, qRad: .55, temp0: 25, tempCfd: 105, tempLumped: 109, tauCfd: 220, tauLumped: 195, heatTau: 170, radMethod: "CFD 온도장 + 복사 후처리", quantity: "가열 벽 평균 온도" },
  BN17: { kind: "B", mode: "natural", label: "B · fan off · 17 V", qConv: 2.40, qRad: 1.40, temp0: 25, tempCfd: 145, tempLumped: 150, tauCfd: 255, tauLumped: 225, heatTau: 195, radMethod: "CFD 온도장 + 복사 후처리", quantity: "가열 벽 평균 온도" },
  B02: { kind: "B", mode: "forced", label: "B · 17 V · 0.2 m/s", qConv: 3.00, qRad: 1.30, temp0: 25, tempCfd: 142, tempLumped: 146, tauCfd: 210, tauLumped: 190, heatTau: 150, radMethod: "CFD 온도장 + 복사 후처리", quantity: "가열 벽 평균 온도" },
  B04: { kind: "B", mode: "forced", label: "B · 17 V · 0.4 m/s", qConv: 3.80, qRad: 1.20, temp0: 25, tempCfd: 140, tempLumped: 143, tauCfd: 180, tauLumped: 165, heatTau: 135, radMethod: "CFD 온도장 + 복사 후처리", quantity: "가열 벽 평균 온도" },
  B08: { kind: "B", mode: "forced", label: "B · 17 V · 0.8 m/s", qConv: 4.80, qRad: 1.10, temp0: 25, tempCfd: 137, tempLumped: 140, tauCfd: 150, tauLumped: 138, heatTau: 115, radMethod: "CFD 온도장 + 복사 후처리", quantity: "가열 벽 평균 온도" },
  B16: { kind: "B", mode: "forced", label: "B · 17 V · 1.6 m/s", qConv: 5.70, qRad: 1.00, temp0: 25, tempCfd: 133, tempLumped: 136, tauCfd: 120, tauLumped: 110, heatTau: 95, radMethod: "CFD 온도장 + 복사 후처리", quantity: "가열 벽 평균 온도" }
};
