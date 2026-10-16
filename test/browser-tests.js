// In-browser verification helpers. Load from the page with:
//   const T = await import('/test/browser-tests.js'); await T.cameraMargins(window.__lr);
// All simulations use the fixed 1/120 s step, so results are deterministic and independent of tab throttling.

import { carCorners } from '../src/camera.js';
import { CAR_BOUNDS } from '../src/vehicle.js';

const DT = 1 / 120;

export const VIEWPORTS = [[1280, 720], [1920, 1080], [375, 667], [667, 375], [1024, 768], [2560, 600]];

/** Is the real car geometry (vertex-exact, wheels at rest pose) inside CAR_BOUNDS, the box the camera fit uses? */
export function checkCarBounds(lr) {
  const { game, THREE } = lr;
  const root = game.car.root;
  const saved = { p: root.position.clone(), q: root.quaternion.clone() };
  root.position.set(0, 0, 0); root.quaternion.identity();
  game.car.body.position.set(0, 0, 0); game.car.body.rotation.set(0, 0, 0);
  for (const w of game.car.wheels) { w.pivot.rotation.set(0, 0, 0); w.spin.rotation.set(0, 0, 0); }
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root, true);
  root.position.copy(saved.p); root.quaternion.copy(saved.q);
  const b = CAR_BOUNDS;
  return {
    actual: { x: [+box.min.x.toFixed(3), +box.max.x.toFixed(3)], y: [+box.min.y.toFixed(3), +box.max.y.toFixed(3)], z: [+box.min.z.toFixed(3), +box.max.z.toFixed(3)] },
    fitBox: { halfW: b.halfW, height: b.height, z: [b.zMin, b.zMax] },
    inside: box.max.x <= b.halfW && box.min.x >= -b.halfW && box.max.y <= b.height && box.min.y >= -0.02 && box.max.z <= b.zMax && box.min.z >= b.zMin,
  };
}

/**
 * Drive `laps` laps at max speed (and a mixed speed profile) and record the smallest gap between any
 * car-bbox corner and the screen edge, per viewport. Also reports camera line-of-sight metrics.
 */
export function cameraMargins(lr, { laps = 2, viewports = VIEWPORTS, onlyMax = false } = {}) {
  const { game, THREE, CFG } = lr;
  const { rig, car, speed, route } = game;
  const corners = carCorners();
  const v = new THREE.Vector3();
  const results = [];
  for (const [w, h] of viewports) {
    rig.resize(w, h);
    rig.reset();
    rig.metrics.blockedSteps = 0; rig.metrics.stillBlockedSteps = 0; rig.metrics.steps = 0; rig.metrics.maxLift = 0;
    const profiles = onlyMax ? ['max'] : ['max', 'mixed'];
    for (const prof of profiles) {
      game.s = 0; game.acc = 0; rig.reset();
      speed.v = 0; speed.a = 0; speed.target = 0; speed.idle = 0; speed.state = 'stopped';
      let minPx = Infinity, minAt = 0, minWhere = '', stepCount = 0, minNdc = Infinity;
      const perStage = {};
      const total = Math.ceil(route.L * laps / CFG.MAX_SPEED / DT) + (prof === 'mixed' ? 6000 : 0);
      for (let i = 0; i < total; i++) {
        if (prof === 'max') { speed.setHolding(true); }
        else {
          // 20 s hold, 7 s release (full stop), repeated: exercises start, brake and restart
          const phase = (i * DT) % 27;
          speed.setHolding(phase < 20);
        }
        game.step(DT);
        if (prof === 'mixed' && speed.v === 0 && i % 7 === 0) continue;
        car.root.updateMatrixWorld(true);
        rig.camera.updateMatrixWorld(true);
        for (const c of corners) {
          v.copy(c).applyMatrix4(car.body.matrixWorld).project(rig.camera);
          const mx = (1 - Math.abs(v.x)) * w / 2, my = (1 - Math.abs(v.y)) * h / 2;
          const m = Math.min(mx, my);
          const behind = v.z > 1 ? -1e3 : 0;
          const mm = m + behind;
          const st = route.stageAt(game.s);
          const nd = Math.min(1 - Math.abs(v.x), 1 - Math.abs(v.y));
          if (perStage[st] === undefined || mm < perStage[st]) perStage[st] = mm;
          if (nd < minNdc) minNdc = nd;
          if (mm < minPx) { minPx = mm; minAt = game.s; minWhere = prof; }
        }
        stepCount++;
      }
      results.push({
        viewport: `${w}x${h}`, profile: prof, steps: stepCount,
        minMarginPx: +minPx.toFixed(1), minMarginPct: +(minNdc * 100).toFixed(2), atS: Math.round(minAt),
        stageMinPx: Object.fromEntries(Object.entries(perStage).map(([k, x]) => [k, +x.toFixed(1)])),
        cameraDistance: +rig.distance.toFixed(2),
      });
    }
    results[results.length - 1].los = { ...rig.metrics };
  }
  game.resize();
  rig.reset();
  return results;
}
