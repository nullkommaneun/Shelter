// docs/debug.js
// Globaler Error-Logger mit Export: ER|elog-v1.0|<ts>|<BASE64(JSON)>
// Fangt window.onerror, unhandledrejection und console.error ab.

const ELOG_VER = "elog-v1.0";

function envInfo() {
  return {
    url: location.href,
    ua: navigator.userAgent,
    lang: navigator.language,
    time: new Date().toISOString()
  };
}

export function initDebug({ onLog } = {}) {
  const entries = [];
  const add = (kind, message, stack = "", extra = {}) => {
    const rec = {
      ts: Date.now(),
      kind,
      message: String(message || ""),
      stack: String(stack || ""),
      ...extra
    };
    entries.push(rec);
    if (onLog) onLog(`${kind}: ${rec.message}`);
  };

  // window.onerror
  window.addEventListener("error", (e) => {
    const msg = e?.error?.message || e?.message || "Unbekannter Fehler";
    const stack = e?.error?.stack || "";
    add("runtime", msg, stack);
  });

  // unhandledrejection
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e?.reason;
    const msg = (reason && (reason.message || String(reason))) || "Unhandled rejection";
    const stack = reason && reason.stack ? reason.stack : "";
    add("async", msg, stack);
  });

  // console.error Hook (nicht zerstörerisch)
  const origConsoleError = console.error;
  console.error = function(...args) {
    try { add("console", args.map(a => (a && a.stack) ? a.stack : String(a)).join(" ")); }
    catch {}
    origConsoleError.apply(console, args);
  };

  function exportText() {
    const payload = {
      version: ELOG_VER,
      env: envInfo(),
      entries
    };
    const raw = JSON.stringify(payload);
    const b64 = toB64(raw);
    return `ER|${ELOG_VER}|${Date.now()}|${b64}`;
  }

  function clear() { entries.length = 0; }

  return { exportText, clear, _entries: entries };
}

function toB64(str){
  try { return btoa(unescape(encodeURIComponent(str))); }
  catch { try { return btoa(str); } catch { return "(b64_failed)"; } }
}