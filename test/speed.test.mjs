import { SpeedModel } from '../src/speed.js';
import { CFG } from '../src/config.js';
const dt = CFG.SIM_DT;
const res = {};
function run(m, secs, fn) { // returns stats
  let maxA = 0, minA = 0, maxJ = 0, prevA = m.a, prevV = m.v, t = 0, reverse = false;
  for (let i = 0; i < secs / dt; i++, t += dt) {
    if (fn) fn(m, t);
    m.step(dt);
    maxA = Math.max(maxA, m.a); minA = Math.min(minA, m.a);
    maxJ = Math.max(maxJ, Math.abs(m.a - prevA) / dt);
    if (m.v < prevV - 1e-9 && m.a > 0) reverse = true;
    prevA = m.a; prevV = m.v;
  }
  return { maxAccel: +maxA.toFixed(3), maxDecel: +(-minA).toFixed(3), maxJerk: +maxJ.toFixed(2) };
}
function stopTime(m) { // release input, measure time from release to v==0
  m.setHolding(false); let t = 0; let maxDecel = 0, maxJ = 0, prevA = m.a;
  while (m.v > 0 && t < 30) { m.step(dt); t += dt; maxDecel = Math.max(maxDecel, -m.a); maxJ = Math.max(maxJ, Math.abs(m.a - prevA) / dt); prevA = m.a; }
  return { timeToStop: +t.toFixed(2), maxDecel: +maxDecel.toFixed(3), maxJerk: +maxJ.toFixed(2), finalV: m.v };
}
// 1) nothing before input
let m = new SpeedModel(); run(m, 2); res.noInputSpeed = m.v;
// 2) first tap starts the car
m.tap(); run(m, 2); res.afterFirstTapV = +m.v.toFixed(2); res.state = m.state;
// 3) repeated taps (4/s) raise speed up to max
m = new SpeedModel(); let acc = run(m, 8, (mm, t) => { if (Math.abs((t * 4) % 1) < dt * 4 && Math.floor(t * 4) !== (mm._lt ?? -1)) { mm.tap(); mm._lt = Math.floor(t * 4); } });
res.tapsLimit = acc; res.tapSpeedAt8s = +m.v.toFixed(2);
// 4) hold to max, then release
m = new SpeedModel(); m.setHolding(true); acc = run(m, 12); res.holdAccel = acc; res.holdV = +m.v.toFixed(2);
res.stopFromTop = stopTime(m);
// 5) cruise then release: reach CRUISE by holding
m = new SpeedModel(); m.setHolding(true); while (m.v < CFG.CRUISE_SPEED) m.step(dt); m.setHolding(false);
// time measured from release incl. the 1s grace
let t = 0, maxDecel = 0, prevA = m.a, maxJ = 0; while (m.v > 0 && t < 30) { m.step(dt); t += dt; maxDecel = Math.max(maxDecel, -m.a); maxJ = Math.max(maxJ, Math.abs(m.a - prevA) / dt); prevA = m.a; }
res.stopFromCruise = { timeFromRelease: +t.toFixed(2), maxDecel: +maxDecel.toFixed(3), maxJerk: +maxJ.toFixed(2), finalV: m.v };
// 6) restart after stop
m.tap(); acc = run(m, 3); res.restart = { vAfter3s: +m.v.toFixed(2), ...acc };
res.limits = { MAX_SPEED: CFG.MAX_SPEED, ACCEL_TAP: CFG.ACCEL_TAP, ACCEL_HOLD: CFG.ACCEL_HOLD, BRAKE_DECEL: CFG.BRAKE_DECEL, JERK: CFG.JERK };
console.log(JSON.stringify(res, null, 1));
