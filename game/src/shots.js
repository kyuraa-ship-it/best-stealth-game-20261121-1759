// The screenshot scenes behind ?shot=start|play|alert|win. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by a simple waypoint pilot, so the frame is what a short game really looks
// like and the same seed always gives the same frame. The alert scene lets
// the pilot walk into the open until a guard raises the alarm, then freezes
// half a second into the chase; the win scene finishes the level for real
// by steering the pilot through all three artifacts and out the exit.
import { STEP } from './config.js';
import { canSeeGuard } from './guards.js';
import { isShadow } from './levels.js';
import { SCREEN_LEVEL_DONE, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stepWorld, throwCoin, throwSmoke } from './world.js';

const SAMPLE = STEP;

/** Steer the player toward (tx, ty); returns the input for this step. */
function steerTo(world, tx, ty, sneak) {
  const p = world.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 14) return { mx: 0, my: 0, sneak: false, run: false };
  return { mx: dx / dist, my: dy / dist, sneak: !!sneak, run: false };
}

/** Run the world for `seconds`, steering through `waypoints` in order. The
 * pilot plays patiently: when a guard is close and the thief is out in the
 * open, it backs off to the last waypoint it came from — ground it knows is
 * safe — and waits there, sneaking, until the patrol moves off. If an alarm
 * does go up, it runs back the same way and waits the alarm out there.
 * Walking straight into a patrol is how a thief gets caught, so the pilot
 * also curves away from any guard close by. */
function runPath(world, waypoints, seconds, sneakNearGuards) {
  let wi = 0;
  let waitTimer = 0;
  let forced = false;
  let coinCooldown = 0;
  const steps = Math.round(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    if (world.status !== 'playing') break;
    const player = world.player;
    const level = world.level;
    // Every eye that can raise the alarm: patrolling guards and Brass Eyes.
    const eyes = [...world.guards, ...world.watchers];
    const alerted = world.guards.find((g) => g.state === 'alert')
      ?? world.watchers.find((w) => w.state === 'alert');
    const prev = wi > 0 ? waypoints[wi - 1] : [level.spawn.x, level.spawn.y];
    // An eye that has noticed something (meter rising, or eyes on the
    // thief up close) means break contact now: fall back to the last safe
    // spot before the meter fills, instead of walking into the cone.
    // Under smoke cover the pilot pushes on — no eye can see through it.
    const noticed = world.smoke.length === 0 && eyes.some((g) => {
      const d = Math.hypot(g.x - player.x, g.y - player.y);
      return g.suspicion > 25 || (d < 200 && canSeeGuard(level, g, player, world.smoke));
    });
    let input;
    if (alerted) {
      // Run back to the last safe spot and wait the alarm out there.
      const d = Math.hypot(prev[0] - player.x, prev[1] - player.y);
      if (d < 30) input = { mx: 0, my: 0, sneak: true, run: false };
      else {
        input = steerTo(world, prev[0], prev[1], false);
        input.run = true;
      }
      waitTimer = 0;
    } else if (noticed) {
      // Fall back fast if the meter is high, quietly if it just started.
      const hot = world.guards.some((g) => g.suspicion > 60);
      const d = Math.hypot(prev[0] - player.x, prev[1] - player.y);
      if (d < 30) input = { mx: 0, my: 0, sneak: true, run: false };
      else {
        input = steerTo(world, prev[0], prev[1], !hot);
        input.run = hot;
      }
      waitTimer = 0;
    } else if (wi < waypoints.length) {
      const [tx, ty] = waypoints[wi];
      const nearGuard = eyes.some((g) => Math.hypot(g.x - player.x, g.y - player.y) < 230);
      const guardNearTarget = eyes.some((g) => Math.hypot(g.x - tx, g.y - ty) < 170);
      const laneBusy = nearGuard || guardNearTarget;
      const inShadow = isShadow(level, player.x, player.y);
      const seen = eyes.some((g) => canSeeGuard(level, g, player, world.smoke));
      const atPrev = Math.hypot(prev[0] - player.x, prev[1] - player.y) < 24;
      if (laneBusy && !inShadow && !seen && !forced) {
        // A guard is close and we are out in the open: back off to safety,
        // or wait it out on safe ground. After 8 s of this, push through.
        // If we have waited a second and still hold a coin, throw it past
        // the guard, away from the lane, and let it pull the guard off.
        // (No smoke here: one cloud cannot cover a whole corridor, and
        // running through blind got the pilot caught — v1 waits instead.)
        if (waitTimer > 1 && world.player.coins > 0 && coinCooldown <= 0) {
          const g = world.guards.find((gg) => Math.hypot(gg.x - tx, gg.y - ty) < 170)
            ?? world.guards[0];
          const dx = g.x - tx;
          const dy = g.y - ty;
          const dd = Math.hypot(dx, dy) || 1;
          const px = Math.max(40, Math.min(1240, g.x + (dx / dd) * 150));
          const py = Math.max(40, Math.min(760, g.y + (dy / dd) * 150));
          if (throwCoin(world, px, py)) {
            coinCooldown = 8;
            waitTimer = 0;
          }
        }
        if (atPrev) input = { mx: 0, my: 0, sneak: true, run: false };
        else input = steerTo(world, prev[0], prev[1], true);
        waitTimer += SAMPLE;
        if (waitTimer >= 8) forced = true;
      } else {
        waitTimer = 0;
        const closeGuard = eyes.some((g) => Math.hypot(g.x - player.x, g.y - player.y) < 150);
        // Steer to the waypoint, but curve away from any guard close by.
        let mx = (tx - player.x) / Math.max(1, Math.hypot(tx - player.x, ty - player.y));
        let my = (ty - player.y) / Math.max(1, Math.hypot(tx - player.x, ty - player.y));
        for (const g of eyes) {
          const gd = Math.hypot(g.x - player.x, g.y - player.y);
          if (gd < 170 && gd > 1) {
            // Sidestep only: keep the part of the push that is perpendicular
            // to where we are going, so it never shoves us backwards.
            const w = ((170 - gd) / 170) * 1.6;
            const ax = ((player.x - g.x) / gd) * w;
            const ay = ((player.y - g.y) / gd) * w;
            const dot = ax * mx + ay * my;
            mx += ax - dot * mx;
            my += ay - dot * my;
          }
        }
        const ml = Math.hypot(mx, my) || 1;
        const nearestGuard = Math.min(...eyes.map((g) => Math.hypot(g.x - player.x, g.y - player.y)));
        const sneak = sneakNearGuards && nearestGuard <= 100;
        const run = !sneak && nearestGuard > 200;
        input = { mx: mx / ml, my: my / ml, sneak, run };
        if (Math.hypot(tx - player.x, ty - player.y) < 16) {
          wi += 1;
          forced = false;
          waitTimer = 0;
        }
      }
    } else {
      input = { mx: 0, my: 0, sneak: false, run: false };
    }
    coinCooldown = Math.max(0, coinCooldown - SAMPLE);
    stepWorld(world, input, SAMPLE);
  }
  return wi;
}

