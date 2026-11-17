// Missions and story for Solmara Nights. Rico Vale arrives in Solmara with
// $250 and a phone number: Mara Solis, who runs a crew out of her garage.
// Six missions tell that story; each pays cash and unlocks the next one.

import { addWanted } from './police.js';
import { hurtPlayer } from './player.js';
import { mulberry32, range, rangeInt } from './rng.js';

// MISSION_DEFS is the whole story, in order. Steps are generic:
// goto | checkpoints | collect | survive | combat | deliver.
export const MISSION_DEFS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    story: 'Mara: "New in town? Prove you can drive. Lift a car and bring it to my garage."',
    reward: 300,
    steps: [
      { type: 'goto', label: 'Steal a car (walk up to one, press E)', needCar: true, x: 0, y: 0, anyCar: true },
      { type: 'goto', label: 'Drive to Mara\'s Garage', x: 530, y: 1605, r: 80 },
    ],
  },
  {
    id: 'package-run',
    title: 'Package Run',
    story: 'Mara: "A package is waiting at the docks. Pick it up, drop it at Club Neon. Cops are watching the docks."',
    reward: 450,
    steps: [
      { type: 'goto', label: 'Pick up the package at the Docks', x: 480, y: 1595, r: 70 },
      { type: 'goto', label: 'Deliver it to Club Neon', x: 1720, y: 380, r: 70, onStart: 'heat2' },
    ],
  },
  {
    id: 'getaway',
    title: 'Getaway',
    story: 'Mara: "The crew needs a driver who can thread the city. Hit every checkpoint before the clock dies."',
    reward: 600,
    steps: [
      { type: 'checkpoints', label: 'Hit all 3 checkpoints in time', time: 55, points: [
        { x: 800, y: 200, r: 70 }, { x: 2000, y: 800, r: 70 }, { x: 500, y: 1400, r: 70 },
      ] },
    ],
  },
  {
    id: 'heat',
    title: 'Shake the Heat',
    story: 'Mara: "You are too hot. Lose the cops — three stars and counting. Stay out of sight until it cools."',
    reward: 700,
    steps: [
      { type: 'survive', label: 'Lose the wanted level (stay away from police)', time: 90, onStart: 'heat3' },
    ],
  },
  {
    id: 'the-exchange',
    title: 'The Exchange',
    story: 'Mara: "The Vipers want our turf. Meet them at the plaza — and make sure they walk away empty-handed."',
    reward: 900,
    steps: [
      { type: 'goto', label: 'Go to the Marina Plaza', x: 350, y: 1400, r: 90, onStart: 'pistol' },
      { type: 'combat', label: 'Deal with the Vipers (3)', count: 3 },
    ],
  },
  {
    id: 'solmara-nights',
    title: 'Solmara Nights',
    story: 'Mara: "One last job. The yacht, the money, the whole city watching. Get to the yacht, then vanish."',
    reward: 1500,
    steps: [
      { type: 'goto', label: 'Reach the Yacht at the beach', x: 2505, y: 975, r: 80, onStart: 'heat2' },
      { type: 'survive', label: 'Escape! Lose the wanted level', time: 75 },
    ],
  },
];

// createMissions starts the mission chain at the given index.
export function createMissions(index) {
  return {
    index: index || 0,
    stepIndex: 0,
    stepTimer: 0,
    checkpointIndex: 0,
    thugsLeft: 0,
    active: false,
    done: false,
  };
}

// startMission begins the current mission: story toast, first objective.
export function startMission(state) {
  const def = MISSION_DEFS[state.missions.index];
  if (!def) return;
  state.missions.active = true;
  state.missions.stepIndex = 0;
  state.missions.checkpointIndex = 0;
  state.message = def.title + ' — ' + def.story;
  state.messageUntil = state.time + 7;
  applyStepStart(state, def.steps[0]);
  updateObjective(state);
}

