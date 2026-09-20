// 全部数值配置表

export const GENERATORS = [
  { id: 'dust',   name: '微尘收集器', icon: '🌫️', base: 15,     prod: 0.1,     growth: 1.15, desc: '从虚空中筛出第一粒尘埃。' },
  { id: 'furnace',name: '粒子熔炉',   icon: '⚗️', base: 100,    prod: 1,       growth: 1.15, desc: '把尘埃烧成能量。' },
  { id: 'tower',  name: '奇点萃取塔', icon: '🗼', base: 1.1e3,  prod: 8,       growth: 1.15, desc: '向奇点借一点重力。' },
  { id: 'ring',   name: '反物质环',   icon: '⭕', base: 1.2e4,  prod: 47,      growth: 1.15, desc: '湮灭是最高效的燃烧。' },
  { id: 'rift',   name: '维度裂隙',   icon: '🌀', base: 1.3e5,  prod: 260,     growth: 1.16, desc: '撕开一条缝，让能量漏进来。' },
  { id: 'corridor',name:'时间回廊',   icon: '⏳', base: 1.4e6,  prod: 1400,    growth: 1.16, desc: '同一条产线，跑上无限次。' },
  { id: 'star',   name: '星核熔炉',   icon: '☀️', base: 1.5e7,  prod: 7800,    growth: 1.16, desc: '点燃一颗星，只为供电。' },
  { id: 'loom',   name: '宇宙织机',   icon: '🕸️', base: 1.6e8,  prod: 44000,   growth: 1.17, desc: '把星系编成一根线。' },
  { id: 'causal', name: '因果引擎',   icon: '⚙️', base: 1.7e9,  prod: 2.6e5,   growth: 1.17, desc: '让结果先于原因发生。' },
  { id: 'entropy',name: '熵之终结',   icon: '🕳️', base: 1.8e10, prod: 1.6e6,   growth: 1.17, desc: '把热寂本身接上插座。' },
];

export const STAR_UPGRADES = [
  { id: 'resonance', name: '星尘共鸣', icon: '✨', base: 5,   growth: 1.6,  max: 60, desc: '全局产量 +30% / 级' },
  { id: 'clickSync', name: '点击共鸣', icon: '👆', base: 8,   growth: 1.8,  max: 25, desc: '点击力 ×2 / 级' },
  { id: 'speed',     name: '时间流速', icon: '⏱️', base: 25,  growth: 2.2,  max: 10, desc: '游戏速度 +8% / 级' },
  { id: 'offline',   name: '深眠协议', icon: '🌙', base: 12,  growth: 1.9,  max: 10, desc: '离线效率 +5% / 级（基础 50%）' },
  { id: 'orb',       name: '黄金共振', icon: '🟡', base: 20,  growth: 2.0,  max: 12, desc: '黄金粒子频率 +12% / 级，持续 +3 秒' },
  { id: 'headstart', name: '奇点火种', icon: '🔥', base: 30,  growth: 2.4,  max: 8,  desc: '坍缩后起始能量 10^(3×级)' },
  { id: 'autoClick', name: '自动点击器', icon: '🤖', base: 50, growth: 3.0, max: 10, desc: '每秒自动点击 1 次 / 级' },
  { id: 'autoBuy',   name: '智能采购', icon: '🛒', base: 500, growth: 1.0,  max: 1,  desc: '解锁自动购买最便宜的发电机' },
];

