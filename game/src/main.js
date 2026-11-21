// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between screens: title,
// briefing, play, paused, caught, level done, game over and victory.
//
// ?seed=N fixes the random stream. ?shot=start|play|alert|win (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createAudio } from './audio.js';
import {
  ACTION_CONFIRM,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_RESTART,
  createInput,
} from './input.js';
import { createRandom } from './random.js';
import {
  SCREEN_BRIEF,
  SCREEN_CAUGHT,
  SCREEN_GAME_OVER,
  SCREEN_LEVEL_DONE,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_VICTORY,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';
import {
  WORLD_CAUGHT,
  WORLD_GAME_OVER,
  WORLD_LEVEL_DONE,
  WORLD_PLAYING,
  createWorld,
  nextLevel,
  restartLevel,
  stepWorld,
  throwCoin,
} from './world.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;
const BEST_KEY = 'velvet-shadow-best';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
let world = createWorld(0, random);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score lasts one visit.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, { best: readBest() });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function setScreen(next) {
    screen = next;
    const lines = {
      [SCREEN_TITLE]: 'Velvet Shadow. Press Enter to begin.',
      [SCREEN_BRIEF]: `${world.level.name}. ${world.level.brief}`,
      [SCREEN_PLAY]: 'Playing. Stay out of the vision cones.',
      [SCREEN_PAUSED]: 'Paused.',
      [SCREEN_CAUGHT]: 'Caught. Press Enter to retry the wing.',
      [SCREEN_LEVEL_DONE]: 'Wing cleared. Press Enter to continue.',
      [SCREEN_GAME_OVER]: 'Game over. Press Enter to try again.',
      [SCREEN_VICTORY]: 'The whole gallery is yours. Press Enter to play again.',
    };
    status.textContent = lines[next] ?? '';
  }

  function startLevel(index, keepScore) {
    const score = keepScore ? world.score : 0;
    const lives = keepScore ? world.lives : 3;
    world = createWorld(index, random);
    world.score = score;
    world.lives = lives;
    setScreen(SCREEN_BRIEF);
  }

  function frame(now) {
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;

    // One-shot actions, whatever the screen.
    if (input.takeAction(ACTION_MUTE)) {
      audio.setMuted(!audio.muted);
      world.muted = audio.muted;
    }

    if (screen === SCREEN_PLAY) {
      if (input.takeAction(ACTION_PAUSE)) {
        setScreen(SCREEN_PAUSED);
      } else if (input.takeAction(ACTION_RESTART)) {
        startLevel(world.levelIndex, true);
      } else {
        const click = input.takeClick();
        if (click) {
          audio.ensure();
          if (throwCoin(world, click.x, click.y)) audio.play('coin');
        }
        accumulator += elapsed;
        while (accumulator >= STEP) {
          const events = stepWorld(world, input, STEP);
          accumulator -= STEP;
          for (const event of events) {
            if (event === 'step') audio.play('step', { running: world.player.running, sneaking: world.player.sneaking });
            else if (event === 'alarm' || event === 'spotted') audio.play('alarm');
            else if (event === 'coin-land') audio.play('coin-land');
            else if (event === 'pickup') audio.play('pickup');
            else if (event === 'level-done') audio.play('level-done');
            else if (event === 'caught' || event === 'caught-life') audio.play('caught');
            else if (event === 'game-over') audio.play('game-over');
          }
          if (world.status === WORLD_CAUGHT && world.statusTimer > 1.4) setScreen(SCREEN_CAUGHT);
          if (world.status === WORLD_GAME_OVER && world.statusTimer > 1.4) setScreen(SCREEN_GAME_OVER);
          if (world.status === WORLD_LEVEL_DONE && world.statusTimer > 1.2) {
            if (world.score > best) {
              best = world.score;
              saveBest(best);
            }
            setScreen(SCREEN_LEVEL_DONE);
          }
          if (world.status !== WORLD_PLAYING) break;
        }
      }
    } else if (screen === SCREEN_TITLE) {
      // The hall idles behind the title: guards keep patrolling.
      accumulator += elapsed;
      while (accumulator >= STEP) {
        stepWorld(world, { mx: 0, my: 0, sneak: false, run: false }, STEP);
        accumulator -= STEP;
        if (world.status !== WORLD_PLAYING) {
          world = createWorld(0, random);
          break;
        }
      }
      if (input.takeAction(ACTION_CONFIRM)) {
        audio.ensure();
        audio.play('click');
        startLevel(0, false);
      }
    } else if (screen === SCREEN_BRIEF) {
      if (input.takeAction(ACTION_CONFIRM)) {
        audio.ensure();
        audio.play('click');
        setScreen(SCREEN_PLAY);
      }
    } else if (screen === SCREEN_PAUSED) {
      if (input.takeAction(ACTION_CONFIRM) || input.takeAction(ACTION_PAUSE)) setScreen(SCREEN_PLAY);
      else if (input.takeAction(ACTION_RESTART)) startLevel(world.levelIndex, true);
    } else if (screen === SCREEN_CAUGHT) {
      if (input.takeAction(ACTION_CONFIRM)) {
        world = restartLevel(world);
        setScreen(SCREEN_BRIEF);
      }
    } else if (screen === SCREEN_LEVEL_DONE) {
      if (input.takeAction(ACTION_CONFIRM)) {
        if (world.levelIndex < 2) {
          world = nextLevel(world);
          setScreen(SCREEN_BRIEF);
        } else {
          setScreen(SCREEN_VICTORY);
        }
      }
    } else if (screen === SCREEN_GAME_OVER) {
      if (input.takeAction(ACTION_CONFIRM)) startLevel(0, false);
    } else if (screen === SCREEN_VICTORY) {
      if (input.takeAction(ACTION_CONFIRM)) startLevel(0, false);
    }

    renderer.draw(world, screen, { best });
    requestAnimationFrame(frame);
  }

  setScreen(SCREEN_TITLE);
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
