// ============ 核心逻辑（纯计算，不接触 DOM，可单元测试） ============
import {
  GENERATORS, STAR_UPGRADES, PERKS, ACHIEVEMENTS, RARE_WEIGHT, MORPHS,
  PULSE_PERIOD, PERFECT_WINDOW, PERFECT_MULT, RESO_MAX, RESO_BONUS, RESO_DECAY,
  CHARGE_MAX, CHARGE_CLICK, CHARGE_PERFECT, BURST_DURATION, BURST_MULT,
  CRIT_CHANCE, CRIT_MULT, COMBO_WINDOW, COMBO_STEP, COMBO_MAX,
  CLICK_SHARE, BOOST_MULT, DEVOUR_BASE,
  COLLAPSE_REQUIRE, SINGULARITY_REQUIRE, OFFLINE_CAP, OFFLINE_BASE, ACH_BONUS, REROLL_COST,
  MORPH_UNLOCK_COLLAPSES, RECORD_LEN, ECHO_RATE, ECHO_UNLOCK_COLLAPSES, ECHO_MAX_TAPS,
ELEMENTS, REACTION, GEN_ELEMENT, LATTICE_SIZE, LATTICE_CENTER, LATTICE_SCALE,
  LATTICE_UNLOCK, TIER_MULT, OFFLINE_NODE_MULT, EMITTER_BASE, TIDE_PERIOD, TIDE_MULT,
  SEEDS, OBJECTIVES, EARLY_PROD_UNTIL,
} from './data.js';

export const SAVE_KEY = 'xineqidian_save_v2';
export const SAVE_VERSION = 3;

export const PERK_BY_ID = {};
for (const p of PERKS) PERK_BY_ID[p.id] = p;

export const MORPH_BY_ID = {};
for (const m of MORPHS) MORPH_BY_ID[m.id] = m;

const MULT_KEYS = ['prodMult', 'clickMult', 'costMult', 'critMult', 'stardustMult', 'burstMult',
  'chainMult', 'devourMult', 'offlineCapMult', 'burstDurationMult'];

export function newState() {
  return {
    version: SAVE_VERSION,
    energy: 0, totalRun: 0, totalAll: 0,
    clicks: 0, perfects: 0,
    gens: GENERATORS.map(() => 0),
    bought: GENERATORS.map(() => 0),
    starUp: {},
    stardust: 0, totalStardust: 0, shards: 0, totalShards: 0,
    collapses: 0,
    orbsTapped: 0, devoured: 0, absorbedTotal: 0,
    combo: 0, comboAt: 0, maxCombo: 0,
    reso: 0, resoAt: 0, maxReso: 0, resoDecayAcc: 0,
    charge: 0, burstUntil: 0, bursts: 0,
    perks: [], perkChoices: [], perkPicksLeft: 1, perksTaken: 0, rerolls: 0,
    morph: null, morphAt: 0,
    echo: null, echoAcc: 0, echoIdx: 0, echoHits: 0,
    recording: false, recordStart: 0, recordBuf: [], recordLen: RECORD_LEN,
lattice: emptyLattice(), tideIdx: 0, tideStart: 0,
    seed: null, objectives: {},
    tempMult: 1, tempUntil: 0, emitterExtra: 0, burstExtra: 0, perkSlotExtra: 0,
    chainUntil: 0,
    pulseStart: 0,
    boostUntil: 0, boostMult: BOOST_MULT,
    playTime: 0,
    ach: {},
    autoBuy: false, bulk: 1,
    haptics: true, fxOn: true, audioOn: true,
    nextOrbAt: 0,
    lastSave: Date.now(), startedAt: Date.now(),
  };
}

export const state = newState();

/* ---------------- 词条聚合 ---------------- */
let _perkCache = null;
let _perkKey = '\u0000';

export function perkAgg(s = state) {
  const key = (s.perks || []).join(',');
  if (key === _perkKey && _perkCache) return _perkCache;
  const a = {
    prodMult: 1, clickMult: 1, costMult: 1, critMult: 1, stardustMult: 1, burstMult: 1, chainMult: 1,
    critChance: 0, perfectWindow: 0, chainTime: 0, devourMult: 1, autoClick: 0,
    echoChance: 0, offlineEffAdd: 0, offlineCapMult: 1, orbFreq: 0, swarm: 0, tempo: 0,
  };
  for (const id of (s.perks || [])) {
    const p = PERK_BY_ID[id];
    if (!p) continue;
    for (const k in p.effects) {
      const v = p.effects[k];
      if (!(k in a)) continue;
      if (MULT_KEYS.indexOf(k) >= 0) a[k] *= v;
      else a[k] += v;
    }
  }
  _perkCache = a;
  _perkKey = key;
  return a;
}

/* ---------------- 形态聚合 ---------------- */
let _morphCache = null;
let _morphKey = '\u0000';

