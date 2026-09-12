// tools/cfd_to_frames.py가 만든 산출물을 읽는다. 스프라이트 PNG 한 장에 프레임이
// 타일로 들어 있고, index.json이 격자·범위·프레임 시각을 준다.

const cache = new Map();

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

// 없는 case는 null. 아직 계산되지 않은 조건이라는 뜻이지 오류가 아니다.
export async function loadCase(caseId) {
  if (cache.has(caseId)) return cache.get(caseId);
  const base = `assets/data/cfd/${caseId}`;
  const promise = (async () => {
    const response = await fetch(`${base}/index.json`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Could not load ${caseId} (HTTP ${response.status})`);
    const index = await response.json();
    // 온도만 먼저 받는다. 속력 스프라이트가 더 크고, 안 누르는 사람도 많다.
    const sprites = {};
    for (const [plane, files] of Object.entries(index.planes)) {
      sprites[plane] = { temperature: await loadImage(`${base}/${files.temperature}`) };
    }
    const historyResponse = await fetch(`${base}/history.json`);
    if (!historyResponse.ok) throw new Error(`Could not load ${caseId} history`);
    const history = await historyResponse.json();
    return { base, index, sprites, history };
  })();
  cache.set(caseId, promise);
  try {
    const result = await promise;
    if (!result) cache.delete(caseId);
    return result;
  } catch (error) {
    cache.delete(caseId);
    throw error;
  }
}

// 이력과 index만. 시간 화면은 스프라이트가 필요 없다.
const historyCache = new Map();
export async function loadHistory(caseId) {
  if (historyCache.has(caseId)) return historyCache.get(caseId);
  const base = `assets/data/cfd/${caseId}`;
  const promise = (async () => {
    const response = await fetch(`${base}/index.json`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Could not load ${caseId} (HTTP ${response.status})`);
    const index = await response.json();
    const historyResponse = await fetch(`${base}/history.json`);
    if (!historyResponse.ok) throw new Error(`Could not load ${caseId} history`);
    return { index, history: await historyResponse.json() };
  })();
  historyCache.set(caseId, promise);
  try {
    const result = await promise;
    if (!result) historyCache.delete(caseId);
    return result;
  } catch (error) {
    historyCache.delete(caseId);
    throw error;
  }
}

// 처음 요청되는 장(field)의 스프라이트를 그때 받는다.
export async function ensureField(data, field) {
  for (const [plane, files] of Object.entries(data.index.planes)) {
    if (!data.sprites[plane][field]) {
      data.sprites[plane][field] = await loadImage(`${data.base}/${files[field]}`);
    }
  }
}

// 스프라이트에서 프레임 하나의 회색조 픽셀을 꺼낸다. 값은 0~255, index의 범위로 되돌린다.
export function frameData(data, plane, field, frameIndex, scratch) {
  const { index, sprites } = data;
  const { w, h } = index.tile;
  const { cols } = index.planes[plane];
  const row = Math.floor(frameIndex / cols), col = frameIndex % cols;
  scratch.width = w; scratch.height = h;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(sprites[plane][field], col * w, row * h, w, h, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

// 회색조 0~255를 물리값으로. 온도는 °C, 속력은 m/s.
export function physical(index, field, byte) {
  const range = field === "temperature" ? index.temperatureC : index.speed;
  return range.min + (range.max - range.min) * byte / 255;
}
