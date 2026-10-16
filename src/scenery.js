// Desert scenery: instanced rocks, cacti (swaying), bushes, grass, flowers, mesas, hoodoos, a rock arch,
// distant mountains, roadside posts, telegraph poles and tumbleweeds. Placement is deterministic and
// keeps a clear corridor around the road so nothing can block the follow camera.

import * as THREE from 'three';
import { Batch } from './batch.js';
import { mulberry32, valueNoise, lerp, smoothstep, clamp } from './util.js';

const CELL = 230;                                   // spatial chunk size for frustum culling of instanced groups
export const timeU = { value: 0 };                  // drives all sway animation

// ---------- geometry helpers ----------

/** Push vertices radially by smooth noise (pure function of position => watertight even when non-indexed). */
function jitter(geo, amp, freq, seed) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = valueNoise(x * freq + seed + y * freq * 0.7, z * freq + seed * 0.5 - y * freq * 0.4) * 2 - 1;
    const k = 1 + amp * n;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

function colorize(geo, fn) {
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    fn(p.getX(i), p.getY(i), p.getZ(i), c);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

function rockGeometry(seed, flat, detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  jitter(g, 0.32, 1.7, seed);
  g.scale(1, flat, 0.9);
  return colorize(g, (x, y, z, c) => {
    const k = (0.6 + 0.4 * smoothstep(-0.9, 0.5, y)) * (1 + 0.07 * Math.sin(y * 8 + seed));
    c.setRGB(k, k * 0.97, k * 0.94);
  });
}

function mesaGeometry(seed, steps) {
  // stepped cliffs: [radius, height] (normalised), lathed and roughened
  const prof = steps || [[1.18, 0], [1.0, 0.1], [0.86, 0.15], [0.83, 0.4], [0.74, 0.44], [0.72, 0.74], [0.65, 0.77], [0.63, 1.0], [0.0, 1.0]];
  const pts = prof.map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 22).toNonIndexed();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = valueNoise(x * 2.6 + seed, z * 2.6 + y * 5) * 2 - 1;
    const k = y > 0.99 ? 1 : 1 + 0.1 * n;
    p.setXYZ(i, x * k, y, z * k);
  }
  g.computeVertexNormals();
  const bands = [[0.78, 0.38, 0.24], [0.86, 0.5, 0.3], [0.7, 0.3, 0.2], [0.9, 0.62, 0.4], [0.8, 0.42, 0.26], [0.66, 0.28, 0.2]];
  return colorize(g, (x, y, z, c) => {
    const b = bands[Math.floor((y * 9 + seed) % bands.length + bands.length) % bands.length];
    const top = smoothstep(0.985, 1.0, y);
    const shade = 0.78 + 0.22 * smoothstep(0, 0.3, y);
    c.setRGB(lerp(b[0], 0.78, top * 0.6) * shade, lerp(b[1], 0.6, top * 0.6) * shade, lerp(b[2], 0.38, top * 0.6) * shade);
  });
}

function cactusGeometry() {
  const b = new Batch();
  b.aoStrength = 0.3;
  const g1 = 0x3f8a3c, g2 = 0x4c9a45;
  b.cyl(0.32, 0.36, 3.6, 0, 0, 0, g1, { seg: 9 });
  b.sphere(0.32, 0, 3.6, 0, g2, { seg: 9 });
  // arms: horizontal stub then upward
  b.cyl(0.17, 0.17, 0.95, 0.5, 1.5, 0, g1, { seg: 7, rz: Math.PI / 2 });
  b.cyl(0.17, 0.17, 1.1, 0.95, 1.5, 0, g1, { seg: 7 });
  b.sphere(0.17, 0.95, 2.6, 0, g2, { seg: 7 });
  b.cyl(0.15, 0.15, 0.75, -0.45, 2.0, 0, g1, { seg: 7, rz: -Math.PI / 2 });
  b.cyl(0.15, 0.15, 0.8, -0.82, 2.0, 0, g1, { seg: 7 });
  b.sphere(0.15, -0.82, 2.8, 0, g2, { seg: 7 });
  b.sphere(0.1, 0, 3.95, 0, 0xff7aa8, { seg: 6 });          // little flower on top
  return b.geometry();
}