export function morphAgg(s = state) {
  const key = s.morph || '';
  if (key === _morphKey && _morphCache) return _morphCache;
  const a = {
    prodMult: 1, clickMult: 1, devourMult: 1, burstMult: 1, burstDurationMult: 1,
    resoMax: RESO_MAX, resoDecayMult: 1, clickSplit: 1, resoPerDevour: 0, pulseSpeed: 1,
  };
  const m = key ? MORPH_BY_ID[key] : null;
  if (m) {
    for (const k in m.effects) {
      const v = m.effects[k];
      if (!(k in a)) continue;
      if (MULT_KEYS.indexOf(k) >= 0) a[k] *= v;
      else a[k] = v;
    }
  }
  _morphCache = a;
  _morphKey = key;
  return a;
}

export function morphUnlocked(s = state) { return s.collapses >= MORPH_UNLOCK_COLLAPSES; }
export function canChooseMorph(s = state) { return morphUnlocked(s) && !s.morph; }

export function chooseMorph(id, s = state) {
  if (!canChooseMorph(s)) return null;
  const m = MORPH_BY_ID[id];
  if (!m) return null;
  s.morph = id;
  s.morphAt = Date.now();
  return m;
}

export function echoUnlocked(s = state) { return s.collapses >= ECHO_UNLOCK_COLLAPSES; }
export function hasEcho(s = state) { return !!(s.echo && s.echo.taps && s.echo.taps.length); }

/* ---------------- 开局种子 ---------------- */
export const SEED_BY_ID = {};
for (const sd of SEEDS) SEED_BY_ID[sd.id] = sd;

let _seedCache = null;
let _seedKey = '\u0000';

export function seedAgg(s = state) {
  const key = s.seed || '';
  if (key === _seedKey && _seedCache) return _seedCache;
  const a = {
    clickMult: 1, costMult: 1, devourMult: 1, earlyProd: 1,
    perfectReso: 0, emitterBonus: 0, startEnergy: 0, latticeNow: 0,
  };
  const sd = key ? SEED_BY_ID[key] : null;
  if (sd) {
    for (const k in sd.effects) {
      const v = sd.effects[k];
      if (!(k in a)) continue;
      if (k === 'clickMult' || k === 'costMult' || k === 'devourMult' || k === 'earlyProd') a[k] *= v;
      else a[k] = v;
    }
  }
  _seedCache = a;
  _seedKey = key;
  return a;
}

export function seedChosen(s = state) { return !!s.seed; }

export function chooseSeed(id, s = state) {
  if (s.seed) return null;
  const sd = SEED_BY_ID[id];
  if (!sd) return null;
  s.seed = id;
  const a = seedAgg(s);
  if (a.startEnergy > 0) addEnergy(a.startEnergy, s);
  s.pulseStart = Date.now();
  return sd;
}

export function tempMult(now = Date.now(), s = state) {
  return now < s.tempUntil ? s.tempMult : 1;
}

/* ---------------- 前期委托 ---------------- */
const OBJECTIVE_CHECKS = {
  tap10: s => s.perfects >= 10,
  buy3: s => {
    let n = 0;
    for (let i = 0; i < s.gens.length; i++) if (s.gens[i] > 0) n++;
    return n >= 3;
  },
  devour20: s => s.devoured >= 20,
  place2: s => placedCount(s) >= 2,
  burst1: s => s.bursts >= 1,
  collapse1: s => s.collapses >= 1,
};

function applyObjectiveReward(id, s) {
  switch (id) {
    case 'tap10': addCharge(60, s); break;
    case 'buy3': s.stardust += 1; s.perkPicksLeft += 1; s.perkChoices = []; break;
    case 'devour20': s.tempMult = 2; s.tempUntil = Date.now() + 180000; break;
    case 'place2': s.emitterExtra += 1; break;
    case 'burst1': s.burstExtra += 3; break;
    case 'collapse1': s.perkSlotExtra += 1; break;
    default: break;
  }
}

export function objectiveDone(id, s = state) { return !!s.objectives[id]; }
export function objectiveCount(s = state) {
  let n = 0;
  for (const o of OBJECTIVES) if (s.objectives[o.id]) n++;
  return n;
}

export function checkObjectives(s = state) {
  const done = [];
  for (const o of OBJECTIVES) {
    if (s.objectives[o.id]) continue;
    const fn = OBJECTIVE_CHECKS[o.id];
    if (!fn || !fn(s)) continue;
    s.objectives[o.id] = 1;
    applyObjectiveReward(o.id, s);
    done.push(o);
  }
  return done;
}

export function starLevel(id, s = state) { return s.starUp[id] || 0; }
export function achCount(s = state) { return Object.keys(s.ach).length; }
export function totalGens(s = state) {
  let n = 0;
  for (let i = 0; i < s.gens.length; i++) n += s.gens[i];
  return n;
}

/* ---------------- 共振节拍 ---------------- */
export function resoMax(s = state) { return morphAgg(s).resoMax || RESO_MAX; }

export function pulsePeriod(s = state) {
  return PULSE_PERIOD / ((1 + perkAgg(s).tempo) * (morphAgg(s).pulseSpeed || 1));
}

export function pulsePhase(now = Date.now(), s = state) {
  const start = s.pulseStart || now;
  const p = pulsePeriod(s) * 1000;
  let ph = ((now - start) % p) / p;
  if (ph < 0) ph += 1;
  return ph;
}

