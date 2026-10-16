// Ground: a vertex-coloured heightfield that hugs the road, with a dry gorge under the bridge.
// The same height function is used by scenery so objects sit on the surface.

import * as THREE from 'three';
import { fbm, lerp, smoothstep } from './util.js';
import { CFG } from './config.js';

export const BOUNDS = { x0: -370, x1: 335, z0: -140, z1: 440 };
const CELL = 3;

// Ground colour per route position (stage mood: tan town, red canyon, pale return road).
const PALETTE = [
  [0, [0.86, 0.69, 0.47]], [280, [0.85, 0.64, 0.42]], [561, [0.8, 0.44, 0.27]],
  [917, [0.7, 0.37, 0.25]], [1077, [0.6, 0.3, 0.22]], [1252, [0.9, 0.76, 0.56]],
  [1511, [0.86, 0.69, 0.47]],
];

export function createTerrain(route, pads = []) {
  const near = { d: 0, s: 0, y: 0, side: 0 };
  const L = route.L;
  const palA = PALETTE.map(([s, c]) => [s / 1596.4 * L, c]);

  function palette(s, out) {
    s = ((s % L) + L) % L;
    let i = 0;
    while (i < palA.length - 1 && palA[i + 1][0] <= s) i++;
    const a = palA[i], b = palA[Math.min(i + 1, palA.length - 1)];
    const t = b[0] > a[0] ? (s - a[0]) / (b[0] - a[0]) : 0;
    out[0] = lerp(a[1][0], b[1][0], t); out[1] = lerp(a[1][1], b[1][1], t); out[2] = lerp(a[1][2], b[1][2], t);
    return out;
  }

  /** Terrain height at (x,z). Fills the shared `near` record as a side effect. */
  function heightAt(x, z) {
    route.nearest(x, z, near);
    const d = near.d;
    const k = 0.35 + 0.95 * smoothstep(20, 130, d);
    let h = 4.6 * (fbm(x / 110 + 3, z / 110, 3) - 0.5) * 2 * k + 1.3 * fbm(x / 22, z / 22, 2) * k;
    const w = 1 - smoothstep(6.2, 26, d);
    h = lerp(h, near.y - 0.28, w);
    // dry gorge under the bridge
    const ds = Math.abs(route.arcDelta(near.s, route.bridge.s));
    const gw = 1 - smoothstep(route.bridge.half - 2, route.bridge.gorgeHalf + 4, ds);
    if (gw > 0) h -= 12 * gw * (1 - smoothstep(30, 95, d)) * (0.85 + 0.3 * fbm(x / 9, z / 9, 2));
    // fade to sea level at the edge of the mesh so it meets the far ground plane
    const e = Math.min(x - BOUNDS.x0, BOUNDS.x1 - x, z - BOUNDS.z0, BOUNDS.z1 - z);
    for (let i = 0; i < pads.length; i++) {              // flat pads under buildings
      const p = pads[i];
      const r = Math.hypot(x - p.x, z - p.z);
      if (r < p.r1) h = lerp(h, p.y, 1 - smoothstep(p.r0, p.r1, r));
    }
    return h * smoothstep(0, 50, e);
  }

  const nx = Math.round((BOUNDS.x1 - BOUNDS.x0) / CELL), nz = Math.round((BOUNDS.z1 - BOUNDS.z0) / CELL);
  const vx = nx + 1, vz = nz + 1;
  const pos = new Float32Array(vx * vz * 3), col = new Float32Array(vx * vz * 3);
  const idx = new Uint32Array(nx * nz * 6);
  const pal = [0, 0, 0];
  for (let j = 0; j < vz; j++) {
    for (let i = 0; i < vx; i++) {
      const x = BOUNDS.x0 + i * CELL, z = BOUNDS.z0 + j * CELL;
      const h = heightAt(x, z);
      const v = j * vx + i;
      pos[v * 3] = x; pos[v * 3 + 1] = h; pos[v * 3 + 2] = z;
      palette(near.s, pal);
      const n1 = fbm(x / 14, z / 14, 3), n2 = fbm(x / 60 + 9, z / 60, 2);
      const strata = Math.sin(h * 2.4 + n2 * 6) * 0.035;
      let k = 0.88 + n1 * 0.22 + strata;
      let r = pal[0] * k * 0.96, g = pal[1] * k * 0.8, b = pal[2] * k * 0.62;     // warmer, more saturated sand
      // gravel / dust band next to the road
      const gr = 1 - smoothstep(5, 12, near.d);
      r = lerp(r, 0.7, gr * 0.55); g = lerp(g, 0.6, gr * 0.55); b = lerp(b, 0.48, gr * 0.55);
      // gorge floor is darker and redder
      const ds = Math.abs(route.arcDelta(near.s, route.bridge.s));
      if (ds < 36 && h < near.y - 3) { const t = smoothstep(3, 9, near.y - h); r = lerp(r, 0.5, t * 0.5); g = lerp(g, 0.31, t * 0.5); b = lerp(b, 0.22, t * 0.5); }
      col[v * 3] = r; col[v * 3 + 1] = g; col[v * 3 + 2] = b;
    }
  }
  let o = 0;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * vx + i, b = a + 1, c = a + vx, d = c + 1;
      idx[o++] = a; idx[o++] = c; idx[o++] = b;
      idx[o++] = b; idx[o++] = c; idx[o++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;

  // Far ground that carries the sand colour out to the horizon (hidden by fog). It has a rectangular
  // hole where the detailed terrain sits, so the gorge and valleys are never covered.
  const farShape = new THREE.Shape();
  farShape.absarc(0, 0, 3000, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  const inset = 1;
  hole.moveTo(BOUNDS.x0 + inset, -(BOUNDS.z0 + inset));
  hole.lineTo(BOUNDS.x1 - inset, -(BOUNDS.z0 + inset));
  hole.lineTo(BOUNDS.x1 - inset, -(BOUNDS.z1 - inset));
  hole.lineTo(BOUNDS.x0 + inset, -(BOUNDS.z1 - inset));
  hole.closePath();
  farShape.holes.push(hole);
  const far = new THREE.Mesh(
    new THREE.ShapeGeometry(farShape, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(0.8, 0.6, 0.42), roughness: 1 }),
  );
  far.position.y = -0.1;
  far.receiveShadow = false;

  return {
    mesh, far, palette,
    heightAt: (x, z) => heightAt(x, z),
    /** Distance from the road centre line (cheap, reuses the route grid). */
    roadDistance: (x, z) => { route.nearest(x, z, near); return near.d; },
  };
}
