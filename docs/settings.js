// docs/settings.js
// Presets + aktuelle Config + Overlay-UI + Export/Import (CF|cfg-v1.0|…)
import {
  TILE as D_TILE, COLS as D_COLS, ROWS as D_ROWS, TICK_MS as D_TICK_MS,
  THREAT_INC as D_TI, THREAT_DROP_AFTER as D_TD,
  ATTACK_BASE_MIN as D_ABMIN, ATTACK_BASE_RAND as D_ABR, ATTACK_THREAT_FACTOR as D_ATF,
  ATTACK_MEAN_BASE_S as D_AMB, ATTACK_MEAN_MIN_S as D_AMN,
  REVEAL_MIN_S as D_RMIN, REVEAL_MAX_S as D_RMAX,
  GRACE_S as D_GRACE, COUNTDOWN_JITTER_P as D_JP, COUNTDOWN_JITTER_S as D_JS,
  START_RES as D_START, BUILD_DEF as D_BUILD_DEF, BUILD_ORDER as D_ORDER
} from "./config.js";

const CFG_VERSION = "cfg-v1.0";
const LS_KEY = "shelter-config-v1";

const clone = (o)=> JSON.parse(JSON.stringify(o));
const clampInt = (n)=> Math.max(0, Math.round(n));

function defaults(){
  return {
    TILE: D_TILE, COLS: D_COLS, ROWS: D_ROWS, TICK_MS: D_TICK_MS,
    THREAT_INC: D_TI, THREAT_DROP_AFTER: D_TD,
    ATTACK_BASE_MIN: D_ABMIN, ATTACK_BASE_RAND: D_ABR, ATTACK_THREAT_FACTOR: D_ATF,
    ATTACK_MEAN_BASE_S: D_AMB, ATTACK_MEAN_MIN_S: D_AMN,
    REVEAL_MIN_S: D_RMIN, REVEAL_MAX_S: D_RMAX,
    GRACE_S: D_GRACE, COUNTDOWN_JITTER_P: D_JP, COUNTDOWN_JITTER_S: D_JS,
    START_RES: clone(D_START),
    BUILD_DEF: clone(D_BUILD_DEF),
    BUILD_ORDER: clone(D_ORDER)
  };
}
function scaleBuildings(cfg, { cost=1, out=1, powerProd=1, powerNeed=1, defense=1 }) {
  const c = clone(cfg);
  for (const [name, def] of Object.entries(c.BUILD_DEF)) {
    if (def.cost) for (const k of Object.keys(def.cost)) def.cost[k] = clampInt(def.cost[k]*cost) || 1;
    if (def.out)  for (const k of Object.keys(def.out))  def.out[k]  = clampInt(def.out[k]*out);
    if (def.power?.prod) def.power.prod = clampInt(def.power.prod*powerProd);
    if (def.power?.need) def.power.need = clampInt(def.power.need*powerNeed);
    if (def.defense) def.defense = clampInt(def.defense*defense);
  }
  return c;
}
function presetDefault(){ return defaults(); }
function presetEasy(){
  const c = defaults();
  c.THREAT_INC = +(c.THREAT_INC*0.8).toFixed(2);
  c.ATTACK_MEAN_BASE_S = Math.max(10, c.ATTACK_MEAN_BASE_S + 6);
  c.REVEAL_MIN_S = Math.max(4, c.REVEAL_MIN_S - 1);
  c.REVEAL_MAX_S = c.REVEAL_MAX_S + 1;
  return scaleBuildings(c, { cost:0.7, out:1.2, powerNeed:0.9 });
}
function presetHard(){
  const c = defaults();
  c.THREAT_INC = +(c.THREAT_INC*1.5).toFixed(2);
  c.ATTACK_MEAN_MIN_S = Math.max(6, c.ATTACK_MEAN_MIN_S - 4);
  c.REVEAL_MIN_S = Math.max(5, c.REVEAL_MIN_S + 1);
  return scaleBuildings(c, { cost:1.3, out:0.9, powerNeed:1.1, defense:0.9 });
}
const PRESETS = { "Default": presetDefault, "Easy": presetEasy, "Hard": presetHard };

// --- aktueller Zustand + Events ---
let current = loadSaved() || { name:"Default", cfg: presetDefault() };
const listeners = [];
function emit(){ for(const fn of listeners) try{ fn(getConfig()); }catch{} }

