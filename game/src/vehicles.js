// Cars: arcade driving physics, parked cars, traffic cars and police cars.
import { range, pick, int } from './rng.js';
import { collideBuildings, clampWorld, STEP, ROAD_HALF } from './world.js';

export const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8b73a', '#7ec850', '#c9c9c9', '#8a5fd0', '#e07b39'];
export const CAR_KINDS = {
  sedan: { len: 46, wid: 22, max: 340, accel: 260 },
  taxi: { len: 46, wid: 22, max: 320, accel: 250 },
  sport: { len: 48, wid: 22, max: 430, accel: 330 },
  truck: { len: 62, wid: 26, max: 260, accel: 180 },
  police: { len: 48, wid: 23, max: 400, accel: 310 },
};

let nextCarId = 1;

export function makeCar(x, y, angle, kind, color) {
  const spec = CAR_KINDS[kind] || CAR_KINDS.sedan;
  return {
    id: nextCarId++,
    x, y, angle, speed: 0,
    kind, color: color || pick(Math.random, CAR_COLORS),
    len: spec.len, wid: spec.wid, max: spec.max, accel: spec.accel,
    driver: null, parked: false, hp: 100,
    ramCd: 0, brakeLight: false, ai: null,
  };
}

// One physics step for a driven car: throttle, steering, drag, walls.
export function driveCar(car, throttle, steer, dt, world) {
  const spec = car;
  if (throttle > 0) car.speed += car.accel * throttle * dt;
  if (throttle < 0) car.speed += car.accel * 1.4 * throttle * dt; // braking/reverse
  car.speed *= Math.pow(0.4, dt); // rolling drag
  if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
  car.speed = Math.max(-car.max * 0.35, Math.min(car.max, car.speed));
  const turnRate = 2.4 * Math.min(1, Math.abs(car.speed) / 120) * Math.sign(car.speed || 1);
  car.angle += steer * turnRate * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = collideBuildings(world, nx, ny, 24);
  if (hit.hit) car.speed *= 0.45; // scrape the wall, don't stop dead
  const cl = clampWorld(hit.x, hit.y, 30);
  car.x = cl.x; car.y = cl.y;
  car.ramCd = Math.max(0, car.ramCd - dt);
}

// Simple circle-vs-car shove so cars do not overlap.
export function separateCars(cars) {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = (a.len + b.len) / 2 - 6;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2 / d;
        a.x -= dx * push; a.y -= dy * push;
        b.x += dx * push; b.y += dy * push;
        a.speed *= 0.7; b.speed *= 0.7;
      }
    }
  }
}

// Parked cars the player can steal, placed along roads near the start.
export function spawnParkedCars(state) {
  const spots = [
    { x: 950, y: 872, angle: 0, kind: 'sedan' },
    { x: 1350, y: 428, angle: Math.PI / 2, kind: 'taxi' },
    { x: 428, y: 1350, angle: 0, kind: 'sport' },
    { x: 1800, y: 872, angle: 0, kind: 'sedan' },
    { x: 872, y: 2250, angle: Math.PI / 2, kind: 'truck' },
    { x: 2250, y: 1328, angle: -Math.PI / 2, kind: 'sedan' },
    { x: 3150, y: 872, angle: Math.PI, kind: 'sport' },
    { x: 872, y: 3150, angle: 0, kind: 'taxi' },
  ];
  for (const s of spots) {
    const car = makeCar(s.x, s.y, s.angle, s.kind);
    car.parked = true;
    state.cars.push(car);
  }
}

// A traffic car driving one road: axis 'h' or 'v', lane offset, direction.
export function spawnTrafficCar(state) {
  const rng = state.rng;
  const p = state.player;
  const horizontal = rng() < 0.5;
  const roadK = int(rng, 0, 8);
  const along = range(rng, 100, 3500);
  const dir = rng() < 0.5 ? 1 : -1;
  const lane = dir > 0 ? -20 : 20;
  const x = horizontal ? along : roadK * STEP + lane;
  const y = horizontal ? roadK * STEP + lane : along;
  // Keep new traffic near the player so the streets feel alive.
  if (Math.hypot(x - p.x, y - p.y) > 1100) return null;
  const kinds = ['sedan', 'sedan', 'taxi', 'sport', 'truck'];
  const car = makeCar(x, y, horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2), pick(rng, kinds));
  car.driver = 'traffic';
  car.ai = { axis: horizontal ? 'h' : 'v', dir, lane, speed: range(rng, 120, 200), stopTimer: 0 };
  state.cars.push(car);
  return car;
}

export function countTraffic(state) {
  return state.cars.filter((c) => c.driver === 'traffic').length;
}

// Speed in km/h for the HUD, from the game's internal units per second.
export function carSpeedKmh(car) {
  return Math.round(Math.abs(car.speed) * 0.36);
}
