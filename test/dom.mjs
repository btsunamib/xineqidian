// 整站 DOM 冒烟测试：jsdom 真启动游戏，模拟点击 / 拖动吞噬 / 转生抽卡
// 运行：node test/dom.mjs（依赖 devDependency jsdom，缺失时自动跳过）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let JSDOM;
try {
  ({ JSDOM } = await import('jsdom'));
} catch (e) {
  console.log('跳过 DOM 测试：未安装 jsdom（npm i 后可用）');
  process.exit(0);
}

let pass = 0;
let fail = 0;
async function ok(name, fn) {
  try {
    await fn();
    pass++;
    console.log('  ✓ ' + name);
  } catch (e) {
    fail++;
    console.error('  ✗ ' + name + ' -> ' + e.message);
    process.exitCode = 1;
  }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function def(name, value) {
  try { Object.defineProperty(globalThis, name, { value, configurable: true, writable: true }); }
  catch (e) { globalThis[name] = value; }
}

// ---- jsdom 环境 ----
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dom = new JSDOM(html, { url: 'https://example.com/', pretendToBeVisual: true });
const w = dom.window;

const gradient = { addColorStop() {} };
function makeCtx() {
  const store = {};
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === 'symbol') return undefined;
      if (k === 'createRadialGradient' || k === 'createLinearGradient' || k === 'createPattern') return () => gradient;
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
w.HTMLCanvasElement.prototype.getContext = () => makeCtx();

def('window', w);
def('document', w.document);
def('navigator', w.navigator);
def('localStorage', w.localStorage);
def('requestAnimationFrame', cb => setTimeout(() => cb(performance.now()), 16));
def('cancelAnimationFrame', id => clearTimeout(id));

const $ = id => w.document.getElementById(id);
const pev = (el, type, x, y) => el.dispatchEvent(new w.MouseEvent(type, {
  bubbles: true, cancelable: true, clientX: x, clientY: y,
}));
const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));

console.log('\n[DOM-1] 启动与首屏');
const core = await import('../js/core.js');
const fx = await import('../js/fx.js');
const ui = await import('../js/ui.js');
await import('../js/main.js');
await sleep(1400);

await ok('关键节点齐全', () => {
  ['fx', 'stage', 'energy', 'genList', 'starList', 'perkList', 'perkCodex', 'achList',
    'tabs', 'views', 'modal', 'burstBtn', 'chargeFill', 'resoFill', 'comboFill'].forEach(id => {
    assert.ok($(id), '缺少 #' + id);
  });
});
await ok('列表渲染完整', () => {
  assert.equal($('genList').querySelectorAll('.card').length, 10);
  assert.equal($('starList').querySelectorAll('.card').length, 11);
  assert.equal($('achList').querySelectorAll('.ach').length, 34);
  assert.ok($('perkCodex').querySelectorAll('span').length >= 15);
});
await ok('开局自动弹出词条抽卡', () => {
  assert.ok(!$('modal').classList.contains('hidden'), '抽卡弹窗应可见');
  assert.equal(w.document.querySelectorAll('.draft-card').length, 3);
});

console.log('\n[DOM-2] 点击共振');
await ok('抽卡可选中并写回状态', () => {
  click(w.document.querySelector('.draft-card'));
  assert.equal(core.state.perks.length, 1);
  assert.equal(core.state.perkPicksLeft, 0);
  assert.ok($('modal').classList.contains('hidden'));
});

