// docs/systems.js
// Nutzt jetzt die Laufzeit-Config `cfg` als Parameter.
export function computeStats(state, cfg) {
  const DEF = cfg.BUILD_DEF;
  let out = {wood:0, metal:0, food:0};
  let powerProd=0, defStatic=0, turrets=[];
  for (let r=0;r<state.grid.length;r++) {
    for (let c=0;c<state.grid[0].length;c++) {
      const b = state.grid[r][c]; if(!b) continue;
      const d = DEF[b.type], lvl=b.level;
      if(!d) continue;
      if(d.out) for(const [k,v] of Object.entries(d.out)) out[k]+= (v|0)*lvl;
      if(d.power?.prod) powerProd += (d.power.prod|0)*lvl;
      if(d.power?.need) turrets.push({def:(d.defense||0)*lvl, need:(d.power.need||0)*lvl});
      if(d.defense && !d.power?.need) defStatic += (d.defense|0)*lvl;
    }
  }
  turrets.sort((a,b)=>a.need-b.need);
  let avail=powerProd, defTurrets=0;
  for(const t of turrets){ if(avail>=t.need){ defTurrets+=t.def; avail-=t.need; } }
  return { out, powerProd, defTotal: defStatic+defTurrets, powerActive: powerProd-avail };
}

export function tickOnce(state, rng, log=()=>{}, cfg) {
  state.t++;
  const s = computeStats(state, cfg);

  state.res.wood += s.out.wood|0;
  state.res.metal += s.out.metal|0;
  state.res.food  += s.out.food|0;

  state.threat = Math.min(100, state.threat + (cfg.THREAT_INC||0));

  if(state.t % (cfg.ATTACK_PERIOD||20) === 0){
    const r = rng ? rng() : Math.random();
    const atk = Math.floor((cfg.ATTACK_BASE_MIN||5) + r*(cfg.ATTACK_BASE_RAND||10) + state.threat*(cfg.ATTACK_THREAT_FACTOR||0.1));
    const dmg = Math.max(0, atk - s.defTotal);
    if(dmg===0) log(`Angriff ${atk} abgewehrt.`);
    else { state.hp = Math.max(0, state.hp - dmg); log(`Angriff ${atk} → Schaden ${dmg}. Integrität ${state.hp}%.`); }
    state.threat = Math.max(0, state.threat - (cfg.THREAT_DROP_AFTER||25));
  }
  return s;
}