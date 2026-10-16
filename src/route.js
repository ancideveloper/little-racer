// The closed road loop: a centripetal Catmull-Rom curve in the XZ plane plus a
// periodic elevation profile, resampled to a uniform arc-length table.
// Everything else (road mesh, car, camera, scenery) queries the route by arc length `s`.

import * as THREE from 'three';
import { CFG } from './config.js';
import { wrap } from './util.js';

// Control points [x, z, mark?] (x east, z south, travel starts heading east).
// The bridge (pt 20) and tunnel (pt 24) sit on dead-straight runs of collinear points.
const CTRL = [
  [-140, 0, 'start'], [-100, 0, 'mainStart'], [-60, -2], [-10, 0], [40, 3], [90, 1],
  [140, -2, 'mainEnd'], [185, 6], [222, 30, 'yard'], [240, 72], [232, 118, 'motel'],
  [205, 160], [215, 205, 'winding'], [250, 245], [232, 292], [195, 318], [155, 332],
  [122, 338], [90, 338, 'bridgeA'], [50, 338], [10, 338, 'bridge'], [-30, 338], [-70, 338],
  [-110, 338], [-150, 338, 'tunnel'], [-190, 338], [-230, 338, 'tunnelExit'], [-268, 318],
  [-282, 270, 'ret'], [-255, 225], [-272, 178], [-252, 128], [-258, 78],
  [-232, 36, 'back'], [-192, 8],
];

export const STAGE_NAMES = [
  'entrance', 'mainStreet', 'friends', 'winding', 'bridgeTunnel', 'returnRoad', 'reconnect',
];

/** Smooth periodic bump centred on arc position c (wraps around the loop). */
function bump(s, L, c, sigma, h) {
  let d = Math.abs(s - c);
  d = Math.min(d, L - d);
  return h * Math.exp(-(d * d) / (2 * sigma * sigma));
}