export function perfectWindow(s = state) {
  const w = PERFECT_WINDOW * (1 + perkAgg(s).perfectWindow + 0.06 * starLevel('perfect', s));
  return Math.min(0.45, w);
}

export function isPerfect(now = Date.now(), s = state) {
  const ph = pulsePhase(now, s);
  const w = perfectWindow(s);
  if (ph >= 1 - w) return true;
  if (ph <= w * 0.33) return true;
  return false;
}

/* ---------------- 倍率与产量 ---------------- */
export function gameSpeed(s = state) {
  return 1 + 0.08 * starLevel('speed', s) + 0.10 * s.shards;
}

export function boostActive(now = Date.now(), s = state) { return now < s.boostUntil; }
export function boostMult(now = Date.now(), s = state) { return boostActive(now, s) ? s.boostMult : 1; }
export function burstActive(now = Date.now(), s = state) { return now < s.burstUntil; }
export function chainActive(now = Date.now(), s = state) { return now < (s.chainUntil || 0); }

export function burstDuration(s = state) {
  return (BURST_DURATION + 1.5 * starLevel('burst', s) + (s.burstExtra || 0)) * morphAgg(s).burstDurationMult;
}
export function boostDuration(s = state) { return 30 + 3 * starLevel('orb', s); }
export function burstMult(s = state) { return BURST_MULT * perkAgg(s).burstMult * morphAgg(s).burstMult; }

/* ---------------- 引力阵（空间优化解谜） ---------------- */
export function emptyLattice() {
  const n = LATTICE_SIZE * LATTICE_SIZE;
  const arr = new Array(n);
  for (let i = 0; i < n; i++) arr[i] = null;
  return arr;
}

export function latticeUnlocked(s = state) {
  return seedAgg(s).latticeNow > 0 || s.totalAll >= LATTICE_UNLOCK;
}
export function genElement(typeIdx) { return GEN_ELEMENT[typeIdx] || 'grav'; }
export function elementById(id) {
  for (let i = 0; i < ELEMENTS.length; i++) if (ELEMENTS[i].id === id) return ELEMENTS[i];
  return ELEMENTS[0];
}

function nodeRowCol(idx) {
  return [Math.floor(idx / LATTICE_SIZE), idx % LATTICE_SIZE];
}

export function nodeDistance(idx) {
  const rc = nodeRowCol(idx);
  return Math.abs(rc[0] - 2) + Math.abs(rc[1] - 2);
}

export function nodeTierMult(idx) {
  const d = Math.min(4, Math.max(1, nodeDistance(idx)));
  return TIER_MULT[d] || 0.55;
}

export function orthNeighbors(idx) {
  const rc = nodeRowCol(idx);
  const r = rc[0];
  const c = rc[1];
  const out = [];
  if (r > 0) out.push(idx - LATTICE_SIZE);
  if (r < LATTICE_SIZE - 1) out.push(idx + LATTICE_SIZE);
  if (c > 0) out.push(idx - 1);
  if (c < LATTICE_SIZE - 1) out.push(idx + 1);
  return out;
}

export function latticeSlots(s = state) {
  return Math.min(10, EMITTER_BASE + starLevel('emitters', s) + Math.floor(s.collapses / 3)
    + seedAgg(s).emitterBonus + (s.emitterExtra || 0));
}

export function placedCount(s = state) {
  let n = 0;
  const L = s.lattice || [];
  for (let i = 0; i < L.length; i++) if (L[i]) n++;
  return n;
}

export function placedTypes(s = state) {
  const out = [];
  const L = s.lattice || [];
  for (let i = 0; i < L.length; i++) if (L[i]) out.push(L[i].t);
  return out;
}

// 是否通过已放置节点连回核心（曼哈顿距离 1 的格子算直连）
export function latticeOnline(s, idx) {
  const seen = {};
  const stack = [idx];
  let guard = 0;
  while (stack.length && guard++ < 64) {
    const cur = stack.pop();
    if (seen[cur]) continue;
    seen[cur] = 1;
    if (nodeDistance(cur) === 1) return true;
    const nb = orthNeighbors(cur);
    for (let i = 0; i < nb.length; i++) {
      const n = nb[i];
      if (s.lattice[n] && !seen[n]) stack.push(n);
    }
  }
  return false;
}

// 单格最终倍率 = 距离档位 × (1 + 相邻系反应) × 潮汐 × 连通
export function latticeNodeMult(s, idx) {
  const cell = (s.lattice || [])[idx];
  if (!cell) return 0;
  const el = genElement(cell.t);
  let bonus = 0;
  const nb = orthNeighbors(idx);
  for (let i = 0; i < nb.length; i++) {
    const c2 = s.lattice[nb[i]];
    if (!c2) continue;
    const row = REACTION[el] || {};
    const r = row[genElement(c2.t)];
    if (typeof r === 'number') bonus += r;
  }
  let m = nodeTierMult(idx) * Math.max(0.35, 1 + bonus);
  if (el === (ELEMENTS[s.tideIdx] || ELEMENTS[0]).id) m *= TIDE_MULT;
  if (!latticeOnline(s, idx)) m *= OFFLINE_NODE_MULT;
  return m;
}

