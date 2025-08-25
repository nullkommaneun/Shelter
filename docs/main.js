import { createEngine } from "./engine.js";
import { computeStats, tickOnce } from "./systems.js";
import { newGame, saveLocal, loadLocal, exportSaveString, importSaveString } from "./state.js";
import { makeRNG } from "./rng.js";
import { initDebug } from "./debug.js";
// Robust: Settings als Wildcard importieren + Fallbacks auf config.js
import * as Settings from "./settings.js";
import * as CFG from "./config.js";

// -------- Laufzeit-Config + Fallback --------
function cfgFromDefaults() {
  return {
    TICK_MS: CFG.TICK_MS,
    THREAT_INC: CFG.THREAT_INC,
    THREAT_DROP_AFTER: CFG.THREAT_DROP_AFTER,
    ATTACK_BASE_MIN: CFG.ATTACK_BASE_MIN,
    ATTACK_BASE_RAND: CFG.ATTACK_BASE_RAND,
    ATTACK_THREAT_FACTOR: CFG.ATTACK_THREAT_FACTOR,
    ATTACK_MEAN_BASE_S: CFG.ATTACK_MEAN_BASE_S,
    ATTACK_MEAN_MIN_S: CFG.ATTACK_MEAN_MIN_S,
    REVEAL_MIN_S: CFG.REVEAL_MIN_S,
    REVEAL_MAX_S: CFG.REVEAL_MAX_S,
    GRACE_S: CFG.GRACE_S,
    COUNTDOWN_JITTER_P: CFG.COUNTDOWN_JITTER_P,
    COUNTDOWN_JITTER_S: CFG.COUNTDOWN_JITTER_S,
    BUILD_DEF: CFG.BUILD_DEF,
    BUILD_ORDER: CFG.BUILD_ORDER
  };
}
let cfg = (Settings.getConfig ? Settings.getConfig() : cfgFromDefaults());

// -------- Grid (bewusst fix in dieser Phase) --------
const TILE = 16, COLS = 18, ROWS = 12;
const LOG_W = COLS*TILE, LOG_H = ROWS*TILE;
const DPR = Math.min(window.devicePixelRatio||1, 3);
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha:false });

function resize(){
  canvas.width  = LOG_W * DPR;
  canvas.height = LOG_H * DPR;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.imageSmoothingEnabled = false;
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const maxW = Math.min(vw*0.96, 640), maxH = vh*0.70;
  const scale = Math.max(1, Math.floor(Math.min(maxW/LOG_W, maxH/LOG_H)));
  canvas.style.width  = (LOG_W*scale) + "px";
  canvas.style.height = (LOG_H*scale) + "px";
}
resize(); addEventListener("resize", resize);

// -------- State & RNG --------
let state = newGame();
let rng = makeRNG(state.seed);

// -------- HUD-Refs --------
const rWood   = document.getElementById("rWood");
const rMetal  = document.getElementById("rMetal");
const rFood   = document.getElementById("rFood");
const rPower  = document.getElementById("rPower");
const rDef    = document.getElementById("rDef");
const rThreat = document.getElementById("rThreat");
const rHP     = document.getElementById("rHP");
const rNext   = document.getElementById("rNext");

// -------- UI-Refs --------
const buildSelect = document.getElementById("buildSelect");
const modeBtn   = document.getElementById("modeBtn");
const saveBtn   = document.getElementById("saveBtn");
const loadBtn   = document.getElementById("loadBtn");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const errExportBtn = document.getElementById("errExportBtn");
const cfgBtn    = document.getElementById("cfgBtn");
const resetBtn  = document.getElementById("resetBtn");
const logEl     = document.getElementById("log");

function log(msg){ state.log.push(msg); if(state.log.length>200) state.log.splice(0, state.log.length-200); renderLog(); }
function renderLog(){ logEl.innerHTML = state.log.slice(-7).map(s=>"• "+s).join("<br>"); logEl.scrollTop = logEl.scrollHeight; }
const debug = initDebug({ onLog: (m)=> log(`Fehler: ${m}`) });

