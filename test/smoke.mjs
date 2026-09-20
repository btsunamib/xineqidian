// 核心逻辑冒烟测试：node test/smoke.mjs
import assert from 'node:assert/strict';
import * as core from '../js/core.js';
import { GENERATORS, STAR_UPGRADES, ACHIEVEMENTS, COLLAPSE_REQUIRE, SINGULARITY_REQUIRE } from '../js/data.js';
import { format, parseNum } from '../js/util.js';

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

console.log('\n[1] 数字格式化');
ok('小数与千分位', () => {
  assert.equal(format(0), '0');
  assert.equal(format(999), '999');
  assert.equal(format(1500), '1.50K');
  assert.equal(format(1.5e6), '1.50M');
  assert.equal(format(1e12), '1.00T');
});
ok('超大数回落科学计数', () => {
  assert.match(format(1e120), /e120$/);
});
ok('parseNum 反向解析', () => {
  assert.equal(parseNum('1.50K'), 1500);
  assert.equal(parseNum('2.00M'), 2e6);
  assert.ok(Math.abs(parseNum(format(4.2e9)) - 4.2e9) < 1e7);
});

console.log('\n[2] 基础点击');
ok('初始状态干净', () => {
  const s = core.newState();
  assert.equal(s.energy, 0);
  assert.equal(s.gens.length, GENERATORS.length);
  assert.equal(s.shards, 0);
});
ok('点击获得能量并累计连击', () => {
  const t0 = 1000000;
  const a = core.tap(t0);
  assert.ok(a.gain > 0);
  assert.equal(core.state.clicks, 1);
  assert.equal(core.state.combo, 1);
  const b = core.tap(t0 + 300);
  assert.equal(core.state.combo, 2);
  assert.ok(b.gain >= a.gain);
});
ok('连击超时归零', () => {
  core.tick(0.1, core.state.comboAt + 5000);
  assert.equal(core.state.combo, 0);
});

console.log('\n[3] 发电机与产量');
ok('买不起时不扣费', () => {
  core.state.energy = 0;
  assert.equal(core.buyGen(0, 1), null);
});
ok('购买扣费并提升产量', () => {
  core.state.energy = 1e6;
  const before = core.state.energy;
  const res = core.buyGen(0, 5);
  assert.ok(res && res.n === 5);
  assert.equal(core.state.gens[0], 5);
  assert.ok(core.state.energy < before);
  assert.ok(core.eps() > 0);
});
ok('批量价格等于逐台价格之和', () => {
  const s = core.state;
  s.energy = 1e30;
  const owned = s.gens[1];
  const bulk = core.genCost(1, 3);
  let sum = 0;
  for (let k = 0; k < 3; k++) sum += GENERATORS[1].base * Math.pow(GENERATORS[1].growth, owned + k);
  assert.ok(Math.abs(bulk - sum) / sum < 1e-9);
});
ok('maxAffordable 结果可负担', () => {
  const s = core.state;
  s.energy = 5000;
  const n = core.maxAffordable(0);
  assert.ok(n >= 0);
  if (n > 0) assert.ok(core.genCost(0, n) <= s.energy + 1e-6);
  assert.ok(core.genCost(0, n + 1) > s.energy - 1e-6);
});
ok('tick 产生被动收益', () => {
  const s = core.state;
  const before = s.energy;
  core.tick(1, Date.now());
  assert.ok(s.energy > before);
  assert.ok(s.playTime > 0);
});

console.log('\n[4] 星尘与奇点');
ok('未达门槛不能坍缩', () => {
  Object.assign(core.state, core.newState());
  core.state.totalRun = 1e6;
  assert.equal(core.canCollapse(), false);
  assert.equal(core.doCollapse(), null);
});
ok('坍缩给星尘并重置本轮', () => {
  core.state.totalRun = COLLAPSE_REQUIRE;
  core.state.gens[0] = 42;
  const gain = core.stardustGain();
  assert.ok(gain >= 5);
  const res = core.doCollapse();
  assert.equal(res.gain, gain);
  assert.equal(core.state.totalRun, 0);
  assert.equal(core.state.gens[0], 0);
  assert.equal(core.state.stardust, gain);
  assert.equal(core.state.collapses, 1);
});
ok('星尘强化生效', () => {
  const s = core.state;
  s.stardust = 1000;
  const before = core.globalMult();
  const res = core.buyStar('resonance');
  assert.ok(res && res.level === 1);
  assert.ok(core.globalMult() > before);
});
ok('未达门槛不能飞升', () => {
  core.state.totalStardust = 0;
  assert.equal(core.canSingularity(), false);
  assert.equal(core.doSingularity(), null);
});
ok('飞升给碎片并清空星尘', () => {
  const s = core.state;
  s.totalStardust = SINGULARITY_REQUIRE;
  s.stardust = 500;
  const g = core.shardGain();
  assert.ok(g >= 3);
  const res = core.doSingularity();
  assert.equal(res.gain, g);
  assert.equal(s.stardust, 0);
  assert.equal(s.starUp.resonance || 0, 0);
  assert.equal(s.shards, g);
  assert.ok(core.globalMult() > 1);
});

console.log('\n[5] 存档');
ok('导出/导入往返一致', () => {
  const s = core.state;
  s.energy = 12345.6;
  s.clicks = 777;
  const code = core.exportSave();
  assert.ok(code.startsWith('XEQ1.'));
  const snap = { energy: s.energy, clicks: s.clicks, shards: s.shards };
  s.energy = 0;
  s.clicks = 0;
  s.shards = 0;
  assert.equal(core.importSave(code), true);
  assert.equal(s.energy, snap.energy);
  assert.equal(s.clicks, snap.clicks);
  assert.equal(s.shards, snap.shards);
});
ok('坏存档被拒绝', () => {
  assert.equal(core.importSave('这不是存档'), false);
  assert.equal(core.importSave(''), false);
});

console.log('\n[6] 成就与离线');
ok('成就解锁不重复', () => {
  const s = core.state;
  s.clicks = 999999;
  const got = core.checkAchievements();
  assert.ok(got.length > 0);
  assert.equal(core.checkAchievements().length, 0);
  assert.ok(Object.keys(s.ach).length <= ACHIEVEMENTS.length);
});
ok('离线收益封顶 8 小时', () => {
  const s = core.state;
  s.gens[0] = 100;
  s.starUp.offline = 4;
  s.lastSave = Date.now() - 100 * 3600 * 1000;
  const info = core.applyOffline();
  assert.ok(info);
  assert.equal(Math.round(info.seconds), 8 * 3600);
  assert.ok(info.gain > 0);
  assert.ok(core.offlineEff() > 0.5 && core.offlineEff() <= 1);
});
ok('配置表完整', () => {
  assert.equal(STAR_UPGRADES.length, 8);
  assert.equal(GENERATORS.length, 10);
  assert.ok(ACHIEVEMENTS.length >= 25);
});

console.log('\n通过 ' + pass + ' 项检查' + (process.exitCode ? '（存在失败）' : '，全部正常') + '\n');