export function latticeProd(s = state) {
  const L = s.lattice;
  if (!L) return 0;
  let sum = 0;
  for (let i = 0; i < L.length; i++) {
    const cell = L[i];
    if (!cell) continue;
    const g = GENERATORS[cell.t];
    if (!g) continue;
    sum += s.gens[cell.t] * g.prod * latticeNodeMult(s, i);
  }
  return sum * LATTICE_SCALE;
}

export function tideElement(s = state) { return ELEMENTS[s.tideIdx] || ELEMENTS[0]; }

export function placeEmitter(s, idx, typeIdx) {
  if (!latticeUnlocked(s)) return null;
  if (idx === LATTICE_CENTER) return null;
  if (idx < 0 || idx >= LATTICE_SIZE * LATTICE_SIZE) return null;
  if (s.lattice[idx]) return null;
  if (placedCount(s) >= latticeSlots(s)) return null;
  if (placedTypes(s).indexOf(typeIdx) >= 0) return null;
  if (!(s.gens[typeIdx] > 0)) return null;
  s.lattice[idx] = { t: typeIdx };
  return { idx, t: typeIdx };
}

export function removeEmitter(s, idx) {
  if (!s.lattice[idx]) return null;
  const t = s.lattice[idx].t;
  s.lattice[idx] = null;
  return { idx, t };
}

export function clearLattice(s = state) {
  s.lattice = emptyLattice();
  return true;
}

export function moveEmitter(s, from, to) {
  if (!s.lattice[from] || s.lattice[to] || to === LATTICE_CENTER) return null;
  if (to < 0 || to >= LATTICE_SIZE * LATTICE_SIZE) return null;
  const t = s.lattice[from].t;
  s.lattice[from] = null;
  s.lattice[to] = { t };
  return { from, to, t };
}

export function baseProd(s = state) {
  let sum = 0;
  for (let i = 0; i < GENERATORS.length; i++) sum += s.gens[i] * GENERATORS[i].prod;
  return sum;
}

export function rawProd(s = state) {
  return baseProd(s) + latticeProd(s);
}

export function globalMult(now = Date.now(), s = state, opts) {
  const a = perkAgg(s);
  const m = morphAgg(s);
  let v = 1;
  v *= 1 + 0.25 * starLevel('resonance', s);
  v *= 1 + ACH_BONUS * achCount(s);
  v *= 1 + s.shards;
  v *= 1 + Math.min(s.reso, resoMax(s)) * RESO_BONUS;
  v *= a.prodMult;
  // 吞噬收益走 noMorphProd 口径：噬渊的产量惩罚不该抵消它自己的吞噬加成
  if (!opts || !opts.noMorphProd) v *= m.prodMult;
  v *= 1 + a.swarm * totalGens(s);
  if (chainActive(now, s)) v *= a.chainMult;
  if (burstActive(now, s)) v *= burstMult(s);
  v *= tempMult(now, s);
  const sg = seedAgg(s);
  if (sg.earlyProd !== 1 && s.totalAll < EARLY_PROD_UNTIL) v *= sg.earlyProd;
  return v;
}

export function eps(now = Date.now(), s = state) {
  return rawProd(s) * globalMult(now, s) * boostMult(now, s);
}

export function clickMult(s = state) {
  return Math.pow(1.8, starLevel('clickSync', s)) * morphAgg(s).clickMult * seedAgg(s).clickMult;
}
export function comboMult(s = state) { return 1 + Math.min(s.combo, COMBO_MAX) * COMBO_STEP; }
export function critChance(s = state) { return Math.min(0.9, CRIT_CHANCE + perkAgg(s).critChance); }
export function critMult(s = state) { return CRIT_MULT * perkAgg(s).critMult; }

export function clickPower(now = Date.now(), s = state) {
  return (1 + CLICK_SHARE * eps(now, s)) * clickMult(s) * perkAgg(s).clickMult;
}

export function clickGain(now = Date.now(), s = state) {
  return clickPower(now, s) * comboMult(s);
}

export function offlineEff(s = state) {
  return Math.min(1, OFFLINE_BASE + 0.05 * starLevel('offline', s) + perkAgg(s).offlineEffAdd);
}
export function offlineCap(s = state) {
  return OFFLINE_CAP * perkAgg(s).offlineCapMult;
}
export function orbInterval(s = state) {
  return 80 / (1 + 0.12 * starLevel('orb', s) + perkAgg(s).orbFreq);
}

/* ---------------- 价格 ---------------- */
export function genCost(i, n = 1, s = state) {
  const g = GENERATORS[i];
  const r = g.growth;
  const raw = g.base * Math.pow(r, s.gens[i]) * (Math.pow(r, n) - 1) / (r - 1);
  return raw * perkAgg(s).costMult * seedAgg(s).costMult;
}

export function maxAffordable(i, s = state) {
  const g = GENERATORS[i];
  const r = g.growth;
  const cm = perkAgg(s).costMult * seedAgg(s).costMult;
  const unit = g.base * Math.pow(r, s.gens[i]) * cm;
  if (s.energy < unit) return 0;
  const n = Math.floor(Math.log(1 + (s.energy * (r - 1)) / unit) / Math.log(r));
  return Math.max(0, n);
}

