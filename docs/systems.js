// Tower-Defense + Scheduler + Stats
import {
  BUILD_DEF as DEF_CONST, LANE_ROW, ENEMY_HP, ENEMY_SPEED_TILES_PER_TICK,
  ENEMY_BASE_DMG, SPAWN_INTERVAL_S, KILL_REWARD_METAL,
  TOWER_RANGE_TILES, TOWER_DMG_PER_TICK,
  ATTACK_MEAN_BASE_S, ATTACK_MEAN_MIN_S, REVEAL_MIN_S, REVEAL_MAX_S,
  COUNTDOWN_JITTER_P, COUNTDOWN_JITTER_S, THREAT_INC, THREAT_DROP_AFTER,
  ATTACK_BASE_MIN, ATTACK_BASE_RAND, ATTACK_THREAT_FACTOR
} from "./config.js";

function lerp(a,b,t){ return a + (b-a)*t; }
function expSample(mean, rand){ const u = Math.max(1e-6, 1 - rand()); return -Math.log(u)*mean; }
function dist(c1,r1, x2,r2){ const dx=(c1 - x2), dy=(r1 - r2); return Math.hypot(dx, dy); }

// --- Produktions-/Power-Stats + aktive Türme bestimmen ---
export function computeStats(state, cfg) {
  const DEF = cfg.BUILD_DEF || DEF_CONST;
  let out = { wood: 0, metal: 0, food: 0 };
  let powerProd = 0, powerNeed = 0, defStatic = 0;

  const turrets = []; // {c,r,need,def}

  for (let r = 0; r < state.grid.length; r++) {
    for (let c = 0; c < state.grid[0].length; c++) {
      const b = state.grid[r][c]; if (!b) continue;
      const d = DEF[b.type]; if (!d) continue;
      const lvl = b.level|0;

      if (d.out) for (const [k, v] of Object.entries(d.out)) out[k] += (v | 0) * lvl;

      if (d.power?.prod) powerProd += (d.power.prod | 0) * lvl;
      if (d.power?.need) { const n=(d.power.need|0)*lvl; powerNeed += n; turrets.push({c,r,need:n}); }

      if (d.defense && !d.power?.need) defStatic += (d.defense | 0) * lvl;
    }
  }

  // aktive Türme (so viele wie Power ausreicht)
  turrets.sort((a,b)=>a.need-b.need);
  let avail=powerProd, activeTurrets=[];
  for(const t of turrets){ if(avail>=t.need){ activeTurrets.push({c:t.c,r:t.r}); avail-=t.need; } }

  return { out, powerProd, powerNeed, powerActive: powerProd-avail, defTotal: defStatic, activeTurrets };
}

// --- Scheduler: nächste Welle planen ---
function scheduleNext(state, cfg, rng){
  const mean0 = cfg.ATTACK_MEAN_BASE_S ?? ATTACK_MEAN_BASE_S;
  const mean1 = cfg.ATTACK_MEAN_MIN_S  ?? ATTACK_MEAN_MIN_S;
  const t = Math.max(0, Math.min(1, (state.threat||0)/100));
  const mean = Math.max(3, lerp(mean0, mean1, t));
  const wait = Math.max(3, Math.floor(expSample(mean, rng)));
  let nextAt = state.t + wait;

  if (nextAt <= (state.graceUntil ?? 0)) nextAt = (state.graceUntil|0) + 3 + Math.floor(rng()*4);

  const rmin = cfg.REVEAL_MIN_S ?? REVEAL_MIN_S;
  const rmax = cfg.REVEAL_MAX_S ?? REVEAL_MAX_S;
  let window = Math.max(2, Math.floor(rmin + (rmax - rmin) * rng()));
  const jp = cfg.COUNTDOWN_JITTER_P ?? COUNTDOWN_JITTER_P;
  const js = cfg.COUNTDOWN_JITTER_S ?? COUNTDOWN_JITTER_S;
  if (rng() < jp) window += (rng()<0.5 ? -js : js);

  state.nextAttackAt = nextAt;
  state.revealAt = Math.max(state.t, nextAt - window);
}

