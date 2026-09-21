// ============ 界面渲染与交互 ============
import {
  GENERATORS, STAR_UPGRADES, PERKS, ACHIEVEMENTS, MORPHS,
  RARE_COLOR, RARE_LABEL, COMBO_MAX, COMBO_WINDOW, CHARGE_MAX, RESO_MAX,
  BOOST_MULT, COLLAPSE_REQUIRE, SINGULARITY_REQUIRE, ECHO_RATE,
  LATTICE_CENTER, LATTICE_UNLOCK,
} from './data.js';
import * as core from './core.js';
import { format, formatTime } from './util.js';
import * as fx from './fx.js';
import * as audio from './audio.js';

const $ = id => document.getElementById(id);
const PERK_BY_ID = {};
for (const p of PERKS) PERK_BY_ID[p.id] = p;
const MORPH_BY_ID = {};
for (const m of MORPHS) MORPH_BY_ID[m.id] = m;

let genRefs = [];
let starRefs = {};
let achRefs = {};
let orbEl = null;
let activeOrb = null;
let dragging = false;
let pointerInfo = null;
let lastSweep = null;
let draftArmedAt = 0;
let draftQueued = false;
let draftBound = false;
let draftDismissed = false;
let modalOnClose = null;
let latBound = false;
let latTarget = -1;
let lastList = 0;
let lastAch = 0;
let lastAutoBuy = 0;
let lastPop = 0;
let inDraft = false;

const DRAG_THRESHOLD = 14;
const DEVOUR_RADIUS = 28;

/* ---------------- 启动 ---------------- */
export function initUi() {
  orbEl = $('orb');
  buildGenList();
  buildStarList();
  buildAchList();
  buildCodex();
  wire();
  draftArmedAt = Date.now() + 900;
  renderAll();
  fx.setFxEnabled(core.state.fxOn !== false);
  audio.setAudioEnabled(core.state.audioOn !== false);
}

function wire() {
  const stage = $('stage');

  const onDown = ev => {
    audio.initAudio();
    audio.resumeAudio();
    pointerInfo = { x: ev.clientX, y: ev.clientY, t: Date.now(), moved: false, id: ev.pointerId };
    dragging = false;
    lastSweep = { x: ev.clientX, y: ev.clientY };
    const n = fx.devourAt(ev.clientX, ev.clientY, DEVOUR_RADIUS * 0.8);
    if (n > 0) absorb(n, ev.clientX, ev.clientY);
  };
  const onMove = ev => {
    if (!pointerInfo) return;
    const dx = ev.clientX - pointerInfo.x;
    const dy = ev.clientY - pointerInfo.y;
    if (!pointerInfo.moved && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) pointerInfo.moved = true;
    if (pointerInfo.moved) {
      dragging = true;
      devourSweep(ev.clientX, ev.clientY);
    }
  };
  const onUp = ev => {
    if (!pointerInfo) return;
    const held = Date.now() - pointerInfo.t;
    if (!pointerInfo.moved && held < 280) doTap(ev.clientX, ev.clientY);
    pointerInfo = null;
    dragging = false;
    lastSweep = null;
  };
  stage.addEventListener('pointerdown', onDown, { passive: true });
  stage.addEventListener('pointermove', onMove, { passive: true });
  stage.addEventListener('pointerup', onUp, { passive: true });
  stage.addEventListener('pointercancel', () => { pointerInfo = null; dragging = false; lastSweep = null; });
  stage.addEventListener('contextmenu', e => e.preventDefault());

  document.querySelectorAll('#tabs button').forEach(b => {
    b.addEventListener('click', () => switchView(b.dataset.view));
  });
  document.querySelectorAll('#bulk button').forEach(b => {
    b.addEventListener('click', () => {
      core.state.bulk = b.dataset.bulk === 'max' ? 'max' : parseInt(b.dataset.bulk, 10);
      document.querySelectorAll('#bulk button').forEach(x => x.classList.toggle('on', x === b));
      renderAll();
    });
  });

  $('burstBtn').addEventListener('click', doBurst);
  $('pickPerkBtn').addEventListener('click', () => showDraft(true));
  $('recordBtn').addEventListener('click', onRecord);
  $('clearEchoBtn').addEventListener('click', onClearEcho);
  $('morphList').addEventListener('click', onMorphClick);
  $('latticeGrid').addEventListener('click', onLatticeClick);
  $('clearLatticeBtn').addEventListener('click', onClearLattice);

  // 弹窗关闭：右上角 ✕ / 点背景 / Esc（只对允许关闭的弹窗生效）
  const mc = $('modalClose');
  if (mc) mc.addEventListener('click', closeModalByUser);
  $('modal').addEventListener('click', ev => { if (ev.target === $('modal')) closeModalByUser(); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeModalByUser(); });

  const ab = $('autoBuyToggle');
  ab.addEventListener('change', () => {
    if (core.starLevel('autoBuy') < 1) {
      ab.checked = false;
      toast('需要先在星尘商店解锁「智能采购」');
      audio.sfxError();
      return;
    }
    core.state.autoBuy = ab.checked;
    toast(core.state.autoBuy ? '自动购买：开启' : '自动购买：关闭', 'green');
  });

  $('audioToggle').addEventListener('change', e => {
    core.state.audioOn = e.target.checked;
    audio.setAudioEnabled(e.target.checked);
    if (e.target.checked) { audio.initAudio(); audio.sfxBuy(); }
  });
  $('hapticsToggle').addEventListener('change', e => {
    core.state.haptics = e.target.checked;
    window.__haptics = e.target.checked;
  });
  $('fxToggle').addEventListener('change', e => {
    core.state.fxOn = e.target.checked;
    fx.setFxEnabled(e.target.checked);
  });

  $('collapseBtn').addEventListener('click', confirmCollapse);
  $('sgBtn').addEventListener('click', confirmSingularity);
  $('exportBtn').addEventListener('click', doExport);
  $('importBtn').addEventListener('click', doImport);
  $('resetBtn').addEventListener('click', confirmReset);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) core.save();
  });
}

