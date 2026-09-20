// ============ 数值与内容配置 ============

// 围绕核心的轨道机器（orbit 用于视觉半径，color 用于轨道配色）
export const GENERATORS = [
  { id: 'dust',     name: '尘埃环',   icon: '🌫️', base: 15,     prod: 0.1,   growth: 1.15, orbit: 1.00, color: '#8fd8ff', desc: '最内圈的一层微尘，安静地绕着核心转。' },
  { id: 'furnace',  name: '粒子炉',   icon: '⚗️', base: 100,    prod: 1,     growth: 1.15, orbit: 1.24, color: '#7ef0c0', desc: '把尘埃烧成可吞噬的能量。' },
  { id: 'well',     name: '引力井',   icon: '🕳️', base: 1.1e3,  prod: 8,     growth: 1.15, orbit: 1.48, color: '#b39dff', desc: '向奇点借一点重力。' },
  { id: 'anti',     name: '反物质环', icon: '⭕', base: 1.2e4,  prod: 47,    growth: 1.15, orbit: 1.72, color: '#ff9ad5', desc: '湮灭是效率最高的燃烧。' },
  { id: 'rift',     name: '维度裂隙', icon: '🌀', base: 1.3e5,  prod: 260,   growth: 1.16, orbit: 1.98, color: '#6ee7ff', desc: '撕开一条缝，让能量自己漏进来。' },
  { id: 'corridor', name: '时间回廊', icon: '⏳', base: 1.4e6,  prod: 1400,  growth: 1.16, orbit: 2.24, color: '#ffd166', desc: '同一条产线，跑上无限次。' },
  { id: 'star',     name: '星核熔炉', icon: '☀️', base: 1.5e7,  prod: 7800,  growth: 1.16, orbit: 2.50, color: '#ffb347', desc: '点燃一颗恒星，只为了供电。' },
  { id: 'loom',     name: '宇宙织机', icon: '🕸️', base: 1.6e8,  prod: 44000, growth: 1.17, orbit: 2.76, color: '#9ef0a0', desc: '把星系编成一根线。' },
  { id: 'causal',   name: '因果引擎', icon: '⚙️', base: 1.7e9,  prod: 2.6e5, growth: 1.17, orbit: 3.02, color: '#c0c8ff', desc: '让结果先于原因发生。' },
  { id: 'entropy',  name: '熵之终结', icon: '🌑', base: 1.8e10, prod: 1.6e6, growth: 1.17, orbit: 3.28, color: '#ff7a90', desc: '把热寂本身接上插座。' },
];

// 星尘商店（永久强化）
export const STAR_UPGRADES = [
  { id: 'resonance', name: '共振共鸣', icon: '✨', base: 5,   growth: 1.6,  max: 60, desc: '全局产量 +25% / 级' },
  { id: 'slots',     name: '词条槽位', icon: '🧬', base: 25,  growth: 4.5,  max: 3,  desc: '坍缩后可多选 1 个奇点词条' },
  { id: 'perfect',   name: '完美聚焦', icon: '🎯', base: 15,  growth: 1.9,  max: 12, desc: '完美判定窗口 +6% / 级' },
  { id: 'clickSync', name: '点击共鸣', icon: '👆', base: 8,   growth: 1.8,  max: 25, desc: '点击力 ×1.8 / 级' },
  { id: 'burst',     name: '爆发核心', icon: '💥', base: 40,  growth: 2.1,  max: 10, desc: '奇点爆发时长 +1.5 秒 / 级' },
  { id: 'speed',     name: '时间流速', icon: '⏱️', base: 25,  growth: 2.2,  max: 10, desc: '游戏速度 +8% / 级' },
  { id: 'offline',   name: '深眠协议', icon: '🌙', base: 12,  growth: 1.9,  max: 10, desc: '离线效率 +5% / 级（基础 50%）' },
  { id: 'orb',       name: '黄金共振', icon: '🟡', base: 20,  growth: 2.0,  max: 12, desc: '黄金粒子频率 +12% / 级' },
  { id: 'autoClick', name: '自动点击器', icon: '🤖', base: 50, growth: 3.0, max: 10, desc: '每秒自动点击 1 次 / 级' },
  { id: 'autoBuy',   name: '智能采购', icon: '🛒', base: 500, growth: 1.0,  max: 1,  desc: '自动购买最便宜的机器' },
  { id: 'headstart', name: '奇点火种', icon: '🔥', base: 30,  growth: 2.4,  max: 8,  desc: '坍缩后起始能量 10^(3×级)' },
];

