// Captures the canvas for every route stage and landmark and uploads it to the dev server (docs/screenshots).
//   const S = await import('/test/shots.js'); await S.captureAll(window.__lr, 'desktop');

const STAGES = [
  ['stage1-entrance', 6], ['stage2-main-street', 150], ['stage3-friends-yard', 350], ['stage3-friends-motel', 470],
  ['stage4-winding-road', 650], ['stage5-bridge', 890], ['stage5-tunnel', 1060], ['stage6-return-road', 1330], ['stage7-reconnect', 1555],
];
const LANDMARKS = [
  ['landmark-entrance-sign', 'entranceSign', 38, 0.2, 7, 5], ['landmark-diner', 'diner', 40, 0.5, 9, 3], ['landmark-paint-shop', 'paintShop', 40, 0.35, 9, 3],
  ['landmark-tire-shop', 'tireShop', 40, -0.35, 9, 3], ['landmark-tow-yard', 'towYard', 46, 0.5, 14, 2], ['landmark-cone-motel', 'coneMotel', 50, -0.3, 16, 2],
  ['landmark-fuel-station', 'fuelStation', 34, -0.4, 8, 3], ['landmark-town-hall', 'townHall', 36, 0.4, 8, 5], ['landmark-nursery', 'nursery', 30, 0.4, 7, 2],
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(lr, name) {
  lr.game.render();
  const canvas = document.getElementById('stage');
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  await fetch(`/__shot?name=${encodeURIComponent(name)}.png`, { method: 'POST', body: blob });
  return { name, w: canvas.width, h: canvas.height, bytes: blob.size };
}

export async function captureAll(lr, tag, { only } = {}) {
  lr.pause();
  const out = [];
  for (const [name, s] of STAGES) {
    if (only && !name.includes(only)) continue;
    lr.game.debugCam = null;
    lr.goto(s, 1.0);
    out.push(await shot(lr, `${tag}-${name}`));
  }
  for (const [name, id, d, a, h, lh] of LANDMARKS) {
    if (only && !name.includes(only)) continue;
    lr.view(id, d, a, h, lh);
    out.push(await shot(lr, `${tag}-${name}`));
  }
  lr.game.debugCam = null;
  lr.goto(60, 1.0);
  lr.resume();
  return out;
}