/* ---------------- 点击 / 吞噬 ---------------- */
function doTap(x, y) {
  const now = Date.now();
  const r = core.tap(now, core.state);
  const c = fx.coreScreenPos();
  const px = x || c.x;
  const py = y || c.y;

  if (r.perfect) {
    fx.shockwave(c.x, c.y, r.crit ? 1.6 : 1, r.crit ? [255, 190, 80] : [150, 225, 255]);
    fx.sparks(px, py, r.crit ? 34 : 20, { crit: r.crit, speed: 6.4, color: r.crit ? [255, 200, 90] : null });
    fx.flash(0.20);
    fx.shakeScreen(r.crit ? 11 : 7);
    showPerfect(r.crit);
    audio.sfxPerfect(r.combo, r.reso);
    if (r.crit) audio.sfxCrit();
  } else {
    fx.sparks(px, py, 6, { speed: 3.2, size: 1.8 });
    fx.shakeScreen(1.6);
    audio.sfxTap(r.combo);
    if (r.crit) { fx.sparks(px, py, 18, { speed: 5.4, color: [255, 200, 90] }); audio.sfxCrit(); }
  }
  fx.floatText(px, py, (r.perfect ? '✦ ' : '') + '+' + format(r.gain), r.crit ? 'crit' : (r.perfect ? 'perfect' : ''));
  vibrate(r.crit ? [12, 26, 12] : (r.perfect ? 14 : 6));
  popEnergy();
}

function devourSweep(x, y) {
  if (!lastSweep) { lastSweep = { x, y }; return; }
  const dx = x - lastSweep.x;
  const dy = y - lastSweep.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(1, Math.min(14, Math.ceil(dist / 16)));
  let total = 0;
  for (let i = 1; i <= steps; i++) {
    total += fx.devourAt(lastSweep.x + dx * (i / steps), lastSweep.y + dy * (i / steps), DEVOUR_RADIUS);
  }
  lastSweep = { x, y };
  if (total > 0) absorb(total, x, y);
}

function absorb(n, x, y) {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += core.devour(Date.now(), core.state);
  fx.floatText(x, y, '+' + format(sum), 'devour');
  fx.sparks(x, y, 5 + n * 2, { speed: 3.4, size: 1.8, color: [140, 240, 255] });
  audio.sfxDevour(n);
  vibrate(5);
}

function doBurst() {
  const now = Date.now();
  const r = core.doBurst(now, core.state);
  if (!r) { audio.sfxError(); return; }
  const c = fx.coreScreenPos();
  fx.shockwave(c.x, c.y, 2.6, [255, 150, 60]);
  fx.shockwave(c.x, c.y, 1.8, [255, 220, 120]);
  fx.sparks(c.x, c.y, 90, { speed: 9, color: [255, 170, 70], size: 3.2 });
  fx.flash(0.5);
  fx.shakeScreen(16);
  audio.sfxBurst();
  vibrate([22, 40, 22, 40, 30]);
  toast('⚡ 奇点爆发！产量 ×' + format(r.mult) + '，持续 ' + r.duration.toFixed(0) + ' 秒', 'gold');
}

function showPerfect(crit) {
  const el = $('perfectPop');
  el.textContent = crit ? 'PERFECT ×CRIT' : 'PERFECT';
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

function popEnergy() {
  const now = Date.now();
  if (now - lastPop < 80) return;
  lastPop = now;
  const el = $('energy');
  el.classList.add('pop');
  setTimeout(() => el.classList.remove('pop'), 80);
}

function vibrate(pattern) {
  if (!core.state.haptics) return;
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* 忽略 */ }
}

/* ---------------- 列表 ---------------- */
function buildGenList() {
  const box = $('genList');
  box.innerHTML = '';
  genRefs = GENERATORS.map((g, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.setProperty('--accent', g.color);
    card.innerHTML =
      '<div class="ic">' + g.icon + '</div>' +
      '<div class="mid">' +
        '<div class="nm">' + g.name + ' <em class="lv">Lv 0</em></div>' +
        '<div class="ds">' + g.desc + '</div>' +
        '<div class="pr"></div>' +
      '</div>' +
      '<div class="rt">' +
        '<div class="cost"></div>' +
        '<button class="buy"></button>' +
      '</div>';
    card.addEventListener('click', () => buyGenerator(i));
    box.appendChild(card);
    return { card, lv: card.querySelector('.lv'), pr: card.querySelector('.pr'), cost: card.querySelector('.cost'), btn: card.querySelector('.buy') };
  });
}

function buildStarList() {
  const box = $('starList');
  box.innerHTML = '';
  STAR_UPGRADES.forEach(u => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.setProperty('--accent', '#ffcc4d');
    card.innerHTML =
      '<div class="ic">' + u.icon + '</div>' +
      '<div class="mid">' +
        '<div class="nm">' + u.name + ' <em class="lv">0/' + u.max + '</em></div>' +
        '<div class="ds">' + u.desc + '</div>' +
      '</div>' +
      '<div class="rt">' +
        '<div class="cost"></div>' +
        '<button class="buy">升级</button>' +
      '</div>';
    card.addEventListener('click', () => buyStar(u.id));
    box.appendChild(card);
    starRefs[u.id] = { card, lv: card.querySelector('.lv'), cost: card.querySelector('.cost'), btn: card.querySelector('.buy') };
  });
}

function buildAchList() {
  const box = $('achList');
  box.innerHTML = '';
  ACHIEVEMENTS.forEach(a => {
    const d = document.createElement('div');
    d.className = 'ach';
    d.innerHTML = '<div class="ai">' + a.icon + '</div><div class="an">' + a.name + '</div><div class="ad">' + a.desc + '</div>';
    box.appendChild(d);
    achRefs[a.id] = d;
  });
  $('achCount').textContent = '0/' + ACHIEVEMENTS.length;
}

