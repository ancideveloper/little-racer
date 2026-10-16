// The big landmarks: entrance sign, Rosie's Diner, Dazzle's Paint & Body, Twin Treads tire shop,
// Rusty's Tow & Junk yard and the Cone Motel. Each has its own silhouette, palette and signage.
// Everything is original design; characters are placed on the anchors returned from here.

import * as THREE from 'three';
import { Batch } from './batch.js';
import { paintedSign, neonSign, welcomeSign, icons } from './signs.js';
import { mulberry32, lerp } from './util.js';
import { awning, shopWindow } from './buildings.js';

const P = {};

/** Local building coordinates -> world position (building rotated by yaw about Y). */
export function toWorld(it, lx, lz, yawOffset = 0) {
  const c = Math.cos(it.yaw), s = Math.sin(it.yaw);
  return { x: it.x + lx * c + lz * s, y: it.y, z: it.z - lx * s + lz * c, yaw: it.yaw + yawOffset };
}

function jitterMesh(geo, amp, seed) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 2.1 + seed) * Math.cos(z * 1.7 + seed * 1.3) * Math.sin(y * 1.9 + seed * 0.7);
    const k = 1 + amp * n;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

function place(g, it, extraYaw = 0) {
  g.position.set(it.x, it.y, it.z);
  g.rotation.y = it.yaw + extraYaw;
  g.updateMatrixWorld(true);
}

// =============== ENTRANCE SIGN ===============
function entranceSign(it, ctx) {
  const b = new Batch();
  const rng = mulberry32(5);
  // two rock pillars made of stacked jittered boulders
  for (const sx of [-6.6, 6.6]) {
    let y = 0;
    for (let i = 0; i < 4; i++) {
      const r = 2.1 - i * 0.28;
      const g = jitterMesh(new THREE.IcosahedronGeometry(r, 1), 0.2, sx + i);
      b.add(g, [0xb4583a, 0xc9774a, 0xa84e32, 0xd08a5a][i], new THREE.Matrix4().makeTranslation(sx + (rng() - 0.5) * 0.5, y + r * 0.8, (rng() - 0.5) * 0.5), 'solid', true);
      y += r * 1.3;
    }
  }
  // wooden beam, posts and chains
  b.box(15.4, 0.7, 0.7, 0, 7.5, 0, 0x6a4326);
  for (const sx of [-5.2, 5.2]) b.box(0.14, 1.5, 0.14, sx, 6.0, 0.25, 0x2a2a30, { kind: 'metal' });
  // scattered boulders and cacti at the base
  for (let i = 0; i < 9; i++) {
    const a = rng() * 6.28, r = 3 + rng() * 6;
    const g = jitterMesh(new THREE.IcosahedronGeometry(0.5 + rng() * 0.9, 1), 0.25, i);
    b.add(g, [0xb4583a, 0xa84e32, 0xc9774a][i % 3], new THREE.Matrix4().makeTranslation(Math.cos(a) * r * 1.2, 0.3, Math.sin(a) * r * 0.7 + 1), 'solid', true);
  }
  for (const [x, z, s] of [[-9.5, 1.5, 1.1], [9.8, 2, 0.9]]) {
    b.cyl(0.3 * s, 0.34 * s, 3.4 * s, x, 0, z, 0x3f8a3c, { seg: 8 });
    b.sphere(0.3 * s, x, 3.4 * s, z, 0x4c9a45, { seg: 8 });
    b.cyl(0.16 * s, 0.16 * s, 0.9 * s, x + 0.5 * s, 1.4 * s, z, 0x3f8a3c, { seg: 6, rz: Math.PI / 2 });
    b.cyl(0.16 * s, 0.16 * s, 1.0 * s, x + 0.9 * s, 1.4 * s, z, 0x3f8a3c, { seg: 6 });
  }
  const g = b.build(ctx.envMap);
  const board = welcomeSign();
  board.position.set(0, 5.1, 0.35);
  const back = board.clone();
  back.material = board.material;
  g.add(board);
  // yaw: face back along the road, turned a little toward it so the board is seen head-on
  route_face(it, g, ctx.route);
  ctx.group.add(g);
  ctx.anchors.entranceSign = { x: it.x, y: it.y, z: it.z, yaw: g.rotation.y };
}

function route_face(it, g, route) {
  route.at(it.s, P);
  const side = it.side;
  const a = 0.45;
  const fx = -P.tx * Math.cos(a) + (-side * P.rx) * Math.sin(a), fz = -P.tz * Math.cos(a) + (-side * P.rz) * Math.sin(a);
  g.position.set(it.x, it.y, it.z);
  g.rotation.y = Math.atan2(fx, fz);
  g.updateMatrixWorld(true);
}