let clicksAfterTap = 0;
await ok('轻点核心记为一次点击并加能量', async () => {
  const before = core.state.energy;
  pev($('stage'), 'pointerdown', 160, 220);
  pev($('stage'), 'pointerup', 160, 220);
  assert.equal(core.state.clicks, 1);
  assert.ok(core.state.energy > before);
  await sleep(90);
  assert.notEqual($('energy').textContent, '0');
  clicksAfterTap = core.state.clicks;
});
await ok('拖动不触发点击（改为吞噬）', () => {
  pev($('stage'), 'pointerdown', 120, 200);
  pev($('stage'), 'pointermove', 240, 240);
  pev($('stage'), 'pointermove', 320, 260);
  pev($('stage'), 'pointerup', 320, 260);
  assert.equal(core.state.clicks, clicksAfterTap, '拖动不应计入点击次数');
});
await ok('渲染管线可执行且不抛错', () => {
  const now = Date.now();
  for (let i = 0; i < 6; i++) fx.render(0.016, now + i * 16);
  fx.shockwave(100, 100, 1.2, [255, 200, 90]);
  fx.sparks(100, 100, 12, { speed: 4 });
  fx.confettiBurst();
  for (let i = 0; i < 6; i++) fx.render(0.016, now + 100 + i * 16);
});
await ok('HUD 数值在刷新', () => {
  assert.match($('chipEps').textContent, /\/s/);
  assert.match($('statMult').textContent, /^×/);
  assert.match($('chargeFill').style.width, /%$/);
});

console.log('\n[DOM-3] 购买与爆发');
await ok('点击卡片购买发电机', () => {
  core.state.energy = 1e7;
  click($('genList').querySelectorAll('.card')[0]);
  assert.equal(core.state.gens[0], 1);
});
await ok('×10 批量购买生效', () => {
  click(w.document.querySelector('#bulk button[data-bulk="10"]'));
  assert.equal(core.state.bulk, 10);
  core.state.energy = 1e7;
  const before = core.state.gens[0];
  click($('genList').querySelectorAll('.card')[0]);
  assert.equal(core.state.gens[0], before + 10);
});
await ok('充能满后按钮可用，点击可爆发', async () => {
  core.addCharge(1000, core.state);
  await sleep(90);
  const btn = $('burstBtn');
  assert.equal(btn.disabled, false);
  click(btn);
  assert.equal(core.state.bursts, 1);
  assert.equal(core.state.charge, 0);
  assert.ok(core.burstActive(Date.now(), core.state));
});

console.log('\n[DOM-4] 标签与转生');
await ok('五个标签可切换', () => {
  ['star', 'perk', 'ach', 'set', 'gen'].forEach(v => {
    click(w.document.querySelector('#tabs button[data-view="' + v + '"]'));
    assert.ok($('view-' + v).classList.contains('active'), v + ' 未激活');
  });
});
await ok('坍缩需要确认并重开抽卡', async () => {
  core.state.totalRun = 1e12;
  assert.ok(core.stardustGain(core.state) >= 5);
  click($('collapseBtn'));
  assert.ok(!$('modal').classList.contains('hidden'));
  click($('modalActions').querySelector('.pri'));
  assert.equal(core.state.collapses, 1);
  assert.equal(core.state.perks.length, 0);
  assert.equal(core.state.perkPicksLeft, core.perkSlots(core.state));

  await sleep(700);
  assert.equal(w.document.querySelectorAll('.draft-card').length, 3, '坍缩后应弹出抽卡');
  click(w.document.querySelector('.draft-card'));
  await sleep(450);
  assert.equal(core.state.perks.length, 1);
  assert.equal(w.document.querySelectorAll('.draft-card').length, 3, '第二次抽卡应出现');
  click(w.document.querySelector('.draft-card'));
  await sleep(200);
  assert.equal(core.state.perks.length, 2);
  assert.equal(core.state.perkPicksLeft, 0);
});
await ok('星尘强化可购买', () => {
  core.state.stardust = 1e6;
  click($('starList').querySelectorAll('.card')[0]);
  assert.equal(core.state.starUp.resonance, 1);
});