function barrelCactusGeometry() {
  const g = new THREE.SphereGeometry(0.5, 14, 10).toNonIndexed();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + 0.08 * Math.cos(a * 10);
    p.setXYZ(i, x * k, y * 0.9 + 0.45, z * k);
  }
  g.computeVertexNormals();
  return colorize(g, (x, y, z, c) => {
    const k = 0.7 + 0.3 * smoothstep(0, 0.9, y);
    c.setRGB(0.3 * k, 0.55 * k, 0.28 * k);
    if (y > 0.82) c.setRGB(1, 0.8, 0.2);
  });
}

function pricklyPearGeometry() {
  const b = new Batch();
  b.aoStrength = 0.25;
  const pad = (x, y, z, rz, s) => b.sphere(0.5, x, y, z, 0x5c9a4a, { sx: 1 * s, sy: 1.15 * s, sz: 0.22 * s, rz, seg: 10 });
  pad(0, 0.5, 0, 0, 1);
  pad(0.45, 1.05, 0.02, -0.5, 0.8);
  pad(-0.4, 1.0, -0.02, 0.5, 0.75);
  pad(0.7, 1.5, 0.0, -0.9, 0.6);
  b.sphere(0.08, 0.45, 1.5, 0.12, 0xd0405a, { seg: 6 });
  b.sphere(0.08, -0.4, 1.4, 0.1, 0xd0405a, { seg: 6 });
  return b.geometry();
}

function bushGeometry() {
  const b = new Batch();
  b.aoStrength = 0.35;
  const cols = [0x7b8a4a, 0x8c9a58, 0x6d7d42];
  [[0, 0.4, 0, 0.55], [0.45, 0.3, 0.1, 0.4], [-0.4, 0.32, -0.1, 0.42], [0.1, 0.55, 0.35, 0.38], [-0.1, 0.62, -0.3, 0.34]].forEach(([x, y, z, r], i) => {
    b.sphere(r, x, y, z, cols[i % 3], { seg: 8 });
  });
  return b.geometry();
}

function grassGeometry() {
  const b = new Batch();
  b.aoStrength = 0.2;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, tilt = 0.25 + (i % 3) * 0.12;
    b.cone(0.045, 0.7 - (i % 3) * 0.12, Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05, i % 2 ? 0xd8b868 : 0xc9a455, { seg: 4, rx: Math.cos(a) * tilt, rz: -Math.sin(a) * tilt });
  }
  return b.geometry();
}

function flowerGeometry() {
  const b = new Batch();
  b.aoStrength = 0;
  b.cyl(0.015, 0.015, 0.3, 0, 0, 0, 0x6a8a3a, { seg: 4 });
  b.sphere(0.07, 0, 0.32, 0, 0xffffff, { seg: 6 });
  return b.geometry();
}

function hoodooGeometry(seed) {
  const b = new Batch();
  b.aoStrength = 0.3;
  const cols = [0xb85c3a, 0xc9774a, 0xa84e32, 0xd08a5a];
  let y = 0;
  const n = 4 + (seed % 2);
  for (let i = 0; i < n; i++) {
    const r = i === 0 ? 1.7 : 1.0 + 0.5 * Math.sin(i * 1.7 + seed);
    const h = 1.6 + (i % 2) * 0.8;
    const g = new THREE.CylinderGeometry(r * 0.8, r, h, 12, 2).toNonIndexed();
    jitter(g, 0.12, 1.4, seed + i);
    g.translate(0, y + h / 2, 0);
    b.add(g, cols[(i + seed) % cols.length], null, 'solid', true);
    y += h * 0.92;
  }
  b.cyl(1.5, 0.9, 0.7, 0, y - 0.15, 0, 0xd9a068, { seg: 12 });
  return b.geometry();
}

// ---------- instancing with spatial chunks ----------

