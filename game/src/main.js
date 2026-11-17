// Solmara Nights — bootstrap, game loop and glue.
// Owns the canvas, the fixed-step loop, car enter/exit, combat resolution,
// cash pickups, save/load wiring, menu keys and screenshot scene presets.

import { createState, WORLD_SEED, WORLD_W, WORLD_H } from './state.js';
import { generateCity, collideCircle, nearestRoadPoint } from './world.js';
import { createInput, endFrameInput, wasPressed, isDown } from './input.js';
import { SoundFX } from './audio.js';
import { createPlayer, updatePlayer, hurtPlayer, drawPlayer } from './player.js';
import { createCar, updateDrivenCar, collideCarWithBuildings, carsOverlap, drawCar } from './vehicles.js';
import { spawnTraffic, spawnParkedCars, updateTraffic } from './traffic.js';
import { addWanted, updatePolice } from './police.js';
import { createMissions, startMission, updateMissions, updateThugs, damageThug, updateObjective } from './missions.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';
import { renderFrame, updateCamera } from './render.js';
import { mulberry32, range } from './rng.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const state = createState();
state.fx = new SoundFX();
state.viewW = 1280;
state.viewH = 720;
state.canvasW = 1280;
state.canvasH = 720;
state.effects = [];
state.missionIndex = 0;

const input = createInput(canvas);
state.city = generateCity(WORLD_SEED);
state.player = createPlayer(500, 500);
state.missions = createMissions(0);
state.saveExists = hasSave();

// Cash stashes scattered around the city for free-roam progression.
function scatterPickups() {
  const rng = mulberry32(2024);
  state.pickups = [];
  for (let i = 0; i < 14; i += 1) {
    const p = nearestRoadPoint(range(rng, 150, 2350), range(rng, 150, 1750));
    state.pickups.push({ x: p.x + range(rng, -50, 50), y: p.y + range(rng, -50, 50), value: 50 + Math.floor(range(rng, 0, 3)) * 50 });
  }
}
scatterPickups();
spawnTraffic(state, 12);
spawnParkedCars(state, 14);

// fitCanvas sizes the canvas to the window while the game renders at 1280x720.
function fitCanvas() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = 1280;
  canvas.height = 720;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  state.viewW = 1280;
  state.viewH = 720;
  state.canvasW = canvas.getBoundingClientRect().width || w;
  state.canvasH = canvas.getBoundingClientRect().height || h;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

// --- Car enter / exit -------------------------------------------------------

// nearestCarTo finds the closest enterable car within reach of the player.
function nearestCarTo(x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.kind === 'police') continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

// tryEnterCar puts the player in the nearest car (stealing it if parked).
function tryEnterCar() {
  if (state.car) return;
  const car = nearestCarTo(state.player.x, state.player.y, 56);
  if (!car) return;
  if (car.kind === 'parked') {
    car.kind = 'player';
    car.driver = 'player';
    state.carsStolen += 1;
    state.message = 'Car stolen! The owner called it in — the heat is on.';
    state.messageUntil = state.time + 3;
    addWanted(state, 1);
    if (state.fx) state.fx.sirenBlip();
  } else if (car.kind === 'traffic') {
    car.kind = 'player';
    car.driver = 'player';
    car.speed = 0;
    state.message = 'You yanked the driver out and took the wheel!';
    state.messageUntil = state.time + 3;
    addWanted(state, 2);
  } else {
    return;
  }
  state.car = car;
  state.player.x = car.x;
  state.player.y = car.y;
  if (state.fx) state.fx.startEngine();
}

// exitCar drops the player beside the car and leaves it parked.
function exitCar() {
  if (!state.car) return;
  const car = state.car;
  car.kind = 'parked';
  car.driver = null;
  car.speed = 0;
  const side = { x: car.x - Math.sin(car.angle) * 34, y: car.y + Math.cos(car.angle) * 34 };
  const solved = collideCircle(state.city, side.x, side.y, 14);
  state.player.x = solved.x;
  state.player.y = solved.y;
  state.player.angle = car.angle;
  state.car = null;
  if (state.fx) state.fx.stopEngine();
}

// --- Combat resolution ------------------------------------------------------