console.log('\n[DOM-5] 设置与存档');
await ok('写入 localStorage', () => {
  core.save(Date.now(), core.state);
  const raw = w.localStorage.getItem('xineqidian_save_v2');
  assert.ok(raw && raw.length > 80);
  assert.equal(JSON.parse(raw).gens.length, 10);
});
await ok('开关可切换并写回状态', () => {
  const t = $('fxToggle');
  t.checked = false; t.dispatchEvent(new w.Event('change'));
  assert.equal(core.state.fxOn, false);
  t.checked = true; t.dispatchEvent(new w.Event('change'));
  assert.equal(core.state.fxOn, true);

  const a = $('audioToggle');
  a.checked = false; a.dispatchEvent(new w.Event('change'));
  assert.equal(core.state.audioOn, false);
  a.checked = true; a.dispatchEvent(new w.Event('change'));
  assert.equal(core.state.audioOn, true);

  const h = $('hapticsToggle');
  h.checked = false; h.dispatchEvent(new w.Event('change'));
  assert.equal(core.state.haptics, false);
});
await ok('统计面板有内容', () => {
  assert.ok($('statList').children.length >= 12);
});
await ok('词条面板显示已装备', () => {
  click(w.document.querySelector('#tabs button[data-view="perk"]'));
  assert.ok($('perkList').querySelectorAll('.card').length >= 2, '应显示 2 个已装备词条');
  assert.ok($('perkCodex').querySelectorAll('span.owned').length >= 2);
});

console.log('\n[DOM-6] 词条选择（回归测试）');
await ok('抽卡卡片是 button 且能点选', () => {
  core.state.perkChoices = [];
  core.state.perkPicksLeft = 1;
  ui.showDraft();
  const cards = w.document.querySelectorAll('.draft-card');
  assert.equal(cards.length, 3);
  assert.equal(cards[0].tagName, 'BUTTON');
  const before = core.state.perks.length;
  click(cards[0]);
  assert.equal(core.state.perks.length, before + 1);
  assert.equal(core.state.perkPicksLeft, 0);
  assert.ok($('modal').classList.contains('hidden'));
});
await ok('点卡片内部子元素也能选中（事件委托）', () => {
  core.state.perkChoices = [];
  core.state.perkPicksLeft = 1;
  ui.showDraft();
  const inner = w.document.querySelector('.draft-card .dn');
  assert.ok(inner, '卡片内部结构应存在');
  const before = core.state.perks.length;
  click(inner);
  assert.equal(core.state.perks.length, before + 1);
  assert.equal(core.state.perkPicksLeft, 0);
});
await ok('跳过按钮可用', () => {
  core.state.perkChoices = [];
  core.state.perkPicksLeft = 1;
  ui.showDraft();
  const s0 = core.state.stardust;
  click($('draftSkip'));
  assert.equal(core.state.perkPicksLeft, 0);
  assert.equal(core.state.stardust, s0 + 1);
});

console.log('\n[DOM-7] 形态与残响');
await ok('坍缩后形态卡解锁并可选', () => {
  core.state.collapses = Math.max(core.state.collapses, 1);
  core.state.morph = null;
  ui.renderAll();
  const cards = w.document.querySelectorAll('.morph-card');
  assert.equal(cards.length, 4);
  assert.ok(!cards[0].classList.contains('locked'), '已解锁不应显示锁定');
  click(cards[1]);
  assert.ok(!$('modal').classList.contains('hidden'), '应弹出确认框');
  click($('modalActions').querySelector('.pri'));
  assert.ok(core.state.morph, '形态应已选定');
});
await ok('残响按钮在坍缩 2 次后可用并可开始录制', () => {
  core.state.collapses = 2;
  ui.renderAll();
  assert.equal($('recordBtn').disabled, false);
  click($('recordBtn'));
  assert.equal(core.state.recording, true);
});
await ok('清理录制状态后按钮恢复', () => {
  core.state.recording = false;
  core.state.recordBuf = [];
  ui.renderAll();
  assert.equal($('recordBtn').disabled, false);
});

console.log('\n通过 ' + pass + ' 项 DOM 检查' + (fail ? '（' + fail + ' 项失败）' : '，全部正常') + '\n');
process.exit(process.exitCode || 0);