// 奇点词条：每次坍缩后 3 选 1，本轮生效，形成不同 build
// 乘算字段：prodMult / clickMult / costMult / critMult / stardustMult / burstMult
export const PERKS = [
  { id: 'greed',    name: '贪婪',     icon: '💰', rare: 'common', desc: '全局产量 +65%，点击力 -40%',        effects: { prodMult: 1.65, clickMult: 0.6 } },
  { id: 'fury',     name: '暴怒',     icon: '🔥', rare: 'common', desc: '暴击率 +20%，暴击倍率 ×2.5',        effects: { critChance: 0.2, critMult: 2.5 } },
  { id: 'abyss',    name: '深渊',     icon: '🕳️', rare: 'common', desc: '所有机器价格 -18%',                 effects: { costMult: 0.82 } },
  { id: 'devour',   name: '吞噬者',   icon: '🌀', rare: 'common', desc: '吞噬能量团收益 ×6',                 effects: { devourMult: 6 } },
  { id: 'swarm',    name: '蜂群',     icon: '🐝', rare: 'common', desc: '每台机器额外 +3% 全局产量',          effects: { swarm: 0.03 } },
  { id: 'reso',     name: '共振',     icon: '🎯', rare: 'rare',   desc: '完美判定窗口 +70%',                 effects: { perfectWindow: 0.7 } },
  { id: 'chain',    name: '连锁',     icon: '⚡', rare: 'rare',   desc: '完美一击后 3 秒内产量 ×8',           effects: { chainTime: 3, chainMult: 8 } },
  { id: 'overflow', name: '溢出',     icon: '🤖', rare: 'rare',   desc: '自动点击 +3 次/秒',                 effects: { autoClick: 3 } },
  { id: 'tempo',    name: '节拍',     icon: '🎵', rare: 'rare',   desc: '核心脉动速度 +35%（完美更频繁）',    effects: { tempo: 0.35 } },
  { id: 'lucky',    name: '幸运',     icon: '🍀', rare: 'rare',   desc: '黄金粒子出现频率 +80%',              effects: { orbFreq: 0.8 } },
  { id: 'void',     name: '虚空',     icon: '🌑', rare: 'rare',   desc: '离线效率 +50%，离线上限翻倍',        effects: { offlineEffAdd: 0.5, offlineCapMult: 2 } },
  { id: 'echo',     name: '回响',     icon: '🔔', rare: 'epic',   desc: '完美一击 40% 概率额外 +1 层共振',    effects: { echoChance: 0.4 } },
  { id: 'nova',     name: '新星',     icon: '💫', rare: 'epic',   desc: '爆发期间产量改为 ×250',              effects: { burstMult: 2.5 } },
  { id: 'crystal',  name: '结晶',     icon: '💎', rare: 'epic',   desc: '星尘获取 +130%',                    effects: { stardustMult: 2.3 } },
  { id: 'singular', name: '奇点',     icon: '🌌', rare: 'epic',   desc: '全局产量 ×3，但机器价格 +35%',       effects: { prodMult: 3, costMult: 1.35 } },
];

export const RARE_WEIGHT = { common: 62, rare: 30, epic: 8 };
export const RARE_COLOR = { common: '#8fd8ff', rare: '#b39dff', epic: '#ffcc4d' };
export const RARE_LABEL = { common: '普通', rare: '稀有', epic: '史诗' };