// -------- Dropdown & Kosten --------
function BUILD_DEF(){ return cfg.BUILD_DEF; }
function BUILD_ORDER(){ return Array.isArray(cfg.BUILD_ORDER)&&cfg.BUILD_ORDER.length ? cfg.BUILD_ORDER : Object.keys(BUILD_DEF()); }
function levelCost(type, lvl){
  const def = BUILD_DEF()[type]; if(!def) return {};
  const base = (def.cost||{}), f = Math.pow(def.up||1.7, Math.max(0,lvl-1)), out={};
  for(const [k,v] of Object.entries(base)) out[k] = Math.max(1, Math.ceil(v*f));
  return out;
}
function fmtCost(c){ return Object.entries(c).map(([k,v])=>`${v} ${k}`).join(", "); }
function optionLabel(name){ const c=levelCost(name,1); return `${name} (${fmtCost(c)||"0"})`; }
function populateSelect(){
  buildSelect.innerHTML="";
  for(const name of BUILD_ORDER()){
    const opt=document.createElement("option");
    opt.value=name; opt.textContent=optionLabel(name);
    buildSelect.appendChild(opt);
  }
  if (!BUILD_DEF()[state.selected]) state.selected = BUILD_ORDER()[0] || "";
  buildSelect.value = state.selected;
}
populateSelect();

// -------- Settings-Integration (robust) --------
const onConfigChange = (Settings.onConfigChange || ((fn)=>{}));
const openConfigOverlay = (Settings.openConfigOverlay || ( ()=>{ log("Balancing-Menü nicht verfügbar (settings.js fehlt)."); } ));

onConfigChange((newCfg)=>{
  const oldTick = cfg.TICK_MS;
  cfg = newCfg;
  populateSelect();
  log(`Konfiguration angewendet: ${new Date().toLocaleTimeString()}.`);
  if (cfg.TICK_MS !== oldTick) {
    engine.stop();
    engine = createEngine({ onTick, onRender, tickMs: cfg.TICK_MS });
    engine.start();
  }
});

// -------- Buttons --------
buildSelect.onchange = ()=> state.selected = buildSelect.value;
modeBtn.onclick = ()=>{
  state.mode = state.mode==="build" ? "demolish" : "build";
  modeBtn.textContent = state.mode==="build" ? "Modus: Bauen" : "Modus: Abreißen";
};
cfgBtn.onclick = ()=> openConfigOverlay();

// -------- Pointer --------
let hover=null, pressTimer=null, pressHandled=false;
canvas.addEventListener("pointermove", (e)=>{ hover = toCell(e); });
canvas.addEventListener("pointerleave", ()=> hover=null);
canvas.addEventListener("pointerdown", (e)=>{
  const cell = toCell(e); if(!cell) return;
  pressHandled=false;
  pressTimer = setTimeout(()=>{ pressHandled=true; tryUpgrade(cell); }, 550);
});
canvas.addEventListener("pointerup", (e)=>{
  if(pressTimer){ clearTimeout(pressTimer); pressTimer=null; }
  const cell = toCell(e); if(!cell) return;
  if(pressHandled) return;
  if(state.mode==="demolish") doDemolish(cell); else doBuild(cell);
});
function toCell(e){
  const rect=canvas.getBoundingClientRect();
  const x=(e.clientX-rect.left)/rect.width*canvas.width/DPR;
  const y=(e.clientY-rect.top)/rect.height*canvas.height/DPR;
  const c=Math.floor(x/TILE), r=Math.floor(y/TILE);
  return (c>=0&&c<COLS&&r>=0&&r<ROWS)?{c,r}:null;
}

// -------- Build/Upgrade/Demolish --------
function canAfford(cost){ return Object.entries(cost).every(([k,v]) => (state.res[k]??0) >= v); }
function pay(cost){ for(const [k,v] of Object.entries(cost)) state.res[k]=(state.res[k]??0)-v; }
function refund(cost, ratio=0.5){ for(const [k,v] of Object.entries(cost)) state.res[k]=(state.res[k]??0)+Math.floor(v*ratio); }
function doBuild({c,r}){
  const b=state.grid[r][c];
  if(b){ log(`Feld belegt (${b.type}). Langer Druck: Upgrade · Abreißen-Modus: Entfernen.`); return; }
  const sel=state.selected, cost=levelCost(sel,1);
  if(!canAfford(cost)){ log(`Zu teuer: ${sel} kostet ${fmtCost(cost)}.`); return; }
  pay(cost); state.grid[r][c]={type:sel, level:1}; log(`${sel} gebaut.`);
}
function doDemolish({c,r}){
  const b=state.grid[r][c]; if(!b){ log(`Nichts zu entfernen.`); return; }
  refund(levelCost(b.type,b.level), 0.5); state.grid[r][c]=null; log(`${b.type} entfernt (+50 % Rückerstattung).`);
}
function tryUpgrade({c,r}){
  const b=state.grid[r][c]; if(!b) return;
  const d=BUILD_DEF()[b.type]; if(!d) return;
  if(b.level>=d.max){ log(`${b.type} ist bereits Max-Level.`); return; }
  const cost=levelCost(b.type,b.level+1);
  if(!canAfford(cost)){ log(`Upgrade zu teuer: ${fmtCost(cost)}.`); return; }
  pay(cost); b.level++; log(`${b.type} → Level ${b.level}.`);
}

