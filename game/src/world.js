// The world: one level's whole state and the fixed-step update that moves
// it. DOM-free, so the same code runs in the browser and in a headless Node
// test — the screenshot scenes are the real rules played forward.
import {
  COIN_HEAR_RADIUS,
  COIN_START,
  COIN_THROW_SPEED,
  LIVES_PER_LEVEL,
  SCORE_ARTIFACT,
  SCORE_GHOST_BONUS,
  SCORE_TIME_BONUS_PER_SEC,
  SMOKE_DURATION,
  SMOKE_RADIUS,
  SMOKE_THROW_SPEED,
  STEP,
} from './config.js';
import { createGuard, createWatcher, hearNoise, updateGuard, updateWatcher } from './guards.js';
import { parseLevel } from './levels.js';
import { createPlayer, updatePlayer } from './player.js';

export const WORLD_PLAYING = 'playing';
export const WORLD_CAUGHT = 'caught';
export const WORLD_LEVEL_DONE = 'level-done';
export const WORLD_GAME_OVER = 'game-over';

export function createWorld(levelIndex, random) {
  const level = parseLevel(levelIndex);
  return {
    level,
    levelIndex,
    random,
    player: createPlayer(level.spawn),
    guards: level.routes.map((route, i) => createGuard(route, i, levelIndex)),
    watchers: level.watchers.map((w, i) => createWatcher(w.x, w.y, i)),
    coins: [], // thrown distraction coins in flight / on the floor
    smoke: [], // smoke clouds: { x, y, r, timer }
    particles: [],
    artifactsTaken: 0,
    artifactsTotal: level.artifacts.length,
    lives: LIVES_PER_LEVEL,
    score: 0,
    time: 0,
    status: WORLD_PLAYING,
    statusTimer: 0,
    everSpotted: false,
    message: null,
    messageTimer: 0,
    shake: 0,
    muted: false,
    flash: 0, // red flash strength after being spotted
  };
}

export function resetWorld(world, levelIndex) {
  const fresh = createWorld(levelIndex, world.random);
  fresh.score = world.score;
  return fresh;
}

function addParticles(world, x, y, count, color, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = world.random.next() * Math.PI * 2;
    const v = speed * (0.4 + world.random.next() * 0.8);
    world.particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 0.5 + world.random.next() * 0.4,
      age: 0,
      color,
      size: 2 + world.random.next() * 3,
    });
  }
}

function setMessage(world, text, seconds = 2.4) {
  world.message = text;
  world.messageTimer = seconds;
}

/** Throw a distraction coin toward (tx, ty). Guards who hear it go look. */
export function throwCoin(world, tx, ty) {
  const player = world.player;
  if (player.coins <= 0 || world.status !== WORLD_PLAYING) return false;
  player.coins -= 1;
  const dx = tx - player.x;
  const dy = ty - player.y;
  const dist = Math.hypot(dx, dy);
  const range = Math.min(260, Math.max(60, dist));
  world.coins.push({
    x: player.x,
    y: player.y,
    vx: (dx / Math.max(1, dist)) * COIN_THROW_SPEED,
    vy: (dy / Math.max(1, dist)) * COIN_THROW_SPEED,
    range,
    travelled: 0,
    landed: false,
    ringTimer: 0,
  });
  return true;
}

/** Throw a smoke vial toward (tx, ty): a cloud that blocks every eye. */
export function throwSmoke(world, tx, ty) {
  const player = world.player;
  if (player.smokes <= 0 || world.status !== WORLD_PLAYING) return false;
  player.smokes -= 1;
  const x = Math.max(20, Math.min(world.level.width - 20, tx));
  const y = Math.max(20, Math.min(world.level.height - 20, ty));
  world.smoke.push({ x, y, r: SMOKE_RADIUS, timer: SMOKE_DURATION });
  addParticles(world, x, y, 14, '#b8bcc4', 70);
  return true;
}

/**
 * One fixed step. `input` is { mx, my, sneak, run }. Returns the events
 * this step produced, for sound and toasts: 'step', 'pickup', 'coin',
 * 'coin-land', 'spotted', 'lost', 'caught', 'exit', 'level-done'.
 */
