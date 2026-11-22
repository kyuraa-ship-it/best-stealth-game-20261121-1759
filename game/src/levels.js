// The three heists. Each level is a hand-drawn map of tiles, 32 wide by 20
// tall, plus the guards' patrol routes. Legend:
//   # wall        . floor       , shadow (dark: harder to be seen)
//   o lamp pool (lit: easier to be seen)   C crate (cover, blocks sight)
//   D display case (cover, blocks sight)  P plant (cover, blocks sight)
//   * artifact    E exit        S player spawn
//   W Brass Eye watcher (static sentinel, cone sweeps 360 degrees)
// Guard routes are tile coordinates; a guard walks them in order, pauses at
// each stop, and turns to look around before moving on.
import { TILE } from './config.js';

const LEVEL_1 = [
  '################################',
  '#S......o.......#......*.......#',
  '#.......,,,,....#..............#',
  '#.CC....,,,,....#...DD.........#',
  '#.......,,,,....#..............#',
  '#..o...........#......o........#',
  '#......#######.########........#',
  '#......#.............#.........#',
  '#..*...#....,,,,....#.CC.......#',
  '#......#....,,,,....#..........#',
  '#......#....,,,,....#....o.....#',
  '#......#............#..........#',
  '#......#######.########........#',
  '#......o.......#...............#',
  '#.DD...........#......,,.......#',
  '#.............#......,,...*....#',
  '#....CC.......#....W.,,........#',
  '#.............#.......E........#',
  '#......o.....................*.#',
  '################################',
];

const LEVEL_2 = [
  '################################',
  '#S...o.....,,,,.....#....*.....#',
  '#..........,,,,.....#..........#',
  '#.CC......,,,,..D...#..DD......#',
  '#..........,,,,.....#..........#',
  '#....o...........o..#######....#',
  '#..................#.....#.....#',
  '#..*....CC.........#.....#..o..#',
  '#...........W......#.....#.....#',
  '#....,,,,....D......#.....#....#',
  '#....,,,,...........#######.*..#',
  '#....,,,,....o.................#',
  '#..........######.######.......#',
  '#.DD.......#..........#...CC...#',
  '#..........#....,,....#........#',
  '#....o.....#....,,.*..#.DD.....#',
  '#..........#....,,....#........#',
  '#....CC....#..........#....o...#',
  '#..........#....E..............#',
  '################################',
];

const LEVEL_3 = [
  '################################',
  '#S....o....#.....,,,,....*.....#',
  '#.........#......,,,,..........#',
  '#.CC......#..D..,,,,....DD.....#',
  '#.........#......,,,,..........#',
  '#....o....#######.#######......#',
  '#........#.............#..o....#',
  '#..*.....#..CC........#.......#',
  '#........#.............#.......#',
  '#..,,....#.DD....o.....#######.#',
  '#..,,....#................*....#',
  '#..,,....#....,,,,....CC.......#',
  '#........#....,,,,.............#',
  '#....o...#######.#######.......#',
  '#........#............#...*....#',
  '#.DD.....#....,,......#.DD.....#',
  '#........#....,,..D.W.#........#',
  '#...CC...#....,,......#....o...#',
  '#........#.....E...............#',
  '################################',
];

// Patrol routes: tile coordinates, walked in order, looping.
const ROUTES = {
  1: [
    [[6, 2], [13, 2], [13, 5], [6, 5]],
    [[24, 7], [29, 7], [29, 11], [24, 11]],
    [[22, 14], [29, 14], [29, 17], [22, 17]],
    [[24, 1], [29, 1], [29, 4], [24, 4]],
  ],
  2: [
    [[6, 1], [12, 1], [12, 4], [6, 4]],
    [[10, 5], [18, 5], [18, 7], [10, 7]],
    [[5, 13], [10, 13], [10, 16], [5, 16]],
    [[13, 13], [19, 13], [19, 17], [13, 17]],
    [[24, 13], [29, 13], [29, 16], [24, 16]],
  ],
  3: [
    [[5, 1], [9, 1], [9, 4], [5, 4]],
    [[17, 6], [21, 6], [21, 8], [17, 8]],
    [[4, 10], [8, 10], [8, 12], [4, 12]],
    [[10, 14], [16, 14], [16, 17], [10, 17]],
    [[26, 1], [29, 1], [29, 4], [26, 4]],
    [[25, 5], [29, 5], [29, 7], [25, 7]],
  ],
};

export const LEVEL_NAMES = [
  'I — The Marble Hall',
  'II — The East Wing',
  'III — The Vault',
];

export const LEVEL_BRIEFS = [
  'Four artifacts, four guards. Learn the patrols, stay in the dark — and mind the Brass Eye.',
  'Five guards and a Brass Eye watcher. Smoke vials (Q) hide you from every eye.',
  'Six guards, tight corridors. Never be seen twice — the alarm is fast here.',
];

/** Parse one map into walls, cover, shadow, light, artifacts, exit, spawn. */
export function parseLevel(index) {
  const rows = [LEVEL_1, LEVEL_2, LEVEL_3][index];
  const walls = new Set();
  const cover = new Set();
  const shadow = new Set();
  const light = new Set();
  const artifacts = [];
  const watchers = [];
  let exit = null;
  let spawn = null;
  for (let y = 0; y < rows.length; y += 1) {
    for (let x = 0; x < rows[y].length; x += 1) {
      const key = `${x},${y}`;
      const ch = rows[y][x];
      if (ch === '#') walls.add(key);
      else if (ch === 'C' || ch === 'D' || ch === 'P') cover.add(key);
      else if (ch === ',') shadow.add(key);
      else if (ch === 'o') light.add(key);
      else if (ch === '*') artifacts.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, taken: false });
      else if (ch === 'W') watchers.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 });
      else if (ch === 'E') exit = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
      else if (ch === 'S') spawn = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
    }
  }
  return {
    index,
    name: LEVEL_NAMES[index],
    brief: LEVEL_BRIEFS[index],
    cols: rows[0].length,
    rows: rows.length,
    width: rows[0].length * TILE,
    height: rows.length * TILE,
    walls,
    cover,
    shadow,
    light,
    artifacts,
    watchers,
    exit,
    spawn,
    routes: ROUTES[index + 1].map((route) =>
      route.map(([tx, ty]) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 })),
    ),
  };
}

/** Tile key at a pixel position. */
export function tileKey(x, y) {
  return `${Math.floor(x / TILE)},${Math.floor(y / TILE)}`;
}

/** True when the tile at a pixel position blocks movement and sight. */
export function isSolid(level, x, y) {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return true;
  const key = tileKey(x, y);
  return level.walls.has(key) || level.cover.has(key);
}

/** True when the tile at a pixel position is shadow (dark). */
export function isShadow(level, x, y) {
  return level.shadow.has(tileKey(x, y));
}

/** True when the tile at a pixel position is lit by a lamp. */
export function isLit(level, x, y) {
  return level.light.has(tileKey(x, y));
}

/** Line of sight between two points: true when no wall or cover blocks it. */
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 8));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (isSolid(level, x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}
