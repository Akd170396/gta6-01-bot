// Mara's story: six jobs across Solmara, from a hotwired sedan to a yacht.
import { MISSION_TARGETS } from './state.js';
import { addMessage, spawnEffect } from './state.js';
import { saveGame } from './save.js';

export const MISSIONS = [
  {
    title: '1 · Hotwire',
    brief: 'Mara needs wheels. Steal any parked car — walk up and press E.',
    reward: 300,
  },
  {
    title: '2 · Parcel Run',
    brief: 'A courier job for the harbour fixer. Deliver the package to the gold marker.',
    reward: 400,
  },
  {
    title: '3 · Getaway',
    brief: 'The drop went sideways. Reach the gold marker in 75 seconds — any way you can.',
    reward: 600,
    timer: 75,
  },
  {
    title: '4 · Lose the Heat',
    brief: 'Three stars and every cruiser in Solmara is on you. Break line of sight until the heat dies.',
    reward: 800,
  },
  {
    title: '5 · Viper Nest',
    brief: 'The Vipers took Mara’s brother’s garage. Clear their hideout — fists or pistol, your call.',
    reward: 1200,
  },
  {
    title: '6 · Last Boat Out',
    brief: 'One yacht waits at the marina. Reach the dock and Solmara is behind you.',
    reward: 2000,
  },
];

function setMission(state, index, audio) {
  const m = state.mission;
  m.index = index;
  m.stage = 'active';
  m.timer = MISSIONS[index].timer || 0;
  m.title = MISSIONS[index].title;
  m.text = MISSIONS[index].brief;
  if (index === 0) { m.target = null; }
  if (index === 1) { m.target = { ...MISSION_TARGETS.delivery }; }
  if (index === 2) { m.target = { ...MISSION_TARGETS.getaway }; }
  if (index === 3) { m.target = null; state.wanted = 3; }
  if (index === 4) { m.target = { ...MISSION_TARGETS.hideout }; spawnVipers(state); }
  if (index === 5) { m.target = { ...state.world.dock }; }
  addMessage(state, `${MISSIONS[index].title} — ${MISSIONS[index].brief}`, 6);
  void audio;
}

export function startMissions(state, fromIndex) {
  setMission(state, fromIndex || 0);
}

function spawnVipers(state) {
  const t = MISSION_TARGETS.hideout;
  const names = ['Rook', 'Fang', 'Smoke', 'Ivy', 'Brick'];
  state.vipers = names.map((name, i) => ({
    name,
    x: t.x + (state.rng() - 0.5) * 220,
    y: t.y + (state.rng() - 0.5) * 220,
    angle: state.rng() * Math.PI * 2,
    hp: 100, shootCd: 1 + state.rng(), speed: 120,
  }));
  addMessage(state, 'Five Vipers guard the hideout. Take them all down!', 5);
}

function completeMission(state, audio) {
  const m = state.mission;
  const reward = MISSIONS[m.index].reward;
  state.money += reward;
  state.stats.missionsDone += 1;
  state.player.ammo = Math.min(48, state.player.ammo + 24);
  audio.missionDone();
  spawnEffect(state, state.player.x, state.player.y, 'pickup');
  addMessage(state, `Job done! +$${reward} — ammo restocked.`, 5);
  saveGame(state);
  if (m.index + 1 >= MISSIONS.length) {
    state.victory = true;
    m.stage = 'done';
    m.text = 'Solmara is yours. Free roam — or start a new game from the menu.';
    m.target = null;
    return;
  }
  setMission(state, m.index + 1, audio);
}

function failMission(state, reason) {
  const m = state.mission;
  addMessage(state, `${reason} — ${MISSIONS[m.index].title} reset. Try again!`, 5);
  if (m.index === 2) m.timer = MISSIONS[2].timer;
  if (m.index === 4) { state.vipers = []; spawnVipers(state); }
}

export function updateMissions(dt, state, audio) {
  const m = state.mission;
  if (!state.running || m.stage !== 'active') return;
  const p = state.player;

  if (m.index === 0) {
    // Mission 1 ends the moment Mara drives a stolen car.
    if (!p.onFoot && p.car) completeMission(state, audio);
    return;
  }
  if (m.index === 1 || m.index === 2 || m.index === 5) {
    if (m.target && Math.hypot(p.x - m.target.x, p.y - m.target.y) < 70) {
      completeMission(state, audio);
      return;
    }
  }
  if (m.index === 2) {
    m.timer -= dt;
    if (m.timer <= 0) failMission(state, 'Too slow — the getaway window closed');
    return;
  }
  if (m.index === 3) {
    // Mission 4 ends when the wanted level finally hits zero.
    if (state.wanted === 0) completeMission(state, audio);
    return;
  }
  if (m.index === 4) {
    // Vipers shoot back when Mara gets close.
    for (const v of state.vipers) {
      if (v.hp <= 0) continue;
      const d = Math.hypot(p.x - v.x, p.y - v.y);
      if (d < 380) {
        v.angle = Math.atan2(p.y - v.y, p.x - v.x);
        v.shootCd -= dt;
        if (v.shootCd <= 0 && d > 40) {
          v.shootCd = 1.1 + state.rng() * 0.6;
          if (state.rng() < 0.55) {
            p.health -= 6;
            p.hurtFlash = 0.4;
            spawnEffect(state, p.x, p.y, 'hit');
            if (p.health <= 0) wasted(state, audio);
          }
        }
        if (d > 120) {
          v.x += Math.cos(v.angle) * v.speed * dt;
          v.y += Math.sin(v.angle) * v.speed * dt;
        }
      }
    }
    // The dead are gone for good; when none are left, the job is done.
    state.vipers = state.vipers.filter((v) => v.hp > 0);
    if (state.vipers.length === 0) completeMission(state, audio);
    return;
  }
}

export function wasted(state, audio) {
  const p = state.player;
  state.stats.busts += 1;
  const bill = Math.min(state.money, 150);
  state.money -= bill;
  state.wanted = 0;
  p.health = 100;
  p.bustMeter = 0;
  audio.busted();
  if (!p.onFoot && p.car) {
    p.car.driver = null; p.car.parked = true; p.car = null; p.onFoot = true;
  }
  p.x = 900; p.y = 900;
  state.camera.x = p.x; state.camera.y = p.y;
  addMessage(state, `WASTED! The clinic patched you up for $${bill}.`, 5);
}
