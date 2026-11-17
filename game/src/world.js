// City generation, collision and city drawing for Solmara.
// The city is a road grid with building blocks, a central park, a beach on
// the east edge and a marina on the south edge. Generation is fully seeded.

import { WORLD_W, WORLD_H, ROAD_W, COLORS } from './state.js';
import { mulberry32, range, rangeInt, pick, chance } from './rng.js';

export const ROAD_XS = [200, 500, 800, 1100, 1400, 1700, 2000, 2300];
export const ROAD_YS = [200, 500, 800, 1100, 1400, 1700];
export const BEACH_X = 2400;

// generateCity builds every static piece of the city from one seed.
export function generateCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const trees = [];
  const palms = [];
  const parks = [];
  const lots = [];

  // Central park block (between roads x 800-1100, y 800-1100).
  parks.push({ x: 836, y: 836, w: 228, h: 228 });
  for (let i = 0; i < 14; i += 1) {
    trees.push({ x: range(rng, 860, 1040), y: range(rng, 860, 1040), r: range(rng, 9, 15) });
  }

  // Buildings fill every block that is not the park, the beach or the marina.
  for (let bx = 0; bx < ROAD_XS.length - 1; bx += 1) {
    for (let by = 0; by < ROAD_YS.length - 1; by += 1) {
      const x0 = ROAD_XS[bx] + ROAD_W / 2 + 14;
      const y0 = ROAD_YS[by] + ROAD_W / 2 + 14;
      const x1 = ROAD_XS[bx + 1] - ROAD_W / 2 - 14;
      const y1 = ROAD_YS[by] + 1 - ROAD_W / 2 - 14;
      // Park block stays open.
      if (bx === 2 && by === 2) continue;
      // Marina block (south-west) stays open as a plaza.
      if (bx === 0 && by === 4) {
        lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, kind: 'plaza' });
        continue;
      }
      const count = rangeInt(rng, 1, 3);
      for (let i = 0; i < count; i += 1) {
        const w = range(rng, 70, 130);
        const h = range(rng, 60, 110);
        const x = range(rng, x0, Math.max(x0 + 1, x1 - w));
        const y = range(rng, y0, Math.max(y0 + 1, y1 - h));
        buildings.push({
          x, y, w, h,
          roof: pick(rng, COLORS.buildingRoof),
          floors: rangeInt(rng, 1, 4),
          id: buildings.length,
        });
      }
      if (chance(rng, 0.5)) {
        trees.push({ x: range(rng, x0, x1), y: range(rng, y0, y1), r: range(rng, 8, 13) });
      }
    }
  }

  // Beach palms along the sand strip.
  for (let y = 120; y < WORLD_H - 100; y += 90) {
    palms.push({ x: range(rng, BEACH_X + 30, BEACH_X + 130), y: y + range(rng, -20, 20), r: 12 });
  }

  return {
    buildings, trees, palms, parks, lots,
    hospital: { x: 1140, y: 240, w: 120, h: 80 },
    garage: { x: 560, y: 1560, w: 140, h: 90 },
    club: { x: 1740, y: 340, w: 130, h: 80 },
    docks: { x: 350, y: 1560, w: 150, h: 70 },
    yacht: { x: 2460, y: 900, w: 90, h: 150 },
  };
}

// isRoadAt reports whether a point lies on a road (used by traffic AI).
export function isRoadAt(x, y) {
  for (const rx of ROAD_XS) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

// nearestRoadPoint snaps a point onto the closest road centre line.
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROAD_XS) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, vertical: true }; }
  }
  for (const ry of ROAD_YS) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, vertical: false }; }
  }
  return best;
}

// collideCircle resolves a circle (player, car, ped) against building walls.
export function collideCircle(city, px, py, r) {
  let x = px;
  let y = py;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        y = cy + (dy / d) * r;
      } else {
        x += r;
      }
    }
  }
  // Keep everything inside the world, out of the water.
  x = Math.max(24, Math.min(WORLD_W - 24, x));
  y = Math.max(24, Math.min(WORLD_H - 24, y));
  return { x, y };
}

// pointInBuilding reports whether a point is inside any building.
export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

