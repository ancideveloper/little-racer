// Main-street buildings, street furniture and bunting. All meshes are baked into a few merged
// batches per building (see batch.js); signs are separate textured planes.

import * as THREE from 'three';
import { Batch } from './batch.js';
import { paintedSign, neonSign, icons } from './signs.js';
import { mulberry32, lerp } from './util.js';
import { buildLandmark } from './landmarks.js';

const C = {
  slab: 0xcfc4b4, glassWarm: 0xfff0b0, glassCool: 0x8fd4ea, wood: 0x8a5a34, darkWood: 0x5e3d22, chrome: 0xe8ecf2,
};

/** Awning: striped sloped slab projecting from the wall at height y. */
export function awning(b, w, y, z, colA, colB, proj = 1.9) {
  const n = Math.max(4, Math.round(w / 0.9));
  const sw = w / n;
  for (let i = 0; i < n; i++) {
    b.box(sw * 0.98, 0.1, proj, -w / 2 + sw * (i + 0.5), y, z + proj / 2 - 0.05, i % 2 ? colB : colA, { rx: 0.28 });
  }
  b.box(w, 0.28, 0.1, 0, y - 0.45 - proj * 0.07, z + proj - 0.05, colA);      // valance
}

/** Shop window with frame and a few shelf items. */
export function shopWindow(b, x, y, z, ww, wh, glow = C.glassWarm, frame = 0xffffff) {
  b.box(ww + 0.3, wh + 0.3, 0.12, x, y - 0.15, z, frame);
  b.box(ww, wh, 0.1, x, y, z + 0.05, glow, { kind: 'glow' });
  b.box(0.1, wh, 0.14, x, y, z + 0.06, frame);
  // shelf with colourful goods
  b.box(ww * 0.9, 0.08, 0.5, x, y + wh * 0.35, z + 0.3, 0x7a4e2c);
  const cols = [0xff5a5a, 0x4aa3ff, 0xffd23a, 0x6ad07a, 0xff8ad0];
  for (let i = 0; i < 4; i++) {
    b.box(0.32, 0.38 + (i % 2) * 0.2, 0.3, x - ww * 0.35 + i * (ww * 0.23), y + wh * 0.35 + 0.08, z + 0.3, cols[i % cols.length]);
  }
}

export function door(b, x, z, color = C.wood, w = 1.3, h = 2.5) {
  b.box(w + 0.4, h + 0.3, 0.12, x, 0.25, z, 0xffffff);
  b.box(w, h, 0.14, x, 0.25, z + 0.04, color);
  b.box(w * 0.6, h * 0.45, 0.16, x, 0.25 + h * 0.42, z + 0.05, C.glassWarm, { kind: 'glow' });
  b.sphere(0.08, x + w * 0.36, 0.25 + h * 0.45, z + 0.14, C.chrome, { kind: 'chrome', ao: false });
}

function acUnit(b, x, y, z) {
  b.box(1.1, 0.7, 0.9, x, y, z, 0xb9bec6, { kind: 'metal' });
  b.box(0.9, 0.05, 0.7, x, y + 0.7, z, 0x8a9098, { kind: 'metal' });
}

