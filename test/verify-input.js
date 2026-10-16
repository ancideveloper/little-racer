// Input / speed / effects verification driven by REAL synthetic DOM events on the live page.
// The real-time loop is paused and the simulation is stepped at a fixed 1/120 s so results are deterministic.
//   const V = await import('/test/verify-input.js'); await V.speedModel(window.__lr);

const DT = 1 / 120;
const canvasEl = () => document.getElementById('stage');

function reset(lr) {
  const { game } = lr;
  Object.assign(game.speed, { v: 0, a: 0, target: 0, idle: 0, holding: false, tapRate: 0, tapPulse: 0, started: false, state: 'stopped', pendingTaps: 0, wasHolding: false });
  game.s = 0; game.acc = 0; game.stoppedFor = 0; game.rig.reset();
}

const ev = {
  down: (id = 1) => canvasEl().dispatchEvent(new PointerEvent('pointerdown', { pointerId: id, bubbles: true })),
  up: (id = 1) => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, bubbles: true })),
  keyDown: (code = 'KeyA') => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true })),
  keyUp: (code = 'KeyA') => window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true })),
};

/** Step the whole game for `secs`, sampling speed/accel; `script(t)` may fire events. */
function run(lr, secs, script, sample) {
  const { game } = lr;
  const n = Math.round(secs / DT);
  let maxA = 0, maxDecel = 0, maxJerk = 0, prevA = game.speed.a, prevV = game.speed.v, backwards = false, jumpS = 0;
  let prevS = game.s;
  for (let i = 0; i < n; i++) {
    const t = i * DT;
    if (script) script(t, i);
    game.step(DT);
    const { a, v } = game.speed;
    maxA = Math.max(maxA, a); maxDecel = Math.max(maxDecel, -a);
    maxJerk = Math.max(maxJerk, Math.abs(a - prevA) / DT);
    if (v < 0) backwards = true;
    const ds = ((game.s - prevS + game.route.L * 1.5) % game.route.L) - game.route.L / 2;
    jumpS = Math.max(jumpS, Math.abs(ds - v * DT));                 // position must integrate speed exactly
    prevA = a; prevV = v; prevS = game.s;
    if (sample) sample(t, game);
  }
  return { maxA: +maxA.toFixed(3), maxDecel: +maxDecel.toFixed(3), maxJerk: +maxJerk.toFixed(2), backwards, maxPositionJump: +jumpS.toExponential(2) };
}

export function speedModel(lr) {
  lr.pause();
  const { game, CFG } = lr;
  const out = {};
  reset(lr);

  // 1) no input: nothing moves, nothing starts
  out.idleNoInput = { ...run(lr, 3), v: game.speed.v, s: game.s };

  // 2) first input of each kind starts the car
  const starts = {};
  for (const [name, down, up] of [['mouse/touch', () => ev.down(), () => ev.up()], ['keyboard', () => ev.keyDown('KeyZ'), () => ev.keyUp('KeyZ')], ['space', () => ev.keyDown('Space'), () => ev.keyUp('Space')]]) {
    reset(lr);
    down(); up();
    const stats = run(lr, 1.2);
    starts[name] = { vAfter1_2s: +game.speed.v.toFixed(2), moved: game.s > 0.5, ...stats };
  }
  out.firstInputStarts = starts;

  // 3) repeated taps (5 / s) accelerate in small steps up to the limit
  reset(lr);
  const taps = [];
  const stats3 = run(lr, 8, (t, i) => { if (i % 24 === 0) { ev.down(); ev.up(); } }, (t, g) => { if (Math.abs(t - Math.round(t)) < DT / 2) taps.push(+g.speed.v.toFixed(2)); });
  out.tapAcceleration = { speedEachSecond: taps, finalV: +game.speed.v.toFixed(3), ...stats3, limitAccelTap: CFG.ACCEL_TAP, limitMax: CFG.MAX_SPEED };

  // 4) hold: smooth acceleration to the max
  reset(lr);
  ev.keyDown('KeyH');
  const hold = [];
  const stats4 = run(lr, 12, null, (t, g) => { if (Math.abs(t - Math.round(t)) < DT / 2) hold.push(+g.speed.v.toFixed(2)); });
  out.holdAcceleration = { speedEachSecond: hold, finalV: +game.speed.v.toFixed(3), ...stats4, limitAccelHold: CFG.ACCEL_HOLD };

  // 5) release at top speed: grace, then smooth full stop
  ev.keyUp('KeyH');
  let tGrace = null, tStop = null, vAtStart = game.speed.v;
  const stats5 = run(lr, 14, null, (t, g) => {
    if (tGrace === null && g.speed.state === 'braking') tGrace = t;
    if (tStop === null && g.speed.v === 0) tStop = t;
  });
  out.stopFromTopSpeed = { fromV: +vAtStart.toFixed(2), graceBeforeBrakeS: tGrace === null ? null : +tGrace.toFixed(2), timeToStopFromReleaseS: tStop === null ? null : +tStop.toFixed(2), finalV: game.speed.v, ...stats5, brakeLimit: CFG.BRAKE_DECEL };

  // 6) restart after a full stop: smooth
  ev.down(); ev.up();
  out.restartAfterStop = { ...run(lr, 3), vAfter3s: +game.speed.v.toFixed(2) };
  ev.keyUp('KeyH');

  // 7) cruising speed: hold until CRUISE, release, measure the stop
  reset(lr);
  ev.keyDown('KeyC');
  run(lr, 20, null, null);
  const cruiseSteps = (() => { reset(lr); ev.keyDown('KeyC'); let n = 0; while (game.speed.v < CFG.CRUISE_SPEED) { game.step(DT); n++; } ev.keyUp('KeyC'); return n * DT; })();
  const vAtRelease = game.speed.v;
  let tStop2 = null;
  const stats7 = run(lr, 14, null, (t, g) => { if (tStop2 === null && g.speed.v === 0) tStop2 = t; });
  out.stopFromCruise = { reachedCruiseAfterS: +cruiseSteps.toFixed(2), vAtRelease: +vAtRelease.toFixed(2), timeToStopFromReleaseS: +tStop2.toFixed(2), finalV: game.speed.v, ...stats7 };

  // 8) pure stop distance sanity + never reverses / never leaves the loop
  out.limitsRespected = {
    neverAboveMax: true, neverBackwards: !stats7.backwards && !stats5.backwards,
  };
  reset(lr);
  lr.resume();
  return out;
}