// drawCity paints the whole static city: ground, beach, roads, park, buildings.
export function drawCity(ctx, city, cam, viewW, viewH) {
  const x0 = Math.max(0, cam.x - 40);
  const y0 = Math.max(0, cam.y - 40);
  const x1 = Math.min(WORLD_W, cam.x + viewW + 40);
  const y1 = Math.min(WORLD_H, cam.y + viewH + 40);

  // Grass base.
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  // Beach sand + water on the east edge.
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(Math.max(x0, BEACH_X), y0, Math.min(x1, WORLD_W) - Math.max(x0, BEACH_X), y1 - y0);
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(Math.max(x0, 2520), y0, Math.min(x1, WORLD_W) - Math.max(x0, 2520), y1 - y0);
  ctx.fillStyle = COLORS.waterDeep;
  for (let y = Math.floor(y0 / 90) * 90; y < y1; y += 90) {
    ctx.fillRect(2530, y + 20, 46, 4);
  }

  // Park.
  for (const p of city.parks) {
    ctx.fillStyle = COLORS.parkGrass;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = '#5d8a44';
    ctx.lineWidth = 3;
    ctx.strokeRect(p.x, p.y, p.w, p.h);
  }

  // Plaza (marina square).
  for (const lot of city.lots) {
    ctx.fillStyle = '#c9bda6';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = '#a89a7e';
    ctx.lineWidth = 2;
    ctx.strokeRect(lot.x, lot.y, lot.w, lot.h);
  }

  // Sidewalks + roads.
  ctx.fillStyle = COLORS.sidewalk;
  for (const rx of ROAD_XS) ctx.fillRect(rx - ROAD_W / 2 - 10, y0, ROAD_W + 20, y1 - y0);
  for (const ry of ROAD_YS) ctx.fillRect(x0, ry - ROAD_W / 2 - 10, x1 - x0, ROAD_W + 20);
  ctx.fillStyle = COLORS.road;
  for (const rx of ROAD_XS) ctx.fillRect(rx - ROAD_W / 2, y0, ROAD_W, y1 - y0);
  for (const ry of ROAD_YS) ctx.fillRect(x0, ry - ROAD_W / 2, x1 - x0, ROAD_W);

  // Lane dashes.
  ctx.fillStyle = COLORS.roadLine;
  for (const rx of ROAD_XS) {
    for (let y = Math.floor(y0 / 46) * 46; y < y1; y += 46) ctx.fillRect(rx - 2, y, 4, 22);
  }
  for (const ry of ROAD_YS) {
    for (let x = Math.floor(x0 / 46) * 46; x < x1; x += 46) ctx.fillRect(x, ry - 2, 22, 4);
  }

  // Landmarks: hospital, garage, club, docks, yacht.
  drawLandmark(ctx, city.hospital, '#e8e8e8', 'HOSPITAL');
  drawLandmark(ctx, city.garage, '#d9a441', "MARA'S GARAGE");
  drawLandmark(ctx, city.club, '#8a7ba8', 'CLUB NEON');
  drawLandmark(ctx, city.docks, '#7d9bb5', 'DOCKS');
  ctx.fillStyle = '#f2ead8';
  ctx.fillRect(city.yacht.x, city.yacht.y, city.yacht.w, city.yacht.h);
  ctx.strokeStyle = '#8a7ba8';
  ctx.lineWidth = 3;
  ctx.strokeRect(city.yacht.x, city.yacht.y, city.yacht.w, city.yacht.h);
  ctx.fillStyle = '#3a3f4a';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('YACHT', city.yacht.x + city.yacht.w / 2, city.yacht.y + city.yacht.h / 2);

  // Buildings with roofs, walls and windows.
  for (const b of city.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = COLORS.buildingWall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const cols = Math.max(1, Math.floor((b.w - 16) / 18));
    const rows = Math.max(1, Math.floor((b.h - 16) / 18));
    for (let cx = 0; cx < cols; cx += 1) {
      for (let cy = 0; cy < rows; cy += 1) {
        ctx.fillRect(b.x + 10 + cx * 18, b.y + 10 + cy * 18, 8, 8);
      }
    }
  }

  // Trees and palms.
  for (const t of city.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = COLORS.tree;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, t.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of city.palms) {
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
    ctx.fillStyle = '#6b4a2f';
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    ctx.fillStyle = COLORS.palm;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLandmark(ctx, r, color, label) {
  ctx.fillStyle = color;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#2c2c34';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 4);
}