/** Generic storefront. Front faces +Z. */
function storefront(b, S) {
  const { w, d, h = 4.6, wall, trim = 0xffffff, base } = S;
  b.groundY = 0;
  b.box(w + 0.9, 0.25, d + 0.9, 0, 0, 0, C.slab);
  b.box(w, h, d, 0, 0.25, 0, wall);
  if (base !== undefined) b.box(w + 0.12, 0.95, d + 0.12, 0, 0.25, 0, base);
  // cornice and false-front parapet
  b.box(w + 0.5, 0.32, d + 0.5, 0, 0.25 + h, 0, trim);
  b.box(w + 0.1, 1.3, 0.45, 0, 0.57 + h, d / 2 - 0.1, wall);
  b.box(w + 0.45, 0.22, 0.65, 0, 0.57 + h + 1.3, d / 2 - 0.1, trim);
  // windows + door
  const doorX = S.doorX ?? 0;
  door(b, doorX, d / 2 + 0.02, S.door || C.wood);
  const nWin = Math.max(1, Math.floor((w - 2.6) / 3.6));
  const spanL = -w / 2 + 0.6, spanR = w / 2 - 0.6;
  const slots = [];
  for (let i = 0; i < nWin + 1; i++) {
    const x = lerp(spanL + 1.4, spanR - 1.4, nWin === 0 ? 0.5 : i / Math.max(1, nWin));
    if (Math.abs(x - doorX) > 2.0) slots.push(x);
  }
  slots.forEach((x) => shopWindow(b, x, 1.1, d / 2 + 0.02, 2.4, 1.7, S.glow || C.glassWarm, trim));
  // upper wall ornament and side windows
  for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) {
    b.box(0.1, 1.2, 1.1, sx * (w / 2 + 0.02), 1.6, -d * 0.18 + k * d * 0.4, C.glassCool, { kind: 'glass' });
  }
  awning(b, Math.min(w - 0.6, 9), 3.1, d / 2, S.awnA ?? 0xe8453a, S.awnB ?? 0xfff1d0);
  // roof props
  acUnit(b, -w * 0.25, 0.25 + h + 0.32, -d * 0.2);
  if (S.chimney) b.box(0.8, 2.2, 0.8, w * 0.28, 0.25 + h, -d * 0.2, 0x9a5a44);
  if (S.tank) {
    for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) b.cyl(0.05, 0.05, 1.6, w * 0.25 + dx, 0.25 + h, -d * 0.15 + dz, 0x5a4a3a, { seg: 5 });
    b.cyl(0.9, 0.9, 1.5, w * 0.25, 0.25 + h + 1.6, -d * 0.15, 0x9a7048, { seg: 12 });
    b.cone(1.0, 0.7, w * 0.25, 0.25 + h + 3.1, -d * 0.15, 0x6a4a30, { seg: 12 });
  }
  // wall lantern
  for (const sx of [-1, 1]) b.sphere(0.16, sx * (w / 2 - 0.5), 3.3, d / 2 + 0.25, 0xffe9a0, { kind: 'glow', ao: false });
  // planters with flowers by the entrance
  for (const sx of [-1, 1]) {
    const px = doorX + sx * 1.35;
    b.box(0.7, 0.5, 0.5, px, 0.25, d / 2 + 0.55, 0x8a4a2a);
    b.sphere(0.34, px, 0.9, d / 2 + 0.55, sx > 0 ? 0xff7aa0 : 0xffc84a, { seg: 8 });
  }
}

/** Building definitions for the generic storefronts. */
const STORES = {
  souvenirs: { w: 11, d: 9, wall: 0xf0b050, trim: 0xfff4dc, base: 0xc98232, awnA: 0xd84a3a, awnB: 0xfff1d0, sign: { text: "SUNNY'S", sub: 'souvenirs', bg: '#2a8aa6', icon: 'sun' }, tank: true },
  iceCream: { w: 9, d: 9, wall: 0xffb3cf, trim: 0xffffff, base: 0xff7aa8, awnA: 0xff6a9a, awnB: 0xffffff, sign: { text: 'SCOOP', bg: '#ff6a9a', icon: 'cone' }, scoop: true },
  postOffice: { w: 12, d: 10, wall: 0xb3523a, trim: 0xfff6e8, base: 0x8a3a28, awnA: 0x2a6aa8, awnB: 0xfff1d0, sign: { text: 'POST', bg: '#2a6aa8', icon: 'envelope' }, flag: true },
  barber: { w: 10, d: 9, wall: 0x3aa8a0, trim: 0xffffff, base: 0x1f7a74, awnA: 0xe8453a, awnB: 0xffffff, sign: { text: 'BARBER', bg: '#b0283a', icon: 'scissors' }, pole: true },
  bakery: { w: 11, d: 9, wall: 0xf4dcae, trim: 0x8a4a2a, base: 0xc98a52, awnA: 0xc86a3a, awnB: 0xfff1d0, sign: { text: 'BAKERY', bg: '#8a4a2a', icon: 'bread' }, chimney: true },
  rockCafe: { w: 13, d: 10, wall: 0xb89a7a, trim: 0xfff0d6, base: 0x8a7258, awnA: 0x2a8a6a, awnB: 0xfff1d0, sign: { text: 'ROCK CAFE', bg: '#4a3a2e', icon: 'cup' }, stones: true },
  generalStore: { w: 14, d: 10, wall: 0xc58a58, trim: 0xfff0d6, base: 0x7a4e2c, awnA: 0x3a8ad0, awnB: 0xfff1d0, sign: { text: 'GENERAL STORE', bg: '#3a2a1e' }, barrels: true, doorX: 2.5 },
  hardware: { w: 12, d: 10, wall: 0x5a8ac8, trim: 0xffffff, base: 0x3a5a98, awnA: 0xffc928, awnB: 0x2a2a30, sign: { text: 'HARDWARE', bg: '#e8a020', icon: 'hammer', fg: '#2a2a30' }, ladders: true },
};

