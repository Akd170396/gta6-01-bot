// Save and continue: the player's progress lives in localStorage.
export const SAVE_KEY = 'solmara-nights-save-v1';

export function saveGame(state) {
  try {
    const data = {
      money: state.money,
      health: state.health,
      missionIndex: state.mission.index,
      x: state.player.x,
      y: state.player.y,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    state.saveSlot = data;
    return true;
  } catch (e) {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage unavailable */ }
}

// True when a continue slot exists, without parsing it.
export function hasSave() {
  try { return localStorage.getItem(SAVE_KEY) !== null; } catch (e) { return false; }
}

export function applySave(state, data) {
  state.money = data.money;
  state.health = data.health || 100;
  state.player.x = data.x || 900;
  state.player.y = data.y || 900;
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  return data.missionIndex;
}
