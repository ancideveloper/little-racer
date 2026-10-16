// Procedural sign boards: canvas textures (painted boards, neon text, little pictograms) on flat planes.

import * as THREE from 'three';

const FONT = '"Trebuchet MS", "Segoe UI", Arial, sans-serif';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toMesh(c, w, h, { glow = false, doubleSide = false } = {}) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: !glow, side: doubleSide ? THREE.DoubleSide : THREE.FrontSide });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.userData.isSign = true;
  return m;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Fit text into a box, shrinking the font if needed. */
function fitText(g, text, x, y, maxW, size, weight = 'bold') {
  let s = size;
  g.font = `${weight} ${s}px ${FONT}`;
  while (g.measureText(text).width > maxW && s > 10) { s -= 2; g.font = `${weight} ${s}px ${FONT}`; }
  g.fillText(text, x, y);
}

// ---------- pictograms (all drawn from scratch) ----------
export const icons = {
  cone(g, cx, cy, s, c1 = '#ff8a3a', c2 = '#fff1c8') {
    g.fillStyle = '#e0a860'; g.beginPath(); g.moveTo(cx - s * 0.35, cy); g.lineTo(cx + s * 0.35, cy); g.lineTo(cx, cy + s * 0.9); g.fill();
    g.fillStyle = c1; g.beginPath(); g.arc(cx, cy - s * 0.1, s * 0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = c2; g.beginPath(); g.arc(cx, cy - s * 0.45, s * 0.28, 0, Math.PI * 2); g.fill();
  },
  tire(g, cx, cy, s) {
    g.fillStyle = '#26262b'; g.beginPath(); g.arc(cx, cy, s * 0.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c9ccd4'; g.beginPath(); g.arc(cx, cy, s * 0.26, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffc928'; g.beginPath(); g.arc(cx, cy, s * 0.09, 0, Math.PI * 2); g.fill();
  },
  splat(g, cx, cy, s, colors = ['#ff4f8a', '#35c4ff', '#ffd23a', '#7ae05a']) {
    colors.forEach((col, i) => {
      g.fillStyle = col;
      g.beginPath();
      g.arc(cx + Math.cos(i * 1.9) * s * 0.25, cy + Math.sin(i * 1.9) * s * 0.25, s * (0.28 - i * 0.02), 0, Math.PI * 2);
      g.fill();
    });
  },
  cactus(g, cx, cy, s) {
    g.fillStyle = '#3f9a45';
    roundRect(g, cx - s * 0.12, cy - s * 0.5, s * 0.24, s, s * 0.12); g.fill();
    roundRect(g, cx - s * 0.42, cy - s * 0.15, s * 0.3, s * 0.14, s * 0.07); g.fill();
    roundRect(g, cx - s * 0.42, cy - s * 0.4, s * 0.14, s * 0.3, s * 0.07); g.fill();
    roundRect(g, cx + s * 0.12, cy, s * 0.3, s * 0.14, s * 0.07); g.fill();
    roundRect(g, cx + s * 0.28, cy - s * 0.3, s * 0.14, s * 0.3, s * 0.07); g.fill();
  },
  sun(g, cx, cy, s) {
    g.fillStyle = '#ffd23a';
    g.beginPath(); g.arc(cx, cy, s * 0.3, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffd23a'; g.lineWidth = s * 0.07; g.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * s * 0.4, cy + Math.sin(a) * s * 0.4); g.lineTo(cx + Math.cos(a) * s * 0.52, cy + Math.sin(a) * s * 0.52); g.stroke();
    }
  },
  star(g, cx, cy, s, col = '#ff4f8a') {
    g.fillStyle = col; g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? s * 0.2 : s * 0.5, a = -Math.PI / 2 + i * Math.PI / 5;
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.closePath(); g.fill();
  },
  wrench(g, cx, cy, s) {
    g.strokeStyle = '#d0d4dc'; g.lineWidth = s * 0.14; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - s * 0.35, cy + s * 0.35); g.lineTo(cx + s * 0.25, cy - s * 0.25); g.stroke();
    g.fillStyle = '#d0d4dc'; g.beginPath(); g.arc(cx + s * 0.32, cy - s * 0.32, s * 0.2, 0, Math.PI * 2); g.fill();
  },
  cup(g, cx, cy, s) {
    g.fillStyle = '#fff'; roundRect(g, cx - s * 0.3, cy - s * 0.25, s * 0.6, s * 0.55, s * 0.08); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = s * 0.08; g.beginPath(); g.arc(cx + s * 0.32, cy, s * 0.15, -1.2, 1.2); g.stroke();
    g.strokeStyle = '#ffffffaa'; g.lineWidth = s * 0.05;
    for (const dx of [-0.12, 0.08]) { g.beginPath(); g.moveTo(cx + s * dx, cy - s * 0.32); g.quadraticCurveTo(cx + s * (dx + 0.08), cy - s * 0.42, cx + s * dx, cy - s * 0.52); g.stroke(); }
  },
  bread(g, cx, cy, s) {
    g.fillStyle = '#d9954a'; roundRect(g, cx - s * 0.4, cy - s * 0.2, s * 0.8, s * 0.4, s * 0.2); g.fill();
    g.strokeStyle = '#fbd9a0'; g.lineWidth = s * 0.05;
    for (const dx of [-0.2, 0, 0.2]) { g.beginPath(); g.moveTo(cx + s * dx - s * 0.05, cy - s * 0.12); g.lineTo(cx + s * dx + s * 0.05, cy + s * 0.1); g.stroke(); }
  },
  scissors(g, cx, cy, s) {
    g.strokeStyle = '#e9edf5'; g.lineWidth = s * 0.07; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - s * 0.3, cy - s * 0.3); g.lineTo(cx + s * 0.3, cy + s * 0.3); g.moveTo(cx - s * 0.3, cy + s * 0.3); g.lineTo(cx + s * 0.3, cy - s * 0.3); g.stroke();
    g.beginPath(); g.arc(cx + s * 0.32, cy + s * 0.32, s * 0.1, 0, 7); g.arc(cx + s * 0.32, cy - s * 0.32, s * 0.1, 0, 7); g.stroke();
  },
  envelope(g, cx, cy, s) {
    g.fillStyle = '#fff'; g.fillRect(cx - s * 0.4, cy - s * 0.26, s * 0.8, s * 0.52);
    g.strokeStyle = '#b84a3a'; g.lineWidth = s * 0.04; g.beginPath(); g.moveTo(cx - s * 0.4, cy - s * 0.26); g.lineTo(cx, cy + s * 0.05); g.lineTo(cx + s * 0.4, cy - s * 0.26); g.stroke();
  },
  hammer(g, cx, cy, s) {
    g.strokeStyle = '#8a5a30'; g.lineWidth = s * 0.1; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - s * 0.3, cy + s * 0.35); g.lineTo(cx + s * 0.15, cy - s * 0.2); g.stroke();
    g.fillStyle = '#c0c6d0'; g.fillRect(cx - s * 0.05, cy - s * 0.42, s * 0.42, s * 0.2);
  },
  gas(g, cx, cy, s) {
    g.fillStyle = '#fff'; roundRect(g, cx - s * 0.25, cy - s * 0.4, s * 0.45, s * 0.8, s * 0.06); g.fill();
    g.fillStyle = '#35b6ff'; g.fillRect(cx - s * 0.18, cy - s * 0.32, s * 0.31, s * 0.22);
    g.strokeStyle = '#fff'; g.lineWidth = s * 0.07; g.beginPath(); g.moveTo(cx + s * 0.2, cy - s * 0.25); g.lineTo(cx + s * 0.36, cy - s * 0.1); g.lineTo(cx + s * 0.36, cy + s * 0.3); g.stroke();
  },
  clock(g, cx, cy, s) {
    g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(cx, cy, s * 0.45, 0, 7); g.fill();
    g.strokeStyle = '#3a2a1e'; g.lineWidth = s * 0.06; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy - s * 0.3); g.moveTo(cx, cy); g.lineTo(cx + s * 0.2, cy + s * 0.05); g.stroke();
  },
  flower(g, cx, cy, s) {
    g.fillStyle = '#ff6fa8';
    for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(cx + Math.cos(i * 1.047) * s * 0.22, cy + Math.sin(i * 1.047) * s * 0.22, s * 0.16, 0, 7); g.fill(); }
    g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(cx, cy, s * 0.14, 0, 7); g.fill();
  },
  bed(g, cx, cy, s) {
    g.fillStyle = '#fff'; g.fillRect(cx - s * 0.42, cy, s * 0.84, s * 0.14);
    g.fillRect(cx - s * 0.42, cy - s * 0.22, s * 0.1, s * 0.4);
    g.fillRect(cx - s * 0.3, cy - s * 0.12, s * 0.28, s * 0.12);
  },
};