export function buildRoute() {
  const N = CFG.ROUTE_SAMPLES;
  const pts = CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');

  // 1) dense polyline -> cumulative length -> uniform resample (XZ only)
  const dense = curve.getPoints(N * 4);        // closed: last point repeats the first
  const cum = new Float64Array(dense.length);
  for (let i = 1; i < dense.length; i++) {
    cum[i] = cum[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].z - dense[i - 1].z);
  }
  const L = cum[cum.length - 1];
  const ds = L / N;
  const px = new Float64Array(N + 1), pz = new Float64Array(N + 1);
  let j = 0;
  for (let i = 0; i <= N; i++) {
    const target = i * ds;
    while (j < dense.length - 2 && cum[j + 1] < target) j++;
    const seg = cum[j + 1] - cum[j] || 1;
    const t = (target - cum[j]) / seg;
    px[i] = dense[j].x + (dense[j + 1].x - dense[j].x) * t;
    pz[i] = dense[j].z + (dense[j + 1].z - dense[j].z) * t;
  }
  px[N] = px[0]; pz[N] = pz[0];                 // exact wrap

  // 2) marks (arc positions of named control points)
  const marks = {};
  CTRL.forEach(([x, z, name]) => {
    if (!name) return;
    let best = 0, bd = Infinity;
    for (let i = 0; i < N; i++) {
      const d = (px[i] - x) ** 2 + (pz[i] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    marks[name] = best * ds;
  });

  // 3) elevation: gentle hills and a valley at the bridge, flat through town
  const py = new Float64Array(N + 1);
  const elev = (s) => (
    bump(s, L, marks.yard + 40, 55, 3.2) +
    bump(s, L, marks.winding + 60, 85, 7) +
    bump(s, L, marks.winding + 190, 45, -2.5) +
    bump(s, L, marks.bridge, 60, -3) +
    bump(s, L, marks.tunnel + 10, 70, 5) +
    bump(s, L, marks.ret + 70, 55, 3.5) +
    bump(s, L, marks.ret + 210, 40, -1.5)
  );
  for (let i = 0; i <= N; i++) py[i] = elev(wrap(i * ds, L));
  py[N] = py[0];

  // 4) 3D unit tangents by central differences (periodic)
  const tx = new Float64Array(N + 1), ty = new Float64Array(N + 1), tz = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) {
    const a = (i - 1 + N) % N, b = (i + 1) % N;
    const x = px[b] - px[a], y = py[b] - py[a], z = pz[b] - pz[a];
    const l = Math.hypot(x, y, z);
    tx[i] = x / l; ty[i] = y / l; tz[i] = z / l;
  }
  tx[N] = tx[0]; ty[N] = ty[0]; tz[N] = tz[0];

  // 5) stage ranges by marks
  const stageStarts = [
    0, marks.mainStart, marks.mainEnd, marks.winding, marks.bridgeA, marks.tunnelExit + 25, marks.back,
  ];
  const stageAt = (s) => {
    s = wrap(s, L);
    let k = 0;
    for (let i = 0; i < stageStarts.length; i++) if (s >= stageStarts[i]) k = i;
    return k;
  };

  // 6) spatial hash for nearest-point queries
  const CELL = 14, STEP = 4;                     // index step between hashed samples
  const grid = new Map();
  const key = (cx, cz) => cx * 73856093 ^ cz * 19349663;
  for (let i = 0; i < N; i += STEP) {
    const k = key(Math.floor(px[i] / CELL), Math.floor(pz[i] / CELL));
    let arr = grid.get(k);
    if (!arr) grid.set(k, (arr = []));
    arr.push(i);
  }

  // coarse grid for far-away queries (terrain far from the road, distant scenery)
  const CELL2 = 64, STEP2 = 24;
  const grid2 = new Map();
  for (let i = 0; i < N; i += STEP2) {
    const k = key(Math.floor(px[i] / CELL2), Math.floor(pz[i] / CELL2));
    let arr = grid2.get(k);
    if (!arr) grid2.set(k, (arr = []));
    arr.push(i);
  }

  const route = {
    L, N, ds, marks, stageAt, stageStarts, px, py, pz, tx, ty, tz,
    bridge: { s: marks.bridge, half: 24, gorgeHalf: 32 },
    tunnel: { s: marks.tunnel, half: 21 },

    /** Fill `out` with position, tangent and right vector at arc length s (cubic Hermite). */
    at(s, out) {
      s = wrap(s, L);
      const f = s / ds;
      const i = Math.min(Math.floor(f), N - 1);
      const t = f - i;
      const t2 = t * t, t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
      out.x = h00 * px[i] + h10 * ds * tx[i] + h01 * px[i + 1] + h11 * ds * tx[i + 1];
      out.y = h00 * py[i] + h10 * ds * ty[i] + h01 * py[i + 1] + h11 * ds * ty[i + 1];
      out.z = h00 * pz[i] + h10 * ds * tz[i] + h01 * pz[i + 1] + h11 * ds * tz[i + 1];
      let x = tx[i] + (tx[i + 1] - tx[i]) * t;
      let y = ty[i] + (ty[i + 1] - ty[i]) * t;
      let z = tz[i] + (tz[i + 1] - tz[i]) * t;
      const l = Math.hypot(x, y, z) || 1;
      out.tx = x /= l; out.ty = y /= l; out.tz = z /= l;
      const hl = Math.hypot(x, z) || 1;          // right = forward x up (horizontal)
      out.rx = -z / hl; out.rz = x / hl;
      return out;
    },

    /** Nearest route point to (x,z): out = {d (horizontal distance), s, y, side (+ = right)}. */
    nearest(x, z, out) {
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      let best = -1, bd = Infinity;
      for (let a = -2; a <= 2; a++) {
        for (let b = -2; b <= 2; b++) {
          const arr = grid.get(key(cx + a, cz + b));
          if (!arr) continue;
          for (let q = 0; q < arr.length; q++) {
            const i = arr[q];
            const d = (px[i] - x) ** 2 + (pz[i] - z) ** 2;
            if (d < bd) { bd = d; best = i; }
          }
        }
      }
      if (best < 0 || bd > (CELL * 1.5) ** 2) {      // far from the road: use the coarse grid
        const c2x = Math.floor(x / CELL2), c2z = Math.floor(z / CELL2);
        let b2 = -1; bd = Infinity;
        for (let r = 2; r <= 8 && b2 < 0; r += 3) {
          for (let a = -r; a <= r; a++) {
            for (let b = -r; b <= r; b++) {
              const arr = grid2.get(key(c2x + a, c2z + b));
              if (!arr) continue;
              for (let q = 0; q < arr.length; q++) {
                const i = arr[q];
                const d = (px[i] - x) ** 2 + (pz[i] - z) ** 2;
                if (d < bd) { bd = d; b2 = i; }
              }
            }
          }
        }
        if (b2 < 0) { out.d = 9999; out.s = 0; out.y = 0; out.side = 0; return out; }
        best = b2;
        for (let i = b2 - STEP2; i <= b2 + STEP2; i++) {
          const k = (i + N) % N;
          const d = (px[k] - x) ** 2 + (pz[k] - z) ** 2;
          if (d < bd) { bd = d; best = k; }
        }
        bd = (px[best] - x) ** 2 + (pz[best] - z) ** 2;
      }
      // refine within +-STEP samples
      let bi = best;
      for (let i = best - STEP; i <= best + STEP; i++) {
        const k = (i + N) % N;
        const d = (px[k] - x) ** 2 + (pz[k] - z) ** 2;
        if (d < bd) { bd = d; bi = k; }
      }
      const hl = Math.hypot(tx[bi], tz[bi]) || 1;
      const rx = -tz[bi] / hl, rz = tx[bi] / hl;
      out.d = Math.sqrt(bd);
      out.s = bi * ds;
      out.y = py[bi];
      out.side = (x - px[bi]) * rx + (z - pz[bi]) * rz;
      return out;
    },

    /** Signed arc distance a - b wrapped into [-L/2, L/2]. */
    arcDelta(a, b) {
      let d = wrap(a - b, L);
      return d > L / 2 ? d - L : d;
    },
  };
  return route;
}
