import { buildRoute, STAGE_NAMES } from '../src/route.js';
import { CFG } from '../src/config.js';
const t0 = performance.now();
const r = buildRoute();
const build = performance.now() - t0;
const o = {}, o2 = {};
// continuity across the wrap point vs typical adjacent-sample step
const eps = 0.01;
r.at(r.L - eps, o); r.at(eps, o2);
const dPos = Math.hypot(o.x - o2.x, o.y - o2.y, o.z - o2.z);
const yaw = (q) => Math.atan2(q.tx, q.tz);
let dYaw = Math.abs(yaw(o) - yaw(o2)); if (dYaw > Math.PI) dYaw = 2 * Math.PI - dYaw;
// worst adjacent-step heading change over whole loop, and max slope, min turn radius
let maxDYaw = 0, maxSlope = 0, minR = 1e9, maxJumpPos = 0;
let prev = r.at(0, {});
for (let s = 0.25; s <= r.L + 0.25; s += 0.25) {
  const q = r.at(s, {});
  let dy = Math.abs(yaw(q) - yaw(prev)); if (dy > Math.PI) dy = 2 * Math.PI - dy;
  maxDYaw = Math.max(maxDYaw, dy);
  if (dy > 1e-6) minR = Math.min(minR, 0.25 / dy);
  maxSlope = Math.max(maxSlope, Math.abs(q.ty));
  maxJumpPos = Math.max(maxJumpPos, Math.hypot(q.x - prev.x, q.y - prev.y, q.z - prev.z) - 0.25);
  prev = q;
}
console.log(JSON.stringify({
  lengthM: +r.L.toFixed(1), lapSecAtCruise: +(r.L / CFG.CRUISE_SPEED).toFixed(1), buildMs: +build.toFixed(1),
  wrapPosGapM: +dPos.toFixed(5), wrapHeadingGapRad: +dYaw.toFixed(6),
  maxHeadingStepPer0_25m: +maxDYaw.toFixed(4), minTurnRadiusM: +minR.toFixed(1), maxSlope: +maxSlope.toFixed(3),
  marks: Object.fromEntries(Object.entries(r.marks).map(([k, v]) => [k, Math.round(v)])),
  stages: STAGE_NAMES.map((n, i) => `${n}@${Math.round(r.stageStarts[i])}`),
}, null, 1));