// applyStepStart runs a step's onStart hook (heat, pistol, thugs).
function applyStepStart(state, step) {
  if (!step) return;
  if (step.onStart === 'heat2') addWanted(state, 2);
  if (step.onStart === 'heat3') addWanted(state, 3);
  if (step.onStart === 'pistol') {
    state.player.hasPistol = true;
    state.player.ammo = 60;
    state.player.weapon = 'pistol';
    state.message = 'Mara gave you a pistol. Press 2 to draw it, click to fire.';
    state.messageUntil = state.time + 5;
  }
  if (step.type === 'checkpoints') {
    state.missions.stepTimer = step.time;
    state.missions.checkpointIndex = 0;
  }
  if (step.type === 'survive') state.missions.stepTimer = step.time;
  if (step.type === 'combat') spawnThugs(state, step.count);
}

// spawnThugs drops rival gang members near the player for a combat step.
export function spawnThugs(state, count) {
  const rng = mulberry32(Math.floor(state.time * 1000) + 31);
  state.thugs = [];
  for (let i = 0; i < count; i += 1) {
    const a = range(rng, 0, Math.PI * 2);
    state.thugs.push({
      x: state.player.x + Math.cos(a) * range(rng, 140, 260),
      y: state.player.y + Math.sin(a) * range(rng, 140, 260),
      angle: 0, speed: range(rng, 95, 125), health: 50, radius: 12,
      punchCooldown: 0, walkPhase: range(rng, 0, 6), hurtFlash: 0,
    });
  }
  state.missions.thugsLeft = count;
}

// updateObjective refreshes the HUD objective line from the current step.
export function updateObjective(state) {
  const def = MISSION_DEFS[state.missions.index];
  if (!def || !state.missions.active) {
    state.objective = state.storyComplete
      ? 'Story complete — free roam Solmara. Collect cash, steal cars, stay sharp.'
      : 'Press ENTER to start the next mission.';
    return;
  }
  const step = def.steps[state.missions.stepIndex];
  if (!step) { state.objective = ''; return; }
  let label = def.title + ': ' + step.label;
  if (step.type === 'checkpoints') {
    label += ' (' + state.missions.checkpointIndex + '/' + step.points.length + ')';
  }
  if (step.type === 'combat') {
    label += ' (' + state.missions.thugsLeft + ' left)';
  }
  if (step.type === 'survive' || step.type === 'checkpoints') {
    label += ' — ' + Math.ceil(state.missions.stepTimer) + 's';
  }
  state.objective = label;
}

// missionMarker returns the current target point for the minimap + beacon.
export function missionMarker(state) {
  const def = MISSION_DEFS[state.missions.index];
  if (!def || !state.missions.active) return null;
  const step = def.steps[state.missions.stepIndex];
  if (!step) return null;
  if (step.type === 'checkpoints') return step.points[state.missions.checkpointIndex];
  if (step.type === 'combat') {
    const alive = state.thugs.find((t) => t.health > 0);
    return alive ? { x: alive.x, y: alive.y, r: 40 } : null;
  }
  if (step.type === 'survive') return null;
  if (step.anyCar) return null;
  return { x: step.x, y: step.y, r: step.r || 60 };
}

// updateMissions advances timers, checks step completion and pays out.
export function updateMissions(state, dt) {
  const def = MISSION_DEFS[state.missions.index];
  if (!def || !state.missions.active) return;
  const step = def.steps[state.missions.stepIndex];
  if (!step) return;
  const p = state.player;

  if (step.type === 'checkpoints' || step.type === 'survive') {
    state.missions.stepTimer -= dt;
    if (state.missions.stepTimer <= 0) {
      if (step.type === 'survive' && state.wanted === 0) {
        completeStep(state, def);
      } else if (step.type === 'survive') {
        failMission(state, 'The cops never lost you. Try again.');
      } else {
        failMission(state, 'Out of time. Try again.');
      }
      updateObjective(state);
      return;
    }
  }

  if (step.type === 'goto') {
    if (step.anyCar) {
      if (state.car) completeStep(state, def);
    } else if (Math.hypot(p.x - step.x, p.y - step.y) < (step.r || 60)) {
      completeStep(state, def);
    }
  } else if (step.type === 'checkpoints') {
    const pt = step.points[state.missions.checkpointIndex];
    if (pt && Math.hypot(p.x - pt.x, p.y - pt.y) < pt.r) {
      state.missions.checkpointIndex += 1;
      if (state.fx) state.fx.pickup();
      if (state.missions.checkpointIndex >= step.points.length) {
        completeStep(state, def);
      } else {
        state.message = 'Checkpoint ' + state.missions.checkpointIndex + '/' + step.points.length + '!';
        state.messageUntil = state.time + 2;
      }
    }
  } else if (step.type === 'combat') {
    if (state.missions.thugsLeft <= 0) completeStep(state, def);
  }
  updateObjective(state);
}