function extras(b, key, S) {
  const { w, d } = S;
  if (S.scoop) {                                    // giant ice-cream cone on the roof
    b.cone(1.0, 3.2, 0, 0.25 + 4.6 + 1.5, 0, 0xe0a860, { seg: 14, rx: Math.PI });
    b.sphere(1.25, 0, 0.25 + 4.6 + 3.6, 0, 0xff80b0, { seg: 14 });
    b.sphere(0.95, 0, 0.25 + 4.6 + 4.7, 0, 0xfff0d0, { seg: 14 });
    b.sphere(0.22, 0, 0.25 + 4.6 + 5.6, 0.05, 0xe0283a, { seg: 10 });
  }
  if (S.pole) {                                     // striped barber pole
    for (let i = 0; i < 6; i++) b.cyl(0.22, 0.22, 0.4, w / 2 - 1.2, 0.25 + i * 0.4, d / 2 + 0.7, i % 2 ? 0xffffff : 0xd8283a, { seg: 10 });
    b.sphere(0.26, w / 2 - 1.2, 2.8, d / 2 + 0.7, 0xdfe6f2, { seg: 10, kind: 'chrome' });
  }
  if (S.flag) {
    b.cyl(0.06, 0.08, 6.5, -w / 2 - 1.2, 0, d / 2 - 0.5, 0xdfe6f2, { seg: 6, kind: 'metal' });
    b.box(1.5, 0.9, 0.04, -w / 2 - 0.4, 5.2, d / 2 - 0.5, 0xd8283a);
    b.box(0.6, 0.9, 0.05, -w / 2 - 0.9, 5.2, d / 2 - 0.5, 0x2a4a98);
    // mailbox
    b.box(0.6, 1.0, 0.5, w / 2 + 1.0, 0, d / 2 + 0.8, 0x2a5ac8);
  }
  if (S.barrels) {
    for (let i = 0; i < 3; i++) b.cyl(0.4, 0.4, 0.9, -w / 2 + 1.1 + i * 0.95, 0.25, d / 2 + 0.8, 0x8a5a34, { seg: 10 });
    b.box(1.8, 0.9, 0.9, -w / 2 + 1.6, 0.25, d / 2 + 2.0, 0xc79b5a);
    for (let i = 0; i < 4; i++) b.sphere(0.2, -w / 2 + 1.1 + i * 0.4, 1.35, d / 2 + 2.0, i % 2 ? 0xe8453a : 0xffb02a, { seg: 8 });
  }
  if (S.ladders) {
    for (const sx of [-0.35, 0.35]) b.box(0.08, 3.4, 0.08, w / 2 - 1.3 + sx, 0.25, d / 2 + 0.3, 0xe0a030, { rx: -0.12 });
    for (let i = 0; i < 6; i++) b.box(0.7, 0.05, 0.05, w / 2 - 1.3, 0.8 + i * 0.5, d / 2 + 0.2 - i * 0.03, 0xe0a030);
    for (let i = 0; i < 4; i++) b.cyl(0.22, 0.2, 0.4, -w / 2 + 1 + i * 0.6, 0.25, d / 2 + 0.9, [0xe8453a, 0x2a7ad8, 0xffc928, 0x3aa84a][i], { seg: 8 });
  }
  if (S.stones) {
    for (let i = 0; i < 9; i++) b.sphere(0.5 + (i % 3) * 0.12, -w / 2 + 0.5 + i * (w / 9), 0.7, d / 2 + 0.15, 0x7a6248, { seg: 6, sy: 0.7, sz: 0.5 });
  }
}

