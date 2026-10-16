// Procedural Web Audio soundscape: engine, tyres, horn, tap feedback, birds, wind, town hum and a gentle melody.
// Nothing is created before a real user gesture (touch unlocks on pointer-up). Quiet by default, a compressor
// plus a hard limiter on the master bus, short fades everywhere, and a one-shot guard so sounds never stack.

import { clamp, smoothstep } from './util.js';

const MASTER_GAIN = 0.42;

export function createAudio() {
  let ctx = null, master = null, ready = false;
  const A = {
    ctx: null,
    unlocked: false,
    scheduled: [],                  // log of one-shot starts for the overlap test
    peakHint: 0,

    /** Called from input events. Only a down/key/up that is a real gesture may start the context. */
    unlock(kind) {
      if (ready) { if (ctx.state === 'suspended') ctx.resume(); return; }
      if (kind === 'down') return;                    // touch/mouse: wait for pointer-up (iOS requirement)
      try { build(); } catch (e) { /* audio is optional */ }
    },

    /** Per-frame update. */
    update(dt, g) { if (ready) tick(dt, g); },
    tap(speed, tapRate) { if (ready) onTap(speed, tapRate); },
    horn() { if (ready) hornOnce(); },
    /** A friend beeps at the hero; `id` picks its pitch, `dist` (m) its loudness. */
    carHorn(id, dist) { if (ready) carHornOnce(id, dist); },
    get ready() { return ready; },
  };

  // ---------- nodes ----------
  let engine, tire, wind, town, birdBus, musicBus, sfxBus, noiseBuf;
  let lastHorn = -10, lastRev = -10, lastPop = -10, lastBird = 0, nextBird = 2, nextNote = 0, noteIdx = 0, lastCreak = -10;
  const now = () => ctx.currentTime;

  function makeNoise() {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {                      // pink-ish noise
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
    return buf;
  }
  function noiseSrc() {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    s.loopStart = Math.random(); s.start(0, Math.random() * 1.5);
    return s;
  }

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
    A.ctx = ctx;
    noiseBuf = makeNoise();

    // master chain: bus -> compressor -> limiter -> out
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -22; comp.knee.value = 18; comp.ratio.value = 5; comp.attack.value = 0.01; comp.release.value = 0.25;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -4; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.08;
    master.connect(comp); comp.connect(limiter); limiter.connect(ctx.destination);
    const an = ctx.createAnalyser(); an.fftSize = 2048; limiter.connect(an);       // taps the final mix (used by tests only)
    A.analyser = an;
    master.gain.setTargetAtTime(MASTER_GAIN, ctx.currentTime, 0.6);       // gentle fade-in
    A.master = master; A.compressor = comp;

    // --- engine: two detuned saws + a sub sine through a lowpass, with a little LFO rumble ---
    const eg = ctx.createGain(); eg.gain.value = 0;
    const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 400; ef.Q.value = 1.2;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.detune.value = 9;
    const o3 = ctx.createOscillator(); o3.type = 'sine';
    const g1 = ctx.createGain(); g1.gain.value = 0.2;
    const g2 = ctx.createGain(); g2.gain.value = 0.16;
    const g3 = ctx.createGain(); g3.gain.value = 0.34;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 11;
    const lg = ctx.createGain(); lg.gain.value = 0.05;
    lfo.connect(lg); lg.connect(eg.gain);
    o1.connect(g1); o2.connect(g2); o3.connect(g3); g1.connect(ef); g2.connect(ef); g3.connect(ef); ef.connect(eg); eg.connect(master);
    [o1, o2, o3, lfo].forEach((o) => o.start());
    engine = { eg, ef, o1, o2, o3, lfo };

    // --- tyre / road noise ---
    const tn = noiseSrc(); const tf = ctx.createBiquadFilter(); tf.type = 'bandpass'; tf.frequency.value = 500; tf.Q.value = 0.6;
    const tg = ctx.createGain(); tg.gain.value = 0;
    tn.connect(tf); tf.connect(tg); tg.connect(master);
    tire = { tg, tf };

    // --- wind / desert ambience ---
    const wn = noiseSrc(); const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 500; wf.Q.value = 0.3;
    const wg = ctx.createGain(); wg.gain.value = 0.05;
    const wl = ctx.createOscillator(); wl.frequency.value = 0.12; const wlg = ctx.createGain(); wlg.gain.value = 0.025;
    wl.connect(wlg); wlg.connect(wg.gain); wl.start();
    wn.connect(wf); wf.connect(wg); wg.connect(master);
    wind = { wg, wf };

    // --- town hum (diner jukebox hiss / garage hammering), only near the main street ---
    const hn = noiseSrc(); const hf = ctx.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 900; hf.Q.value = 0.8;
    const hg = ctx.createGain(); hg.gain.value = 0;
    hn.connect(hf); hf.connect(hg); hg.connect(master);
    town = { hg, hf };


    birdBus = ctx.createGain(); birdBus.gain.value = 0.55; birdBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.33; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    // a touch of reverb for the music/birds
    const verb = ctx.createConvolver();
    const ir = ctx.createBuffer(2, ctx.sampleRate * 1.4, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.2); }
    verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = 0.22;
    musicBus.connect(verb); birdBus.connect(verb); verb.connect(vg); vg.connect(master);

    ready = true; A.unlocked = true;
    nextNote = now() + 1.5; nextBird = now() + 3;
  }

  // ---------- helpers for one-shots ----------
  function env(g, t, a, peak, rel) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + rel);
  }
  function log(name, t, dur) { A.scheduled.push({ name, t, end: t + dur }); if (A.scheduled.length > 400) A.scheduled.shift(); }

  function hornOnce() {
    const t = now();
    if (t - lastHorn < 0.45) return;                     // never overlap / stack horns
    lastHorn = t;
    // a playful two-tone "beep-beep", soft squarish tones
    for (let k = 0; k < 2; k++) {
      const st = t + k * 0.2;
      const g = ctx.createGain();
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1500;
      for (const [fr, vol] of [[392, 0.5], [494, 0.4]]) {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr * (k ? 1.06 : 1);
        const og = ctx.createGain(); og.gain.value = vol * 0.35;
        o.connect(og); og.connect(f); o.start(st); o.stop(st + 0.17);
      }
      f.connect(g); g.connect(sfxBus);
      env(g, st, 0.012, 0.5, 0.15);
    }
    log('horn', t, 0.4);
  }

  let lastCarHorn = -10;
  const HORN_PITCH = [330, 370, 415, 440, 494, 523, 392, 466];     // each car has its own friendly note
  function carHornOnce(id, dist) {
    const t = now();
    if (t - lastCarHorn < 0.5) return;                   // one car horn at a time
    lastCarHorn = t;
    const vol = 0.55 * (1 - smoothstep(8, 45, dist)) + 0.12;   // farther cars are quieter
    const f0 = HORN_PITCH[id % HORN_PITCH.length];
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = (id % 2 ? 1 : -1) * 0.5;
    for (const [m, v] of [[1, 0.5], [1.26, 0.4]]) {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f0 * m;
      const og = ctx.createGain(); og.gain.value = v * 0.3;
      o.connect(og); og.connect(f); o.start(t); o.stop(t + 0.42);
    }
    f.connect(g); g.connect(pan || sfxBus); if (pan) pan.connect(sfxBus);
    // "beep-beep" shape
    g.gain.setValueAtTime(0.0001, t);
    for (const st of [0, 0.2]) { g.gain.exponentialRampToValueAtTime(vol, t + st + 0.015); g.gain.setValueAtTime(vol, t + st + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + st + 0.15); }
    log('carhorn', t, 0.4);
  }

  function revOnce(speed, tapRate) {
    const t = now();
    if (t - lastRev < 0.36) return;                     // a rev lasts 0.35 s: never stack them
    lastRev = t;
    const sf = clamp(speed / 16, 0, 1);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = ctx.createGain();
    o.frequency.setValueAtTime(70 + sf * 60, t);
    o.frequency.exponentialRampToValueAtTime(120 + sf * 90 + clamp(tapRate, 0, 8) * 8, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(90 + sf * 60, t + 0.32);
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1100, t + 0.12); f.frequency.exponentialRampToValueAtTime(500, t + 0.32);
    o.connect(f); f.connect(g); g.connect(sfxBus);
    env(g, t, 0.05, 0.16, 0.3);
    o.start(t); o.stop(t + 0.4);
    log('rev', t, 0.35);
  }

  function popOnce(pitchUp) {
    // soft "pop" for the dust burst: short filtered noise
    const t = now();
    if (t - lastPop < 0.11) return;
    lastPop = t;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = false;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 + pitchUp * 700; f.Q.value = 1.4;
    const g = ctx.createGain();
    s.connect(f); f.connect(g); g.connect(sfxBus);
    env(g, t, 0.006, 0.14, 0.09);
    s.start(t, Math.random()); s.stop(t + 0.12);
    log('pop', t, 0.1);
  }

  function chirp(t, base, dur, vol) {
    const o = ctx.createOscillator(); o.type = 'sine';
    const g = ctx.createGain();
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * (1.35 + Math.random() * 0.3), t + dur * 0.45);
    o.frequency.exponentialRampToValueAtTime(base * 0.9, t + dur);
    o.connect(g); g.connect(birdBus);
    env(g, t, 0.01, vol, dur);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function birdPhrase() {
    const t = now();
    const base = 2200 + Math.random() * 1800;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) chirp(t + i * 0.13, base * (1 + i * 0.05), 0.09, 0.05);
    log('bird', t, n * 0.13 + 0.1);
  }

  // Light, warm "road trip" loop: C - Am - F - G, soft pad + bass + plucked arpeggio + a singable melody.
  const SEMI = (n) => 261.63 * Math.pow(2, n / 12);
  const CHORDS = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]];            // triads (semitones from C4)
  const BASSN = [-24, -27, -31, -29];
  const MEL = [[7, 12, 9, 7, 4, 7, 9, 7], [9, 12, 16, 12, 9, 12, 7, 9], [5, 9, 12, 9, 7, 9, 12, 9], [7, 11, 14, 11, 7, 11, 12, 7]];
  function tone(t, f, type, dur, vol, attack, bus) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const g = ctx.createGain();
    o.connect(g); g.connect(bus);
    env(g, t, attack, vol, dur);
    o.start(t); o.stop(t + attack + dur + 0.05);
  }
  const STEP = 0.3;                                      // eighth note at 100 bpm
  function scheduleMusic(volScale) {
    while (nextNote < now() + 0.3) {
      const bar = Math.floor(noteIdx / 8) % 4, beat = noteIdx % 8, t = nextNote;
      if (beat === 0) {
        for (const n of CHORDS[bar]) { tone(t, SEMI(n), 'triangle', 2.1, 0.07 * volScale, 0.35, musicBus); tone(t, SEMI(n - 12) * 2, 'sine', 2.1, 0.04 * volScale, 0.5, musicBus); }
        tone(t, SEMI(BASSN[bar]) * 2, 'sine', 1.0, 0.16 * volScale, 0.02, musicBus);
      }
      if (beat === 4) tone(t, SEMI(BASSN[bar]) * 2, 'sine', 0.5, 0.1 * volScale, 0.02, musicBus);
      const ch = CHORDS[bar];
      tone(t, SEMI(ch[beat % 3] + 12), 'triangle', 0.3, 0.05 * volScale, 0.01, musicBus);         // arpeggio pluck
      if (beat % 2 === 0 || beat === 7) tone(t, SEMI(MEL[bar][beat]), 'sine', 0.42, 0.11 * volScale, 0.015, musicBus);  // melody
      log('note', t, 0.3);
      nextNote += STEP;
      noteIdx++;
    }
  }

  // ---------- per-frame ----------
  let sm = { v: 0 };
  function tick(dt, g) {
    const t = now();
    const v = g.speed.v, sf = clamp(v / 16, 0, 1);
    sm.v += (v - sm.v) * Math.min(1, dt * 8);
    const driving = v > 0.2;
    const k = 1 - Math.exp(-dt / 0.08);

    // engine: pitch follows speed; idle is very quiet; silent when stopped for a while
    const idleLevel = 0.012;
    const driveLevel = 0.05 + 0.1 * sf;
    const target = driving ? driveLevel : idleLevel;
    engine.eg.gain.value += (target - engine.eg.gain.value) * k;
    const f0 = 42 + sm.v * 5.6 + (g.speed.a > 0 ? g.speed.a * 3 : 0);
    const fN = driving ? f0 : 36;
    engine.o1.frequency.value += (fN - engine.o1.frequency.value) * k;
    engine.o2.frequency.value = engine.o1.frequency.value * 1.003;
    engine.o3.frequency.value = engine.o1.frequency.value * 0.5;
    engine.ef.frequency.value += ((driving ? 260 + sf * 650 : 180) - engine.ef.frequency.value) * k;
    engine.lfo.frequency.value = driving ? 8 + sf * 24 : 6;

    // tyres
    tire.tg.gain.value += ((driving ? 0.012 + 0.05 * sf * sf : 0) - tire.tg.gain.value) * k;
    tire.tf.frequency.value = 350 + sm.v * 55;

    // wind: stronger in the open desert, fades in town
    const m = g.route.marks;
    const s = g.s;
    const inTown = smoothstep(m.mainStart - 20, m.mainStart + 10, s) * (1 - smoothstep(m.mainEnd - 5, m.mainEnd + 40, s));
    wind.wg.gain.value += ((0.035 + 0.04 * sf + 0.03 * (1 - inTown)) - wind.wg.gain.value) * k * 0.2;
    wind.wf.frequency.value = 350 + sf * 700;

    // subtle town sounds near the diner and the garage (positional)
    let near = 0;
    for (const id of ['diner', 'paintShop', 'tireShop']) {
      const it = g.layout.find((q) => q.id === id);
      const d = Math.hypot(g.car.root.position.x - it.x, g.car.root.position.z - it.z);
      near = Math.max(near, 1 - smoothstep(10, 55, d));
    }
    town.hg.gain.value += ((near * 0.025) - town.hg.gain.value) * k * 0.3;
    town.hf.frequency.value = 700 + 500 * Math.sin(t * 0.7);
    if (near > 0.5 && t - lastCreak > 1.1) { lastCreak = t + Math.random() * 1.2; popOnce(Math.random() * 0.5 - 0.2); }

    // birds
    if (t > nextBird && v < 17) { birdPhrase(); nextBird = t + 4 + Math.random() * 7; }

    // light music: a bit louder when rolling, softer when stopped
    scheduleMusic(driving ? 1 : 0.45);

    // looping sounds go to true silence when stopped for a while
    if (!driving && g.stoppedFor > 3) engine.eg.gain.value *= 0.98;
  }

  function onTap(speed, tapRate) {
    revOnce(speed, tapRate);
    popOnce(clamp(speed / 16, 0, 1));
    // every third tap (and the very first) toots the horn, so fast tapping never turns into noise
    A._taps = (A._taps || 0) + 1;
    if (A._taps % 3 === 1) hornOnce();
  }

  return A;
}
