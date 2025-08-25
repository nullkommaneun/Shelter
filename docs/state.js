import { COLS, ROWS, START_RES, SAVE_KEY, SAVE_VERSION, GRACE_S } from "./config.js";

function emptyGrid(rows=ROWS, cols=COLS){
  return Array.from({length: rows}, ()=>Array.from({length: cols}, ()=>null));
}
function randomSeed(){
  try { return crypto.getRandomValues(new Uint32Array(1))[0]>>>0; }
  catch { return Math.floor(Math.random()*0xFFFFFFFF)>>>0; }
}

export function newGame(){
  return {
    grid: emptyGrid(),
    res: { ...START_RES },
    t: 0,
    threat: 0,
    hp: 100,
    selected: "Mine",
    mode: "build",
    log: ["Willkommen! Baue Produktion auf, dann Verteidigung. Lange drücken = Upgrade."],
    seed: randomSeed(),
    ver: SAVE_VERSION,
    // Scheduler
    nextAttackAt: null,
    revealAt: null,
    graceUntil: (GRACE_S|0),
    // TD
    enemies: [],          // {x: float, r: int, hp: int}
    spawnQueue: 0,
    lastSpawnAt: null
  };
}

export function toSave(state){
  const {grid,res,t,threat,hp,selected,mode,seed,ver,
         nextAttackAt,revealAt,graceUntil,enemies,spawnQueue,lastSpawnAt} = state;
  return {grid,res,t,threat,hp,selected,mode,seed,ver,
          nextAttackAt,revealAt,graceUntil,enemies,spawnQueue,lastSpawnAt};
}
export function fromSave(obj){
  const s = newGame();
  try{
    if(Array.isArray(obj.grid)) s.grid = sanitizeGrid(obj.grid, s.grid.length, s.grid[0].length);
    if(obj.res) s.res = {...s.res,...obj.res};
    if(typeof obj.t==='number') s.t=obj.t;
    if(typeof obj.threat==='number') s.threat=obj.threat;
    if(typeof obj.hp==='number') s.hp=obj.hp;
    if(obj.selected) s.selected=obj.selected;
    if(obj.mode) s.mode=obj.mode;
    if(obj.seed!=null) s.seed=obj.seed>>>0;

    if(obj.nextAttackAt!=null) s.nextAttackAt = obj.nextAttackAt|0;
    if(obj.revealAt!=null)     s.revealAt     = obj.revealAt|0;
    if(obj.graceUntil!=null)   s.graceUntil   = obj.graceUntil|0;

    if(Array.isArray(obj.enemies)) s.enemies = obj.enemies.map(e=>({
      x: +e.x||0, r: (e.r|0), hp: (e.hp|0)
    }));
    if(typeof obj.spawnQueue==='number') s.spawnQueue = obj.spawnQueue|0;
    if(typeof obj.lastSpawnAt==='number' || obj.lastSpawnAt===null) s.lastSpawnAt = obj.lastSpawnAt;
  }catch{}
  return s;
}

function sanitizeGrid(g, rows, cols){
  const clean = emptyGrid(rows, cols);
  for(let r=0;r<Math.min(rows,g.length);r++){
    for(let c=0;c<Math.min(cols,g[r].length);c++){
      const b=g[r][c];
      if(b && typeof b.type==='string' && typeof b.level==='number'){
        clean[r][c]={ type:b.type, level: Math.max(1, Math.min(9, Math.floor(b.level))) };
      }
    }
  }
  return clean;
}

export function saveLocal(state, key=SAVE_KEY){
  try{ localStorage.setItem(key, JSON.stringify(toSave(state))); return true; }catch{ return false; }
}
export function loadLocal(key=SAVE_KEY){
  try{
    const raw = localStorage.getItem(key); if(!raw) return null;
    const obj = JSON.parse(raw); return fromSave(obj);
  }catch{ return null; }
}

function toB64(s){ try { return btoa(unescape(encodeURIComponent(s))); } catch { try { return btoa(s); } catch { return s; } } }
function fromB64(b){ try { return decodeURIComponent(escape(atob(b))); } catch { return atob(b); } }

export function exportSaveString(state){
  const raw = JSON.stringify(toSave(state));
  return `SV|${SAVE_VERSION}|${Date.now()}|${toB64(raw)}`;
}
export function importSaveString(text){
  try{
    const parts = text.split("|");
    const b64 = parts.length>=4 ? parts[3] : text;
    const raw = fromB64(b64);
    const obj = JSON.parse(raw);
    return fromSave(obj);
  }catch{ return null; }
}