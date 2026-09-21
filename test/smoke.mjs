// 核心逻辑冒烟测试：node test/smoke.mjs
import assert from 'node:assert/strict';
import * as core from '../js/core.js';
import { GENERATORS, STAR_UPGRADES, PERKS, ACHIEVEMENTS, MORPHS, ELEMENTS, COLLAPSE_REQUIRE, SINGULARITY_REQUIRE, PERFECT_MULT, RESO_MAX } from '../js/data.js';
import { format, parseNum } from '../js/util.js';

let pass = 0;
function ok(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { console.error('  ✗ ' + name + ' -> ' + e.message); process.exitCode = 1; }
}
const PERIOD = 1750; // 脉动周期(ms)，无 tempo 词条时

console.log('\n[1] 数字格式化');
ok('小数与千分位', () => {
  assert.equal(format(0), '0');
  assert.equal(format(999), '999');
  assert.equal(format(1500), '1.50K');
  assert.equal(format(1.5e6), '1.50M');
  assert.equal(format(1e12), '1.00T');
});
ok('超大数回落科学计数', () => assert.match(format(1e120), /e120$/));
ok('parseNum 反向解析', () => {
  assert.equal(parseNum('1.50K'), 1500);
  assert.equal(parseNum('2.00M'), 2e6);
});

console.log('\n[2] 共振节拍判定');
ok('初始状态干净', () => {
  Object.assign(core.state, core.newState());
  assert.equal(core.state.energy, 0);
  assert.equal(core.state.perks.length, 0);
  assert.equal(core.state.perkPicksLeft, 1, '新游戏赠送 1 次词条抽卡');
  assert.equal(core.state.gens.length, GENERATORS.length);
});
ok('相位推进与周期', () => {
  const s = core.state;
  s.pulseStart = 1000000;
  assert.ok(Math.abs(core.pulsePeriod(s) - 1.75) < 1e-9);
  assert.ok(Math.abs(core.pulsePhase(1000000, s)) < 1e-9);
  assert.ok(Math.abs(core.pulsePhase(1000000 + PERIOD / 2, s) - 0.5) < 1e-6);
});
ok('窗口内判定为完美', () => {
  const s = core.state;
  s.pulseStart = 1000000;
  const t = 1000000 + Math.floor(PERIOD * 0.95);
  assert.equal(core.isPerfect(t, s), true);
});
ok('窗口外不是完美', () => {
  const s = core.state;
  s.pulseStart = 1000000;
  const t = 1000000 + Math.floor(PERIOD * 0.5);
  assert.equal(core.isPerfect(t, s), false);
});
ok('完美一击倍率与共振叠加', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  s.gens[0] = 10;
  s.pulseStart = 5000000;
  const base = core.clickGain(5000000 + PERIOD * 0.5, s);
  const t = 5000000 + Math.floor(PERIOD * 0.95);
  const before = s.energy;
  const r = core.tap(t, s);
  assert.equal(r.perfect, true);
  assert.equal(r.reso, 1);
  assert.ok(r.gain >= base * PERFECT_MULT * 0.99, '完美一击应放大 ' + PERFECT_MULT + ' 倍');
  assert.ok(s.energy - before === r.gain);
  assert.equal(s.perfects, 1);
});
ok('共振层提升全局产量', () => {
  const s = core.state;
  s.reso = 0;
  const m0 = core.globalMult(Date.now(), s);
  s.reso = 10;
  const m1 = core.globalMult(Date.now(), s);
  assert.ok(Math.abs(m1 / m0 - (1 + 10 * 0.08)) < 1e-9, '每层 +8% 应线性叠加');
  s.reso = RESO_MAX * 3;
  const m2 = core.globalMult(Date.now(), s);
  assert.ok(m2 < m0 * 3, '共振层应被上限约束');
  s.reso = 0;
});

