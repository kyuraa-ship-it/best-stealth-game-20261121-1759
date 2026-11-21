// Everything the player sees: the museum floor, the guards and their vision
// cones, the lighting that shows what is safe, the HUD, and every screen.
// The canvas is drawn at 1280x800 and scaled by CSS; nothing here reads
// input or changes the world, it only paints a state.
import { COLORS, TILE, VIEW_H, VIEW_W } from './config.js';
import { conePolygon } from './guards.js';
import { WORLD_CAUGHT, WORLD_GAME_OVER, WORLD_LEVEL_DONE, WORLD_PLAYING } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_BRIEF = 'brief';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_LEVEL_DONE = 'level-done';
export const SCREEN_GAME_OVER = 'game-over';
export const SCREEN_VICTORY = 'victory';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const ctx = canvas.getContext('2d');
  const lightCanvas = document.createElement('canvas');
  lightCanvas.width = VIEW_W;
  lightCanvas.height = VIEW_H;
  const lightCtx = lightCanvas.getContext('2d');

  function drawFloor(level) {
    for (let y = 0; y < level.rows; y += 1) {
      for (let x = 0; x < level.cols; x += 1) {
        const key = `${x},${y}`;
        const px = x * TILE;
        const py = y * TILE;
        if (level.walls.has(key)) {
          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = COLORS.wallTop;
          ctx.fillRect(px, py, TILE, 5);
          ctx.fillStyle = 'rgba(201,162,75,0.25)';
          ctx.fillRect(px, py + TILE - 2, TILE, 2);
          continue;
        }
        ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = COLORS.floorLine;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        if (level.shadow.has(key)) {
          ctx.fillStyle = 'rgba(6, 8, 14, 0.55)';
          ctx.fillRect(px, py, TILE, TILE);
        }
        if (level.light.has(key)) {
          const g = ctx.createRadialGradient(px + 20, py + 20, 2, px + 20, py + 20, 34);
          g.addColorStop(0, 'rgba(255, 217, 138, 0.30)');
          g.addColorStop(1, 'rgba(255, 217, 138, 0)');
          ctx.fillStyle = g;
          ctx.fillRect(px - 14, py - 14, TILE + 28, TILE + 28);
          ctx.fillStyle = '#ffe9b0';
          ctx.beginPath();
          ctx.arc(px + 20, py + 20, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        if (level.cover.has(key)) {
          // Crates, cases and plants are drawn over the floor below.
        }
      }
    }
  }

  function drawCover(level) {
    for (const key of level.cover) {
      const [x, y] = key.split(',').map(Number);
      const px = x * TILE;
      const py = y * TILE;
      // Which kind? Re-derive from the map is not stored; crates/cases/plants
      // were recorded only as cover, so vary by position hash for looks.
      const kind = (x * 7 + y * 13) % 3;
      if (kind === 0) {
        // Wooden crate.
        ctx.fillStyle = COLORS.crate;
        ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
        ctx.fillStyle = COLORS.crateTop;
        ctx.fillRect(px + 3, py + 3, TILE - 6, 8);
        ctx.strokeStyle = '#2e2214';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
        ctx.beginPath();
        ctx.moveTo(px + 3, py + 3);
        ctx.lineTo(px + TILE - 3, py + TILE - 3);
        ctx.moveTo(px + TILE - 3, py + 3);
        ctx.lineTo(px + 3, py + TILE - 3);
        ctx.stroke();
      } else if (kind === 1) {
        // Glass display case on a plinth.
        ctx.fillStyle = '#3a2f22';
        ctx.fillRect(px + 5, py + 24, TILE - 10, 12);
        ctx.fillStyle = 'rgba(127, 178, 217, 0.28)';
        ctx.fillRect(px + 6, py + 6, TILE - 12, 20);
        ctx.strokeStyle = COLORS.caseGlass;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 6, py + 6, TILE - 12, 20);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.moveTo(px + 10, py + 24);
        ctx.lineTo(px + 18, py + 8);
        ctx.stroke();
      } else {
        // Potted plant.
        ctx.fillStyle = '#5a3d24';
        ctx.beginPath();
        ctx.arc(px + 20, py + 26, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.plant;
        ctx.beginPath();
        ctx.arc(px + 20, py + 16, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.plantTop;
        ctx.beginPath();
        ctx.arc(px + 16, py + 12, 7, 0, Math.PI * 2);
        ctx.arc(px + 25, py + 13, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawArtifacts(level) {
    const t = performance.now() / 1000;
    for (const a of level.artifacts) {
      if (a.taken) continue;
      const pulse = 0.6 + Math.sin(t * 3 + a.x) * 0.25;
      const g = ctx.createRadialGradient(a.x, a.y, 2, a.x, a.y, 34);
      g.addColorStop(0, `rgba(255, 211, 77, ${0.5 * pulse})`);
      g.addColorStop(1, 'rgba(255, 211, 77, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(a.x, a.y, 34, 0, Math.PI * 2);
      ctx.fill();
      // A small golden idol: a diamond on a plinth.
      ctx.fillStyle = '#8a6d1f';
      ctx.fillRect(a.x - 9, a.y + 8, 18, 5);
      ctx.fillStyle = COLORS.artifact;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 12);
      ctx.lineTo(a.x + 8, a.y + 2);
      ctx.lineTo(a.x, a.y + 8);
      ctx.lineTo(a.x - 8, a.y + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 12);
      ctx.lineTo(a.x + 8, a.y + 2);
      ctx.lineTo(a.x, a.y + 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawExit(level, unlocked) {
    const e = level.exit;
    const t = performance.now() / 1000;
    const glow = unlocked ? 0.5 + Math.sin(t * 4) * 0.2 : 0.12;
    const g = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, 46);
    g.addColorStop(0, unlocked ? `rgba(88, 214, 141, ${glow})` : 'rgba(90, 107, 122, 0.25)');
    g.addColorStop(1, 'rgba(88, 214, 141, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = unlocked ? COLORS.exit : COLORS.exitLocked;
    roundRect(ctx, e.x - 15, e.y - 17, 30, 34, 4);
    ctx.fill();
    ctx.fillStyle = '#0a0d14';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(unlocked ? 'EXIT' : 'LOCK', e.x, e.y + 1);
    ctx.fillStyle = unlocked ? '#d8ffe9' : '#c8d2da';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(unlocked ? '— open —' : 'needs all artifacts', e.x, e.y + 30);
  }

  function drawCones(world) {
    for (const guard of world.guards) {
      const poly = conePolygon(world.level, guard);
      const color =
        guard.state === 'alert'
          ? COLORS.coneAlarm
          : guard.suspicion >= 35
            ? COLORS.coneSuspicious
            : COLORS.coneCalm;
      const g = ctx.createRadialGradient(guard.x, guard.y, 10, guard.x, guard.y, 235);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(255, 214, 120, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i += 1) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = color.replace(/0\.\d+\)$/, '0.5)');
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawGuards(world) {
    for (const guard of world.guards) {
      const bob = Math.sin(guard.walkPhase) * 1.5;
      // Body: navy uniform with a cap, a pale face looking where it walks.
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(guard.x, guard.y + 10, 13, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.guardUniform;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y + bob * 0.2, guard.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#20293a';
      ctx.lineWidth = 2;
      ctx.stroke();
      const fx = Math.cos(guard.angle);
      const fy = Math.sin(guard.angle);
      ctx.fillStyle = COLORS.guardSkin;
      ctx.beginPath();
      ctx.arc(guard.x + fx * 5, guard.y + fy * 5, 7, 0, Math.PI * 2);
      ctx.fill();
      // Cap brim.
      ctx.fillStyle = '#1d2637';
      ctx.beginPath();
      ctx.arc(guard.x + fx * 8, guard.y + fy * 8, 5, 0, Math.PI * 2);
      ctx.fill();
      // Suspicion: a ring filling over the guard, plus ? or !.
      if (guard.suspicion > 1) {
        ctx.strokeStyle = guard.state === 'alert' ? COLORS.danger : '#ffb042';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(guard.x, guard.y, guard.radius + 6, -Math.PI / 2, -Math.PI / 2 + (guard.suspicion / 100) * Math.PI * 2);
        ctx.stroke();
      }
      if (guard.state === 'alert') {
        ctx.fillStyle = COLORS.danger;
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', guard.x, guard.y - guard.radius - 8);
      } else if (guard.suspicion >= 35) {
        ctx.fillStyle = '#ffb042';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('?', guard.x, guard.y - guard.radius - 8);
      }
    }
  }

  function drawPlayer(world) {
    const p = world.player;
    const bob = p.moving ? Math.sin(p.stepPhase) * 1.5 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 10, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hooded cloak, amber scarf, pale mask — readable against the floor.
    ctx.fillStyle = COLORS.playerCloak;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob * 0.2, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.playerScarf;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius - 1, p.angle - 0.9, p.angle + 0.9);
    ctx.stroke();
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20242e';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 6.5, p.y + Math.sin(p.angle) * 6.5 - 1, 1.6, 0, Math.PI * 2);
    ctx.arc(p.x + Math.cos(p.angle) * 6.5, p.y + Math.sin(p.angle) * 6.5 + 2.5, 1.6, 0, Math.PI * 2);
    ctx.fill();
    if (p.sneaking) {
      ctx.strokeStyle = 'rgba(232, 228, 216, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawCoins(world) {
    for (const coin of world.coins) {
      ctx.fillStyle = COLORS.coin;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, coin.landed ? 4 : 6, 0, Math.PI * 2);
      ctx.fill();
      if (coin.landed && coin.ringTimer > 0) {
        const r = (1.2 - coin.ringTimer) * 160;
        ctx.strokeStyle = `rgba(232, 193, 90, ${coin.ringTimer / 1.2})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawParticles(world) {
    for (const p of world.particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawLighting(world) {
    lightCtx.clearRect(0, 0, VIEW_W, VIEW_H);
    lightCtx.fillStyle = 'rgba(4, 6, 12, 0.62)';
    lightCtx.fillRect(0, 0, VIEW_W, VIEW_H);
    lightCtx.globalCompositeOperation = 'destination-out';
    const cut = (x, y, r, strength) => {
      const g = lightCtx.createRadialGradient(x, y, 4, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${strength})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lightCtx.fillStyle = g;
      lightCtx.beginPath();
      lightCtx.arc(x, y, r, 0, Math.PI * 2);
      lightCtx.fill();
    };
    // Moonlight through the skylights and the lamps stay visible.
    for (const key of world.level.light) {
      const [x, y] = key.split(',').map(Number);
      cut(x * TILE + 20, y * TILE + 20, 90, 0.85);
    }
    for (const guard of world.guards) cut(guard.x, guard.y, 70, 0.5);
    cut(world.player.x, world.player.y, 150, 0.95);
    cut(world.level.exit.x, world.level.exit.y, 70, 0.6);
    lightCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(lightCanvas, 0, 0);
  }

  function drawNoiseRing(world) {
    const p = world.player;
    if (p.noise > 0 && p.moving) {
      ctx.strokeStyle = `rgba(232, 228, 216, ${p.running ? 0.35 : 0.16})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.noise, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawHud(world, screen) {
    const p = world.player;
    const maxSuspicion = Math.max(0, ...world.guards.map((g) => g.suspicion));
    ctx.fillStyle = COLORS.hudBg;
    roundRect(ctx, 12, 12, 560, 54, 10);
    ctx.fill();
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(world.level.name, 28, 30);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`Score ${world.score}   •   ${Math.floor(world.time / 60)}:${String(Math.floor(world.time % 60)).padStart(2, '0')}`, 28, 52);
    // Artifacts.
    for (let i = 0; i < world.artifactsTotal; i += 1) {
      const x = 330 + i * 26;
      ctx.fillStyle = i < world.artifactsTaken ? COLORS.artifact : 'rgba(255, 211, 77, 0.25)';
      ctx.beginPath();
      ctx.moveTo(x, 22);
      ctx.lineTo(x + 7, 32);
      ctx.lineTo(x, 40);
      ctx.lineTo(x - 7, 32);
      ctx.closePath();
      ctx.fill();
    }
    // Coins and lives.
    ctx.fillStyle = COLORS.coin;
    ctx.beginPath();
    ctx.arc(440, 31, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`× ${p.coins}`, 452, 32);
    ctx.fillStyle = '#ff7a6e';
    ctx.fillText(`♥ ${'●'.repeat(world.lives)}${'○'.repeat(Math.max(0, 3 - world.lives))}`, 500, 32);

    // Suspicion meter, top right.
    const mw = 260;
    const mx = VIEW_W - mw - 16;
    ctx.fillStyle = COLORS.hudBg;
    roundRect(ctx, mx - 4, 12, mw + 8, 54, 10);
    ctx.fill();
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('DETECTION', mx + 8, 28);
    const col = maxSuspicion >= 100 ? COLORS.danger : maxSuspicion >= 35 ? '#ffb042' : '#58d68d';
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, mx + 8, 38, mw - 16, 12, 6);
    ctx.fill();
    ctx.fillStyle = col;
    roundRect(ctx, mx + 8, 38, Math.max(4, (mw - 16) * (maxSuspicion / 100)), 12, 6);
    ctx.fill();
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(maxSuspicion >= 100 ? 'ALARM!' : maxSuspicion >= 35 ? 'SUSPICIOUS' : 'UNSEEN', mx + mw - 8, 28);
    ctx.textAlign = 'left';

    // Message toast.
    if (world.message && world.messageTimer > 0) {
      ctx.globalAlpha = Math.min(1, world.messageTimer);
      ctx.fillStyle = COLORS.hudBg;
      const w = ctx.measureText(world.message).width + 36;
      roundRect(ctx, (VIEW_W - w) / 2, 84, w, 36, 10);
      ctx.fill();
      ctx.fillStyle = COLORS.text;
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(world.message, VIEW_W / 2, 103);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }

    // Controls hint, bottom left.
    ctx.fillStyle = 'rgba(10, 13, 20, 0.55)';
    roundRect(ctx, 12, VIEW_H - 40, 470, 28, 8);
    ctx.fill();
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('WASD move  •  Shift sneak  •  Space run  •  Click throw coin  •  P pause  •  M mute', 24, VIEW_H - 25);

    if (screen === SCREEN_PLAY) drawMinimap(world);
  }

  function drawMinimap(world) {
    const s = 0.14;
    const w = world.level.width * s;
    const h = world.level.height * s;
    const x0 = VIEW_W - w - 16;
    const y0 = VIEW_H - h - 16;
    ctx.fillStyle = 'rgba(10, 13, 20, 0.78)';
    roundRect(ctx, x0 - 6, y0 - 6, w + 12, h + 12, 8);
    ctx.fill();
    ctx.fillStyle = '#2c3444';
    ctx.fillRect(x0, y0, w, h);
    for (const key of world.level.walls) {
      const [x, y] = key.split(',').map(Number);
      ctx.fillStyle = '#4a5468';
      ctx.fillRect(x0 + x * TILE * s, y0 + y * TILE * s, TILE * s, TILE * s);
    }
    for (const a of world.level.artifacts) {
      if (a.taken) continue;
      ctx.fillStyle = COLORS.artifact;
      ctx.fillRect(x0 + a.x * s - 2, y0 + a.y * s - 2, 4, 4);
    }
    ctx.fillStyle = COLORS.exit;
    ctx.fillRect(x0 + world.level.exit.x * s - 2, y0 + world.level.exit.y * s - 2, 4, 4);
    for (const g of world.guards) {
      ctx.fillStyle = g.state === 'alert' ? COLORS.danger : '#ff9a3d';
      ctx.beginPath();
      ctx.arc(x0 + g.x * s, y0 + g.y * s, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x0 + world.player.x * s, y0 + world.player.y * s, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function overlay(title, lines, accent = COLORS.text) {
    ctx.fillStyle = 'rgba(5, 7, 12, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = accent;
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, VIEW_W / 2, 300);
    ctx.fillStyle = COLORS.text;
    ctx.font = '17px system-ui, sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 350 + i * 30));
    ctx.textAlign = 'left';
  }

  function drawTitle(world) {
    drawFloor(world.level);
    drawCover(world.level);
    drawArtifacts(world.level);
    drawExit(world.level, false);
    drawCones(world);
    drawGuards(world);
    drawPlayer(world);
    drawLighting(world);
    ctx.fillStyle = 'rgba(5, 7, 12, 0.66)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = COLORS.artifact;
    ctx.font = 'bold 64px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('VELVET SHADOW', VIEW_W / 2, 250);
    ctx.fillStyle = COLORS.text;
    ctx.font = '20px Georgia, serif';
    ctx.fillText('A heist in the Meridian Gallery — unseen is the only way in.', VIEW_W / 2, 292);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('Three nights. Three wings. Three artifacts a night. One exit.', VIEW_W / 2, 330);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText('Press ENTER to begin', VIEW_W / 2, 420);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('WASD move  •  Shift sneak  •  Space run  •  Click throws a coin to distract a guard', VIEW_W / 2, 460);
    ctx.fillText('Stay out of the cones. Shadow hides you, lamplight exposes you. Running is loud.', VIEW_W / 2, 486);
    ctx.fillText('Best score is kept in this browser.', VIEW_W / 2, 512);
    ctx.textAlign = 'left';
  }

  function draw(world, screen, ui) {
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    const shakeX = world.shake > 0 ? (Math.random() - 0.5) * world.shake * 8 : 0;
    const shakeY = world.shake > 0 ? (Math.random() - 0.5) * world.shake * 8 : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    if (screen === SCREEN_TITLE) {
      drawTitle(world);
      ctx.restore();
      return;
    }
    drawFloor(world.level);
    drawCover(world.level);
    drawArtifacts(world.level);
    drawExit(world.level, world.artifactsTaken === world.artifactsTotal);
    drawCones(world);
    drawGuards(world);
    drawCoins(world);
    drawParticles(world);
    drawPlayer(world);
    drawNoiseRing(world);
    drawLighting(world);
    if (world.flash > 0) {
      ctx.fillStyle = `rgba(255, 60, 50, ${world.flash * 0.16})`;
      ctx.fillRect(-10, -10, VIEW_W + 20, VIEW_H + 20);
    }
    drawHud(world, screen);
    if (screen === SCREEN_BRIEF) {
      overlay(world.level.name, [
        world.level.brief,
        '',
        'Steal all 3 artifacts, then slip out through the green exit.',
        'Press ENTER to start the night.',
      ]);
    } else if (screen === SCREEN_PAUSED) {
      overlay('Paused', ['Take a breath. The guards wait.', '', 'ENTER resume  •  R restart level  •  M mute']);
    } else if (screen === SCREEN_CAUGHT) {
      overlay('Caught!', [
        `A guard laid hands on you. ${world.lives} ${world.lives === 1 ? 'life' : 'lives'} left.`,
        '',
        'Press ENTER — the night resets, the patrols forget you.',
      ], COLORS.danger);
    } else if (screen === SCREEN_LEVEL_DONE) {
      overlay(`Wing ${world.levelIndex + 1} cleared — unseen enough.`, [
        `Score ${world.score}   •   Time ${Math.floor(world.time / 60)}:${String(Math.floor(world.time % 60)).padStart(2, '0')}`,
        world.everSpotted ? 'You were spotted — the ghost bonus slipped away.' : 'Ghost bonus: never fully spotted. +400',
        '',
        world.levelIndex < 2 ? 'Press ENTER for the next wing.' : 'Press ENTER to see the whole haul.',
      ], COLORS.exit);
    } else if (screen === SCREEN_GAME_OVER) {
      overlay('The gallery wins this time.', [
        `Score ${world.score} — the artifacts stay behind glass.`,
        '',
        'Press ENTER to try the night again.',
      ], COLORS.danger);
    } else if (screen === SCREEN_VICTORY) {
      overlay('The Silent Gallery — complete.', [
        `Final score ${world.score}. Three wings, three getaways.`,
        ui.best > 0 ? `Best score in this browser: ${ui.best}` : '',
        '',
        'Press ENTER to play again from the first wing.',
      ], COLORS.artifact);
    }
    ctx.restore();
  }

  return { draw, SCREEN_TITLE, SCREEN_BRIEF, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_CAUGHT, SCREEN_LEVEL_DONE, SCREEN_GAME_OVER, SCREEN_VICTORY };
}