const swayCache = new Map();
function swayMaterial(amp, extra = {}) {
  const key = amp + JSON.stringify(extra);
  if (swayCache.has(key)) return swayCache.get(key);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, ...extra });
  if (amp > 0) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = timeU;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.27;
        float hh = max(position.y, 0.0);
        transformed.x += sin(uTime * 1.4 + ph) * ${amp.toFixed(4)} * hh * hh;
        transformed.z += cos(uTime * 1.1 + ph * 1.3) * ${(amp * 0.6).toFixed(4)} * hh * hh;`);
    };
    mat.customProgramCacheKey = () => 'sway' + amp;
  }
  swayCache.set(key, mat);
  return mat;
}

class Scatter {
  constructor(geo, mat, { castShadow = false, receiveShadow = true } = {}) {
    this.geo = geo; this.mat = mat; this.cells = new Map();
    this.castShadow = castShadow; this.receiveShadow = receiveShadow;
  }
  add(matrix, color, x, z) {
    const key = Math.floor(x / CELL) + ',' + Math.floor(z / CELL);
    let c = this.cells.get(key);
    if (!c) this.cells.set(key, (c = []));
    c.push([matrix, color]);
  }
  build(parent) {
    let count = 0;
    for (const items of this.cells.values()) {
      const mesh = new THREE.InstancedMesh(this.geo, this.mat, items.length);
      items.forEach(([m, col], i) => { mesh.setMatrixAt(i, m); if (col) mesh.setColorAt(i, col); });
      mesh.castShadow = this.castShadow; mesh.receiveShadow = this.receiveShadow;
      mesh.computeBoundingSphere();
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
      count += items.length;
    }
    return count;
  }
}

export function createScenery({ route, terrain, zones, scene, envMap }) {
  const group = new THREE.Group();
  scene.add(group);
  const L = route.L, m = route.marks;
  const near = {};
  const P = {};
  const stats = { rocks: 0, cacti: 0, bushes: 0, grass: 0, flowers: 0, mesas: 0, hoodoos: 0, other: 0 };
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3();
  const pal = [0, 0, 0];

  const compose = (x, y, z, yaw, sx, sy, sz, tilt = 0) => {
    tmpE.set(tilt * Math.sin(yaw * 3), yaw, tilt * Math.cos(yaw * 3));
    tmpQ.setFromEuler(tmpE);
    return tmpM.compose(tmpV.set(x, y, z), tmpQ, tmpS.set(sx, sy, sz)).clone();
  };

  /** Is (x,z) a legal spot? Keeps zones, the bridge gorge and the tunnel clear. */
  function legal(x, z, minRoad, noGorge = true) {
    for (let i = 0; i < zones.length; i++) {
      const dz = zones[i];
      if ((x - dz.x) ** 2 + (z - dz.z) ** 2 < dz.r * dz.r) return false;
    }
    route.nearest(x, z, near);
    if (near.d < minRoad) return false;
    if (noGorge) {
      const bs = Math.abs(route.arcDelta(near.s, route.bridge.s));
      if (bs < 46 && near.d < 100) return false;
      const ts = Math.abs(route.arcDelta(near.s, route.tunnel.s));
      if (ts < 42 && near.d < 48) return false;
    }
    return true;
  }

  /** Random point near the road inside an arc range. */
  function pick(rng, s0, s1, dMin, dMax, power = 1.6) {
    const s = lerp(s0, s1, rng());
    const side = rng() < 0.5 ? -1 : 1;
    const d = dMin + (dMax - dMin) * Math.pow(rng(), power);
    route.at(s, P);
    return { x: P.x + P.rx * side * d, z: P.z + P.rz * side * d, s, side, d };
  }

  const rockCol = new THREE.Color();
  function stageRockColor(s, rng, out) {
    terrain.palette(s, pal);
    const k = 0.75 + rng() * 0.3;
    return out.setRGB(pal[0] * k * 1.05, pal[1] * k * 0.82, pal[2] * k * 0.78);
  }

  // ---- rocks (3 variants) + boulders ----
  const rockMat = swayMaterial(0, { roughness: 0.95, flatShading: true });
  const rockVariants = [0, 1, 2].map((i) => new Scatter(rockGeometry(11 + i * 7, 0.55 + i * 0.12), rockMat, { castShadow: false }));
  {
    const rng = mulberry32(1234);
    let n = 0;
    for (let tries = 0; tries < 6000 && n < 620; tries++) {
      const big = rng() < 0.18;
      const p = pick(rng, 0, L, big ? 15 : 7.6, big ? 110 : 70, big ? 1.2 : 1.8);
      if (!legal(p.x, p.z, big ? 14 : 7.4, false)) continue;
      const sz = big ? 2 + rng() * 3.2 : 0.35 + rng() * 1.0;
      const y = terrain.heightAt(p.x, p.z);
      stageRockColor(p.s, rng, rockCol);
      rockVariants[n % 3].add(compose(p.x, y + sz * 0.15, p.z, rng() * 6.28, sz, sz, sz * (0.8 + rng() * 0.4), 0.15), rockCol.clone(), p.x, p.z);
      n++;
    }
    stats.rocks = n;
  }

  // ---- cacti / bushes / grass / flowers ----
  const cactusS = new Scatter(cactusGeometry(), swayMaterial(0.004), { castShadow: true });
  const barrelS = new Scatter(barrelCactusGeometry(), swayMaterial(0.01));
  const pearS = new Scatter(pricklyPearGeometry(), swayMaterial(0.008));
  const bushS = new Scatter(bushGeometry(), swayMaterial(0.03));
  const grassS = new Scatter(grassGeometry(), swayMaterial(0.35));
  const flowerS = new Scatter(flowerGeometry(), swayMaterial(0.5));
  {
    const rng = mulberry32(777);
    const c = new THREE.Color();
    // saguaro-style cacti: sparse in town, plentiful in the open desert
    for (let tries = 0, n = 0; tries < 4000 && n < 150; tries++) {
      const p = pick(rng, 0, L, 10, 85, 1.4);
      const inTown = p.s > m.mainStart - 10 && p.s < m.mainEnd + 10;
      if (inTown && rng() < 0.9) continue;
      if (!legal(p.x, p.z, 9)) continue;
      const sz = 0.7 + rng() * 0.7;
      c.setRGB(0.82 + rng() * 0.3, 0.85 + rng() * 0.25, 0.8 + rng() * 0.2);
      cactusS.add(compose(p.x, terrain.heightAt(p.x, p.z) - 0.05, p.z, rng() * 6.28, sz, sz * (0.9 + rng() * 0.35), sz), c.clone(), p.x, p.z);
      n++; stats.cacti = n;
    }
    for (let tries = 0, n = 0; tries < 3000 && n < 130; tries++) {
      const p = pick(rng, 0, L, 8, 60, 1.5);
      if (!legal(p.x, p.z, 7.6)) continue;
      const sz = 0.6 + rng() * 0.7;
      const target = rng() < 0.55 ? barrelS : pearS;
      target.add(compose(p.x, terrain.heightAt(p.x, p.z) - 0.04, p.z, rng() * 6.28, sz, sz, sz), null, p.x, p.z);
      n++; stats.cacti += 1;
    }
    for (let tries = 0, n = 0; tries < 5000 && n < 420; tries++) {
      const p = pick(rng, 0, L, 7.8, 55, 1.4);
      if (!legal(p.x, p.z, 7.5)) continue;
      const sz = 0.7 + rng() * 1.0;
      c.setRGB(0.85 + rng() * 0.3, 0.9 + rng() * 0.2, 0.8 + rng() * 0.2);
      bushS.add(compose(p.x, terrain.heightAt(p.x, p.z) - 0.03, p.z, rng() * 6.28, sz, sz * 0.9, sz), c.clone(), p.x, p.z);
      n++; stats.bushes = n;
    }
    for (let tries = 0, n = 0; tries < 9000 && n < 1500; tries++) {
      const p = pick(rng, 0, L, 7.3, 40, 1.2);
      if (!legal(p.x, p.z, 7.2, false)) continue;
      const sz = 0.8 + rng() * 1.1;
      c.setRGB(0.85 + rng() * 0.3, 0.85 + rng() * 0.25, 0.7 + rng() * 0.3);
      grassS.add(compose(p.x, terrain.heightAt(p.x, p.z) - 0.02, p.z, rng() * 6.28, sz, sz, sz), c.clone(), p.x, p.z);
      n++; stats.grass = n;
    }
    const flowerCols = [0xffd34a, 0xff7ab0, 0xb98aff, 0xffffff, 0xff8a3a];
    for (let tries = 0, n = 0; tries < 6000 && n < 520; tries++) {
      const p = pick(rng, 0, L, 7.6, 30, 1.3);
      if (!legal(p.x, p.z, 7.4)) continue;
      // clusters of 3
      c.set(flowerCols[Math.floor(rng() * flowerCols.length)]);
      for (let k = 0; k < 3; k++) {
        const x = p.x + (rng() - 0.5) * 1.6, z = p.z + (rng() - 0.5) * 1.6;
        if (!legal(x, z, 7.2)) continue;
        flowerS.add(compose(x, terrain.heightAt(x, z), z, rng() * 6, 1, 0.8 + rng() * 0.8, 1), c.clone(), x, z);
        n++;
      }
      stats.flowers = n;
    }
  }
  for (const s of [...rockVariants, cactusS, barrelS, pearS, bushS, grassS, flowerS]) s.build(group);

  // ---- hoodoos (balanced rock stacks) along the winding stage and near the tunnel ----
  {
    const rng = mulberry32(4242);
    const hs = [0, 1].map((i) => new Scatter(hoodooGeometry(3 + i * 2), swayMaterial(0, { roughness: 0.95 }), { castShadow: true }));
    let n = 0;
    for (let tries = 0; tries < 800 && n < 26; tries++) {
      const winding = rng() < 0.7;
      const p = winding ? pick(rng, m.winding, m.bridgeA - 30, 20, 70, 1.0) : pick(rng, m.tunnelExit - 80, m.ret + 60, 22, 60, 1.0);
      if (!legal(p.x, p.z, 18)) continue;
      const sz = 0.9 + rng() * 1.2;
      hs[n % 2].add(compose(p.x, terrain.heightAt(p.x, p.z) - 0.2, p.z, rng() * 6.28, sz, sz * (1 + rng() * 0.8), sz), null, p.x, p.z);
      n++;
    }
    hs.forEach((s) => s.build(group));
    stats.hoodoos = n;
  }

  // ---- mesas, buttes and distant mountains (cast no shadows; far from the road) ----
  {
    const rng = mulberry32(99);
    const mesaMat = swayMaterial(0, { roughness: 1 });
    const variants = [mesaGeometry(1), mesaGeometry(5, [[1.2, 0], [1.0, 0.18], [0.8, 0.22], [0.78, 0.62], [0.6, 0.66], [0.58, 1.0], [0, 1.0]]), mesaGeometry(9, [[1.1, 0], [0.9, 0.2], [0.7, 0.3], [0.62, 0.7], [0.5, 1.0], [0, 1.0]])];
    const sc = variants.map((g) => new Scatter(g, mesaMat, { receiveShadow: false }));
    const placed = [];
    // Interior and exterior candidates: sample the map, keep spots far from the road and from each other.
    for (let tries = 0, n = 0; tries < 4000 && n < 22; tries++) {
      const x = lerp(-420, 400, rng()), z = lerp(-260, 560, rng());
      const R = 16 + rng() * 34;
      route.nearest(x, z, near);
      if (near.d < R + 42) continue;
      if (placed.some((q) => (q.x - x) ** 2 + (q.z - z) ** 2 < (q.r + R + 30) ** 2)) continue;
      placed.push({ x, z, r: R });
      const H = R * (0.9 + rng() * 0.9) + 14;
      const y = terrain.heightAt(x, z);
      sc[n % 3].add(compose(x, y - 1.5, z, rng() * 6.28, R, H, R), null, x, z);
      n++; stats.mesas = n;
    }
    sc.forEach((s) => s.build(group));
    group.userData.mesas = placed;

    // distant mountain ring
    const peakGeo = (() => {
      const g = new THREE.ConeGeometry(1, 1, 7, 4).toNonIndexed();
      jitter(g, 0.18, 1.1, 3);
      g.translate(0, 0.5, 0);
      return colorize(g, (x, y, z, c) => { const k = 0.65 + 0.35 * smoothstep(0, 1, y); c.setRGB(0.55 * k + 0.12, 0.45 * k + 0.08, 0.52 * k + 0.12); });
    })();
    const peaks = new Scatter(peakGeo, swayMaterial(0, { roughness: 1, fog: true }), { receiveShadow: false });
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2 + rng() * 0.15;
      const R = 760 + rng() * 260;
      const x = -5 + Math.cos(a) * R * 1.15, z = 170 + Math.sin(a) * R;
      const w = 160 + rng() * 140, h = 90 + rng() * 150;
      peaks.add(compose(x, -8, z, rng() * 6.28, w, h, w), null, x, z);
    }
    peaks.cells = new Map([['all', [...peaks.cells.values()].flat()]]);   // one chunk: they are all far away
    peaks.build(group);
    stats.mesas += 34;
  }

  // ---- natural rock arch near the winding road ----
  {
    const b = new Batch();
    b.aoStrength = 0.3;
    const red = 0xb8583a, tan = 0xd08a5a;
    const g = new THREE.TorusGeometry(6.5, 2.4, 10, 22, Math.PI).toNonIndexed();
    jitter(g, 0.14, 0.9, 21);
    b.add(g, red, new THREE.Matrix4().makeTranslation(0, 4.2, 0), 'solid', true);
    for (const sx of [-6.5, 6.5]) {
      const pg = new THREE.CylinderGeometry(2.3, 3.4, 6.4, 10, 2).toNonIndexed();
      jitter(pg, 0.12, 0.8, 5 + sx);
      b.add(pg, tan, new THREE.Matrix4().makeTranslation(sx, 3.2, 0), 'solid', true);
    }
    const geo = b.geometry();
    const mat = swayMaterial(0, { roughness: 0.95 });
    const arches = [];
    const sArch = [m.winding + 85, m.winding + 205];
    sArch.forEach((s, i) => {
      route.at(s, P);
      const side = i === 0 ? -1 : 1, d = 34;
      const x = P.x + P.rx * side * d, z = P.z + P.rz * side * d;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, terrain.heightAt(x, z) - 0.3, z);
      mesh.rotation.y = Math.atan2(P.tx, P.tz) + Math.PI / 2 + i * 0.4;
      mesh.scale.setScalar(1.5 + i * 0.3);
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
      arches.push({ x, z });
    });
    group.userData.arches = arches;
    stats.other += 2;
  }

  // ---- roadside delineator posts on the open-road stages ----
  {
    const b = new Batch(); b.aoStrength = 0.2;
    b.box(0.1, 1.0, 0.1, 0, 0, 0, 0xf4f0e4);
    b.box(0.11, 0.2, 0.11, 0, 0.62, 0, 0xff7a1a);
    const geo = b.geometry();
    const sc = new Scatter(geo, swayMaterial(0), { castShadow: false });
    let n = 0;
    const ranges = [[m.mainEnd + 6, m.bridge - 40], [m.bridge + 40, m.tunnel - 30], [m.tunnelExit + 30, route.L - 40]];
    for (const [a, z] of ranges) {
      for (let s = a; s < z; s += 22) {
        for (const side of [-1, 1]) {
          route.at(s, P);
          const x = P.x + P.rx * side * 6.6, zz = P.z + P.rz * side * 6.6;
          sc.add(compose(x, terrain.heightAt(x, zz) + 0.0, zz, 0, 1, 1, 1), null, x, zz);
          n++;
        }
      }
    }
    sc.build(group);
    stats.other += n;
  }

  // ---- telegraph poles along the desert highway (one side), wires hang between them ----
  {
    const b = new Batch(); b.aoStrength = 0.25;
    b.cyl(0.14, 0.17, 8.4, 0, 0, 0, 0x6a4a2e, { seg: 7 });
    b.box(2.2, 0.14, 0.14, 0, 7.5, 0, 0x5a3e26);
    b.box(1.5, 0.12, 0.12, 0, 6.6, 0, 0x5a3e26);
    for (const x of [-0.9, 0.9]) b.cyl(0.05, 0.05, 0.16, x, 7.6, 0, 0xcfd9d8, { seg: 5 });
    const geo = b.geometry();
    const mat = swayMaterial(0);
    const poles = [];
    const sc = new Scatter(geo, mat, { castShadow: true });
    const segs = [[m.winding + 40, m.bridgeA - 20, 1], [m.tunnelExit + 20, route.L - 80, 1]];
    for (const [a, z, side] of segs) {
      for (let s = a; s < z; s += 46) {
        route.at(s, P);
        const x = P.x + P.rx * side * 11, zz = P.z + P.rz * side * 11;
        const y = terrain.heightAt(x, zz);
        sc.add(compose(x, y - 0.1, zz, Math.atan2(P.tx, P.tz) + Math.PI / 2, 1, 1, 1), null, x, zz);
        poles.push({ x, y, z: zz, yaw: Math.atan2(P.tx, P.tz) + Math.PI / 2, seg: a });
      }
    }
    sc.build(group);
    // wires: 3 sagging lines between consecutive poles of the same run
    const pos = [];
    for (let i = 0; i < poles.length - 1; i++) {
      const A = poles[i], B = poles[i + 1];
      if (A.seg !== B.seg) continue;
      for (const [off, h] of [[-0.9, 7.55], [0.9, 7.55], [0, 6.65]]) {
        const ax = A.x + Math.cos(A.yaw) * off, az = A.z - Math.sin(A.yaw) * off;
        const bx = B.x + Math.cos(B.yaw) * off, bz = B.z - Math.sin(B.yaw) * off;
        const N = 8;
        let px = ax, py = A.y + h, pz = az;
        for (let k = 1; k <= N; k++) {
          const t = k / N;
          const x = lerp(ax, bx, t), z = lerp(az, bz, t);
          const y = lerp(A.y + h, B.y + h, t) - 1.1 * Math.sin(Math.PI * t);
          pos.push(px, py, pz, x, y, z);
          px = x; py = y; pz = z;
        }
      }
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x3a2e28 })));
    stats.other += poles.length;
  }

  // ---- tumbleweeds ----
  const weeds = [];
  {
    const g = new THREE.IcosahedronGeometry(0.55, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x9a7440, wireframe: true, roughness: 1 });
    const rng = mulberry32(31);
    for (let i = 0; i < 7; i++) {
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = false;
      group.add(mesh);
      weeds.push({ mesh, s: rng() * L, side: rng() < 0.5 ? -1 : 1, d: 10 + rng() * 25, speed: 1.5 + rng() * 2, spin: rng() * 6, bounce: rng() * 6 });
    }
  }

  return {
    group, stats,
    mesaList: group.userData.mesas,
    update(dt) {
      timeU.value += dt;
      for (const w of weeds) {
        w.s = (w.s + w.speed * dt) % L;            // blow slowly along the road
        w.spin += dt * w.speed * 1.8;
        w.bounce += dt * 3;
        route.at(w.s, P);
        const x = P.x + P.rx * w.side * w.d, z = P.z + P.rz * w.side * w.d;
        const hop = Math.abs(Math.sin(w.bounce)) * 0.5;
        w.mesh.position.set(x, terrain.heightAt(x, z) + 0.45 + hop, z);
        w.mesh.rotation.set(w.spin, w.spin * 0.7, 0);
      }
    },
  };
}