function resolveEvents(events) {
  for (const ev of events) {
    if (ev.type === 'punch') {
      state.effects.push({ kind: 'punch', x: ev.x, y: ev.y, age: 0, life: 0.18 });
      // Hit thugs, peds and cops in range.
      for (const thug of state.thugs) {
        if (thug.health > 0 && Math.hypot(thug.x - ev.x, thug.y - ev.y) < 34) {
          damageThug(state, thug, 18);
          thug.x += Math.cos(state.player.angle) * 14;
          thug.y += Math.sin(state.player.angle) * 14;
        }
      }
      for (const ped of state.peds) {
        if (Math.hypot(ped.x - ev.x, ped.y - ev.y) < 30) {
          ped.flee = 2;
          ped.angle = Math.atan2(ped.y - state.player.y, ped.x - state.player.x);
          addWanted(state, 1);
        }
      }
    } else if (ev.type === 'shot') {
      const tx = ev.x + Math.cos(ev.angle) * 420;
      const ty = ev.y + Math.sin(ev.angle) * 420;
      state.effects.push({ kind: 'shot', x1: ev.x, y1: ev.y, x2: tx, y2: ty, age: 0, life: 0.08 });
      // Gunfire draws the heat, but at most one star per few seconds:
      // a firefight should not max the wanted level in a single burst.
      if (state.time - (state.lastShotCrimeAt || -99) > 3) {
        state.lastShotCrimeAt = state.time;
        addWanted(state, 1);
      }
      for (const thug of state.thugs) {
        if (thug.health <= 0) continue;
        const dx = thug.x - ev.x;
        const dy = thug.y - ev.y;
        const along = dx * Math.cos(ev.angle) + dy * Math.sin(ev.angle);
        const side = Math.abs(-dx * Math.sin(ev.angle) + dy * Math.cos(ev.angle));
        if (along > 0 && along < 430 && side < 20) {
          damageThug(state, thug, 34);
          break;
        }
      }
    }
  }
}

// --- Collisions: player car vs traffic, peds --------------------------------

function resolveCarCollisions(dt) {
  const car = state.car;
  if (!car) return;
  for (const other of state.cars) {
    if (other === car || other.kind === 'parked') continue;
    if (carsOverlap(car, other)) {
      const push = 30;
      const dx = car.x - other.x;
      const dy = car.y - other.y;
      const d = Math.hypot(dx, dy) || 1;
      car.x += (dx / d) * push * dt * 10;
      car.y += (dy / d) * push * dt * 10;
      if (Math.abs(car.speed) > 180) {
        car.speed *= 0.7;
        other.speed *= 0.5;
        if (other.kind === 'police') addWanted(state, 1);
        if (state.fx) state.fx.crash();
      }
      // Gentle contact only pushes the cars apart; it never scrubs speed,
      // so a nudge from traffic cannot stall the player.
    }
  }
  // Running over a pedestrian is a crime.
  for (const ped of state.peds) {
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26 && Math.abs(car.speed) > 60) {
      ped.flee = 2;
      ped.x += (ped.x - car.x) * 0.1 + 40;
      ped.y += (ped.y - car.y) * 0.1;
      addWanted(state, 1);
      if (state.fx) state.fx.crash();
    }
  }
  // Pick up cash while driving over it.
  collectPickups(car.x, car.y, 34);
}

function collectPickups(x, y, radius) {
  for (const pk of state.pickups) {
    if (Math.hypot(pk.x - x, pk.y - y) < radius + 10) {
      state.money += pk.value;
      state.score += pk.value;
      state.message = 'Found a cash stash: +$' + pk.value;
      state.messageUntil = state.time + 2.5;
      if (state.fx) state.fx.cash();
      pk.x = -9999;
      pk.y = -9999;
    }
  }
}

// --- Scene presets for screenshots ------------------------------------------
// ?scene=start|drive|chase|mission sets up a deterministic moment of the
// game so the screenshots show each system at its best.

