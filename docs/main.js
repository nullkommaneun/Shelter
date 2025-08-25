import { TILE, COLS, ROWS, BUILD_DEF as DEF, BUILD_ORDER } from "./config.js";
import { createEngine } from "./engine.js";
import { computeStats, tickOnce } from "./systems.js";
import { newGame, saveLocal, loadLocal, exportSaveString, importSaveString } from "./state.js";
import { makeRNG } from "./rng.js";
import { initDebug } from "./debug.js";

// ---------- Canvas & Pixel-Perfect ----------
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

// ---------- State & RNG ----------
let state = newGame();
let rng = makeRNG(state.seed);

// ---------- UI ----------
const rWood   = document.getElementById("rWood");
const rMetal  = document.getElementById("rMetal");
const rFood   = document.getElementById("rFood");
const rPower  = document.getElementById("rPower");
const rDef    = document.getElementById("rDef");
const rThreat = document.getElementById("rThreat");
const rHP     = document.getElementById("rHP");

const buildSelect = document.getElementById("buildSelect");
const modeBtn   = document.getElementById("modeBtn");
const saveBtn   = document.getElementById("saveBtn");
const loadBtn   = document.getElementById("loadBtn");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const errExportBtn = document.getElementById("errExportBtn");
const resetBtn  = document.getElementById("resetBtn");
const logEl     = document.getElementById("log");
const msgEl     = document.getElementById("msg");

function log(msg){ state.log.push(msg); if(state.log.length>200) state.log.splice(0, state.log.length-200); renderLog(); }
function renderLog(){ logEl.innerHTML = state.log.slice(-7).map(s=>"• "+s).join("<br>"); logEl.scrollTop = logEl.scrollHeight; }

// Debug-Logger initialisieren (schreibt auch ins In-Game-Log)
const debug = initDebug({ onLog: (m)=> log(`Fehler: ${m}`) });

// Dropdown füllen
function levelCost(type, lvl){
  const base = (DEF[type].cost||{}), f = Math.pow(DEF[type].up||1.7, lvl-1), out={};
  for(const [k,v] of Object.entries(base)) out[k]=Math.ceil(v*f);
  return out;
}
function fmtCost(c){ return Object.entries(c).map(([k,v])=>`${v} ${k}`).join(", "); }
function optionLabel(name){ const c=levelCost(name,1); return `${name} (${fmtCost(c)||"0"})`; }
function populateSelect(){
  buildSelect.innerHTML="";
  for(const name of BUILD_ORDER){
    const opt=document.createElement("option");
    opt.value=name; opt.textContent=optionLabel(name);
    buildSelect.appendChild(opt);
  }
  buildSelect.value = state.selected;
}
populateSelect();

buildSelect.onchange = ()=> state.selected = buildSelect.value;
modeBtn.onclick = ()=>{
  state.mode = state.mode==="build" ? "demolish" : "build";
  modeBtn.textContent = state.mode==="build" ? "Modus: Bauen" : "Modus: Abreißen";
};

// ---------- Pointer (Tap / Long-Press) ----------
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

// ---------- Build/Upgrade/Demolish ----------
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
  const d=DEF[b.type]; if(b.level>=d.max){ log(`${b.type} ist bereits Max-Level.`); return; }
  const cost=levelCost(b.type,b.level+1);
  if(!canAfford(cost)){ log(`Upgrade zu teuer: ${fmtCost(cost)}.`); return; }
  pay(cost); b.level++; log(`${b.type} → Level ${b.level}.`);
}

// ---------- Save/Load/Export/Import ----------
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
  const input = prompt("Import-Text einfügen (SV|…|BASE64):","");
  if(!input) return;
  const s = importSaveString(input.trim());
  if(!s){ log("Import fehlgeschlagen."); return; }
  state = s; rng = makeRNG(state.seed); populateSelect(); renderLog(); log("Import ok.");
};

// ---------- Fehlerlog-Export ----------
errExportBtn.onclick = async ()=>{
  const txt = debug.exportText();
  try { await navigator.clipboard.writeText(txt); log("Fehlerlog in Zwischenablage."); }
  catch { prompt("Fehlerlog kopieren:", txt); }
};

// ---------- Render & Engine ----------
function render(){
  // Hintergrund & Raster
  ctx.fillStyle="#0b1520"; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle="#143049"; ctx.lineWidth=1;
  for(let x=0;x<=COLS;x++){ ctx.beginPath(); ctx.moveTo(x*TILE,0); ctx.lineTo(x*TILE,ROWS*TILE); ctx.stroke(); }
  for(let y=0;y<=ROWS;y++){ ctx.beginPath(); ctx.moveTo(0,y*TILE); ctx.lineTo(COLS*TILE,y*TILE); ctx.stroke(); }

  // Gebäude
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const b=state.grid[r][c]; if(!b) continue;
    const x=c*TILE, y=r*TILE, d=DEF[b.type];
    ctx.fillStyle=d.color; ctx.fillRect(x+1,y+1,TILE-2,TILE-2);
    ctx.strokeStyle="#0b1520"; ctx.strokeRect(x+3,y+3,TILE-6,TILE-6);
    ctx.fillStyle="#ffffff"; for(let i=0;i<b.level;i++) ctx.fillRect(x+3+i*4, y+TILE-5, 3,3);
    ctx.fillStyle="#081018"; ctx.font="bold 8px monospace"; ctx.fillText(b.type[0], x+TILE/2-3, y+TILE/2+3);
  }

  // Hover
  if(hover){ const x=hover.c*TILE, y=hover.r*TILE; ctx.strokeStyle="#8fd1ff"; ctx.strokeRect(x+0.5,y+0.5,TILE-1,TILE-1); }

  // HUD
  const s = computeStats(state);
  rWood.textContent   = `Holz: ${state.res.wood}`;
  rMetal.textContent  = `Metall: ${state.res.metal}`;
  rFood.textContent   = `Nahrung: ${state.res.food}`;
  rPower.textContent  = `Strom: ${s.powerActive}/${s.powerProd}`;
  rDef.textContent    = `Verteid.: ${s.defTotal}`;
  rThreat.textContent = `Bedrohung: ${Math.round(state.threat)}%`;
  rHP.textContent     = `Integrität: ${Math.max(0,Math.round(state.hp))}%`;
}

const engine = createEngine({
  onTick: ()=>{ tickOnce(state, rng, log); if(state.hp<=0) engine.stop(); },
  onRender: ()=>{ render(); }
});
renderLog();
engine.start();