export const ACHIEVEMENTS = [
  { id: 'tap1',      name: '第一次接触', icon: '👆', desc: '点击 1 次',          cond: s => s.clicks >= 1 },
  { id: 'perfect1',  name: '踩上节拍',   icon: '🎯', desc: '首次完美一击',        cond: s => s.perfects >= 1 },
  { id: 'perfect50', name: '节奏感',     icon: '🎵', desc: '完美一击 50 次',      cond: s => s.perfects >= 50 },
  { id: 'perfect500',name: '心跳同步',   icon: '💓', desc: '完美一击 500 次',     cond: s => s.perfects >= 500 },
  { id: 'perfect5k', name: '律动大师',   icon: '🥁', desc: '完美一击 5000 次',    cond: s => s.perfects >= 5000 },
  { id: 'reso10',    name: '共振起步',   icon: '📶', desc: '共振叠到 10 层',      cond: s => s.maxReso >= 10 },
  { id: 'reso20',    name: '共振满载',   icon: '🔊', desc: '共振叠到满层',        cond: s => s.maxReso >= 20 },
  { id: 'devour50',  name: '吞噬者',     icon: '🌀', desc: '吞噬 50 个能量团',    cond: s => s.devoured >= 50 },
  { id: 'devour500', name: '贪食之口',   icon: '😋', desc: '吞噬 500 个能量团',   cond: s => s.devoured >= 500 },
  { id: 'burst1',    name: '第一次爆发', icon: '💥', desc: '释放奇点爆发',        cond: s => s.bursts >= 1 },
  { id: 'burst10',   name: '狂暴模式',   icon: '🌋', desc: '释放奇点爆发 10 次',  cond: s => s.bursts >= 10 },
  { id: 'e1e6',      name: '小有积蓄',   icon: '💰', desc: '累计 1e6 能量',       cond: s => s.totalAll >= 1e6 },
  { id: 'e1e9',      name: '能量洪流',   icon: '🌊', desc: '累计 1e9 能量',       cond: s => s.totalAll >= 1e9 },
  { id: 'e1e12',     name: '临界质量',   icon: '☢️', desc: '累计 1e12 能量',      cond: s => s.totalAll >= 1e12 },
  { id: 'e1e15',     name: '星系供能',   icon: '🌌', desc: '累计 1e15 能量',      cond: s => s.totalAll >= 1e15 },
  { id: 'e1e18',     name: '宇宙账单',   icon: '📜', desc: '累计 1e18 能量',      cond: s => s.totalAll >= 1e18 },
  { id: 'e1e21',     name: '超越数值',   icon: '🔢', desc: '累计 1e21 能量',      cond: s => s.totalAll >= 1e21 },
  { id: 'e1e24',     name: '能量之神',   icon: '👑', desc: '累计 1e24 能量',      cond: s => s.totalAll >= 1e24 },
  { id: 'genFirst',  name: '自动化开端', icon: '🔧', desc: '拥有任意 1 台机器',   cond: s => s.gens.some(g => g > 0) },
  { id: 'genAll10',  name: '产线齐全',   icon: '🏭', desc: '每种机器至少 10 台',  cond: s => s.gens.every(g => g >= 10) },
  { id: 'genAll100', name: '工业帝国',   icon: '🏙️', desc: '每种机器至少 100 台', cond: s => s.gens.every(g => g >= 100) },
  { id: 'orb1',      name: '抓到光了',   icon: '🌟', desc: '点中 1 个黄金粒子',   cond: s => s.orbsTapped >= 1 },
  { id: 'orb25',     name: '黄金猎手',   icon: '🎯', desc: '点中 25 个黄金粒子',  cond: s => s.orbsTapped >= 25 },
  { id: 'col1',      name: '第一次坍缩', icon: '💫', desc: '坍缩 1 次',           cond: s => s.collapses >= 1 },
  { id: 'col5',      name: '循环往复',   icon: '🔄', desc: '坍缩 5 次',           cond: s => s.collapses >= 5 },
  { id: 'col20',     name: '轮回专家',   icon: '♻️', desc: '坍缩 20 次',          cond: s => s.collapses >= 20 },
  { id: 'perk5',     name: '构筑成型',   icon: '🧬', desc: '累计选择 5 个词条',   cond: s => s.perksTaken >= 5 },
  { id: 'perk30',    name: '流派大师',   icon: '🧪', desc: '累计选择 30 个词条',  cond: s => s.perksTaken >= 30 },
  { id: 'sd1e3',     name: '星尘满仓',   icon: '✦',  desc: '累计 1e3 星尘',       cond: s => s.totalStardust >= 1e3 },
  { id: 'sd1e5',     name: '星尘富翁',   icon: '💎', desc: '累计 1e5 星尘',       cond: s => s.totalStardust >= 1e5 },
  { id: 'sd1e7',     name: '星辰之主',   icon: '🌠', desc: '累计 1e7 星尘',       cond: s => s.totalStardust >= 1e7 },
  { id: 'shard1',    name: '奇点旅人',   icon: '🕳️', desc: '飞升 1 次',           cond: s => s.shards >= 1 },
  { id: 'shard10',   name: '维度主宰',   icon: '🌀', desc: '拥有 10 枚奇点碎片',  cond: s => s.shards >= 10 },
  { id: 'time1h',    name: '挂机一小时', icon: '⏰', desc: '累计游玩 1 小时',     cond: s => s.playTime >= 3600 },
];

