// The hero car "Little Racer": procedural body (extruded profile), windshield eyes, smiling bumper,
// wheels that spin and steer, spring suspension and original number/bolt decals.

import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp } from './util.js';

// Local car axes: +Z forward, +Y up, +X is the car's LEFT.
export const CAR_BOUNDS = { halfW: 1.12, height: 1.9, zMin: -2.5, zMax: 2.42 };

/** Extrude a side-view profile (x = length along car, y = height) into a body with rounded edges. */
export function extrudeProfile(shape, width, bevel) {
  const depth = width - 2 * bevel;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel,
    bevelSegments: 6, curveSegments: 18,
  });
  geo.translate(0, 0, -depth / 2);
  geo.rotateY(-Math.PI / 2);                 // profile x -> +Z, extrusion axis -> X
  geo.computeVertexNormals();
  return geo;
}

function decalTexture(flip) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 1024, 256);
  g.save();
  if (flip) { g.translate(1024, 0); g.scale(-1, 1); }       // nose to the left or right
  // lightning bolt stripe running toward the nose (original zig-zag design)
  const bolt = [[40, 150], [250, 150], [330, 70], [380, 170], [500, 60], [560, 150], [760, 150], [840, 100], [990, 128], [840, 160], [760, 190], [560, 190], [500, 120], [380, 220], [330, 130], [250, 190], [40, 190]];
  g.beginPath();
  bolt.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fillStyle = '#ffd23a'; g.fill();
  g.lineWidth = 10; g.strokeStyle = '#ff8a1c'; g.lineJoin = 'round'; g.stroke();
  g.restore();
  // number roundel (always upright)
  g.beginPath(); g.arc(512, 128, 104, 0, Math.PI * 2);
  g.fillStyle = '#fff7e6'; g.fill();
  g.lineWidth = 10; g.strokeStyle = '#1b1b1b'; g.stroke();
  g.fillStyle = '#1b1b1b';
  g.font = 'bold 128px "Trebuchet MS", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('17', 512, 138);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

class Spring {
  constructor(k, c) { this.x = 0; this.v = 0; this.k = k; this.c = c; }
  step(target, dt) {
    this.v += (this.k * (target - this.x) - this.c * this.v) * dt;
    this.x += this.v * dt;
    return this.x;
  }
}

