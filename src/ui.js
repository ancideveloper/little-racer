// The only UI: a short start line and a pulsing cue above the car while it is waiting for input.

import * as THREE from 'three';

export function createUI() {
  const hint = document.getElementById('hint');
  const cue = document.getElementById('cue');
  const v = new THREE.Vector3();
  const fill = document.querySelector('#gauge .fill');
  let started = false, shown = -1;

  return {
    onFirstInput() {
      if (started) return;
      started = true;
      hint.classList.add('gone');
    },

    /** Position the cue just above the car on screen (clamped so it is always visible). */
    update(car, camera, stopped, stoppedFor, speedFrac = 0) {
      const pct = Math.round(Math.min(1, Math.max(0, speedFrac)) * 200) / 2;        // 0.5 % steps
      if (pct !== shown) { shown = pct; fill.style.clipPath = `inset(0 ${100 - pct}% 0 0)`; }
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