// =============== ROSIE'S DINER ===============
function diner(it, ctx) {
  const b = new Batch();
  const W = 22, D = 8, zc = -3;                  // body centred at local z = -3 so the lot fits in front
  const teal = 0x2fc2b0, cream = 0xfff1d0, red = 0xe0383a;
  b.box(W + 1, 0.3, D + 1, 0, 0, zc, 0xcfc4b4);
  // lower band, window band, upper band
  b.box(W, 1.25, D, 0, 0.3, zc, teal);
  b.box(W, 1.9, D, 0, 1.55, zc, cream);
  b.box(W, 0.9, D, 0, 3.45, zc, red);
  b.box(W + 0.4, 0.14, D + 0.4, 0, 4.35, zc, 0xe8ecf2, { kind: 'chrome' });
  // roof slab with overhang and neon edge
  b.box(W + 1.6, 0.4, D + 1.6, 0, 4.49, zc, cream);
  b.box(W + 1.7, 0.1, 0.12, 0, 4.9, zc + D / 2 + 0.8, 0x3ee6ff, { kind: 'glow' });
  b.box(W + 1.7, 0.1, 0.12, 0, 4.9, zc - D / 2 - 0.8, 0x3ee6ff, { kind: 'glow' });
  for (const sx of [-1, 1]) b.box(0.12, 0.1, D + 1.6, sx * (W / 2 + 0.8), 4.9, zc, 0x3ee6ff, { kind: 'glow' });
  // chrome rail and window band on the front
  const zf = zc + D / 2 + 0.02;
  b.box(W - 0.3, 1.5, 0.1, 0, 1.75, zf, 0xffe8a8, { kind: 'glow' });
  for (let i = 0; i <= 11; i++) b.box(0.16, 1.7, 0.16, -W / 2 + 0.3 + i * ((W - 0.6) / 11), 1.65, zf + 0.05, 0xe8ecf2, { kind: 'chrome' });
  b.box(W, 0.12, 0.2, 0, 1.55, zf + 0.06, 0xe8ecf2, { kind: 'chrome' });
  b.box(W, 0.12, 0.2, 0, 3.3, zf + 0.06, 0xe8ecf2, { kind: 'chrome' });
  // stools and counter seen through the glass (dark silhouettes in front of the glow)
  for (let i = 0; i < 7; i++) {
    b.cyl(0.05, 0.05, 0.55, -7.5 + i * 1.2, 0.3, zf - 0.8, 0xe8ecf2, { seg: 6, kind: 'chrome' });
    b.cyl(0.26, 0.26, 0.12, -7.5 + i * 1.2, 0.85, zf - 0.8, red, { seg: 10 });
  }
  // doors in a little vestibule
  b.box(4.4, 3.3, 1.4, 0, 0.3, zf + 0.6, cream);
  b.box(3.0, 2.4, 0.1, 0, 0.3, zf + 1.33, 0xffe8a8, { kind: 'glow' });
  b.box(0.1, 2.4, 0.14, 0, 0.3, zf + 1.35, 0xe8ecf2, { kind: 'chrome' });
  awning(b, 5.2, 3.35, zf + 1.3, red, 0xffffff, 1.5);
  // star decorations on the red band
  for (let i = 0; i < 5; i++) b.box(0.5, 0.5, 0.06, -8.5 + i * 4.4, 3.5, zf + 0.04, 0xffffff, { rz: Math.PI / 4 });
  // roof vents
  b.cyl(0.5, 0.5, 0.9, -7, 4.7, zc - 1, 0xb9bec6, { seg: 10, kind: 'metal' });
  b.box(1.2, 0.8, 1.0, 6, 4.7, zc - 1.5, 0xb9bec6, { kind: 'metal' });
  // parking lot with slot lines
  const lz = zc + D / 2 + 1.0 + 3.5;
  b.box(21, 0.06, 7.2, 0, 0.0, lz, 0x5c5e63);
  for (let i = 0; i <= 8; i++) b.box(0.12, 0.02, 3.4, -9.5 + i * 2.4, 0.07, lz + 1.2, 0xf4f0e4, { ao: false });
  for (let i = 0; i < 8; i++) b.box(1.4, 0.12, 0.3, -8.3 + i * 2.4, 0.07, lz - 0.7, 0x9a9690);
  // driveway to the road
  const road = it.off - 4.9;
  b.box(5.6, 0.05, road - (lz + 3.6) + 0.5, -2, 0, (lz + 3.6 + road) / 2, 0x5c5e63);
  // patio umbrellas
  for (const [x, z, c] of [[-9.5, zf + 2.6, 0xe8453a], [9.2, zf + 2.6, 0x2aa8d8]]) {
    b.cyl(0.04, 0.04, 2.3, x, 0, z, 0xe8ecf2, { seg: 5 });
    b.cone(1.3, 0.5, x, 2.2, z, c, { seg: 10 });
    b.cyl(0.5, 0.5, 0.06, x, 0.75, z, 0xffffff, { seg: 10 });
  }
  // tall pole sign
  b.cyl(0.18, 0.2, 9.6, 10.6, 0, zf + 3.8, 0xe8ecf2, { seg: 8, kind: 'chrome' });
  b.box(0.6, 0.6, 0.6, 10.6, 9.6, zf + 3.8, red);
  // lamp posts in lot
  for (const x of [-9, 0, 9]) { b.cyl(0.06, 0.08, 3.8, x, 0, lz + 3.1, 0x2a3a3a, { seg: 6 }); b.sphere(0.22, x, 3.9, lz + 3.1, 0xfff0b8, { kind: 'glow', ao: false }); }
  const g = b.build(ctx.envMap);
  const s1 = neonSign({ worldW: 5.2, w: 640, h: 220, text: "ROSIE'S", sub: 'diner', color: '#ff4fa0', color2: '#3ee6ff', icon: 'star', font: 110 });
  s1.position.set(10.6, 11.1, zf + 3.85);
  const s2 = s1.clone(); s2.rotation.y = Math.PI; s2.position.z -= 0.08;
  const roof = neonSign({ worldW: 9.5, w: 900, h: 140, text: 'EAT • DRINK • SMILE', color: '#ffe36a', color2: '#ff4fa0', font: 80 });
  roof.position.set(0, 6.0, zc + 2.0);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(9.7, 1.3, 0.2), new THREE.MeshStandardMaterial({ color: 0x1b1226 }));
  plate.position.set(0, 5.65, zc + 1.8);
  g.add(s1, s2, plate, roof);
  place(g, it);
  ctx.group.add(g);
  ctx.anchors.diner = { ...toWorld(it, -6.5, zc + D / 2 + 3.4, 0), lot: toWorld(it, 0, zc + D / 2 + 4.5) };
  ctx.anchors.dinerSpots = [-8.2, -3.4, 1.4, 6.2].map((x) => toWorld(it, x, zc + D / 2 + 4.2));
}

