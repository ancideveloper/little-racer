// The friends: original car characters with windshield eyes, smiling bumpers, spinning wheels,
// blinking, idle bobbing and little reactions (shimmy, cheer, hop, nod, jump) when the hero passes.
// Each cast member has its own silhouette and palette; none copies any existing character design.

import * as THREE from 'three';
import { Batch } from './batch.js';
import { extrudeProfile } from './vehicle.js';
import { clamp, lerp, mulberry32 } from './util.js';

// ---------- shape helpers ----------

/** Chaikin corner cutting on a closed polygon: turns a few points into a smooth cartoon silhouette. */
function chaikin(pts, iters) {
  let p = pts;
  for (let k = 0; k < iters; k++) {
    const out = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = out;
  }
  return p;
}

function profile(pts, iters = 2) {
  const s = new THREE.Shape();
  chaikin(pts, iters).forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
  s.closePath();
  return s;
}

function body(b, pts, width, bevel, color, iters = 2) {
  const g = extrudeProfile(profile(pts, iters), width, bevel);
  b.add(g, color, null, 'solid', true);
}

/** Glass slab lying on a slope from A to B (z,y pairs), outward normal facing forward/up. */
function glassSlab(b, A, B, width, color = 0x173a5a, shrink = 0.8) {
  const dz = B[0] - A[0], dy = B[1] - A[1];
  const len = Math.hypot(dz, dy);
  let nz = -dy / len, ny = dz / len;
  if (ny < 0) { nz = -nz; ny = -ny; }
  const mx = (A[0] + B[0]) / 2 + nz * 0.02, my = (A[1] + B[1]) / 2 + ny * 0.02;
  const m = new THREE.Matrix4().compose(new THREE.Vector3(0, my, mx), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.atan2(ny, nz), 0, 0)), new THREE.Vector3(1, 1, 1));
  b.add(new THREE.BoxGeometry(width, len * shrink, 0.05), color, m, 'glass', false);
}

function sideGlass(b, pts, x, color = 0x173a5a) {
  const sh = new THREE.Shape();
  pts.forEach(([z, y], i) => (i ? sh.lineTo(z, y) : sh.moveTo(z, y)));
  sh.closePath();
  for (const sgn of [-1, 1]) {
    const m = new THREE.Matrix4().makeRotationY(-Math.PI / 2);   // shape x -> car Z; glass material is double-sided
    m.setPosition(sgn * x, 0, 0);
    b.add(new THREE.ShapeGeometry(sh), color, m, 'glass', false);
  }
}

// ---------- cast specs ----------
// Local axes: +Z forward, +Y up, +X left. Dimensions in metres.