console.log('\n[3] 连击 / 暴击 / 吞噬');
ok('连击窗口内累加、超时归零', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  s.pulseStart = 0;
  core.tap(1000, s);
  core.tap(1400, s);
  assert.equal(s.combo, 2);
  core.tick(0.1, 1000 + 5000, s);
  assert.equal(s.combo, 0);
});
ok('吞噬收益与计数', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  s.gens[0] = 50;
  const g = core.devourGain(Date.now(), s);
  assert.ok(g >= 1);
  const r = core.devour(Date.now(), s);
  assert.ok(r >= 1);
  assert.equal(s.devoured, 1);
});
ok('吞噬者词条放大 6 倍', () => {
  const s = core.state;
  const g0 = core.devourGain(Date.now(), s);
  s.perks = ['devour'];
  const g1 = core.devourGain(Date.now(), s);
  assert.ok(Math.abs(g1 / g0 - 6) < 1e-6);
  s.perks = [];
});

console.log('\n[4] 奇点爆发');
ok('充能到满才能释放', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  core.addCharge(10, s);
  assert.equal(core.burstReady(s), false);
  assert.equal(core.doBurst(Date.now(), s), null);
  core.addCharge(1000, s);
  assert.equal(s.charge, 100, '充能应封顶 100');
  assert.equal(core.burstReady(s), true);
});
ok('爆发提升产量并消耗充能', () => {
  const s = core.state;
  s.gens[0] = 20;
  const now = 2000000;
  const m0 = core.eps(now, s);
  const r = core.doBurst(now, s);
  assert.ok(r && r.duration > 0);
  assert.equal(s.charge, 0);
  assert.equal(s.bursts, 1);
  assert.ok(core.burstActive(now + 1000, s));
  assert.ok(core.eps(now + 1000, s) > m0 * 50, '爆发应大幅提升产量');
  assert.ok(!core.burstActive(now + r.duration * 1000 + 10, s));
});
ok('爆发期间点击必定完美', () => {
  const s = core.state;
  s.pulseStart = 3000000;
  const t = 3000000 + Math.floor(PERIOD * 0.4);
  core.addCharge(1000, s);
  core.doBurst(t, s);
  const r = core.tap(t + 10, s);
  assert.equal(r.perfect, true);
});

console.log('\n[5] 词条系统');
ok('抽卡给 3 个不重复选项', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  s.perkPicksLeft = 1;
  const c = core.ensureChoices(s);
  assert.equal(c.length, 3);
  assert.equal(new Set(c).size, 3);
});
ok('选中后进入 perks 并扣减次数', () => {
  const s = core.state;
  const id = s.perkChoices[0];
  const r = core.pickPerk(id, s);
  assert.ok(r && r.left === 0);
  assert.ok(s.perks.includes(id));
  assert.equal(s.perksTaken, 1);
  assert.equal(s.perkChoices.length, 0);
  assert.equal(core.pickPerk(id, s), null, '次数用完后不能再选');
});
ok('词条效果真实生效', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  s.gens[0] = 10;
  const base = core.eps(Date.now(), s);
  s.perks = ['greed'];
  assert.ok(core.eps(Date.now(), s) > base * 1.6);
  assert.ok(core.clickPower(Date.now(), s) < core.clickPower(Date.now(), s) / 0.6 * 1.0001);
  s.perks = ['abyss'];
  const c1 = core.genCost(0, 1, s);
  s.perks = [];
  const c0 = core.genCost(0, 1, s);
  assert.ok(Math.abs(c1 / c0 - 0.82) < 1e-9);
});
ok('重抽消耗星尘且递增', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  s.stardust = 1000;
  s.perkPicksLeft = 1;
  core.ensureChoices(s);
  const c0 = core.rerollCost(s);
  assert.ok(core.rerollPerks(s));
  assert.equal(s.stardust, 1000 - c0);
  assert.ok(core.rerollCost(s) > c0);
});
ok('跳过补偿 1 星尘', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  s.perkPicksLeft = 1;
  core.ensureChoices(s);
  const before = s.stardust;
  core.skipPerk(s);
  assert.equal(s.stardust, before + 1);
  assert.equal(s.perkPicksLeft, 0);
});

