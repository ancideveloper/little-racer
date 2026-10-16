// Sky dome, fog, lights (with a shadow map that follows the car), environment map and drifting clouds.

import * as THREE from 'three';
import { mulberry32 } from './util.js';

export const SKY = {
  zenith: new THREE.Color(0x2f7fd8),
  mid: new THREE.Color(0x8cc4f0),
  horizon: new THREE.Color(0xf6dcb4),
  fog: new THREE.Color(0xeed5b2),
  sunDir: new THREE.Vector3(-0.55, 0.62, 0.42).normalize(),
};

const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const skyFrag = /* glsl */ `
  uniform vec3 zenith; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir;
  varying vec3 vDir;
  void main() {
    float h = clamp(vDir.y, -0.2, 1.0);
    vec3 col = mix(horizon, mid, smoothstep(0.0, 0.28, h));
    col = mix(col, zenith, smoothstep(0.25, 0.95, h));
    float sd = max(dot(normalize(vDir), sunDir), 0.0);
    col += vec3(1.0, 0.82, 0.55) * (pow(sd, 6.0) * 0.28 + pow(sd, 220.0) * 1.4);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

function makeSkyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      zenith: { value: SKY.zenith }, mid: { value: SKY.mid },
      horizon: { value: SKY.horizon }, sunDir: { value: SKY.sunDir },
    },
    vertexShader: skyVert, fragmentShader: skyFrag,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
}

/** Concatenate several transformed sphere geometries into one cloud geometry with a shaded vertex gradient. */
function makeCloudGeometry(rand) {
  const parts = [];
  const n = 5 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const g = new THREE.SphereGeometry(1, 10, 8);
    const r = 0.7 + rand() * 0.6;
    g.scale(r * 1.2, r * 0.7, r);
    g.translate((i - n / 2) * 0.9 + rand() * 0.4, rand() * 0.35, (rand() - 0.5) * 0.8);
    parts.push(g);
  }
  let vcount = 0, icount = 0;
  parts.forEach((g) => { vcount += g.attributes.position.count; icount += g.index.count; });
  const pos = new Float32Array(vcount * 3), col = new Float32Array(vcount * 3), idx = new Uint32Array(icount);
  let vo = 0, io = 0;
  parts.forEach((g) => {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      pos.set([p.getX(i), p.getY(i), p.getZ(i)], (vo + i) * 3);
      const t = Math.min(1, Math.max(0, (p.getY(i) + 0.8) / 1.8));
      col.set([0.78 + 0.22 * t, 0.82 + 0.18 * t, 0.9 + 0.1 * t], (vo + i) * 3);   // cool underside, white top
    }
    for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo;
    vo += p.count; io += g.index.count;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

export function createSky(scene, renderer, { shadowSize = 2048 } = {}) {
  scene.fog = new THREE.Fog(SKY.fog, 90, 820);

  const dome = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), makeSkyMaterial());
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  scene.add(dome);

  // Image-based lighting source for glossy materials (car paint, chrome, glass): PMREM of the same sky.
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), makeSkyMaterial()));
  const warmFloor = new THREE.Mesh(
    new THREE.CircleGeometry(60, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xc58a55 }),
  );
  warmFloor.position.y = -2;
  envScene.add(warmFloor);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(envScene, 0, 0.1, 200).texture;
  pmrem.dispose();

  // Lights
  const hemi = new THREE.HemisphereLight(0xc4dcff, 0xc08050, 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe6c0, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  const SH = 42;                                   // half-size of the shadow box around the car (m)
  Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 220 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
  // soft cool fill from the opposite side so shaded facades never go black (no shadows, cheap)
  const fill = new THREE.DirectionalLight(0xc8dcff, 0.75);
  fill.position.set(0.55, 0.4, -0.65);
  scene.add(fill);

  // Clouds
  const rand = mulberry32(77);
  const cloudMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.96 });
  const clouds = [];
  for (let v = 0; v < 3; v++) {
    const geo = makeCloudGeometry(rand);
    const mesh = new THREE.InstancedMesh(geo, cloudMat, 6);
    mesh.frustumCulled = false;
    const items = [];
    for (let i = 0; i < 6; i++) {
      items.push({
        x: (rand() - 0.5) * 2200, y: 230 + rand() * 120, z: (rand() - 0.5) * 2200,
        s: 50 + rand() * 60, speed: 2.5 + rand() * 3.5, yaw: rand() * 3,
      });
    }
    scene.add(mesh);
    clouds.push({ mesh, items });
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  const snap = new THREE.Vector3();
  return {
    envMap, sun, hemi, dome,

    /** Call every frame with the car position and camera position. */
    update(dt, focus, camPos) {
      dome.position.copy(camPos);
      // texel-snapped shadow box centred on the car so shadows do not shimmer
      const texel = (2 * SH) / sun.shadow.mapSize.x;
      snap.set(Math.round(focus.x / texel) * texel, focus.y, Math.round(focus.z / texel) * texel);
      sun.target.position.copy(snap);
      sun.position.copy(snap).addScaledVector(SKY.sunDir, 110);
      sun.target.updateMatrixWorld();

      for (const c of clouds) {
        for (let i = 0; i < c.items.length; i++) {
          const it = c.items[i];
          it.x += it.speed * dt;
          if (it.x > 1100) it.x -= 2200;
          q.setFromAxisAngle(up, it.yaw);
          sc.set(it.s, it.s * 0.8, it.s);
          p.set(it.x + camPos.x * 0.85, it.y, it.z + camPos.z * 0.85);
          m4.compose(p, q, sc);
          c.mesh.setMatrixAt(i, m4);
        }
        c.mesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
