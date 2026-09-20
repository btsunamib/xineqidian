// ============ 核心逻辑（纯计算，不接触 DOM，可单元测试） ============
import {
  GENERATORS, STAR_UPGRADES, PERKS, ACHIEVEMENTS, RARE_WEIGHT,
  PULSE_PERIOD, PERFECT_WINDOW, PERFECT_MULT, RESO_MAX, RESO_BONUS, RESO_DECAY,
  CHARGE_MAX, CHARGE_CLICK, CHARGE_PERFECT, BURST_DURATION, BURST_MULT,
  CRIT_CHANCE, CRIT_MULT, COMBO_WINDOW, COMBO_STEP, COMBO_MAX,
  CLICK_SHARE, BOOST_MULT, DEVOUR_BASE,
  COLLAPSE_REQUIRE, SINGULARITY_REQUIRE, OFFLINE_CAP, OFFLINE_BASE, ACH_BONUS, REROLL_COST,
} from './data.js';

export const SAVE_KEY = 'xineqidian_save_v2';
export const SAVE_VERSION = 2;

export const PERK_BY_ID = {};
for (const p of PERKS) PERK_BY_ID[p.id] = p;

const MULT_KEYS = ['prodMult', 'clickMult', 'costMult', 'critMult', 'stardustMult', 'burstMult', 'chainMult', 'devourMult', 'offlineCapMult'];

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

export function starLevel(id, s = state) { return s.starUp[id] || 0; }
export function achCount(s = state) { return Object.keys(s.ach).length; }
export function totalGens(s = state) {
  let n = 0;
  for (let i = 0; i < s.gens.length; i++) n += s.gens[i];
  return n;
}

/* ---------------- 共振节拍 ---------------- */
export function pulsePeriod(s = state) {
  return PULSE_PERIOD / (1 + perkAgg(s).tempo);
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

export function burstDuration(s = state) { return BURST_DURATION + 1.5 * starLevel('burst', s); }
export function boostDuration(s = state) { return BOOST_DURATION + 3 * starLevel('orb', s); }
export function burstMult(s = state) { return BURST_MULT * perkAgg(s).burstMult; }

export function rawProd(s = state) {
  let sum = 0;
  for (let i = 0; i < GENERATORS.length; i++) sum += s.gens[i] * GENERATORS[i].prod;
  return sum;
}

export function globalMult(now = Date.now(), s = state) {
  const a = perkAgg(s);
  let m = 1;
  m *= 1 + 0.25 * starLevel('resonance', s);
  m *= 1 + ACH_BONUS * achCount(s);
  m *= 1 + s.shards;
  m *= 1 + Math.min(s.reso, RESO_MAX) * RESO_BONUS;
  m *= a.prodMult;
  m *= 1 + a.swarm * totalGens(s);
  if (chainActive(now, s)) m *= a.chainMult;
  if (burstActive(now, s)) m *= burstMult(s);
  return m;
}

export function eps(now = Date.now(), s = state) {
  return rawProd(s) * globalMult(now, s) * boostMult(now, s);
}

export function clickMult(s = state) { return Math.pow(1.8, starLevel('clickSync', s)); }
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
  return raw * perkAgg(s).costMult;
}

export function maxAffordable(i, s = state) {
  const g = GENERATORS[i];
  const r = g.growth;
  const cm = perkAgg(s).costMult;
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

  const bursting = burstActive(now, s);
  const perfect = bursting || isPerfect(now, s);
  const crit = Math.random() < critChance(s);

  let gain = clickGain(now, s);
  if (perfect) gain *= PERFECT_MULT;
  if (crit) gain *= critMult(s);
  addEnergy(gain, s);
  s.clicks++;

  let echo = false;
  if (perfect) {
    s.perfects++;
    const a = perkAgg(s);
    let add = 1;
    if (a.echoChance > 0 && Math.random() < a.echoChance) { add += 1; echo = true; }
    s.reso = Math.min(RESO_MAX, s.reso + add);
    if (s.reso > s.maxReso) s.maxReso = s.reso;
    s.resoAt = now;
    if (a.chainTime > 0) s.chainUntil = now + a.chainTime * 1000;
    addCharge(CHARGE_PERFECT, s);
  } else {
    addCharge(CHARGE_CLICK, s);
  }
  return { gain, perfect, crit, echo, combo: s.combo, reso: s.reso };
}

export function devourGain(now = Date.now(), s = state) {
  return Math.max(1, eps(now, s) * DEVOUR_BASE * perkAgg(s).devourMult);
}
export function devour(now = Date.now(), s = state) {
  const g = devourGain(now, s);
  addEnergy(g, s);
  s.devoured++;
  s.absorbedTotal += g;
  addCharge(0.9, s);
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

export function perkSlots(s = state) { return 2 + starLevel('slots', s); }

export function rollPerkChoices(s = state, n = 3) {
  const avail = PERKS.filter(p => !s.perks.includes(p.id) && !s.perkChoices.includes(p.id));
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
  if (s.perkPicksLeft > 0 && s.perkChoices.length === 0) {
    s.perkChoices = rollPerkChoices(s);
  }
  return s.perkChoices;
}

export function pickPerk(id, s = state) {
  if (s.perkPicksLeft <= 0) return null;
  const i = s.perkChoices.indexOf(id);
  if (i < 0) return null;
  s.perks.push(id);
  s.perksTaken++;
  s.perkPicksLeft--;
  s.perkChoices = [];
  return { id, left: s.perkPicksLeft };
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
  resetRun(s);
  s.perks = [];
  s.perkChoices = [];
  s.perkPicksLeft = perkSlots(s);
  s.rerolls = 0;
  s.pulseStart = now;
  return { gain, picks: s.perkPicksLeft };
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

  addCharge(d * (0.9 + 0.06 * Math.min(s.reso, RESO_MAX)), s);

  if (s.reso > 0 && now - s.resoAt > RESO_DECAY * 1000) {
    s.resoDecayAcc += dt;
    if (s.resoDecayAcc >= 0.55) { s.resoDecayAcc = 0; s.reso--; }
  } else {
    s.resoDecayAcc = 0;
  }

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
  'collapses', 'orbsTapped', 'bursts', 'playTime', 'perksTaken', 'perkPicksLeft', 'rerolls'];

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