const SPECS = {
  // Rusty: a rusty-teal tow truck with a crane boom and a gap-toothed grin.
  rusty: {
    name: 'rusty', paint: 0x6f9a8e, width: 2.1, wheels: { r: 0.58, w: 0.42, x: 1.0, zf: 1.45, zr: -1.6 },
    wheelColor: 0xd7c8a0, eyes: { x: 0.45, y: 2.12, z: 0.82, r: 0.36 }, mouth: { y: 0.62, z: 2.42, w: 0.7, curve: 0.12, color: 0x2a1a14 },
    build(b) {
      const rust = 0xb5642f, teal = 0x6f9a8e, grey = 0x77808a;
      body(b, [[-0.5, 0.55], [2.2, 0.55], [2.4, 0.95], [2.2, 1.35], [1.1, 1.45], [0.9, 2.15], [0.6, 2.4], [-0.2, 2.4], [-0.55, 2.0]], 2.1, 0.22, teal, 1);
      glassSlab(b, [1.05, 1.45], [0.8, 2.2], 1.3, 0x173a4a);
      body(b, [[-3.3, 0.65], [-0.55, 0.65], [-0.55, 1.05], [-3.3, 1.05]], 2.1, 0.12, grey, 0);
      body(b, [[-3.3, 1.05], [-3.3, 1.65], [-3.1, 1.65], [-3.1, 1.05]], 2.1, 0.05, grey, 0);
      // rusty patches
      b.box(0.9, 0.5, 0.05, 1.05, 0.9, 1.0, rust, { rx: 0 });
      b.box(0.05, 0.6, 0.9, 1.06, 1.0, 1.4, rust);
      b.box(0.05, 0.6, 0.9, -1.06, 1.0, 1.6, rust);
      // crane boom + hook (static part of the body)
      b.box(0.3, 2.6, 0.3, 0.0, 1.0, -1.7, 0xe0a020, { rx: -0.5 });
      b.box(0.3, 1.6, 0.3, 0.0, 2.5, -2.4, 0xe0a020, { rx: 0.9 });
      for (let i = 0; i < 5; i++) b.torus(0.07, 0.025, 0, 2.4 - i * 0.22, -2.88, 0x3a3a40, { ry: (i % 2) * Math.PI / 2, tseg: 5, seg: 8 });
      b.torus(0.2, 0.05, 0, 1.2, -2.9, 0xdfe6f2, { arc: Math.PI * 1.4, kind: 'metal' });
      // bumpers and beacon
      b.box(2.2, 0.3, 0.35, 0, 0.35, 2.4, 0xcfd4dc, { kind: 'chrome' });
      b.box(2.0, 0.3, 0.3, 0, 0.35, -3.35, 0xcfd4dc, { kind: 'chrome' });
      b.sphere(0.18, 0, 2.55, 0.2, 0xffa020, { kind: 'glow', ao: false });
      for (const sx of [-0.7, 0.7]) b.sphere(0.2, sx, 0.95, 2.35, 0xfff0b8, { kind: 'glow', ao: false });
      // tool box on the bed
      b.box(0.9, 0.5, 0.6, -0.55, 1.05, -1.3, 0xb83a2a);
    },
  },

  // Bluebell: a sky-blue convertible with a cream interior and a flower on the dash.
  bluebell: {
    name: 'bluebell', paint: 0x5ab4ec, width: 1.95, wheels: { r: 0.42, w: 0.34, x: 0.9, zf: 1.35, zr: -1.3 },
    wheelColor: 0xf4f6fa, eyes: { x: 0.36, y: 1.38, z: 0.66, r: 0.3 }, mouth: { y: 0.5, z: 2.12, w: 0.55, curve: 0.14, color: 0x2a1a3a },
    build(b) {
      body(b, [[-2.1, 0.35], [1.95, 0.35], [2.15, 0.65], [1.8, 0.95], [0.9, 1.0], [0.55, 1.05], [-0.3, 1.0], [-1.4, 1.05], [-2.15, 0.9]], 1.95, 0.22, 0x5ab4ec, 2);
      b.box(1.5, 0.12, 2.6, 0, 0.9, -0.5, 0xfff1d0);                      // cream seat band
      b.box(0.5, 0.6, 0.5, 0.45, 0.95, -0.9, 0xfff1d0);                   // seat backs
      b.box(0.5, 0.6, 0.5, -0.45, 0.95, -0.9, 0xfff1d0);
      b.box(1.7, 0.06, 0.1, 0, 1.55, 0.55, 0xf4f6fa, { rx: -0.35, kind: 'chrome' });   // windshield frame
      glassSlab(b, [0.7, 1.0], [0.45, 1.45], 1.5, 0x4a90b8, 0.9);
      b.box(0.12, 0.06, 2.6, 0, 1.1, 0, 0xf4f6fa);                         // racing stripe hint
      b.sphere(0.12, 0.3, 1.2, 0.95, 0xff6fa8, { seg: 8 });                // flower on the dash
      b.box(2.0, 0.28, 0.3, 0, 0.35, 2.15, 0xf4f6fa, { kind: 'chrome' });
      for (const sx of [-0.65, 0.65]) b.sphere(0.17, sx, 0.78, 2.1, 0xfff6d8, { kind: 'glow', ao: false });
      for (const sx of [-0.65, 0.65]) b.sphere(0.12, sx, 0.8, -2.1, 0xff3a3a, { kind: 'glow', ao: false });
    },
  },

  // Gus: a wise old navy coupe with round fenders and a bushy white moustache.
  gus: {
    name: 'gus', paint: 0x2f4a7a, width: 2.0, wheels: { r: 0.46, w: 0.36, x: 0.92, zf: 1.4, zr: -1.45 },
    wheelColor: 0xe8e4d8, eyes: { x: 0.4, y: 1.95, z: 0.5, r: 0.31 }, mouth: { y: 0.52, z: 2.3, w: 0.5, curve: 0.08, color: 0x1a1a22 },
    build(b) {
      body(b, [[-2.2, 0.4], [2.0, 0.4], [2.25, 0.75], [1.8, 1.15], [1.0, 1.25], [0.75, 1.95], [-0.2, 2.15], [-1.1, 1.9], [-1.7, 1.3], [-2.25, 0.95]], 2.0, 0.25, 0x2f4a7a, 2);
      glassSlab(b, [0.95, 1.25], [0.7, 1.95], 1.35, 0x1b3350);
      sideGlass(b, [[0.45, 1.45], [0.28, 1.88], [-0.45, 1.95], [-1.1, 1.6], [-1.3, 1.4]], 0.86, 0x1b3350);
      // chrome grille, fenders, and a bushy moustache of white tufts
      b.box(1.3, 0.55, 0.12, 0, 0.62, 2.3, 0xe8ecf2, { kind: 'chrome' });
      for (let i = 0; i < 6; i++) b.box(0.05, 0.5, 0.06, -0.5 + i * 0.2, 0.62, 2.38, 0x6a7280, { kind: 'metal' });
      for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) b.sphere(0.13 - k * 0.02, sx * (0.3 + k * 0.22), 0.28 - k * 0.03, 2.38, 0xffffff, { seg: 6, sx: 1.6 });
      for (const sx of [-0.78, 0.78]) b.sphere(0.2, sx, 0.88, 2.0, 0xfff6d8, { kind: 'glow', ao: false });
      b.box(2.1, 0.22, 0.28, 0, 0.3, 2.28, 0xcfd4dc, { kind: 'chrome' });
      b.box(2.0, 0.08, 0.5, 0, 2.0, -0.4, 0xdfe6f2, { kind: 'chrome' });   // tiny roof trim
      // wise-old-car eyebrows (tufty white)
      for (const sx of [-1, 1]) b.box(0.55, 0.12, 0.18, sx * 0.4, 2.42, 0.38, 0xf4f6fa, { rz: sx * 0.2, rx: -0.5 });
    },
  },

  // Tilly: a tiny round yellow bubble car (one of the tyre-shop twins) with a stacked-tyre hat.
  tilly: {
    name: 'tilly', paint: 0xffd23a, width: 1.7, wheels: { r: 0.36, w: 0.3, x: 0.78, zf: 0.95, zr: -0.95 },
    wheelColor: 0x3c3c44, eyes: { x: 0.32, y: 1.48, z: 0.55, r: 0.3 }, mouth: { y: 0.5, z: 1.55, w: 0.45, curve: 0.14, color: 0x6a2a1a },
    build(b) {
      body(b, [[-1.5, 0.3], [1.4, 0.3], [1.6, 0.7], [1.3, 1.0], [0.75, 1.2], [0.55, 1.65], [-0.3, 1.75], [-1.2, 1.4], [-1.65, 0.9]], 1.7, 0.3, 0xffd23a, 2);
      glassSlab(b, [0.7, 1.2], [0.52, 1.62], 1.1, 0x1c4a6a);
      b.torus(0.32, 0.12, 0, 1.9, -0.45, 0x2c2c33, { rx: Math.PI / 2, tseg: 8, seg: 16 });    // hat: tyre
      b.torus(0.32, 0.12, 0, 2.05, -0.45, 0x2c2c33, { rx: Math.PI / 2, tseg: 8, seg: 16 });
      b.box(1.8, 0.14, 0.1, 0, 0.62, 1.55, 0x2c2c33);
      for (const sx of [-0.5, 0.5]) b.sphere(0.14, sx, 0.78, 1.5, 0xfff6d8, { kind: 'glow', ao: false });
    },
  },

  // Tommy: the orange twin with a wrench antenna.
  tommy: {
    name: 'tommy', paint: 0xff8a3a, width: 1.7, wheels: { r: 0.36, w: 0.3, x: 0.78, zf: 0.95, zr: -0.95 },
    wheelColor: 0x3c3c44, eyes: { x: 0.32, y: 1.48, z: 0.55, r: 0.3 }, mouth: { y: 0.5, z: 1.55, w: 0.45, curve: 0.14, color: 0x6a2a1a },
    build(b) {
      body(b, [[-1.5, 0.3], [1.4, 0.3], [1.6, 0.7], [1.3, 1.0], [0.75, 1.2], [0.55, 1.65], [-0.3, 1.75], [-1.2, 1.4], [-1.65, 0.9]], 1.7, 0.3, 0xff8a3a, 2);
      glassSlab(b, [0.7, 1.2], [0.52, 1.62], 1.1, 0x1c4a6a);
      b.cyl(0.03, 0.03, 0.9, 0.5, 1.7, -0.9, 0xcfd4dc, { seg: 5, kind: 'metal' });
      b.box(0.3, 0.12, 0.08, 0.5, 2.6, -0.9, 0xcfd4dc, { kind: 'metal' });
      b.box(1.8, 0.14, 0.1, 0, 0.62, 1.55, 0x2c2c33);
      for (const sx of [-0.5, 0.5]) b.sphere(0.14, sx, 0.78, 1.5, 0xfff6d8, { kind: 'glow', ao: false });
    },
  },

  // Dazzle: a long magenta lowrider with a flame decal, gold rims and hydraulic hops.
  dazzle: {
    name: 'dazzle', paint: 0xb0307a, width: 2.0, wheels: { r: 0.38, w: 0.32, x: 0.92, zf: 1.55, zr: -1.6 }, lowrider: true,
    wheelColor: 0xffd24a, eyes: { x: 0.38, y: 1.5, z: 0.5, r: 0.3 }, mouth: { y: 0.42, z: 2.5, w: 0.6, curve: 0.1, color: 0x2a0a1a },
    build(b) {
      body(b, [[-2.4, 0.22], [2.3, 0.22], [2.5, 0.5], [2.1, 0.78], [1.0, 0.92], [0.7, 1.3], [-0.5, 1.38], [-1.5, 1.0], [-2.45, 0.82]], 2.0, 0.22, 0xb0307a, 2);
      glassSlab(b, [1.0, 0.92], [0.72, 1.3], 1.3, 0x2a1a4a);
      sideGlass(b, [[0.5, 1.0], [0.3, 1.28], [-0.5, 1.33], [-1.25, 1.0]], 0.88, 0x2a1a4a);
      // flame stripes along the sides (tapering triangles) in gold and orange
      for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) {
        b.box(0.04, 0.28 - k * 0.03, 0.65, sx * 1.0, 0.45, 1.7 - k * 0.55, k % 2 ? 0xffd24a : 0xff8a3a, { rx: 0.0 });
      }
      b.box(2.1, 0.2, 0.28, 0, 0.22, 2.45, 0xffd24a, { kind: 'chrome' });
      b.box(1.7, 0.06, 0.08, 0, 1.4, -0.6, 0xffd24a, { kind: 'chrome' });
      for (const sx of [-0.75, 0.75]) b.sphere(0.15, sx, 0.62, 2.35, 0xfff6d8, { kind: 'glow', ao: false });
      b.cyl(0.02, 0.02, 1.2, -0.7, 1.35, -1.55, 0xdfe6f2, { seg: 4, kind: 'metal' });         // antenna
      b.sphere(0.07, -0.7, 2.58, -1.55, 0xff6fa8, { seg: 6 });
    },
  },

  // Rosie: a cream-and-pink station wagon with a roof tray and a paper diner hat.
  rosie: {
    name: 'rosie', paint: 0xff9ec2, width: 2.05, wheels: { r: 0.45, w: 0.36, x: 0.95, zf: 1.55, zr: -1.55 },
    wheelColor: 0xfff6e4, eyes: { x: 0.4, y: 1.82, z: 0.7, r: 0.32 }, mouth: { y: 0.55, z: 2.45, w: 0.6, curve: 0.13, color: 0x7a1a3a },
    build(b) {
      body(b, [[-2.4, 0.4], [2.3, 0.4], [2.5, 0.8], [2.1, 1.1], [1.2, 1.2], [0.95, 1.85], [-2.0, 1.95], [-2.45, 1.6]], 2.05, 0.24, 0xff9ec2, 1);
      b.box(2.12, 0.42, 3.4, 0, 0.7, -0.5, 0xfff1d0);                      // cream side panel
      glassSlab(b, [1.15, 1.2], [0.95, 1.85], 1.4, 0x2a3a58);
      sideGlass(b, [[0.7, 1.35], [0.55, 1.8], [-1.9, 1.88], [-2.05, 1.4]], 0.9, 0x2a3a58);
      // roof rack with a tray of cupcakes
      b.box(2.0, 0.06, 2.4, 0, 2.0, -0.7, 0xdfe6f2, { kind: 'metal' });
      for (const sx of [-0.9, 0.9]) b.box(0.05, 0.2, 2.4, sx, 2.0, -0.7, 0xdfe6f2, { kind: 'metal' });
      for (let i = 0; i < 4; i++) {
        b.cyl(0.14, 0.1, 0.18, -0.5 + (i % 2) * 0.6, 2.08, -0.2 - Math.floor(i / 2) * 0.55 - 0.3, 0xfff1d0, { seg: 8 });
        b.sphere(0.15, -0.5 + (i % 2) * 0.6, 2.32, -0.5 - Math.floor(i / 2) * 0.55, i % 2 ? 0xff6fa8 : 0x7ae0d4, { seg: 8 });
      }
      // paper diner hat
      b.cyl(0.38, 0.32, 0.38, 0, 2.52 - 0.5, 0.0, 0xffffff, { seg: 10 });
      b.sphere(0.34, 0, 2.5, 0, 0xffffff, { seg: 10, sy: 0.6 });
      b.box(2.15, 0.28, 0.3, 0, 0.38, 2.45, 0xfff6e4, { kind: 'chrome' });
      for (const sx of [-0.78, 0.78]) b.sphere(0.17, sx, 0.85, 2.3, 0xfff6d8, { kind: 'glow', ao: false });
    },
  },
};

