import {
  BUILD_DEF, ATTACK_PERIOD, THREAT_INC, THREAT_DROP_AFTER,
  ATTACK_BASE_MIN, ATTACK_BASE_RAND, ATTACK_THREAT_FACTOR
} from "./config.js";

export function computeStats(state) {
  let out = {wood:0, metal:0, food:0};
  let powerProd=0, defStatic=0, turrets=[];
  for (let r=0;r<state.grid.length;r++) {
    for (let c=0;c<state.grid[0].length;c++) {
      const b = state.grid[r][c]; if(!b) continue;
      const d = BUILD_DEF[b.type], lvl=b.level;
      if(d.out) for(const [k,v] of Object.entries(d.out)) out[k]+=v*lvl;
      if(d.power?.prod) powerProd += d.power.prod*lvl;
      if(d.power?.need) turrets.push({def:(d.defense||0)*lvl, need:d.power.need*lvl});
      if(d.defense && !d.power?.need) defStatic += d.defense*lvl;
    }
  }
  turrets.sort((a,b)=>a.need-b.need);
  let avail=powerProd, defTurrets=0;
  for(const t of turrets){ if(avail>=t.need){ defTurrets+=t.def; avail-=t.need; } }
  return { out, powerProd, defTotal: defStatic+defTurrets, powerActive: powerProd-avail };
}

export function tickOnce(state, rng, log=()=>{}) {
  state.t++;
  const s = computeStats(state);

  state.res.wood += s.out.wood|0;
  state.res.metal += s.out.metal|0;
  state.res.food  += s.out.food|0;

  state.threat = Math.min(100, state.threat + THREAT_INC);

  if (state.t % ATTACK_PERIOD === 0) {
    const r = rng ? rng() : Math.random();
    const atk = Math.floor(ATTACK_BASE_MIN + r*ATTACK_BASE_RAND + state.threat*ATTACK_THREAT_FACTOR);
    const dmg = Math.max(0, atk - s.defTotal);
    if(dmg===0) log(`Angriff ${atk} abgewehrt.`);
    else { state.hp = Math.max(0, state.hp - dmg); log(`Angriff ${atk} → Schaden ${dmg}. Integrität ${state.hp}%.`); }
    state.threat = Math.max(0, state.threat - THREAT_DROP_AFTER);
  }
  return s;
}