// completeStep moves to the next step, or finishes the mission with a payout.
function completeStep(state, def) {
  state.missions.stepIndex += 1;
  if (state.missions.stepIndex >= def.steps.length) {
    state.money += def.reward;
    state.missionsDone += 1;
    state.missions.active = false;
    state.score += def.reward;
    state.message = 'Mission complete: ' + def.title + ' +$' + def.reward;
    state.messageUntil = state.time + 5;
    if (state.fx) state.fx.missionDone();
    state.missions.index += 1;
    if (state.missions.index >= MISSION_DEFS.length) {
      state.storyComplete = true;
      state.mode = 'complete';
      state.objective = '';
    }
  } else {
    const next = def.steps[state.missions.stepIndex];
    state.message = 'Step done — ' + next.label;
    state.messageUntil = state.time + 3;
    applyStepStart(state, next);
  }
}

// failMission resets the current mission so the player can retry it.
function failMission(state, reason) {
  state.missions.active = false;
  state.missions.stepIndex = 0;
  state.thugs = [];
  state.message = reason;
  state.messageUntil = state.time + 5;
  if (state.fx) state.fx.fail();
}

// updateThugs moves rival gang members toward the player and lets them punch.
export function updateThugs(state, dt) {
  for (const thug of state.thugs) {
    if (thug.health <= 0) continue;
    thug.hurtFlash = Math.max(0, thug.hurtFlash - dt);
    thug.punchCooldown = Math.max(0, thug.punchCooldown - dt);
    const dx = state.player.x - thug.x;
    const dy = state.player.y - thug.y;
    const d = Math.hypot(dx, dy) || 1;
    thug.angle = Math.atan2(dy, dx);
    if (d > 34) {
      thug.x += (dx / d) * thug.speed * dt;
      thug.y += (dy / d) * thug.speed * dt;
      thug.walkPhase += dt * 9;
    } else if (thug.punchCooldown <= 0) {
      thug.punchCooldown = 0.9;
      if (!state.car) hurtPlayer(state, state.player, 8, state.fx);
    }
  }
}

// damageThug applies a hit to a thug; returns true when it goes down.
export function damageThug(state, thug, amount) {
  thug.health -= amount;
  thug.hurtFlash = 0.25;
  if (thug.health <= 0) {
    state.missions.thugsLeft = Math.max(0, state.missions.thugsLeft - 1);
    state.kills += 1;
    state.score += 25;
    return true;
  }
  return false;
}

// drawThugs paints the rival gang members (purple jackets, the Vipers).
export function drawThugs(ctx, state) {
  for (const thug of state.thugs) {
    if (thug.health <= 0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(thug.x, thug.y + 11, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(thug.x, thug.y);
    ctx.rotate(thug.angle);
    ctx.fillStyle = thug.hurtFlash > 0 ? '#ffffff' : '#6d28a8';
    ctx.fillRect(-9, -8, 18, 16);
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22242a';
    ctx.fillRect(6, -2, 8, 4);
    ctx.restore();
    // Health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(thug.x - 14, thug.y - 24, 28, 4);
    ctx.fillStyle = '#e5484d';
    ctx.fillRect(thug.x - 14, thug.y - 24, 28 * Math.max(0, thug.health / 50), 4);
  }
}
