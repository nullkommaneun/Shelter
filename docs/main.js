// ====== Setup (16x16 Pixel, Pixel-Perfect Scaling) ======
const COLS = 18, ROWS = 12, TILE = 16;
const LOG_W = COLS * TILE, LOG_H = ROWS * TILE;
const DPR = Math.min(window.devicePixelRatio || 1, 3);

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha:false });

function resize(){
  // Interne Auflösung
  canvas.width  = LOG_W * DPR;
  canvas.height = LOG_H * DPR;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.imageSmoothingEnabled = false;

  // Integeres CSS-Scaling (knackscharfe Pixel)
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const maxW = Math.min(vw * 0.96, 640);
  const maxH = vh * 0.70;
  const scaleFloat = Math.min(maxW / LOG_W, maxH / LOG_H);
  const scale = Math.max(1, Math.floor(scaleFloat));
  canvas.style.width  = (LOG_W * scale) + "px";
  canvas.style.height = (LOG_H * scale) + "px";
}
resize(); addEventListener('resize', resize);

// ====== Spiel-Definitionen ======
const DEF = {
  "Mine":      { color:"#7aa8a1", cost:{wood:10}, out:{metal:1}, up:1.7, max:3 },
  "Farm":      { color:"#7fbf6d", cost:{wood:15}, out:{food:1}, up:1.7, max:3 },
  "Forst":     { color:"#b2925a", cost:{food:5},  out:{wood:1}, up:1.7, max:3 },
  "Generator": { color:"#6f86d6", cost:{metal:20}, power:{prod:1}, up:1.8, max:3 },
  "Barrikade": { color:"#a26d5e", cost:{wood:20}, defense:1, up:1.9, max:3 },
  "Turm":      { color:"#d07474", cost:{metal:30}, defense:2, power:{need:1}, up:1.9, max:3 }
};
const BUILD_ORDER = ["Mine","Farm","Forst","Generator","Barrikade","Turm"];

// ====== Spielzustand ======
const SAVE_KEY = "shelter-v3-16px-build";
function newGame(){
  return {
    grid: Array.from({length:ROWS}, ()=>Array.from({length:COLS}, ()=>null)),
    res: {wood:40, metal:10, food:10},
    t:0, threat:0, hp:100,
    selected:"Mine", mode:"build",
    log:["Willkommen! Baue Produktion auf, dann Verteidigung. Lange drücken = Upgrade."],
  };
}
let state = newGame();

// ====== UI-Elemente ======
const rWood = document.getElementById('rWood');
const rMetal = document.getElementById('rMetal');
const rFood  = document.getElementById('rFood');
const rPower = document.getElementById('rPower');
const rDef   = document.getElementById('rDef');
const rThreat= document.getElementById('rThreat');
const rHP    = document.getElementById('rHP');

const barEl = document.getElementById('bar');
const modeBtn = document.getElementById('modeBtn');
const saveBtn = document.getElementById('saveBtn');
const loadBtn = document.getElementById('loadBtn');
const resetBtn= document.getElementById('resetBtn');
const logEl   = document.getElementById('log');
const msgEl   = document.getElementById('msg');

// ====== Utilities ======
function log(msg){ state.log.push(msg); if(state.log.length>200) state.log.splice(0, state.log.length-200); renderLog(); }
function renderLog(){
  logEl.innerHTML = state.log.slice(-7).map(s=>"• "+s).join("<br>");
  logEl.scrollTop = logEl.scrollHeight;
}
function canAfford(cost){ return Object.entries(cost).every(([k,v]) => (state.res[k]??0) >= v); }
function pay(cost){ for(const [k,v] of Object.entries(cost)) state.res[k]=(state.res[k]??0)-v; }
function refund(cost, ratio=0.5){ for(const [k,v] of Object.entries(cost)) state.res[k]=(state.res[k]??0)+Math.floor(v*ratio); }
function levelCost(type, lvl){
  const base = DEF[type].cost || {};
  const factor = Math.pow(DEF[type].up || 1.7, lvl-1);
  const c={}; for(const [k,v] of Object.entries(base)) c[k]=Math.ceil(v*factor);
  return c;
}
function fmtCost(c){ return Object.entries(c).map(([k,v])=>`${v} ${k}`).join(", "); }
function forEachBuilding(fn){
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const b = state.grid[r][c]; if(b) fn(b,c,r);
  }
}
function getOutputsAndDefense(){
  let out = {wood:0, metal:0, food:0};
  let powerProd=0, powerNeed=0, defStatic=0, turrets=[];
  forEachBuilding((b)=>{
    const d=DEF[b.type], lvl=b.level;
    if(d.out) for(const [k,v] of Object.entries(d.out)) out[k]+=v*lvl;
    if(d.power?.prod) powerProd += d.power.prod * lvl;
    if(d.power?.need){ powerNeed += d.power.need * lvl; turrets.push({def:(d.defense||0)*lvl, need:(d.power.need||0)*lvl}); }
    if(d.defense && !d.power?.need) defStatic += d.defense * lvl;
  });
  turrets.sort((a,b)=>a.need-b.need);
  let avail = powerProd, defFromTurrets=0;
  for(const t of turrets) if(avail>=t.need){ defFromTurrets+=t.def; avail-=t.need; }
  return { out, powerProd, powerNeed, defTotal: defStatic+defFromTurrets, powerActive: powerProd-avail };
}

