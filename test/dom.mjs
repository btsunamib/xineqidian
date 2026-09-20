// 整站 DOM 冒烟测试：用 jsdom 真正启动一遍游戏并模拟操作
// 运行：node test/dom.mjs（需要 devDependency jsdom；缺失时自动跳过）
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
function ok(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ✓ ' + name);
  } catch (e) {
    console.error('  ✗ ' + name + ' -> ' + e.message);
    process.exitCode = 1;
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function def(name, value) {
  try {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  } catch (e) {
    globalThis[name] = value;
  }
}

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dom = new JSDOM(html, { url: 'https://example.com/', pretendToBeVisual: true });
const w = dom.window;
w.HTMLCanvasElement.prototype.getContext = () => null;

def('window', w);
def('document', w.document);
def('navigator', w.navigator);
def('localStorage', w.localStorage);
def('requestAnimationFrame', cb => setTimeout(() => cb(w.performance.now()), 16));
def('cancelAnimationFrame', id => clearTimeout(id));

const $ = id => w.document.getElementById(id);
const fire = (el, type, extra = {}) => {
  const ev = new w.MouseEvent(type, Object.assign({ bubbles: true, cancelable: true, clientX: 120, clientY: 220 }, extra));
  el.dispatchEvent(ev);
  return ev;
};

console.log('\n[DOM-1] 启动');
const core = await import('../js/core.js');
await import('../js/main.js');
await sleep(150);

ok('页面节点齐全', () => {
  ['energy', 'orb', 'genList', 'starList', 'achList', 'tabs', 'views', 'modal'].forEach(id => {
    assert.ok($(id), '缺少 #' + id);
  });
});
ok('发电机与成就列表已渲染', () => {
  assert.equal($('genList').querySelectorAll('.card').length, 10);
  assert.equal($('achList').querySelectorAll('.ach').length, 29);
});
ok('主循环在刷新 HUD', () => {
  assert.equal($('chipEps').textContent.includes('/s'), true);
  assert.match($('statMult').textContent, /^×/);
});

console.log('\n[DOM-2] 点击核心');
ok('点一下会加能量并更新界面', () => {
  const before = core.state.energy;
  fire($('orb'), 'pointerdown');
  assert.equal(core.state.clicks, 1);
  assert.ok(core.state.energy > before);
  assert.notEqual($('energy').textContent, '0');
});
ok('连击在界面上显示', () => {
  fire($('orb'), 'pointerdown');
  fire($('orb'), 'pointerdown');
  assert.ok(core.state.combo >= 3);
  assert.match($('comboText').textContent, /连击 [3-9]/);
});

console.log('\n[DOM-3] 购买与批量');
ok('点击卡片购买发电机', () => {
  core.state.energy = 1e6;
  const card = $('genList').querySelectorAll('.card')[0];
  fire(card, 'click');
  assert.equal(core.state.gens[0], 1);
  assert.ok(core.state.energy < 1e6);
});
ok('×10 批量购买生效', () => {
  const btn = w.document.querySelector('#bulk button[data-bulk="10"]');
  fire(btn, 'click');
  assert.equal(core.state.bulk, 10);
  core.state.energy = 1e7;
  const before = core.state.gens[0];
  fire($('genList').querySelectorAll('.card')[0], 'click');
  assert.equal(core.state.gens[0], before + 10);
});
ok('MAX 购买不会超支', () => {
  core.state.energy = 1e5;
  fire(w.document.querySelector('#bulk button[data-bulk="max"]'), 'click');
  fire($('genList').querySelectorAll('.card')[1], 'click');
  assert.ok(core.state.energy >= 0);
  assert.ok(core.state.gens[1] > 0);
});

console.log('\n[DOM-4] 标签与成就');
ok('切换标签页', () => {
  fire(w.document.querySelector('#tabs button[data-view="star"]'), 'click');
  assert.ok($('view-star').classList.contains('active'));
  assert.ok(!$('view-gen').classList.contains('active'));
});
ok('成就解锁会点亮格子', async () => {
  core.state.clicks = 99999;
  return sleep(750).then(() => {
    assert.ok(w.document.querySelectorAll('#achList .ach.got').length > 0);
  });
});

console.log('\n[DOM-5] 坍缩与星尘');
ok('坍缩需要确认并生效', () => {
  core.state.totalRun = 1e12;
  const g = core.stardustGain();
  assert.ok(g >= 5);
  fire($('collapseBtn'), 'click');
  assert.ok(!$('modal').classList.contains('hidden'), '应弹出确认框');
  fire($('modalActions').querySelector('.pri'), 'click');
  assert.equal(core.state.collapses, 1);
  assert.equal(core.state.stardust, g);
  assert.equal(core.state.totalRun, 0);
});
ok('购买星尘强化', () => {
  core.state.stardust = 1e6;
  const card = $('starList').querySelectorAll('.card')[0];
  fire(card, 'click');
  assert.equal(core.state.starUp.resonance, 1);
});

console.log('\n[DOM-6] 存档与设置');
ok('写入 localStorage', () => {
  core.save();
  const raw = w.localStorage.getItem('xineqidian_save_v1');
  assert.ok(raw && raw.length > 50);
  assert.ok(JSON.parse(raw).gens.length === 10);
});
ok('设置开关可切换', () => {
  const t = $('fxToggle');
  t.checked = false;
  fire(t, 'change');
  assert.equal(core.state.fxOn, false);
  t.checked = true;
  fire(t, 'change');
  assert.equal(core.state.fxOn, true);
  const h = $('hapticsToggle');
  h.checked = false;
  fire(h, 'change');
  assert.equal(core.state.haptics, false);
});
ok('统计面板有数据', () => {
  assert.ok($('statList').children.length >= 10);
});

console.log('\n通过 ' + pass + ' 项 DOM 检查' + (process.exitCode ? '（存在失败）' : '，全部正常') + '\n');
process.exit(process.exitCode || 0);
