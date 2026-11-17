// Traffic cars and pedestrians. Traffic follows the road grid: each car
// drives along one road and turns at intersections. Pedestrians stroll the
// sidewalks and the park, and scatter when a car barrels at them.

import { ROAD_XS, ROAD_YS, isRoadAt, nearestRoadPoint, pointInBuilding, collideCircle } from './world.js';
import { mulberry32, range, rangeInt, pick, chance } from './rng.js';
import { createCar, drawCar, collideCarWithBuildings } from './vehicles.js';

const PED_SHIRTS = ['#e07a5f', '#81b29a', '#f2cc8f', '#6d8ea0', '#b5838d', '#90be6d'];

// spawnTraffic fills the roads with moving cars and the sidewalks with
// pedestrians, all from the seeded stream so the city looks the same.
export function spawnTraffic(state, count) {
  const rng = mulberry32(4242);
  state.cars = state.cars.filter((c) => c.kind === 'police' || c.kind === 'player');
  for (let i = 0; i < count; i += 1) {
    const car = spawnTrafficCar(state, rng);
    if (car) state.cars.push(car);
  }
  state.peds = [];
  for (let i = 0; i < 26; i += 1) {
    state.peds.push(spawnPed(state, rng));
  }
}

// spawnTrafficCar puts one traffic car on a random road, facing along it.
export function spawnTrafficCar(state, rng) {
  const vertical = chance(rng, 0.5);
  let x;
  let y;
  let angle;
  if (vertical) {
    x = pick(rng, ROAD_XS) + (chance(rng, 0.5) ? 17 : -17);
    y = range(rng, 120, 1780);
    angle = chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2;
  } else {
    x = range(rng, 120, 2380);
    y = pick(rng, ROAD_YS) + (chance(rng, 0.5) ? 17 : -17);
    angle = chance(rng, 0.5) ? 0 : Math.PI;
  }
  const car = createCar(x, y, angle, { kind: 'traffic', maxSpeed: range(rng, 130, 200) });
  car.speed = car.maxSpeed * 0.7;
  car.driver = 'traffic';
  car.vertical = vertical;
  car.lane = chance(rng, 0.5) ? 17 : -17;
  return car;
}

// spawnParkedCars lines parked cars along roads for the player to steal.
export function spawnParkedCars(state, count) {
  const rng = mulberry32(777);
  for (let i = 0; i < count; i += 1) {
    const vertical = chance(rng, 0.5);
    let x;
    let y;
    let angle;
    if (vertical) {
      x = pick(rng, ROAD_XS) + 30;
      y = range(rng, 150, 1750);
      angle = chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = range(rng, 150, 2350);
      y = pick(rng, ROAD_YS) + 30;
      angle = chance(rng, 0.5) ? 0 : Math.PI;
    }
    const car = createCar(x, y, angle, { kind: 'parked', maxSpeed: range(rng, 340, 430) });
    car.driver = null;
    state.cars.push(car);
  }
}

// spawnPed puts one pedestrian on a sidewalk or in the park.
export function spawnPed(state, rng) {
  const inPark = chance(rng, 0.25);
  let x;
  let y;
  if (inPark) {
    x = range(rng, 860, 1040);
    y = range(rng, 860, 1040);
  } else {
    const p = nearestRoadPoint(range(rng, 100, 2400), range(rng, 100, 1800));
    x = p.x + (p.vertical ? range(rng, -46, 46) : range(rng, -46, 46));
    y = p.y + (p.vertical ? range(rng, -46, 46) : range(rng, -46, 46));
    if (pointInBuilding(state.city, x, y)) {
      x = p.x;
      y = p.y;
    }
  }
  return {
    x, y,
    angle: range(rng, 0, Math.PI * 2),
    speed: range(rng, 28, 55),
    shirt: pick(rng, PED_SHIRTS),
    walkPhase: range(rng, 0, 6),
    target: null,
    flee: 0,
    radius: 10,
  };
}

// updateTraffic moves every traffic car along its road, turning at
// intersections, and walks every pedestrian toward a wandering target.
export function updateTraffic(state, dt) {
  const rng = state.trafficRng || (state.trafficRng = mulberry32(99));
  for (const car of state.cars) {
    if (car.kind !== 'traffic') continue;
    updateTrafficCar(state, car, dt, rng);
  }
  for (const ped of state.peds) {
    updatePed(state, ped, dt, rng);
  }
}

function updateTrafficCar(state, car, dt, rng) {
  // Slow down for the car ahead on the same lane.
  let ahead = Infinity;
  for (const other of state.cars) {
    if (other === car || other.kind === 'parked') continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (along > 0 && along < 90 && side < 26) ahead = Math.min(ahead, along);
  }
  const targetSpeed = ahead < 70 ? 0 : car.maxSpeed;
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);

  // Turn at an intersection sometimes, staying on the grid.
  const nearX = ROAD_XS.find((rx) => Math.abs(car.x - rx) < 14);
  const nearY = ROAD_YS.find((ry) => Math.abs(car.y - ry) < 14);
  if (nearX !== undefined && nearY !== undefined && chance(rng, dt * 0.55)) {
    const turn = pick(rng, [0, Math.PI / 2, -Math.PI / 2, Math.PI]);
    car.angle = Math.round((car.angle + turn) / (Math.PI / 2)) * (Math.PI / 2);
    car.vertical = Math.abs(Math.sin(car.angle)) > 0.5;
  }

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Loop back at the world edge so traffic never runs out.
  if (car.x < 60 || car.x > 2440 || car.y < 60 || car.y > 1840) {
    const fresh = spawnTrafficCar(state, rng);
    car.x = fresh.x;
    car.y = fresh.y;
    car.angle = fresh.angle;
    car.speed = fresh.maxSpeed * 0.7;
  }
  collideCarWithBuildings(state.city, car);
}

function updatePed(state, ped, dt, rng) {
  if (ped.flee > 0) {
    ped.flee -= dt;
    ped.x += Math.cos(ped.angle) * 130 * dt;
    ped.y += Math.sin(ped.angle) * 130 * dt;
  } else {
    if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 12) {
      const p = nearestRoadPoint(ped.x + range(rng, -260, 260), ped.y + range(rng, -260, 260));
      ped.target = { x: p.x + range(rng, -40, 40), y: p.y + range(rng, -40, 40) };
    }
    const dx = ped.target.x - ped.x;
    const dy = ped.target.y - ped.y;
    const d = Math.hypot(dx, dy) || 1;
    ped.angle = Math.atan2(dy, dx);
    ped.x += (dx / d) * ped.speed * dt;
    ped.y += (dy / d) * ped.speed * dt;
    ped.walkPhase += dt * 7;
  }
  // Flee from a speeding player car nearby.
  if (state.car) {
    const dx = ped.x - state.car.x;
    const dy = ped.y - state.car.y;
    const d = Math.hypot(dx, dy);
    if (d < 70 && Math.abs(state.car.speed) > 120) {
      ped.flee = 1.2;
      ped.angle = Math.atan2(dy, dx);
    }
  }
  const solved = collideCircle(state.city, ped.x, ped.y, ped.radius);
  ped.x = solved.x;
  ped.y = solved.y;
}

// drawTraffic paints all traffic cars and pedestrians.
export function drawTraffic(ctx, state) {
  for (const car of state.cars) {
    if (car.kind === 'traffic' || car.kind === 'parked') drawCar(ctx, car, state.time);
  }
  for (const ped of state.peds) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y + 9, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    const bob = Math.sin(ped.walkPhase) * 1.5;
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y + bob, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y - 2 + bob, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}
