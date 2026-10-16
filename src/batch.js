// Static geometry batching: many small coloured primitives are baked (with a cheap vertex-colour
// ambient-occlusion gradient near the ground) and merged into a handful of meshes per material kind.
// Landmarks and town props use this so the whole town costs only a few draw calls.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { smoothstep } from './util.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _c = new THREE.Color();

const materialCache = new WeakMap();
/** One material set per environment map, shared by every batch (keeps material count and shader programs low). */
function sharedMaterials(env) {
  let m = materialCache.get(env);
  if (m) return m;
  m = {
    solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.6, envMap: env, envMapIntensity: 0.7 }),
    chrome: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.14, metalness: 1, envMap: env, envMapIntensity: 1.1 }),
    glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.25, envMap: env, envMapIntensity: 1.3, side: THREE.DoubleSide }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    glossy: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.1, envMap: env, envMapIntensity: 0.6 }),
  };
  materialCache.set(env, m);
  return m;
}

export class Batch {
  constructor() {
    this.parts = {};            // kind -> geometries
    this.groundY = 0;           // world height treated as "ground" for baked AO
    this.aoStrength = 0.4;
  }

  /** Add any geometry (already positioned in batch space via matrix) with a flat colour. */
  add(geo, color, matrix, kind = 'solid', ao = true) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    g.deleteAttribute('uv');
    if (g.getAttribute('uv1')) g.deleteAttribute('uv1');
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    _c.set(color);
    for (let i = 0; i < pos.count; i++) {
      let k = 1;
      if (ao) k = 1 - this.aoStrength * (1 - smoothstep(0, 1.6, pos.getY(i) - this.groundY));
      col[i * 3] = _c.r * k; col[i * 3 + 1] = _c.g * k; col[i * 3 + 2] = _c.b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    (this.parts[kind] ||= []).push(g);
    return g;
  }

  /** Placement helper: position (x,y,z) with Euler rotation (rx, ry, rz). */
  _mat(x, y, z, o = {}) {
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ');
    _q.setFromEuler(_e);
    return _m.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(o.sx || 1, o.sy || 1, o.sz || 1)).clone();
  }

  /** Box whose BOTTOM centre is at (x,y,z). */
  box(w, h, d, x, y, z, color, o = {}) {
    return this.add(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), color, this._mat(x, y, z, o), o.kind, o.ao);
  }
  /** Cylinder whose bottom centre is at (x,y,z). */
  cyl(rTop, rBot, h, x, y, z, color, o = {}) {
    return this.add(new THREE.CylinderGeometry(rTop, rBot, h, o.seg || 14, 1, o.open).translate(0, h / 2, 0), color, this._mat(x, y, z, o), o.kind, o.ao);
  }
  /** Cone whose base centre is at (x,y,z). */
  cone(r, h, x, y, z, color, o = {}) {
    return this.cyl(0, r, h, x, y, z, color, o);
  }
  /** Sphere centred at (x,y,z). */
  sphere(r, x, y, z, color, o = {}) {
    return this.add(new THREE.SphereGeometry(r, o.seg || 14, o.seg ? o.seg * 0.7 : 10), color, this._mat(x, y, z, o), o.kind, o.ao);
  }
  /** Torus centred at (x,y,z) (ring in XY plane by default). */
  torus(R, r, x, y, z, color, o = {}) {
    return this.add(new THREE.TorusGeometry(R, r, o.tseg || 10, o.seg || 24, o.arc || Math.PI * 2), color, this._mat(x, y, z, o), o.kind, o.ao);
  }
  /** Extruded 2D shape (XY) with depth along Z, centred in Z. */
  extrude(shape, depth, x, y, z, color, o = {}) {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: o.curveSegments || 12 }).translate(0, 0, -depth / 2);
    return this.add(g, color, this._mat(x, y, z, o), o.kind, o.ao);
  }
  /** Flat quad (plane) facing +Z at (x,y,z), centre-anchored. */
  plane(w, h, x, y, z, color, o = {}) {
    return this.add(new THREE.PlaneGeometry(w, h), color, this._mat(x, y, z, o), o.kind, o.ao === undefined ? false : o.ao);
  }

  /** Merge the parts of one kind into a single geometry (for instancing) and clear them. */
  geometry(kind = 'solid') {
    const merged = mergeGeometries(this.parts[kind], false);
    this.parts[kind].forEach((g) => g.dispose());
    this.parts[kind] = [];
    return merged;
  }

  /** Merge into meshes. `env` is the PMREM environment used by glossy kinds. */
  build(env, { castShadow = true, receiveShadow = true } = {}) {
    const group = new THREE.Group();
    const materials = sharedMaterials(env);
    for (const [kind, geos] of Object.entries(this.parts)) {
      if (!geos.length) continue;
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(merged, materials[kind] || materials.solid);
      mesh.castShadow = castShadow && kind !== 'glass' && kind !== 'glow';
      mesh.receiveShadow = receiveShadow && kind !== 'glow';
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    this.parts = {};
    return group;
  }
}