console.log('\n[6] 发电机与价格');
ok('买不起时不扣费', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  assert.equal(core.buyGen(0, 1, s), null);
});
ok('购买扣费并提升产量', () => {
  const s = core.state;
  s.energy = 1e6;
  const res = core.buyGen(0, 5, s);
  assert.ok(res && res.n === 5);
  assert.equal(s.gens[0], 5);
  assert.ok(core.eps(Date.now(), s) > 0);
});
ok('批量价格 = 逐台之和（含词条折扣）', () => {
  const s = core.state;
  s.energy = 1e30;
  s.perks = ['abyss'];
  const owned = s.gens[1];
  const bulk = core.genCost(1, 3, s);
  let sum = 0;
  for (let k = 0; k < 3; k++) sum += GENERATORS[1].base * Math.pow(GENERATORS[1].growth, owned + k) * 0.82;
  assert.ok(Math.abs(bulk - sum) / sum < 1e-9);
  s.perks = [];
});
ok('maxAffordable 不超支', () => {
  const s = core.state;
  s.energy = 5000;
  const n = core.maxAffordable(0, s);
  if (n > 0) assert.ok(core.genCost(0, n, s) <= s.energy + 1e-6);
  assert.ok(core.genCost(0, n + 1, s) > s.energy - 1e-6);
});
ok('tick 产生被动收益', () => {
  const s = core.state;
  const before = s.energy;
  core.tick(1, Date.now(), s);
  assert.ok(s.energy > before);
});

console.log('\n[7] 转生');
ok('未达门槛不能坍缩', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  s.totalRun = 1e6;
  assert.equal(core.canCollapse(s), false);
  assert.equal(core.doCollapse(Date.now(), s), null);
});
ok('坍缩给星尘、重置本轮并开启抽卡', () => {
  const s = core.state;
  s.totalRun = COLLAPSE_REQUIRE;
  s.gens[0] = 42;
  s.perks = ['greed'];
  const gain = core.stardustGain(s);
  const res = core.doCollapse(1000, s);
  assert.equal(res.gain, gain);
  assert.equal(s.totalRun, 0);
  assert.equal(s.gens[0], 0);
  assert.equal(s.perks.length, 0, '坍缩后词条清空重抽');
  assert.equal(s.perkPicksLeft, core.perkSlots(s));
  assert.ok(s.stardust >= gain);
  assert.equal(s.collapses, 1);
});
ok('词条槽位随星尘强化增加', () => {
  const s = core.state;
  const base = core.perkSlots(s);
  s.starUp.slots = 1;
  assert.equal(core.perkSlots(s), base + 1);
});
ok('星尘强化生效', () => {
  const s = core.state;
  s.stardust = 10000;
  const before = core.globalMult(Date.now(), s);
  const r = core.buyStar('resonance', s);
  assert.ok(r && r.level === 1);
  assert.ok(core.globalMult(Date.now(), s) > before);
});
ok('飞升给碎片并清空星尘', () => {
  const s = core.state;
  s.totalStardust = SINGULARITY_REQUIRE;
  s.stardust = 500;
  s.starUp.resonance = 3;
  const g = core.shardGain(s);
  assert.ok(g >= 3);
  const res = core.doSingularity(2000, s);
  assert.equal(res.gain, g);
  assert.equal(s.stardust, 0);
  assert.equal(s.starUp.resonance || 0, 0);
  assert.equal(s.shards, g);
});

