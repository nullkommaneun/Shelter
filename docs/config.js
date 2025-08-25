export const TILE = 16;
export const COLS = 18;
export const ROWS = 12;

export const START_RES = { wood: 40, metal: 10, food: 10 };

export const TICK_MS = 1000;

export const ATTACK_PERIOD = 20;
export const THREAT_INC = 1.2;
export const THREAT_DROP_AFTER = 25;
export const ATTACK_BASE_MIN = 5;
export const ATTACK_BASE_RAND = 10;
export const ATTACK_THREAT_FACTOR = 0.1;

export const BUILD_DEF = {
  "Mine":      { color:"#7aa8a1", cost:{wood:10}, out:{metal:1}, up:1.7, max:3 },
  "Farm":      { color:"#7fbf6d", cost:{wood:15}, out:{food:1}, up:1.7, max:3 },
  "Forst":     { color:"#b2925a", cost:{food:5},  out:{wood:1}, up:1.7, max:3 },
  "Generator": { color:"#6f86d6", cost:{metal:20}, power:{prod:1}, up:1.8, max:3 },
  "Barrikade": { color:"#a26d5e", cost:{wood:20}, defense:1, up:1.9, max:3 },
  "Turm":      { color:"#d07474", cost:{metal:30}, defense:2, power:{need:1}, up:1.9, max:3 }
};
export const BUILD_ORDER = ["Mine","Farm","Forst","Generator","Barrikade","Turm"];

export const SAVE_VERSION = 1;
export const SAVE_KEY = "shelter-core-v1";
export const GAME_VERSION = "core-0.1.0";