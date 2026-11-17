// Frame rendering: camera, world, entities, effects and the mission beacon.
// The main loop calls renderFrame once per frame; this module owns the draw
// order and nothing else.

import { drawCity } from './world.js';
import { drawPlayer } from './player.js';
import { drawCar } from './vehicles.js';
import { drawTraffic } from './traffic.js';
import { drawPolice } from './police.js';
import { drawThugs, missionMarker } from './missions.js';
import { drawHUD, drawMenu, drawPaused, drawEndScreen } from './hud.js';
import { WORLD_W, WORLD_H } from './state.js';

// updateCamera keeps the camera centred on the player (or their car),
// clamped so it never shows outside the world.
export function updateCamera(state, viewW, viewH) {
  const target = state.car || state.player;
  if (!target) return;
  const cam = state.camera;
  cam.x += (target.x - viewW / 2 - cam.x) * 0.12;
  cam.y += (target.y - viewH / 2 - cam.y) * 0.12;
  cam.x = Math.max(0, Math.min(WORLD_W - viewW, cam.x));
  cam.y = Math.max(0, Math.min(WORLD_H - viewH, cam.y));
}

// renderFrame draws one frame for the current mode.
export function renderFrame(ctx, state, viewW, viewH) {
  ctx.clearRect(0, 0, viewW, viewH);
  if (state.mode === 'menu') {
    // Menu shows the city behind it, slowly panning.
    state.camera.x = 700 + Math.sin(state.time * 0.05) * 260;
    state.camera.y = 500 + Math.cos(state.time * 0.04) * 160;
    drawWorldLayer(ctx, state, viewW, viewH);
    drawMenu(ctx, state, viewW, viewH);
    return;
  }
  drawWorldLayer(ctx, state, viewW, viewH);
  if (state.mode === 'playing' || state.mode === 'paused') {
    drawHUD(ctx, state, viewW, viewH);
  }
  if (state.mode === 'paused') drawPaused(ctx, state, viewW, viewH);
  if (state.mode === 'busted' || state.mode === 'wasted' || state.mode === 'complete') {
    drawHUD(ctx, state, viewW, viewH);
    drawEndScreen(ctx, state, viewW, viewH);
  }
}

// drawWorldLayer paints the city, markers, pickups, cars, peds and player.
function drawWorldLayer(ctx, state, viewW, viewH) {
  const cam = state.camera;
  ctx.save();
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
  drawCity(ctx, state.city, cam, viewW, viewH);

  // Mission beacon: a pulsing column over the target.
  const marker = missionMarker(state);
  if (marker && state.mode === 'playing') {
    const pulse = 26 + Math.sin(state.time * 5) * 6;
    const grad = ctx.createRadialGradient(marker.x, marker.y, 4, marker.x, marker.y, pulse + 26);
    grad.addColorStop(0, 'rgba(255,215,0,0.55)');
    grad.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, pulse + 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Cash pickups.
  for (const pk of state.pickups) {
    const bob = Math.sin(state.time * 4 + pk.x) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(pk.x, pk.y + 8, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7ee787';
    ctx.beginPath();
    ctx.arc(pk.x, pk.y + bob, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#14532d';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', pk.x, pk.y + 4 + bob);
  }

  // Packages (mission cargo).
  for (const pkg of state.packages) {
    ctx.fillStyle = '#d9a441';
    ctx.fillRect(pkg.x - 10, pkg.y - 8, 20, 16);
    ctx.strokeStyle = '#7a5a10';
    ctx.lineWidth = 2;
    ctx.strokeRect(pkg.x - 10, pkg.y - 8, 20, 16);
  }

  // Thugs, traffic, police and the player's car.
  drawThugs(ctx, state);
  drawTraffic(ctx, state);
  drawPolice(ctx, state);
  if (state.car) drawCar(ctx, state.car, state.time);
  if (state.player) drawPlayer(ctx, state.player);

  // Bullets and punch arcs.
  for (const fx of state.effects || []) {
    if (fx.kind === 'shot') {
      ctx.strokeStyle = 'rgba(255,240,150,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fx.x1, fx.y1);
      ctx.lineTo(fx.x2, fx.y2);
      ctx.stroke();
    } else if (fx.kind === 'punch') {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 14 + fx.age * 30, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Vignette for a sun-soaked finish.
  const vg = ctx.createRadialGradient(viewW / 2, viewH / 2, viewH * 0.45, viewW / 2, viewH / 2, viewH * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(20,10,0,0.22)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, viewW, viewH);
}
