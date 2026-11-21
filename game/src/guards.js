// Guards: patrol routes, vision cones, suspicion, and the alarm. A guard is
// a small state machine — patrol, suspicious (looks / investigates), alert
// (chases what it saw), search (sweeps the spot), return — so a patrol you
// watch for a few seconds is one you can learn and slip past.
import {
  ALARM_AT,
  ALARM_DURATION,
  CATCH_RADIUS,
  CONE_HALF_ANGLE,
  CONE_NEAR_RANGE,
  CONE_RANGE,
  DETECT_BASE,
  DETECT_CLOSE_MULT,
  DETECT_DECAY,
  DETECT_LIGHT_MULT,
  DETECT_RUN_MULT,
  DETECT_SHADOW_MULT,
  DETECT_SNEAK_MULT,
  GUARD_CHASE_SPEED,
  GUARD_INVESTIGATE_SPEED,
  GUARD_PATROL_SPEED,
  GUARD_RADIUS,
  SEARCH_DURATION,
  SUSPICIOUS_AT,
} from './config.js';
import { hasLineOfSight, isLit, isShadow, isSolid } from './levels.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_ALERT = 'alert';
export const GUARD_SEARCH = 'search';
export const GUARD_RETURN = 'return';

/** Move a circle through the level, sliding along walls. Returns true if it moved. */
export function moveCircle(level, body, dx, dy) {
  let moved = false;
  const r = body.radius;
  if (dx !== 0) {
    const nx = body.x + dx;
    if (!hitsSolid(level, nx, body.y, r)) {
      body.x = nx;
      moved = true;
    }
  }
  if (dy !== 0) {
    const ny = body.y + dy;
    if (!hitsSolid(level, body.x, ny, r)) {
      body.y = ny;
      moved = true;
    }
  }
  return moved;
}

function hitsSolid(level, x, y, r) {
  // Check the circle's bounding box corners (inset a little so sliding feels smooth).
  const inset = r * 0.55;
  return (
    isSolid(level, x - inset, y - inset) ||
    isSolid(level, x + inset, y - inset) ||
    isSolid(level, x - inset, y + inset) ||
    isSolid(level, x + inset, y + inset)
  );
}

export function createGuard(route, index) {
  const start = route[0];
  return {
    index,
    route,
    waypoint: 1 % route.length,
    x: start.x,
    y: start.y,
    radius: GUARD_RADIUS,
    angle: 0,
    state: GUARD_PATROL,
    suspicion: 0,
    pauseTimer: 0,
    scanTimer: 0,
    alertTimer: 0,
    searchTimer: 0,
    scanBase: 0,
    lastSeen: null,
    investigate: null,
    speed: GUARD_PATROL_SPEED,
    walkPhase: 0,
  };
}

/** Can this guard see the player right now (range, cone, line of sight)? */
export function canSeeGuard(level, guard, player) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > CONE_RANGE) return false;
  if (dist > CONE_NEAR_RANGE) {
    const angleTo = Math.atan2(dy, dx);
    let diff = angleTo - guard.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > CONE_HALF_ANGLE) return false;
  }
  return hasLineOfSight(level, guard.x, guard.y, player.x, player.y);
}

/** How fast suspicion rises while this guard can see the player. */
export function detectionRate(level, guard, player) {
  const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
  let rate = DETECT_BASE;
  if (dist < 110) rate *= DETECT_CLOSE_MULT;
  else if (dist > 190) rate *= 0.6;
  if (player.sneaking) rate *= DETECT_SNEAK_MULT;
  if (player.running) rate *= DETECT_RUN_MULT;
  if (isShadow(level, player.x, player.y)) rate *= DETECT_SHADOW_MULT;
  if (isLit(level, player.x, player.y)) rate *= DETECT_LIGHT_MULT;
  return rate;
}

/** A guard heard a noise at (x, y): go look, unless already chasing. */
export function hearNoise(guard, x, y, level) {
  if (guard.state === GUARD_ALERT) return;
  guard.investigate = { x, y };
  if (guard.state !== GUARD_SEARCH) {
    guard.state = GUARD_SUSPICIOUS;
    guard.suspicion = Math.max(guard.suspicion, SUSPICIOUS_AT);
  }
}

function moveToward(level, guard, tx, ty, speed, dt, stopAt = 2) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  if (dist <= stopAt) return true;
  const step = Math.min(dist - stopAt, speed * dt);
  guard.angle = Math.atan2(dy, dx);
  moveCircle(level, guard, (dx / dist) * step, (dy / dist) * step);
  guard.walkPhase += dt * 9;
  return dist - step <= stopAt + 0.5;
}

