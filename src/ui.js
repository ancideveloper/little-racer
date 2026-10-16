// The only UI: a short start line and a pulsing cue above the car while it is waiting for input.

import * as THREE from 'three';

export function createUI() {
  const hint = document.getElementById('hint');
  const cue = document.getElementById('cue');
  const v = new THREE.Vector3();
  let started = false;

  return {
    onFirstInput() {
      if (started) return;
      started = true;
      hint.classList.add('gone');
    },

    /** Position the cue just above the car on screen (clamped so it is always visible). */
    update(car, camera, stopped, stoppedFor) {
      const show = stopped && stoppedFor > (started ? 0.35 : 0);
      cue.classList.toggle('on', show);
      if (!show) return;
      v.set(0, 2.9, 0);
      car.root.localToWorld(v);
      v.project(camera);
      const w = window.innerWidth, h = window.innerHeight;
      const x = Math.min(Math.max((v.x * 0.5 + 0.5) * w, 60), w - 60);
      const y = Math.min(Math.max((-v.y * 0.5 + 0.5) * h, 60), h - 60);
      cue.style.transform = `translate(${(x - w / 2).toFixed(1)}px, ${(y - h * 0.3).toFixed(1)}px)`;
    },
  };
}
