// Mara Solis on foot: walk, steal a car, punch, shoot.
import { collideBuildings, clampWorld } from './world.js';
import { addCrime, addMessage, spawnEffect } from './state.js';

const WALK_SPEED = 210;
const PUNCH_RANGE = 46;
const PUNCH_DAMAGE = 30;
const SHOT_RANGE = 520;
const SHOT_DAMAGE = 34;

export function updatePlayer(dt, state, input, audio) {
  const p = state.player;
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);

  if (p.onFoot) {
    updateOnFoot(dt, state, input, audio);
  } else if (p.car) {
    updateDriving(dt, state, input, audio);
  }
  // Bust meter drains once no cop is touching the player.
  if (p.bustMeter > 0) p.bustMeter = Math.max(0, p.bustMeter - dt * 0.4);
}

function updateOnFoot(dt, state, input, audio) {
  const p = state.player;
  let mx = 0, my = 0;
  if (input.isDown('KeyW', 'ArrowUp')) my -= 1;
  if (input.isDown('KeyS', 'ArrowDown')) my += 1;
  if (input.isDown('KeyA', 'ArrowLeft')) mx -= 1;
  if (input.isDown('KeyD', 'ArrowRight')) mx += 1;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    mx /= len; my /= len;
    p.angle = Math.atan2(my, mx);
    const nx = p.x + mx * WALK_SPEED * dt;
    const ny = p.y + my * WALK_SPEED * dt;
    const hit = collideBuildings(state.world, nx, ny, 14);
    const cl = clampWorld(hit.x, hit.y, 20);
    p.x = cl.x; p.y = cl.y;
    p.speed = WALK_SPEED;
  } else {
    p.speed = 0;
  }

  // E: steal the nearest car.
  if (input.wasPressed('KeyE')) {
    const car = nearestCar(state, p.x, p.y, 62);
    if (car) enterCar(state, car, audio);
  }
  // F: punch whatever is in front of Mara.
  if (input.wasPressed('KeyF') && p.punchCd <= 0) {
    p.punchCd = 0.4;
    audio.punch();
    punch(state);
  }
  // Click or Space: fire the pistol toward the mouse.
  const wantShot = input.wasPressed('Mouse0') || input.wasPressed('Space');
  if (wantShot && p.shootCd <= 0) {
    if (p.ammo > 0) {
      p.shootCd = 0.28;
      p.ammo -= 1;
      state.stats.shots += 1;
      audio.shot();
      shoot(state, input);
    } else {
      p.shootCd = 0.3;
      addMessage(state, 'Out of ammo — finish a mission to restock.');
    }
  }
}

function updateDriving(dt, state, input, audio) {
  const p = state.player;
  const car = p.car;
  if (!car) { p.onFoot = true; return; }
  // The driving physics run in main.js (driveCar from vehicles.js);
  // here the player only rides along and can step out or honk.
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  p.speed = Math.abs(car.speed);
  if (input.wasPressed('KeyE')) exitCar(state, audio);
  if (input.wasPressed('KeyH')) audio.horn();
  void dt;
}

export function nearestCar(state, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.driver === 'police') continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

function enterCar(state, car, audio) {
  const p = state.player;
  p.onFoot = false;
  p.car = car;
  car.driver = 'player';
  car.parked = false;
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  if (car.ai) car.ai = null;
  state.stats.carsStolen += 1;
  // Stealing a car the player does not own is a crime.
  addCrime(state, 1);
  addMessage(state, 'Car stolen! The heat is on — drive!');
  spawnEffect(state, car.x, car.y, 'pickup');
  audio.pickup();
}

function exitCar(state, audio) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  const side = 34;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * side;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * side;
  p.onFoot = true;
  p.car = null;
  car.driver = null;
  car.parked = true;
  audio.pickup();
}

function punch(state) {
  const p = state.player;
  const fx = p.x + Math.cos(p.angle) * PUNCH_RANGE;
  const fy = p.y + Math.sin(p.angle) * PUNCH_RANGE;
  spawnEffect(state, fx, fy, 'hit');
  for (const v of state.vipers) {
    if (v.hp > 0 && Math.hypot(v.x - p.x, v.y - p.y) < PUNCH_RANGE + 14) {
      v.hp -= PUNCH_DAMAGE;
      spawnEffect(state, v.x, v.y, 'hit');
    }
  }
  for (const ped of state.peds) {
    if (!ped.down && Math.hypot(ped.x - p.x, ped.y - p.y) < PUNCH_RANGE + 12) {
      ped.down = true; ped.downTimer = 6;
      addCrime(state, 1);
    }
  }
}

function shoot(state, input) {
  const p = state.player;
  // Aim from the player toward the mouse on screen (world coords via camera).
  const cam = state.camera;
  const wx = cam.x - 640 + input.mouse.x;
  const wy = cam.y - 360 + input.mouse.y;
  const angle = Math.atan2(wy - p.y, wx - p.x);
  const mx = p.x + Math.cos(angle) * SHOT_RANGE;
  const my = p.y + Math.sin(angle) * SHOT_RANGE;
  spawnEffect(state, p.x + Math.cos(angle) * 26, p.y + Math.sin(angle) * 26, 'shot');
  // Hit the first viper, cop or ped along the shot line.
  const targets = [
    ...state.vipers.filter((v) => v.hp > 0).map((v) => ({ x: v.x, y: v.y, ref: v, kind: 'viper' })),
    ...state.cops.map((c) => ({ x: c.x, y: c.y, ref: c, kind: 'cop' })),
    ...state.peds.filter((d) => !d.down).map((d) => ({ x: d.x, y: d.y, ref: d, kind: 'ped' })),
  ];
  let best = null;
  let bestT = 1;
  for (const t of targets) {
    const dx = t.x - p.x, dy = t.y - p.y;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    if (along < 0 || along > SHOT_RANGE) continue;
    const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
    if (perp < 20 && along / SHOT_RANGE < bestT) { best = t; bestT = along / SHOT_RANGE; }
  }
  if (best) {
    spawnEffect(state, best.x, best.y, 'hit');
    if (best.kind === 'viper') {
      best.ref.hp -= SHOT_DAMAGE;
      addCrime(state, 0);
    } else if (best.kind === 'cop') {
      best.ref.hp -= SHOT_DAMAGE;
      if (best.ref.hp <= 0) best.ref.down = true;
      addCrime(state, 1);
    } else {
      best.ref.down = true; best.ref.downTimer = 8;
      addCrime(state, 1);
    }
  }
  // Shooting a lot draws the heat, but throttled: six shots, one star.
  state.shotsSinceStar += 1;
  if (state.shotsSinceStar >= 6) {
    state.shotsSinceStar = 0;
    addCrime(state, 1);
  }
  void mx; void my;
}
