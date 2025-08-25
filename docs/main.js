// Grid & Canvas
const COLS=18, ROWS=12, TILE=18;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha:false });
const KEY = "shelter-grid";
let grid = Array.from({length:ROWS}, ()=>Array(COLS).fill(0));

// HiDPI sauber
const DPR = Math.min(window.devicePixelRatio||1, 2);
function resize(){
  canvas.width = COLS*TILE*DPR; canvas.height = ROWS*TILE*DPR;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.imageSmoothingEnabled = false;
}
resize(); addEventListener('resize', resize);

// UI-Refs
const msgEl = document.getElementById('msg');
const saveBtn = document.getElementById('saveBtn');
const loadBtn = document.getElementById('loadBtn');
const clearBtn = document.getElementById('clearBtn');
const installBtn = document.getElementById('installBtn');

function toast(t){ msgEl.textContent = t; }

// Pointer-Input
let hover=null;
canvas.addEventListener('pointermove', (e)=>{ hover = toCell(e); });
canvas.addEventListener('pointerleave', ()=> hover=null);
canvas.addEventListener('pointerdown', (e)=>{
  const cell = toCell(e); if(!cell) return;
  const {c,r} = cell;
  grid[r][c] = grid[r][c] ? 0 : 1; // toggle
});
function toCell(e){
  const rect=canvas.getBoundingClientRect();
  const x=(e.clientX-rect.left)/rect.width*canvas.width/DPR;
  const y=(e.clientY-rect.top)/rect.height*canvas.height/DPR;
  const c=Math.floor(x/TILE), r=Math.floor(y/TILE);
  return (c>=0&&c<COLS&&r>=0&&r<ROWS)?{c,r}:null;
}

// Save/Load/Reset
saveBtn.onclick = ()=>{
  localStorage.setItem(KEY, JSON.stringify(grid));
  toast("Gespeichert.");
};
loadBtn.onclick = ()=>{
  const raw = localStorage.getItem(KEY);
  if(!raw){ toast("Kein Speicherstand gefunden."); return; }
  try {
    const g = JSON.parse(raw);
    if(Array.isArray(g) && g.length===ROWS && g[0].length===COLS){
      grid = g; toast("Geladen.");
    } else { toast("Ungültiger Speicherstand."); }
  } catch { toast("Laden fehlgeschlagen."); }
};
clearBtn.onclick = ()=>{
  grid = Array.from({length:ROWS}, ()=>Array(COLS).fill(0));
  toast("Zurückgesetzt.");
};

// Optional: Installieren-Button, wenn möglich
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

// Render-Loop
function render(){
  // Hintergrund
  ctx.fillStyle="#0b1520"; ctx.fillRect(0,0,canvas.width,canvas.height);

  // Rasterlinien
  ctx.strokeStyle="#143049"; ctx.lineWidth=1;
  for(let x=0;x<=COLS;x++){ ctx.beginPath(); ctx.moveTo(x*TILE,0); ctx.lineTo(x*TILE,ROWS*TILE); ctx.stroke(); }
  for(let y=0;y<=ROWS;y++){ ctx.beginPath(); ctx.moveTo(0,y*TILE); ctx.lineTo(COLS*TILE,y*TILE); ctx.stroke(); }

  // Zellen
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
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