// ====== Bau-Leiste ======
function labelFor(name,lvl=1){
  const c = levelCost(name,lvl);
  return `${name} (${fmtCost(c)||"0"})`;
}
function buildBar(){
  barEl.innerHTML="";
  for(const name of BUILD_ORDER){
    const btn=document.createElement('button');
    btn.textContent = labelFor(name, 1);
    btn.id = "btn-"+name;
    btn.onclick = ()=>{ state.selected=name; updateBarActive(); };
    barEl.appendChild(btn);
  }
  updateBarActive();
}
function updateBarActive(){
  for(const name of BUILD_ORDER){
    const el = document.getElementById('btn-'+name);
    if(el) el.classList.toggle('active', state.selected===name);
  }
}
buildBar();

modeBtn.onclick = ()=>{
  state.mode = (state.mode==="build") ? "demolish" : "build";
  modeBtn.dataset.mode = state.mode;
  modeBtn.textContent = state.mode==="build" ? "Modus: Bauen" : "Modus: Abreißen";
};

// ====== Pointer-Input (Tap/Long-Press) ======
let hover=null, pressTimer=null, pressHandled=false;
canvas.addEventListener('pointermove', (e)=>{ hover = toCell(e); });
canvas.addEventListener('pointerleave', ()=> hover=null);
canvas.addEventListener('pointerdown', (e)=>{
  const cell = toCell(e); if(!cell) return;
  pressHandled=false;
  // Long-Press erkennt Upgrade
  pressTimer = setTimeout(()=>{ pressHandled=true; tryUpgrade(cell); }, 550);
});
canvas.addEventListener('pointerup', (e)=>{
  if(pressTimer){ clearTimeout(pressTimer); pressTimer=null; }
  const cell = toCell(e); if(!cell) return;
  if(pressHandled) return; // Upgrade war schon dran
  if(state.mode==="demolish") doDemolish(cell);
  else doBuild(cell);
});

function toCell(e){
  const rect=canvas.getBoundingClientRect();
  const x=(e.clientX-rect.left)/rect.width*canvas.width/DPR;
  const y=(e.clientY-rect.top)/rect.height*canvas.height/DPR;
  const c=Math.floor(x/TILE), r=Math.floor(y/TILE);
  return (c>=0&&c<COLS&&r>=0&&r<ROWS)?{c,r}:null;
}

function doBuild({c,r}){
  const b = state.grid[r][c];
  if(b){ log(`Feld belegt (${b.type}). Langer Druck: Upgrade · Abreißen-Modus: Entfernen.`); return; }
  const sel = state.selected, cost = levelCost(sel,1);
  if(!canAfford(cost)){ log(`Zu teuer: ${sel} kostet ${fmtCost(cost)}.`); return; }
  pay(cost);
  state.grid[r][c] = {type:sel, level:1};
  log(`${sel} gebaut.`);
}
function doDemolish({c,r}){
  const b = state.grid[r][c]; if(!b){ log(`Nichts zu entfernen.`); return; }
  refund(levelCost(b.type, b.level), 0.5);
  state.grid[r][c]=null;
  log(`${b.type} entfernt (+50% Rückerstattung).`);
}
function tryUpgrade({c,r}){
  const b = state.grid[r][c]; if(!b) return;
  const d = DEF[b.type];
  if(b.level>=d.max){ log(`${b.type} ist bereits Max-Level.`); return; }
  const cost = levelCost(b.type, b.level+1);
  if(!canAfford(cost)){ log(`Upgrade zu teuer: ${fmtCost(cost)}.`); return; }
  pay(cost); b.level++;
  log(`${b.type} → Level ${b.level}.`);
}

// ====== Tick & Rendering ======
const TICK_MS = 1000;
let loop = setInterval(tick, TICK_MS);