function townHall(b) {
  const w = 14, d = 12;
  b.box(w + 1, 0.3, d + 1, 0, 0, 0, C.slab);
  b.box(w, 5.2, d, 0, 0.3, 0, 0xf2ead6);
  b.box(w + 0.6, 0.4, d + 0.6, 0, 5.5, 0, 0xc98a52);
  // clock tower
  b.box(4.2, 5.8, 4.2, 0, 5.9, d * 0.1, 0xf2ead6);
  b.box(4.6, 0.4, 4.6, 0, 11.7, d * 0.1, 0xc98a52);
  b.cone(3.1, 3.6, 0, 12.1, d * 0.1, 0xb0452e, { seg: 4, ry: Math.PI / 4 });
  b.sphere(0.25, 0, 15.9, d * 0.1, 0xffd23a, { seg: 8 });
  // columns and steps
  for (let i = 0; i < 4; i++) b.cyl(0.3, 0.33, 4.6, -3.6 + i * 2.4, 0.3, d / 2 + 1.0, 0xffffff, { seg: 10 });
  b.box(9.4, 0.5, 2.6, 0, 4.9, d / 2 + 0.6, 0xe0d4b8);
  b.box(9.6, 0.4, 3.2, 0, 0.3, d / 2 + 0.8, 0xd8ccb0);
  b.box(10, 0.3, 3.8, 0, 0, d / 2 + 0.8, 0xc8bca0);
  door(b, 0, d / 2 + 0.1, 0x5e3d22, 1.8, 3.2);
  for (const x of [-5, -3.2, 3.2, 5]) shopWindow(b, x, 1.4, d / 2 + 0.05, 1.2, 2.2, C.glassWarm, 0xffffff);
  return { w, d, h: 5.2 };
}

function nursery(b) {
  const w = 14, d = 10;
  b.box(w + 0.8, 0.25, d + 0.8, 0, 0, 0, C.slab);
  // greenhouse: low wall + glass volume + ridged roof
  b.box(w, 1.0, d, 0, 0.25, 0, 0xc9a070);
  b.box(w - 0.2, 2.6, d - 0.2, 0, 1.25, 0, 0xcfeeea, { kind: 'glass' });
  for (let i = 0; i <= 7; i++) b.box(0.12, 2.8, d + 0.1, -w / 2 + 0.1 + i * ((w - 0.2) / 7), 1.2, 0, 0xffffff);
  b.box(w + 0.1, 0.12, 0.12, 0, 3.9, d / 2, 0xffffff);
  b.box(w + 0.1, 0.12, 0.12, 0, 3.9, -d / 2, 0xffffff);
  b.box(w - 0.1, 1.2, d - 0.1, 0, 3.85, 0, 0xcfeeea, { kind: 'glass', rx: 0 });
  b.box(w + 0.2, 0.15, d + 0.2, 0, 5.0, 0, 0xffffff);
  door(b, 0, d / 2 + 0.05, 0xffffff, 1.6, 2.4);
  // plants inside (glow-lit colours) and outside tables of pots
  const rng = mulberry32(8);
  for (let i = 0; i < 14; i++) {
    const x = -w / 2 + 1 + rng() * (w - 2);
    b.sphere(0.45 + rng() * 0.4, x, 1.5 + rng() * 0.6, -d * 0.1 + rng() * 2, [0x3f9a45, 0x4aa850, 0x2f8a40][i % 3], { seg: 8, kind: 'solid' });
  }
  for (let i = 0; i < 6; i++) {
    const x = -w / 2 + 1.2 + i * 2.3;
    b.cyl(0.3, 0.22, 0.4, x, 0.25, d / 2 + 1.0, 0xc86a3a, { seg: 8 });
    b.sphere(0.34, x, 0.9, d / 2 + 1.0, [0xff7aa8, 0xffd23a, 0xb98aff][i % 3], { seg: 8 });
    b.cyl(0.3, 0.22, 0.4, x + 0.6, 0.25, d / 2 + 2.0, 0xc86a3a, { seg: 8 });
    b.cyl(0.14, 0.14, 1.1, x + 0.6, 0.65, d / 2 + 2.0, 0x3f9a45, { seg: 6 });
  }
  return { w, d, h: 5 };
}

