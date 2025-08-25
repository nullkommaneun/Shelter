# Architektur – Shelter Builder

## Module & Verantwortlichkeiten
- **index.html**: UI-Hülle, lädt Preflight zuerst, dann Bootcheck (der `main.js` nur importiert, wenn alle Module erreichbar sind).
- **style.css**: Basis-Styles (HUD, Toolbar, Canvas).
- **preflight.js**: Systemcheck + Overlay via `?pf=1`, erzeugt PF|…-Report (Base64).
- **bootcheck.js**: Prüft Existenz/Erreichbarkeit aller JS-Module, zeigt Fehler-Overlay; lädt danach `main.js`.
- **sw.js**: PWA-Cache (Offline), `skipWaiting()` + `clients.claim()`; Cache-Key bump bei Änderungen.
- **config.js**: Konfig/Balance (Tiles, Grid, Gebäude, Tick/Bedrohung).
- **engine.js**: Deterministische Engine (fixer Tick, getrenntes Render).
- **systems.js**: Reine Logik (Produktion, Verteidigung, Tick/Angriff).
- **state.js**: State-Erzeugung, LocalSave, Import/Export (SV|…|BASE64), Migration.
- **rng.js**: Seedbarer RNG.
- **main.js**: UI-Bindings, Input, Render, Orchestrierung.

## Lade-Reihenfolge
1) `preflight.js` → 2) `bootcheck.js` (Checks) → 3) `main.js` → 4) SW-Registrierung

## Datenfluss
`main.js` ↔ `state.js` · `main.js` → `systems.js` · `main.js` ↔ `config.js` · `main.js` ↔ `rng.js` · `engine.js` orchestriert Tick/Render.

## Debug/Support
- PF-Reports: `?pf=1` → „Report kopieren“ → als Datei (siehe Namensschema unten) im Projekt hochladen.
- Bootfehler: Overlay aus `bootcheck.js` zeigt fehlende Dateien/Statuscodes + Stack.
- Saves: Export/Import (SV|…|BASE64).

## Pixel-Perfect
Interne Auflösung: `COLS*TILE` × `ROWS*TILE`, DPR≤3, CSS-Scale nur in Ganzzahlen → knackscharfe Pixel.

## Service Worker
Bei jeder inhaltlichen Änderung an *.js/*.html: `CACHE` in `sw.js` erhöhen; `install`: `addAll`+`skipWaiting()`; `activate`: alte Caches löschen + `clients.claim()`.

## Erweiterungen
Data-Driven Buildings (optional JSON), Sprite-Tileset, Bewohner/Jobs, Pfadfindung, Capacitor-Wrapper.
