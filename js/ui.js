// 界面渲染与交互
import {
  GENERATORS, STAR_UPGRADES, ACHIEVEMENTS,
  COLLAPSE_REQUIRE, SINGULARITY_REQUIRE, COMBO_MAX, COMBO_WINDOW, BOOST_MULT,
} from './data.js';
import * as core from './core.js';
import { format, formatTime, vibrate } from './util.js';
import { burst, floatText, shake, confetti, setFxEnabled } from './fx.js';

const $ = id => document.getElementById(id);

let genRefs = [];
let starRefs = {};
let achRefs = {};
let orbEl = null;
let toastTimer = 0;
let lastList = 0;
let lastAch = 0;
let lastAutoBuy = 0;
let lastOrbSpawn = 0;
let activeOrb = null;
let lastPop = 0;

/* ---------------- 初始化 ---------------- */

export function initUi() {
  orbEl = $('orb');
  buildGenList();
  buildStarList();
  buildAchList();
  wire();
  setFxEnabled(core.state.fxOn !== false);
  renderAll();
}

function wire() {
  const orb = $('orb');
  const onTap = ev => {
    ev.preventDefault();
    doTap(ev);
  };
  orb.addEventListener('pointerdown', onTap, { passive: false });
  orb.addEventListener('contextmenu', e => e.preventDefault());

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

  const ab = $('autoBuyToggle');
  ab.addEventListener('change', () => {
    if (core.starLevel('autoBuy') < 1) {
      ab.checked = false;
      showToast('需要先在星尘商店解锁「智能采购」');
      return;
    }
    core.state.autoBuy = ab.checked;
    showToast(core.state.autoBuy ? '自动购买：开启' : '自动购买：关闭', 'green');
  });

  const hap = $('hapticsToggle');
  hap.addEventListener('change', () => {
    core.state.haptics = hap.checked;
    window.__haptics = hap.checked;
  });

  const fx = $('fxToggle');
  fx.addEventListener('change', () => {
    core.state.fxOn = fx.checked;
    setFxEnabled(fx.checked);
  });

  $('collapseBtn').addEventListener('click', confirmCollapse);
  $('sgBtn').addEventListener('click', confirmSingularity);
  $('exportBtn').addEventListener('click', doExport);
  $('importBtn').addEventListener('click', doImport);
  $('resetBtn').addEventListener('click', confirmReset);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) core.save();
  });
  window.addEventListener('beforeunload', () => core.save());
}

/* ---------------- 列表构建 ---------------- */

function buildGenList() {
  const box = $('genList');
  box.innerHTML = '';
  genRefs = GENERATORS.map((g, i) => {
    const card = document.createElement('div');
    card.className = 'card';
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
    return {
      card,
      lv: card.querySelector('.lv'),
      pr: card.querySelector('.pr'),
      cost: card.querySelector('.cost'),
      btn: card.querySelector('.buy'),
    };
  });
}

