// Particle effects with fixed, pre-allocated pools (dust, exhaust smoke, sparks/stars).
// Emission scales with speed and tap rate; nothing is spawned while the car is stopped except a faint idle exhaust.

import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp } from './util.js';

const vert = /* glsl */ `
  attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
  uniform float uScale;
  varying float vAlpha; varying vec3 vColor;
  void main() {
    vAlpha = aAlpha; vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(aSize * uScale / max(-mv.z, 0.1), 0.0);
  }`;
const frag = /* glsl */ `
  varying float vAlpha; varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.25, d) * vAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vColor, a);
    #include <colorspace_fragment>
  }`;

function makePool(n, additive) {
  const P = {
    n, cursor: 0, alive: 0, spawned: 0,
    pos: new Float32Array(n * 3), vel: new Float32Array(n * 3), col: new Float32Array(n * 3),
    size: new Float32Array(n), alpha: new Float32Array(n),
    life: new Float32Array(n), maxLife: new Float32Array(n), s0: new Float32Array(n), s1: new Float32Array(n),
    a0: new Float32Array(n), grav: new Float32Array(n), drag: new Float32Array(n),
  };
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P.pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(P.size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(P.alpha, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aColor', new THREE.BufferAttribute(P.col, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uScale: { value: 500 } },
  });
  P.points = new THREE.Points(geo, mat);
  P.points.frustumCulled = false;
  P.points.renderOrder = 5;
  P.geo = geo; P.mat = mat;
  return P;
}

function spawn(P, x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a0, grav = 0, drag = 1) {
  const i = P.cursor;                       // ring buffer: the oldest particle is recycled when the pool is full
  P.cursor = (P.cursor + 1) % P.n;
  P.pos[i * 3] = x; P.pos[i * 3 + 1] = y; P.pos[i * 3 + 2] = z;
  P.vel[i * 3] = vx; P.vel[i * 3 + 1] = vy; P.vel[i * 3 + 2] = vz;
  P.col[i * 3] = r; P.col[i * 3 + 1] = g; P.col[i * 3 + 2] = b;
  P.life[i] = 0; P.maxLife[i] = life; P.s0[i] = s0; P.s1[i] = s1; P.a0[i] = a0; P.grav[i] = grav; P.drag[i] = drag;
  P.size[i] = s0; P.alpha[i] = a0;
  P.spawned++;
  P.geo.attributes.aColor.needsUpdate = true;
}

function stepPool(P, dt) {
  let alive = 0;
  for (let i = 0; i < P.n; i++) {
    if (P.maxLife[i] <= 0) continue;
    P.life[i] += dt;
    const t = P.life[i] / P.maxLife[i];
    if (t >= 1) { P.maxLife[i] = 0; P.size[i] = 0; P.alpha[i] = 0; continue; }
    alive++;
    const k = Math.max(0, 1 - P.drag[i] * dt);
    P.vel[i * 3] *= k; P.vel[i * 3 + 1] = P.vel[i * 3 + 1] * k + P.grav[i] * dt; P.vel[i * 3 + 2] *= k;
    P.pos[i * 3] += P.vel[i * 3] * dt; P.pos[i * 3 + 1] += P.vel[i * 3 + 1] * dt; P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
    P.size[i] = P.s0[i] + (P.s1[i] - P.s0[i]) * t;
    P.alpha[i] = P.a0[i] * Math.pow(1 - t, 1.3);
  }
  P.alive = alive;
  P.geo.attributes.position.needsUpdate = true;
  P.geo.attributes.aSize.needsUpdate = true;
  P.geo.attributes.aAlpha.needsUpdate = true;
}