/** Painted board: background, border, optional icon, and one or two lines of text. */
export function paintedSign({ w = 512, h = 160, worldW = 6, bg = '#2a6f86', border = '#fff1c8', fg = '#fff1c8', text = '', sub = '', icon = null, iconSide = 'left', font = 64, round = 18 }) {
  const [c, g] = canvas(w, h);
  roundRect(g, 4, 4, w - 8, h - 8, round);
  g.fillStyle = bg; g.fill();
  g.lineWidth = 8; g.strokeStyle = border; g.stroke();
  const pad = icon ? h * 0.9 : 20;
  if (icon) icons[icon](g, iconSide === 'left' ? h * 0.5 : w - h * 0.5, h / 2, h * 0.62);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const cx = iconSide === 'left' ? pad + (w - pad - 20) / 2 : (w - pad) / 2 + 10;
  if (sub) {
    fitText(g, text, cx, h * 0.4, w - pad - 30, font);
    g.fillStyle = fg + 'cc';
    fitText(g, sub, cx, h * 0.76, w - pad - 30, font * 0.5, '600');
  } else {
    fitText(g, text, cx, h * 0.52, w - pad - 30, font);
  }
  return toMesh(c, worldW, worldW * h / w);
}

/** Neon-style sign: dark panel with glowing text/shape. */
export function neonSign({ w = 512, h = 192, worldW = 6, text = '', sub = '', color = '#ff4fa0', color2 = '#3ee6ff', panel = '#1b1226', icon = null, font = 84 }) {
  const [c, g] = canvas(w, h);
  roundRect(g, 4, 4, w - 8, h - 8, 26);
  g.fillStyle = panel; g.fill();
  g.lineWidth = 7; g.strokeStyle = color2; g.shadowColor = color2; g.shadowBlur = 18; g.stroke();
  g.shadowBlur = 20; g.shadowColor = color; g.fillStyle = color;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const pad = icon ? h * 0.8 : 0;
  if (icon) { icons[icon](g, h * 0.52, h / 2, h * 0.6); }
  const cx = pad + (w - pad) / 2;
  if (sub) {
    fitText(g, text, cx, h * 0.42, w - pad - 50, font);
    g.fillStyle = color2; g.shadowColor = color2;
    fitText(g, sub, cx, h * 0.78, w - pad - 50, font * 0.46, '600');
  } else {
    fitText(g, text, cx, h * 0.52, w - pad - 50, font);
  }
  return toMesh(c, worldW, worldW * h / w, { glow: true });
}