function buildCodex() {
  const box = $('perkCodex');
  box.innerHTML = '';
  PERKS.forEach(p => {
    const s = document.createElement('span');
    s.dataset.perk = p.id;
    s.style.color = RARE_COLOR[p.rare];
    s.textContent = p.icon + ' ' + p.name;
    box.appendChild(s);
  });
}

function buyGenerator(i) {
  const res = core.buyGen(i, core.state.bulk, core.state);
  if (!res) { audio.sfxError(); vibrate(3); return; }
  const r = genRefs[i].card.getBoundingClientRect();
  fx.sparks(r.left + 42, r.top + r.height / 2, 9, { color: hexToRgb(GENERATORS[i].color), speed: 3.4 });
  audio.sfxBuy();
  vibrate(9);
  updateLists(Date.now(), true);
}

function buyStar(id) {
  const res = core.buyStar(id, core.state);
  if (!res) { audio.sfxError(); vibrate(3); return; }
  const r = starRefs[id].card.getBoundingClientRect();
  fx.sparks(r.left + 42, r.top + r.height / 2, 14, { color: [255, 204, 77], speed: 4.6 });
  audio.sfxUpgrade();
  vibrate(12);
  toast('✦ ' + starName(id) + ' → Lv ' + res.level, 'gold');
  updateLists(Date.now(), true);
}

function starName(id) {
  const u = STAR_UPGRADES.find(x => x.id === id);
  return u ? u.name : id;
}

function switchView(v) {
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  $('views').scrollTop = 0;
  renderAll();
}

/* ---------------- 词条抽卡 ---------------- */
export function showDraft(force) {
  if (force) draftDismissed = false;
  if (inDraft) return;
  const choices = core.ensureChoices(core.state);
  if (!choices.length) { core.state.perkPicksLeft = 0; return; }
  inDraft = true;
  const s = core.state;
  const cards = choices.map(id => {
    const p = PERK_BY_ID[id];
    if (!p) return '';
    return '<button type="button" class="draft-card" data-perk="' + p.id + '" style="--rc:' + RARE_COLOR[p.rare] + '">' +
      '<span class="di">' + p.icon + '</span>' +
      '<span class="dc"><span class="dn">' + p.name + ' <em>' + RARE_LABEL[p.rare] + '</em></span>' +
      '<span class="dd">' + p.desc + '</span></span>' +
      '<span class="pick-hint">选择 ›</span>' +
      '</button>';
  }).join('');
  const rc = core.rerollCost(s);
  const body =
    '<div class="draft-title">🧬 选择奇点词条</div>' +
    '<div class="draft-sub">本轮还可选 ' + s.perkPicksLeft + ' 个 · 坍缩后重置</div>' +
    '<div class="draft-list">' + cards + '</div>' +
    '<div class="draft-foot">' +
      '<button type="button" id="draftReroll"' + (s.stardust < rc ? ' disabled' : '') + '>重抽 ✦' + format(rc) + '</button>' +
      '<button type="button" id="draftSkip">跳过 +✦1</button>' +
      '<button type="button" id="draftLater">稍后</button>' +
    '</div>';
  showModal('奇点词条', body, [], false, () => dismissDraft(true));

  const box = $('modalBody');
  if (!draftBound) {
    draftBound = true;
    box.addEventListener('click', onDraftClick);
  }
  const rb = $('draftReroll');
  if (rb) rb.addEventListener('click', onDraftReroll);
  const sb = $('draftSkip');
  if (sb) sb.addEventListener('click', onDraftSkip);
  const lb = $('draftLater');
  if (lb) lb.addEventListener('click', onDraftLater);
}

function onDraftClick(ev) {
  const card = ev.target && ev.target.closest ? ev.target.closest('.draft-card') : null;
  if (!card) return;
  ev.preventDefault();
  ev.stopPropagation();
  const id = card.getAttribute('data-perk');
  const res = core.pickPerk(id, core.state);
  if (!res) { audio.sfxError(); return; }
  audio.sfxUpgrade();
  const p = PERK_BY_ID[id];
  if (p) toast('获得词条：' + p.icon + ' ' + p.name, 'violet');
  inDraft = false;
  hideModal();
  updateLists(Date.now(), true);
  if (core.state.perkPicksLeft > 0) setTimeout(showDraft, 300);
  else core.save();
}

function onDraftReroll(ev) {
  if (ev) { ev.preventDefault(); ev.stopPropagation(); }
  const r = core.rerollPerks(core.state);
  if (!r) { audio.sfxError(); toast('星尘不够重抽'); return; }
  audio.sfxBuy();
  inDraft = false;
  hideModal();
  setTimeout(showDraft, 80);
}

function onDraftSkip(ev) {
  if (ev) { ev.preventDefault(); ev.stopPropagation(); }
  const r = core.skipPerk(core.state);
  if (!r) return;
  audio.sfxBuy();
  inDraft = false;
  hideModal();
  updateLists(Date.now(), true);
  if (core.state.perkPicksLeft > 0) setTimeout(showDraft, 300);
  else core.save();
}

// 收起抽卡：保留未用完的次数，之后可从「词条」页重新打开
function dismissDraft(alreadyHidden) {
  inDraft = false;
  draftDismissed = true;
  if (!alreadyHidden) hideModal();
  updateLists(Date.now(), true);
  toast('已收起 · 可在「词条」页随时选择', 'violet');
}

function onDraftLater(ev) {
  if (ev) { ev.preventDefault(); ev.stopPropagation(); }
  dismissDraft(false);
}

