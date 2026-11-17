// Cars: arcade driving physics, entering / exiting, stealing, damage and
// drawing. Traffic cars, parked cars and police cars are all Car objects;
// the police module steers its own, traffic steers the rest.

// CAR_COLORS are the paint jobs traffic and parked cars wear.
export const CAR_COLORS = ['#c0392b', '#2e6fb0', '#e8c53a', '#7d7d8a', '#3f9e4d', '#8a5a9e', '#e07020', '#d8d8d8'];

// createCar makes a car at a spot, facing an angle, on a road or parked.
export function createCar(x, y, angle, opts) {
  const o = opts || {};
  return {
    x, y, angle,
    speed: 0,
    maxSpeed: o.maxSpeed || 400,
    accel: o.accel || 320,
    color: o.color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    kind: o.kind || 'traffic', // traffic | parked | police | player
    driver: o.driver || null, // 'player' | 'traffic' | 'police' | null
    length: 44,
    width: 22,
    health: o.health || 100,
    brakeLight: false,
    siren: o.kind === 'police',
    sirenPhase: Math.random() * Math.PI * 2,
    turnTarget: null,
    stuckTimer: 0,
  };
}

// updateDrivenCar applies arcade car physics to the car the player drives:
// W/S throttle and brake, A/D steering that only bites while moving.
export function updateDrivenCar(car, input, dt, fx) {
  const fwd = (input.keys.KeyW || input.keys.ArrowUp) ? 1 : 0;
  const back = (input.keys.KeyS || input.keys.ArrowDown) ? 1 : 0;
  const left = (input.keys.KeyA || input.keys.ArrowLeft) ? 1 : 0;
  const right = (input.keys.KeyD || input.keys.ArrowRight) ? 1 : 0;

  if (fwd) car.speed += car.accel * dt;
  if (back) {
    if (car.speed > 30) car.speed -= car.accel * 1.6 * dt; // brake
    else car.speed -= car.accel * 0.6 * dt; // reverse
  }
  if (!fwd && !back) {
    car.speed -= Math.sign(car.speed) * 160 * dt;
    if (Math.abs(car.speed) < 12) car.speed = 0;
  }
  car.speed = Math.max(-140, Math.min(car.maxSpeed, car.speed));
  car.brakeLight = back && car.speed > 30;

  const steer = (right - left) * (car.speed >= 0 ? 1 : -1);
  const grip = Math.min(1, Math.abs(car.speed) / 120);
  car.angle += steer * 2.4 * grip * dt * (car.speed >= 0 ? 1 : 1);

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  return Math.abs(car.speed) * dt;
}

// collideCarWithBuildings pushes a car out of building walls and scrubs
// speed on a hard hit (returns true when it crashed).
export function collideCarWithBuildings(city, car) {
  let crashed = false;
  const r = 20;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(car.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(car.y, b.y + b.h));
    const dx = car.x - cx;
    const dy = car.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (Math.abs(car.speed) > 160) crashed = true;
      car.speed *= 0.45;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        car.x = cx + (dx / d) * r;
        car.y = cy + (dy / d) * r;
      } else {
        car.x += r;
      }
    }
  }
  // Beach water stops cars at the sand's edge.
  if (car.x > 2500) {
    car.x = 2500;
    car.speed *= 0.4;
  }
  car.x = Math.max(24, Math.min(2576, car.x));
  car.y = Math.max(24, Math.min(1876, car.y));
  return crashed;
}

// carsOverlap reports whether two cars' bodies intersect.
export function carsOverlap(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy < 38 * 38;
}

// drawCar paints one car from above: body, roof, windshield, lights, and
// flashing light bar for police cars.
export function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 24, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = car.color;
  roundRect(ctx, -22, -11, 44, 22, 6);
  ctx.fill();
  ctx.fillStyle = '#20242e';
  roundRect(ctx, -6, -9, 14, 18, 3);
  ctx.fill();
  ctx.fillStyle = '#a8c8e8';
  ctx.fillRect(6, -9, 4, 18);
  ctx.fillRect(-14, -9, 3, 18);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(20, -9, 3, 4);
  ctx.fillRect(20, 5, 3, 4);
  // Brake lights.
  ctx.fillStyle = car.brakeLight ? '#ff2e2e' : '#7a1d1d';
  ctx.fillRect(-23, -9, 3, 4);
  ctx.fillRect(-23, 5, 3, 4);
  // Police livery and flashing bar.
  if (car.kind === 'police') {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-8, -11, 16, 22);
    ctx.fillStyle = '#1c4f9e';
    ctx.font = 'bold 7px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
    const phase = Math.sin(time * 9 + car.sirenPhase) > 0;
    ctx.fillStyle = phase ? '#ff2e2e' : '#2e6bff';
    ctx.fillRect(-4, -13, 8, 4);
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