// --- Gegner spawnen & bewegen ---
function spawnEnemy(state){
  state.enemies.push({ x: -1, r: LANE_ROW, hp: ENEMY_HP|0 });
}

function moveEnemiesAndResolve(state, log){
  const reached = [];
  for (const e of state.enemies) {
    e.x += ENEMY_SPEED_TILES_PER_TICK;
    if (e.x >= COLS){ reached.push(e); }
  }
  if (reached.length){
    for(const e of reached){
      state.hp = Math.max(0, state.hp - ENEMY_BASE_DMG);
    }
    state.enemies = state.enemies.filter(e=>!reached.includes(e));
    log(`⚠️ ${reached.length} Gegner am Ziel → −${ENEMY_BASE_DMG*reached.length} Integrität.`);
  }
}

function turretsFire(state, s, cfg, log){
  if (!s.activeTurrets || !s.activeTurrets.length || !state.enemies.length) return;
  const range = (cfg.TOWER_RANGE_TILES ?? TOWER_RANGE_TILES);
  const dmg   = (cfg.TOWER_DMG_PER_TICK ?? TOWER_DMG_PER_TICK);

  for(const t of s.activeTurrets){
    // Ziel: nächster Gegner in Reichweite
    let best=null, bestD=1e9;
    for(const e of state.enemies){
      const d = dist(t.c + 0.5, t.r + 0.5, e.x + 0.5, e.r + 0.5);
      if (d <= range && d < bestD){ best=e; bestD=d; }
    }
    if (best){
      best.hp -= dmg;
      if (best.hp <= 0){
        if (KILL_REWARD_METAL>0) state.res.metal += KILL_REWARD_METAL;
        state.enemies.splice(state.enemies.indexOf(best),1);
      }
    }
  }
}

// --- Haupttick ---
import { COLS } from "./config.js";
export function tickOnce(state, rng, log = () => {}, cfg) {
  state.t++;

  if (state.nextAttackAt == null) scheduleNext(state, cfg, rng);

  const s = computeStats(state, cfg);

  // Ressourcen
  state.res.wood += s.out.wood | 0;
  state.res.metal += s.out.metal | 0;
  state.res.food  += s.out.food  | 0;

  // Bedrohung
  state.threat = Math.min(100, state.threat + (cfg.THREAT_INC ?? THREAT_INC));

  // Welle starten?
  if (state.t >= (state.nextAttackAt ?? Infinity)) {
    const base = (cfg.ATTACK_BASE_MIN ?? ATTACK_BASE_MIN);
    const rand = (cfg.ATTACK_BASE_RAND ?? ATTACK_BASE_RAND);
    const fact = (cfg.ATTACK_THREAT_FACTOR ?? ATTACK_THREAT_FACTOR);
    const r = rng ? rng() : Math.random();
    // Stärke nur fürs Log (Turm-DPS entscheidet), aber wir nutzen sie als Wave-Größe
    const atk = Math.floor(base + r*rand + state.threat*fact);
    state.spawnQueue = Math.max(1, Math.round(3 + state.threat/30)); // einfache Skalierung
    state.lastSpawnAt = null;
    log(`Welle startet (≈${state.spawnQueue} Gegner).`);
    state.threat = Math.max(0, state.threat - (cfg.THREAT_DROP_AFTER ?? THREAT_DROP_AFTER));
    scheduleNext(state, cfg, rng);
  }

  // Gegner schubweise spawnen
  if (state.spawnQueue > 0) {
    if (state.lastSpawnAt == null || state.t - state.lastSpawnAt >= (cfg.SPAWN_INTERVAL_S ?? SPAWN_INTERVAL_S)) {
      spawnEnemy(state);
      state.spawnQueue--;
      state.lastSpawnAt = state.t;
    }
  }

  // Bewegung & Treffer
  moveEnemiesAndResolve(state, log);
  turretsFire(state, s, cfg, log);

  return s;
}