// ============ 常量 ============
export const PULSE_PERIOD   = 1.75;   // 核心脉动基础周期（秒）
export const PERFECT_WINDOW = 0.15;   // 完美判定窗口（相位比例）
export const PERFECT_GRACE  = 0.05;   // 迟到宽容（相位刚过 1 的一小段）
export const PERFECT_MULT   = 10;     // 完美一击基础倍率
export const RESO_MAX       = 20;     // 共振层上限
export const RESO_BONUS     = 0.08;   // 每层共振 +8% 全局产量
export const RESO_DECAY     = 3.2;    // 秒内无完美则开始掉层

export const CHARGE_MAX     = 100;    // 爆发能量槽
export const CHARGE_CLICK   = 2.2;    // 每次点击充能
export const CHARGE_PERFECT = 5.5;    // 完美一击充能
export const BURST_DURATION = 15;     // 爆发基础时长（秒）
export const BURST_MULT     = 100;    // 爆发基础产量倍率

export const CRIT_CHANCE    = 0.10;   // 基础暴击率
export const CRIT_MULT      = 5;      // 基础暴击倍率
export const COMBO_WINDOW   = 1.6;    // 连击窗口（秒）
export const COMBO_STEP     = 0.06;   // 每层连击 +6%
export const COMBO_MAX      = 80;     // 连击层上限

export const CLICK_SHARE    = 0.05;   // 点击力 = 1 + 5% 每秒产量
export const BOOST_DURATION = 30;     // 黄金粒子持续
export const BOOST_MULT     = 7;      // 黄金粒子倍率

export const DEVOUR_BASE    = 0.35;   // 吞噬收益 = 该值 × 每秒产量

export const COLLAPSE_REQUIRE    = 1e12;
export const SINGULARITY_REQUIRE = 2e5;
export const OFFLINE_CAP  = 8 * 3600;
export const OFFLINE_BASE = 0.5;
export const ACH_BONUS    = 0.02;
export const REROLL_COST  = 3;        // 重抽词条消耗星尘（每轮递增）

// ============ 核心形态：不可逆分支，直接改变核心循环与判定方式 ============
export const MORPHS = [
  {
    id: 'spiral', name: '螺旋', icon: '🌀', color: '#6ee7ff',
    tag: '均衡 · 共振不衰减',
    desc: '共振层永不衰减，全局产量 +15%。最稳的起手形态。',
    effects: { prodMult: 1.15, resoDecayMult: 0, resoMax: 20 },
  },
  {
    id: 'prism', name: '棱镜', icon: '🔺', color: '#b39dff',
    tag: '分裂 · 一击三判',
    desc: '每次点击分裂成 3 段独立判定，各自可能完美并叠共振；单段收益 ×0.45，共振上限提到 30。',
    effects: { clickSplit: 3, clickMult: 0.45, resoMax: 30 },
  },
  {
    id: 'maw', name: '噬渊', icon: '🦷', color: '#ff6ad5',
    tag: '吞噬 · 拖动为主',
    desc: '吞噬收益 ×12，且每次吞噬叠 1 层共振；代价是自动产量 ×0.35。',
    effects: { devourMult: 12, prodMult: 0.35, resoPerDevour: 1 },
  },
  {
    id: 'pulsar', name: '脉冲星', icon: '📡', color: '#ffcc4d',
    tag: '爆发 · 充能极快',
    desc: '爆发时长 ×2、爆发产量再 ×3；代价是常态产量 ×0.6，脉动快 25%（更难踩）。',
    effects: { burstDurationMult: 2, burstMult: 3, prodMult: 0.6, pulseSpeed: 1.25 },
  },
];

export const MORPH_UNLOCK_COLLAPSES = 1;   // 坍缩 1 次后解锁形态
export const RECORD_LEN  = 4;              // 残响录制时长（秒）
export const ECHO_RATE   = 0.6;            // 残响收益系数
export const ECHO_UNLOCK_COLLAPSES = 2;    // 坍缩 2 次后解锁残响录制
export const ECHO_MAX_TAPS = 120;          // 单次录制最多记录点击数
