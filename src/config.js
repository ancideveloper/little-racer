// All gameplay and tuning constants live here so they are easy to find and tweak.

export const CFG = {
  // --- simulation ---
  SIM_DT: 1 / 120,            // fixed simulation step (s)
  MAX_FRAME_DT: 0.1,          // clamp for long frames (tab switches)

  // --- speed model (m/s, m/s^2, m/s^3) ---
  MAX_SPEED: 16,              // safe maximum
  CRUISE_SPEED: 13,           // reference speed for lap time
  START_SPEED: 5,             // target speed set by the first tap from rest
  TAP_STEP: 1.6,              // each tap raises the target speed by this much
  ACCEL_TAP: 4.0,             // acceleration limit while chasing a tapped target
  ACCEL_HOLD: 2.2,            // acceleration limit while holding input
  JERK: 9,                    // max change of acceleration (smooth starts)
  IDLE_GRACE_S: 1.0,          // seconds without input before braking begins
  BRAKE_DECEL: 4.5,           // strong but gentle braking (m/s^2)
  BRAKE_JERK: 7,              // braking ramps in over BRAKE_DECEL / BRAKE_JERK s
  BRAKE_TAIL_K: 6.0,        // jerk used to ease the last of the braking: decel <= sqrt(2 * K * v)
  STOP_EPS: 0.002,             // below this speed the car is stopped (m/s)
  TARGET_DECAY: 2.0,          // tapped target decays toward current speed when idle (m/s^2)
  TAP_RATE_TAU: 0.8,          // smoothing time of the taps-per-second estimate

  // --- hero car (metres) ---
  CAR_LENGTH: 4.4,
  CAR_WIDTH: 1.9,
  CAR_HEIGHT: 1.75,
  WHEEL_RADIUS: 0.42,
  WHEELBASE: 2.8,

  // --- camera ---
  CAM_FOV: 52,
  CAM_PITCH_DEG: 15,          // elevation angle above the car
  CAM_LOOK_AHEAD: 2.2,        // metres ahead of the car centre to look at
  CAM_FIT_MARGIN: 0.07,       // fraction of the screen kept free around the car
  CAM_FIT_YAW_DEG: 32,        // worst-case yaw offset considered for the fit

  // --- road ---
  ROAD_HALF_WIDTH: 4.6,
  LANE_OFFSET: 2.2,           // the hero drives in the right lane, this far right of the road centre line
  ROUTE_SAMPLES: 2400,
};