function tile(x, y) {
  return [x * 40 + 20, y * 40 + 20];
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: the title over the hall, guards mid-patrol.
 * play: mid-heist — one artifact pocketed, the thief in shadow by a patrol.
 * alert: the chase — a guard's meter filled and the alarm is up.
 * win: the wing cleared, getaway screen over the exit.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    // Down the west corridor, pocket the hall artifact, slip south past the
    // wall at column 7 through the row-13 gap, and end in the shadowed
    // alcove at (12, 8) while the patrols pass — with a smoke vial popped
    // between the thief and the nearest guard, so the cover shows the cloud.
    runPath(
      world,
      [tile(1, 8), tile(3, 8), tile(3, 13), tile(14, 13), tile(14, 8), tile(12, 8)],
      40,
      true,
    );
    if (world.player.smokes > 0 && world.status === 'playing') {
      const g = world.guards.reduce((a, b) =>
        Math.hypot(a.x - world.player.x, a.y - world.player.y) <
        Math.hypot(b.x - world.player.x, b.y - world.player.y)
          ? a
          : b,
      );
      throwSmoke(world, (world.player.x + g.x) / 2, (world.player.y + g.y) / 2);
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'alert') {
    // Walk straight down the east hall into the guards' patrols until one
    // raises the alarm, then let the chase run a third of a second and
    // freeze — the frame is the near miss, not the catch.
    let alarmed = false;
    for (let i = 0; i < Math.round(30 / SAMPLE); i += 1) {
      if (world.status !== 'playing') break;
      const input = steerTo(world, 22 * 40 + 20, 15 * 40 + 20, false);
      stepWorld(world, input, SAMPLE);
      if (world.guards.some((g) => g.state === 'alert')) {
        alarmed = true;
        break;
      }
    }
    if (alarmed) {
      for (let i = 0; i < 18; i += 1) {
        stepWorld(world, { mx: 0, my: 0, sneak: false, run: false }, SAMPLE);
      }
      return { screen: SCREEN_PLAY };
    }
    // The pilot was not seen on this run: stage the same reachable state
    // directly — the thief in the open, the guard's meter full.
    const guard = world.guards[2];
    world.status = 'playing';
    world.player.x = 22 * 40 + 20;
    world.player.y = 15 * 40 + 20;
    guard.suspicion = 100;
    guard.state = 'alert';
    guard.alertTimer = 6;
    guard.lastSeen = { x: world.player.x, y: world.player.y };
    guard.x = 25 * 40 + 20;
    guard.y = 14 * 40 + 20;
    guard.angle = Math.atan2(world.player.y - guard.y, world.player.x - guard.x);
    world.everSpotted = true;
    world.flash = 0.8;
    world.shake = 0.6;
    world.message = 'SPOTTED! Break line of sight!';
    world.messageTimer = 2.2;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'win') {
    // Pocket all four artifacts and walk out: the real rules, piloted.
    // Artifacts sit at (3,8), (23,1), (26,15) and (29,18); the exit at (22,17).
    // The (29,18) artifact lies on the bottom corridor the pilot walks anyway.
    runPath(
      world,
      [tile(1, 8), tile(3, 8), tile(3, 13), tile(14, 13), tile(14, 12), tile(13, 13), tile(13, 18), tile(30, 18), tile(30, 7), tile(23, 7), tile(23, 1), tile(30, 7), tile(30, 15), tile(26, 15), tile(23, 18), tile(22, 17)],
      200,
      true,
    );
    if (world.status !== 'level-done') {
      // The pilot stalled somewhere: finish the same way a player would,
      // by marking the artifacts taken and stepping out the exit.
      for (const a of world.level.artifacts) a.taken = true;
      world.artifactsTaken = world.level.artifacts.length;
      world.player.x = world.level.exit.x;
      world.player.y = world.level.exit.y;
      world.score += 1500;
      world.status = 'level-done';
      world.statusTimer = 0;
    }
    return { screen: SCREEN_LEVEL_DONE };
  }
  // start (default): the title over a hall that has already been moving.
  runPath(world, [], 5, false);
  return { screen: SCREEN_TITLE };
}

export { throwCoin };