/* ---------------- 转生 ---------------- */
function confirmCollapse() {
  const gain = core.stardustGain(core.state);
  if (gain < 1) { toast('还需要更多能量：本次 ' + format(COLLAPSE_REQUIRE) + ' 累计'); audio.sfxError(); return; }
  showModal('坍缩重启',
    '失去所有能量与机器，获得 <b>✦ ' + format(gain) + '</b> 星尘，' +
    '并重新抽取 <b>' + core.perkSlots(core.state) + ' 个</b>奇点词条。<br>成就、星尘强化与碎片保留。',
    [
      { label: '再想想' },
      { label: '坍缩', pri: true, onClick: () => {
        const res = core.doCollapse(Date.now(), core.state);
        if (!res) return;
        fx.confettiBurst();
        fx.flash(0.6);
        fx.shakeScreen(20);
        audio.sfxPrestige();
        vibrate([20, 50, 20, 50, 34]);
        toast('坍缩完成：+' + format(res.gain) + ' ✦', 'gold');
        core.save();
        renderAll();
        inDraft = false;
        draftDismissed = false;
        setTimeout(() => showDraft(true), 420);
      } },
    ], true);
}

function confirmSingularity() {
  const gain = core.shardGain(core.state);
  if (gain < 1) { toast('需要累计 ' + format(SINGULARITY_REQUIRE) + ' 星尘'); audio.sfxError(); return; }
  showModal('奇点飞升',
    '清空 <b>星尘与星尘强化</b>，换取 <b>' + format(gain) + ' 枚奇点碎片</b>。<br>' +
    '每枚碎片：全局产量 +100%、游戏速度 +10%，永久生效。',
    [
      { label: '再想想' },
      { label: '飞升', pri: true, onClick: () => {
        const res = core.doSingularity(Date.now(), core.state);
        if (!res) return;
        fx.confettiBurst();
        fx.confettiBurst();
        fx.flash(0.8);
        fx.shakeScreen(24);
        audio.sfxPrestige();
        vibrate([22, 60, 22, 60, 40]);
        toast('飞升成功：+' + res.gain + ' 枚碎片', 'gold');
        core.save();
        renderAll();
        inDraft = false;
        draftDismissed = false;
        setTimeout(() => showDraft(true), 420);
      } },
    ], true);
}

function doExport() {
  const code = core.exportSave(core.state);
  showModal('导出存档', '复制下面的存档码保存好：<textarea readonly id="expArea"></textarea>', [
    { label: '关闭' },
    { label: '复制', pri: true, onClick: () => {
      const ta = $('expArea');
      if (ta) {
        ta.select();
        try { document.execCommand('copy'); } catch (e) { /* 忽略 */ }
        if (navigator.clipboard) navigator.clipboard.writeText(ta.value).catch(() => {});
      }
      toast('已复制', 'green');
    } },
  ]);
  setTimeout(() => { const ta = $('expArea'); if (ta) ta.value = code; }, 0);
}

function doImport() {
  showModal('导入存档', '粘贴存档码后确认，将覆盖当前进度：<textarea id="impArea" placeholder="XEQ2..."></textarea>', [
    { label: '取消' },
    { label: '导入', pri: true, onClick: () => {
      const ta = $('impArea');
      const ok = ta && core.importSave(ta.value, core.state);
      if (ok) {
        toast('导入成功', 'green');
        core.save();
        syncToggles();
        renderAll();
        inDraft = false;
      } else {
        toast('存档码无效');
        audio.sfxError();
      }
    } },
  ]);
}

function confirmReset() {
  showModal('彻底重置', '将删除本机所有进度且不可恢复。建议先导出存档。', [
    { label: '取消' },
    { label: '删除全部', pri: true, onClick: () => {
      core.hardReset(core.state);
      syncToggles();
      renderAll();
      inDraft = false;
      toast('已重置', 'green');
    } },
  ]);
}

/* ---------------- 黄金粒子 ---------------- */
function spawnGoldOrb(now) {
  const btn = document.createElement('button');
  btn.className = 'gold-orb';
  btn.innerHTML = '<span>🌟</span>';
  const m = 26;
  const size = 62;
  const maxX = Math.max(m + 1, window.innerWidth - size - m);
  const topBase = 90;
  const maxY = Math.max(topBase + 1, window.innerHeight - 200);
  btn.style.left = (m + Math.random() * (maxX - m)) + 'px';
  btn.style.top = (topBase + Math.random() * (maxY - topBase)) + 'px';
  let dead = false;
  const kill = () => { if (dead) return; dead = true; btn.remove(); activeOrb = null; };
  btn.addEventListener('pointerdown', ev => {
    ev.preventDefault();
    ev.stopPropagation();
    if (dead) return;
    audio.initAudio();
    const r = btn.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    core.state.boostUntil = Date.now() + core.boostDuration(core.state) * 1000;
    core.state.orbsTapped++;
    fx.sparks(cx, cy, 60, { color: [255, 205, 90], speed: 9, size: 3 });
    fx.shockwave(cx, cy, 2, [255, 205, 90]);
    fx.floatText(cx, cy, BOOST_MULT + '× 收益!', 'crit');
    fx.flash(0.4);
    fx.shakeScreen(12);
    audio.sfxOrb();
    vibrate([16, 32, 16]);
    toast('🌟 黄金粒子！' + BOOST_MULT + '× 收益持续 ' + core.boostDuration + ' 秒', 'gold');
    kill();
    scheduleOrb(Date.now());
  }, { passive: false });
  document.body.appendChild(btn);
  activeOrb = btn;
  setTimeout(kill, 13000);
  scheduleOrb(now + 1000);
}

function scheduleOrb(now) {
  const base = core.orbInterval(core.state) * 1000;
  core.state.nextOrbAt = now + base * (0.7 + Math.random() * 0.9);
}

