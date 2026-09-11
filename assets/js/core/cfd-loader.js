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
    if (!response.ok) return null;
    const index = await response.json();
    const sprites = {};
    for (const [plane, files] of Object.entries(index.planes)) {
      sprites[plane] = {
        temperature: await loadImage(`${base}/${files.temperature}`),
        speed: await loadImage(`${base}/${files.speed}`)
      };
    }
    const history = await (await fetch(`${base}/history.json`)).json();
    return { index, sprites, history };
  })();
  cache.set(caseId, promise);
  return promise;
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
