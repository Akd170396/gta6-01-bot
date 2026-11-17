// Solmara Nights — the game loop that wires every system together.
import { createState } from './state.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud, START_TEXT } from './hud.js';
import { updatePlayer } from './player.js';
import { driveCar, spawnParkedCars, separateCars } from './vehicles.js';
import { updateTraffic, updatePeds } from './traffic.js';
import { updatePolice } from './police.js';
import { updateMissions, startMissions } from './missions.js';
import { render } from './render.js';
import { saveGame, loadSave, applySave } from './save.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const state = createState();
const input = createInput(canvas);
const audio = createAudio();

let last = performance.now();

const hud = createHud(state, {
  onStart: (useSave, fresh) => startGame(useSave, fresh),
});

function startGame(useSave, fresh) {
  audio.ensure();
  if (fresh) {
    Object.assign(state, createState());
  }
  if (useSave) {
    const data = loadSave();
    if (data) {
      const idx = applySave(state, data);
      spawnParkedCars(state);
      startMissions(state, idx);
    } else {
      spawnParkedCars(state);
      startMissions(state, 0);
    }
  } else if (!fresh) {
    spawnParkedCars(state);
    startMissions(state, 0);
  } else {
    spawnParkedCars(state);
    startMissions(state, 0);
  }
  state.running = true;
  hud.hideOverlay();
}

function step(now) {
  requestAnimationFrame(step);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  // Pause toggles even while paused, so the player can always resume.
  if (state.running && input.wasPressed('KeyP')) {
    state.paused = !state.paused;
    if (state.paused) saveGame(state);
  }
  if (!state.running || state.paused) {
    input.endFrame();
    return;
  }
  state.time += dt;
  if (state.messageTimer > 0) state.messageTimer -= dt;

  try {
    stepGame(dt);
  } finally {
    // Always consume this frame's key presses, even if a system throws,
    // or a stuck key would fire again on the next frame.
    input.endFrame();
  }
}

function stepGame(dt) {
  // Player first: walk, drive, fight.
  updatePlayer(dt, state, input, audio);
  if (!state.player.onFoot && state.player.car) {
    const car = state.player.car;
    let throttle = 0;
    if (input.isDown('KeyW', 'ArrowUp')) throttle += 1;
    if (input.isDown('KeyS', 'ArrowDown')) throttle -= 1;
    let steer = 0;
    if (input.isDown('KeyA', 'ArrowLeft')) steer -= 1;
    if (input.isDown('KeyD', 'ArrowRight')) steer += 1;
    if (input.isDown('Space')) {
      car.speed *= Math.pow(0.25, dt);
      steer *= 1.5;
    }
    driveCar(car, throttle, steer, dt, state.world);
  }

  updateTraffic(dt, state);
  updatePeds(dt, state);
  updatePolice(dt, state, audio);
  updateMissions(dt, state, audio);
  separateCars(state.cars);

  // Effects age and fade.
  for (const e of state.effects) {
    e.life -= dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
  }
  state.effects = state.effects.filter((e) => e.life > 0);

  // Camera follows Mara (or her car), clamped to the city.
  const cam = state.camera;
  const tx = state.player.x, ty = state.player.y;
  cam.x += (tx - cam.x) * Math.min(1, dt * 5);
  cam.y += (ty - cam.y) * Math.min(1, dt * 5);
  cam.x = Math.max(640, Math.min(3600 - 640, cam.x));
  cam.y = Math.max(360, Math.min(3600 - 360, cam.y));

  // Engine sound follows the speed.
  const driving = !state.player.onFoot && state.player.car;
  audio.setEngine(driving ? Math.abs(state.player.car.speed) / state.player.car.max : 0, driving);

  render(ctx, state);
  hud.update();
  if (input.wasPressed('KeyM')) audio.toggleMute();
}

// The start screen waits for the player; the loop runs behind it.
hud.showOverlay('SOLMARA NIGHTS', START_TEXT);
render(ctx, state);
requestAnimationFrame(step);
window.addEventListener('beforeunload', () => { if (state.running) saveGame(state); });

// Test hooks for the maker's own playtests (not part of the game).
window.__solmara = { state, startGame };
window.__solmaraReady = true;