// A few generic bodies for the cars parked in lots (no big personality, but they blink and smile too).
const PARKED = [
  { paint: 0x4aa86a, k: 'sedan' }, { paint: 0xe8a23a, k: 'hatch' }, { paint: 0xb8c4d8, k: 'sedan' },
  { paint: 0xd8504a, k: 'hatch' }, { paint: 0x7a64c8, k: 'sedan' }, { paint: 0x3ab8b0, k: 'hatch' },
];

function parkedSpec(p) {
  const long = p.k === 'sedan';
  return {
    name: 'parked', paint: p.paint, width: 1.9, wheels: { r: 0.4, w: 0.32, x: 0.88, zf: long ? 1.35 : 1.2, zr: long ? -1.35 : -1.15 },
    wheelColor: 0xdfe3ea, eyes: { x: 0.36, y: long ? 1.55 : 1.5, z: 0.6, r: 0.29 }, mouth: { y: 0.46, z: long ? 2.2 : 2.0, w: 0.5, curve: 0.12, color: 0x2a1a1a },
    build(b) {
      if (long) {
        body(b, [[-2.2, 0.35], [2.0, 0.35], [2.2, 0.7], [1.8, 1.0], [0.9, 1.08], [0.65, 1.55], [-0.5, 1.6], [-1.4, 1.12], [-2.25, 1.0]], 1.9, 0.22, p.paint, 2);
        glassSlab(b, [0.85, 1.08], [0.62, 1.52], 1.3, 0x1b3a58);
        sideGlass(b, [[0.4, 1.2], [0.25, 1.5], [-0.45, 1.52], [-1.15, 1.2]], 0.84, 0x1b3a58);
      } else {
        body(b, [[-1.9, 0.35], [1.75, 0.35], [1.95, 0.7], [1.6, 1.0], [0.8, 1.08], [0.6, 1.62], [-1.2, 1.65], [-1.95, 1.2]], 1.9, 0.24, p.paint, 2);
        glassSlab(b, [0.75, 1.08], [0.58, 1.58], 1.3, 0x1b3a58);
        sideGlass(b, [[0.35, 1.2], [0.2, 1.55], [-1.1, 1.58], [-1.6, 1.25]], 0.84, 0x1b3a58);
      }
      b.box(2.0, 0.24, 0.26, 0, 0.35, long ? 2.2 : 1.95, 0xdfe6f2, { kind: 'chrome' });
      for (const sx of [-0.65, 0.65]) b.sphere(0.15, sx, 0.78, long ? 2.1 : 1.85, 0xfff6d8, { kind: 'glow', ao: false });
    },
  };
}