function buildStarList() {
  const box = $('starList');
  box.innerHTML = '';
  STAR_UPGRADES.forEach(u => {
    const card = document.createElement('div');
    card.className = 'card';
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
    starRefs[u.id] = {
      card,
      lv: card.querySelector('.lv'),
      cost: card.querySelector('.cost'),
      btn: card.querySelector('.buy'),
    };
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
}

/* ---------------- 交互动作 ---------------- */

function orbCenter() {
  const r = orbEl.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function doTap(ev) {
  const now = Date.now();
  const res = core.tap(now);
  const c = orbCenter();
  let x = c.x;
  let y = c.y;
  if (ev && typeof ev.clientX === 'number' && ev.clientX > 0) {
    x = ev.clientX;
    y = ev.clientY;
  }
  if (core.state.fxOn !== false) {
    floatText(x, y, '+' + format(res.gain), res.crit ? 'crit' : '');
    burst(x, y, res.crit ? 26 : 9, { crit: res.crit });
  }
  if (res.crit) {
    shake(document.body);
    vibrate(20);
    orbEl.classList.add('crit');
    setTimeout(() => orbEl.classList.remove('crit'), 170);
  } else {
    vibrate(7);
  }
  orbEl.classList.add('hit');
  setTimeout(() => orbEl.classList.remove('hit'), 70);
  popEnergy();
  updateHud(now);
}

function popEnergy() {
  const now = Date.now();
  if (now - lastPop < 90) return;
  lastPop = now;
  const el = $('energy');
  el.classList.add('pop');
  setTimeout(() => el.classList.remove('pop'), 90);
}

function buyGenerator(i) {
  const res = core.buyGen(i, core.state.bulk);
  if (!res) {
    vibrate(3);
    return;
  }
  const r = genRefs[i].card.getBoundingClientRect();
  if (core.state.fxOn !== false) {
    burst(r.left + 40, r.top + r.height / 2, 8, { color: [67, 232, 255], speed: 3 });
  }
  vibrate(10);
  updateHud(Date.now());
  updateLists(Date.now(), true);
}

function buyStar(id) {
  const res = core.buyStar(id);
  if (!res) { vibrate(3); return; }
  const r = starRefs[id].card.getBoundingClientRect();
  if (core.state.fxOn !== false) burst(r.left + 40, r.top + r.height / 2, 12, { color: [255, 204, 77] });
  vibrate(12);
  showToast(starName(id) + ' → Lv ' + res.level, 'gold');
  updateHud(Date.now());
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

/* ---------------- 转生 ---------------- */

function confirmCollapse() {
  const gain = core.stardustGain();
  if (gain < 1) {
    showToast('还需要更多能量：' + format(COLLAPSE_REQUIRE) + ' 本次累计');
    return;
  }
  showModal('坍缩重启', '本次将失去所有能量与机器，获得 <b>✦ ' + format(gain) + '</b> 星尘用于购买永久强化。<br>历史累计与成就保留。', [
    { label: '再想想' },
    { label: '坍缩', pri: true, onClick: () => {
      const res = core.doCollapse();
      if (!res) return;
      confetti();
      shake(document.body);
      vibrate([18, 40, 24]);
      showToast('坍缩完成：+' + format(res.gain) + ' ✦', 'gold');
      core.save();
      renderAll();
      updateHud(Date.now());
    } },
  ]);
}

function confirmSingularity() {
  const gain = core.shardGain();
  if (gain < 1) {
    showToast('需要累计 ' + format(SINGULARITY_REQUIRE) + ' 星尘');
    return;
  }
  showModal('奇点飞升', '将清空 <b>星尘与星尘强化</b>，换取 <b>' + format(gain) + ' 枚奇点碎片</b>。<br>每枚碎片：全局产量 +100%，游戏速度 +10%，永久生效。', [
    { label: '再想想' },
    { label: '飞升', pri: true, onClick: () => {
      const res = core.doSingularity();
      if (!res) return;
      confetti();
      confetti();
      vibrate([20, 50, 20, 50, 30]);
      showToast('飞升成功：+' + res.gain + ' 枚碎片', 'gold');
      core.save();
      renderAll();
      updateHud(Date.now());
    } },
  ]);
}

function doExport() {
  const code = core.exportSave();
  showModal('导出存档', '复制下面的存档码保存好：<textarea readonly id="expArea"></textarea>', [
    { label: '关闭' },
    { label: '复制', pri: true, onClick: () => {
      const ta = $('expArea');
      if (ta) {
        ta.select();
        try { document.execCommand('copy'); } catch (e) { /* 忽略 */ }
        if (navigator.clipboard) navigator.clipboard.writeText(ta.value).catch(() => {});
      }
      showToast('已复制到剪贴板', 'green');
    } },
  ]);
  setTimeout(() => {
    const ta = $('expArea');
    if (ta) ta.value = code;
  }, 0);
}

function doImport() {
  showModal('导入存档', '粘贴存档码后确认，将覆盖当前进度：<textarea id="impArea" placeholder="XEQ1..."></textarea>', [
    { label: '取消' },
    { label: '导入', pri: true, onClick: () => {
      const ta = $('impArea');
      const ok = ta && core.importSave(ta.value);
      if (ok) {
        showToast('导入成功', 'green');
        core.save();
        syncToggles();
        renderAll();
        updateHud(Date.now());
      } else {
        showToast('存档码无效');
      }
    } },
  ]);
}

function confirmReset() {
  showModal('彻底重置', '将删除本机所有进度，且不可恢复。建议先导出存档。', [
    { label: '取消' },
    { label: '删除全部', pri: true, onClick: () => {
      core.hardReset();
      syncToggles();
      renderAll();
      updateHud(Date.now());
      showToast('已重置', 'green');
    } },
  ]);
}

function syncToggles() {
  $('autoBuyToggle').checked = !!core.state.autoBuy;
  $('hapticsToggle').checked = core.state.haptics !== false;
  $('fxToggle').checked = core.state.fxOn !== false;
  window.__haptics = core.state.haptics !== false;
  setFxEnabled(core.state.fxOn !== false);
  document.querySelectorAll('#bulk button').forEach(b => {
    const v = b.dataset.bulk === 'max' ? 'max' : parseInt(b.dataset.bulk, 10);
    b.classList.toggle('on', v === core.state.bulk);
  });
}

/* ---------------- 黄金粒子 ---------------- */

function spawnOrb(now) {
  const dur = Math.max(9, 13 - core.starLevel('orb') * 0.25);
  const btn = document.createElement('button');
  btn.className = 'gold-orb';
  btn.innerHTML = '<span>🌟</span>';
  const m = 28;
  const w = Math.min(60, window.innerWidth - m * 2);
  const left = m + Math.random() * Math.max(1, window.innerWidth - w - m * 2);
  const top = m + 70 + Math.random() * Math.max(1, window.innerHeight - 240 - m);
  btn.style.left = left + 'px';
  btn.style.top = top + 'px';
  let dead = false;
  const kill = () => {
    if (dead) return;
    dead = true;
    btn.remove();
    activeOrb = null;
  };
  btn.addEventListener('pointerdown', ev => {
    ev.preventDefault();
    if (dead) return;
    const r = btn.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    core.state.boostUntil = Date.now() + core.boostDuration() * 1000;
    core.state.orbsTapped++;
    if (core.state.fxOn !== false) {
      burst(cx, cy, 46, { color: [255, 204, 77], speed: 8 });
      floatText(cx, cy, BOOST_MULT + '× 收益!', 'crit');
    }
    confetti();
    shake(document.body);
    vibrate([15, 30, 15]);
    showToast('黄金粒子！' + BOOST_MULT + '× 收益持续 ' + core.boostDuration() + ' 秒', 'gold');
    kill();
    scheduleOrb(Date.now());
  }, { passive: false });
  document.body.appendChild(btn);
  activeOrb = btn;
  setTimeout(kill, dur * 1000);
  scheduleOrb(now + 1000);
}

function scheduleOrb(now) {
  const base = core.orbInterval() * 1000;
  core.state.nextOrbAt = now + base * (0.7 + Math.random() * 0.9);
}

/* ---------------- 每帧更新 ---------------- */

export function updateHud(now) {
  const s = core.state;
  $('energy').textContent = format(s.energy);
  $('chipEps').textContent = '+' + format(core.eps(now)) + ' /s';
  $('chipStar').textContent = '✦ ' + format(s.stardust) + (s.shards > 0 ? ' · 🕳️' + s.shards : '');
  $('statClick').textContent = format(core.clickGain(now));
  $('statEps').textContent = format(core.eps(now)) + '/s';
  $('statMult').textContent = '×' + core.globalMult().toFixed(2);

  const bar = $('comboFill');
  const txt = $('comboText');
  if (s.combo > 0) {
    const fresh = Math.max(0, 1 - (now - s.comboAt) / (COMBO_WINDOW * 1000));
    bar.style.width = Math.min(100, (s.combo / COMBO_MAX) * 100) + '%';
    bar.style.opacity = String(0.35 + fresh * 0.65);
    txt.textContent = '连击 ' + s.combo + ' · ×' + core.comboMult().toFixed(2) + (s.combo >= COMBO_MAX ? '（满）' : '');
    txt.classList.toggle('hot', s.combo >= 30);
  } else {
    bar.style.width = '0%';
    txt.textContent = '连击 0 · ×1.00';
    txt.classList.remove('hot');
  }

  const tag = $('boostTag');
  if (core.boostActive(now)) {
    const left = Math.ceil((s.boostUntil - now) / 1000);
    tag.classList.remove('hidden');
    tag.textContent = BOOST_MULT + '× · ' + left + 's';
  } else {
    tag.classList.add('hidden');
  }

  // 黄金粒子刷新
  if (s.nextOrbAt === 0) scheduleOrb(now);
  if (!activeOrb && now >= s.nextOrbAt) spawnOrb(now);

  // 成就检查
  if (now - lastAch > 600) {
    lastAch = now;
    const got = core.checkAchievements();
    if (got.length) {
      got.forEach(a => showToast('🏆 ' + a.name + ' · ' + a.desc, 'gold'));
      if (core.state.fxOn !== false) confetti();
      vibrate(15);
      buildAchFlags();
    }
  }

  // 自动购买
  if (s.autoBuy && now - lastAutoBuy > 250) {
    lastAutoBuy = now;
    core.autoBuyTick();
  }

  // 列表刷新（限流）
  if (now - lastList > 220) {
    lastList = now;
    updateLists(now, false);
  }
}

function buildAchFlags() {
  ACHIEVEMENTS.forEach(a => {
    const el = achRefs[a.id];
    if (el) el.classList.toggle('got', !!core.state.ach[a.id]);
  });
  $('achCount').textContent = core.achCount() + '/' + ACHIEVEMENTS.length;
}

export function renderAll() {
  updateLists(Date.now(), true);
  buildAchFlags();
  renderStarHead();
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
    const max = core.maxAffordable(i);
    const want = bulk === 'max' ? Math.max(1, max) : bulk;
    const n = Math.min(want, max);
    const can = n > 0;
    const costN = can ? n : want;
    const cost = core.genCost(i, costN);
    const each = g.prod * core.globalMult();
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
    const lv = core.starLevel(u.id);
    const maxed = lv >= u.max;
    const cost = core.starCost(u.id);
    const can = !maxed && s.stardust >= cost;
    ref.lv.textContent = lv + '/' + u.max;
    ref.cost.textContent = maxed ? '已满级' : '✦ ' + format(cost);
    ref.cost.className = 'cost ' + (maxed ? 'no' : can ? 'ok' : 'no');
    ref.btn.textContent = maxed ? '已满' : '升级';
    ref.card.classList.toggle('can', can);
    ref.card.classList.toggle('cant', !can);
  }

  renderStarHead();
}

function renderStarHead() {
  const s = core.state;
  $('starAmount').textContent = format(s.stardust);
  $('starGain').textContent = format(core.stardustGain());
  const btn = $('collapseBtn');
  const can = core.canCollapse();
  btn.disabled = !can;
  btn.textContent = can ? '坍缩重启 · +' + format(core.stardustGain()) + ' ✦' : '坍缩重启';
  $('collapseHint').textContent = can
    ? '本次运行累计 ' + format(s.totalRun) + ' 能量'
    : '本次运行 ' + format(s.totalRun) + ' / ' + format(COLLAPSE_REQUIRE) + ' 能量后解锁';

  const sg = core.shardGain();
  const sbtn = $('sgBtn');
  sbtn.disabled = sg < 1;
  sbtn.textContent = sg >= 1 ? '飞升奇点 · +' + sg + ' 碎片' : '飞升奇点';
  $('sgInfo').textContent = '永久碎片 ' + s.totalShards + ' 枚 · 每枚 +100% 产量 / +10% 速度';
  $('sgGain').textContent = sg >= 1
    ? '本次可获得 ' + sg + ' 枚碎片'
    : '需要累计 ' + format(SINGULARITY_REQUIRE) + ' 星尘（当前 ' + format(s.totalStardust) + '）';
}

function renderStats() {
  const s = core.state;
  const rows = [
    ['累计能量', format(s.totalAll)],
    ['点击次数', format(s.clicks)],
    ['最高连击', s.maxCombo + ' 层'],
    ['游戏速度', '×' + core.gameSpeed().toFixed(2)],
    ['全局倍率', '×' + core.globalMult().toFixed(2)],
    ['游戏时间', formatTime(s.playTime)],
    ['坍缩次数', s.collapses + ' 次'],
    ['累计星尘', format(s.totalStardust)],
    ['奇点碎片', s.totalShards + ' 枚'],
    ['黄金粒子', s.orbsTapped + ' 个'],
    ['离线效率', Math.round(core.offlineEff() * 100) + '%'],
    ['成就加成', '+' + (core.achCount() * 2) + '%'],
  ];
  $('statList').innerHTML = rows.map(r => '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
}

/* ---------------- 提示与弹窗 ---------------- */

export function showToast(text, cls = '') {
  const box = $('toasts');
  const d = document.createElement('div');
  d.className = 'toast ' + cls;
  d.innerHTML = text;
  box.appendChild(d);
  setTimeout(() => {
    d.classList.add('out');
    setTimeout(() => d.remove(), 320);
  }, 2200);
  while (box.children.length > 4) box.removeChild(box.firstChild);
}

export function showModal(title, body, actions) {
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
  m.classList.remove('hidden');
}

export function hideModal() {
  $('modal').classList.add('hidden');
}

export function showOfflineModal(info) {
  showModal('🌙 离线收益', '你离开了 <b>' + formatTime(info.total) + '</b>，' +
    '机器仍在运转：<br><br>结算时长 <b>' + formatTime(info.seconds) + '</b>（离线效率 ' +
    Math.round(info.eff * 100) + '%）<br>获得能量 <b>+' + format(info.gain) + '</b>', [
    { label: '收下', pri: true },
  ]);
}