export function starCost(id, s = state) {
  const u = STAR_UPGRADES.find(x => x.id === id);
  if (!u) return Infinity;
  return Math.floor(u.base * Math.pow(u.growth, starLevel(id, s)));
}
export function starMaxed(id, s = state) {
  const u = STAR_UPGRADES.find(x => x.id === id);
  return u ? starLevel(id, s) >= u.max : true;
}

/* ---------------- 行为 ---------------- */
export function addEnergy(v, s = state) {
  s.energy += v;
  s.totalRun += v;
  s.totalAll += v;
}
export function addCharge(v, s = state) {
  s.charge = Math.max(0, Math.min(CHARGE_MAX, s.charge + v));
}

export function tap(now = Date.now(), s = state) {
  if (now - s.comboAt < COMBO_WINDOW * 1000) s.combo = Math.min(COMBO_MAX, s.combo + 1);
  else s.combo = 1;
  s.comboAt = now;
  if (s.combo > s.maxCombo) s.maxCombo = s.combo;

  const mor = morphAgg(s);
  const split = Math.max(1, Math.min(6, Math.floor(mor.clickSplit || 1)));
  const bursting = burstActive(now, s);

  let total = 0;
  let perfectCount = 0;
  let anyCrit = false;

  for (let i = 0; i < split; i++) {
    const perfect = bursting || isPerfect(now, s);
    const crit = Math.random() < critChance(s);
    let g = clickGain(now, s);
    if (perfect) g *= PERFECT_MULT;
    if (crit) g *= critMult(s);
    addEnergy(g, s);
    total += g;
    if (perfect) perfectCount++;
    if (crit) anyCrit = true;
  }

  s.clicks++;
  let echo = false;

  if (perfectCount > 0) {
    s.perfects += perfectCount;
    const a = perkAgg(s);
    let add = perfectCount * (1 + seedAgg(s).perfectReso);
    if (a.echoChance > 0 && Math.random() < a.echoChance) { add += 1; echo = true; }
    s.reso = Math.min(resoMax(s), s.reso + add);
    if (s.reso > s.maxReso) s.maxReso = s.reso;
    s.resoAt = now;
    if (a.chainTime > 0) s.chainUntil = now + a.chainTime * 1000;
    addCharge(CHARGE_PERFECT * perfectCount, s);
  }
  if (perfectCount < split) addCharge(CHARGE_CLICK * (split - perfectCount), s);
  if (s.recording) recordTap(perfectCount > 0, now, s);

  return { gain: total, perfect: perfectCount > 0, perfects: perfectCount, crit: anyCrit, echo, combo: s.combo, reso: s.reso, split };
}

export function devourGain(now = Date.now(), s = state) {
  const mult = perkAgg(s).devourMult * morphAgg(s).devourMult * seedAgg(s).devourMult;
  const base = rawProd(s) * globalMult(now, s, { noMorphProd: true }) * boostMult(now, s);
  return Math.max(1, base * DEVOUR_BASE * mult);
}
export function devour(now = Date.now(), s = state) {
  const g = devourGain(now, s);
  addEnergy(g, s);
  s.devoured++;
  s.absorbedTotal += g;
  addCharge(0.9, s);
  const rd = morphAgg(s).resoPerDevour;
  if (rd > 0) {
    s.reso = Math.min(resoMax(s), s.reso + rd);
    if (s.reso > s.maxReso) s.maxReso = s.reso;
    s.resoAt = now;
  }
  return g;
}

export function burstReady(s = state) { return s.charge >= CHARGE_MAX; }
export function doBurst(now = Date.now(), s = state) {
  if (!burstReady(s)) return null;
  const dur = burstDuration(s);
  s.charge = 0;
  s.bursts++;
  s.burstUntil = now + dur * 1000;
  return { duration: dur, mult: burstMult(s) };
}

/* ---------------- 残响录制 ---------------- */
export function startRecord(now = Date.now(), s = state) {
  if (!echoUnlocked(s)) return null;
  s.recording = true;
  s.recordStart = now;
  s.recordBuf = [];
  s.recordLen = RECORD_LEN;
  return RECORD_LEN;
}
export function recordProgress(now = Date.now(), s = state) {
  if (!s.recording) return 0;
  return Math.max(0, 1 - (now - s.recordStart) / (s.recordLen * 1000));
}
function recordTap(perfect, now, s) {
  if (!s.recording) return;
  const t = (now - s.recordStart) / 1000;
  if (t < 0 || t > s.recordLen) return;
  if (s.recordBuf.length >= ECHO_MAX_TAPS) return;
  s.recordBuf.push({ t: Math.round(t * 100) / 100, perfect: !!perfect });
}
export function finishRecord(now = Date.now(), s = state) {
  if (!s.recording) return null;
  s.recording = false;
  const taps = (s.recordBuf || []).slice().sort((a, b) => a.t - b.t);
  const rate = taps.length ? taps.filter(t => t.perfect).length / taps.length : 0;
  s.echo = { taps, len: Math.max(1, s.recordLen), rate };
  s.recordBuf = [];
  s.echoAcc = 0;
  s.echoIdx = 0;
  return s.echo;
}
export function clearEcho(s = state) {
  s.echo = null;
  s.echoAcc = 0;
  s.echoIdx = 0;
  return true;
}