export function createEffects(scene, car) {
  const dust = makePool(260, false);
  const smoke = makePool(110, false);
  const spark = makePool(150, true);
  [dust, smoke, spark].forEach((p) => scene.add(p.points));

  const v = new THREE.Vector3(), fwd = new THREE.Vector3(), tmp = new THREE.Vector3();
  const acc = { dust: 0, smoke: 0, idle: 0 };
  const emitted = { dust: 0, smoke: 0, spark: 0, idle: 0 };
  const rnd = () => Math.random() - 0.5;
  const sandR = 0.9, sandG = 0.75, sandB = 0.55;

  function wheelPos(sx, out) {
    return car.root.localToWorld(out.set(sx * 0.9, 0.15, -1.35));
  }

  const fx = {
    pools: { dust, smoke, spark }, emitted,

    /** Burst on every tap: dust + sparks at the rear wheels, scaled by speed. */
    tapBurst(speed) {
      const sf = clamp(speed / CFG.MAX_SPEED, 0, 1);
      car.root.updateMatrixWorld(true);
      car.root.getWorldDirection(fwd);
      const nd = 4 + Math.round(8 * sf), ns = 4 + Math.round(5 * sf);
      for (const sx of [-1, 1]) {
        wheelPos(sx, v);
        for (let i = 0; i < nd; i++) {
          spawn(dust, v.x, v.y, v.z, -fwd.x * (1 + sf * 2) + sx * (0.8 + Math.random()) , 0.8 + Math.random() * 1.2, -fwd.z * (1 + sf * 2) + rnd(), 0.7 + Math.random() * 0.6, 0.5, 1.9 + sf, sandR, sandG, sandB, 0.5, -0.4, 1.6);
          emitted.dust++;
        }
        for (let i = 0; i < ns; i++) {
          spawn(spark, v.x, v.y + 0.1, v.z, -fwd.x * 1.5 + rnd() * 3 + sx * 1.5, 2 + Math.random() * 2.5, -fwd.z * 1.5 + rnd() * 3, 0.35 + Math.random() * 0.3, 0.2, 0.05, 1.0, 0.8 + Math.random() * 0.2, 0.3, 1, -7, 0.5);
          emitted.spark++;
        }
      }
    },

    /** Little hearts/stars over a friend that is waving. */
    cheer(pos) {
      for (let i = 0; i < 9; i++) {
        const pink = i % 2 === 0;
        spawn(spark, pos.x + rnd() * 1.2, pos.y + 2.6, pos.z + rnd() * 1.2, rnd() * 1.5, 1.2 + Math.random(), rnd() * 1.5, 1.1 + Math.random() * 0.5, 0.45, 0.15, 1, pink ? 0.45 : 0.9, pink ? 0.7 : 0.35, 0.9, 0.5, 0.8);
        emitted.spark++;
      }
    },

    update(dt, speed, tapRate, camera, viewH) {
      const sf = clamp(speed / CFG.MAX_SPEED, 0, 1);
      car.root.updateMatrixWorld(true);
      car.root.getWorldDirection(fwd);
      const driving = speed > 0.3;
      if (driving) {
        // rolling dust from the rear wheels and a trail behind the car
        acc.dust += (14 * Math.pow(sf, 1.2) + 18 * sf * sf + clamp(tapRate, 0, 8) * 3 * sf) * dt * 3;
        while (acc.dust >= 1) {
          acc.dust -= 1;
          wheelPos(Math.random() < 0.5 ? -1 : 1, v);
          spawn(dust, v.x + rnd() * 0.4, v.y, v.z + rnd() * 0.4, -fwd.x * speed * 0.15 + rnd() * 0.8, 0.5 + Math.random() * 0.7, -fwd.z * speed * 0.15 + rnd() * 0.8, 0.9 + Math.random() * 0.7, 0.35 + sf * 0.3, 1.4 + sf * 1.2, sandR, sandG, sandB, 0.22 + 0.2 * sf, -0.2, 1.2);
          emitted.dust++;
        }
        // exhaust grows with speed and tapping
        acc.smoke += (6 + 26 * sf + clamp(tapRate, 0, 8) * 3) * dt;
        while (acc.smoke >= 1) {
          acc.smoke -= 1;
          const e = car.exhaustPoints[Math.random() < 0.5 ? 0 : 1];
          car.root.localToWorld(tmp.copy(e));
          spawn(smoke, tmp.x, tmp.y, tmp.z, -fwd.x * (1 + sf * 2) + rnd() * 0.3, 0.3 + Math.random() * 0.4, -fwd.z * (1 + sf * 2) + rnd() * 0.3, 0.8 + Math.random() * 0.5, 0.18, 0.6 + sf * 0.5, 0.78, 0.78, 0.8, 0.28 + 0.1 * sf, 0.3, 1.0);
          emitted.smoke++;
        }
        acc.idle = 0;
      } else {
        // stopped: only a faint idle exhaust (a small puff every ~0.7 s)
        acc.idle += dt;
        if (acc.idle > 0.7) {
          acc.idle = 0;
          const e = car.exhaustPoints[Math.random() < 0.5 ? 0 : 1];
          car.root.localToWorld(tmp.copy(e));
          spawn(smoke, tmp.x, tmp.y, tmp.z, -fwd.x * 0.4, 0.25, -fwd.z * 0.4, 1.0, 0.12, 0.35, 0.8, 0.8, 0.82, 0.12, 0.25, 0.8);
          emitted.idle++;
        }
        acc.dust = 0; acc.smoke = 0;
      }
      stepPool(dust, dt); stepPool(smoke, dt); stepPool(spark, dt);
      const scale = viewH * 0.5 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      dust.mat.uniforms.uScale.value = smoke.mat.uniforms.uScale.value = spark.mat.uniforms.uScale.value = scale;
    },
  };
  return fx;
}
