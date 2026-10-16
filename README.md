# Little Racer

A cozy 3D desert-town drive for toddlers (ages 0–2). A friendly red race car cruises a looping road
through a colourful desert town. Tap, click or press **any key** to drive; when nobody touches the screen
the car brakes smoothly to a complete stop and waits with a pulsing glow for the next tap.
No text to read, no score, no way to lose.

> **Unofficial fan-style project.** See [Legal / IP note](#legal--ip-note).

## Run it

```bash
node serve.mjs          # no-cache dev server on http://localhost:8080
```

Open <http://localhost:8080/>. (ES modules do not work from `file://`; any static server works, and all paths are
relative so the folder can be hosted as-is, e.g. on GitHub Pages.)

## Controls

* First tap / click / touch / any key: start (no menu).
* Tap repeatedly: each tap raises the target speed a little and gives a horn / rev / dust burst / a friend waves back.
* Hold a key or finger: accelerate smoothly up to the safe maximum.
* Let go: ~1 s grace, then a strong-but-gentle brake to exactly zero speed.

All tuning constants (grace time, braking strength, accelerations, speed limits, camera fit) are in [`src/config.js`](src/config.js).

## Tech

* **Three.js r180** (MIT), vendored in `vendor/` (no CDN, no bundler): `three.module.min.js` + `three.core.min.js`
  (the module build imports the core build) and the single addon `vendor/addons/BufferGeometryUtils.js`. An import map in
  `index.html` maps `three` and `three/addons/`.
* Everything is procedural: meshes from primitives, extrusions and lathes with vertex colours, canvas-drawn signs and
  decals, a PMREM environment generated from the procedural sky, and Web Audio synthesis. No image or audio files.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Canvas, the one hint line, the pulsing cue, import map |
| `serve.mjs` | Tiny no-cache static server (also a dev-only screenshot upload endpoint) |
| `src/main.js` | Bootstrap, fixed-step game loop, resize, test hooks (`window.__lr`) |
| `src/config.js` | All tunables |
| `src/route.js` | Closed Catmull-Rom road loop with periodic elevation, arc-length table, tagged stages |
| `src/road.js` | Asphalt ribbon, markings, curbs, sidewalks |
| `src/terrain.js` | Heightfield that hugs the road, building pads, dry gorge |
| `src/sky.js` | Sky dome, fog, lights, shadow that follows the car, environment map, clouds |
| `src/scenery.js` | Instanced rocks, cacti (swaying), bushes, grass, flowers, mesas, hoodoos, arches, poles, tumbleweeds |
| `src/structures.js` | Stone arch bridge and the rock tunnel (camera colliders) |
| `src/layout.js` | Where each building stands (also drives terrain pads and scenery exclusion) |
| `src/buildings.js`, `src/landmarks.js`, `src/signs.js`, `src/batch.js` | Storefronts and landmarks, painted/neon signs, geometry batching with baked vertex AO |
| `src/characters.js` | The friends: eyes, blinking, bobbing, reactions |
| `src/vehicle.js` | The hero car (suspension, steering, wheels, eyes, decals) |
| `src/speed.js` | Speed model (pure logic): taps, hold, grace, jerk-limited braking to zero |
| `src/camera.js` | Follow camera, distance solved from the car box + FOV + aspect, line-of-sight check |
| `src/effects.js` | Pre-allocated dust / exhaust / spark pools |
| `src/audio.js` | Procedural audio, started only after a real gesture |
| `src/input.js` | Pointer, touch and keyboard input; blocks scroll, pinch zoom and context menus |
| `src/ui.js` | Start hint and the pulsing cue above the car |
| `test/` | Verification scripts (see below) and `docs/screenshots/` output |

## The town (all original names)

Sandy Gulch entrance sign · Rosie's Diner · Dazzle's Paint & Body · Twin Treads tire shop · Rusty's Tow & Junk ·
Cone Motel · Fill-Up gas station · Sunny's souvenirs, Scoop ice cream, Post, Barber, Bakery, Rock Cafe, General Store,
Hardware, Cactus Corner nursery and a Town Hall with a clock tower.
Friends: Rusty (tow truck), Bluebell (blue convertible), Gus (wise old coupe), Tilly and Tommy (tire-shop twins),
Dazzle (lowrider, paint shop), Rosie (diner wagon), plus parked neighbours.

## Verification scripts

* `node --import ./test/register.mjs test/route.test.mjs` – route length, lap time, wrap continuity (no browser needed).
* `node --import ./test/register.mjs test/speed.test.mjs` – speed model limits (no browser needed).
* In the browser (page open, DevTools console): `await import('/test/browser-tests.js')` → `cameraMargins(__lr)`,
  `checkCarBounds(__lr)`; `await import('/test/verify-input.js')` → `speedModel(__lr)`, `effects(__lr)`;
  `await import('/test/shots.js')` → `captureAll(__lr, 'desktop')` (writes PNGs to `docs/screenshots/` via the dev server).
  These pause the real-time loop and step the simulation at a fixed 1/120 s, so results do not depend on tab throttling.

## Legal / IP note

Little Racer is an **unofficial, non-commercial, fan-style project**. The characters are meant to be close in
*spirit* to the kinds of characters found in animated talking-car films (a red race car, a tow truck, a blue
convertible, a wise old car, tire-shop helpers, a paint-shop owner, a diner owner, a cone-shaped motel), but every
model, texture, name, decal, number and sound here was created from scratch:

* No official models, textures, logos, emblems, soundtracks, voice clips or trademarked names are used. The hero's racing
  number is 17 and its bolt decal is an original zig-zag design.
* All audio is synthesised at runtime with Web Audio.
* Even with original designs, resemblance to existing characters or a town layout can still prompt takedown requests.
  **Whoever publishes this project carries that risk.** Consider further differentiating the designs, or replacing
  the "tribute" feel with fully original characters, before publishing commercially.

## Credits

Three.js (MIT) © 2010–2025 three.js authors — see `vendor/LICENSE`. Everything else was written for this project.