// --- API (Exports) ---
export function getConfig(){ return clone(current.cfg); }
export function onConfigChange(fn){ listeners.push(fn); }   // <- wichtig!
export function setPreset(name){
  const maker = PRESETS[name] || PRESETS["Default"];
  current = { name, cfg: maker() };
  save(); emit();
}
export function exportConfigText(){
  const raw = JSON.stringify({ name: current.name, cfg: current.cfg, version: CFG_VERSION });
  return `CF|${CFG_VERSION}|${Date.now()}|${toB64(raw)}`;
}
export function importConfigText(text){
  try{
    const parts = text.split("|");
    const b64 = parts.length>=4 ? parts[3] : text;
    const raw = fromB64(b64);
    const obj = JSON.parse(raw);
    if(!obj || !obj.cfg) throw new Error("Ungültiges Config-Objekt");
    current = { name: obj.name || "Imported", cfg: sanitizeCfg(obj.cfg) };
    save(); emit(); return true;
  }catch{ return false; }
}

// --- Helpers ---
function sanitizeCfg(cfg){
  const d = defaults(); const out = defaults();
  out.TICK_MS = num(cfg.TICK_MS, d.TICK_MS);
  out.THREAT_INC = numF(cfg.THREAT_INC, d.THREAT_INC);
  out.THREAT_DROP_AFTER = num(cfg.THREAT_DROP_AFTER, d.THREAT_DROP_AFTER);
  out.ATTACK_BASE_MIN = num(cfg.ATTACK_BASE_MIN, d.ATTACK_BASE_MIN);
  out.ATTACK_BASE_RAND = num(cfg.ATTACK_BASE_RAND, d.ATTACK_BASE_RAND);
  out.ATTACK_THREAT_FACTOR = numF(cfg.ATTACK_THREAT_FACTOR, d.ATTACK_THREAT_FACTOR);
  out.ATTACK_MEAN_BASE_S = num(cfg.ATTACK_MEAN_BASE_S, d.ATTACK_MEAN_BASE_S);
  out.ATTACK_MEAN_MIN_S  = num(cfg.ATTACK_MEAN_MIN_S,  d.ATTACK_MEAN_MIN_S);
  out.REVEAL_MIN_S = num(cfg.REVEAL_MIN_S, d.REVEAL_MIN_S);
  out.REVEAL_MAX_S = num(cfg.REVEAL_MAX_S, d.REVEAL_MAX_S);
  out.GRACE_S = num(cfg.GRACE_S, d.GRACE_S);
  out.COUNTDOWN_JITTER_P = numF(cfg.COUNTDOWN_JITTER_P, d.COUNTDOWN_JITTER_P);
  out.COUNTDOWN_JITTER_S = num(cfg.COUNTDOWN_JITTER_S, d.COUNTDOWN_JITTER_S);

  if (cfg.START_RES) {
    out.START_RES.wood = num(cfg.START_RES.wood, d.START_RES.wood);
    out.START_RES.metal = num(cfg.START_RES.metal, d.START_RES.metal);
    out.START_RES.food  = num(cfg.START_RES.food,  d.START_RES.food);
  }
  if (cfg.BUILD_DEF) {
    out.BUILD_DEF = clone(d.BUILD_DEF);
    for (const [k,v] of Object.entries(cfg.BUILD_DEF)) {
      if (!out.BUILD_DEF[k]) continue;
      const t = out.BUILD_DEF[k];
      if (v.cost) for (const c of Object.keys(v.cost)) if (t.cost?.[c]!=null) t.cost[c]=num(v.cost[c], t.cost[c]);
      if (v.out)  for (const o of Object.keys(v.out)) if (t.out?.[o]!=null) t.out[o]=num(v.out[o], t.out[o]);
      if (v.power?.prod!=null && t.power) t.power.prod = num(v.power.prod, t.power.prod);
      if (v.power?.need!=null && t.power) t.power.need = num(v.power.need, t.power.need);
      if (v.defense!=null) t.defense = num(v.defense, t.defense);
      if (v.up!=null) t.up = +v.up;
      if (v.max!=null) t.max = num(v.max, t.max)||1;
    }
  }
  if (Array.isArray(cfg.BUILD_ORDER)) out.BUILD_ORDER = cfg.BUILD_ORDER.filter(n => out.BUILD_DEF[n]);
  return out;
}
function num(v, d){ return (typeof v==='number' && isFinite(v)) ? Math.round(v) : d; }
function numF(v, d){ return (typeof v==='number' && isFinite(v)) ? +v : d; }

