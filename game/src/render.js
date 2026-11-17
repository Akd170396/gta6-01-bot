// Everything the player sees: the city, the cars, the people, the minimap.
import { WORLD, STEP, ROAD_W, ROAD_HALF } from './world.js';

const VIEW_W = 1280;
const VIEW_H = 720;

export function render(ctx, state) {
  const world = state.world;
  const cam = state.camera;
  const vx = cam.x - VIEW_W / 2;
  const vy = cam.y - VIEW_H / 2;

  // Sun-soaked ground.
  ctx.fillStyle = '#8fae62';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawRoads(ctx, vx, vy);
  drawPark(ctx, world, vx, vy);
  drawMarina(ctx, world, vx, vy);
  drawBuildings(ctx, world, vx, vy);
  drawTrees(ctx, world, vx, vy);
  drawTarget(ctx, state, vx, vy);
  drawPeds(ctx, state, vx, vy);
  drawCars(ctx, state, vx, vy);
  drawVipers(ctx, state, vx, vy);
  drawCops(ctx, state, vx, vy);
  drawPlayer(ctx, state, vx, vy);
  drawEffects(ctx, state, vx, vy);
  drawTargetArrow(ctx, state);
  if (state.player.hurtFlash > 0) {
    ctx.fillStyle = `rgba(255,40,30,${state.player.hurtFlash * 0.45})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function drawRoads(ctx, vx, vy) {
  ctx.fillStyle = '#3c3f46';
  for (let k = 0; k <= 8; k++) {
    const c = k * STEP;
    ctx.fillRect(c - ROAD_HALF - vx, -vy, ROAD_W, WORLD);
    ctx.fillRect(-vx, c - ROAD_HALF - vy, WORLD, ROAD_W);
  }
  // Sidewalk edging.
  ctx.fillStyle = '#b9b3a4';
  for (let k = 0; k <= 8; k++) {
    const c = k * STEP;
    ctx.fillRect(c - ROAD_HALF - 8 - vx, -vy, 8, WORLD);
    ctx.fillRect(c + ROAD_HALF - vx, -vy, 8, WORLD);
    ctx.fillRect(-vx, c - ROAD_HALF - 8 - vy, WORLD, 8);
    ctx.fillRect(-vx, c + ROAD_HALF - vy, WORLD, 8);
  }
  // Centre dashes.
  ctx.fillStyle = '#d8c95a';
  for (let k = 0; k <= 8; k++) {
    const c = k * STEP;
    for (let d = 0; d < WORLD; d += 64) {
      if (Math.floor(d / STEP) % 2 === 0) continue; // keep crossings clear
      ctx.fillRect(c - 2 - vx, d - vy, 4, 30);
      ctx.fillRect(d - vx, c - 2 - vy, 30, 4);
    }
  }
}

function drawPark(ctx, world, vx, vy) {
  const pk = world.park;
  ctx.fillStyle = '#5d9b4e';
  ctx.fillRect(pk.x - vx, pk.y - vy, pk.w, pk.h);
  ctx.fillStyle = '#6fb25e';
  ctx.beginPath();
  ctx.ellipse(pk.x + pk.w / 2 - vx, pk.y + pk.h / 2 - vy, pk.w / 3, pk.h / 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawMarina(ctx, world, vx, vy) {
  const m = world.marina;
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(m.x - vx, m.y - vy, m.w, m.h);
  ctx.fillStyle = '#5aa8d8';
  ctx.fillRect(m.x - vx, m.y - vy, m.w, 10);
  // The yacht waiting at the dock.
  const y = world.yacht;
  ctx.save();
  ctx.translate(y.x - vx, y.y - vy);
  ctx.rotate(-0.6);
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(-52, -14, 104, 28);
  ctx.fillStyle = '#d94f3d';
  ctx.fillRect(-52, -14, 104, 6);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-20, -14); ctx.lineTo(10, -14); ctx.lineTo(0, -38); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBuildings(ctx, world, vx, vy) {
  for (const b of world.buildings) {
    const x = b.x - vx, y = b.y - vy;
    if (x > VIEW_W || y > VIEW_H || x + b.w < 0 || y + b.h < 0) continue;
    // Long afternoon shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + 10, y + 12, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(x, y, b.w, b.h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, y, b.w, 8);
    // Windows.
    ctx.fillStyle = 'rgba(255,244,200,0.85)';
    const cols = Math.max(2, Math.floor(b.w / 34));
    const rows = Math.max(2, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillRect(x + 10 + i * ((b.w - 20) / cols), y + 14 + j * ((b.h - 20) / rows), 9, 11);
      }
    }
    void b.floors;
  }
}

function drawTrees(ctx, world, vx, vy) {
  for (const t of world.trees) {
    const x = t.x - vx, y = t.y - vy;
    if (x < -40 || y < -40 || x > VIEW_W + 40 || y > VIEW_H + 40) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(x + 5, y + 6, t.r, t.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f7d33';
    ctx.beginPath(); ctx.arc(x, y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#57a047';
    ctx.beginPath(); ctx.arc(x - 4, y - 4, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
  }
}

function drawTarget(ctx, state, vx, vy) {
  const t = state.mission.target;
  if (!t || state.mission.stage !== 'active') return;
  const pulse = 1 + Math.sin(state.time * 4) * 0.15;
  const x = t.x - vx, y = t.y - vy;
  ctx.save();
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(x, y, 42 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,210,63,0.25)';
  ctx.beginPath(); ctx.arc(x, y, 42 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawCarShape(ctx, car, vx, vy) {
  ctx.save();
  ctx.translate(car.x - vx, car.y - vy);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-car.len / 2 + 4, -car.wid / 2 + 4, car.len, car.wid);
  ctx.fillStyle = car.color;
  roundRect(ctx, -car.len / 2, -car.wid / 2, car.len, car.wid, 7);
  ctx.fill();
  // Windshield and roof.
  ctx.fillStyle = 'rgba(180,220,240,0.9)';
  ctx.fillRect(car.len * 0.08, -car.wid / 2 + 3, car.len * 0.22, car.wid - 6);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(-car.len * 0.28, -car.wid / 2 + 3, car.len * 0.3, car.wid - 6);
  // Headlights.
  ctx.fillStyle = '#fff6b0';
  ctx.fillRect(car.len / 2 - 3, -car.wid / 2 + 2, 3, 5);
  ctx.fillRect(car.len / 2 - 3, car.wid / 2 - 7, 3, 5);
  if (car.kind === 'police') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-car.len * 0.1, -car.wid / 2, car.len * 0.2, car.wid);
    ctx.fillStyle = '#d21f2b';
    ctx.fillRect(-car.len / 2 + 6, -car.wid / 2 - 2, 8, 5);
    ctx.fillStyle = '#2456d6';
    ctx.fillRect(-car.len / 2 + 6, car.wid / 2 - 3, 8, 5);
  }
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#222222';
    ctx.fillRect(-car.len * 0.28, -car.wid / 2 + 3, car.len * 0.3, 5);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCars(ctx, state, vx, vy) {
  for (const car of state.cars) {
    if (car.x - vx < -80 || car.y - vy < -80 || car.x - vx > VIEW_W + 80 || car.y - vy > VIEW_H + 80) continue;
    drawCarShape(ctx, car, vx, vy);
    if (car.hp < 100) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(car.x - vx - 20, car.y - vy - 34, 40, 5);
      ctx.fillStyle = car.hp > 50 ? '#7dff8a' : '#ff5a3c';
      ctx.fillRect(car.x - vx - 20, car.y - vy - 34, 40 * (car.hp / 100), 5);
    }
  }
}

function drawPeds(ctx, state, vx, vy) {
  for (const ped of state.peds) {
    const x = ped.x - vx, y = ped.y - vy;
    if (x < -30 || y < -30 || x > VIEW_W + 30 || y > VIEW_H + 30) continue;
    ctx.save();
    ctx.translate(x, y);
    if (ped.down) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = ped.color;
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      continue;
    }
    // Walking bob.
    const bob = Math.sin(ped.walkPhase) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(0, 8, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(0, bob * 0.4, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8c39e';
    ctx.beginPath(); ctx.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4 + bob * 0.4, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawVipers(ctx, state, vx, vy) {
  for (const v of state.vipers) {
    if (v.hp <= 0) continue;
    const x = v.x - vx, y = v.y - vy;
    if (x < -30 || y < -30 || x > VIEW_W + 30 || y > VIEW_H + 30) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 9, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a1f2b'; // Viper gang colours: dark red jackets
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('V', 0, 4);
    ctx.fillStyle = '#ff5a3c';
    ctx.fillRect(-13, -24, 26, 4);
    ctx.fillStyle = '#7dff8a';
    ctx.fillRect(-13, -24, 26 * (v.hp / 100), 4);
    ctx.restore();
  }
}

function drawCops(ctx, state, vx, vy) {
  for (const cop of state.cops) {
    if (cop.down) continue;
    const x = cop.x - vx, y = cop.y - vy;
    if (x < -30 || y < -30 || x > VIEW_W + 30 || y > VIEW_H + 30) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 9, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c2733'; // Solmara PD navy
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawPlayer(ctx, state, vx, vy) {
  const p = state.player;
  if (!p.onFoot) return; // the car is the player now
  const x = p.x - vx, y = p.y - vy;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 10, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
  // Mara: teal jacket, dark hair.
  ctx.fillStyle = '#0f766e';
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2b2118';
  ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 3, Math.sin(p.angle) * 3, 6, 0, Math.PI * 2); ctx.fill();
  // Facing tick.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(Math.cos(p.angle) * 12, Math.sin(p.angle) * 12);
  ctx.lineTo(Math.cos(p.angle) * 20, Math.sin(p.angle) * 20);
  ctx.stroke();
  ctx.restore();
  // Bust warning ring.
  if (p.bustMeter > 0) {
    ctx.strokeStyle = '#ff3b30';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y, 24, -Math.PI / 2, -Math.PI / 2 + (p.bustMeter / 1.2) * Math.PI * 2); ctx.stroke();
  }
}

function drawEffects(ctx, state, vx, vy) {
  for (const e of state.effects) {
    ctx.globalAlpha = Math.max(0, e.life / e.max);
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x - vx - e.size / 2, e.y - vy - e.size / 2, e.size, e.size);
  }
  ctx.globalAlpha = 1;
}

function drawTargetArrow(ctx, state) {
  const t = state.mission.target;
  if (!t || state.mission.stage !== 'active') return;
  const p = state.player;
  const dx = t.x - p.x, dy = t.y - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 500) return; // the pulsing ring shows it already
  const angle = Math.atan2(dy, dx);
  const cx = 640 + Math.cos(angle) * 300;
  const cy = 360 + Math.sin(angle) * 200;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(dist)}m`, cx, cy + 30);
}