export const ACHIEVEMENTS = [
  { id: 'tap1',      name: '第一次接触', icon: '👆', desc: '点击 1 次',        cond: s => s.clicks >= 1 },
  { id: 'tap500',    name: '手速不错',   icon: '✋', desc: '点击 500 次',      cond: s => s.clicks >= 500 },
  { id: 'tap5000',   name: '点爆屏幕',   icon: '💥', desc: '点击 5000 次',     cond: s => s.clicks >= 5000 },
  { id: 'combo50',   name: '连击入门',   icon: '🔗', desc: '连击达到 50',      cond: s => s.maxCombo >= 50 },
  { id: 'combo100',  name: '连击大师',   icon: '⚡', desc: '连击达到 100',     cond: s => s.maxCombo >= 100 },
  { id: 'e1e3',      name: '一粒尘埃',   icon: '🌱', desc: '累计 1e3 能量',    cond: s => s.totalAll >= 1e3 },
  { id: 'e1e6',      name: '小有积蓄',   icon: '💰', desc: '累计 1e6 能量',    cond: s => s.totalAll >= 1e6 },
  { id: 'e1e9',      name: '能量洪流',   icon: '🌊', desc: '累计 1e9 能量',    cond: s => s.totalAll >= 1e9 },
  { id: 'e1e12',     name: '临界质量',   icon: '☢️', desc: '累计 1e12 能量',   cond: s => s.totalAll >= 1e12 },
  { id: 'e1e15',     name: '星系供能',   icon: '🌌', desc: '累计 1e15 能量',   cond: s => s.totalAll >= 1e15 },
  { id: 'e1e18',     name: '宇宙账单',   icon: '📜', desc: '累计 1e18 能量',   cond: s => s.totalAll >= 1e18 },
  { id: 'e1e21',     name: '超越数值',   icon: '🔢', desc: '累计 1e21 能量',   cond: s => s.totalAll >= 1e21 },
  { id: 'e1e24',     name: '能量之神',   icon: '👑', desc: '累计 1e24 能量',   cond: s => s.totalAll >= 1e24 },
  { id: 'genFirst',  name: '自动化开端', icon: '🔧', desc: '拥有任意 1 台机器', cond: s => s.gens.some(g => g > 0) },
  { id: 'genAll10',  name: '产线齐全',   icon: '🏭', desc: '每种机器至少 10 台', cond: s => s.gens.every(g => g >= 10) },
  { id: 'genAll100', name: '工业帝国',   icon: '🏙️', desc: '每种机器至少 100 台', cond: s => s.gens.every(g => g >= 100) },
  { id: 'orb1',      name: '抓到光了',   icon: '🌟', desc: '点中 1 个黄金粒子', cond: s => s.orbsTapped >= 1 },
  { id: 'orb25',     name: '黄金猎手',   icon: '🎯', desc: '点中 25 个黄金粒子', cond: s => s.orbsTapped >= 25 },
  { id: 'orb100',    name: '光速收藏家', icon: '🏅', desc: '点中 100 个黄金粒子', cond: s => s.orbsTapped >= 100 },
  { id: 'col1',      name: '第一次坍缩', icon: '💫', desc: '坍缩 1 次',        cond: s => s.collapses >= 1 },
  { id: 'col5',      name: '循环往复',   icon: '🔄', desc: '坍缩 5 次',        cond: s => s.collapses >= 5 },
  { id: 'col20',     name: '轮回专家',   icon: '♻️', desc: '坍缩 20 次',       cond: s => s.collapses >= 20 },
  { id: 'sd1e3',     name: '星尘满仓',   icon: '✦',  desc: '累计 1e3 星尘',    cond: s => s.totalStardust >= 1e3 },
  { id: 'sd1e5',     name: '星尘富翁',   icon: '💎', desc: '累计 1e5 星尘',    cond: s => s.totalStardust >= 1e5 },
  { id: 'sd1e7',     name: '星辰之主',   icon: '🌠', desc: '累计 1e7 星尘',    cond: s => s.totalStardust >= 1e7 },
  { id: 'shard1',    name: '奇点旅人',   icon: '🕳️', desc: '飞升 1 次',        cond: s => s.shards >= 1 },
  { id: 'shard10',   name: '维度主宰',   icon: '🌀', desc: '拥有 10 枚奇点碎片', cond: s => s.shards >= 10 },
  { id: 'time1h',    name: '挂机一小时', icon: '⏰', desc: '累计游玩 1 小时',  cond: s => s.playTime >= 3600 },
  { id: 'time10h',   name: '时间管理',   icon: '📅', desc: '累计游玩 10 小时', cond: s => s.playTime >= 36000 },
];

export const COLLAPSE_REQUIRE = 1e12;      // 首次坍缩门槛（本次运行累计能量）
export const SINGULARITY_REQUIRE = 2e5;    // 首次飞升门槛（累计星尘）
export const OFFLINE_CAP = 8 * 3600;       // 离线收益上限（秒）
export const OFFLINE_BASE = 0.5;           // 离线效率基础
export const ACH_BONUS = 0.02;             // 每个成就 +2%
export const COMBO_WINDOW = 1.5;           // 连击窗口（秒）
export const COMBO_STEP = 0.05;            // 每层连击 +5%
export const COMBO_MAX = 100;              // 连击上限层数
export const CRIT_CHANCE = 0.1;            // 暴击率
export const CRIT_MULT = 5;                // 暴击倍率
export const BOOST_DURATION = 30;          // 黄金粒子基础持续（秒）
export const BOOST_MULT = 7;               // 黄金粒子倍率
export const CLICK_SHARE = 0.05;           // 点击力 = 1 + 5% 每秒产量