// 残响自动演奏：把自己录下的操作循环重放
export function echoTick(dt, now = Date.now(), s = state) {
  const e = s.echo;
  if (!e || !e.taps || e.taps.length === 0) return 0;
  let total = 0;
  s.echoAcc = (s.echoAcc || 0) + dt;
  let guard = 0;
  while (s.echoIdx < e.taps.length && e.taps[s.echoIdx].t <= s.echoAcc && guard++ < 200) {
    const t = e.taps[s.echoIdx++];
    let g = clickPower(now, s) * ECHO_RATE;
    if (t.perfect) g *= PERFECT_MULT;
    addEnergy(g, s);
    total += g;
    s.echoHits = (s.echoHits || 0) + 1;
    if (t.perfect) {
      s.reso = Math.min(resoMax(s), s.reso + 1);
      s.resoAt = now;
    }
  }
  if (s.echoAcc >= e.len) {
    s.echoAcc -= e.len;
    if (s.echoAcc < 0) s.echoAcc = 0;
    s.echoIdx = 0;
  }
  return total;
}

export function buyGen(i, amount = 1, s = state) {
  const max = maxAffordable(i, s);
  if (max <= 0) return null;
  const n = amount === 'max' ? max : Math.min(Math.floor(amount), max);
  if (n <= 0) return null;
  const cost = genCost(i, n, s);
  if (s.energy < cost) return null;
  s.energy -= cost;
  s.gens[i] += n;
  s.bought[i] += n;
  return { n, cost };
}

export function buyStar(id, s = state) {
  if (starMaxed(id, s)) return null;
  const cost = starCost(id, s);
  if (s.stardust < cost) return null;
  s.stardust -= cost;
  s.starUp[id] = starLevel(id, s) + 1;
  return { cost, level: s.starUp[id] };
}

/* ---------------- 转生 ---------------- */
export function stardustGain(s = state) {
  const mult = perkAgg(s).stardustMult;
  return Math.floor(Math.pow(s.totalRun / COLLAPSE_REQUIRE, 0.5) * 5 * mult);
}
export function canCollapse(s = state) { return stardustGain(s) >= 1; }
export function startEnergy(s = state) {
  const lv = starLevel('headstart', s);
  return lv > 0 ? Math.pow(10, 3 * lv) : 0;
}

export function perkSlots(s = state) { return 2 + starLevel('slots', s) + (s.perkSlotExtra || 0); }

export function rollPerkChoices(s = state, n = 3) {
  const taken = s.perks || [];
  const cur = s.perkChoices || [];
  const avail = PERKS.filter(p => taken.indexOf(p.id) < 0 && cur.indexOf(p.id) < 0);
  const out = [];
  while (out.length < n && avail.length) {
    const total = avail.reduce((a, p) => a + RARE_WEIGHT[p.rare], 0);
    let r = Math.random() * total;
    let idx = avail.length - 1;
    for (let j = 0; j < avail.length; j++) {
      r -= RARE_WEIGHT[avail[j].rare];
      if (r <= 0) { idx = j; break; }
    }
    out.push(avail[idx].id);
    avail.splice(idx, 1);
  }
  return out;
}

export function ensureChoices(s = state) {
  if (s.perkPicksLeft > 0 && (!s.perkChoices || s.perkChoices.length === 0)) {
    s.perkChoices = rollPerkChoices(s);
  }
  return s.perkChoices;
}

export function pickPerk(id, s = state) {
  if (s.perkPicksLeft <= 0) return null;
  if (!s.perkChoices || s.perkChoices.indexOf(id) < 0) return null;
  s.perks.push(id);
  s.perksTaken++;
  s.perkPicksLeft--;
  s.perkChoices = [];
  return { id, left: s.perkPicksLeft, perk: PERK_BY_ID[id] || null };
}

export function rerollCost(s = state) { return Math.floor(REROLL_COST * Math.pow(1.7, s.rerolls || 0)); }
export function rerollPerks(s = state) {
  const c = rerollCost(s);
  if (s.stardust < c) return null;
  s.stardust -= c;
  s.rerolls = (s.rerolls || 0) + 1;
  s.perkChoices = rollPerkChoices(s);
  return s.perkChoices;
}
export function skipPerk(s = state) {
  if (s.perkPicksLeft <= 0) return null;
  s.perkPicksLeft--;
  s.perkChoices = [];
  s.stardust += 1;
  return { stardust: 1 };
}

export function doCollapse(now = Date.now(), s = state) {
  const gain = stardustGain(s);
  if (gain < 1) return null;
  s.stardust += gain;
  s.totalStardust += gain;
  s.collapses++;
  resetRun(s);
  s.perks = [];
  s.perkChoices = [];
  s.rerolls = 0;
  s.perkPicksLeft = perkSlots(s);
  const start = startEnergy(s);
  if (start > 0) addEnergy(start, s);
  s.pulseStart = now;
  return { gain, start, picks: s.perkPicksLeft };
}