/** Double-sided hanging board (used on poles). */
export function boardDouble(opts) {
  const m = paintedSign(opts);
  m.material.side = THREE.DoubleSide;
  return m;
}

/** Painted welcome board with sun and mountains (entrance sign). */
export function welcomeSign() {
  const w = 1024, h = 384;
  const [c, g] = canvas(w, h);
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#ffcf6a'); grd.addColorStop(0.6, '#ff9a4a'); grd.addColorStop(1, '#d45a3a');
  roundRect(g, 6, 6, w - 12, h - 12, 36); g.fillStyle = grd; g.fill();
  g.lineWidth = 14; g.strokeStyle = '#6a3a22'; g.stroke();
  // mountains
  g.fillStyle = '#a8442e';
  g.beginPath(); g.moveTo(10, h - 14); g.lineTo(180, 210); g.lineTo(300, 290); g.lineTo(420, 190); g.lineTo(560, h - 14); g.fill();
  g.fillStyle = '#c85a3a';
  g.beginPath(); g.moveTo(480, h - 14); g.lineTo(700, 200); g.lineTo(860, 300); g.lineTo(1014, 230); g.lineTo(1014, h - 14); g.fill();
  icons.sun(g, 880, 100, 150);
  icons.cactus(g, 110, 280, 130);
  icons.cactus(g, 940, 285, 110);
  g.fillStyle = '#fff3d6'; g.strokeStyle = '#6a3a22'; g.lineWidth = 10;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold 120px ${FONT}`; g.strokeText('SANDY GULCH', w / 2, 130); g.fillText('SANDY GULCH', w / 2, 130);
  g.font = `bold 56px ${FONT}`; g.lineWidth = 8; g.strokeText('Please drive friendly!', w / 2, 232); g.fillText('Please drive friendly!', w / 2, 232);
  return toMesh(c, 12, 12 * h / w, { doubleSide: true });
}

/** Little coloured pennant strip texture for bunting. */
export function checkerTexture() {
  const [c, g] = canvas(64, 64);
  g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#111'; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