export function openConfigOverlay(){
  const cfg = getConfig();
  const el = document.createElement("div");
  el.id = "cfg-overlay";
  el.innerHTML = `
  <style>
    #cfg-overlay{position:fixed;inset:0;background:rgba(5,10,16,.72);backdrop-filter:saturate(1.1) blur(2px);z-index:99998;
      display:flex;align-items:center;justify-content:center;padding:10px;}
    #cfg-card{width:min(860px,96vw);max-height:92vh;overflow:auto;background:#0d1f31;border:1px solid #2a4a68;border-radius:12px;
      color:#e6f2ff;font:13px/1.35 system-ui, sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.45);}
    #cfg-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px;border-bottom:1px solid #2a4a68}
    #cfg-body{padding:10px;display:grid;gap:10px}
    #cfg-grid{display:grid;grid-template-columns: 1fr 1fr; gap:8px}
    #cfg-actions{display:flex;gap:8px;flex-wrap:wrap}
    select,button,textarea{background:#17324a;color:#cfe6ff;border:1px solid #335a7e;border-radius:8px;padding:6px 10px}
    textarea{min-height:100px;resize:vertical}
    .tag{background:#10263a;border:1px solid #2a4a68;border-radius:8px;padding:4px 6px;display:inline-block;margin:2px 4px 0 0}
    .muted{opacity:.85}
  </style>
  <div id="cfg-card" role="dialog" aria-modal="true" aria-label="Balancing">
    <div id="cfg-head">
      <strong>Balancing / Presets</strong>
      <button id="cfg-close">Schließen</button>
    </div>
    <div id="cfg-body">
      <div>
        <label for="cfg-preset">Preset:</label>
        <select id="cfg-preset">
          ${["Default","Easy","Hard"].map(n=>`<option value="${n}" ${n===current.name?'selected':''}>${n}</option>`).join("")}
        </select>
      </div>
      <div id="cfg-grid">
        <div><span class="tag">Threat +/s:</span> ${cfg.THREAT_INC}</div>
        <div><span class="tag">Ø Pause (0→100):</span> ${cfg.ATTACK_MEAN_BASE_S}→${cfg.ATTACK_MEAN_MIN_S}s</div>
        <div><span class="tag">Reveal:</span> ${cfg.REVEAL_MIN_S}–${cfg.REVEAL_MAX_S}s</div>
        <div><span class="tag">Grace:</span> ${cfg.GRACE_S}s</div>
      </div>
      <details>
        <summary>Export/Import</summary>
        <div id="cfg-actions">
          <button id="cfg-export">Config exportieren</button>
          <button id="cfg-import">Config importieren</button>
        </div>
        <textarea id="cfg-text" placeholder="CF|cfg-v1.0|… oder Roh-JSON"></textarea>
      </details>
      <div id="cfg-actions">
        <button id="cfg-apply">Anwenden</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(el);
  el.querySelector("#cfg-close").onclick = ()=> el.remove();
  el.querySelector("#cfg-apply").onclick = ()=>{
    const name = el.querySelector("#cfg-preset").value;
    setPreset(name);
    el.remove();
  };
  el.querySelector("#cfg-export").onclick = async ()=>{
    const txt = exportConfigText();
    try { await navigator.clipboard.writeText(txt); el.querySelector("#cfg-text").value = txt; }
    catch { el.querySelector("#cfg-text").value = txt; }
  };
  el.querySelector("#cfg-import").onclick = ()=>{
    const input = el.querySelector("#cfg-text").value.trim();
    if(!input) return;
    const ok = input.startsWith("CF|") ? importConfigText(input) : (()=>{ try{
      const raw = JSON.parse(input); current={name:raw.name||"Imported", cfg:sanitizeCfg(raw.cfg||raw)}; save(); emit(); return true;
    }catch{ return false; }})();
    el.querySelector("#cfg-text").value = ok ? "Import OK" : "Import fehlgeschlagen";
  };
}

// --- Storage & Base64 ---
function save(){ try{ localStorage.setItem(LS_KEY, JSON.stringify({ name: current.name, cfg: current.cfg })); }catch{} }
function loadSaved(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return null;
    const obj = JSON.parse(raw);
    if(!obj || !obj.cfg) return null;
    return { name: obj.name || "Saved", cfg: sanitizeCfg(obj.cfg) };
  }catch{ return null; }
}
function toB64(str){ try { return btoa(unescape(encodeURIComponent(str))); } catch { try { return btoa(str); } catch { return "(b64_failed)"; } } }
function fromB64(b){ try { return decodeURIComponent(escape(atob(b))); } catch { return atob(b); } }