// -------- Save/Load/Export/Import --------
saveBtn.onclick = ()=>{ saveLocal(state) ? log("Spielstand gespeichert.") : log("Speichern fehlgeschlagen."); };
loadBtn.onclick = ()=>{
  const s = loadLocal();
  if(!s){ log("Kein Speicherstand gefunden."); return; }
  state = s; rng = makeRNG(state.seed); populateSelect(); renderLog(); log("Spielstand geladen.");
};
resetBtn.onclick = ()=>{ state = newGame(); rng = makeRNG(state.seed); populateSelect(); renderLog(); log("Neues Spiel gestartet."); };
exportBtn.onclick = async ()=>{
  const txt = exportSaveString(state);
  try { await navigator.clipboard.writeText(txt); log("Export in Zwischenablage."); }
  catch { prompt("Export-Text kopieren:", txt); }
};
importBtn.onclick = async ()=>{
  const input = prompt("Import-Text einfügen (SV|…|BASE64):",""); if(!input) return;
  const s = importSaveString(input.trim());
  if(!s){ log("Import fehlgeschlagen."); return; }
  state = s; rng = makeRNG(state.seed); populateSelect(); renderLog(); log("Import ok.");
};

// -------- Render & Engine --------
function render(){
  // Hintergrund & Raster
  ctx.fillStyle="#0b1520"; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle="#143049"; ctx.lineWidth=1;
  for(let x=0;x<=COLS;x++){ ctx.beginPath(); ctx.moveTo(x*TILE,0); ctx.lineTo(x*TILE,ROWS*TILE); ctx.stroke(); }
  for(let y=0;y<=ROWS;y++){ ctx.beginPath(); ctx.moveTo(0,y*TILE); ctx.lineTo(COLS*TILE,y*TILE); ctx.stroke(); }

  // Gebäude
  const DEF = BUILD_DEF();
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const b=state.grid[r][c]; if(!b) continue;
    const x=c*TILE, y=r*TILE, d=DEF[b.type]; if(!d) continue;
    ctx.fillStyle=d.color; ctx.fillRect(x+1,y+1,TILE-2,TILE-2);
    ctx.strokeStyle="#0b1520"; ctx.strokeRect(x+3,y+3,TILE-6,TILE-6);
    ctx.fillStyle="#ffffff"; for(let i=0;i<b.level;i++) ctx.fillRect(x+3+i*4, y+TILE-5, 3,3);
    ctx.fillStyle="#081018"; ctx.font="bold 8px monospace"; ctx.fillText(b.type[0], x+TILE/2-3, y+TILE/2+3);
  }

  // HUD inkl. Power & Countdown
  const s = computeStats(state, cfg);
  const need = s.powerNeed|0, prod = s.powerProd|0, active = s.powerActive|0;
  rWood.textContent   = `Holz: ${state.res.wood}`;
  rMetal.textContent  = `Metall: ${state.res.metal}`;
  rFood.textContent   = `Nahrung: ${state.res.food}`;
  rPower.textContent  = `Strom: ${active}/${prod} (Need ${need})`;
  if (need > prod) rPower.classList.add("warn"); else rPower.classList.remove("warn");
  rDef.textContent    = `Verteid.: ${s.defTotal}`;
  rThreat.textContent = `Bedrohung: ${Math.round(state.threat)}%`;
  rHP.textContent     = `Integrität: ${Math.max(0,Math.round(state.hp))}%`;

  // Countdown-Chip (Reveal-Fenster)
  const showCountdown = (state.revealAt!=null) && (state.t >= state.revealAt) && (state.t < (state.nextAttackAt||0));
  if (showCountdown) {
    const rem = Math.max(0, (state.nextAttackAt|0) - state.t);
    const mm = Math.floor(rem/60).toString().padStart(2,"0");
    const ss = Math.floor(rem%60).toString().padStart(2,"0");
    rNext.textContent = `Angriff: ${mm}:${ss}`;
    rNext.hidden = false;
  } else {
    rNext.hidden = true;
  }
}

function onTick(){ tickOnce(state, rng, log, cfg); if(state.hp<=0) engine.stop(); }
function onRender(){ render(); }

let engine = createEngine({ onTick, onRender, tickMs: cfg.TICK_MS });
renderLog();
engine.start();