// The minimap: roads, buildings, the player, the police and the target.
export function drawMinimap(mctx, state) {
  const S = 180 / WORLD;
  mctx.fillStyle = '#20242b';
  mctx.fillRect(0, 0, 180, 180);
  mctx.fillStyle = '#8fae62';
  mctx.fillRect(0, 0, 180, 180);
  mctx.strokeStyle = '#3c3f46';
  mctx.lineWidth = 4;
  for (let k = 0; k <= 8; k++) {
    const c = k * STEP * S;
    mctx.beginPath(); mctx.moveTo(c, 0); mctx.lineTo(c, 180); mctx.stroke();
    mctx.beginPath(); mctx.moveTo(0, c); mctx.lineTo(180, c); mctx.stroke();
  }
  mctx.fillStyle = '#2f7fb8';
  const m = state.world.marina;
  mctx.fillRect(m.x * S, m.y * S, m.w * S, m.h * S);
  const t = state.mission.target;
  if (t && state.mission.stage === 'active') {
    mctx.fillStyle = '#ffd23f';
    mctx.beginPath(); mctx.arc(t.x * S, t.y * S, 6, 0, Math.PI * 2); mctx.fill();
  }
  for (const car of state.cars) {
    if (car.driver !== 'police') continue;
    mctx.fillStyle = '#2456d6';
    mctx.beginPath(); mctx.arc(car.x * S, car.y * S, 3, 0, Math.PI * 2); mctx.fill();
  }
  const p = state.player;
  mctx.fillStyle = '#ffffff';
  mctx.beginPath(); mctx.arc(p.x * S, p.y * S, 4, 0, Math.PI * 2); mctx.fill();
  mctx.strokeStyle = '#ffffff';
  mctx.lineWidth = 1;
  mctx.strokeRect(0.5, 0.5, 179, 179);
}
