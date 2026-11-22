// Shared tuning for Velvet Shadow: one place for every number the other
// modules use, so balancing the stealth feel means editing here, not hunting
// through the game. All distances are pixels, all times seconds.
export const TILE = 40;
export const VIEW_W = 1280;
export const VIEW_H = 800;
export const STEP = 1 / 60;

// Player movement.
export const PLAYER_RADIUS = 13;
export const PLAYER_WALK_SPEED = 165;
export const PLAYER_RUN_SPEED = 235;
export const PLAYER_SNEAK_SPEED = 95;
export const PLAYER_ACCEL = 1400;

// Noise: how far a guard can hear each gait. Sneaking is silent.
export const NOISE_WALK = 46;
export const NOISE_RUN = 110;
export const NOISE_SNEAK = 0;

// Guards.
export const GUARD_RADIUS = 14;
export const GUARD_PATROL_SPEED = 62;
export const GUARD_CHASE_SPEED = 185;
export const GUARD_INVESTIGATE_SPEED = 105;
export const CONE_RANGE = 235;
export const CONE_HALF_ANGLE = 0.61; // ~35 degrees each side, 70 total
export const CONE_NEAR_RANGE = 52; // inside this, you are seen at once

// Detection meter 0..100. Rates are per second while the guard can see you.
export const DETECT_BASE = 55; // at mid range, in the open, walking
export const DETECT_CLOSE_MULT = 2.2; // close to the guard
export const DETECT_RUN_MULT = 1.6; // running is easier to spot
export const DETECT_SNEAK_MULT = 0.45; // sneaking is harder to spot
export const DETECT_SHADOW_MULT = 0.35; // standing in shadow
export const DETECT_LIGHT_MULT = 1.5; // standing in a lamp pool
export const DETECT_DECAY = 26; // per second while unseen
export const SUSPICIOUS_AT = 35; // guard turns to look / investigates
export const ALARM_AT = 100; // full meter: the guard raises the alarm
export const ALARM_DURATION = 6; // seconds the alarm hunts you
export const SEARCH_DURATION = 5; // seconds a guard searches a spot
export const CATCH_RADIUS = 26; // guard this close catches you

// Distraction coins.
export const COIN_START = 3;
export const COIN_THROW_SPEED = 420;
export const COIN_HEAR_RADIUS = 190;

// Smoke vials: a thrown cloud that blocks every eye for a few seconds.
export const SMOKE_START = 2;
export const SMOKE_RADIUS = 90;
export const SMOKE_DURATION = 4;
export const SMOKE_THROW_SPEED = 420;

// Brass Eye watchers: static sentinels whose cone sweeps a full circle.
export const WATCHER_TURN_SPEED = 0.35; // radians per second

// Scoring.
export const SCORE_ARTIFACT = 500;
export const SCORE_GHOST_BONUS = 400; // finish a level never fully spotted
export const SCORE_TIME_BONUS_PER_SEC = 8; // under the par time
export const LEVEL_PAR_SECONDS = [150, 180, 210];

export const LIVES_PER_LEVEL = 3;

// Palette: a museum at night. Warm lamps, cold moonlight, deep shadow.
export const COLORS = {
  floorA: '#232a38',
  floorB: '#202634',
  floorLine: '#2c3444',
  wall: '#12161f',
  wallTop: '#3a4356',
  wallTrim: '#c9a24b',
  crate: '#4a3823',
  crateTop: '#6b5433',
  caseGlass: '#7fb2d9',
  plant: '#1f4d2e',
  plantTop: '#2f6b41',
  shadow: '#0a0d14',
  lamp: '#ffd98a',
  moon: '#8fb4e8',
  player: '#e8e4d8',
  playerCloak: '#2b2f3a',
  playerScarf: '#c9a24b',
  guard: '#3d4b63',
  guardUniform: '#46587a',
  guardSkin: '#d9a986',
  coneCalm: 'rgba(255, 214, 120, 0.16)',
  coneSuspicious: 'rgba(255, 176, 66, 0.30)',
  coneAlarm: 'rgba(255, 74, 66, 0.34)',
  artifact: '#ffd34d',
  exit: '#58d68d',
  exitLocked: '#5a6b7a',
  coin: '#e8c15a',
  smoke: 'rgba(178, 184, 196, 0.55)',
  watcher: '#c9a24b',
  watcherLens: '#ffe9b0',
  text: '#e8e4d8',
  textDim: '#9aa5b5',
  danger: '#ff5a4e',
  hudBg: 'rgba(10, 13, 20, 0.72)',
};