function resetRun(s) {
  s.energy = 0;
  s.totalRun = 0;
  s.gens = GENERATORS.map(() => 0);
  s.bought = GENERATORS.map(() => 0);
  s.combo = 0;
  s.comboAt = 0;
  s.reso = 0;
  s.resoAt = 0;
  s.charge = 0;
  s.burstUntil = 0;
  s.chainUntil = 0;
  s.echoAcc = 0;
  s.echoIdx = 0;
}

export function shardGain(s = state) {
  return Math.floor(Math.pow(s.totalStardust / SINGULARITY_REQUIRE, 0.5) * 3);
}
export function canSingularity(s = state) { return shardGain(s) >= 1; }
export function doSingularity(now = Date.now(), s = state) {
  const gain = shardGain(s);
  if (gain < 1) return null;
  s.shards += gain;
  s.totalShards += gain;
  s.stardust = 0;
  s.totalStardust = 0;
  s.starUp = {};
  s.autoBuy = false;
  s.morph = null;          // 飞升后可重选形态
  resetRun(s);
  s.perks = [];
  s.perkChoices = [];
  s.perkPicksLeft = perkSlots(s);
  s.rerolls = 0;
  s.pulseStart = now;
  return { gain, picks: s.perkPicksLeft, morphReset: true };
}

export function checkAchievements(s = state) {
  const got = [];
  for (const a of ACHIEVEMENTS) {
    if (!s.ach[a.id] && a.cond(s)) {
      s.ach[a.id] = true;
      got.push(a);
    }
  }
  return got;
}

/* ---------------- 自动 & 主循环 ---------------- */
export function autoBuyTick(s = state) {
  if (!s.autoBuy || starLevel('autoBuy', s) < 1) return -1;
  let best = -1;
  let bestCost = Infinity;
  for (let i = 0; i < GENERATORS.length; i++) {
    const c = genCost(i, 1, s);
    if (c <= s.energy && c < bestCost) { bestCost = c; best = i; }
  }
  if (best >= 0) { buyGen(best, 1, s); return best; }
  return -1;
}

export function tick(dt, now = Date.now(), s = state) {
  const d = dt * gameSpeed(s);
  s.playTime += dt;
  if (!s.pulseStart) s.pulseStart = now;

  const gain = eps(now, s) * d;
  if (gain > 0) addEnergy(gain, s);

  const ac = starLevel('autoClick', s) + perkAgg(s).autoClick;
  if (ac > 0) addEnergy(clickPower(now, s) * ac * d, s);

  echoTick(d, now, s);

  addCharge(d * (0.9 + 0.06 * Math.min(s.reso, resoMax(s))), s);

  const decay = morphAgg(s).resoDecayMult;
  if (decay !== 0 && s.reso > 0 && now - s.resoAt > RESO_DECAY * 1000) {
    s.resoDecayAcc += dt * decay;
    if (s.resoDecayAcc >= 0.55) { s.resoDecayAcc = 0; s.reso--; }
  } else {
    s.resoDecayAcc = 0;
  }

  // 引力潮汐轮换
  if (!s.tideStart) s.tideStart = now;
  const tideNext = Math.floor(Math.max(0, now - s.tideStart) / (TIDE_PERIOD * 1000)) % ELEMENTS.length;
  if (tideNext !== s.tideIdx) s.tideIdx = tideNext;

  if (s.combo > 0 && now - s.comboAt > COMBO_WINDOW * 1000) s.combo = 0;

  return gain;
}

export function applyOffline(now = Date.now(), s = state) {
  const elapsed = Math.max(0, (now - s.lastSave) / 1000);
  s.lastSave = now;
  if (elapsed < 60) return null;
  const capped = Math.min(elapsed, offlineCap(s));
  const eff = offlineEff(s);
  const gain = eps(now, s) * capped * eff;
  if (!(gain > 0)) return null;
  addEnergy(gain, s);
  return { seconds: capped, total: elapsed, gain, eff };
}

/* ---------------- 存档 ---------------- */
export function serialize(s = state) { return JSON.stringify(s); }

export function save(now = Date.now(), s = state) {
  s.lastSave = now;
  try { localStorage.setItem(SAVE_KEY, serialize(s)); return true; } catch (e) { return false; }
}

const NUM_KEYS = ['energy', 'totalRun', 'totalAll', 'clicks', 'perfects', 'devoured', 'absorbedTotal',
  'combo', 'maxCombo', 'reso', 'maxReso', 'charge', 'stardust', 'totalStardust', 'shards', 'totalShards',
  'collapses', 'orbsTapped', 'bursts', 'playTime', 'perksTaken', 'perkPicksLeft', 'rerolls', 'echoHits'];

