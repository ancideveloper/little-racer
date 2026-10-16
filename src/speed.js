// Speed model: taps raise a target speed, holding accelerates, silence brakes to a smooth full stop.
// Pure logic with no engine or DOM dependency, stepped with a fixed dt so it is deterministic and testable.

import { CFG } from './config.js';
import { clamp } from './util.js';

export class SpeedModel {
  constructor() {
    this.v = 0;             // current speed (m/s)
    this.a = 0;             // current acceleration (m/s^2), jerk-limited
    this.target = 0;        // speed the car is accelerating toward
    this.idle = 0;          // seconds since the last input
    this.holding = false;   // finger / key currently down
    this.tapRate = 0;       // smoothed taps per second
    this.tapPulse = 0;      // decays 1 -> 0 after each tap (drives effects)
    this.started = false;   // has any input happened yet
    this.state = 'stopped'; // 'stopped' | 'driving' | 'braking'
    this.pendingTaps = 0;
    this.wasHolding = false;
  }

  /** Register a discrete tap / key press. */
  tap() {
    this.pendingTaps++;
  }

  setHolding(h) {
    this.holding = h;
  }

  step(dt) {
    const hadInput = this.pendingTaps > 0 || this.holding;

    // --- discrete taps: raise the target by a small step ---
    if (this.pendingTaps > 0) {
      const base = this.v < 0.5 ? CFG.START_SPEED - CFG.TAP_STEP : Math.max(this.target, this.v);
      this.target = clamp(base + CFG.TAP_STEP * this.pendingTaps, 0, CFG.MAX_SPEED);
      this.tapRate += this.pendingTaps / CFG.TAP_RATE_TAU;   // impulse into the EMA
      this.tapPulse = 1;
      this.pendingTaps = 0;
      this.started = true;
    }
    if (this.holding) this.started = true;
    this.tapRate *= Math.exp(-dt / CFG.TAP_RATE_TAU);
    this.tapPulse = Math.max(0, this.tapPulse - dt * 3);

    if (hadInput) this.idle = 0; else this.idle += dt;

    // --- desired acceleration ---
    let aWant;
    if (!this.holding && this.wasHolding) this.target = Math.max(this.v, Math.min(this.target, this.v + 0.5)); // released: hold speed
    this.wasHolding = this.holding;
    if (this.holding) {
      this.target = CFG.MAX_SPEED;
      aWant = Math.min(CFG.ACCEL_HOLD, (CFG.MAX_SPEED - this.v) * 3);   // ease into the maximum
      this.state = 'driving';
    } else if (this.idle < CFG.IDLE_GRACE_S && this.started) {
      // coasting through the grace period, still chasing any tapped target
      aWant = clamp((this.target - this.v) * 2.5, 0, CFG.ACCEL_TAP);
      this.state = this.v > CFG.STOP_EPS ? 'driving' : 'stopped';
    } else {
      // braking: ramp the deceleration in with limited jerk, with an exponential tail near zero
      this.target = Math.min(this.target, this.v);
      if (this.v > CFG.STOP_EPS) {
        const brakeT = this.idle - CFG.IDLE_GRACE_S;
        const ramp = clamp(brakeT * CFG.BRAKE_JERK / CFG.BRAKE_DECEL, 0, 1);
        // the deceleration is capped by what the jerk limit can still unwind before v hits 0: a <= sqrt(2 J v)
        const decel = Math.min(CFG.BRAKE_DECEL * ramp, Math.sqrt(2 * CFG.BRAKE_TAIL_K * this.v));
        aWant = -decel;
        this.state = 'braking';
      } else {
        aWant = 0;
        this.state = 'stopped';
      }
    }

    // --- jerk-limited acceleration, then integrate ---
    this.a += clamp(aWant - this.a, -CFG.JERK * dt, CFG.JERK * dt);
    this.v += this.a * dt;
    if (this.state === 'braking' && this.v < 0) { this.v = 0; this.a = 0; }
    if (this.v >= CFG.MAX_SPEED) { this.v = CFG.MAX_SPEED; this.a = Math.min(this.a, 0); }
    if (this.state === 'braking' && this.v <= CFG.STOP_EPS) {
      this.v = 0; this.a = 0; this.target = 0; this.state = 'stopped';
    }
    if (this.v < 0) { this.v = 0; this.a = 0; }
    return this.v;
  }
}