/* ---------------- 每帧 HUD ---------------- */
export function hud(now) {
  const s = core.state;
  $('energy').textContent = format(s.energy);
  $('chipEps').textContent = '+' + format(core.eps(now, s)) + ' /s';
  $('chipStar').textContent = '✦ ' + format(s.stardust) + (s.shards > 0 ? ' · 🕳️' + s.shards : '');
  $('statClick').textContent = format(core.clickGain(now, s));
  $('statEps').textContent = format(core.eps(now, s)) + '/s';
  $('statMult').textContent = '×' + core.globalMult(now, s).toFixed(2);

  // 共振
  const resoFill = $('resoFill');
  const resoVal = $('resoVal');
  if (resoVal.textContent !== String(s.reso)) resoVal.textContent = String(s.reso);
  const rp = Math.min(100, (s.reso / core.resoMax(s)) * 100);
  resoFill.style.width = rp + '%';
  resoFill.classList.toggle('hot', s.reso >= 10);

  // 连击
  const bar = $('comboFill');
  const txt = $('comboText');
  if (s.combo > 0) {
    const fresh = Math.max(0, 1 - (now - s.comboAt) / (COMBO_WINDOW * 1000));
    bar.style.width = Math.min(100, (s.combo / COMBO_MAX) * 100) + '%';
    bar.style.opacity = String(0.35 + fresh * 0.65);
    txt.textContent = '连击 ' + s.combo + ' · ×' + core.comboMult(s).toFixed(2) + (s.combo >= COMBO_MAX ? '（满）' : '');
    txt.classList.toggle('hot', s.combo >= 25);
  } else {
    bar.style.width = '0%';
    txt.textContent = '连击 0 · ×1.00';
    txt.classList.remove('hot');
  }

  // 爆发
  const bursting = core.burstActive(now, s);
  const cb = $('chargeBar');
  const cf = $('chargeFill');
  const bb = $('burstBtn');
  if (bursting) {
    const left = Math.max(0, (s.burstUntil - now) / 1000);
    cf.style.width = '100%';
    cb.classList.add('full');
    bb.disabled = true;
    bb.classList.remove('ready');
    bb.textContent = '爆发中 ' + left.toFixed(1) + 's';
  } else {
    const p = Math.min(100, (s.charge / CHARGE_MAX) * 100);
    cf.style.width = p + '%';
    const ready = core.burstReady(s);
    cb.classList.toggle('full', ready);
    bb.disabled = !ready;
    bb.classList.toggle('ready', ready);
    bb.textContent = ready ? '奇点爆发' : '充能 ' + Math.floor(p) + '%';
  }

  // 黄金粒子调度
  if (s.nextOrbAt === 0) scheduleOrb(now);
  if (!activeOrb && now >= s.nextOrbAt) spawnGoldOrb(now);

  // 成就
  if (now - lastAch > 600) {
    lastAch = now;
    const got = core.checkAchievements(s);
    if (got.length) {
      got.forEach(a => toast('🏆 ' + a.name + ' · ' + a.desc, 'gold'));
      fx.confettiBurst();
      audio.sfxAchieve();
      vibrate(14);
      buildAchFlags();
    }
  }

  // 自动购买
  if (s.autoBuy && now - lastAutoBuy > 250) { lastAutoBuy = now; core.autoBuyTick(s); }

// 词条抽卡（只排队一次，避免重复触发与互相覆盖）
  if (!inDraft && !draftQueued && !draftDismissed && s.perkPicksLeft > 0 && now > draftArmedAt && $('modal').classList.contains('hidden')) {
    draftQueued = true;
    setTimeout(() => {
      draftQueued = false;
      if (!inDraft && core.state.perkPicksLeft > 0 && $('modal').classList.contains('hidden')) showDraft();
    }, 80);
  }

  // 录制倒计时
  if (s.recording) {
    const left = Math.max(0, (s.recordStart + s.recordLen * 1000 - now) / 1000);
    const rb = $('recordBtn');
    if (rb) rb.textContent = '录制中 ' + left.toFixed(1) + 's';
    if (now >= s.recordStart + s.recordLen * 1000) finishRecord();
  }

  if (now - lastList > 240) { lastList = now; updateLists(now, false); renderLattice(); }
}

function buildAchFlags() {
  ACHIEVEMENTS.forEach(a => {
    const el = achRefs[a.id];
    if (el) el.classList.toggle('got', !!core.state.ach[a.id]);
  });
  $('achCount').textContent = core.achCount(core.state) + '/' + ACHIEVEMENTS.length;
}

export function renderAll() {
  updateLists(Date.now(), true);
  buildAchFlags();
  renderMorphPanel();
  renderPerkPanel();
  renderEchoPanel();
  renderLattice();
  renderStats();
  syncToggles();
}

function updateLists(now, force) {
  const s = core.state;
  const bulk = s.bulk;

  for (let i = 0; i < GENERATORS.length; i++) {
    const g = GENERATORS[i];
    const ref = genRefs[i];
    if (!ref) continue;
    const max = core.maxAffordable(i, s);
    const want = bulk === 'max' ? Math.max(1, max) : bulk;
    const n = Math.min(want, max);
    const can = n > 0;
    const costN = can ? n : want;
    const cost = core.genCost(i, costN, s);
    const each = g.prod * core.globalMult(now, s) * (core.boostActive(now, s) ? s.boostMult : 1);
    const total = s.gens[i] * each;

    if (force || ref.lv.textContent !== String(s.gens[i])) ref.lv.textContent = String(s.gens[i]);
    ref.pr.textContent = '单台 +' + format(each) + '/s · 小计 ' + format(total) + '/s';
    ref.cost.textContent = format(cost);
    ref.cost.className = 'cost ' + (can ? 'ok' : 'no');
    ref.btn.textContent = bulk === 'max'
      ? (max > 0 ? '买满 ' + max : '买满')
      : (can ? (n < want ? '买 ' + n : '买 ×' + n) : '买 ×' + want);
    ref.card.classList.toggle('can', can);
    ref.card.classList.toggle('cant', !can);
  }

  for (const u of STAR_UPGRADES) {
    const ref = starRefs[u.id];
    if (!ref) continue;
    const lv = core.starLevel(u.id, s);
    const maxed = lv >= u.max;
    const cost = core.starCost(u.id, s);
    const can = !maxed && s.stardust >= cost;
    ref.lv.textContent = lv + '/' + u.max;
    ref.cost.textContent = maxed ? '已满级' : '✦ ' + format(cost);
    ref.cost.className = 'cost ' + (maxed ? 'no' : (can ? 'ok' : 'no'));
    ref.btn.textContent = maxed ? '已满' : '升级';
    ref.card.classList.toggle('can', can);
    ref.card.classList.toggle('cant', !can);
  }

  // 星尘面板
  $('starAmount').textContent = format(s.stardust);
  $('starGain').textContent = format(core.stardustGain(s));
  const cbtn = $('collapseBtn');
  const ccan = core.canCollapse(s);
  cbtn.disabled = !ccan;
  cbtn.textContent = ccan ? '坍缩重启 · +' + format(core.stardustGain(s)) + ' ✦' : '坍缩重启';
  $('collapseHint').textContent = ccan
    ? '本次运行累计 ' + format(s.totalRun) + ' 能量 · 坍缩后重抽词条'
    : '本次运行 ' + format(s.totalRun) + ' / ' + format(COLLAPSE_REQUIRE) + ' 能量后解锁';

  const sg = core.shardGain(s);
  const sbtn = $('sgBtn');
  sbtn.disabled = sg < 1;
  sbtn.textContent = sg >= 1 ? '飞升奇点 · +' + sg + ' 碎片' : '飞升奇点';
  $('sgInfo').textContent = '永久碎片 ' + s.totalShards + ' 枚 · 每枚 +100% 产量 / +10% 速度';
  $('sgGain').textContent = sg >= 1
    ? '本次可获得 ' + sg + ' 枚碎片'
    : '需要累计 ' + format(SINGULARITY_REQUIRE) + ' 星尘（当前 ' + format(s.totalStardust) + '）';

  if (force) renderPerkPanel();
}