function fuelStation(b) {
  const w = 18, d = 14;
  b.box(w + 1, 0.15, d + 1, 0, 0, 0, 0x6a6764);                         // concrete apron
  // kiosk
  b.box(6, 3.4, 4.5, -5.5, 0.15, -d / 2 + 2.6, 0xfff1d0);
  b.box(6.6, 0.4, 5.1, -5.5, 3.55, -d / 2 + 2.6, 0xe8453a);
  shopWindow(b, -5.5, 0.9, -d / 2 + 4.9, 4.2, 1.8, C.glassWarm, 0xffffff);
  // canopy
  for (const [x, z] of [[-4, 1], [4, 1], [-4, 4.5], [4, 4.5]]) b.cyl(0.25, 0.25, 4.9, x + 2, 0.15, z + 0.5, 0xeeeef2, { seg: 10 });
  b.box(11, 0.5, 6.4, 2, 5.05, 3.2, 0xe8453a);
  b.box(11.2, 0.22, 6.6, 2, 5.55, 3.2, 0xffffff);
  b.box(11, 0.14, 6.4, 2, 4.95, 3.2, 0xffffff, { kind: 'glow' });
  // pumps on two islands
  for (const x of [-0.5, 4.5]) {
    b.box(1.2, 0.2, 4.2, x + 1, 0.15, 3.2, 0xb8b4ac);
    for (const dz of [2.4, 4.0]) {
      b.box(0.6, 1.5, 0.5, x + 1, 0.35, dz, 0xe8453a);
      b.box(0.45, 0.5, 0.52, x + 1, 1.0, dz, 0x1a2a38, { kind: 'glass' });
      b.box(0.5, 0.3, 0.52, x + 1, 1.65, dz, 0xffffff);
      b.box(0.1, 0.8, 0.1, x + 1.35, 0.5, dz, 0x2a2a30);
    }
  }
  return { w, d, h: 5.5 };
}

/** Street lamp geometry batch (merged, placed at many positions). */
function addLamp(b, x, y, z, yaw) {
  b.cyl(0.09, 0.13, 4.8, x, y, z, 0x2a3a3a, { seg: 6 });
  b.box(0.3, 0.3, 0.3, x, y, z, 0x2a3a3a);
  // arm curves toward the road
  const ax = Math.sin(yaw), az = Math.cos(yaw);
  b.box(0.08, 0.08, 1.1, x + ax * 0.55, y + 4.75, z + az * 0.55, 0x2a3a3a, { ry: yaw });
  b.sphere(0.26, x + ax * 1.1, y + 4.55, z + az * 1.1, 0xfff0b8, { seg: 10, kind: 'glow', ao: false });
  b.cyl(0.3, 0.1, 0.18, x + ax * 1.1, y + 4.7, z + az * 1.1, 0x2a3a3a, { seg: 8 });
}

