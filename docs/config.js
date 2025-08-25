// --- Grid & Tick ---
export const TILE = 16;
export const COLS = 18;
export const ROWS = 12;
export const TICK_MS = 1000;

// --- Startressourcen ---
export const START_RES = { wood: 40, metal: 10, food: 10 };

// --- Bedrohung/Angriff (Perioden-Altwerte nicht mehr genutzt) ---
export const THREAT_INC = 1.2;
export const THREAT_DROP_AFTER = 25;
export const ATTACK_BASE_MIN = 5;
export const ATTACK_BASE_RAND = 10;
export const ATTACK_THREAT_FACTOR = 0.1;

// --- Neuer Angriff-Scheduler (Poisson) ---
export const ATTACK_MEAN_BASE_S = 28;   // mittlere Pause bei Threat=0
export const ATTACK_MEAN_MIN_S  = 14;   // mittlere Pause bei Threat=100
export const REVEAL_MIN_S = 7;          // Countdown-Fenster
export const REVEAL_MAX_S = 11;
export const GRACE_S = 50;              // Schonfrist
export const COUNTDOWN_JITTER_P = 0.15; // ±1s Jitter
export const COUNTDOWN_JITTER_S = 1;

// --- Tower Defense Basis ---
export const LANE_ROW = Math.floor(ROWS / 2); // mittlere Reihe
export const ENEMY_HP = 6;
export const ENEMY_SPEED_TILES_PER_TICK = 0.5; // 0.5 Tile pro Sekunde
export const ENEMY_BASE_DMG = 10;               // Schaden am Ziel
export const SPAWN_INTERVAL_S = 1;              // Abstand zwischen Gegner-Spawns in einer Welle
export const KILL_REWARD_METAL = 0;             // optionaler Loot (0 = aus)

export const TOWER_RANGE_TILES = 3;             // Reichweite (kreisförmig)
export const TOWER_DMG_PER_TICK = 2;            // Schaden pro Tick je aktivem Turm

// --- Gebäude ---
export const BUILD_DEF = {
  "Mine":      { color:"#7aa8a1", cost:{wood:10}, out:{metal:1}, up:1.7, max:3 },
  "Farm":      { color:"#7fbf6d", cost:{wood:15}, out:{food:1}, up:1.7, max:3 },
  "Forst":     { color:"#b2925a", cost:{food:5},  out:{wood:1}, up:1.7, max:3 },
  "Generator": { color:"#6f86d6", cost:{metal:20}, power:{prod:1}, up:1.8, max:3 },
  "Barrikade": { color:"#a26d5e", cost:{wood:20}, defense:1, up:1.9, max:3 },
  // Turm braucht 1 Power → wird nur aktiv, wenn genügend Generatorleistung da ist
  "Turm":      { color:"#d07474", cost:{metal:30}, defense:2, power:{need:1}, up:1.9, max:3 }
};
export const BUILD_ORDER = ["Mine","Farm","Forst","Generator","Barrikade","Turm"];

// --- Saves ---
export const SAVE_VERSION = 1;
export const SAVE_KEY = "shelter-core-v1";
export const GAME_VERSION = "core-0.3.0";