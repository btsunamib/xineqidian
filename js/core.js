// 核心逻辑：纯数据运算，不接触 DOM，便于单元测试
import {
  GENERATORS, STAR_UPGRADES, ACHIEVEMENTS,
  COLLAPSE_REQUIRE, SINGULARITY_REQUIRE, OFFLINE_CAP, OFFLINE_BASE,
  ACH_BONUS, COMBO_WINDOW, COMBO_STEP, COMBO_MAX,
  CRIT_CHANCE, CRIT_MULT, BOOST_DURATION, BOOST_MULT, CLICK_SHARE,
} from './data.js';

export const SAVE_KEY = 'xineqidian_save_v1';
export const SAVE_VERSION = 1;

export function newState() {
  return {
    version: SAVE_VERSION,
    energy: 0,
    totalRun: 0,
    totalAll: 0,
    clicks: 0,
    gens: GENERATORS.map(() => 0),
    bought: GENERATORS.map(() => 0),
    starUp: {},
    stardust: 0,
    totalStardust: 0,
    shards: 0,
    totalShards: 0,
    collapses: 0,
    orbsTapped: 0,
    maxCombo: 0,
    combo: 0,
    comboAt: 0,
    boostUntil: 0,
    boostMult: BOOST_MULT,
    playTime: 0,
    ach: {},
    autoBuy: false,
    bulk: 1,
    haptics: true,
    fxOn: true,
    nextOrbAt: 0,
    lastSave: Date.now(),
    startedAt: Date.now(),
  };
}

export const state = newState();

/* ---------------- 倍率与产量 ---------------- */

export function starLevel(id, s = state) { return s.starUp[id] || 0; }

export function achCount(s = state) { return Object.keys(s.ach).length; }

export function globalMult(s = state) {
  let m = 1;
  m *= 1 + 0.30 * starLevel('resonance', s);   // 星尘共鸣
  m *= 1 + ACH_BONUS * achCount(s);            // 成就
  m *= 1 + s.shards;                           // 奇点碎片：每片 +100%
  return m;
}

export function gameSpeed(s = state) {
  return 1 + 0.08 * starLevel('speed', s) + 0.10 * s.shards;
}

export function boostActive(now = Date.now(), s = state) { return now < s.boostUntil; }

export function boostMult(now = Date.now(), s = state) {
  return boostActive(now, s) ? s.boostMult : 1;
}

export function rawProd(s = state) {
  let sum = 0;
  for (let i = 0; i < GENERATORS.length; i++) sum += s.gens[i] * GENERATORS[i].prod;
  return sum;
}

export function eps(now = Date.now(), s = state) {
  return rawProd(s) * globalMult(s) * boostMult(now, s);
}

export function clickMult(s = state) { return Math.pow(2, starLevel('clickSync', s)); }

export function comboMult(s = state) {
  return 1 + Math.min(s.combo, COMBO_MAX) * COMBO_STEP;
}

export function clickPower(now = Date.now(), s = state) {
  return (1 + CLICK_SHARE * eps(now, s)) * clickMult(s);
}

export function clickGain(now = Date.now(), s = state) {
  return clickPower(now, s) * comboMult(s);
}

export function offlineEff(s = state) {
  return Math.min(1, OFFLINE_BASE + 0.05 * starLevel('offline', s));
}

export function orbInterval(s = state) {
  const base = 75;
  return base / (1 + 0.12 * starLevel('orb', s));
}

export function boostDuration(s = state) {
  return BOOST_DURATION + 3 * starLevel('orb', s);
}

/* ---------------- 价格 ---------------- */

export function genCost(i, n = 1, s = state) {
  const g = GENERATORS[i];
  const r = g.growth;
  return g.base * Math.pow(r, s.gens[i]) * (Math.pow(r, n) - 1) / (r - 1);
}