export function createTown({ route, layout, terrain, envMap, scene, drivers = [] }) {
  const group = new THREE.Group();
  const signMeshes = [];
  const P = {};
  const colliders = [];

  for (const it of layout) {
    let sizes = { w: it.w, d: it.d };
    let sign = null;
    const spec = STORES[it.id];
    const b = new Batch();
    if (spec) {
      storefront(b, spec);
      extras(b, it.id, spec);
      if (spec.sign) {
        sign = paintedSign({ worldW: Math.min(spec.w - 1.2, 6.2), w: 512, h: 150, round: 20, font: 62, ...spec.sign });
        sign.position.set(0, 0.25 + 4.6 - 0.05 + 0.1, spec.d / 2 + 0.55);
        sign.position.y = 3.95;
        sign.position.z = spec.d / 2 + 0.3;
        // sign sits on top of the parapet band between awning and cornice
      }
    } else if (it.id === 'townHall') {
      townHall(b);
      sign = null;
    } else if (it.id === 'nursery') {
      nursery(b);
      sign = paintedSign({ worldW: 5, w: 512, h: 150, text: 'CACTUS CORNER', bg: '#2f8a40', icon: 'cactus', font: 54 });
      sign.position.set(0, 4.0, it.d / 2 + 0.6);
    } else if (it.id === 'fuelStation') {
      fuelStation(b);
      sign = null;
    } else {
      continue;                                      // landmarks are built in landmarks.js
    }
    const g = b.build(envMap);
    if (sign) { g.add(sign); signMeshes.push(sign); }
    if (it.id === 'townHall') {
      const clock = paintedSign({ worldW: 2.6, w: 256, h: 256, text: '', bg: '#fff6dc', icon: 'clock', font: 10 });
      clock.position.set(0, 8.9, it.d * 0.1 + 2.12);
      g.add(clock);
    }
    if (it.id === 'fuelStation') {
      const s1 = neonSign({ worldW: 3.2, w: 512, h: 192, text: 'FILL-UP', sub: 'gas', color: '#ff5a3a', color2: '#ffd23a', icon: 'gas', font: 72 });
      s1.position.set(0, 6.6, 3.2);
      g.add(s1);
    }
    g.position.set(it.x, it.y, it.z);
    g.rotation.y = it.yaw;
    g.updateMatrixWorld(true);
    group.add(g);
  }

  // landmarks
  const lm = buildLandmark({ route, layout, terrain, envMap, scene, group, colliders });

  // ---- street furniture along the main street ----
  const sb = new Batch();
  sb.groundY = -100;                                   // world batch: no baked AO gradient
  sb.aoStrength = 0;
  const m = route.marks;
  const s0 = m.mainStart - 4, s1 = m.mainEnd + 4;
  let lampIndex = 0;
  for (let s = s0; s <= s1; s += 18) {
    for (const side of [-1, 1]) {
      route.at(s + (side > 0 ? 9 : 0), P);
      const x = P.x + P.rx * side * 5.4, z = P.z + P.rz * side * 5.4;
      const yaw = Math.atan2(-side * P.rx, -side * P.rz);
      addLamp(sb, x, P.y + 0.17, z, yaw);
    }
    lampIndex++;
  }
  // benches, hydrants, mailboxes and trash cans scattered along the sidewalks
  const rng = mulberry32(2024);
  for (let s = s0 + 10; s <= s1 - 10; s += 26) {
    const side = rng() < 0.5 ? -1 : 1;
    route.at(s, P);
    const x = P.x + P.rx * side * 7.2, z = P.z + P.rz * side * 7.2;
    const yaw = Math.atan2(-side * P.rx, -side * P.rz);
    sb.box(1.8, 0.1, 0.5, x, P.y + 0.7, z, 0x8a5a34, { ry: yaw });
    sb.box(1.8, 0.5, 0.08, x - Math.sin(yaw) * 0.22, P.y + 1.0, z - Math.cos(yaw) * 0.22, 0x8a5a34, { ry: yaw });
    for (const dx of [-0.7, 0.7]) sb.box(0.08, 0.7, 0.4, x + Math.cos(yaw) * dx, P.y + 0.17, z - Math.sin(yaw) * dx, 0x2a2a30, { ry: yaw });
    // hydrant
    const hx = P.x + P.rx * side * 5.1 + P.tx * 5, hz = P.z + P.rz * side * 5.1 + P.tz * 5;
    sb.cyl(0.17, 0.2, 0.7, hx, P.y + 0.17, hz, 0xe8453a, { seg: 8 });
    sb.sphere(0.2, hx, P.y + 0.92, hz, 0xe8453a, { seg: 8 });
  }
  group.add(sb.build(envMap));

  // ---- bunting across the street ----
  {
    const bb = new Batch();
    bb.groundY = -100; bb.aoStrength = 0;
    const lines = [];
    const cols = [0xff5a5a, 0xffd23a, 0x4aa3ff, 0x6ad07a, 0xff8ad0, 0xffffff];
    for (let s = m.mainStart + 8; s < m.mainEnd; s += 40) {
      route.at(s, P);
      const ax = P.x - P.rx * 5.4, az = P.z - P.rz * 5.4, bx = P.x + P.rx * 5.4, bz = P.z + P.rz * 5.4;
      const y0 = P.y + 6.6;
      let px = ax, py = y0, pz = az;
      const N = 14;
      for (let k = 1; k <= N; k++) {
        const t = k / N;
        const x = lerp(ax, bx, t), z = lerp(az, bz, t), y = y0 - 0.9 * Math.sin(Math.PI * t);
        lines.push(px, py, pz, x, y, z);
        if (k < N) {
          const g = new THREE.BufferGeometry();
          const mx = (px + x) / 2, my = (py + y) / 2, mz = (pz + z) / 2;
          g.setAttribute('position', new THREE.Float32BufferAttribute([px, py, pz, x, y, z, mx, my - 0.6, mz, x, y, z, px, py, pz, mx, my - 0.6, mz], 3));
          bb.add(g, cols[k % cols.length], null, 'solid', false);
        }
        px = x; py = y; pz = z;
      }
    }
    group.add(bb.build(envMap, { castShadow: false }));
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x5a4636 })));
  }

  scene.add(group);
  return { group, colliders, signs: signMeshes, ...lm };
}
