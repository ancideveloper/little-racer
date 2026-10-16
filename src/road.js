// Road ribbon (asphalt with markings), shoulders, curbs and sidewalks along the main street.

import * as THREE from 'three';
import { CFG } from './config.js';
import { smoothstep } from './util.js';

function asphaltTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#4a4744'; g.fillRect(0, 0, 128, 256);
  // grain
  for (let i = 0; i < 2600; i++) {
    const v = 60 + Math.random() * 40;
    g.fillStyle = `rgba(${v},${v - 3},${v - 6},0.35)`;
    g.fillRect(Math.random() * 128, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  // white edge lines
  g.fillStyle = '#e8e4d8';
  g.fillRect(8, 0, 3, 256); g.fillRect(117, 0, 3, 256);
  // dashed yellow centre line
  g.fillStyle = '#f2c230';
  g.fillRect(62, 0, 4, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

export function createRoad(route) {
  const W = CFG.ROAD_HALF_WIDTH;
  const stepS = 1.5;
  const n = Math.ceil(route.L / stepS);
  const ds = route.L / n;
  const p = {};
  const main0 = route.marks.mainStart - 6, main1 = route.marks.mainEnd + 6;
  const bridgeS = route.bridge.s, bridgeHalf = route.bridge.half;

  // --- asphalt strip (2 verts across, textured) ---
  const aPos = new Float32Array((n + 1) * 2 * 3), aUv = new Float32Array((n + 1) * 2 * 2), aCol = new Float32Array((n + 1) * 2 * 3);
  const aIdx = new Uint32Array(n * 6);
  // --- sides: per cross-section 6 verts: outer shoulder L, curb-top L, road edge L, road edge R, curb-top R, outer shoulder R
  const sPos = new Float32Array((n + 1) * 8 * 3), sCol = new Float32Array((n + 1) * 8 * 3);
  const sIdx = [];
  const tint = [1, 1, 1];
  for (let i = 0; i <= n; i++) {
    const s = i * ds;
    route.at(s, p);
    const stage = route.stageAt(s);
    // road tint per stage (return road is paler, worn)
    const t = stage === 5 ? [1.12, 0.98, 0.92] : stage === 3 ? [0.96, 0.9, 0.88] : [1, 1, 1];
    const lx = -p.rx, lz = -p.rz;                       // left = -right
    const y = p.y + 0.0;
    const idxA = i * 2;
    aPos.set([p.x + lx * W, y, p.z + lz * W], idxA * 3);
    aPos.set([p.x - lx * W, y, p.z - lz * W], (idxA + 1) * 3);
    aUv.set([0, s / 6], idxA * 2); aUv.set([1, s / 6], (idxA + 1) * 2);
    aCol.set(t, idxA * 3); aCol.set(t, (idxA + 1) * 3);
    if (i < n) {
      const a = idxA, b = idxA + 1, c = idxA + 2, d = idxA + 3;
      aIdx.set([a, b, c, b, d, c], i * 6);
    }

    // sidewalk factor: 1 on the main street (ramped), else 0 ; no shoulders on the bridge deck
    const sw = smoothstep(main0, main0 + 12, s) * (1 - smoothstep(main1 - 12, main1, s));
    const onBridge = Math.abs(route.arcDelta(s, bridgeS)) < bridgeHalf + 3;
    const shoulder = onBridge ? 0.01 : 1.5;
    const curbH = 0.17 * sw;
    const walk = 3.2 * sw;
    const base = i * 8;
    // order across (left to right): outerL, walkOuterL, curbTopL, edgeL | edgeR, curbTopR, walkOuterR, outerR
    const offs = [
      -(W + 0.18 + walk + shoulder), -(W + 0.18 + walk), -(W + 0.18), -W,
      W, W + 0.18, W + 0.18 + walk, W + 0.18 + walk + shoulder,
    ];
    const hs = [-0.38, curbH - 0.0, curbH, 0.0, 0.0, curbH, curbH, -0.38];
    // Left side offsets are measured along "right", so left = negative offsets.
    for (let k = 0; k < 8; k++) {
      const o = offs[k];
      sPos.set([p.x + p.rx * o, y + hs[k] - (k === 0 || k === 7 ? 0 : 0), p.z + p.rz * o], (base + k) * 3);
      // colour: sidewalk pale concrete, shoulder sandy gravel
      let c;
      if (k === 1 || k === 2 || k === 5 || k === 6) c = sw > 0.01 ? [0.78, 0.74, 0.68] : [0.66, 0.58, 0.46];
      else if (k === 0 || k === 7) c = [0.66, 0.57, 0.45];
      else c = [0.7, 0.68, 0.64];
      if (k === 1 || k === 6) { c = sw > 0.01 ? [0.74, 0.7, 0.64] : [0.66, 0.58, 0.46]; }
      sCol.set(c, (base + k) * 3);
    }
    if (i < n) {
      const nb = (i + 1) * 8;
      for (let k = 0; k < 7; k++) {
        if (k === 3) continue;                           // the asphalt itself is drawn separately
        const a = base + k, b = base + k + 1, c = nb + k, d = nb + k + 1;
        sIdx.push(a, b, c, b, d, c);
      }
    }
  }
  const aGeo = new THREE.BufferGeometry();
  aGeo.setAttribute('position', new THREE.BufferAttribute(aPos, 3));
  aGeo.setAttribute('uv', new THREE.BufferAttribute(aUv, 2));
  aGeo.setAttribute('color', new THREE.BufferAttribute(aCol, 3));
  aGeo.setIndex(new THREE.BufferAttribute(aIdx, 1));
  aGeo.computeVertexNormals();
  const asphalt = new THREE.Mesh(aGeo, new THREE.MeshStandardMaterial({
    map: asphaltTexture(), vertexColors: true, roughness: 0.88, metalness: 0,
  }));
  asphalt.receiveShadow = true;

  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  sGeo.setIndex(sIdx);
  sGeo.computeVertexNormals();
  const sides = new THREE.Mesh(sGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
  sides.receiveShadow = true;

  const group = new THREE.Group();
  group.add(asphalt, sides);
  return { group, asphalt, sides };
}
