// The wanted system and the police. Crimes raise the wanted level, police
// cars and foot cops spawn and chase, and getting caught means BUSTED while
// losing all health means WASTED. Laying low lets the heat cool off.

import { createCar, drawCar } from './vehicles.js';
import { nearestRoadPoint } from './world.js';
import { mulberry32, range } from './rng.js';

// addWanted raises the wanted level (0-5) and stamps the last crime time.
export function addWanted(state, stars) {
  if (state.mode !== 'playing') return;
  state.wanted = Math.min(5, state.wanted + stars);
  state.lastCrimeAt = state.time;
  state.wantedTimer = 0;
  if (state.wanted > 0 && state.fx) state.fx.startSiren();
}

// updatePolice spawns and steers police, decays the wanted level when the
// player lays low, and resolves busts.
export function updatePolice(state, dt) {
  const fx = state.fx;
  // Spawn police cars to match the wanted level (one per star, max 4 cars).
  const wantCars = state.wanted === 0 ? 0 : Math.min(4, state.wanted);
  const policeCars = state.cars.filter((c) => c.kind === 'police');
  if (policeCars.length < wantCars) {
    const rng = mulberry32(Math.floor(state.time * 1000) + 55);
    const p = state.player;
    const edge = [
      { x: 200, y: 200 }, { x: 2300, y: 200 }, { x: 200, y: 1700 }, { x: 2300, y: 1700 },
    ][policeCars.length % 4];
    const car = createCar(edge.x, edge.y, Math.atan2(p.y - edge.y, p.x - edge.x), {
      kind: 'police', maxSpeed: 430 + state.wanted * 18, color: '#20242e',
    });
    car.driver = 'police';
    state.cars.push(car);
    if (fx) fx.sirenBlip();
  }
  // Remove police cars once the heat is gone.
  if (state.wanted === 0) {
    state.cars = state.cars.filter((c) => c.kind !== 'police');
    state.cops = [];
    if (fx) fx.stopSiren();
  }

  // Wanted decay: 14 seconds without a crime and no cop close by.
  if (state.wanted > 0 && state.time - state.lastCrimeAt > 14) {
    let nearest = Infinity;
    for (const car of policeCars) {
      nearest = Math.min(nearest, Math.hypot(car.x - state.player.x, car.y - state.player.y));
    }
    for (const cop of state.cops) {
      nearest = Math.min(nearest, Math.hypot(cop.x - state.player.x, cop.y - state.player.y));
    }
    if (nearest > 420) {
      state.wantedTimer += dt;
      if (state.wantedTimer > 8) {
        state.wanted -= 1;
        state.wantedTimer = 0;
        state.message = state.wanted === 0 ? 'Heat is off. You are clean.' : 'Wanted level dropped.';
        state.messageUntil = state.time + 3;
        if (state.wanted === 0 && fx) fx.stopSiren();
      }
    } else {
      state.wantedTimer = 0;
    }
  }

  // Foot cops appear when the player is on foot and wanted.
  if (state.wanted > 0 && !state.car && state.cops.length < Math.min(3, state.wanted)) {
    const rng = mulberry32(Math.floor(state.time * 1000) + 7);
    const p = state.player;
    const a = range(rng, 0, Math.PI * 2);
    state.cops.push({
      x: p.x + Math.cos(a) * 320,
      y: p.y + Math.sin(a) * 320,
      angle: 0, speed: 150 + state.wanted * 12, radius: 12,
      bustTimer: 0, walkPhase: 0,
    });
  }

  // Chase: police cars pursue the player; foot cops run them down.
  const target = state.car || state.player;
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    updatePoliceCar(state, car, target, dt);
  }
  for (const cop of state.cops) {
    const dx = state.player.x - cop.x;
    const dy = state.player.y - cop.y;
    const d = Math.hypot(dx, dy) || 1;
    cop.angle = Math.atan2(dy, dx);
    const speed = state.car ? cop.speed * 0.4 : cop.speed;
    cop.x += (dx / d) * speed * dt;
    cop.y += (dy / d) * speed * dt;
    cop.walkPhase += dt * 10;
    // Busted when a cop stays on the player on foot.
    if (!state.car && d < 30) {
      cop.bustTimer += dt;
      if (cop.bustTimer > 1.2) {
        state.mode = 'busted';
        if (fx) fx.fail();
      }
    } else {
      cop.bustTimer = 0;
    }
  }

  // Busted in a car: stopped with a police car right beside it.
  if (state.car && Math.abs(state.car.speed) < 25) {
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      if (Math.hypot(car.x - state.car.x, car.y - state.car.y) < 55) {
        state.bustTimer = (state.bustTimer || 0) + dt;
        if (state.bustTimer > 2.5) {
          state.mode = 'busted';
          if (fx) fx.fail();
        }
        break;
      }
    }
  } else {
    state.bustTimer = 0;
  }
}

function updatePoliceCar(state, car, target, dt) {
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy) || 1;
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
  const speedTarget = dist > 120 ? car.maxSpeed : car.maxSpeed * 0.55;
  car.speed += (speedTarget - car.speed) * Math.min(1, dt * 1.2);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.sirenPhase += dt;
  car.ramCooldown = Math.max(0, (car.ramCooldown || 0) - dt);
  // Ram (PIT-style) the player's car on contact, but only once per cooldown:
  // without the cooldown three police cars pin the player at zero speed.
  if (state.car && car.ramCooldown <= 0 && Math.hypot(car.x - state.car.x, car.y - state.car.y) < 40) {
    car.ramCooldown = 1.5;
    state.car.speed *= 0.9;
    car.speed *= 0.9;
    if (Math.abs(state.car.speed) > 200) {
      state.car.health -= 6;
    }
  }
}

// drawPolice paints police cars (via vehicles) and foot cops.
export function drawPolice(ctx, state) {
  for (const car of state.cars) {
    if (car.kind === 'police') drawCar(ctx, car, state.time);
  }
  for (const cop of state.cops) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cop.x, cop.y + 10, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.rotate(cop.angle);
    ctx.fillStyle = '#1c4f9e';
    ctx.fillRect(-9, -7, 18, 14);
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(2, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c4f9e';
    ctx.fillRect(-4, -8, 8, 4);
    ctx.restore();
  }
}