function renderPerkPanel() {
  const s = core.state;
  const slots = core.perkSlots(s);
  $('perkSlotInfo').textContent = s.perks.length + '/' + slots + (s.perkPicksLeft > 0 ? ' · 待选 ' + s.perkPicksLeft : '');
  const pb = $('pickPerkBtn');
  if (pb) {
    const pending = s.perkPicksLeft > 0;
    pb.classList.toggle('hidden', !pending);
    pb.textContent = '选择词条（剩 ' + s.perkPicksLeft + ' 次）';
  }
  const box = $('perkList');
  if (!s.perks.length) {
    box.innerHTML = '<div class="panel"><div class="hint">本轮还没有词条。坍缩后会出现 3 选 1 的抽卡。</div></div>';
  } else {
    box.innerHTML = s.perks.map(id => {
      const p = PERK_BY_ID[id];
      if (!p) return '';
      return '<div class="card" style="--accent:' + RARE_COLOR[p.rare] + '">' +
        '<div class="ic">' + p.icon + '</div>' +
        '<div class="mid"><div class="nm">' + p.name + ' <em>' + RARE_LABEL[p.rare] + '</em></div>' +
        '<div class="ds">' + p.desc + '</div></div>' +
        '<div class="rt"><div class="cost ok">已装备</div></div></div>';
    }).join('');
  }
  document.querySelectorAll('#perkCodex span').forEach(el => {
    el.classList.toggle('owned', s.perks.includes(el.dataset.perk));
  });
}

function renderMorphPanel() {
  const s = core.state;
  const unlocked = core.morphUnlocked(s);
  const cur = s.morph ? MORPH_BY_ID[s.morph] : null;
  $('morphInfo').textContent = cur ? (cur.icon + ' ' + cur.name) : (unlocked ? '可选 1 个' : '未解锁');
  $('morphList').innerHTML = MORPHS.map(m => {
    const picked = s.morph === m.id;
    const locked = !unlocked;
    return '<button type="button" class="morph-card' + (picked ? ' pick' : '') + (locked ? ' locked' : '') + '"' +
      ' data-morph="' + m.id + '" style="--mc:' + m.color + '">' +
      '<span class="mi">' + m.icon + '</span>' +
      '<span class="mn">' + m.name + '</span>' +
      '<span class="mt">' + m.tag + '</span>' +
      '<span class="md">' + m.desc + '</span>' +
      '</button>';
  }).join('');
}

function onMorphClick(ev) {
  const card = ev.target && ev.target.closest ? ev.target.closest('.morph-card') : null;
  if (!card) return;
  const s = core.state;
  if (!core.morphUnlocked(s)) { toast('坍缩 1 次后解锁核心形态'); audio.sfxError(); return; }
  if (s.morph) { toast('本世形态已确定 · 飞升奇点后可重选'); return; }
  const id = card.getAttribute('data-morph');
  const m = MORPH_BY_ID[id];
  if (!m) return;
  showModal('确定核心形态 · ' + m.icon + ' ' + m.name,
    m.desc + '<br><br><b>本世不可更改</b>，飞升奇点后可重选。',
    [
      { label: '再想想' },
      { label: '就选它', pri: true, onClick: () => {
        const r = core.chooseMorph(id, core.state);
        if (!r) return;
        const c = fx.coreScreenPos();
        fx.confettiBurst();
        fx.shockwave(c.x, c.y, 2.2, hexToRgb(m.color));
        fx.flash(0.5);
        audio.sfxPrestige();
        vibrate([18, 40, 18]);
        toast('核心形态：' + m.icon + ' ' + m.name, 'violet');
        core.save();
        renderAll();
      } },
    ], true);
}