function applyScenePreset() {
  const params = new URLSearchParams(window.location.search);
  const scene = params.get('scene');
  if (!scene) return;
  startPlaying();
  if (scene === 'start') {
    state.mode = 'menu';
    return;
  }
  if (scene === 'drive') {
    // Rico in a car on a clear stretch of road, traffic around, driving east.
    const car = nearestCarTo(500, 500, 400) || state.cars[0];
    state.player.x = 300;
    state.player.y = 500;
    state.car = car;
    car.kind = 'player';
    car.driver = 'player';
    car.x = 300;
    car.y = 500;
    car.speed = 280;
    car.angle = 0;
    state.player.angle = 0;
    state.camera.x = car.x - 640;
    state.camera.y = car.y - 360;
    // Keep the lane ahead clear so the shot catches the car at speed.
    for (const other of state.cars) {
      if (other.kind === 'traffic' && Math.abs(other.y - 500) < 60 && other.x > 300 && other.x < 1500) {
        other.y = 1100;
        other.x = 200 + (other.x % 700);
      }
    }
    state.missions.active = true;
    state.missions.index = 0;
    state.missions.stepIndex = 1;
    state.objective = "First Wheels: Drive to Mara's Garage";
    state.money = 540;
  } else if (scene === 'chase') {
    // Wanted 3, police cars in pursuit behind, mission objective on the HUD.
    const car = nearestCarTo(1100, 800, 600) || state.cars[0];
    state.player.x = 900;
    state.player.y = 800;
    state.car = car;
    car.kind = 'player';
    car.driver = 'player';
    car.x = 900;
    car.y = 800;
    car.angle = 0;
    car.speed = 300;
    car.maxSpeed = 430;
    state.wanted = 3;
    state.lastCrimeAt = state.time;
    state.missions.active = true;
    state.missions.index = 3;
    state.missions.stepIndex = 0;
    state.missions.stepTimer = 62;
    state.objective = 'Shake the Heat: Lose the wanted level (stay away from police) — 62s';
    state.money = 1840;
    const spots = [{ x: 620, y: 783 }, { x: 540, y: 817 }, { x: 700, y: 830 }];
    for (const spot of spots) {
      const pc = createCar(spot.x, spot.y, 0, { kind: 'police', maxSpeed: 360, color: '#20242e' });
      pc.driver = 'police';
      pc.speed = 280;
      state.cars.push(pc);
    }
    if (state.fx) state.fx.startSiren();
  } else if (scene === 'mission') {
    // On foot at the plaza, pistol out, Vipers closing in.
    state.player.x = 350;
    state.player.y = 1400;
    state.player.hasPistol = true;
    state.player.ammo = 48;
    state.player.weapon = 'pistol';
    state.camera.x = 350 - 640;
    state.camera.y = 1400 - 360;
    state.missions.active = true;
    state.missions.index = 4;
    state.missions.stepIndex = 1;
    state.missions.thugsLeft = 3;
    state.objective = 'The Exchange: Deal with the Vipers (3 left)';
    state.money = 2310;
    const rng = mulberry32(7);
    state.thugs = [];
    for (let i = 0; i < 3; i += 1) {
      state.thugs.push({
        x: 350 + range(rng, 60, 200) * (i % 2 ? 1 : -1),
        y: 1400 + range(rng, -140, 140),
        angle: 0, speed: 110, health: 50, radius: 12,
        punchCooldown: 0, walkPhase: 0, hurtFlash: 0,
      });
    }
  }
}

// --- Flow -------------------------------------------------------------------

function startPlaying() {
  state.mode = 'playing';
  if (state.fx) state.fx.ensure();
  updateObjectiveLine();
}

function updateObjectiveLine() {
  // Objective text is owned by the missions module.
  updateObjective(state);
}

function respawnAfterEnd() {
  // Busted / wasted: lose $150, wake at the hospital, heat cleared.
  state.money = Math.max(0, state.money - 150);
  state.wanted = 0;
  state.cars = state.cars.filter((c) => c.kind !== 'police');
  state.cops = [];
  if (state.fx) { state.fx.stopSiren(); state.fx.stopEngine(); }
  if (state.car) {
    state.car.kind = 'parked';
    state.car.driver = null;
    state.car.speed = 0;
    state.car = null;
  }
  state.player.x = 1200;
  state.player.y = 200;
  state.player.health = 100;
  state.health = 100;
  state.player.angle = -Math.PI / 2;
  state.camera.x = state.player.x - 640;
  state.camera.y = state.player.y - 360;
  state.mode = 'playing';
  state.message = 'You are back on the streets. Stay sharp.';
  state.messageUntil = state.time + 4;
}

// --- Main loop ----------------------------------------------------------------

