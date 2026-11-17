// Shared constants and the single game-state factory for Solmara Nights.
// Every other module receives the state object and reads or mutates it;
// nothing here touches the DOM, the canvas or the network.

// Fictional sun-soaked coastal city. All names, people and places are invented.
export const CITY_NAME = 'Solmara';
export const GAME_TITLE = 'Solmara Nights';
export const WORLD_W = 2600;
export const WORLD_H = 1900;
export const ROAD_W = 72;
export const SAVE_KEY = 'solmara-nights-save-v1';
export const WORLD_SEED = 1337;

export const COLORS = {
  grass: '#7fae5a',
  parkGrass: '#69a24e',
  sand: '#e8d29a',
  water: '#2f7fb8',
  waterDeep: '#256b9e',
  road: '#3a3f4a',
  roadLine: '#e8e3c8',
  sidewalk: '#b8b2a4',
  buildingRoof: ['#c96f4a', '#d9a441', '#7d9bb5', '#b5533c', '#8a7ba8', '#5d8a6a'],
  buildingWall: '#e8ddc8',
  tree: '#3f7d3a',
  palm: '#4c8a3f',
};

export function createState() {
  return {
    mode: 'menu', // menu | playing | paused | busted | wasted | complete
    time: 0,
    money: 250,
    health: 100,
    maxHealth: 100,
    wanted: 0,
    wantedTimer: 0,
    lastCrimeAt: -999,
    score: 0,
    kills: 0,
    carsStolen: 0,
    missionsDone: 0,
    message: '',
    messageUntil: 0,
    objective: '',
    player: null,
    car: null, // the car the player currently drives (or null on foot)
    cars: [], // all cars in the world (traffic + parked + police)
    peds: [],
    cops: [],
    thugs: [],
    pickups: [],
    packages: [],
    markers: [],
    city: null,
    camera: { x: 0, y: 0 },
    muted: false,
    saveExists: false,
    storyComplete: false,
    stats: { distanceDriven: 0, timePlayed: 0 },
  };
}
