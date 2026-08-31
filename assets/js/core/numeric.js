// 수치 해석 공통 루틴

// 스칼라 상미분방정식의 4차 Runge-Kutta 한 단계
export function rk4Scalar(value, dt, derivative) {
  const k1 = derivative(value);
  const k2 = derivative(value + dt * k1 / 2);
  const k3 = derivative(value + dt * k2 / 2);
  const k4 = derivative(value + dt * k3);
  return value + dt * (k1 + 2 * k2 + 2 * k3 + k4) / 6;
}

// 이분법. 구간 안에서 부호가 한 번만 바뀌는 함수에 사용
export function bisect(f, lo, hi, iterations = 80) {
  let flo = f(lo);
  for (let i = 0; i < iterations; i += 1) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (flo * fm <= 0) hi = mid;
    else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}
