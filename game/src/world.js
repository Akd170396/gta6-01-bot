// The city of Solmara: a road grid, building blocks, a park and a marina.
// Roads run on a 450-unit grid; every mission target sits on a road centreline
// so the player can always drive or walk straight to it.
import { makeRng, range, int, pick, chance } from './rng.js';

export const WORLD = 3600;
export const STEP = 450;
export const ROAD_W = 84;
export const ROAD_HALF = ROAD_W / 2;

export const BUILDING_COLORS = [
  '#c96f4a', '#4a7fb5', '#d9a441', '#8a6fb5',
  '#5aa08a', '#b5546e', '#7a8a99', '#e07b39',
];

export function roadCenter(k) {
  return k * STEP;
}

// Is this point on a road (inside the asphalt)?
export function isOnRoad(x, y) {
  const rx = x - Math.round(x / STEP) * STEP;
  const ry = y - Math.round(y / STEP) * STEP;
  return Math.abs(rx) <= ROAD_HALF || Math.abs(ry) <= ROAD_HALF;
}

// Snap a point onto the nearest road centreline.
export function snapToRoad(x, y) {
  const nx = Math.round(x / STEP) * STEP;
  const ny = Math.round(y / STEP) * STEP;
  if (Math.abs(x - nx) <= Math.abs(y - ny)) return { x: nx, y };
  return { x, y: ny };
}

// The nearest road crossing to a point, for spawning and rally points.
export function nearestIntersection(x, y) {
  return { x: Math.round(x / STEP) * STEP, y: Math.round(y / STEP) * STEP };
}

export function buildWorld(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  // Block (i, j) sits between roads i and i+1. Block 7,7 is the marina,
  // block 3,3 is the central park; the rest hold one or two buildings.
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const x0 = i * STEP + ROAD_HALF + 14;
      const y0 = j * STEP + ROAD_HALF + 14;
      const x1 = (i + 1) * STEP - ROAD_HALF - 14;
      const y1 = (j + 1) * STEP - ROAD_HALF - 14;
      if (i === 7 && j === 7) continue; // marina water
      if (i === 3 && j === 3) {
        for (let t = 0; t < 9; t++) {
          trees.push({ x: range(rng, x0 + 20, x1 - 20), y: range(rng, y0 + 20, y1 - 20), r: range(rng, 14, 24) });
        }
        continue; // central park
      }
      const n = chance(rng, 0.45) ? 2 : 1;
      for (let b = 0; b < n; b++) {
        const w = range(rng, 90, 150);
        const h = range(rng, 90, 150);
        const bx = n === 1 ? (x0 + x1) / 2 : range(rng, x0 + w / 2, x1 - w / 2);
        const by = n === 1 ? (y0 + y1) / 2 : range(rng, y0 + h / 2, y1 - h / 2);
        buildings.push({
          x: bx - w / 2, y: by - h / 2, w, h,
          color: pick(rng, BUILDING_COLORS),
          floors: int(rng, 1, 4),
        });
      }
      if (chance(rng, 0.5)) {
        trees.push({ x: range(rng, x0 + 16, x1 - 16), y: range(rng, y0 + 16, y1 - 16), r: range(rng, 10, 18) });
      }
    }
  }
  return {
    seed,
    buildings,
    trees,
    park: { x: 3 * STEP + ROAD_HALF, y: 3 * STEP + ROAD_HALF, w: STEP - ROAD_W, h: STEP - ROAD_W },
    marina: { x: 7 * STEP + ROAD_HALF + 6, y: 7 * STEP + ROAD_HALF + 6, w: STEP - ROAD_W - 12, h: STEP - ROAD_W - 12 },
    // The yacht waits in the marina; its dock is on the road beside it.
    yacht: { x: 7 * STEP + 200, y: 7 * STEP + 200 },
    dock: { x: 7 * STEP, y: 7 * STEP + 120 },
  };
}

// Push a circle out of every building it overlaps. Returns true on a hit.
export function collideBuildings(world, x, y, r) {
  let hit = false;
  for (const b of world.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        x += dx * push;
        y += dy * push;
      } else {
        y = b.y - r; // dead centre: shove out the top
      }
    }
  }
  return { x, y, hit };
}

export function clampWorld(x, y, margin) {
  return {
    x: Math.max(margin, Math.min(WORLD - margin, x)),
    y: Math.max(margin, Math.min(WORLD - margin, y)),
  };
}