// =============== DAZZLE'S PAINT & BODY ===============
function paintShop(it, ctx) {
  const b = new Batch();
  const W = 24, D = 11, zc = -3.0, H = 6.4;
  const panel = [0xff4f9a, 0x35b8ff, 0xffd23a, 0x6ad04a];
  b.box(W + 1, 0.3, D + 1, 0, 0, zc, 0xcfc4b4);
  // interior shell: floor, back and side walls, roof
  b.box(W - 0.6, 0.12, D - 0.6, 0, 0.3, zc, 0xe4e2dc);
  b.box(W, H, 0.5, 0, 0.3, zc - D / 2 + 0.25, 0x7aa8d8);                 // back wall
  for (const sx of [-1, 1]) b.box(0.5, H, D, sx * (W / 2 - 0.25), 0.3, zc, sx > 0 ? 0xff9ac4 : 0x7ad8f4);
  b.box(W, 0.6, D, 0, 0.3 + H, zc, 0xf4ecdc);                            // roof slab
  // front wall: four colour panels with an opening in the middle
  const zf = zc + D / 2 - 0.25;
  const openW = 9, openH = 4.7;
  const pw = (W - openW) / 2;
  b.box(pw, H, 0.5, -(openW / 2 + pw / 2), 0.3, zf, panel[0]);
  b.box(pw, H, 0.5, openW / 2 + pw / 2, 0.3, zf, panel[1]);
  b.box(openW, H - openH, 0.5, 0, 0.3 + openH, zf, panel[2]);
  // stripe accents on the front pillars
  for (let i = 0; i < 4; i++) {
    b.box(pw, 0.7, 0.55, -(openW / 2 + pw / 2), 0.9 + i * 1.4, zf, i % 2 ? 0xffffff : panel[3]);
    b.box(pw, 0.7, 0.55, openW / 2 + pw / 2, 0.9 + i * 1.4, zf, i % 2 ? panel[0] : 0xffffff);
  }
  // paint drips hanging from the lintel and roof edge
  const rng = mulberry32(21);
  for (let i = 0; i < 16; i++) {
    const x = -W / 2 + 1 + rng() * (W - 2);
    const len = 0.6 + rng() * 1.6;
    b.box(0.22, len, 0.1, x, 0.3 + H - len, zf + 0.3, panel[i % 4]);
    b.sphere(0.16, x, 0.3 + H - len, zf + 0.3, panel[i % 4], { seg: 6, ao: false });
  }
  // garage interior: ceiling light strips, lift, paint cans, half-painted car, hose reel
  for (const x of [-6, -2, 2, 6]) b.box(0.4, 0.1, 6.5, x, 0.3 + openH - 0.1, zc, 0xfff6d8, { kind: 'glow' });
  b.box(0.3, 3.0, 0.3, -2.6, 0.42, zc + 1.5, 0x5a6270, { kind: 'metal' });
  b.box(0.3, 3.0, 0.3, 2.6, 0.42, zc + 1.5, 0x5a6270, { kind: 'metal' });
  b.box(6.0, 0.3, 0.9, 0, 1.4, zc + 1.5, 0xffc928);
  b.box(4.4, 0.9, 2.0, 0, 1.7, zc + 1.5, 0xe8453a, { sx: 1 });                // half-painted body
  b.box(2.2, 0.8, 1.8, -0.3, 2.6, zc + 1.5, 0x35b8ff);
  b.box(2.0, 0.9, 2.02, 1.2, 1.7, zc + 1.5, 0xffd23a);
  for (let i = 0; i < 12; i++) {
    const x = -W / 2 + 1.4 + (i % 4) * 0.7, z = zc - 2.5 + Math.floor(i / 4) * 0.7;
    b.cyl(0.26, 0.26, 0.5, x, 0.42, z, panel[i % 4], { seg: 10 });
    b.cyl(0.28, 0.28, 0.06, x, 0.92, z, 0xdfe6f2, { seg: 10, kind: 'metal' });
  }
  b.cyl(0.8, 0.8, 0.4, 8, 0.42, zc - 3, 0xdfe6f2, { seg: 12, kind: 'metal' });
  b.torus(0.7, 0.1, 8, 1.2, zc - 2.6, 0x2a2a30, { rx: Math.PI / 2 });
  // roof: giant paint-can silos with dripping lids
  for (const [x, c] of [[-6.5, panel[1]], [6.5, panel[0]]]) {
    b.cyl(2.3, 2.3, 3.2, x, 0.9 + H, zc - 1.5, 0xdfe6f2, { seg: 20, kind: 'metal' });
    b.cyl(2.35, 2.35, 0.9, x, 4.1 + H, zc - 1.5, c, { seg: 20 });
    b.cyl(0.8, 0.8, 0.25, x, 5.0 + H, zc - 1.5, 0xdfe6f2, { seg: 10, kind: 'metal' });
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9;
      b.box(0.35, 0.8 + (i % 3) * 0.35, 0.12, x + Math.cos(a) * 2.37, 3.7 + H - (i % 3) * 0.15, zc - 1.5 + Math.sin(a) * 2.37, c, { ry: -a + Math.PI / 2 });
    }
  }
  // colour-chip fence along the front of the lot
  for (let i = 0; i < 16; i++) {
    const x = -W / 2 + 0.8 + i * 1.5;
    b.box(1.2, 1.3 + (i % 3) * 0.3, 0.12, x, 0, zc + D / 2 + 5.2, [0xff4f9a, 0x35b8ff, 0xffd23a, 0x6ad04a, 0xb98aff, 0xff8a3a][i % 6]);
  }
  // gravel lot
  b.box(24, 0.06, 5.2, 0, 0, zc + D / 2 + 2.6, 0x7e7a74);
  const road = it.off - 4.9;
  b.box(5, 0.05, road - (zc + D / 2 + 5.2) + 0.5, 3, 0, (zc + D / 2 + 5.2 + road) / 2, 0x5c5e63);
  const g = b.build(ctx.envMap);
  const sign = paintedSign({ worldW: 9.5, w: 900, h: 230, text: "DAZZLE'S", sub: 'paint & body', bg: '#2a2a50', fg: '#ffe36a', border: '#ff4f9a', icon: 'splat', font: 120 });
  sign.position.set(0, 0.3 + openH + 0.9, zf + 0.35);
  sign.scale.set(0.8, 0.8, 1);
  g.add(sign);
  place(g, it);
  ctx.group.add(g);
  ctx.anchors.paintShop = toWorld(it, -6, zc + D / 2 + 3.0);
  ctx.anchors.docSpot = toWorld(it, 8, zc + D / 2 + 3.2);
  ctx.anchors.paintInside = toWorld(it, 0, zc + 1.6);
}