export function maxAffordable(i, s = state) {
  const g = GENERATORS[i];
  const r = g.growth;
  const unit = g.base * Math.pow(r, s.gens[i]);
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

export function tap(now = Date.now(), s = state) {
  if (now - s.comboAt < COMBO_WINDOW * 1000) s.combo = Math.min(COMBO_MAX, s.combo + 1);
  else s.combo = 1;
  s.comboAt = now;
  if (s.combo > s.maxCombo) s.maxCombo = s.combo;

  const crit = Math.random() < CRIT_CHANCE;
  const gain = clickGain(now, s) * (crit ? CRIT_MULT : 1);
  addEnergy(gain, s);
  s.clicks++;
  return { gain, crit, combo: s.combo };
}

// amount: 数字或 'max'。返回实际购买结果
export function buyGen(i, amount = 1, s = state) {
  const max = maxAffordable(i, s);
  if (max <= 0) return null;
  let n = amount === 'max' ? max : Math.min(Math.floor(amount), max);
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

export function stardustGain(s = state) {
  return Math.floor(Math.pow(s.totalRun / COLLAPSE_REQUIRE, 0.5) * 5);
}

export function canCollapse(s = state) { return stardustGain(s) >= 1; }

export function startEnergy(s = state) {
  const lv = starLevel('headstart', s);
  return lv > 0 ? Math.pow(10, 3 * lv) : 0;
}

export function doCollapse(s = state) {
  const gain = stardustGain(s);
  if (gain < 1) return null;
  s.stardust += gain;
  s.totalStardust += gain;
  s.collapses++;
  resetRun(s);
  const start = startEnergy(s);
  if (start > 0) addEnergy(start, s);
  return { gain, start };
}

function resetRun(s) {
  s.energy = 0;
  s.totalRun = 0;
  s.gens = GENERATORS.map(() => 0);
  s.bought = GENERATORS.map(() => 0);
  s.combo = 0;
  s.comboAt = 0;
}

export function shardGain(s = state) {
  return Math.floor(Math.pow(s.totalStardust / SINGULARITY_REQUIRE, 0.5) * 3);
}

export function canSingularity(s = state) { return shardGain(s) >= 1; }

export function doSingularity(s = state) {
  const gain = shardGain(s);
  if (gain < 1) return null;
  s.shards += gain;
  s.totalShards += gain;
  s.stardust = 0;
  s.totalStardust = 0;
  s.starUp = {};
  s.autoBuy = false;
  resetRun(s);
  return { gain };
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

/* ---------------- 自动与离线 ---------------- */

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
  const spd = gameSpeed(s);
  const d = dt * spd;
  s.playTime += dt;

  const gain = eps(now, s) * d;
  if (gain > 0) addEnergy(gain, s);

  // 自动点击器：按点击力折算成被动收益（不计连击）
  const ac = starLevel('autoClick', s);
  if (ac > 0) addEnergy(clickPower(now, s) * ac * d, s);

  if (s.combo > 0 && now - s.comboAt > COMBO_WINDOW * 1000) s.combo = 0;

  return gain;
}

export function applyOffline(now = Date.now(), s = state) {
  const elapsed = Math.max(0, (now - s.lastSave) / 1000);
  s.lastSave = now;
  if (elapsed < 60) return null;
  const capped = Math.min(elapsed, OFFLINE_CAP);
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
  try {
    localStorage.setItem(SAVE_KEY, serialize(s));
    return true;
  } catch (e) {
    return false;
  }
}

// 必须返回新对象：Object.assign(data, base, data) 会让默认值反向覆盖存档
function normalize(data) {
  const base = newState();
  const s = Object.assign({}, base, (data && typeof data === 'object') ? data : {});
  const rawGens = Array.isArray(s.gens) ? s.gens : [];
  s.gens = GENERATORS.map((_, i) => (typeof rawGens[i] === 'number' && Number.isFinite(rawGens[i]) && rawGens[i] > 0) ? Math.floor(rawGens[i]) : 0);
  const rawBought = Array.isArray(s.bought) ? s.bought : [];
  s.bought = GENERATORS.map((_, i) => (typeof rawBought[i] === 'number' && Number.isFinite(rawBought[i]) && rawBought[i] > 0) ? Math.floor(rawBought[i]) : s.gens[i]);
  if (!s.starUp || typeof s.starUp !== 'object') s.starUp = {};
  if (!s.ach || typeof s.ach !== 'object') s.ach = {};
  for (const k of ['energy', 'totalRun', 'totalAll', 'clicks', 'stardust', 'totalStardust', 'shards', 'totalShards', 'collapses', 'orbsTapped', 'maxCombo', 'playTime']) {
    if (typeof s[k] !== 'number' || !Number.isFinite(s[k]) || s[k] < 0) s[k] = 0;
  }
  for (const u of STAR_UPGRADES) {
    const lv = s.starUp[u.id];
    if (typeof lv !== 'number' || !Number.isFinite(lv) || lv < 0) s.starUp[u.id] = 0;
    else s.starUp[u.id] = Math.min(u.max, Math.floor(lv));
  }
  s.version = SAVE_VERSION;
  return s;
}

export function load(s = state) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    Object.assign(s, normalize(JSON.parse(raw)));
    return true;
  } catch (e) {
    return false;
  }
}

export function exportSave(s = state) {
  const json = serialize(s);
  try {
    return 'XEQ1.' + btoa(unescape(encodeURIComponent(json)));
  } catch (e) {
    return json;
  }
}

export function importSave(str, s = state) {
  try {
    let raw = String(str || '').trim();
    if (!raw) return false;
    if (raw.startsWith('XEQ1.')) {
      raw = decodeURIComponent(escape(atob(raw.slice(5))));
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return false;
    Object.assign(s, normalize(parsed));
    return true;
  } catch (e) {
    return false;
  }
}

export function hardReset(s = state) {
  Object.assign(s, newState());
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 忽略 */ }
  return true;
}