// ---------- shared meshes ----------

const wheelCache = new Map();
function wheelGeometry(r, w, rimColor) {
  const key = `${r}|${w}|${rimColor}`;
  if (wheelCache.has(key)) return wheelCache.get(key);
  const b = new Batch();
  b.aoStrength = 0;
  b.add(new THREE.CylinderGeometry(r, r, w, 20).rotateZ(Math.PI / 2), 0x222226, null, 'solid', false);
  b.add(new THREE.CylinderGeometry(r * 0.62, r * 0.62, w + 0.02, 16).rotateZ(Math.PI / 2), rimColor, null, 'solid', false);
  b.add(new THREE.CylinderGeometry(r * 0.2, r * 0.2, w + 0.06, 8).rotateZ(Math.PI / 2), 0xffc928, null, 'solid', false);
  for (let k = 0; k < 3; k++) b.add(new THREE.BoxGeometry(w + 0.04, r * 0.1, r * 1.15).rotateX(k * Math.PI / 3), rimColor, null, 'solid', false);
  const g = b.geometry();
  wheelCache.set(key, g);
  return g;
}

const eyeCache = new Map();
function eyeGeometries(r) {
  if (eyeCache.has(r)) return eyeCache.get(r);
  const bb = new Batch(); bb.aoStrength = 0;
  bb.add(new THREE.SphereGeometry(r, 18, 12), 0xffffff, null, 'solid', false);
  const white = bb.geometry();
  const ip = new Batch(); ip.aoStrength = 0;
  const iris = new THREE.SphereGeometry(r * 0.58, 14, 10); iris.scale(1, 1, 0.5); iris.translate(0, 0, r * 0.9);
  const pupil = new THREE.SphereGeometry(r * 0.3, 10, 8); pupil.scale(1, 1, 0.5); pupil.translate(0, 0, r * 1.0);
  const glint = new THREE.SphereGeometry(r * 0.1, 8, 6); glint.translate(r * 0.15, r * 0.2, r * 1.08);
  ip.add(iris, 0x3a8ed8, null, 'solid', false);
  ip.add(pupil, 0x15151a, null, 'solid', false);
  ip.add(glint, 0xffffff, null, 'glow', false);
  const irisGeo = ip.geometry('solid');
  const glintGeo = ip.geometry('glow');
  const lidGeo = new THREE.SphereGeometry(r * 1.06, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2);
  const out = { white, irisGeo, glintGeo, lidGeo };
  eyeCache.set(r, out);
  return out;
}

const eyeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25 });
const glintMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
const wheelMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 });

function makeCar(spec, envMap) {
  const root = new THREE.Group();
  const bodyG = new THREE.Group();
  root.add(bodyG);
  const b = new Batch();
  b.aoStrength = 0.28;
  spec.build(b);
  bodyG.add(b.build(envMap));

  const paintMat = new THREE.MeshPhysicalMaterial({ color: spec.paint, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.15 });

  // wheels
  const W = spec.wheels;
  const wg = wheelGeometry(W.r, W.w, spec.wheelColor);
  const wheels = [];
  for (const [sx, zz, front] of [[1, W.zf, true], [-1, W.zf, true], [1, W.zr, false], [-1, W.zr, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * W.x, W.r, zz);
    const spin = new THREE.Group();
    const m = new THREE.Mesh(wg, wheelMat);
    m.castShadow = true;
    spin.add(m);
    pivot.add(spin);
    root.add(pivot);
    wheels.push({ pivot, spin, front });
  }

  // eyes
  const E = spec.eyes;
  const eg = eyeGeometries(E.r);
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(sx * E.x, E.y, E.z);
    eye.rotation.x = -0.35;
    const ball = new THREE.Mesh(eg.white, eyeMat);
    ball.castShadow = true;
    const look = new THREE.Group();
    look.add(new THREE.Mesh(eg.irisGeo, eyeMat), new THREE.Mesh(eg.glintGeo, glintMat));
    const lidPivot = new THREE.Group();
    const lid = new THREE.Mesh(eg.lidGeo, paintMat);
    lidPivot.add(lid);
    lidPivot.rotation.x = -1.75;
    eye.add(ball, look, lidPivot);
    bodyG.add(eye);
    eyes.push({ eye, look, lidPivot });
  }

  // smile (tube arc)
  const M = spec.mouth;
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12 * 2 - 1;
    pts.push(new THREE.Vector3(t * M.w, M.y + M.curve * 1.6 * t * t, M.z));
  }
  const mouth = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.05, 6), new THREE.MeshStandardMaterial({ color: M.color, roughness: 0.5 }));
  mouth.position.set(0, M.y, M.z);
  mouth.geometry.translate(0, -M.y, -M.z);                         // pivot at the smile centre so it can scale
  bodyG.add(mouth);

  return { root, body: bodyG, wheels, eyes, mouth, paintMat };
}

