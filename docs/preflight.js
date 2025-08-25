// docs/preflight.js
// Minimal-invasiver Preflight/Debugger mit Overlay & kopierbarem Report.
// Aktivierung: ?pf=1  (optional: ?pf=1&autocopy=1)

const params = new URLSearchParams(location.search);
const PF_ENABLED = /^(1|true|yes|on)$/i.test(params.get('pf') || '');
const AUTO_COPY  = /^(1|true|yes|on)$/i.test(params.get('autocopy') || '');

const startTime = performance.now();
const NS = '__PF';                         // Namespace im window
const VERSION = 'pf-v1.0';

const PF = {
  version: VERSION,
  enabled: PF_ENABLED,
  startedAt: new Date().toISOString(),
  run,
  report: null,
  text: null,
  ready: run().catch(e => ({error: String(e)}))
};
Object.defineProperty(window, NS, { value: PF, writable: false });

// ------------------------------------------------------------

async function run(){
  const report = {
    meta: metaInfo(),
    screen: screenInfo(),
    hardware: await hardwareInfo(),
    features: featureMatrix(),
    canvas: await canvasInfo(),
    storage: await storageInfo(),
    serviceWorker: await swInfo(),
    network: networkInfo(),
    pwa: await pwaInfo(),
    perf: { initMs: +(performance.now() - startTime).toFixed(2) },
    summary: {}
  };

  // einfache Bewertung
  const fails = collectFails(report);
  report.summary = {
    status: fails.length ? 'warn' : 'ok',
    fails,
    version: VERSION,
  };

  const text = compressReport(report);
  PF.report = report;
  PF.text = text;

  if (PF_ENABLED) showOverlay(text, report);

  // optional auto-copy
  if (PF_ENABLED && AUTO_COPY && navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); } catch {}
  }

  return report;
}

// ------------------------------------------------------------

function metaInfo(){
  const nav = navigator;
  return {
    url: location.href,
    origin: location.origin,
    path: location.pathname,
    query: location.search,
    referrer: document.referrer || null,
    userAgent: nav.userAgent,
    language: nav.language,
    languages: nav.languages,
    platform: nav.platform,
    cookieEnabled: nav.cookieEnabled,
    vendor: nav.vendor,
    time: new Date().toISOString()
  };
}

function screenInfo(){
  const s = window.screen || {};
  const o = (screen.orientation && screen.orientation.type) || null;
  return {
    width: s.width, height: s.height,
    availWidth: s.availWidth, availHeight: s.availHeight,
    pixelRatio: window.devicePixelRatio || 1,
    orientation: o
  };
}

async function hardwareInfo(){
  const nav = navigator;
  let glInfo = { webgl1:false, webgl2:false, vendor:null, renderer:null };
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (gl) {
      glInfo.webgl1 = true;
      const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbgInfo) {
        glInfo.vendor = gl.getParameter(dbgInfo.UNMASKED_VENDOR_WEBGL);
        glInfo.renderer = gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL);
      }
    }
    const gl2 = c.getContext('webgl2');
    if (gl2) glInfo.webgl2 = true;
  } catch {}

  return {
    deviceMemory: nav.deviceMemory ?? null,
    hardwareConcurrency: nav.hardwareConcurrency ?? null,
    webgpu: !!nav.gpu,
    gl: glInfo
  };
}

function featureMatrix(){
  const w = window, nav = navigator;
  return {
    esm: true, // wir sind bereits in type=module
    pointerEvents: 'onpointerdown' in w,
    clipboard: !!nav.clipboard,
    share: !!nav.share,
    fsAccess: !!w.showOpenFilePicker,
    offscreenCanvas: !!w.OffscreenCanvas,
    workers: !!w.Worker,
    wasm: typeof WebAssembly === 'object',
    idleDetector: !!w.IdleDetector,
    storage: !!nav.storage,
    permissions: !!nav.permissions
  };
}