/**
 * Advance one guard. Returns event strings for the world to announce:
 * 'spotted' when a guard's meter fills, 'lost' when an alarm gives up.
 */
export function updateGuard(level, guard, player, dt, events) {
  const sees = canSeeGuard(level, guard, player);
  if (sees) {
    guard.suspicion = Math.min(ALARM_AT, guard.suspicion + detectionRate(level, guard, player) * dt);
    guard.lastSeen = { x: player.x, y: player.y };
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - DETECT_DECAY * dt);
  }

  if (guard.suspicion >= ALARM_AT && guard.state !== GUARD_ALERT) {
    guard.state = GUARD_ALERT;
    guard.alertTimer = ALARM_DURATION;
    guard.investigate = null;
    events.push('spotted');
  }

  switch (guard.state) {
    case GUARD_PATROL: {
      if (guard.suspicion >= SUSPICIOUS_AT && guard.lastSeen) {
        guard.state = GUARD_SUSPICIOUS;
        guard.investigate = { ...guard.lastSeen };
        break;
      }
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
        guard.scanTimer += dt;
        // Look around while paused at a waypoint, sweeping either side of
        // the direction the guard arrived facing — never drifting away.
        guard.angle = guard.scanBase + Math.sin(guard.scanTimer * 1.6) * 0.9;
        break;
      }
      const target = guard.route[guard.waypoint];
      if (moveToward(level, guard, target.x, target.y, GUARD_PATROL_SPEED, dt)) {
        guard.waypoint = (guard.waypoint + 1) % guard.route.length;
        guard.pauseTimer = 1.1;
        guard.scanTimer = 0;
        guard.scanBase = guard.angle;
      }
      break;
    }
    case GUARD_SUSPICIOUS: {
      const target = guard.investigate ?? guard.lastSeen;
      // Stop a little short and look: walking onto the exact spot would
      // catch a player who is still there with no chance to slip away.
      if (target && moveToward(level, guard, target.x, target.y, GUARD_INVESTIGATE_SPEED, dt, 55)) {
        guard.state = GUARD_SEARCH;
        guard.searchTimer = SEARCH_DURATION;
        guard.scanTimer = 0;
        guard.scanBase = guard.angle;
      } else if (!target) {
        guard.state = GUARD_PATROL;
      }
      break;
    }
    case GUARD_ALERT: {
      guard.alertTimer -= dt;
      const target = guard.lastSeen ?? { x: player.x, y: player.y };
      if (sees) {
        moveToward(level, guard, player.x, player.y, GUARD_CHASE_SPEED, dt);
      } else {
        moveToward(level, guard, target.x, target.y, GUARD_CHASE_SPEED, dt);
      }
      if (guard.alertTimer <= 0) {
        guard.state = GUARD_SEARCH;
        guard.searchTimer = SEARCH_DURATION;
        guard.scanTimer = 0;
        guard.scanBase = guard.angle;
        events.push('lost');
      }
      break;
    }
    case GUARD_SEARCH: {
      guard.searchTimer -= dt;
      guard.scanTimer += dt;
      guard.angle = guard.scanBase + Math.sin(guard.scanTimer * 2.2) * 1.2;
      if (guard.searchTimer <= 0) {
        guard.state = GUARD_RETURN;
        guard.investigate = null;
      }
      break;
    }
    case GUARD_RETURN: {
      // Walk back to the nearest waypoint, then resume the patrol.
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < guard.route.length; i += 1) {
        const d = Math.hypot(guard.route[i].x - guard.x, guard.route[i].y - guard.y);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      if (moveToward(level, guard, guard.route[best].x, guard.route[best].y, GUARD_PATROL_SPEED, dt)) {
        guard.waypoint = (best + 1) % guard.route.length;
        guard.state = GUARD_PATROL;
      }
      break;
    }
    default:
      break;
  }

  // Catching the player ends the attempt.
  if (Math.hypot(player.x - guard.x, player.y - guard.y) < CATCH_RADIUS) {
    events.push('caught');
  }
}

/** The guard's vision cone as a polygon, raycast against walls and cover. */
export function conePolygon(level, guard) {
  const rays = 26;
  const points = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i <= rays; i += 1) {
    const a = guard.angle - CONE_HALF_ANGLE + (2 * CONE_HALF_ANGLE * i) / rays;
    let r = CONE_RANGE;
    // March out until a wall, in 10 px steps, then refine by 2 px.
    for (let d = 10; d <= CONE_RANGE; d += 10) {
      if (isSolid(level, guard.x + Math.cos(a) * d, guard.y + Math.sin(a) * d)) {
        r = d;
        break;
      }
    }
    points.push({ x: guard.x + Math.cos(a) * r, y: guard.y + Math.sin(a) * r });
  }
  return points;
}