// =============== TWIN TREADS TIRE SHOP ===============
function tireShop(it, ctx) {
  const b = new Batch();
  const W = 24, D = 9, zc = -3.5, H = 5.2;
  const yel = 0xffc928, dark = 0x34343c;
  b.box(W + 1, 0.3, D + 1, 0, 0, zc, 0xcfc4b4);
  b.box(W, H, D, 0, 0.3, zc, 0x5a6070);
  // hazard-stripe band
  for (let i = 0; i < 24; i++) b.box(1.0, 0.7, 0.1, -W / 2 + 0.5 + i, 0.3, zc + D / 2 + 0.05, i % 2 ? yel : dark);
  // yellow upper wall and parapet
  b.box(W + 0.2, 1.8, D + 0.2, 0, 3.8, zc, yel);
  b.box(W + 0.6, 0.35, D + 0.6, 0, 5.6, zc, dark);
  // two garage bays with raised doors and tyre racks inside
  const zf = zc + D / 2 + 0.05;
  for (const bx of [-5.6, 5.6]) {
    b.box(5.4, 3.4, 0.2, bx, 0.3, zf, 0x14141a);
    b.box(5.4, 0.35, 0.3, bx, 3.35, zf + 0.15, 0xe8ecf2);
    for (let r = 0; r < 4; r++) {
      b.box(5.0, 0.12, 0.12, bx, 0.5 + r * 0.7, zf - 0.4, 0xd0d4dc, { kind: 'metal' });
      for (let t = 0; t < 4; t++) b.torus(0.4, 0.16, bx - 1.9 + t * 1.2, 0.8 + r * 0.7, zf - 0.7, dark, { tseg: 6, seg: 14 });
    }
    b.box(5.4, 0.1, 0.9, bx, 3.55, zf + 0.2, 0xfff6d8, { kind: 'glow' });
  }
  // office door and windows in the middle
  b.box(1.5, 2.5, 0.14, 0, 0.3, zf + 0.04, 0x5e3d22);
  b.box(0.9, 1.1, 0.16, 0, 1.4, zf + 0.06, 0xffe8a8, { kind: 'glow' });
  shopWindow(b, -2.9, 1.2, zf + 0.04, 1.6, 1.6, 0xffe8a8, 0xffffff);
  shopWindow(b, 2.9, 1.2, zf + 0.04, 1.6, 1.6, 0xffe8a8, 0xffffff);
  // giant tyre on the roof as signage
  b.torus(2.6, 1.0, 0, 8.2, zc + D / 2 - 0.2, dark, { tseg: 14, seg: 32 });
  b.cyl(1.6, 1.6, 0.3, 0, 8.2 - 0.15, zc + D / 2 - 0.2, 0xdde2ec, { seg: 28, rx: Math.PI / 2, kind: 'metal' });
  for (const sx of [-1.4, 1.4]) b.box(0.3, 2.9, 0.3, sx, 5.9, zc + D / 2 - 0.3, 0x3b3f4a);
  // tyre pyramid by the road + leaning rows
  const ty = (x, y, z) => b.torus(0.52, 0.26, x, y, z, dark, { rx: Math.PI / 2, tseg: 8, seg: 18 });
  const px = -W / 2 + 3, pz = zc + D / 2 + 3.2;
  for (let r = 0; r < 4; r++) for (let i = 0; i < 4 - r; i++) { ty(px + (i - (3 - r) / 2) * 1.12, 0.3 + r * 0.52, pz); ty(px + (i - (3 - r) / 2) * 1.12, 0.3 + r * 0.52, pz + 1.1); }
  b.cyl(0.35, 0.35, 0.1, px, 0.3 + 4 * 0.52, pz, 0xffc928, { seg: 10 });
  for (let i = 0; i < 9; i++) b.torus(0.5, 0.2, W / 2 - 3 + (i % 3) * 0.7 - 0.7, 0.55 + Math.floor(i / 3) * 1.0, zc + D / 2 + 3.2, dark, { tseg: 8, seg: 18, rx: 0.1 });
  b.box(3, 0.1, 0.2, W / 2 - 3, 0.3, zc + D / 2 + 3.5, 0x8a5a34);
  // asphalt lot + driveway
  b.box(24, 0.06, 6.6, 0, 0, zc + D / 2 + 3.0, 0x56585e);
  const road = it.off - 4.9;
  b.box(5, 0.05, road - (zc + D / 2 + 6.3) + 0.5, -4, 0, (zc + D / 2 + 6.3 + road) / 2, 0x56585e);
  // air-pump post and cones
  b.cyl(0.12, 0.14, 1.4, 4, 0.3, zc + D / 2 + 1.6, 0xe8453a, { seg: 6 });
  for (let i = 0; i < 4; i++) b.cone(0.22, 0.6, -3 + i * 0.9, 0.06, zc + D / 2 + 5.5, 0xff7a1a, { seg: 8 });
  const g = b.build(ctx.envMap);
  const sign = paintedSign({ worldW: 7.5, w: 700, h: 170, text: 'TWIN TREADS', sub: 'tires & wheels', bg: '#2c2c33', fg: '#ffc928', border: '#ffc928', icon: 'tire', font: 92 });
  sign.position.set(0, 4.75, zf + 0.2);
  sign.scale.setScalar(0.74);
  g.add(sign);
  place(g, it);
  ctx.group.add(g);
  ctx.anchors.tireShop = toWorld(it, -2.5, zc + D / 2 + 3.8);
  ctx.anchors.twinSpots = [toWorld(it, -4, zc + D / 2 + 5.2), toWorld(it, 1.5, zc + D / 2 + 5.2)];
}

