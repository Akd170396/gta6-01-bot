// The on-foot player: walking, running, punching, shooting, health and
// getting in and out of cars. Rico Vale, new in Solmara, working for Mara.

import { collideCircle } from './world.js';
import { moveVector, isDown, wasPressed } from './input.js';

// createPlayer spawns Rico at the given spot, on foot, unarmed at first.
export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    radius: 14,
    speed: 0,
    health: 100,
    maxHealth: 100,
    hasPistol: false,
    ammo: 0,
    weapon: 'fists', // fists | pistol
    punchCooldown: 0,
    shootCooldown: 0,
    hurtCooldown: 0,
    walkPhase: 0,
    moving: false,
  };
}

// updatePlayer moves the player on foot, handles combat input and returns
// events (punches, shots, car entry) for the main loop to resolve.
export function updatePlayer(state, player, input, dt, fx) {
  const events = [];
  const mv = moveVector(input);
  const running = isDown(input, 'ShiftLeft', 'ShiftRight');
  const speed = running ? 265 : 175;
  player.moving = mv.x !== 0 || mv.y !== 0;
  if (player.moving) {
    player.angle = Math.atan2(mv.y, mv.x);
    player.walkPhase += dt * (running ? 13 : 9);
    const nx = player.x + mv.x * speed * dt;
    const ny = player.y + mv.y * speed * dt;
    const solved = collideCircle(state.city, nx, ny, player.radius);
    player.x = solved.x;
    player.y = solved.y;
    player.speed = speed;
  } else {
    player.speed = 0;
  }

  player.punchCooldown = Math.max(0, player.punchCooldown - dt);
  player.shootCooldown = Math.max(0, player.shootCooldown - dt);
  player.hurtCooldown = Math.max(0, player.hurtCooldown - dt);

  // Aim at the mouse (world coordinates come from the camera).
  const wx = state.camera.x + input.mouseX * (state.viewW / state.canvasW);
  const wy = state.camera.y + input.mouseY * (state.viewH / state.canvasH);
  player.aimX = wx;
  player.aimY = wy;
  if (input.mouseDown || isDown(input, 'Space')) {
    player.angle = Math.atan2(wy - player.y, wx - player.x);
  }

  // Weapon switch: 1 fists, 2 pistol (once owned).
  if (wasPressed(input, 'Digit1')) player.weapon = 'fists';
  if (wasPressed(input, 'Digit2') && player.hasPistol) player.weapon = 'pistol';

  // Punch: short range, quick, knocks thugs and peds back.
  if ((input.mousePressed || wasPressed(input, 'Space')) && player.weapon === 'fists') {
    if (player.punchCooldown <= 0) {
      player.punchCooldown = 0.32;
      events.push({ type: 'punch', x: player.x + Math.cos(player.angle) * 26, y: player.y + Math.sin(player.angle) * 26 });
      fx.punch();
    }
  }
  // Shoot: a hitscan-ish bullet toward the mouse, costs one ammo.
  if (input.mouseDown && player.weapon === 'pistol' && player.hasPistol) {
    if (player.shootCooldown <= 0 && player.ammo > 0) {
      player.shootCooldown = 0.22;
      player.ammo -= 1;
      events.push({ type: 'shot', x: player.x, y: player.y, angle: player.angle });
      fx.gunshot();
    }
  }

  // Slow health regen while the heat is off.
  if (state.wanted === 0 && player.health < player.maxHealth) {
    player.health = Math.min(player.maxHealth, player.health + 2.5 * dt);
  }
  state.health = player.health;
  return events;
}

// hurtPlayer applies damage with a short invulnerability window.
export function hurtPlayer(state, player, amount, fx) {
  if (player.hurtCooldown > 0 || state.mode !== 'playing') return false;
  player.health -= amount;
  player.hurtCooldown = 0.6;
  state.health = player.health;
  if (fx) fx.punch();
  if (player.health <= 0) {
    player.health = 0;
    state.mode = 'wasted';
    if (fx) fx.fail();
  }
  return true;
}

// drawPlayer paints Rico: shadow, body, head, direction and weapon.
export function drawPlayer(ctx, player) {
  const bob = player.moving ? Math.sin(player.walkPhase) * 2 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 12, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (two small steps while walking).
  ctx.fillStyle = '#2c3550';
  const legSwing = player.moving ? Math.sin(player.walkPhase) * 5 : 0;
  ctx.fillRect(player.x - 8 + legSwing, player.y + 2 + bob, 6, 12);
  ctx.fillRect(player.x + 2 - legSwing, player.y + 2 + bob, 6, 12);

  // Body: teal jacket, the colour Mara's crew wears.
  ctx.save();
  ctx.translate(player.x, player.y + bob);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#1f8a70';
  ctx.fillRect(-10, -8, 20, 16);
  ctx.fillStyle = '#f5d76e';
  ctx.fillRect(6, -8, 5, 16);
  // Head.
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  // Pistol in hand when armed.
  if (player.weapon === 'pistol' && player.hasPistol) {
    ctx.fillStyle = '#22242a';
    ctx.fillRect(8, -2, 12, 4);
  }
  // Fist forward when punching.
  if (player.punchCooldown > 0.2) {
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(16, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Aim line while the pistol is out.
  if (player.weapon === 'pistol' && player.hasPistol) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(player.x + Math.cos(player.angle) * 18, player.y + Math.sin(player.angle) * 18);
    ctx.lineTo(player.x + Math.cos(player.angle) * 44, player.y + Math.sin(player.angle) * 44);
    ctx.stroke();
  }
}