function tick(){
  state.t++;
  const {out, powerProd, defTotal} = getOutputsAndDefense();

  // Produktion pro Sekunde
  state.res.wood += out.wood|0;
  state.res.metal += out.metal|0;
  state.res.food  += out.food|0;

  // Bedrohung & Angriffe
  state.threat = Math.min(100, state.threat + 1.2);
  if(state.t % 20 === 0){
    const atk = Math.floor(5 + Math.random()*10 + state.threat/10);
    const dmg = Math.max(0, atk - defTotal);
    if(dmg===0) log(`Angriff ${atk} abgewehrt.`);
    else { state.hp -= dmg; log(`Angriff ${atk} → Schaden ${dmg}. Integrität ${Math.max(0,Math.round(state.hp))}%.`); }
    state.threat = Math.max(0, state.threat - 25);
  }

  if(state.hp<=0){
    state.hp=0; log("Der Shelter ist gefallen. Starte mit „Neues Spiel“ neu.");
    clearInterval(loop);
  }
}

function render(){
  // Hintergrund
  ctx.fillStyle="#0b1520"; ctx.fillRect(0,0,canvas.width,canvas.height);

  // Fels-Raster
  ctx.strokeStyle="#143049"; ctx.lineWidth=1;
  for(let x=0;x<=COLS;x++){ ctx.beginPath(); ctx.moveTo(x*TILE,0); ctx.lineTo(x*TILE,ROWS*TILE); ctx.stroke(); }
  for(let y=0;y<=ROWS;y++){ ctx.beginPath(); ctx.moveTo(0,y*TILE); ctx.lineTo(COLS*TILE,y*TILE); ctx.stroke(); }

  // Gebäude
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const b = state.grid[r][c]; if(!b) continue;
    const x=c*TILE, y=r*TILE, d=DEF[b.type];
    ctx.fillStyle=d.color; ctx.fillRect(x+1,y+1,TILE-2,TILE-2);
    ctx.strokeStyle="#0b1520"; ctx.strokeRect(x+3,y+3,TILE-6,TILE-6);
    // Level-Pips
    ctx.fillStyle="#ffffff";
    for(let i=0;i<b.level;i++) ctx.fillRect(x+3+i*4, y+TILE-5, 3,3);
    // Kürzel
    ctx.fillStyle="#081018"; ctx.font="bold 8px monospace";
    ctx.fillText(b.type[0], x+TILE/2-3, y+TILE/2+3);
  }

  // Hover
  if(hover){
    const x=hover.c*TILE, y=hover.r*TILE;
    ctx.strokeStyle="#8fd1ff"; ctx.strokeRect(x+0.5,y+0.5,TILE-1,TILE-1);
  }

  // HUD-Werte
  const s = getOutputsAndDefense();
  rWood.textContent   = `Holz: ${state.res.wood}`;
  rMetal.textContent  = `Metall: ${state.res.metal}`;
  rFood.textContent   = `Nahrung: ${state.res.food}`;
  rPower.textContent  = `Strom: ${s.powerActive}/${s.powerProd}`;
  rDef.textContent    = `Verteid.: ${s.defTotal}`;
  rThreat.textContent = `Bedrohung: ${Math.round(state.threat)}%`;
  rHP.textContent     = `Integrität: ${Math.max(0,Math.round(state.hp))}%`;

  requestAnimationFrame(render);
}
renderLog();
requestAnimationFrame(render);

// ====== Save/Load/Reset ======
saveBtn.onclick = ()=>{
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  log("Spielstand gespeichert.");
};
loadBtn.onclick = ()=>{
  const raw = localStorage.getItem(SAVE_KEY);
  if(!raw){ log("Kein Speicherstand gefunden."); return; }
  try{
    const loaded = JSON.parse(raw);
    // defensive Übernahme
    const fresh = newGame();
    fresh.grid = loaded.grid ?? fresh.grid;
    fresh.res  = loaded.res  ?? fresh.res;
    fresh.t    = loaded.t    ?? fresh.t;
    fresh.threat = loaded.threat ?? fresh.threat;
    fresh.hp   = loaded.hp   ?? fresh.hp;
    fresh.selected = loaded.selected ?? fresh.selected;
    fresh.mode = loaded.mode ?? fresh.mode;
    fresh.log  = (loaded.log ?? fresh.log).concat(["Spielstand geladen."]);
    state = fresh;
    updateBarActive(); renderLog();
    clearInterval(loop); loop=setInterval(tick, TICK_MS);
    log("Weiter geht's!");
  }catch(e){ log("Laden fehlgeschlagen."); }
};
resetBtn.onclick = ()=>{
  state = newGame();
  updateBarActive(); renderLog();
  clearInterval(loop); loop=setInterval(tick, TICK_MS);
  log("Neues Spiel gestartet.");
};