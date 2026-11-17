// The whole game state in one place, so every system reads the same truth.
import { makeRng } from './rng.js';
import { buildWorld } from './world.js';

export const WORLD_SEED = 1337;

export const MISSION_TARGETS = {
  delivery: { x: 2700, y: 900 },
  getaway: { x: 450, y: 2700 },
  hideout: { x: 2700, y: 2700 },
};

export function createState() {
  const world = buildWorld(WORLD_SEED);
  return {
    world,
    rng: makeRng(WORLD_SEED + 7),
    time: 0,
    running: false,
    over: false,
    victory: false,
    paused: false,
    money: 200,
    health: 100,
    wanted: 0,
    wantedTimer: 0,
    quietTimer: 0,
    shotsSinceStar: 0,
    player: {
      x: 900, y: 900, angle: -Math.PI / 2, speed: 0,
      onFoot: true, car: null, ammo: 24,
      punchCd: 0, shootCd: 0, bustMeter: 0, hurtFlash: 0,
    },
    cars: [],
    peds: [],
    cops: [],
    vipers: [],
    effects: [],
    mission: {
      index: 0, stage: 'intro', target: null, timer: 0,
      text: 'Steal a car — walk up to one and press E.',
      title: '1 · Hotwire',
    },
    message: '',
    messageTimer: 0,
    camera: { x: 900, y: 900, zoom: 1 },
    stats: { carsStolen: 0, missionsDone: 0, shots: 0, busts: 0 },
    saveSlot: null,
  };
}

// A floating text/particle burst the renderer draws.
export function spawnEffect(state, x, y, kind) {
  const colors = { shot: '#ffd23f', hit: '#ff5a3c', pickup: '#7dff8a', bust: '#3c8cff' };
  for (let i = 0; i < 10; i++) {
    const a = state.rng() * Math.PI * 2;
    const sp = 40 + state.rng() * 120;
    state.effects.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.5 + state.rng() * 0.3, max: 0.8,
      color: colors[kind] || '#ffffff', size: 2 + state.rng() * 3,
    });
  }
  if (state.effects.length > 220) state.effects.splice(0, state.effects.length - 220);
}

export function addMessage(state, text, seconds) {
  state.message = text;
  state.messageTimer = seconds || 4;
}

// Raising the heat: stealing, hitting people, shooting, ramming police.
export function addCrime(state, stars) {
  if (state.wanted >= 5) return;
  state.wanted = Math.min(5, state.wanted + stars);
  state.wantedTimer = 0;
  state.quietTimer = 0;
}

// True while any patrol is after the player.
export function isWanted(state) {
  return state.wanted > 0;
}
