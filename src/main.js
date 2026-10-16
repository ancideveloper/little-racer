// Bootstrap: builds the world, owns the game loop, and exposes a small test hook (window.__lr).

import * as THREE from 'three';
import { CFG } from './config.js';
import { wrap } from './util.js';
import { buildRoute } from './route.js';
import { createSky } from './sky.js';
import { createTerrain } from './terrain.js';
import { createRoad } from './road.js';
import { createVehicle } from './vehicle.js';
import { createCameraRig } from './camera.js';
import { SpeedModel } from './speed.js';
import { createInput } from './input.js';
import { createUI } from './ui.js';
import { buildLayout, layoutPads, layoutZones } from './layout.js';
import { createScenery } from './scenery.js';
import { createStructures } from './structures.js';
import { createTown } from './buildings.js';
import { createCharacters } from './characters.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';

const canvas = document.getElementById('stage');
const isPhone = Math.min(screen.width, screen.height) < 700 || /Android|iPhone|iPad/i.test(navigator.userAgent);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isPhone, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const maxDpr = isPhone ? 1.5 : 2;

const scene = new THREE.Scene();
const t0 = performance.now();
const route = buildRoute();
const sky = createSky(scene, renderer, { shadowSize: isPhone ? 1024 : 2048 });
const layout = buildLayout(route);
const terrain = createTerrain(route, layoutPads(layout));
scene.add(terrain.mesh, terrain.far);
const road = createRoad(route);
scene.add(road.group);
const colliders = [];                      // static occluders for the camera line-of-sight check
const structures = createStructures({ route, terrain, envMap: sky.envMap });
scene.add(structures.group);
colliders.push(...structures.colliders);
const town = createTown({ route, layout, terrain, envMap: sky.envMap, scene });
colliders.push(...town.colliders);
const scenery = createScenery({ route, terrain, zones: layoutZones(layout), scene, envMap: sky.envMap });
const car = createVehicle(sky.envMap);
scene.add(car.root);
const audio = createAudio();
let fx = null;
const characters = createCharacters({ route, terrain, anchors: town.anchors, layout, envMap: sky.envMap, scene, onReact: (c, i) => { fx && fx.cheer(c.root.position); audio.carHorn(i, Math.hypot(c.root.position.x - car.root.position.x, c.root.position.z - car.root.position.z)); } });
fx = createEffects(scene, car);
// A warm light that rides with the car inside the tunnel (the sun and sky cannot reach in there).
const tunnelLight = new THREE.PointLight(0xffd9a0, 0, 26, 1.6);
scene.add(tunnelLight);
const rig = createCameraRig();
const speed = new SpeedModel();
const ui = createUI();
const buildMs = performance.now() - t0;

const game = {
  route, speed, car, rig, sky, terrain, road, scene, renderer, colliders, buildMs, layout, scenery, structures, town, characters, fx,
  s: 0,
  acc: 0,
  stoppedFor: 0,
  audio,
  hooks: [(dt) => scenery.update(dt),
    (dt, g) => {
      const d = Math.abs(route.arcDelta(g.s, route.tunnel.s)) - route.tunnel.half;
      const k = 1 - Math.min(1, Math.max(0, d / 16));
      tunnelLight.intensity = 95 * k;
      tunnelLight.position.set(g.car.root.position.x, g.car.root.position.y + 6.6, g.car.root.position.z);
    }, (dt, g) => characters.update(dt, g.car.root.position, g.speed.v), (dt, g) => audio.update(dt, g), (dt, g) => fx.update(dt, g.speed.v, g.speed.tapRate, g.rig.camera, g.renderer.domElement.height)],   // per-frame systems: fn(dt, game)
  onTapHandlers: [() => characters.reactNearest(car.root.position), () => fx.tapBurst(speed.v), () => audio.tap(speed.v, speed.tapRate)],

  /** Advance the whole game by dt seconds (fixed 1/120 s sub-steps for the speed model). */
  step(dt) {
    dt = Math.min(dt, CFG.MAX_FRAME_DT);
    game.acc += dt;
    let guard = 0;
    while (game.acc >= CFG.SIM_DT - 1e-9 && guard++ < 24) {
      speed.step(CFG.SIM_DT);
      game.s = wrap(game.s + speed.v * CFG.SIM_DT, route.L);
      game.acc -= CFG.SIM_DT;
    }
    const stopped = speed.v === 0;
    game.stoppedFor = stopped ? game.stoppedFor + dt : 0;
    car.update(dt, route, game.s, speed.v, speed.a, speed.tapPulse, stopped);
    rig.update(dt, route, game.s, car, speed.v, colliders, speed.started);
    sky.update(dt, car.root.position, rig.camera.position);
    for (const h of game.hooks) h(dt, game);
    ui.update(car, rig.camera, stopped, game.stoppedFor);
  },

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    if (w < 2 || h < 2) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(w, h, false);
    rig.resize(w, h);
  },

  debugCam: null,                          // optional override camera for screenshots
  render() { renderer.render(scene, game.debugCam || rig.camera); },
};

createInput(canvas, {
  onTap: () => { speed.tap(); car.kick(0.35); ui.onFirstInput(); game.onTapHandlers.forEach((h) => h(game)); },
  onHold: (h) => speed.setHolding(h),
  onGesture: (kind) => { if (game.audio) game.audio.unlock(kind); },
});

window.addEventListener('resize', game.resize);
game.resize();
game.step(0.0001);

// Stats for the hidden-tab-safe performance report.
const perf = { frames: 0, last: performance.now(), fps: 0 };
let prev = performance.now();
const frame = (now) => {
  const dt = Math.min((now - prev) / 1000, CFG.MAX_FRAME_DT);
  prev = now;
  game.step(dt);
  game.render();
  perf.frames++;
  if (now - perf.last > 1000) { perf.fps = perf.frames * 1000 / (now - perf.last); perf.frames = 0; perf.last = now; }
};
renderer.setAnimationLoop(frame);
/** Test hooks: stop / restart the real-time loop so verification can step the simulation deterministically. */
const pause = () => renderer.setAnimationLoop(null);
const resume = () => { prev = performance.now(); renderer.setAnimationLoop(frame); };

/** Test/screenshot helper: park the car at arc position s and settle the camera. */
function goto(s, sec = 0.6) {
  game.s = wrap(s, route.L);
  rig.reset();
  for (let i = 0; i < sec * 60; i++) game.step(1 / 60);
}

/** Screenshot helper: orbit camera around a layout item (by id), a = azimuth offset (rad), d = distance. */
function view(id, d = 34, a = 0.5, h = 9, lookH = 3) {
  const it = game.layout.find((i) => i.id === id);
  const cam = game.debugCam || (game.debugCam = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.3, 3000));
  cam.aspect = window.innerWidth / window.innerHeight; cam.updateProjectionMatrix();
  const ang = it.yaw + a;
  cam.position.set(it.x + Math.sin(ang) * d, it.y + h, it.z + Math.cos(ang) * d);
  cam.lookAt(it.x, it.y + lookH, it.z);
  game.s = wrap(it.s, route.L); game.step(0.01);
}

window.__lr = { game, THREE, perf, CFG, goto, view, pause, resume };
