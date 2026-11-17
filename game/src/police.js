// The Solmara police: patrol cars and foot officers who answer the wanted level.
// A ram has a 1.5 s cooldown per car, so the player is never pinned to 0 km/h.
import { makeCar, CAR_KINDS } from './vehicles.js';
import { snapToRoad, STEP } from './world.js';
import { addMessage, spawnEffect } from './state.js';

const RAM_COOLDOWN = 1.5;
const BUST_TIME = 1.2;

function wantedCarCount(wanted) {
  return Math.min(4, wanted);
}

function wantedFootCount(wanted) {
  return wanted >= 2 ? Math.min(3, wanted - 1) : 0;
}

export function updatePolice(dt, state, audio) {
  const p = state.player;
  // The heat fades when the player stays quiet and out of sight.
  if (state.wanted > 0) {
    state.wantedTimer += dt;
    const nearestCop = nearestCopDist(state);
    if (nearestCop > 500) state.quietTimer += dt; else state.quietTimer = 0;
    if (state.quietTimer > 12) {
      state.wanted -= 1;
      state.quietTimer = 0;
      state.wantedTimer = 0;
      addMessage(state, state.wanted > 0 ? 'The heat is cooling off…' : 'You lost them. Clean — for now.');
    }
  }

  // Spawn patrol cars up to the wanted level.
  const carsWanted = wantedCarCount(state.wanted);
  const policeCars = state.cars.filter((c) => c.driver === 'police');
  if (policeCars.length < carsWanted) spawnPoliceCar(state);
  // Foot officers only chase a player on foot.
  const feetWanted = p.onFoot ? wantedFootCount(state.wanted) : 0;
  const liveCops = state.cops.filter((c) => !c.down);
  if (liveCops.length < feetWanted) spawnFootCop(state);

  // Patrol cars chase and ram; a ram cannot repeat for 1.5 s.
  for (const car of policeCars) {
    car.ramCd = Math.max(0, car.ramCd - dt);
    const tx = p.x, ty = p.y;
    const dx = tx - car.x, dy = ty - car.y;
    const dist = Math.hypot(dx, dy);
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
    const targetSpeed = dist > 320 ? car.max : car.max * 0.85;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Ram: shove the player's car and dent it, then back off on cooldown.
    // The ram never pins the player to a standstill: a minimum roll speed
    // of 80 keeps the chase a chase instead of a parking lot.
    if (!p.onFoot && p.car && dist < 58 && car.ramCd <= 0) {
      car.ramCd = RAM_COOLDOWN;
      car.speed *= 0.4;
      p.car.speed = Math.sign(p.car.speed || 1) * Math.max(Math.abs(p.car.speed) * 0.7, 80);
      p.car.hp -= 12;
      p.car.x += Math.cos(car.angle) * 40;
      p.car.y += Math.sin(car.angle) * 40;
      spawnEffect(state, p.car.x, p.car.y, 'hit');
      audio.punch();
      if (p.car.hp <= 0) {
        addMessage(state, 'Your car is wrecked! Bail out!');
        p.car.hp = 100;
        p.car.speed = 0;
      }
    }
    // A patrol car that lost the player fades back to the precinct.
    if (dist > 1600) {
      car.driver = null;
      state.cars = state.cars.filter((c) => c !== car);
    }
  }

  // Foot officers run the player down and try to hold them.
  for (const cop of state.cops) {
    if (cop.down) {
      cop.downTimer -= dt;
      if (cop.downTimer <= 0) state.cops = state.cops.filter((c) => c !== cop);
      continue;
    }
    const dx = p.x - cop.x, dy = p.y - cop.y;
    const dist = Math.hypot(dx, dy);
    if (p.onFoot && dist < 700) {
      cop.angle = Math.atan2(dy, dx);
      cop.x += Math.cos(cop.angle) * 165 * dt;
      cop.y += Math.sin(cop.angle) * 165 * dt;
      if (dist < 30) {
        p.bustMeter += dt;
        if (p.bustMeter >= BUST_TIME) bustPlayer(state, audio);
      }
    } else if (!p.onFoot) {
      // The player is driving: the officer jogs to the nearest road.
      const snap = snapToRoad(cop.x, cop.y);
      cop.x += (snap.x - cop.x) * dt * 0.5;
      cop.y += (snap.y - cop.y) * dt * 0.5;
      if (dist > 900) state.cops = state.cops.filter((c) => c !== cop);
    } else if (dist > 900) {
      state.cops = state.cops.filter((c) => c !== cop);
    }
  }

  // Siren wails while any patrol car is near.
  const sirenNear = policeCars.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 600);
  audio.setSiren(sirenNear && state.wanted > 0);
  audio.tickSiren(dt);
}

function nearestCopDist(state) {
  const p = state.player;
  let best = Infinity;
  for (const c of state.cars) {
    if (c.driver === 'police') best = Math.min(best, Math.hypot(c.x - p.x, c.y - p.y));
  }
  for (const c of state.cops) {
    if (!c.down) best = Math.min(best, Math.hypot(c.x - p.x, c.y - p.y));
  }
  return best;
}

function spawnPoliceCar(state) {
  const p = state.player;
  const rng = state.rng;
  // Spawn on a road 550–750 units away, roughly ahead of the player.
  const angle = rng() * Math.PI * 2;
  let x = p.x + Math.cos(angle) * (550 + rng() * 200);
  let y = p.y + Math.sin(angle) * (550 + rng() * 200);
  x = Math.max(90, Math.min(3510, x));
  y = Math.max(90, Math.min(3510, y));
  const snap = snapToRoad(x, y);
  const car = makeCar(snap.x, snap.y, Math.atan2(p.y - snap.y, p.x - snap.x), 'police', '#1c2733');
  car.driver = 'police';
  car.hp = 100;
  state.cars.push(car);
}

function spawnFootCop(state) {
  const p = state.player;
  const rng = state.rng;
  const angle = rng() * Math.PI * 2;
  const x = p.x + Math.cos(angle) * 320;
  const y = p.y + Math.sin(angle) * 320;
  state.cops.push({
    x: Math.max(40, Math.min(3560, x)),
    y: Math.max(40, Math.min(3560, y)),
    angle: 0, hp: 100, down: false, downTimer: 0,
  });
}

function bustPlayer(state, audio) {
  const p = state.player;
  state.stats.busts += 1;
  const fine = Math.min(state.money, 100);
  state.money -= fine;
  state.wanted = 0;
  state.quietTimer = 0;
  p.bustMeter = 0;
  p.health = 100;
  audio.busted();
  spawnEffect(state, p.x, p.y, 'bust');
  if (!p.onFoot && p.car) {
    p.car.driver = null;
    p.car.parked = true;
    p.car = null;
    p.onFoot = true;
  }
  // Hauled to the precinct steps, then released at the start corner.
  p.x = 900; p.y = 900;
  state.camera.x = p.x; state.camera.y = p.y;
  addMessage(state, `BUSTED! The Solmara PD took $${fine} and dropped you at the precinct.`, 5);
  void STEP; void CAR_KINDS;
}