// 必须返回新对象：Object.assign(data, base, data) 会让默认值反向覆盖存档
export function normalize(data) {
  const base = newState();
  const s = Object.assign({}, base, (data && typeof data === 'object') ? data : {});

  const rg = Array.isArray(s.gens) ? s.gens : [];
  s.gens = GENERATORS.map((_, i) => (typeof rg[i] === 'number' && Number.isFinite(rg[i]) && rg[i] > 0) ? Math.floor(rg[i]) : 0);
  const rb = Array.isArray(s.bought) ? s.bought : [];
  s.bought = GENERATORS.map((_, i) => (typeof rb[i] === 'number' && Number.isFinite(rb[i]) && rb[i] > 0) ? Math.floor(rb[i]) : s.gens[i]);

  if (!s.starUp || typeof s.starUp !== 'object') s.starUp = {};
  if (!s.ach || typeof s.ach !== 'object') s.ach = {};

  const validPerk = id => !!PERK_BY_ID[id];
  s.perks = Array.isArray(s.perks) ? s.perks.filter(validPerk).slice(0, 12) : [];
  s.perkChoices = Array.isArray(s.perkChoices) ? s.perkChoices.filter(validPerk) : [];
  if (typeof s.perkPicksLeft !== 'number' || !Number.isFinite(s.perkPicksLeft) || s.perkPicksLeft < 0) s.perkPicksLeft = 0;

  if (s.morph && !MORPH_BY_ID[s.morph]) s.morph = null;
  if (s.seed && !SEED_BY_ID[s.seed]) s.seed = null;
  if (!s.objectives || typeof s.objectives !== 'object') s.objectives = {};
  if (typeof s.tempMult !== 'number' || !Number.isFinite(s.tempMult) || s.tempMult < 1) s.tempMult = 1;
  if (typeof s.tempUntil !== 'number' || !Number.isFinite(s.tempUntil) || s.tempUntil < 0) s.tempUntil = 0;
  const extraKeys = ['emitterExtra', 'burstExtra', 'perkSlotExtra'];
  for (const ek of extraKeys) {
    if (typeof s[ek] !== 'number' || !Number.isFinite(s[ek]) || s[ek] < 0) s[ek] = 0;
  }

  // 引力阵：只保留合法且不重复的放置
  const rawLat = Array.isArray(s.lattice) ? s.lattice : [];
  const seenType = {};
  s.lattice = emptyLattice();
  for (let i = 0; i < s.lattice.length; i++) {
    if (i === LATTICE_CENTER) continue;
    const c = rawLat[i];
    if (!c || typeof c !== 'object') continue;
    const t = Math.floor(c.t);
    if (!Number.isFinite(t) || t < 0 || t >= GENERATORS.length) continue;
    if (seenType[t]) continue;
    seenType[t] = 1;
    s.lattice[i] = { t };
  }
  if (typeof s.tideIdx !== 'number' || !Number.isFinite(s.tideIdx) || s.tideIdx < 0 || s.tideIdx >= ELEMENTS.length) s.tideIdx = 0;
  if (typeof s.tideStart !== 'number' || !Number.isFinite(s.tideStart) || s.tideStart < 0) s.tideStart = 0;

  if (s.echo && typeof s.echo === 'object' && Array.isArray(s.echo.taps)) {
    s.echo.taps = s.echo.taps
      .filter(t => t && typeof t.t === 'number' && Number.isFinite(t.t) && t.t >= 0)
      .slice(0, ECHO_MAX_TAPS);
    if (typeof s.echo.len !== 'number' || !Number.isFinite(s.echo.len) || s.echo.len <= 0) s.echo.len = RECORD_LEN;
    if (typeof s.echo.rate !== 'number' || !Number.isFinite(s.echo.rate)) s.echo.rate = 0;
  } else {
    s.echo = null;
  }
  if (typeof s.echoAcc !== 'number' || !Number.isFinite(s.echoAcc) || s.echoAcc < 0) s.echoAcc = 0;
  if (typeof s.echoIdx !== 'number' || !Number.isFinite(s.echoIdx) || s.echoIdx < 0) s.echoIdx = 0;
  s.recording = false;
  s.recordBuf = [];
  s.recordLen = RECORD_LEN;

  for (const k of NUM_KEYS) {
    if (typeof s[k] !== 'number' || !Number.isFinite(s[k]) || s[k] < 0) s[k] = 0;
  }
  for (const u of STAR_UPGRADES) {
    const lv = s.starUp[u.id];
    if (typeof lv !== 'number' || !Number.isFinite(lv) || lv < 0) s.starUp[u.id] = 0;
    else s.starUp[u.id] = Math.min(u.max, Math.floor(lv));
  }
  if (s.perks.length > perkSlots(s)) s.perks = s.perks.slice(0, perkSlots(s));

  s.version = SAVE_VERSION;
  return s;
}

export function load(s = state) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    Object.assign(s, normalize(JSON.parse(raw)));
    return true;
  } catch (e) { return false; }
}

export function exportSave(s = state) {
  const json = serialize(s);
  try { return 'XEQ2.' + btoa(unescape(encodeURIComponent(json))); } catch (e) { return json; }
}

export function importSave(str, s = state) {
  try {
    let raw = String(str || '').trim();
    if (!raw) return false;
    if (raw.startsWith('XEQ2.')) raw = decodeURIComponent(escape(atob(raw.slice(5))));
    else if (raw.startsWith('XEQ1.')) raw = decodeURIComponent(escape(atob(raw.slice(5))));
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return false;
    Object.assign(s, normalize(parsed));
    return true;
  } catch (e) { return false; }
}

export function hardReset(s = state) {
  Object.assign(s, newState());
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 忽略 */ }
  return true;
}