// =============== RUSTY'S TOW & JUNK ===============
function towYard(it, ctx) {
  const b = new Batch();
  const rng = mulberry32(77);
  const rust = [0x9a5a3a, 0xa86a42, 0x7a4a34, 0xb07848, 0x6a5a4a];
  b.box(30, 0.04, 22, 0, 0, 0, 0x8a7a62);                        // packed dirt
  // corrugated shed (back-left) with lean-to
  b.box(11, 4.4, 7, -8, 0, -6.5, 0x8a7c6a, { kind: 'metal' });
  for (let i = 0; i < 22; i++) b.box(0.08, 4.4, 0.12, -13.4 + i * 0.5, 0, -2.95, 0x6a5e50, { kind: 'metal' });
  b.box(12.4, 0.3, 8.6, -8, 4.4, -6.3, 0x6a4a3a, { kind: 'metal', rx: -0.12 });
  b.box(5, 3.4, 0.2, -8, 0, -2.9, 0x1b1b20);                      // open workshop bay
  b.box(1.0, 1.0, 0.1, -12, 1.4, -2.9, 0xffe8a8, { kind: 'glow' });
  // tool wall inside the lean-to
  for (let i = 0; i < 6; i++) {
    b.box(0.12, 1.0, 0.1, -10.5 + i * 0.5, 1.6, -2.78, 0xd0d4dc, { kind: 'metal', rz: i * 0.2 });
  }
  b.box(3.4, 0.9, 1.4, -4.6, 0, -4.2, 0x6a4a2e);                  // workbench
  b.box(3.6, 0.1, 1.6, -4.6, 0.9, -4.2, 0x8a5a34);
  // A-frame crane with chain and hook
  b.box(0.35, 7.5, 0.35, 5, 0, -5, 0x6a5a4a, { rz: 0.35 });
  b.box(0.35, 7.5, 0.35, 8.6, 0, -5, 0x6a5a4a, { rz: -0.35 });
  b.box(5.5, 0.35, 0.35, 6.8, 6.9, -5, 0x6a5a4a);
  for (let i = 0; i < 7; i++) b.torus(0.1, 0.03, 6.8, 6.6 - i * 0.28, -5, 0x3a3a40, { ry: (i % 2) * Math.PI / 2, tseg: 5, seg: 8 });
  b.torus(0.28, 0.07, 6.8, 4.5, -5, 0xd8d8dc, { arc: Math.PI * 1.5, kind: 'metal' });
  // junk piles: crushed car bodies, tyres and barrels
  for (let i = 0; i < 7; i++) {
    const x = -12 + (i % 4) * 4.0 + rng(), z = 6 - Math.floor(i / 4) * 3.6 + rng();
    const c = rust[i % rust.length];
    b.box(3.6, 0.9, 1.7, x, 0.0, z, c, { ry: rng() * 0.6 - 0.3 });
    b.box(2.0, 0.8, 1.5, x - 0.2, 0.9, z, rust[(i + 2) % rust.length], { ry: rng() * 0.6 });
    if (i % 2) b.box(3.4, 0.8, 1.6, x + 0.2, 1.7, z + 0.1, rust[(i + 1) % rust.length], { ry: 0.3 });
  }
  for (let i = 0; i < 18; i++) b.torus(0.45, 0.2, 5 + (i % 6) * 0.95, 0.25 + Math.floor(i / 6) * 0.42, 5 + (i % 2) * 0.4, 0x26262b, { rx: Math.PI / 2, tseg: 6, seg: 14 });
  for (const [x, z, c] of [[11.5, 0, 0xc0382a], [12.4, 1, 0x2a5ab8], [11.6, 2.2, 0xc0382a], [12.2, -1.4, 0x6a8a3a]]) b.cyl(0.42, 0.42, 1.0, x, 0, z, c, { seg: 10 });
  // water tower (rusty)
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(0.18, 6, 0.18, 10 + dx, 0, -7 + dz, 0x5a4a3c, { rx: dz * 0.05, rz: -dx * 0.05 });
  b.cyl(1.8, 1.8, 2.8, 10, 6, -7, 0x9a6a46, { seg: 16, kind: 'metal' });
  b.cone(2.0, 1.0, 10, 8.8, -7, 0x6a4a34, { seg: 16 });
  // old gas pump and tyre swing
  b.box(0.7, 1.7, 0.6, 3, 0, 6.5, 0xb8402e);
  b.box(0.5, 0.5, 0.62, 3, 1.2, 6.5, 0xe8d8a8);
  // perimeter fence: posts and rails, gate gap in front-center
  const FW = 15, FD = 11;
  const postAt = (x, z) => b.box(0.14, 1.9, 0.14, x, 0, z, 0x6a4a2e);
  for (let x = -FW; x <= FW; x += 2.5) { if (Math.abs(x) > 3.5) { postAt(x, FD); } postAt(x, -FD); }
  for (let z = -FD; z <= FD; z += 2.5) { postAt(-FW, z); postAt(FW, z); }
  for (const y of [0.6, 1.2, 1.8]) {
    b.box(FW - 3.5, 0.08, 0.06, -(FW + 3.5) / 2, y, FD, 0x8a6a46);
    b.box(FW - 3.5, 0.08, 0.06, (FW + 3.5) / 2, y, FD, 0x8a6a46);
    b.box(FW * 2, 0.08, 0.06, 0, y, -FD, 0x8a6a46);
    b.box(0.06, 0.08, FD * 2, -FW, y, 0, 0x8a6a46);
    b.box(0.06, 0.08, FD * 2, FW, y, 0, 0x8a6a46);
  }
  // sign posts at the gate
  b.box(0.3, 4.4, 0.3, -4.2, 0, FD + 0.3, 0x5e3d22);
  b.box(0.3, 4.4, 0.3, 4.2, 0, FD + 0.3, 0x5e3d22);
  b.box(8.7, 0.3, 0.3, 0, 4.1, FD + 0.3, 0x5e3d22);
  // driveway
  const road = it.off - 4.9;
  b.box(6, 0.05, road - FD + 0.5, 0, 0, (FD + road) / 2, 0x8a7a62);
  const g = b.build(ctx.envMap);
  const sign = paintedSign({ worldW: 7.6, w: 640, h: 170, text: "RUSTY'S", sub: 'tow & junk', bg: '#6a4a34', fg: '#ffe8c0', border: '#d9a05a', icon: 'wrench', font: 100 });
  sign.position.set(0, 3.0, FD + 0.5);
  sign.material.side = THREE.DoubleSide;
  g.add(sign);
  place(g, it);
  ctx.group.add(g);
  ctx.anchors.towYard = toWorld(it, -3.5, -2.0);
  ctx.anchors.rustySpot = toWorld(it, -2.5, 4.5, -0.5);
  ctx.anchors.yardGate = toWorld(it, 0, FD + 1);
}

