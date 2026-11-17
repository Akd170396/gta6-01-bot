// Traffic cars that cruise the roads and pedestrians on the sidewalks.
import { STEP, ROAD_HALF, collideBuildings, clampWorld } from './world.js';
import { spawnTrafficCar, countTraffic } from './vehicles.js';
import { addCrime, spawnEffect } from './state.js';

const PED_COLORS = ['#e8c39e', '#8a5a3b', '#d9a441', '#4a7fb5', '#b5546e', '#5aa08a'];

// One traffic step: follow the road, stop for the car ahead, turn at crossings.
export function updateTraffic(dt, state) {
  const p = state.player;
  // Keep the streets busy near the player.
  if (countTraffic(state) < 14) spawnTrafficCar(state);

  for (const car of state.cars) {
    if (car.driver !== 'traffic' || !car.ai) continue;
    const ai = car.ai;
    // Car ahead on the same lane: slow down and wait.
    let blocked = false;
    for (const other of state.cars) {
      if (other === car) continue;
      const dx = other.x - car.x, dy = other.y - car.y;
      const ahead = ai.axis === 'h' ? dx * ai.dir : dy * ai.dir;
      const side = ai.axis === 'h' ? Math.abs(dy) : Math.abs(dx);
      if (ahead > 0 && ahead < 70 && side < 30) { blocked = true; break; }
    }
    // The player's car ahead counts too.
    if (!p.onFoot && p.car) {
      const dx = p.car.x - car.x, dy = p.car.y - car.y;
      const ahead = ai.axis === 'h' ? dx * ai.dir : dy * ai.dir;
      const side = ai.axis === 'h' ? Math.abs(dy) : Math.abs(dx);
      if (ahead > 0 && ahead < 70 && side < 30) blocked = true;
    }
    if (blocked) {
      car.speed = Math.max(0, car.speed - 300 * dt);
    } else {
      car.speed += (ai.speed - car.speed) * Math.min(1, dt * 1.5);
    }
    // At a crossing, sometimes turn onto the other road.
    const along = ai.axis === 'h' ? car.x : car.y;
    const nearCross = Math.abs(along - Math.round(along / STEP) * STEP) < 26;
    if (nearCross && state.rng() < dt * 0.5) {
      turnTrafficCar(state, car);
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const cl = clampWorld(nx, ny, 60);
    car.x = cl.x; car.y = cl.y;
    // A traffic car that drifted far away is recycled near the player.
    if (Math.hypot(car.x - p.x, car.y - p.y) > 1500) {
      car.x = p.x + (state.rng() - 0.5) * 1600;
      car.y = p.y + (state.rng() - 0.5) * 1600;
      const snap = snapCarToRoad(car);
      car.x = snap.x; car.y = snap.y;
    }
  }
  // Drop traffic cars that ended up far behind the action.
  state.cars = state.cars.filter((c) => {
    if (c.driver === 'traffic' && Math.hypot(c.x - p.x, c.y - p.y) > 2200) return false;
    return true;
  });
}

function turnTrafficCar(state, car) {
  const ai = car.ai;
  const rng = state.rng;
  const newDir = rng() < 0.5 ? 1 : -1;
  if (ai.axis === 'h') {
    ai.axis = 'v';
    car.angle = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    car.y = Math.round(car.y / STEP) * STEP + (newDir > 0 ? -20 : 20);
  } else {
    ai.axis = 'h';
    car.angle = newDir > 0 ? 0 : Math.PI;
    car.x = Math.round(car.x / STEP) * STEP + (newDir > 0 ? -20 : 20);
  }
  ai.dir = newDir;
}

function snapCarToRoad(car) {
  const nx = Math.round(car.x / STEP) * STEP;
  const ny = Math.round(car.y / STEP) * STEP;
  if (Math.abs(car.x - nx) <= Math.abs(car.y - ny)) return { x: nx, y: car.y };
  return { x: car.x, y: ny };
}

// Pedestrians: walk the sidewalks, scatter when a shot rings out.
export function spawnPeds(state, count) {
  for (let i = 0; i < count; i++) {
    const horizontal = state.rng() < 0.5;
    const roadK = Math.floor(state.rng() * 9);
    const along = 100 + state.rng() * 3400;
    const side = state.rng() < 0.5 ? -1 : 1;
    const off = ROAD_HALF + 16;
    const x = horizontal ? along : roadK * STEP + side * off;
    const y = horizontal ? roadK * STEP + side * off : along;
    state.peds.push({
      x, y, angle: state.rng() * Math.PI * 2,
      speed: 45 + state.rng() * 40,
      color: PED_COLORS[Math.floor(state.rng() * PED_COLORS.length)],
      axis: horizontal ? 'h' : 'v', dir: state.rng() < 0.5 ? 1 : -1,
      side, flee: 0, down: false, downTimer: 0,
      walkPhase: state.rng() * Math.PI * 2,
    });
  }
}

export function updatePeds(dt, state) {
  const p = state.player;
  if (state.peds.filter((d) => !d.down).length < 24) spawnPeds(state, 4);
  for (const ped of state.peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        // The pedestrian gets up and walks away, shaken.
        ped.down = false;
        ped.flee = 3;
      }
      continue;
    }
    // A gunshot nearby sends everyone running.
    if (state.stats.shots > ped.lastShotHeard) {
      ped.lastShotHeard = state.stats.shots;
      if (Math.hypot(ped.x - p.x, ped.y - p.y) < 320) ped.flee = 2.5;
    }
    let speed = ped.speed;
    let angle = ped.axis === 'h' ? (ped.dir > 0 ? 0 : Math.PI) : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    if (ped.flee > 0) {
      ped.flee -= dt;
      speed = 170;
      angle = Math.atan2(ped.y - p.y, ped.x - p.x);
    } else {
      const along = ped.axis === 'h' ? ped.x : ped.y;
      if (Math.abs(along - Math.round(along / STEP) * STEP) < 20 && state.rng() < dt * 0.4) {
        // Turn a corner at a crossing.
        ped.axis = ped.axis === 'h' ? 'v' : 'h';
        ped.dir = state.rng() < 0.5 ? 1 : -1;
      }
    }
    ped.angle = angle;
    ped.walkPhase += dt * 6;
    const nx = ped.x + Math.cos(angle) * speed * dt;
    const ny = ped.y + Math.sin(angle) * speed * dt;
    const hit = collideBuildings(state.world, nx, ny, 10);
    const cl = clampWorld(hit.x, hit.y, 24);
    ped.x = cl.x; ped.y = cl.y;
    // Run over by a fast car: a crime, and the pedestrian goes down.
    const car = p.onFoot ? null : p.car;
    if (car && Math.abs(car.speed) > 90 && Math.hypot(ped.x - car.x, ped.y - car.y) < 30) {
      ped.down = true; ped.downTimer = 8;
      addCrime(state, 1);
      spawnEffect(state, ped.x, ped.y, 'hit');
    }
  }
  // Clear pedestrians that wandered far away.
  state.peds = state.peds.filter((d) => Math.hypot(d.x - p.x, d.y - p.y) < 2000 || d.down);
}