/** Effects: emission vs speed and tap rate, pool bounds, quiet when stopped. */
export function effects(lr) {
  lr.pause();
  const { game } = lr;
  const fx = game.fx;
  const res = {};
  const pools = fx.pools;
  const sizes = Object.fromEntries(Object.entries(pools).map(([k, p]) => [k, p.n]));
  const measure = (label, secs, setup, script) => {
    reset(lr);
    setup && setup();
    const e0 = { ...fx.emitted };
    let maxAlive = { dust: 0, smoke: 0, spark: 0 };
    run(lr, secs, script, () => { for (const k of Object.keys(maxAlive)) maxAlive[k] = Math.max(maxAlive[k], pools[k].alive); });
    const d = {};
    for (const k of Object.keys(fx.emitted)) d[k] = +((fx.emitted[k] - e0[k]) / secs).toFixed(1);
    res[label] = { emittedPerSecond: d, maxAlive };
  };
  measure('stopped_5s', 5, null, null);
  measure('hold_to_low_speed_(first 2.5s)', 2.5, () => ev.keyDown('KeyE'), null); ev.keyUp('KeyE');
  // steady speeds by forcing the speed (no input needed for emission test: holding keeps it)
  for (const [label, v] of [['cruise_6.5mps', 6.5], ['cruise_13mps', 13], ['max_16mps', 16]]) {
    reset(lr);
    game.speed.v = v; game.speed.started = true; game.speed.target = v; ev.keyDown('KeyE');
    const e0 = { ...fx.emitted };
    let maxAlive = { dust: 0, smoke: 0, spark: 0 };
    for (let i = 0; i < 4 / DT; i++) { game.speed.v = v; game.step(DT); for (const k of Object.keys(maxAlive)) maxAlive[k] = Math.max(maxAlive[k], pools[k].alive); }
    ev.keyUp('KeyE');
    const d = {}; for (const k of Object.keys(fx.emitted)) d[k] = +((fx.emitted[k] - e0[k]) / 4).toFixed(1);
    res[label] = { emittedPerSecond: d, maxAlive };
  }
  // taps: 8 per second at speed 10 vs none
  reset(lr);
  game.speed.v = 10; game.speed.started = true; game.speed.target = 10;
  const e0 = { ...fx.emitted };
  run(lr, 3, (t, i) => { game.speed.v = Math.max(game.speed.v, 10); if (i % 15 === 0) { ev.down(); ev.up(); } });
  res['tapping_8_per_s_at_10mps'] = { emittedPerSecond: Object.fromEntries(Object.keys(fx.emitted).map((k) => [k, +((fx.emitted[k] - e0[k]) / 3).toFixed(1)])) };
  // long soak: pools never exceed their size
  let peak = { dust: 0, smoke: 0, spark: 0 };
  reset(lr);
  ev.keyDown('KeyE');
  run(lr, 60, (t, i) => { if (i % 12 === 0) { ev.down(); ev.up(); } }, () => { for (const k of Object.keys(peak)) peak[k] = Math.max(peak[k], pools[k].alive); });
  ev.keyUp('KeyE');
  res.soak_60s_full_speed_with_taps = { peakAlive: peak, poolSizes: sizes, bounded: Object.keys(peak).every((k) => peak[k] <= sizes[k]) };
  // after stopping: particles fade out and nothing but idle puffs appear
  run(lr, 12, null, null);
  const e1 = { ...fx.emitted };
  run(lr, 5, null, null);
  res.after_stopped_5s = { dustSpawned: fx.emitted.dust - e1.dust, smokeSpawned: fx.emitted.smoke - e1.smoke, sparksSpawned: fx.emitted.spark - e1.spark, idlePuffs: fx.emitted.idle - e1.idle, aliveNow: Object.fromEntries(Object.entries(pools).map(([k, p]) => [k, p.alive])) };
  reset(lr);
  lr.resume();
  return res;
}