console.log('\n[8] 存档 / 离线 / 成就');
ok('导出/导入往返一致', () => {
  const s = core.state;
  s.energy = 12345.6;
  s.clicks = 777;
  s.perks = ['greed', 'fury'];
  const code = core.exportSave(s);
  assert.ok(code.startsWith('XEQ2.'));
  const snap = { energy: s.energy, clicks: s.clicks, perks: s.perks.join(',') };
  s.energy = 0; s.clicks = 0; s.perks = [];
  assert.equal(core.importSave(code, s), true);
  assert.equal(s.energy, snap.energy);
  assert.equal(s.clicks, snap.clicks);
  assert.equal(s.perks.join(','), snap.perks);
});
ok('坏存档与非法词条被清理', () => {
  const s = core.state;
  assert.equal(core.importSave('这不是存档', s), false);
  assert.equal(core.importSave('', s), false);
  const bad = core.normalize({ perks: ['greed', 'not_a_perk', 'fury'], gens: [1, 'x', 3] });
  assert.equal(bad.perks.length, 2);
  assert.equal(bad.gens[0], 1);
  assert.equal(bad.gens[1], 0);
  assert.equal(bad.gens.length, GENERATORS.length);
});
ok('离线收益封顶且受虚空词条影响', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  s.gens[0] = 100;
  s.lastSave = Date.now() - 100 * 3600 * 1000;
  const info = core.applyOffline(Date.now(), s);
  assert.ok(info);
  assert.equal(Math.round(info.seconds), 8 * 3600);
  assert.ok(info.gain > 0);
  s.perks = ['void'];
  assert.ok(core.offlineCap(s) === 16 * 3600);
  assert.ok(core.offlineEff(s) >= 0.99);
  s.perks = [];
});
ok('成就解锁不重复', () => {
  const s = core.state;
  s.clicks = 999999;
  s.perfects = 999999;
  const got = core.checkAchievements(s);
  assert.ok(got.length > 0);
  assert.equal(core.checkAchievements(s).length, 0);
  assert.ok(Object.keys(s.ach).length <= ACHIEVEMENTS.length);
});
ok('配置表规模正确', () => {
  assert.equal(GENERATORS.length, 10);
  assert.equal(STAR_UPGRADES.length, 12);
  assert.equal(PERKS.length, 15);
  assert.ok(ACHIEVEMENTS.length >= 30);
});

console.log('\n[9] 核心形态');
ok('未解锁时不能选形态', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  assert.equal(core.morphUnlocked(s), false);
  assert.equal(core.chooseMorph('prism', s), null);
  assert.equal(s.morph, null);
});
ok('坍缩后解锁，且本世只能选一次', () => {
  const s = core.state;
  s.collapses = 1;
  assert.equal(core.morphUnlocked(s), true);
  assert.ok(core.chooseMorph('prism', s));
  assert.equal(s.morph, 'prism');
  assert.equal(core.chooseMorph('maw', s), null);
});
ok('棱镜：一击三判 + 单段打折 + 上限 30', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  s.collapses = 1;
  s.gens[0] = 20;
  const base = core.clickPower(Date.now(), s);
  core.chooseMorph('prism', s);
  assert.equal(core.morphAgg(s).clickSplit, 3);
  assert.ok(core.clickPower(Date.now(), s) < base, '单段收益应打折');
  assert.equal(core.resoMax(s), 30);
  s.pulseStart = 7000000;
  const t = 7000000 + Math.floor(1750 * 0.95);
  const before = s.reso;
  core.tap(t, s);
  assert.ok(s.reso - before >= 1, '完美段位应叠共振');
});
ok('噬渊：吞噬 ×12 且每次叠共振', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  s.collapses = 1;
  s.gens[0] = 100;
  const g0 = core.devourGain(Date.now(), s);
  core.chooseMorph('maw', s);
  const g1 = core.devourGain(Date.now(), s);
  assert.ok(Math.abs(g1 / g0 - 12) < 1e-6);
  s.reso = 0;
  core.devour(Date.now(), s);
  assert.equal(s.reso, 1);
});
ok('螺旋：共振不衰减', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  s.collapses = 1;
  core.chooseMorph('spiral', s);
  s.reso = 10;
  s.resoAt = 0;
  core.tick(5, 999999, s);
  assert.equal(s.reso, 10);
});
ok('脉冲星：爆发 ×2 时长 / ×3 倍率 / 脉动更快', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  s.collapses = 1;
  const d0 = core.burstDuration(s);
  const m0 = core.burstMult(s);
  core.chooseMorph('pulsar', s);
  assert.ok(Math.abs(core.burstDuration(s) / d0 - 2) < 1e-9);
  assert.ok(Math.abs(core.burstMult(s) / m0 - 3) < 1e-9);
  assert.ok(core.pulsePeriod(s) < 1.75);
});
ok('飞升后可重选形态', () => {
  const s = core.state;
  s.totalStardust = SINGULARITY_REQUIRE;
  assert.ok(core.doSingularity(Date.now(), s));
  assert.equal(s.morph, null);
  s.collapses = 2;
  assert.ok(core.chooseMorph('maw', s));
});