async function canvasInfo(){
  // 2D-Canvas Probe + Offscreen
  let ctx2d = false, offscreen = false, readback = false;
  try {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx2d = true;
      ctx.fillStyle = '#f00'; ctx.fillRect(0,0,1,1);
      const px = ctx.getImageData(0,0,1,1).data;
      readback = px && px[0] === 255;
    }
  } catch {}
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const oc = new OffscreenCanvas(16,16);
      offscreen = !!oc.getContext('2d');
    }
  } catch {}
  return { tile: '16x16', ctx2d, readback, offscreen };
}

async function storageInfo(){
  const nav = navigator;
  const out = { localStorage:false, indexedDB:false, estimate:null, quotaMB:null, usageMB:null };
  // localStorage
  try {
    localStorage.setItem('pf_test','1'); localStorage.removeItem('pf_test');
    out.localStorage = true;
  } catch {}
  // indexedDB
  out.indexedDB = await new Promise(res=>{
    try {
      const req = indexedDB.open('pf-db-test', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('s');
      req.onsuccess = () => { req.result.close(); indexedDB.deleteDatabase('pf-db-test'); res(true); };
      req.onerror = () => res(false);
    } catch { res(false); }
  });
  // estimate
  try {
    if (nav.storage?.estimate) {
      const est = await nav.storage.estimate();
      out.estimate = est;
      if (est.quota)  out.quotaMB = +((est.quota)/(1024*1024)).toFixed(2);
      if (est.usage)  out.usageMB = +((est.usage)/(1024*1024)).toFixed(2);
    }
  } catch {}
  return out;
}

async function swInfo(){
  const supported = 'serviceWorker' in navigator;
  const res = { supported, controlling: false, registrations: [], caches: [], swJsCacheName: null };
  try {
    if (supported) {
      res.controlling = !!navigator.serviceWorker.controller;
      const regs = await navigator.serviceWorker.getRegistrations();
      res.registrations = regs.map(r => r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL).filter(Boolean);

      // Cache-Namen
      if (window.caches?.keys) {
        res.caches = await caches.keys();
      }
      // sw.js lesen und CACHE-Konstante herausparsen (rein informativ)
      try {
        const txt = await fetch('./sw.js', {cache:'no-store'}).then(r=>r.ok?r.text():null);
        if (txt) {
          const m = txt.match(/CACHE\s*=\s*["'`](.+?)["'`]/);
          if (m) res.swJsCacheName = m[1];
        }
      } catch {}
    }
  } catch {}
  return res;
}

function networkInfo(){
  const nav = navigator;
  const c = nav.connection || nav.mozConnection || nav.webkitConnection;
  return {
    online: nav.onLine,
    type: c?.type || null,
    effectiveType: c?.effectiveType || null,
    downlink: c?.downlink || null,
    rtt: c?.rtt || null,
    saveData: c?.saveData || null
  };
}

async function pwaInfo(){
  // manifest verlinkt?
  const link = document.querySelector('link[rel="manifest"]');
  let ok=false, json=null;
  if (link) {
    try {
      json = await fetch(link.href, {cache:'no-store'}).then(r=>r.ok?r.json():null);
      ok = !!json;
    } catch {}
  }
  return { manifestLinked: !!link, manifestOk: ok, name: json?.name || null, startUrl: json?.start_url || null, display: json?.display || null };
}

function collectFails(r){
  const fails = [];
  if (!r.canvas.ctx2d) fails.push('Canvas2D fehlend');
  if (!r.storage.localStorage) fails.push('localStorage gesperrt');
  if (!r.storage.indexedDB) fails.push('IndexedDB gesperrt');
  if (!r.serviceWorker.supported) fails.push('Service Worker nicht unterstützt');
  if (r.pwa.manifestLinked && !r.pwa.manifestOk) fails.push('Manifest nicht ladbar');
  return fails;
}

function compressReport(obj){
  // kompakter JSON → Base64; Prefix enthält Version & Zeit
  const raw = JSON.stringify(obj);
  const b64 = toB64(raw);
  return `PF|${VERSION}|${Date.now()}|${b64}`;
}
function toB64(str){
  try { return btoa(unescape(encodeURIComponent(str))); }
  catch { try { return btoa(str); } catch { return '(b64_failed)'; } }
}

// ------------------------------------------------------------
// Overlay UI (nur bei ?pf=1)
function showOverlay(text, report){
  const el = document.createElement('div');
  el.id = 'pf-overlay';
  el.innerHTML = `
  <style>
    #pf-overlay{position:fixed;inset:0;background:rgba(5,10,16,.72);backdrop-filter:saturate(1.1) blur(2px);z-index:99999;
      display:flex;align-items:center;justify-content:center;padding:10px;}
    #pf-card{width:min(800px,96vw);max-height:92vh;overflow:auto;background:#0d1f31;border:1px solid #2a4a68;border-radius:12px;
      color:#e6f2ff;font:13px/1.35 system-ui, sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.45);}
    #pf-head{display:flex;align-items:center;gap:8px;justify-content:space-between;padding:10px;border-bottom:1px solid #2a4a68}
    #pf-title{font-weight:700}
    #pf-body{padding:10px;display:grid;gap:8px}
    #pf-text{width:100%;min-height:120px;background:#081826;color:#cfe6ff;border:1px solid #335a7e;border-radius:8px;padding:8px;white-space:pre-wrap}
    #pf-actions{display:flex;gap:8px;flex-wrap:wrap}
    #pf-actions button{background:#17324a;color:#cfe6ff;border:1px solid #335a7e;padding:6px 10px;border-radius:8px;cursor:pointer}
    #pf-small{font-size:12px;opacity:.85}
    #pf-json{display:none;white-space:pre;overflow:auto;background:#081826;border:1px solid #335a7e;border-radius:8px;padding:8px;max-height:240px}
  </style>
  <div id="pf-card" role="dialog" aria-modal="true" aria-label="Preflight Report">
    <div id="pf-head">
      <div>
        <div id="pf-title">Preflight / Debug (${VERSION})</div>
        <div id="pf-small">${report.meta.url}</div>
      </div>
      <button id="pf-close">Schließen</button>
    </div>
    <div id="pf-body">
      <div id="pf-actions">
        <button id="pf-copy">Report kopieren</button>
        <button id="pf-toggle">Rohdaten anzeigen</button>
        <button id="pf-rerun">Erneut prüfen</button>
      </div>
      <textarea id="pf-text" readonly>${text}</textarea>
      <div id="pf-json"></div>
      <div id="pf-small">
        Kopiere den Text und füge ihn hier in den Chat ein. Format: <code>PF|${VERSION}|…|BASE64</code>
      </div>
    </div>
  </div>`;
  document.body.appendChild(el);

  // Events
  el.querySelector('#pf-close').onclick = ()=> el.remove();
  el.querySelector('#pf-copy').onclick = async ()=>{
    try {
      await navigator.clipboard.writeText(PF.text);
      el.querySelector('#pf-copy').textContent = 'Kopiert ✓';
    } catch { el.querySelector('#pf-copy').textContent = 'Kopieren fehlgeschlagen'; }
    setTimeout(()=> el.querySelector('#pf-copy').textContent = 'Report kopieren', 1500);
  };
  const jsonDiv = el.querySelector('#pf-json');
  const toggleBtn = el.querySelector('#pf-toggle');
  toggleBtn.onclick = ()=>{
    const open = jsonDiv.style.display!=='none';
    if(open){ jsonDiv.style.display='none'; toggleBtn.textContent='Rohdaten anzeigen'; }
    else { jsonDiv.style.display='block'; jsonDiv.textContent = JSON.stringify(report, null, 2); toggleBtn.textContent='Rohdaten ausblenden'; }
  };
  el.querySelector('#pf-rerun').onclick = async ()=>{
    toggleBtn.textContent='Rohdaten anzeigen';
    jsonDiv.style.display='none'; jsonDiv.textContent='';
    el.querySelector('#pf-text').value = '…prüfe erneut…';
    const rep = await run();
    el.querySelector('#pf-text').value = PF.text;
  };
}