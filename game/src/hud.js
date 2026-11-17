// HUD, minimap, menus and overlays. Everything the player reads on screen
// is drawn here on the canvas: money, health, wanted stars, objective,
// minimap, speed, toasts, start screen and pause / end screens.

import { GAME_TITLE, CITY_NAME, WORLD_W, WORLD_H } from './state.js';
import { ROAD_XS, ROAD_YS } from './world.js';
import { missionMarker } from './missions.js';

// drawHUD paints the in-game HUD: cash, health, wanted stars, objective,
// speed, minimap and the message toast.
export function drawHUD(ctx, state, viewW, viewH) {
  // Top-left: cash + health.
  ctx.fillStyle = 'rgba(10,14,24,0.72)';
  roundRect(ctx, 12, 12, 210, 64, 10);
  ctx.fill();
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('$' + Math.round(state.money).toLocaleString('en-US'), 24, 42);
  ctx.fillStyle = '#e5484d';
  ctx.fillRect(24, 52, 186, 10);
  ctx.fillStyle = '#4ade80';
  ctx.fillRect(24, 52, 186 * Math.max(0, state.health / 100), 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('HEALTH', 24, 72 - 4);

  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(10,14,24,0.72)';
  roundRect(ctx, viewW - 222, 12, 210, 44, 10);
  ctx.fill();
  for (let i = 0; i < 5; i += 1) {
    drawStar(ctx, viewW - 200 + i * 40, 34, 13, i < state.wanted ? '#ffd700' : 'rgba(255,255,255,0.25)');
  }

  // Bottom-centre: objective.
  if (state.objective) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    const w = ctx.measureText(state.objective).width + 28;
    ctx.fillStyle = 'rgba(10,14,24,0.78)';
    roundRect(ctx, (viewW - w) / 2, viewH - 52, w, 32, 9);
    ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    ctx.fillText(state.objective, viewW / 2, viewH - 30);
  }

  // Bottom-right: speed while driving.
  if (state.car) {
    const kmh = Math.round(Math.abs(state.car.speed) * 0.36);
    ctx.fillStyle = 'rgba(10,14,24,0.72)';
    roundRect(ctx, viewW - 142, viewH - 96, 130, 76, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(kmh), viewW - 40, viewH - 52);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#9aa4b2';
    ctx.fillText('km/h', viewW - 40, viewH - 34);
    ctx.textAlign = 'left';
  }

  // Message toast.
  if (state.message && state.time < state.messageUntil) {
    ctx.font = '15px system-ui, sans-serif';
    const lines = wrapText(ctx, state.message, viewW - 360);
    const h = lines.length * 20 + 16;
    ctx.fillStyle = 'rgba(10,14,24,0.8)';
    roundRect(ctx, (viewW - 560) / 2, 66, 560, h, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    lines.forEach((line, i) => ctx.fillText(line, viewW / 2, 66 + 22 + i * 20));
    ctx.textAlign = 'left';
  }

  // Damage flash.
  if (state.player && state.player.hurtCooldown > 0.35) {
    ctx.fillStyle = 'rgba(229,72,77,0.18)';
    ctx.fillRect(0, 0, viewW, viewH);
  }

  drawMinimap(ctx, state, viewW, viewH);
}

// drawMinimap paints the corner map: roads, beach, player arrow, mission
// marker, police dots and cash pickups.
export function drawMinimap(ctx, state, viewW, viewH) {
  const mw = 200;
  const mh = 146;
  const mx = 12;
  const my = viewH - mh - 12;
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(10,14,24,0.78)';
  roundRect(ctx, mx - 4, my - 4, mw + 8, mh + 8, 10);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#69a24e';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(mx + 2400 * sx, my, mw - 2400 * sx, mh);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(mx + 2520 * sx, my, mw - 2520 * sx, mh);
  ctx.strokeStyle = '#3a3f4a';
  ctx.lineWidth = 4;
  for (const rx of ROAD_XS) {
    ctx.beginPath();
    ctx.moveTo(mx + rx * sx, my);
    ctx.lineTo(mx + rx * sx, my + mh);
    ctx.stroke();
  }
  for (const ry of ROAD_YS) {
    ctx.beginPath();
    ctx.moveTo(mx, my + ry * sy);
    ctx.lineTo(mx + mw, my + ry * sy);
    ctx.stroke();
  }
  // Cash pickups.
  ctx.fillStyle = '#7ee787';
  for (const pk of state.pickups) {
    ctx.fillRect(mx + pk.x * sx - 2, my + pk.y * sy - 2, 4, 4);
  }
  // Mission marker.
  const marker = missionMarker(state);
  if (marker) {
    const pulse = 5 + Math.sin(state.time * 5) * 2;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(mx + marker.x * sx, my + marker.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Police dots.
  ctx.fillStyle = '#ff5a5a';
  for (const car of state.cars) {
    if (car.kind === 'police') {
      ctx.beginPath();
      ctx.arc(mx + car.x * sx, my + car.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Player arrow.
  const p = state.player;
  ctx.save();
  ctx.translate(mx + p.x * sx, my + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#9aa4b2';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(CITY_NAME.toUpperCase(), mx, my - 6);
}

// drawMenu paints the start screen: title, story, controls, save state.
export function drawMenu(ctx, state, viewW, viewH) {
  ctx.fillStyle = 'rgba(8,10,20,0.82)';
  ctx.fillRect(0, 0, viewW, viewH);
  // Sun-soaked banner.
  const grad = ctx.createLinearGradient(0, 0, viewW, 0);
  grad.addColorStop(0, '#ff9a3c');
  grad.addColorStop(0.5, '#ff5e62');
  grad.addColorStop(1, '#8a5a9e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, viewH * 0.14, viewW, 4);
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(GAME_TITLE.toUpperCase(), viewW / 2, viewH * 0.26);
  ctx.fillStyle = '#ff9a3c';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('An open-world crime story in the city of ' + CITY_NAME, viewW / 2, viewH * 0.26 + 36);

  ctx.fillStyle = '#e8e8e8';
  ctx.font = '16px/1.5 system-ui, sans-serif';
  const story = [
    'You are Rico Vale. You came to Solmara with $250 and a phone number.',
    'Mara Solis runs a crew from her garage — and she needs a driver.',
    'Steal cars, outrun the police, run her jobs, and own the night.',
  ];
  story.forEach((line, i) => ctx.fillText(line, viewW / 2, viewH * 0.40 + i * 26));

  ctx.fillStyle = '#9aa4b2';
  ctx.font = '15px system-ui, sans-serif';
  const controls = [
    'WASD / Arrows — walk & drive    •    E — enter / exit car    •    Shift — run',
    'Mouse — aim    •    Click / Space — punch    •    2 + Click — fire pistol',
    'M — mute    •    P / Esc — pause    •    Progress saves automatically',
  ];
  controls.forEach((line, i) => ctx.fillText(line, viewW / 2, viewH * 0.56 + i * 24));

  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(state.saveExists ? 'Press ENTER to play — C to continue your save' : 'Press ENTER to start', viewW / 2, viewH * 0.72);
  ctx.fillStyle = '#9aa4b2';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('6 story missions  •  wanted levels  •  police chases  •  traffic & pedestrians  •  free roam', viewW / 2, viewH * 0.72 + 28);
  ctx.textAlign = 'left';
}

// drawPaused paints the pause overlay with save info.
export function drawPaused(ctx, state, viewW, viewH) {
  ctx.fillStyle = 'rgba(8,10,20,0.7)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', viewW / 2, viewH * 0.4);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#e8e8e8';
  ctx.fillText('P / Esc — resume      S — save now      N — new game      M — mute', viewW / 2, viewH * 0.4 + 36);
  ctx.fillText('Missions done: ' + state.missionsDone + ' / 6      Cash: $' + Math.round(state.money), viewW / 2, viewH * 0.4 + 64);
  ctx.textAlign = 'left';
}

// drawEndScreen paints the busted / wasted / story-complete overlays.
export function drawEndScreen(ctx, state, viewW, viewH) {
  ctx.fillStyle = 'rgba(8,10,20,0.78)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  if (state.mode === 'busted') {
    ctx.fillStyle = '#5aa2ff';
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.fillText('BUSTED', viewW / 2, viewH * 0.38);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('The Solmara police took you in. Bail cost you $150.', viewW / 2, viewH * 0.38 + 34);
  } else if (state.mode === 'wasted') {
    ctx.fillStyle = '#e5484d';
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.fillText('WASTED', viewW / 2, viewH * 0.38);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('You woke up at Solmara General. The hospital bill was $150.', viewW / 2, viewH * 0.38 + 34);
  } else if (state.mode === 'complete') {
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText('SOLMARA IS YOURS', viewW / 2, viewH * 0.36);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('Every job done. Mara trusts you with the city now.', viewW / 2, viewH * 0.36 + 34);
    ctx.fillText('Final cash: $' + Math.round(state.money) + '      Score: ' + Math.round(state.score), viewW / 2, viewH * 0.36 + 62);
  }
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('Press ENTER to keep playing', viewW / 2, viewH * 0.52);
  ctx.textAlign = 'left';
}

function drawStar(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
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

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}
