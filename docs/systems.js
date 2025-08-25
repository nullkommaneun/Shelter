// Nutzt Laufzeit-Config `cfg`. Enthält Angriff-Scheduler + ComputeStats.
function lerp(a,b,t){ return a + (b-a)*t; }
function expSample(mean, rand){ const u = Math.max(1e-6, 1 - rand()); return -Math.log(u)*mean; }

export function computeStats(state, cfg) {
  const DEF = cfg.BUILD_DEF;
  let out = { wood: 0, metal: 0, food: 0 };
  let powerProd = 0, powerNeed = 0, defStatic = 0, turrets = [];

  for (let r = 0; r < state.grid.length; r++) {
    for (let c = 0; c < state.grid[0].length; c++) {
      const b = state.grid[r][c]; if (!b) continue;
      const d = DEF[b.type]; if (!d) continue;
      const lvl = b.level;

      if (d.out) for (const [k, v] of Object.entries(d.out)) out[k] += (v | 0) * lvl;

      if (d.power?.prod) powerProd += (d.power.prod | 0) * lvl;
      if (d.power?.need) {
        const need = (d.power.need | 0) * lvl;
        powerNeed += need;
        turrets.push({ def: (d.defense || 0) * lvl, need });
      }

      if (d.defense && !d.power?.need) defStatic += (d.defense | 0) * lvl;
    }
  }

  turrets.sort((a, b) => a.need - b.need);
  let avail = powerProd, defFromTurrets = 0, activePower = 0;
  for (const t of turrets) {
    if (avail >= t.need) { defFromTurrets += t.def; avail -= t.need; activePower += t.need; }
  }

  return { out, powerProd, powerNeed, powerActive: activePower, defTotal: defStatic + defFromTurrets };
}

function scheduleNext(state, cfg, rng){
  const mean0 = cfg.ATTACK_MEAN_BASE_S || 28;
  const meanMin = cfg.ATTACK_MEAN_MIN_S || 14;
  const t = Math.max(0, Math.min(1, (state.threat||0)/100));
  const mean = Math.max(3, lerp(mean0, meanMin, t));        // erwartete Pause
  const wait = Math.max(3, Math.floor(expSample(mean, rng))); // exp-Verteilung
  let nextAt = state.t + wait;

  // Start-Schonfrist
  const graceUntil = state.graceUntil ?? 0;
  if (nextAt <= graceUntil) nextAt = graceUntil + 3 + Math.floor(rng()*4);

  // Revealfenster
  const rmin = cfg.REVEAL_MIN_S || 7, rmax = cfg.REVEAL_MAX_S || 11;
  let window = Math.max(2, Math.floor(rmin + (rmax - rmin) * rng()));
  // kleiner Jitter
  const jp = cfg.COUNTDOWN_JITTER_P || 0; const js = cfg.COUNTDOWN_JITTER_S || 1;
  if (rng() < jp) window += (rng()<0.5 ? -js : js);

  const revealAt = Math.max(state.t, nextAt - window);

  state.nextAttackAt = nextAt;
  state.revealAt = revealAt;
}

export function tickOnce(state, rng, log = () => {}, cfg) {
  state.t++;

  // Erstes Scheduling?
  if (state.nextAttackAt == null) scheduleNext(state, cfg, rng);

  const s = computeStats(state, cfg);

  // Ressourcen
  state.res.wood += s.out.wood | 0;
  state.res.metal += s.out.metal | 0;
  state.res.food  += s.out.food  | 0;

  // Bedrohung
  state.threat = Math.min(100, state.threat + (cfg.THREAT_INC || 0));

  // Angriff fällig?
  if (state.t >= (state.nextAttackAt ?? Infinity)) {
    const r = rng ? rng() : Math.random();
    const atk = Math.floor((cfg.ATTACK_BASE_MIN || 5)
                 + r * (cfg.ATTACK_BASE_RAND || 10)
                 + state.threat * (cfg.ATTACK_THREAT_FACTOR || 0.1));
    const dmg = Math.max(0, atk - s.defTotal);
    if (dmg === 0) log(`Angriff ${atk} abgewehrt.`);
    else { state.hp = Math.max(0, state.hp - dmg); log(`Angriff ${atk} → Schaden ${dmg}. Integrität ${state.hp}%.`); }
    state.threat = Math.max(0, state.threat - (cfg.THREAT_DROP_AFTER || 25));

    // Nächste Runde planen
    scheduleNext(state, cfg, rng);
  }

  return s;
}