export function createVehicle(envMap) {
  const root = new THREE.Group();            // positioned on the road, oriented along it
  const body = new THREE.Group();            // suspension moves this
  root.add(body);

  const paint = new THREE.MeshPhysicalMaterial({
    color: 0xd1201a, roughness: 0.32, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08,
    envMap, envMapIntensity: 0.9,
  });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xf2f2f5, metalness: 1, roughness: 0.12, envMap, envMapIntensity: 1.2 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x173a5a, metalness: 0.2, roughness: 0.06, envMap, envMapIntensity: 1.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.6 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x232326, roughness: 0.85 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, envMap, envMapIntensity: 0.4 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffc928, roughness: 0.4, metalness: 0.2, envMap, envMapIntensity: 0.6 });

  const mesh = (geo, mat, parent = body) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  // ---- lower body ----
  const low = new THREE.Shape();
  low.moveTo(-2.1, 0.3);
  low.lineTo(1.95, 0.3);
  low.quadraticCurveTo(2.28, 0.3, 2.28, 0.7);
  low.quadraticCurveTo(2.28, 1.03, 1.9, 1.07);
  low.lineTo(1.0, 1.17);
  low.lineTo(-1.3, 1.17);
  low.quadraticCurveTo(-2.28, 1.2, -2.28, 0.74);
  low.quadraticCurveTo(-2.28, 0.3, -2.1, 0.3);
  mesh(extrudeProfile(low, 1.9, 0.2), paint);

  // ---- cabin ----
  const cab = new THREE.Shape();
  cab.moveTo(1.05, 1.08);
  cab.lineTo(0.4, 1.7);
  cab.quadraticCurveTo(0.12, 1.86, -0.42, 1.82);
  cab.quadraticCurveTo(-0.95, 1.77, -1.52, 1.12);
  cab.lineTo(-1.52, 1.08);
  cab.closePath();
  mesh(extrudeProfile(cab, 1.34, 0.2), paint);

  // windshield (dark glass slab on the front slope); the eyes sit on it
  const slopeA = new THREE.Vector2(1.05, 1.08), slopeB = new THREE.Vector2(0.4, 1.7);
  const slopeDir = slopeB.clone().sub(slopeA);
  const slopeLen = slopeDir.length(); slopeDir.normalize();
  const slopeN = new THREE.Vector2(-slopeDir.y, slopeDir.x);            // outward normal (z,y)
  if (slopeN.y < 0) slopeN.negate();
  const pitchAng = -Math.atan2(slopeN.y, slopeN.x);                      // rotation.x for a plane facing +Z
  const wsMid = slopeA.clone().addScaledVector(slopeDir, slopeLen * 0.52).addScaledVector(slopeN, 0.015);
  const ws = mesh(new THREE.PlaneGeometry(1.0, slopeLen * 0.8), glass);
  ws.position.set(0, wsMid.y, wsMid.x); ws.rotation.x = pitchAng;
  ws.castShadow = false;

  // rear window (plane tilted to lie on the rear slope, facing backward and up)
  const rw = mesh(new THREE.PlaneGeometry(0.86, 0.62), glass);
  rw.rotation.order = 'YXZ';
  rw.rotation.set(-0.76, Math.PI, 0);
  rw.position.set(0, 1.46, -1.2);
  rw.castShadow = false;

  // side windows (flat slabs on the cabin walls; shape x runs along the car's Z)
  const sideWin = new THREE.Shape();
  [[0.5, 1.3], [0.24, 1.5], [-0.4, 1.56], [-0.95, 1.4], [-1.1, 1.28]].forEach(([z, y], i) => (i ? sideWin.lineTo(z, y) : sideWin.moveTo(z, y)));
  sideWin.closePath();
  const sideGeo = new THREE.ShapeGeometry(sideWin);
  const sideMat = glass.clone();
  sideMat.side = THREE.DoubleSide;
  for (const sgn of [-1, 1]) {
    const m = mesh(sideGeo, sideMat);
    m.castShadow = false;
    m.rotation.y = -Math.PI / 2;                    // shape x -> car Z (double-sided so both walls read)
    m.position.x = sgn * 0.672;
  }

  // ---- decals (number roundel + bolt) ----
  for (const sgn of [-1, 1]) {
    const mat = new THREE.MeshBasicMaterial({ map: decalTexture(sgn > 0), transparent: true, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
    const d = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.75), mat);
    d.position.set(sgn * 0.953, 0.76, 0.05);
    d.rotation.y = sgn * Math.PI / 2;
    body.add(d);
  }

  // ---- smiling bumper ----
  const smilePts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16 * 2 - 1;
    smilePts.push(new THREE.Vector3(t * 0.62, 0.52 + 0.17 * t * t, 2.295));
  }
  const smile = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(smilePts), 24, 0.045, 8), chrome);
  const lipPts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16 * 2 - 1;
    lipPts.push(new THREE.Vector3(t * 0.7, 0.42 + 0.06 * t * t, 2.3));
  }
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lipPts), 24, 0.07, 8), chrome);
  // mouth interior + teeth
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.14), dark);
  mouth.position.set(0, 0.47, 2.289);
  body.add(mouth);
  for (let i = 0; i < 7; i++) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.02), white);
    const tx = (i - 3) * 0.145;
    tooth.position.set(tx, 0.49 + 0.17 * (tx / 0.62) ** 2 * 0.1, 2.292);
    body.add(tooth);
  }
  // grille cheeks
  // headlights
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe9a8, emissiveIntensity: 1.6, roughness: 0.2 });
  for (const sgn of [-1, 1]) {
    const h = mesh(new THREE.SphereGeometry(0.16, 16, 12), headMat);
    h.scale.set(1, 1, 0.6);
    h.position.set(sgn * 0.66, 0.84, 2.2);
    h.castShadow = false;
    const ring = mesh(new THREE.TorusGeometry(0.17, 0.025, 8, 20), chrome);
    ring.position.copy(h.position); ring.position.z += 0.01;
    ring.castShadow = false;
  }
  // tail lights
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0xff1010, emissiveIntensity: 0.9, roughness: 0.3 });
  for (const sgn of [-1, 1]) {
    const t = mesh(new THREE.BoxGeometry(0.34, 0.14, 0.05), tailMat);
    t.position.set(sgn * 0.62, 0.92, -2.27);
    t.castShadow = false;
  }
  // exhaust pipes
  const exhaustPts = [];
  for (const sgn of [-1, 1]) {
    const e = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 12), chrome);
    e.rotation.x = Math.PI / 2;
    e.position.set(sgn * 0.45, 0.4, -2.3);
    exhaustPts.push(new THREE.Vector3(sgn * 0.45, 0.4, -2.48));
  }

  // ---- spoiler ----
  const wing = mesh(new THREE.BoxGeometry(1.55, 0.07, 0.42), yellow);
  wing.position.set(0, 1.46, -2.08);
  for (const sgn of [-1, 1]) {
    const post = mesh(new THREE.BoxGeometry(0.07, 0.3, 0.1), dark);
    post.position.set(sgn * 0.5, 1.3, -2.02);
    const plate = mesh(new THREE.BoxGeometry(0.05, 0.2, 0.46), paint);
    plate.position.set(sgn * 0.79, 1.5, -2.08);
  }

  // ---- eyes on the windshield ----
  const eyes = [];
  const eyeAnchor = slopeA.clone().addScaledVector(slopeDir, slopeLen * 0.3).addScaledVector(slopeN, 0.16);
  for (const sgn of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(sgn * 0.37, eyeAnchor.y, eyeAnchor.x);
    body.add(eye);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.33, 24, 16), white);
    ball.castShadow = true;
    eye.add(ball);
    const look = new THREE.Group();                    // iris + pupil rotate with the glance
    eye.add(look);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 14), new THREE.MeshStandardMaterial({ color: 0x2f86d6, roughness: 0.25, envMap, envMapIntensity: 0.5 }));
    iris.scale.set(1, 1, 0.5); iris.position.set(0, 0, 0.3);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), dark);
    pupil.scale.set(1, 1, 0.5); pupil.position.set(0, 0, 0.34);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(0.05, 0.07, 0.37);
    look.add(iris, pupil, glint);
    // eyelid: a body-coloured dome that swings down for a blink
    const lidPivot = new THREE.Group();
    eye.add(lidPivot);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.345, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), paint);
    lid.castShadow = false;
    lidPivot.add(lid);
    lidPivot.rotation.x = -1.75;
    eyes.push({ eye, look, lidPivot, sgn });
  }

  // ---- wheels ----
  const wheels = [];
  const R = CFG.WHEEL_RADIUS;
  const tireGeo = new THREE.CylinderGeometry(R, R, 0.36, 28).rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(R * 0.62, R * 0.62, 0.38, 24).rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(R * 0.2, R * 0.2, 0.4, 12).rotateZ(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.39, R * 0.1, R * 1.1);
  for (const [sgn, zf, front] of [[1, 1, true], [-1, 1, true], [1, -1, false], [-1, -1, false]]) {
    const pivot = new THREE.Group();                     // steering
    pivot.position.set(sgn * 0.9, R, zf * CFG.WHEELBASE / 2);
    root.add(pivot);
    const spin = new THREE.Group();                      // rolling
    pivot.add(spin);
    mesh(tireGeo, tire, spin);
    mesh(rimGeo, chrome, spin).castShadow = false;
    mesh(hubGeo, yellow, spin);
    for (let k = 0; k < 4; k++) {
      const sp = mesh(spokeGeo, chrome, spin);
      sp.rotation.x = k * Math.PI / 4;
      sp.castShadow = false;
    }
    wheels.push({ pivot, spin, front });
  }

  // ---- dynamics ----
  const bob = new Spring(120, 12), pitch = new Spring(60, 9), roll = new Spring(60, 9);
  let steer = 0, blinkT = 2 + Math.random() * 2, blinkP = -1, glanceX = 0, glanceY = 0, gx = 0, gy = 0;
  let idleClock = 0, lastA = 0, time = 0;
  const f = new THREE.Vector3(), l = new THREE.Vector3(), u = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const pr = {}, pf = {}, pm = {}, pa = {}, pb = {};

  const api = {
    root, body, eyes, exhaustPoints: exhaustPts, wheels,
    bounds: CAR_BOUNDS,
    /** Where the car looks (-1..1 in local x/y); smoothed internally. */
    setGlance(x, y) { glanceX = x; glanceY = y; },
    /** Kick the suspension (called on taps). */
    kick(amount) { bob.v -= amount; },
    /** Current lateral acceleration proxy (for effects). */
    lateral: 0,
    steerAngle: 0,

    /** Place the car on the route at arc length s and animate it. */
    update(dt, route, s, speed, accel, tapPulse, stateStopped) {
      time += dt;
      // axle positions give pitch from the road profile
      route.at(s + CFG.WHEELBASE / 2, pf);
      route.at(s - CFG.WHEELBASE / 2, pr);
      route.at(s, pm);
      f.set(pf.x - pr.x, pf.y - pr.y, pf.z - pr.z).normalize();
      l.set(-pm.rx, 0, -pm.rz);                                    // car-left = -right
      // make left perpendicular to forward
      l.addScaledVector(f, -l.dot(f)).normalize();
      u.crossVectors(f, l).normalize();
      m4.makeBasis(l, u, f);
      root.quaternion.setFromRotationMatrix(m4);
      root.position.set(pm.x + pm.rx * CFG.LANE_OFFSET, pm.y, pm.z + pm.rz * CFG.LANE_OFFSET);

      // curvature from heading change over a few metres
      route.at(s + 3, pa); route.at(s - 3, pb);
      let dyaw = Math.atan2(pa.tx, pa.tz) - Math.atan2(pb.tx, pb.tz);
      if (dyaw > Math.PI) dyaw -= 2 * Math.PI; else if (dyaw < -Math.PI) dyaw += 2 * Math.PI;
      const kappa = dyaw / 6;                                      // + = turning toward +yaw (right turn viewed from above)
      const steerTarget = clamp(Math.atan(CFG.WHEELBASE * kappa) * 1.6, -0.5, 0.5) * (speed > 0.1 ? 1 : 0.0);
      steer += (steerTarget - steer) * Math.min(1, dt * 6);
      api.steerAngle = steer;
      for (const w of wheels) {
        w.spin.rotation.x += speed * dt / R;
        if (w.front) w.pivot.rotation.y = steer;
      }

      // suspension: bounce, nose dip under braking, squat under power, lean in turns
      const lat = speed * speed * kappa;                           // lateral accel (m/s^2)
      api.lateral = lat;
      const bump = speed > 0.5 ? (Math.sin(time * 23) * 0.5 + Math.sin(time * 37.7) * 0.5) * Math.min(speed, 16) * 0.0012 : 0;
      idleClock += dt;
      const idleShake = speed < 0.3 ? Math.sin(idleClock * 38) * 0.0035 : 0;
      bob.step(bump * 6 + idleShake, dt);
      pitch.step(clamp(accel * -0.012, -0.05, 0.05), dt);          // squat when accelerating, dive when braking
      roll.step(clamp(lat * 0.004, -0.05, 0.05), dt);
      lastA = accel;
      body.position.y = bob.x;
      body.rotation.x = pitch.x;
      body.rotation.z = roll.x;
      // tap pulse gives a tiny extra hop
      body.position.y += tapPulse * 0.015;

      // eyes: blink + glance
      blinkT -= dt;
      if (blinkT <= 0 && blinkP < 0) { blinkP = 0; }
      if (blinkP >= 0) {
        blinkP += dt / 0.16;
        const k = blinkP < 0.5 ? blinkP * 2 : (1 - blinkP) * 2;     // 0 -> 1 -> 0
        const ang = -1.75 + k * (1.75 + 1.55);
        for (const e of eyes) e.lidPivot.rotation.x = ang;
        if (blinkP >= 1) { blinkP = -1; blinkT = 2 + Math.random() * 3.5; for (const e of eyes) e.lidPivot.rotation.x = -1.75; }
      }
      gx += (glanceX - gx) * Math.min(1, dt * 5);
      gy += (glanceY - gy) * Math.min(1, dt * 5);
      for (const e of eyes) {
        e.look.rotation.y = gx * 0.45;
        e.look.rotation.x = -gy * 0.3;
      }
    },
  };
  return api;
}
