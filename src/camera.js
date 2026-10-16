// Cinematic follow camera. It rides the road behind the car (so it never cuts corners through scenery),
// its distance is solved from the car's real bounding box, the FOV and the viewport aspect so the whole
// car is always inside the frame, and it lifts smoothly if a collider ever gets between it and the car.

import * as THREE from 'three';
import { CFG } from './config.js';
import { CAR_BOUNDS } from './vehicle.js';
import { clamp, lerp, smoothstep } from './util.js';

const LOOK_Y = 1.15;

/** The 8 corners of the car's bounding box in car-local space. */
export function carCorners() {
  const { halfW, height, zMin, zMax } = CAR_BOUNDS;
  const out = [];
  for (const x of [-halfW, halfW]) for (const y of [0, height]) for (const z of [zMin, zMax]) out.push(new THREE.Vector3(x, y, z));
  return out;
}

/** Same box inflated for suspension pitch/roll and bounce, which move the body corners at runtime. */
export function fitCorners() {
  const { halfW, height, zMin, zMax } = CAR_BOUNDS;
  const out = [];
  for (const x of [-halfW - 0.1, halfW + 0.1]) for (const y of [-0.25, height + 0.1]) for (const z of [zMin - 0.1, zMax + 0.1]) out.push(new THREE.Vector3(x, y, z));
  return out;
}

const _cam = new THREE.PerspectiveCamera();
const _v = new THREE.Vector3();

/**
 * Smallest camera distance (behind the car, `pitch` radians above it) at which every bbox corner stays
 * inside the screen with `margin` to spare, for any car yaw within +-yawDeg relative to the camera.
 */
export function fitDistance(aspect, fovDeg, pitch, margin = CFG.CAM_FIT_MARGIN, yawDeg = CFG.CAM_FIT_YAW_DEG) {
  _cam.fov = fovDeg; _cam.aspect = aspect; _cam.near = 0.3; _cam.far = 3000;
  _cam.updateProjectionMatrix();
  const corners = fitCorners();
  const lim = 1 - margin;
  const fits = (d) => {
    _cam.position.set(0, LOOK_Y + d * Math.sin(pitch), -d * Math.cos(pitch));
    for (let yaw = -yawDeg; yaw <= yawDeg + 1e-6; yaw += yawDeg / 8) {
      const a = THREE.MathUtils.degToRad(yaw), ca = Math.cos(a), sa = Math.sin(a);
      _cam.lookAt(sa * CFG.CAM_LOOK_AHEAD, LOOK_Y, ca * CFG.CAM_LOOK_AHEAD);
      _cam.updateMatrixWorld(true);
      for (const c of corners) {
        _v.set(c.x * ca + c.z * sa, c.y, -c.x * sa + c.z * ca).project(_cam);
        if (Math.abs(_v.x) > lim || Math.abs(_v.y) > lim || _v.z > 1) return false;
      }
    }
    return true;
  };
  let lo = 2, hi = 120;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid; else lo = mid;
  }
  return hi;
}

