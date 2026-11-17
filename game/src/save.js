// LocalStorage save / load for Solmara Nights. The save holds the player's
// money, health, mission progress, position and story state — never any key.

import { SAVE_KEY } from './state.js';

// saveGame writes the current progress to localStorage.
export function saveGame(state) {
  try {
    const data = {
      version: 1,
      money: Math.round(state.money),
      health: Math.round(state.health),
      missionsDone: state.missionsDone,
      missionIndex: state.missions ? state.missions.index : 0,
      x: state.player ? Math.round(state.player.x) : 500,
      y: state.player ? Math.round(state.player.y) : 500,
      storyComplete: state.storyComplete,
      score: Math.round(state.score),
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

// loadGame reads a save back, or returns null when there is none.
export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

// hasSave reports whether a save exists (for the start screen).
export function hasSave() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch (e) {
    return false;
  }
}

// clearSave removes the save (used from the pause menu's New Game).
export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (e) { /* storage is best-effort */ }
}
