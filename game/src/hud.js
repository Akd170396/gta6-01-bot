// The HUD: money, health, wanted stars, objective, speed — and the menus.
import { drawMinimap } from './render.js';
import { loadSave, clearSave } from './save.js';

export function createHud(state, callbacks) {
  const $ = (id) => document.getElementById(id);
  const hud = {
    money: $('hud-money'),
    health: $('hud-health'),
    healthBar: $('hud-healthbar'),
    stars: $('hud-stars'),
    objective: $('hud-objective'),
    missionTitle: $('hud-mission-title'),
    speed: $('hud-speed'),
    message: $('hud-message'),
    minimap: $('minimap'),
    overlay: $('overlay'),
    overlayTitle: $('overlay-title'),
    overlayText: $('overlay-text'),
    startBtn: $('btn-start'),
    continueBtn: $('btn-continue'),
    newBtn: $('btn-new'),
    victory: $('victory'),
  };

  const save = loadSave();
  if (save) {
    hud.continueBtn.style.display = 'inline-block';
    hud.continueBtn.textContent = `Continue — $${save.money} · Job ${save.missionIndex + 1}`;
  }
  hud.startBtn.addEventListener('click', () => callbacks.onStart(false));
  hud.continueBtn.addEventListener('click', () => callbacks.onStart(true));
  // Enter on the start screen starts the game, no mouse needed.
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' && hud.overlay.style.display !== 'none' && !state.running) {
      callbacks.onStart(false);
    }
  });
  hud.newBtn.addEventListener('click', () => {
    clearSave();
    callbacks.onStart(false, true);
  });

  hud.showOverlay = function showOverlay(title, text) {
    hud.overlayTitle.textContent = title;
    hud.overlayText.innerHTML = text;
    hud.overlay.style.display = 'flex';
  };
  hud.hideOverlay = function hideOverlay() {
    hud.overlay.style.display = 'none';
  };
  hud.showVictory = function showVictory() {
    hud.victory.style.display = 'block';
  };

  hud.update = function update() {
    hud.money.textContent = `$${state.money}`;
    const hp = Math.max(0, Math.round(state.health));
    hud.health.textContent = `${hp}`;
    hud.healthBar.style.width = `${hp}%`;
    hud.healthBar.style.background = hp > 50 ? '#7dff8a' : hp > 25 ? '#ffd23f' : '#ff5a3c';
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < state.wanted ? '★' : '☆';
    hud.stars.textContent = stars;
    hud.stars.style.color = state.wanted > 0 ? '#ffd23f' : '#ffffff';
    hud.missionTitle.textContent = state.mission.title;
    let obj = state.mission.text;
    if (state.mission.index === 2 && state.mission.stage === 'active') {
      obj += ` — ${Math.ceil(state.mission.timer)}s left`;
    }
    hud.objective.textContent = obj;
    if (!state.player.onFoot && state.player.car) {
      const kmh = Math.round(Math.abs(state.player.car.speed) * 0.36);
      hud.speed.textContent = `${kmh} km/h`;
      hud.speed.style.display = 'block';
    } else {
      hud.speed.style.display = 'none';
    }
    if (state.messageTimer > 0) {
      hud.message.textContent = state.message;
      hud.message.style.display = 'block';
    } else {
      hud.message.style.display = 'none';
    }
    if (state.victory) hud.showVictory();
    const mctx = hud.minimap.getContext('2d');
    drawMinimap(mctx, state);
  };
  return hud;
}

export const START_TEXT = `
  <p><b>Solmara</b>, a sun-soaked port city. Mara Solis came home broke — and the
  harbour fixer has six jobs for her, from a hotwired sedan to a yacht at the marina.</p>
  <p><b>WASD / arrows</b> move &amp; drive &nbsp;·&nbsp; <b>E</b> steal / exit car
  &nbsp;·&nbsp; <b>F</b> punch &nbsp;·&nbsp; <b>Click / Space</b> shoot
  &nbsp;·&nbsp; <b>Space</b> handbrake in a car &nbsp;·&nbsp; <b>H</b> horn &nbsp;·&nbsp; <b>M</b> mute</p>
  <p>Steal cars, dodge the Solmara PD, and finish all six jobs. Your progress saves automatically.</p>`;