export function stepWorld(world, input, dt = STEP) {
  const events = [];
  if (world.status !== WORLD_PLAYING) {
    world.statusTimer += dt;
    return events;
  }
  world.time += dt;
  if (world.messageTimer > 0) world.messageTimer -= dt;
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 3);
  if (world.flash > 0) world.flash = Math.max(0, world.flash - dt * 1.6);

  const noise = updatePlayer(world.level, world.player, input, dt);

  // Footstep sounds: one event per step cycle while moving.
  if (world.player.moving) {
    const prev = world.player.stepPhase - dt * (world.player.sneaking ? 5 : world.player.running ? 13 : 9);
    if (Math.floor(world.player.stepPhase / Math.PI) !== Math.floor(prev / Math.PI)) events.push('step');
  }

  // A running player is heard: guards inside the noise radius investigate.
  if (noise > 0) {
    for (const guard of world.guards) {
      if (Math.hypot(guard.x - world.player.x, guard.y - world.player.y) < noise) {
        hearNoise(guard, world.player.x, world.player.y, world.level);
      }
    }
  }

  // Thrown coins fly, land, ring, and pull nearby guards over.
  for (const coin of world.coins) {
    if (!coin.landed) {
      const step = COIN_THROW_SPEED * dt;
      coin.x += coin.vx * dt;
      coin.y += coin.vy * dt;
      coin.travelled += step;
      if (coin.travelled >= coin.range) {
        coin.landed = true;
        coin.ringTimer = 1.2;
        events.push('coin-land');
        for (const guard of world.guards) {
          if (Math.hypot(guard.x - coin.x, guard.y - coin.y) < COIN_HEAR_RADIUS) {
            hearNoise(guard, coin.x, coin.y, world.level);
          }
        }
      }
    } else if (coin.ringTimer > 0) {
      coin.ringTimer -= dt;
    }
  }
  world.coins = world.coins.filter((c) => !c.landed || c.ringTimer > 0);

  // Smoke clouds age out after a few seconds.
  for (const cloud of world.smoke) cloud.timer -= dt;
  world.smoke = world.smoke.filter((c) => c.timer > 0);

  // Guards see, chase, and catch.
  for (const guard of world.guards) {
    const before = guard.state;
    updateGuard(world.level, guard, world.player, dt, events, world.smoke);
    if (guard.suspicion >= 100) world.everSpotted = true;
    if (before !== 'alert' && guard.state === 'alert') {
      world.shake = 1;
      world.flash = 1;
      setMessage(world, 'SPOTTED! Break line of sight!', 2.2);
    }
  }

  // Brass Eye watchers sweep their cones; a full meter sounds the alarm
  // and every patrolling guard converges on where the watcher last saw you.
  for (const watcher of world.watchers) {
    const before = watcher.state;
    updateWatcher(world.level, watcher, world.player, dt, events, world.smoke);
    if (watcher.suspicion >= 100) world.everSpotted = true;
    if (before !== 'alert' && watcher.state === 'alert') {
      world.shake = 1;
      world.flash = 1;
      setMessage(world, 'SPOTTED! Break line of sight!', 2.2);
      for (const guard of world.guards) {
        if (watcher.lastSeen) hearNoise(guard, watcher.lastSeen.x, watcher.lastSeen.y, world.level);
      }
    }
  }
  if (events.includes('spotted')) events.push('alarm');

  // Artifacts: walk over one to pocket it.
  for (const artifact of world.level.artifacts) {
    if (!artifact.taken && Math.hypot(artifact.x - world.player.x, artifact.y - world.player.y) < 30) {
      artifact.taken = true;
      world.artifactsTaken += 1;
      world.score += SCORE_ARTIFACT;
      addParticles(world, artifact.x, artifact.y, 18, '#ffd34d', 120);
      events.push('pickup');
      setMessage(
        world,
        world.artifactsTaken === world.artifactsTotal
          ? 'All artifacts secured — reach the green exit!'
          : `Artifact secured (${world.artifactsTaken}/${world.artifactsTotal})`,
      );
    }
  }

  // The exit opens once every artifact is taken.
  const exit = world.level.exit;
  if (
    world.artifactsTaken === world.artifactsTotal &&
    Math.hypot(exit.x - world.player.x, exit.y - world.player.y) < 34
  ) {
    const par = [150, 180, 210][world.levelIndex] ?? 180;
    const timeBonus = Math.max(0, Math.round((par - world.time) * SCORE_TIME_BONUS_PER_SEC));
    const ghost = world.everSpotted ? 0 : SCORE_GHOST_BONUS;
    world.score += timeBonus + ghost;
    world.status = WORLD_LEVEL_DONE;
    world.statusTimer = 0;
    addParticles(world, exit.x, exit.y, 30, '#58d68d', 160);
    events.push('level-done');
    setMessage(world, ghost > 0 ? `Ghost bonus +${SCORE_GHOST_BONUS} — never spotted!` : 'Clean getaway!');
  }

  // Caught: lose a life, restart the level; no lives left ends the run.
  if (events.includes('caught')) {
    world.lives -= 1;
    world.shake = 1;
    if (world.lives <= 0) {
      world.status = WORLD_GAME_OVER;
      world.statusTimer = 0;
      events.push('game-over');
    } else {
      world.status = WORLD_CAUGHT;
      world.statusTimer = 0;
      events.push('caught-life');
      setMessage(world, `Caught! ${world.lives} ${world.lives === 1 ? 'life' : 'lives'} left — the level resets.`, 2.6);
    }
  }

  // Particles fade.
  for (const p of world.particles) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
  }
  world.particles = world.particles.filter((p) => p.age < p.life);

  return events;
}

/** Restart the current level after being caught, keeping the score. */
export function restartLevel(world) {
  const score = world.score;
  const next = createWorld(world.levelIndex, world.random);
  next.score = score;
  next.lives = world.lives;
  return next;
}

/** Move to the next level, keeping score and lives. */
export function nextLevel(world) {
  const score = world.score;
  const next = createWorld(world.levelIndex + 1, world.random);
  next.score = score;
  next.lives = world.lives;
  return next;
}

export { COIN_START };