function renderEchoPanel() {
  const s = core.state;
  const unlocked = core.echoUnlocked(s);
  const btn = $('recordBtn');
  const clr = $('clearEchoBtn');
  const body = $('echoBody');

  if (s.recording) {
    btn.classList.add('rec');
    btn.disabled = true;
    clr.classList.add('hidden');
    return;
  }
  btn.classList.remove('rec');
  btn.disabled = !unlocked;

  if (!unlocked) {
    $('echoInfo').textContent = '未解锁';
    body.innerHTML = '坍缩 <b>2 次</b>后解锁。录下你 4 秒的操作，它会变成自动演奏的分身。';
    btn.textContent = '未解锁';
    clr.classList.add('hidden');
    return;
  }

  if (!core.hasEcho(s)) {
    $('echoInfo').textContent = '待录制';
    body.innerHTML = '录下你 4 秒的操作，它会变成自动演奏的分身，循环复现你的完美率。';
    btn.textContent = '录制残响';
    clr.classList.add('hidden');
    return;
  }

  const e = s.echo;
  $('echoInfo').textContent = Math.round(e.rate * 100) + '% 完美';
  btn.textContent = '重新录制';
  body.innerHTML =
    '<div class="echo-stats">' +
      '<div class="echo-stat"><span>录制点击</span><b>' + e.taps.length + '</b></div>' +
      '<div class="echo-stat"><span>完美率</span><b>' + Math.round(e.rate * 100) + '%</b></div>' +
      '<div class="echo-stat"><span>循环</span><b>' + e.len.toFixed(1) + 's</b></div>' +
      '<div class="echo-stat"><span>已触发</span><b>' + format(s.echoHits) + '</b></div>' +
    '</div>' +
    '<div class="hint">残响以 ' + Math.round(ECHO_RATE * 100) + '% 的点击力自动演奏，完美段位照样叠共振。</div>';
  clr.classList.remove('hidden');
}

function onRecord() {
  const s = core.state;
  if (s.recording) return;
  const len = core.startRecord(Date.now(), s);
  if (!len) { toast('坍缩 2 次后解锁残响录制'); audio.sfxError(); return; }
  audio.initAudio();
  audio.resumeAudio();
  toast('开始录制：' + len + ' 秒内随便点，尽量踩完美', 'violet');
  renderEchoPanel();
}

function finishRecord() {
  const e = core.finishRecord(Date.now(), core.state);
  audio.sfxUpgrade();
  if (e) toast('残响完成：' + e.taps.length + ' 次点击 · 完美率 ' + Math.round(e.rate * 100) + '%', 'gold');
  renderEchoPanel();
}

function onClearEcho() {
  core.clearEcho(core.state);
  toast('残响已清除');
  renderEchoPanel();
}

/* ---------------- 引力阵 ---------------- */
function renderLattice() {
  const grid = $('latticeGrid');
  if (!grid) return;
  const s = core.state;
  const N = 25;
  if (grid.childElementCount !== N) {
    grid.innerHTML = '';
    for (let i = 0; i < N; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lat-cell';
      b.setAttribute('data-idx', String(i));
      b.innerHTML = '<span class="le"></span><span class="lm"></span>';
      grid.appendChild(b);
    }
  }
  const unlocked = core.latticeUnlocked(s);
  grid.classList.toggle('locked', !unlocked);

  const tide = core.tideElement(s);
  const ti = $('tideInfo');
  ti.textContent = tide.icon + ' ' + tide.name;
  ti.style.color = tide.color;
  $('tideHint').innerHTML = unlocked
    ? '潮汐期间对应系的发射器产量 <b>×3</b>，每 40 秒轮换一次。'
    : '累计 <b>' + format(LATTICE_UNLOCK) + '</b> 能量后解锁引力阵。';
  $('latticeOut').textContent = format(core.latticeProd(s)) + '/s';
  $('emitterInfo').textContent = core.placedCount(s) + '/' + core.latticeSlots(s);

  for (let i = 0; i < N; i++) {
    const b = grid.children[i];
    const le = b.firstChild;
    const lm = b.lastChild;
    if (i === LATTICE_CENTER) {
      b.className = 'lat-cell core';
      le.textContent = '🕳️';
      lm.textContent = '核心';
      continue;
    }
    const cell = s.lattice[i];
    if (!cell) {
      b.className = 'lat-cell';
      b.style.removeProperty('--ec');
      le.textContent = '';
      lm.textContent = core.nodeTierMult(i).toFixed(2);
      continue;
    }
    const el = core.elementById(core.genElement(cell.t));
    const online = core.latticeOnline(s, i);
    b.className = 'lat-cell has' + (online ? '' : ' off') + (el.id === tide.id ? ' tide' : '');
    b.style.setProperty('--ec', el.color);
    le.textContent = GENERATORS[cell.t].icon;
    lm.textContent = core.latticeNodeMult(s, i).toFixed(2) + '×';
  }
}

function onLatticeClick(ev) {
  const cellEl = ev.target && ev.target.closest ? ev.target.closest('.lat-cell') : null;
  if (!cellEl) return;
  const idx = parseInt(cellEl.getAttribute('data-idx'), 10);
  if (!Number.isFinite(idx) || idx === LATTICE_CENTER) return;
  const s = core.state;
  if (!core.latticeUnlocked(s)) {
    toast('累计 ' + format(LATTICE_UNLOCK) + ' 能量后解锁引力阵');
    audio.sfxError();
    return;
  }

  const cur = s.lattice[idx];
  if (cur) {
    const g = GENERATORS[cur.t];
    const el = core.elementById(core.genElement(cur.t));
    const online = core.latticeOnline(s, idx);
    showModal('发射器 · ' + g.icon + ' ' + g.name,
      '系别 <b>' + el.icon + ' ' + el.name + '</b><br>' +
      '档位 <b>×' + core.nodeTierMult(idx).toFixed(2) + '</b><br>' +
      '当前总倍率 <b>×' + core.latticeNodeMult(s, idx).toFixed(2) + '</b><br>' +
      (online ? '状态 已连通核心' : '<b>状态 断连（只剩 20%）</b>'),
      [
        { label: '取消' },
        { label: '移除', pri: true, onClick: () => {
          core.removeEmitter(s, idx);
          audio.sfxBuy();
          renderLattice();
          updateLists(Date.now(), true);
        } },
      ], true);
    return;
  }

  const placed = core.placedTypes(s);
  if (core.placedCount(s) >= core.latticeSlots(s)) {
    toast('发射器已用完 · 可在星尘商店升级「引力发射器」');
    audio.sfxError();
    return;
  }
  const avail = [];
  for (let t = 0; t < GENERATORS.length; t++) {
    if (s.gens[t] > 0 && placed.indexOf(t) < 0) avail.push(t);
  }
  if (!avail.length) { toast('没有可放置的发射器'); audio.sfxError(); return; }

  latTarget = idx;
  const list = avail.map(t => {
    const el = core.elementById(core.genElement(t));
    return '<button type="button" class="lat-pick" data-t="' + t + '" style="--ec:' + el.color + '">' +
      '<span class="lp-i">' + GENERATORS[t].icon + '</span>' +
      '<span class="lp-n">' + GENERATORS[t].name + '</span>' +
      '<span class="lp-e">' + el.icon + ' ' + el.name + '系</span>' +
      '</button>';
  }).join('');
  showModal('选择发射器 · 档位 ' + core.nodeTierMult(idx).toFixed(2) + '×',
    '<div class="lat-picks">' + list + '</div>', [{ label: '取消' }], true);
  const box = $('modalBody');
  if (!latBound) { latBound = true; box.addEventListener('click', onLatPickClick); }
}