export function createCameraRig() {
  const camera = new THREE.PerspectiveCamera(CFG.CAM_FOV, 16 / 9, 0.3, 2800);
  const basePitch = THREE.MathUtils.degToRad(CFG.CAM_PITCH_DEG);
  const highPitch = THREE.MathUtils.degToRad(CFG.CAM_PITCH_DEG + 4.5);
  let dBase = 8, dHigh = 8, dOrbit = 8;
  let zoneYaw = 0, introT = 0, introOn = true;

  const pBack = {}, pCar = {}, pAhead = {};
  const look = new THREE.Vector3(), lookS = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  let initialised = false, camY = 0, lift = 0, prof = 0, blockedFor = 0;
  const raycaster = new THREE.Raycaster();
  const dir = new THREE.Vector3(), target = new THREE.Vector3();
  const probes = [];
  for (const x of [-0.9, 0.9]) for (const z of [-2.1, 2.1]) probes.push(new THREE.Vector3(x, 0.15, z));
  probes.push(new THREE.Vector3(0, 0.9, 0));

  const rig = {
    camera,
    metrics: { blockedSteps: 0, stillBlockedSteps: 0, steps: 0, maxLift: 0 },
    distance: 8,

    resize(width, height) {
      camera.aspect = width / Math.max(1, height);
      camera.fov = CFG.CAM_FOV;
      camera.updateProjectionMatrix();
      dBase = fitDistance(camera.aspect, CFG.CAM_FOV, basePitch);   // narrowest FOV = largest car; the speed kick only widens the view
      dHigh = fitDistance(camera.aspect, CFG.CAM_FOV, highPitch);
      dOrbit = fitDistance(camera.aspect, CFG.CAM_FOV, basePitch, CFG.CAM_FIT_MARGIN, 180);   // car seen from any side
    },

    /** Reset smoothing (used after teleports in tests). */
    reset() { initialised = false; zoneYaw = 0; introT = 0; introOn = true; },

    update(dt, route, s, car, speed, colliders, started = true) {
      const tBridge = Math.abs(route.arcDelta(s, route.bridge.s)) - route.bridge.half;
      const tTunnel = Math.abs(route.arcDelta(s, route.tunnel.s)) - route.tunnel.half;
      const profTarget = Math.max(1 - smoothstep(0, 40, tBridge), 1 - smoothstep(0, 40, tTunnel));
      prof += (profTarget - prof) * (1 - Math.exp(-dt / 0.6));
      const pitch = lerp(basePitch, highPitch, prof) + lift * 0.035;
      // --- cinematic shots: front view that swings behind the car at the start, side/front shots on open road ---
      if (started && introOn) { introT += dt; if (introT > 3.6) introOn = false; }
      const intro = introOn ? Math.PI * (1 - smoothstep(0, 3.6, started ? introT : 0)) : 0;
      const m = route.marks;
      let yawT = 0;
      for (const z of [[m.motel + 75, m.winding + 5, 1.45], [m.winding + 40, m.winding + 100, 1.45], [m.winding + 150, m.winding + 210, Math.PI], [m.ret + 10, m.ret + 70, -1.45], [m.ret + 120, m.ret + 180, -Math.PI]]) {
        const w = smoothstep(z[0], z[0] + 25, s) * (1 - smoothstep(z[1] - 25, z[1], s));
        yawT += z[2] * w;
      }
      zoneYaw += (yawT - zoneYaw) * (1 - Math.exp(-dt / 0.5));
      const yaw = intro + zoneYaw;
      const orbitW = clamp(Math.abs(yaw) / 0.7, 0, 1);
      const dist = lerp(lerp(dBase, dHigh, prof) * (1 + prof * 0.04), Math.max(dOrbit, dBase), orbitW) + lift * 0.6;
      rig.distance = dist;

      const back = dist * Math.cos(pitch), h = dist * Math.sin(pitch);
      route.at(s, pCar);
      route.at(s - back, pBack);
      route.at(s + CFG.CAM_LOOK_AHEAD, pAhead);
      // everything rides in the right lane, like the car
      for (const q of [pCar, pBack, pAhead]) { q.x += q.rx * CFG.LANE_OFFSET; q.z += q.rz * CFG.LANE_OFFSET; }

      const yTarget = pCar.y + LOOK_Y + h;
      if (!initialised) { camY = yTarget; look.set(pAhead.x, pAhead.y + LOOK_Y, pAhead.z); lookS.copy(look); initialised = true; }
      camY += (yTarget - camY) * (1 - Math.exp(-dt / 0.12));
      camPos.set(pBack.x, camY, pBack.z);
      if (yaw !== 0) {                                   // swing the camera around the car
        const ox = camPos.x - pCar.x, oz = camPos.z - pCar.z, c = Math.cos(yaw), sn = Math.sin(yaw);
        camPos.x = pCar.x + ox * c + oz * sn; camPos.z = pCar.z - ox * sn + oz * c;
      }

      look.set(lerp(pAhead.x, pCar.x, orbitW), pAhead.y + LOOK_Y, lerp(pAhead.z, pCar.z, orbitW));
      lookS.lerp(look, 1 - Math.exp(-dt / 0.08));

      // --- line-of-sight check against static colliders (rocks, tunnel shell, bridge parts) ---
      let blocked = false;
      if (colliders && colliders.length) {
        const near = rig._near || (rig._near = []);
        near.length = 0;
        for (let i = 0; i < colliders.length; i++) {
          const c = colliders[i];
          const dx = c.cx - pCar.x, dz = c.cz - pCar.z;
          const rr = c.r + dist + 6;
          if (dx * dx + dz * dz < rr * rr) near.push(c.mesh);
        }
        if (near.length) {
          car.root.updateMatrixWorld(true);
          for (let i = 0; i < probes.length && !blocked; i++) {
            target.copy(probes[i]).applyMatrix4(car.root.matrixWorld);
            dir.copy(target).sub(camPos);
            const len = dir.length();
            dir.divideScalar(len);
            raycaster.set(camPos, dir);
            raycaster.near = 0; raycaster.far = len - 0.05;
            if (raycaster.intersectObjects(near, false).length) blocked = true;
          }
        }
      }
      rig.metrics.steps++;
      if (blocked) {
        rig.metrics.blockedSteps++;
        lift = Math.min(lift + dt * 6, 6);
        blockedFor += dt;
        if (blockedFor > 1.0) rig.metrics.stillBlockedSteps++;
      } else {
        blockedFor = 0;
        lift = Math.max(lift - dt * 1.5, 0);
      }
      rig.metrics.maxLift = Math.max(rig.metrics.maxLift, lift);

      camera.position.copy(camPos);
      camera.position.y += lift * 0.5;
      camera.lookAt(lookS);
      const speedKick = clamp(speed / CFG.MAX_SPEED, 0, 1) * 3.5;
      if (Math.abs(camera.fov - (CFG.CAM_FOV + speedKick)) > 1e-3) {
        camera.fov += (CFG.CAM_FOV + speedKick - camera.fov) * (1 - Math.exp(-dt / 0.5));
        camera.updateProjectionMatrix();
      }
    },
  };
  return rig;
}