let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  state.time += dt;

  // Global keys.
  if (wasPressed(input, 'KeyM')) {
    state.muted = !state.muted;
    state.fx.setMuted(state.muted);
  }

  if (state.mode === 'menu') {
    if (wasPressed(input, 'Enter', 'NumpadEnter')) {
      startPlaying();
      if (!state.missions.active && !state.storyComplete) startMission(state);
    }
    if (wasPressed(input, 'KeyC') && state.saveExists) {
      const save = loadGame();
      if (save) applySave(save);
      startPlaying();
      if (!state.missions.active && !state.storyComplete) startMission(state);
    }
  } else if (state.mode === 'playing') {
    if (wasPressed(input, 'KeyP', 'Escape')) {
      state.mode = 'paused';
      if (state.fx) { state.fx.stopEngine(); state.fx.stopSiren(); }
    } else {
      updatePlaying(dt);
    }
  } else if (state.mode === 'paused') {
    if (wasPressed(input, 'KeyP', 'Escape')) {
      state.mode = 'playing';
      if (state.fx) state.fx.ensure();
    }
    if (wasPressed(input, 'KeyS')) {
      saveGame(state);
      state.message = 'Game saved.';
      state.messageUntil = state.time + 2;
    }
    if (wasPressed(input, 'KeyN')) {
      clearSave();
      location.reload();
    }
  } else if (state.mode === 'busted' || state.mode === 'wasted' || state.mode === 'complete') {
    if (wasPressed(input, 'Enter', 'NumpadEnter')) {
      if (state.mode === 'complete') {
        state.mode = 'playing';
      } else {
        respawnAfterEnd();
      }
      if (!state.missions.active && !state.storyComplete) startMission(state);
    }
  }

  // Effects age out.
  state.effects = state.effects.filter((fx) => {
    fx.age += dt;
    return fx.age < fx.life;
  });

  updateCamera(state, state.viewW, state.viewH);
  renderFrame(ctx, state, state.viewW, state.viewH);
  endFrameInput(input);
}

// applySave restores a saved game onto the live state.
function applySave(save) {
  state.money = save.money;
  state.health = save.health;
  state.player.health = save.health;
  state.missionsDone = save.missionsDone;
  state.missions = createMissions(save.missionIndex || 0);
  state.missionIndex = save.missionIndex || 0;
  state.storyComplete = !!save.storyComplete;
  state.score = save.score || 0;
  state.player.x = save.x;
  state.player.y = save.y;
  state.camera.x = save.x - 640;
  state.camera.y = save.y - 360;
}

// updatePlaying runs one tick of live gameplay.
function updatePlaying(dt) {
  state.stats.timePlayed += dt;
  const player = state.player;

  // Enter / exit car.
  if (wasPressed(input, 'KeyE')) {
    if (state.car) exitCar();
    else tryEnterCar();
  }

  if (state.car) {
    const dist = updateDrivenCar(state.car, input, dt, state.fx);
    state.stats.distanceDriven += dist;
    if (collideCarWithBuildings(state.city, state.car)) {
      if (state.fx) state.fx.crash();
      addWanted(state, 0);
    }
    resolveCarCollisions(dt);
    player.x = state.car.x;
    player.y = state.car.y;
    player.angle = state.car.angle;
    if (state.fx) {
      state.fx.startEngine();
      state.fx.setEngineSpeed(Math.abs(state.car.speed) / state.car.maxSpeed);
    }
  } else {
    const events = updatePlayer(state, player, input, dt, state.fx);
    resolveEvents(events);
    collectPickups(player.x, player.y, 20);
  }

  // Mission start key (ENTER also starts the next mission while playing).
  if (wasPressed(input, 'Enter', 'NumpadEnter') && !state.missions.active && !state.storyComplete) {
    startMission(state);
  }

  updateTraffic(state, dt);
  updatePolice(state, dt);
  updateThugs(state, dt);
  updateMissions(state, dt);

  // Auto-save after each mission completes.
  if (state.missionsDone > (state.lastSavedMissions || 0)) {
    state.lastSavedMissions = state.missionsDone;
    saveGame(state);
  }
}

// Debug hooks for play-testing and screenshots (read-only state + actions).
window.__solmara = {
  state,
  start: () => { startPlaying(); if (!state.missions.active) startMission(state); },
  scene: (name) => { applyScenePresetFor(name); },
  save: () => saveGame(state),
  version: '1.0.0',
};

function applyScenePresetFor(name) {
  const url = new URL(window.location.href);
  url.searchParams.set('scene', name);
  window.history.replaceState({}, '', url);
  location.reload();
}

applyScenePreset();
requestAnimationFrame(frame);