// ---------- animation ----------

const REACT_DURATION = 2.1;

function pickReaction(name) {
  return { rusty: 'wobble', bluebell: 'cheer', gus: 'nod', tilly: 'jump', tommy: 'jump', dazzle: 'hop', rosie: 'shimmy', parked: 'nod' }[name] || 'shimmy';
}

export function createCharacters({ route, terrain, anchors, layout, envMap, scene, onReact }) {
  const group = new THREE.Group();
  const list = [];
  const rng = mulberry32(606);

  function add(spec, pos, yawOffset = 0, { react = true, dist = 22 } = {}) {
    const car = makeCar(spec, envMap);
    car.root.position.set(pos.x, pos.y, pos.z);
    car.root.rotation.y = pos.yaw + yawOffset;
    car.baseY = pos.y;
    car.spec = spec;
    car.t = rng() * 10;
    car.phase = rng() * 6.28;
    car.blinkT = 1 + rng() * 3;
    car.blinkP = -1;
    car.react = null;
    car.cool = 0;
    car.reactType = pickReaction(spec.name);
    car.reactDist = dist;
    car.canReact = react;
    car.gx = 0;
    car.hopY = 0;
    group.add(car.root);
    list.push(car);
    return car;
  }

  const A = anchors;
  add(SPECS.rusty, A.rustySpot, 0.2);
  add(SPECS.gus, A.docSpot, 0.4);
  add(SPECS.dazzle, A.paintInside, 0.0);
  add(SPECS.tilly, A.twinSpots[0], 0.35);
  add(SPECS.tommy, A.twinSpots[1], -0.3);
  add(SPECS.rosie, A.dinerSpots[2], 0.25);
  add(SPECS.bluebell, A.motelFront, -0.2);

  // customers and neighbours parked in the lots (they blink, smile and nod a little)
  const parkedAt = [A.dinerSpots[0], A.dinerSpots[3], A.tireShopLot, A.fuelSpot, A.fuelSpot2, A.motelRooms[2], A.nurserySpot];
  parkedAt.forEach((p, i) => {
    if (!p) return;
    add(parkedSpec(PARKED[i % PARKED.length]), p, (rng() - 0.5) * 0.3, { react: true, dist: 16 });
  });

  const heroP = new THREE.Vector3();
  scene.add(group);

  function startReaction(c, type) {
    if (c.react || c.cool > 0) return false;
    c.react = { t: 0, type: type || c.reactType };
    c.cool = 5;
    if (onReact) onReact(c, list.indexOf(c));
    return true;
  }

  return {
    group, list,

    /** A tap: the nearest friend within `range` waves back. */
    reactNearest(pos, range = 50) {
      let best = null, bd = range * range;
      for (const c of list) {
        if (!c.canReact) continue;
        const d = (c.root.position.x - pos.x) ** 2 + (c.root.position.z - pos.z) ** 2;
        if (d < bd && c.cool < 4) { bd = d; best = c; }
      }
      if (best) { best.cool = 0; startReaction(best); }
    },

    update(dt, hero, speed) {
      heroP.copy(hero);
      for (const c of list) {
        const dx = heroP.x - c.root.position.x, dz = heroP.z - c.root.position.z;
        const d2 = dx * dx + dz * dz;
        const far = d2 > 160 * 160;
        c.root.visible = !far;
        if (far) continue;
        c.t += dt; c.cool = Math.max(0, c.cool - dt);

        // trigger a reaction when the hero rolls past
        if (c.canReact && speed > 0.8 && d2 < c.reactDist * c.reactDist) startReaction(c);

        // idle: bob and engine shiver
        let by = Math.sin(c.t * 2 + c.phase) * 0.012, bz = Math.sin(c.t * 1.3 + c.phase) * 0.008, bx = 0, hop = 0, ry = 0, smile = 1, squint = 0;
        if (c.react) {
          c.react.t += dt;
          const t = c.react.t, env = Math.sin(Math.PI * clamp(t / REACT_DURATION, 0, 1));
          switch (c.react.type) {
            case 'shimmy': bz += Math.sin(t * 13) * 0.13 * env; hop = Math.abs(Math.sin(t * 6.5)) * 0.1 * env; break;
            case 'cheer': bx = -0.26 * Math.sin(Math.PI * clamp(t / 1.3, 0, 1)); hop = Math.abs(Math.sin(t * 5)) * 0.18 * env; break;
            case 'nod': bx = Math.sin(t * 7) * 0.08 * env; break;
            case 'jump': hop = Math.abs(Math.sin(t * 6 + (c.spec.name === 'tommy' ? 1.57 : 0))) * 0.7 * env; bz += Math.sin(t * 12) * 0.05 * env; break;
            case 'hop': hop = Math.abs(Math.sin(t * 8)) * 0.4 * env; bx = Math.sin(t * 8) * 0.12 * env; break;
            case 'wobble': ry = Math.sin(t * 9) * 0.12 * env; bz += Math.sin(t * 11) * 0.06 * env; hop = Math.abs(Math.sin(t * 7)) * 0.07 * env; break;
          }
          smile = 1 + 0.7 * env; squint = 0.9 * env;
          if (t > REACT_DURATION) c.react = null;
        }
        c.hopY += (hop - c.hopY) * Math.min(1, dt * 18);
        c.root.position.y = c.baseY + c.hopY;
        c.body.position.y = by;
        c.body.rotation.set(bx, ry, bz);
        c.mouth.scale.set(1, smile, 1);
        // wheels spin only while they hop (landing rock)
        for (const w of c.wheels) w.spin.rotation.x += c.hopY * dt * 14;

        // eyes: blink + glance toward the hero
        c.blinkT -= dt;
        let lid = -1.75 + squint * 1.0;
        if (c.blinkT <= 0 && c.blinkP < 0) c.blinkP = 0;
        if (c.blinkP >= 0) {
          c.blinkP += dt / 0.16;
          const k = c.blinkP < 0.5 ? c.blinkP * 2 : (1 - c.blinkP) * 2;
          lid = Math.max(lid, -1.75 + k * 3.3);
          if (c.blinkP >= 1) { c.blinkP = -1; c.blinkT = 2 + rng() * 3.5; }
        }
        const cy = Math.cos(c.root.rotation.y), sy = Math.sin(c.root.rotation.y);
        const lx = dx * cy - dz * sy, lz = dx * sy + dz * cy;
        const ang = d2 < 55 * 55 ? clamp(Math.atan2(lx, Math.max(lz, 0.001)), -1.2, 1.2) : 0;
        c.gx += (ang * 0.4 - c.gx) * Math.min(1, dt * 5);
        for (const e of c.eyes) {
          e.lidPivot.rotation.x = lid;
          e.look.rotation.y = c.gx;
        }
      }
    },
  };
}
