// The thief: movement with acceleration, three gaits (sneak / walk / run),
// and the noise each one makes. The player never touches the DOM: the
// world feeds it an input vector and it reports where it is and how loud.
import {
  NOISE_RUN,
  NOISE_SNEAK,
  NOISE_WALK,
  PLAYER_ACCEL,
  PLAYER_RADIUS,
  PLAYER_RUN_SPEED,
  PLAYER_SNEAK_SPEED,
  PLAYER_WALK_SPEED,
} from './config.js';
import { moveCircle } from './guards.js';

export function createPlayer(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    radius: PLAYER_RADIUS,
    angle: -Math.PI / 2,
    sneaking: false,
    running: false,
    moving: false,
    noise: 0,
    stepPhase: 0,
    coins: 3,
  };
}

/**
 * Step the player. `input` is { mx, my } in -1..1 plus { sneak, run }.
 * Returns the noise radius the player made this step (0 when silent).
 */
export function updatePlayer(level, player, input, dt) {
  player.sneaking = !!input.sneak;
  player.running = !!input.run && !input.sneak;
  const speed = player.sneaking
    ? PLAYER_SNEAK_SPEED
    : player.running
      ? PLAYER_RUN_SPEED
      : PLAYER_WALK_SPEED;

  const len = Math.hypot(input.mx, input.my);
  player.moving = len > 0.05;
  let tx = 0;
  let ty = 0;
  if (player.moving) {
    tx = (input.mx / Math.max(1, len)) * speed;
    ty = (input.my / Math.max(1, len)) * speed;
    player.angle = Math.atan2(input.my, input.mx);
  }
  // Accelerate toward the target velocity, so starting and stopping feel weighted.
  const k = Math.min(1, (PLAYER_ACCEL / Math.max(1, speed)) * dt);
  player.vx += (tx - player.vx) * k;
  player.vy += (ty - player.vy) * k;
  moveCircle(level, player, player.vx * dt, player.vy * dt);

  player.noise = !player.moving ? 0 : player.sneaking ? NOISE_SNEAK : player.running ? NOISE_RUN : NOISE_WALK;
  if (player.moving) player.stepPhase += dt * (player.sneaking ? 5 : player.running ? 13 : 9);
  return player.noise;
}
