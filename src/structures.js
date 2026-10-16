// The stone arch bridge over the dry gorge and the rock tunnel through a mesa spur.
// The tunnel is tall and wide (the camera always rides inside it, below the roof) and its shell is
// registered as a camera collider so the line-of-sight check can verify nothing hides the car.

import * as THREE from 'three';
import { Batch } from './batch.js';
import { mulberry32, valueNoise, lerp, smoothstep } from './util.js';

const P = {};

/** Build an indexed strip mesh from rings of vertices (rings: array of arrays of [x,y,z]). */
function ringStrip(rings, colorFn, flip = false) {
  const nr = rings.length, np = rings[0].length;
  const pos = new Float32Array(nr * np * 3), col = new Float32Array(nr * np * 3);
  const c = new THREE.Color();
  for (let i = 0; i < nr; i++) {
    for (let j = 0; j < np; j++) {
      const v = rings[i][j];
      pos.set(v, (i * np + j) * 3);
      colorFn(v, i, j, c);
      col[(i * np + j) * 3] = c.r; col[(i * np + j) * 3 + 1] = c.g; col[(i * np + j) * 3 + 2] = c.b;
    }
  }
  const idx = [];
  for (let i = 0; i < nr - 1; i++) {
    for (let j = 0; j < np - 1; j++) {
      const a = i * np + j, b = a + 1, c2 = a + np, d = c2 + 1;
      if (flip) idx.push(a, c2, b, b, c2, d); else idx.push(a, b, c2, b, d, c2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

export function createStructures({ route, terrain, envMap }) {
  const group = new THREE.Group();
  const colliders = [];
  const rng = mulberry32(555);

  // ===================== BRIDGE =====================
  {
    const bs = route.bridge.s, half = route.bridge.half;
    const stone = new THREE.Color(0xcfae82), stoneDark = new THREE.Color(0xa8845c), cap = new THREE.Color(0xe0c49a);
    const steps = Math.ceil((half * 2) / 3);
    const mkRings = (lat0, lat1, y0, y1) => {
      // rectangle cross-section rings along the deck: TL, TR, BR, BL, TL
      const rings = [];
      for (let i = 0; i <= steps; i++) {
        const s = bs - half + (i / steps) * half * 2;
        route.at(s, P);
        const pt = (lat, y) => [P.x + P.rx * lat, P.y + y, P.z + P.rz * lat];
        rings.push([pt(lat0, y1), pt(lat1, y1), pt(lat1, y0), pt(lat0, y0), pt(lat0, y1)]);
      }
      return rings;
    };
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
    // deck slab (the asphalt ribbon rides on top)
    const deck = new THREE.Mesh(ringStrip(mkRings(-5.7, 5.7, -1.5, -0.05), (v, i, j, c) => c.copy(j === 0 || j === 1 ? cap : stoneDark).multiplyScalar(j === 2 ? 0.7 : 1), true), mat);
    deck.geometry.computeVertexNormals();
    deck.castShadow = deck.receiveShadow = true;
    group.add(deck);
    // parapets
    for (const side of [-1, 1]) {
      const lat0 = side * 5.0, lat1 = side * 5.65;
      const par = new THREE.Mesh(ringStrip(mkRings(Math.min(lat0, lat1), Math.max(lat0, lat1), -0.05, 1.0), (v, i, j, c) => c.copy(stone), true), mat);
      par.geometry.computeVertexNormals();
      par.castShadow = par.receiveShadow = true;
      group.add(par);
    }
    // arches, piers (an extruded tombstone-holed wall seen from the side)
    route.at(bs, P);
    const f = new THREE.Vector3(P.tx, 0, P.tz).normalize();
    const r = new THREE.Vector3(P.rx, 0, P.rz);
    const sh = new THREE.Shape();
    sh.moveTo(-half, -17); sh.lineTo(half, -17); sh.lineTo(half, -1.45); sh.lineTo(-half, -1.45); sh.closePath();
    for (const cu of [-12, 12]) {
      const h = new THREE.Path();
      h.moveTo(cu - 6, -17); h.lineTo(cu - 6, -8.4);
      h.absarc(cu, -8.4, 6, Math.PI, 0, true);
      h.lineTo(cu + 6, -17); h.closePath();
      sh.holes.push(h);
    }
    const wallGeo = new THREE.ExtrudeGeometry(sh, { depth: 9.8, bevelEnabled: false, curveSegments: 16 }).translate(0, 0, -4.9);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xc79d70, roughness: 0.95 });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.matrixAutoUpdate = false;
    wall.matrix.makeBasis(f, new THREE.Vector3(0, 1, 0), r).setPosition(P.x, P.y, P.z);
    wall.castShadow = wall.receiveShadow = true;
    group.add(wall);

    // lamps and a stone finial at each corner
    const b = new Batch(); b.groundY = P.y - 20; b.aoStrength = 0;
    for (const u of [-half + 1.2, half - 1.2]) {
      for (const side of [-1, 1]) {
        route.at(bs + u, P);
        const x = P.x + P.rx * side * 5.35, z = P.z + P.rz * side * 5.35;
        b.box(0.8, 1.7, 0.8, x, P.y - 0.05, z, 0xdcc09a);
        b.cyl(0.07, 0.09, 2.1, x, P.y + 1.6, z, 0x2e2e32, { seg: 6 });
        b.sphere(0.24, x, P.y + 3.85, z, 0xfff0b8, { kind: 'glow', ao: false });
      }
    }
    // boulders on the dry river bed
    route.at(bs, P);
    for (let i = 0; i < 16; i++) {
      const u = (rng() - 0.5) * 50, lat = (rng() - 0.5) * 36;
      const x = P.x + P.tx * u + P.rx * lat, z = P.z + P.tz * u + P.rz * lat;
      const y = terrain.heightAt(x, z);
      const g = new THREE.IcosahedronGeometry(0.6 + rng() * 1.3, 1);
      const m4 = new THREE.Matrix4().makeTranslation(x, y + 0.2, z);
      b.add(g, 0x9a6a4a, m4, 'solid', false);
    }
    group.add(b.build(envMap));
  }

  // ===================== TUNNEL =====================
  {
    const ts = route.tunnel.s, half = route.tunnel.half;
    const slices = 16, extra = 0;
    const NIN = 17, NOUT = 21;
    const a = 6.6, wallH = 4.4, topH = 9.4;       // inner arch: half width, straight wall height, crown height
    const outerHalf = 21, outerH = 14;
    const innerRings = [], outerRings = [];
    const colCache = new THREE.Color();
    for (let k = 0; k <= slices; k++) {
      const u = -half + (k / slices) * half * 2;
      route.at(ts + u, P);
      const inner = [], outer = [];
      for (let i = 0; i < NIN; i++) {
        const t = i / (NIN - 1);
        let lat, y;
        if (t < 0.12) { lat = -a; y = lerp(-0.6, wallH, t / 0.12); }
        else if (t > 0.88) { lat = a; y = lerp(wallH, -0.6, (t - 0.88) / 0.12); }
        else { const phi = Math.PI * (1 - (t - 0.12) / 0.76); lat = a * Math.cos(phi); y = wallH + (topH - wallH) * Math.sin(phi); }
        inner.push([P.x + P.rx * lat, P.y + y, P.z + P.rz * lat]);
      }
      for (let i = 0; i < NOUT; i++) {
        const t = i / (NOUT - 1);
        const lat = (t * 2 - 1) * outerHalf;
        const prof = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t * 2 - 1), 2.1)), 0.75);
        const nz = valueNoise(i * 0.9 + 3, k * 0.5 + 8) * 2 - 1;
        const edge = i === 0 || i === NOUT - 1;
        const y = edge ? -4 : Math.max(topH + 1.6, outerH * prof + nz * 1.4);
        const latJ = lat + (edge ? 0 : (valueNoise(i * 0.5, k * 0.7 + 2) - 0.5) * 2.2);
        outer.push([P.x + P.rx * latJ, P.y + (edge ? -4 : Math.max(y, i < 3 || i > NOUT - 4 ? 2 : topH + 1.6)), P.z + P.rz * latJ]);
      }
      innerRings.push(inner); outerRings.push(outer);
    }
    const rock = (v, i, j, c) => {
      const y = v[1];
      const band = 0.5 + 0.5 * Math.sin(y * 1.7 + v[0] * 0.05);
      const k = 0.75 + 0.25 * smoothstep(-4, 8, y - innerRings[0][0][1]);
      c.setRGB((0.66 + 0.14 * band) * k, (0.34 + 0.08 * band) * k, (0.24 + 0.05 * band) * k);
    };
    const inside = (v, i, j, c) => { const k = 0.62 + 0.2 * (j / NIN); c.setRGB(0.78 * k * 1.5, 0.5 * k * 1.5, 0.36 * k * 1.5); };
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, side: THREE.DoubleSide });
    const outerGeo = ringStrip(outerRings, rock, false);
    outerGeo.computeVertexNormals();
    const innerGeo = ringStrip(innerRings, inside, true);
    innerGeo.computeVertexNormals();
    // portal faces: connect outer ring to inner ring at both ends (ring index 0 and last)
    const portalRings = (k) => {
      const A = [], B = [];
      for (let i = 0; i < NIN; i++) {
        const t = i / (NIN - 1);
        const oi = Math.round(t * (NOUT - 1));
        A.push(outerRings[k][oi]); B.push(innerRings[k][i]);
      }
      return [A, B];
    };
    const portals = [];
    for (const k of [0, slices]) {
      const [A, B] = portalRings(k);
      portals.push(ringStrip([A, B], rock, k === 0));
    }
    const shell = new THREE.Group();
    [outerGeo, innerGeo, ...portals].forEach((g) => {
      const m = new THREE.Mesh(g, mat);
      m.castShadow = m.receiveShadow = true;
      shell.add(m);
    });
    group.add(shell);
    // collider = outer + inner geometry as one mesh for the camera ray test
    route.at(ts, P);
    shell.children.forEach((m) => {
      m.geometry.computeBoundingSphere();
      colliders.push({ mesh: m, cx: P.x, cz: P.z, r: 30 });
    });

    // timber portal frames, ceiling lamps and a keystone
    const b = new Batch(); b.groundY = P.y; b.aoStrength = 0.25;
    for (const end of [-1, 1]) {
      route.at(ts + end * (half + 0.15), P);
      const yaw = Math.atan2(P.tx, P.tz);
      const place = (lat, y, w, h, d) => ({ x: P.x + P.rx * lat, y: P.y + y, z: P.z + P.rz * lat });
      for (const side of [-1, 1]) {
        const p = place(side * (a + 0.2), 0);
        b.box(0.55, wallH + 0.9, 0.55, p.x, p.y, p.z, 0x7a4e2c, { ry: yaw });
      }
      // little warning lamps on the lintel
      for (const side of [-1, 1]) {
        const p = place(side * 4.2, wallH + 2.6);
        b.sphere(0.2, p.x, p.y, p.z, 0xffc24a, { kind: 'glow', ao: false });
      }
    }
    for (let u = -half + 4; u < half; u += 8) {
      route.at(ts + u, P);
      for (const side of [-1, 1]) {
        const lat = side * 3.4;
        b.sphere(0.22, P.x + P.rx * lat, P.y + 8.1, P.z + P.rz * lat, 0xffd27a, { kind: 'glow', ao: false });
      }
    }
    group.add(b.build(envMap, { castShadow: false }));
  }

  return { group, colliders };
}