// =============== CONE MOTEL ===============
function coneMotel(it, ctx) {
  const b = new Batch();
  const rng = mulberry32(31);
  const roomCols = [[0xff8a3a, 0xfff1d0], [0xff6fa8, 0xfff1d0], [0x35c4b6, 0xfff1d0], [0xffd23a, 0xfff1d0], [0xb98aff, 0xfff1d0], [0x6ad04a, 0xfff1d0], [0x4ab4ff, 0xfff1d0]];
  const tips = [];
  const coneAt = (x, z, r, hRoof, hWall, cols, faceYaw, tag) => {
    b.cyl(r, r + 0.1, hWall, x, 0.15, z, 0xfff6e4, { seg: 18 });
    // roof in 4 stripes (frusta), alternating colours
    const segs = 4;
    let y = 0.15 + hWall;
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs, t1 = (i + 1) / segs;
      const r0 = (r + 0.35) * (1 - t0), r1 = (r + 0.35) * (1 - t1);
      b.cyl(Math.max(r1, 0.02), r0, hRoof / segs, x, y, z, cols[i % 2], { seg: 18 });
      y += hRoof / segs;
    }
    b.sphere(0.22, x, y + 0.1, z, 0xffd23a, { seg: 8, kind: 'chrome' });
    tips.push([x, y + 0.2, z]);
    // door + window facing the courtyard (faceYaw = direction of the front)
    const fx = Math.sin(faceYaw), fz = Math.cos(faceYaw);
    b.box(1.0, 1.9, 0.14, x + fx * (r + 0.02), 0.15, z + fz * (r + 0.02), 0x6a3a22, { ry: faceYaw });
    b.box(0.8, 0.9, 0.16, x + fx * (r + 0.03) - Math.cos(faceYaw) * 1.4, 1.0, z + fz * (r + 0.03) + Math.sin(faceYaw) * 1.4, 0xffe8a8, { ry: faceYaw, kind: 'glow' });
    b.sphere(0.12, x + fx * (r + 0.2) + Math.cos(faceYaw) * 0.9, 2.2, z + fz * (r + 0.2) - Math.sin(faceYaw) * 0.9, 0xffe9a0, { kind: 'glow', ao: false });
    b.box(0.5, 0.3, 0.05, x + fx * (r + 0.1) + Math.cos(faceYaw) * 0.9, 1.6, z + fz * (r + 0.1) - Math.sin(faceYaw) * 0.9, 0xffffff, { ry: faceYaw });
  };
  // courtyard paving (disc) and arc of guest cones behind it
  b.cyl(12, 12, 0.12, 0, 0, 0, 0xd9c7a0, { seg: 40 });
  b.cyl(2.2, 2.2, 0.35, 0, 0.1, -1.0, 0xcfb888, { seg: 20 });
  b.cyl(1.6, 1.6, 0.4, 0, 0.35, -1.0, 0x4ab4ff, { seg: 20, kind: 'glossy' });          // little fountain pool
  const nRooms = 7;
  for (let i = 0; i < nRooms; i++) {
    const a = lerp(-1.05, 1.05, i / (nRooms - 1));
    const x = Math.sin(a) * 15, z = -Math.cos(a) * 9.5 - 1.5;
    coneAt(x, z, 2.5, 4.4, 2.3, roomCols[i], Math.atan2(-x, -z - 1.0) + 0, i);
  }
  // office: bigger cone near the front-left with glass
  coneAt(-11, 5.5, 3.4, 5.6, 3.0, [0xe8453a, 0xfff1d0], Math.PI * 0.9, 'office');
  b.box(2.6, 2.2, 0.2, -11.0 - 0.3, 0.15, 5.5 + 3.4, 0xffe8a8, { kind: 'glow', ry: 0 });
  // neon pole sign near the road (front right)
  b.cyl(0.2, 0.22, 8.4, 12.5, 0, 9.0, 0xe8ecf2, { seg: 8, kind: 'chrome' });
  b.cone(0.9, 1.6, 12.5, 8.4, 9.0, 0xff8a3a, { seg: 12 });
  // string lights from tip to tip (catenary of tiny bulbs)
  const bulbCols = [0xffd23a, 0xff6fa8, 0x4ab4ff, 0x6ad04a, 0xff8a3a];
  for (let i = 0; i < tips.length - 2; i++) {
    const A = tips[i], B = tips[i + 1];
    for (let k = 1; k < 10; k++) {
      const t = k / 10;
      b.box(0.14, 0.14, 0.14, lerp(A[0], B[0], t), lerp(A[1], B[1], t) - 1.1 * Math.sin(Math.PI * t) - 0.2, lerp(A[2], B[2], t), bulbCols[(i + k) % bulbCols.length], { kind: 'glow', ao: false });
    }
  }
  // landscaping: rocks, barrel cacti and loungers
  for (let i = 0; i < 10; i++) {
    const a = rng() * 6.28, r = 6 + rng() * 5;
    b.sphere(0.35 + rng() * 0.3, Math.cos(a) * r * 1.4, 0.3, Math.sin(a) * r * 0.5 + 3, 0x9a6a4a, { seg: 6, sy: 0.7 });
  }
  for (const [x, z] of [[-4.5, 3], [4.5, 3.4], [7.5, 1.2]]) {
    b.sphere(0.5, x, 0.55, z, 0x3f9a45, { seg: 10 });
    b.sphere(0.12, x, 1.05, z, 0xff7aa8, { seg: 6 });
  }
  for (const x of [-6.5, 6.8]) { b.box(0.8, 0.1, 1.9, x, 0.5, 5.5, 0xfff1d0); b.box(0.8, 0.5, 0.1, x, 0.6, 4.6, 0xfff1d0, { rx: -0.6 }); b.box(0.9, 0.5, 0.9, x, 0.0, 5.5, 0x4ab4ff); }
  // driveway
  const road = it.off - 4.9;
  b.box(6, 0.05, road - 8.5, 3, 0, (8.5 + road) / 2 + 0.2, 0x5c5e63);
  const g = b.build(ctx.envMap);
  const s1 = neonSign({ worldW: 4.8, w: 640, h: 210, text: 'CONE MOTEL', sub: 'sweet dreams', color: '#ff8a3a', color2: '#ffd23a', panel: '#2a1a3a', icon: 'bed', font: 92 });
  s1.position.set(12.5, 10.9, 9.05);
  const s2 = s1.clone(); s2.rotation.y = Math.PI; s2.position.z -= 0.1;
  g.add(s1, s2);
  place(g, it);
  ctx.group.add(g);
  ctx.anchors.motel = toWorld(it, 2, 6.5);
  ctx.anchors.motelRooms = [toWorld(it, -2, 3.8), toWorld(it, 3.5, 3.6), toWorld(it, 8, 3.2)];
}

export function buildLandmark(ctx) {
  const { layout } = ctx;
  ctx.anchors = {};
  const byId = Object.fromEntries(layout.map((it) => [it.id, it]));
  entranceSign(byId.entranceSign, ctx);
  diner(byId.diner, ctx);
  paintShop(byId.paintShop, ctx);
  tireShop(byId.tireShop, ctx);
  towYard(byId.towYard, ctx);
  coneMotel(byId.coneMotel, ctx);
  // extra spots for parked neighbours and friends
  const A = ctx.anchors, tire = byId.tireShop, fuel = byId.fuelStation, nur = byId.nursery, mo = byId.coneMotel;
  A.motelFront = toWorld(mo, 4.5, 8.5);
  A.tireShopLot = toWorld(tire, 7, -3.5 + 4.5 + 5.2);
  A.fuelSpot = toWorld(fuel, 3, 3.3);
  A.nurserySpot = toWorld(nur, -3.5, 5 + 4.2);
  return { anchors: ctx.anchors };
}
