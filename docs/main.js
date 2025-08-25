// --- Grid & Canvas (Tiles jetzt 16x16) ---
const COLS = 18, ROWS = 12, TILE = 16;   // <- Tilegröße
const LOG_W = COLS * TILE;
const LOG_H = ROWS * TILE;

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha:false });

// neuer Speicher-Key (trennt von der alten 18px-Version)
const KEY = "shelter-grid-v2-16px";
let grid = Array.from({length:ROWS}, ()=>Array(COLS).fill(0));

// HiDPI & pixel-perfect Scaling
const DPR = Math.min(window.devicePixelRatio || 1, 3);

function resize(){
  // interne Auflösung
  canvas.width  = LOG_W * DPR;
  canvas.height = LOG_H * DPR;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.imageSmoothingEnabled = false;

  // integeres CSS-Scaling, damit die Pixel knackscharf bleiben
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const maxW = Math.min(vw * 0.96, 560);   // harte Obergrenze wie zuvor
  const maxH = vh * 0.70;                  // ~70% der Höhe, damit HUD Platz hat
  const scaleFloat = Math.min(maxW / LOG_W, maxH / LOG_H);
  const scale = Math.max(1, Math.floor(scaleFloat)); // nur ganze Faktoren

  canvas.style.width  = (LOG_W * scale) + "px";
  canvas.style.height = (LOG_H * scale) + "px";
}
resize(); addEventListener('resize', resize);

// UI-Refs
const msgEl = document.getElementById('msg');
const saveBtn = document.getElementById('saveBtn');
const loadBtn = document.getElementById('loadBtn');
const clearBtn = document.getElementById('clearBtn');
const installBtn = document.getElementById('installBtn');
function toast(t){ msgEl.textContent = t; }

// Pointer-Input (Touch & Maus)
let hover = null;
canvas.addEventListener('pointermove', (e)=>{ hover = toCell(e); });
canvas.addEventListener('pointerleave', ()=> hover=null);
canvas.addEventListener('pointerdown', (e)=>{
  const cell = toCell(e); if(!cell) return;
  const {c,r} = cell;
  grid[r][c] = grid[r][c] ? 0 : 1; // toggle
});
function toCell(e){
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width  * canvas.width  / DPR;
  const y = (e.clientY - rect.top)  / rect.height * canvas.height / DPR;
  const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
  return (c>=0 && c<COLS && r>=0 && r<ROWS) ? {c,r} : null;
}

// Save/Load/Reset (mit einfacher Migration von alten Saves)
saveBtn.onclick = ()=>{
  localStorage.setItem(KEY, JSON.stringify(grid));
  toast("Gespeichert.");
};
loadBtn.onclick = ()=>{
  const rawNew = localStorage.getItem(KEY);
  const rawOld = localStorage.getItem("shelter-grid"); // evtl. altes Save
  const raw = rawNew || rawOld;
  if(!raw){ toast("Kein Speicherstand gefunden."); return; }
  try {
    const g = JSON.parse(raw);
    if(Array.isArray(g) && g.length && Array.isArray(g[0])){
      // migriere falls andere Größe
      const R = Math.min(ROWS, g.length);
      const C = Math.min(COLS, g[0].length);
      const fresh = Array.from({length:ROWS}, ()=>Array(COLS).fill(0));
      for(let r=0;r<R;r++) for(let c=0;c<C;c++) fresh[r][c] = g[r][c] ? 1 : 0;
      grid = fresh;
      toast(rawNew ? "Geladen." : "Alter Speicherstand migriert.");
    } else {
      toast("Ungültiger Speicherstand.");
    }
  } catch { toast("Laden fehlgeschlagen."); }
};
clearBtn.onclick = ()=>{
  grid = Array.from({length:ROWS}, ()=>Array(COLS).fill(0));
  toast("Zurückgesetzt.");
};

// PWA-Installation (optional)
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault(); deferredPrompt=e; installBtn.hidden=false;
});
installBtn.onclick = async ()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  installBtn.hidden = true; deferredPrompt = null;
};

// --- Render-Loop ---
function render(){
  // Hintergrund
  ctx.fillStyle="#0b1520"; ctx.fillRect(0,0,canvas.width,canvas.height);

  // Rasterlinien
  ctx.strokeStyle="#143049"; ctx.lineWidth=1;
  for(let x=0;x<=COLS;x++){ ctx.beginPath(); ctx.moveTo(x*TILE,0); ctx.lineTo(x*TILE,ROWS*TILE); ctx.stroke(); }
  for(let y=0;y<=ROWS;y++){ ctx.beginPath(); ctx.moveTo(0,y*TILE); ctx.lineTo(COLS*TILE,y*TILE); ctx.stroke(); }

  // Zellen
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    if(grid[r][c]){
      const x=c*TILE, y=r*TILE;
      ctx.fillStyle="#7aa8a1"; ctx.fillRect(x+1,y+1,TILE-2,TILE-2);
      ctx.strokeStyle="#0b1520"; ctx.strokeRect(x+3,y+3,TILE-6,TILE-6);
    }
  }

  // Hover
  if(hover){
    const x=hover.c*TILE, y=hover.r*TILE;
    ctx.strokeStyle="#8fd1ff"; ctx.strokeRect(x+0.5,y+0.5,TILE-1,TILE-1);
  }

  requestAnimationFrame(render);
}
requestAnimationFrame(render);

// --- Hinweis: Mehr sichtbare Karte? ---
// Einfach COLS/ROWS erhöhen (z. B. 24x16). Der pixel-perfect-Scaler passt die Größe automatisch an.