console.log('\n[10] 残响录制');
ok('坍缩 2 次前不能录制', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  assert.equal(core.echoUnlocked(s), false);
  assert.equal(core.startRecord(1000, s), null);
});
ok('录制 → 完成 → 生成残响', () => {
  const s = core.state;
  s.collapses = 2;
  assert.ok(core.startRecord(1000, s) > 0);
  core.tap(1100, s);
  core.tap(1600, s);
  core.tap(2300, s);
  assert.equal(s.recording, true);
  const e = core.finishRecord(5200, s);
  assert.ok(e);
  assert.equal(s.recording, false);
  assert.equal(e.taps.length, 3);
  assert.ok(e.len >= 1);
  assert.ok(e.rate >= 0 && e.rate <= 1);
});
ok('残响循环演奏并产生收益', () => {
  const s = core.state;
  s.gens[0] = 30;
  const before = s.energy;
  let got = 0;
  for (let i = 0; i < 60; i++) got += core.echoTick(0.1, Date.now(), s);
  assert.ok(got > 0);
  assert.ok(s.energy > before);
  assert.ok(s.echoHits >= 3);
});
ok('清除残响', () => {
  const s = core.state;
  core.clearEcho(s);
  assert.equal(core.hasEcho(s), false);
  assert.equal(core.echoTick(0.1, Date.now(), s), 0);
});
ok('存档清洗非法形态与残响', () => {
  const bad = core.normalize({ morph: 'nope', echo: { taps: [{ t: 1, perfect: true }, { t: -5 }], len: 0 } });
  assert.equal(bad.morph, null);
  assert.equal(bad.echo.taps.length, 1);
  assert.equal(bad.echo.len, 4);
});
ok('形态表完整', () => {
  assert.equal(MORPHS.length, 4);
  assert.equal(new Set(MORPHS.map(m => m.id)).size, 4);
});

