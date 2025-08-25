// docs/bootcheck.js
const EXPECT = [
  "./config.js","./engine.js","./systems.js","./state.js","./rng.js",
  "./debug.js","./settings.js", // neu
  "./main.js"
];

function showOverlay(title, message, details="") {
  const el = document.createElement("div");
  el.id = "boot-overlay";
  el.innerHTML = `
  <style>
    #boot-overlay{position:fixed;inset:0;background:rgba(5,10,16,.8);z-index:99999;display:flex;align-items:center;justify-content:center;padding:12px;}
    #boot-card{width:min(860px,96vw);max-height:92vh;overflow:auto;background:#0d1f31;border:1px solid #2a4a68;border-radius:12px;color:#e6f2ff;font:13px/1.35 system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.45)}
    #boot-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px;border-bottom:1px solid #2a4a68}
    #boot-body{padding:10px;display:grid;gap:8px}
    #boot-actions{display:flex;gap:8px;flex-wrap:wrap}
    #boot-actions button{background:#17324a;color:#cfe6ff;border:1px solid #335a7e;padding:6px 10px;border-radius:8px}
    #boot-text{white-space:pre-wrap;background:#081826;border:1px solid #335a7e;border-radius:8px;padding:8px;max-height:240px;overflow:auto}
    .muted{opacity:.85}
  </style>
  <div id="boot-card" role="dialog" aria-modal="true" aria-label="Boot-Fehler">
    <div id="boot-head">
      <strong>${title}</strong>
      <button id="boot-close">Schließen</button>
    </div>
    <div id="boot-body">
      <div>${message}</div>
      ${details ? `<div id="boot-text">${details}</div>` : ""}
      <div class="muted">Tipp: Prüfe, ob alle Dateien in <code>docs/</code> liegen und exakt so heißen.</div>
      <div id="boot-actions"><button id="boot-copy">Report kopieren</button></div>
    </div>
  </div>`;
  document.body.appendChild(el);
  el.querySelector("#boot-close").onclick = ()=> el.remove();
  el.querySelector("#boot-copy").onclick = async ()=>{
    const txt = `${title}\n\n${message}\n\n${details}`;
    try { await navigator.clipboard.writeText(txt); el.querySelector("#boot-copy").textContent="Kopiert ✓"; }
    catch { el.querySelector("#boot-copy").textContent="Kopieren fehlgeschlagen"; }
    setTimeout(()=> el.querySelector("#boot-copy").textContent="Report kopieren", 1500);
  };
}

async function checkFiles() {
  const misses = [];
  for (const p of EXPECT) {
    try {
      const r = await fetch(p, { cache: "no-store" });
      if (!r.ok) misses.push(`${p} → ${r.status}`);
    } catch(e) {
      misses.push(`${p} → ${String(e)}`);
    }
  }
  return misses;
}

window.addEventListener("error", (e)=>{
  showOverlay("Laufzeitfehler (window.onerror)", String(e?.error?.message||e?.message||e), String(e?.error?.stack||""));
});
window.addEventListener("unhandledrejection", (e)=>{
  const msg = (e && e.reason && (e.reason.message||e.reason)) || "Unhandled Promise rejection";
  const stack = (e && e.reason && e.reason.stack) || "";
  showOverlay("Async-Fehler (unhandledrejection)", String(msg), String(stack));
});

(async function boot(){
  const misses = await checkFiles();
  if (misses.length) {
    showOverlay("Boot fehlgeschlagen – fehlende/unerreichbare Dateien", 
      "Diese Dateien konnten nicht geladen werden:", misses.join("\n"));
    return;
  }
  try {
    await import("./main.js");
  } catch (e) {
    showOverlay("Boot fehlgeschlagen – Modulfehler in main.js", String(e?.message||e), String(e?.stack||""));
  }
})();