function onLatPickClick(ev) {
  const b = ev.target && ev.target.closest ? ev.target.closest('.lat-pick') : null;
  if (!b) return;
  ev.preventDefault();
  ev.stopPropagation();
  const t = parseInt(b.getAttribute('data-t'), 10);
  const r = core.placeEmitter(core.state, latTarget, t);
  if (!r) { audio.sfxError(); return; }
  audio.sfxUpgrade();
  vibrate(10);
  hideModal();
  latTarget = -1;
  renderLattice();
  updateLists(Date.now(), true);
  const el = core.elementById(core.genElement(t));
  toast('已放置 ' + GENERATORS[t].name + '（' + el.name + '系）', 'violet');
}

function onClearLattice() {
  core.clearLattice(core.state);
  audio.sfxError();
  toast('引力阵已清空');
  renderLattice();
}

function renderStats() {
  const s = core.state;
  const rows = [
    ['累计能量', format(s.totalAll)],
    ['点击次数', format(s.clicks)],
    ['完美一击', format(s.perfects) + ' 次（' + (s.clicks ? Math.round(s.perfects / s.clicks * 100) : 0) + '%）'],
    ['最高共振', s.maxReso + ' 层'],
    ['吞噬光团', format(s.devoured) + ' 个'],
    ['爆发次数', s.bursts + ' 次'],
    ['最高连击', s.maxCombo + ' 层'],
    ['游戏速度', '×' + core.gameSpeed(s).toFixed(2)],
    ['全局倍率', '×' + core.globalMult(Date.now(), s).toFixed(2)],
    ['游戏时间', formatTime(s.playTime)],
    ['坍缩次数', s.collapses + ' 次'],
    ['累计星尘', format(s.totalStardust)],
    ['奇点碎片', s.totalShards + ' 枚'],
    ['累计词条', s.perksTaken + ' 个'],
    ['黄金粒子', s.orbsTapped + ' 个'],
    ['离线效率', Math.round(core.offlineEff(s) * 100) + '%'],
    ['成就加成', '+' + (core.achCount(s) * 2) + '%'],
  ];
  $('statList').innerHTML = rows.map(r => '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
}

function syncToggles() {
  $('autoBuyToggle').checked = !!core.state.autoBuy;
  $('audioToggle').checked = core.state.audioOn !== false;
  $('hapticsToggle').checked = core.state.haptics !== false;
  $('fxToggle').checked = core.state.fxOn !== false;
  window.__haptics = core.state.haptics !== false;
  fx.setFxEnabled(core.state.fxOn !== false);
  audio.setAudioEnabled(core.state.audioOn !== false);
  document.querySelectorAll('#bulk button').forEach(b => {
    const v = b.dataset.bulk === 'max' ? 'max' : parseInt(b.dataset.bulk, 10);
    b.classList.toggle('on', v === core.state.bulk);
  });
}

/* ---------------- 提示 / 弹窗 ---------------- */
export function toast(text, cls) {
  const box = $('toasts');
  const d = document.createElement('div');
  d.className = 'toast ' + (cls || '');
  d.innerHTML = text;
  box.appendChild(d);
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 320); }, 2300);
  while (box.children.length > 4) box.removeChild(box.firstChild);
}

export function showModal(title, body, actions, locked, onClose) {
  const m = $('modal');
  $('modalTitle').textContent = title;
  $('modalBody').innerHTML = body;
  const box = $('modalActions');
  box.innerHTML = '';
  (actions || [{ label: '知道了' }]).forEach(a => {
    const b = document.createElement('button');
    b.textContent = a.label;
    if (a.pri) b.className = 'pri';
    b.addEventListener('click', () => {
      hideModal();
      if (a.onClick) a.onClick();
    });
    box.appendChild(b);
  });
  box.style.display = (actions && actions.length) ? 'flex' : 'none';

  // 只有「允许关闭」的弹窗才挂 ✕ / 背景 / Esc 关闭
  modalOnClose = (!locked && typeof onClose === 'function') ? onClose : null;
  const cb = $('modalClose');
  if (cb) cb.classList.toggle('hidden', !modalOnClose);

  m.classList.remove('hidden');
  m.style.display = 'grid';           // 内联样式兜底，CSS 出问题也不会卡住
  m.dataset.locked = locked ? '1' : '';
}

export function hideModal() {
  const m = $('modal');
  m.classList.add('hidden');
  m.style.display = 'none';
  modalOnClose = null;
}

function closeModalByUser() {
  const m = $('modal');
  if (!m || m.classList.contains('hidden')) return;
  const f = modalOnClose;
  if (!f) return;                    // 强制确认型弹窗只能走按钮
  hideModal();
  f();
}

export function modalOpen() {
  return !$('modal').classList.contains('hidden');
}

export function showOfflineModal(info) {
  showModal('🌙 离线收益',
    '你离开了 <b>' + formatTime(info.total) + '</b>，吸积盘仍在运转：<br><br>' +
    '结算时长 <b>' + formatTime(info.seconds) + '</b>（效率 ' + Math.round(info.eff * 100) + '%）<br>' +
    '获得能量 <b>+' + format(info.gain) + '</b>',
    [{ label: '收下', pri: true }]);
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