console.log('\n[11] 引力阵（空间优化解谜）');
ok('未解锁时不能放置', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  s.totalAll = 1e7;
  s.gens[0] = 10;
  assert.equal(core.latticeUnlocked(s), false);
  assert.equal(core.placeEmitter(s, 7, 0), null);
  s.totalAll = 1e8;
  assert.equal(core.latticeUnlocked(s), true);
  assert.ok(core.placeEmitter(s, 7, 0));
});
ok('同一台机器只能放一个发射器', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  s.totalAll = 1e8;
  s.gens[0] = 10;
  s.gens[1] = 10;
  assert.ok(core.placeEmitter(s, 7, 0));
  assert.equal(core.placeEmitter(s, 8, 0), null, '重复类型应失败');
  assert.ok(core.placeEmitter(s, 8, 1));
  assert.equal(core.placedCount(s), 2);
});
ok('发射器数量受上限约束，升级后增加', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  s.totalAll = 1e8;
  for (let i = 0; i < 10; i++) s.gens[i] = 1;
  s.tideIdx = 3;
  assert.equal(core.latticeSlots(s), 3);
  const nodes = [7, 6, 8, 11, 13, 17];
  for (let k = 0; k < 3; k++) assert.ok(core.placeEmitter(s, nodes[k], k), '第 ' + k + ' 个应成功');
  assert.equal(core.placeEmitter(s, nodes[3], 3), null, '超上限应失败');
  s.starUp.emitters = 2;
  assert.equal(core.latticeSlots(s), 5);
  assert.ok(core.placeEmitter(s, nodes[3], 3), '升级后可继续放置');
});
ok('离核心越近档位越高', () => {
  assert.ok(core.nodeTierMult(7) > core.nodeTierMult(6));
  assert.ok(core.nodeTierMult(6) > core.nodeTierMult(1));
  assert.ok(core.nodeTierMult(1) > core.nodeTierMult(0));
});
ok('相邻同系 +25%，克制 -15%', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  s.totalAll = 1e8;
  for (let i = 0; i < 10; i++) s.gens[i] = 1;
  s.tideIdx = 3;
  s.lattice[7] = { t: 0 };
  assert.ok(Math.abs(core.latticeNodeMult(s, 7) - 1) < 1e-9);
  s.lattice[6] = { t: 2 };
  assert.ok(Math.abs(core.latticeNodeMult(s, 7) - 1.25) < 1e-9, '同系应为 1.25');
  s.lattice[6] = { t: 1 };
  assert.ok(Math.abs(core.latticeNodeMult(s, 7) - 0.85) < 1e-9, '克制应为 0.85');
  s.lattice[6] = null;
});
ok('潮汐期间对应系 ×3', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  s.totalAll = 1e8;
  s.gens[0] = 1;
  s.lattice[7] = { t: 0 };
  s.tideIdx = 3;
  const off = core.latticeNodeMult(s, 7);
  s.tideIdx = 0;
  const on = core.latticeNodeMult(s, 7);
  assert.ok(Math.abs(on / off - 3) < 1e-9);
  s.tideIdx = 3;
});
ok('断连的发射器只剩 20%', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  s.totalAll = 1e8;
  for (let i = 0; i < 10; i++) s.gens[i] = 1;
  s.tideIdx = 3;
  s.lattice[0] = { t: 5 };
  assert.equal(core.latticeOnline(s, 0), false);
  const offline = core.latticeNodeMult(s, 0);
  assert.ok(Math.abs(offline - 0.55 * 0.2) < 1e-9, '断连 = 档位 × 0.2');
  s.lattice[5] = { t: 5 };
  s.lattice[10] = { t: 6 };
  s.lattice[11] = { t: 7 };
  assert.equal(core.latticeOnline(s, 0), true, '经 5→10→11 应连回核心');
  assert.ok(core.latticeNodeMult(s, 0) > offline * 4);
});
ok('移除与清空', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  s.totalAll = 1e8;
  s.gens[0] = 1;
  core.placeEmitter(s, 7, 0);
  assert.equal(core.placedCount(s), 1);
  assert.ok(core.removeEmitter(s, 7));
  assert.equal(core.placedCount(s), 0);
  core.placeEmitter(s, 7, 0);
  core.clearLattice(s);
  assert.equal(core.placedCount(s), 0);
});
ok('引力阵产出计入总产量', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  s.totalAll = 1e8;
  s.tideIdx = 3;
  s.gens[0] = 100;
  const before = core.rawProd(s);
  assert.ok(core.placeEmitter(s, 7, 0));
  const after = core.rawProd(s);
  assert.ok(after > before);
  assert.ok(Math.abs(core.latticeProd(s) - (after - before)) < 1e-9);
  assert.ok(Math.abs(core.latticeProd(s) - 100 * 0.1 * 0.7) < 1e-9);
});
ok('坍缩后布局保留（重建机器即恢复）', () => {
  const s = core.state;
  Object.assign(s, core.newState());
  s.totalAll = 1e8;
  s.gens[0] = 1;
  core.placeEmitter(s, 7, 0);
  s.totalRun = COLLAPSE_REQUIRE;
  core.doCollapse(Date.now(), s);
  assert.equal(core.placedCount(s), 1);
});
ok('存档清洗非法引力阵', () => {
  const bad = core.normalize({ lattice: [{ t: 0 }, { t: 999 }, null], tideIdx: 99, tideStart: -5 });
  assert.equal(bad.lattice.length, 25);
  assert.equal(bad.lattice[0].t, 0);
  assert.equal(bad.lattice[1], null);
  assert.equal(bad.lattice[12], null);
  assert.equal(bad.tideIdx, 0);
  assert.equal(bad.tideStart, 0);
});
ok('存档中同一机器不会重复放置', () => {
  const lat = new Array(25).fill(null);
  lat[7] = { t: 0 };
  lat[8] = { t: 0 };
  lat[9] = { t: 1 };
  const s = core.normalize({ lattice: lat });
  assert.equal(core.placedCount(s), 2);
});

console.log('\n通过 ' + pass + ' 项检查' + (process.exitCode ? '（存在失败）' : '，全部正常') + '\n');
