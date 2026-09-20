# 吸能奇点 · 增量进化

一款纯前端、手机友好的爽快增量（放置）游戏。零依赖、零构建，打开即玩，支持离线收益与 PWA 安装。

## 玩法

| 系统 | 说明 |
| --- | --- |
| 🌀 点击吸能 | 点核心获得能量，点击力 = 1 + 每秒产量的 5%，永远不会脱节 |
| 🔗 连击 | 1.5 秒内连点叠加连击，最高 ×6，并叠加 10% 概率 ×5 暴击 |
| ⚛️ 10 级产线 | 微尘收集器 → 熵之终结，价格 1.15~1.17 倍递增，支持 ×1 / ×10 / ×100 / MAX 批量购买 |
| 🌟 黄金粒子 | 随机刷出，点中即获 7 倍收益 30 秒，可强化频率与时长 |
| 💫 坍缩转生 | 本次累计 1e12 能量后可坍缩，获得 ✦ 星尘购买 8 种永久强化 |
| 🕳️ 奇点飞升 | 累计 20 万星尘可飞升，每枚碎片 +100% 产量 / +10% 速度，永久叠加 |
| 🏆 29 个成就 | 每个 +2% 全局产量，覆盖点击、连击、产量、转生各维度 |
| 🌙 离线收益 | 最长结算 8 小时，基础效率 50%，可用「深眠协议」升到 100% |
| 🤖 自动化 | 自动点击器、自动购买最便宜的机器 |

## 本地运行

```bash
cd 增量游戏1
npm i             # 仅测试需要（jsdom），游戏本体零依赖
npm test          # 21 项核心逻辑测试 + 15 项 jsdom DOM 测试
npm run serve     # 本地服务 http://127.0.0.1:5173
```

直接用 `file://` 打开 `index.html` 也能玩，但 Service Worker / PWA 安装需要 http(s)。

## 部署到 GitHub Pages

本地仓库已完成初始化与首次提交，推送方式二选一：

**方式 A：一键脚本（推荐）**

```powershell
# 先在 GitHub 网页端新建一个空仓库（不要勾选 README），仓库名例如 xineqidian
.\deploy.ps1 -User <你的GitHub用户名>
```

**方式 B：手动**

```bash
git remote add origin https://github.com/<你的用户名>/xineqidian.git
git branch -M main
git push -u origin main
```

推送后打开仓库 `Settings -> Pages -> Build and deployment -> Source`，选择 **GitHub Actions**。
若 Actions 不可用，改选 `Deploy from a branch -> main -> / (root)`，效果相同。

上线地址：

```
https://<你的用户名>.github.io/xineqidian/
```

推送会自动触发 `.github/workflows/deploy.yml`：先跑核心逻辑测试，再把 `index.html / css / js / sw.js / manifest / icon` 发布到 Pages（只发布游戏本体，不会把 `.git`、`test`、`node_modules` 传上去）。

## 手机体验

- 竖屏优先、`100dvh` 布局 + 安全区适配（刘海屏不遮挡）
- 大按钮 / 大点击热区，`touch-action: manipulation` 禁用双击缩放
- 点击有震动反馈（设置里可关）、飘字、粒子爆发、暴击屏幕震动
- 设置页可导出 / 导入存档码，换设备或清缓存都不怕丢档
- 加到主屏幕后全屏运行，断网也能打开（Service Worker 缓存）

## 文件结构

```
增量游戏1/
├── index.html                  页面骨架
├── css/style.css               手机优先样式
├── js/
│   ├── data.js                 数值配置（产线 / 星尘强化 / 成就 / 常量）
│   ├── core.js                 纯逻辑核心（产量、价格、转生、存档、离线）
│   ├── ui.js                   渲染与交互
│   ├── fx.js                   Canvas 粒子 / 飘字 / 震动
│   ├── util.js                 数字格式化与解析
│   └── main.js                 启动、主循环、自动保存
├── sw.js                       离线缓存
├── manifest.webmanifest        PWA 清单
├── icon.svg                    图标
├── deploy.ps1                  一键推送脚本
├── test/smoke.mjs              核心逻辑测试（Node，无依赖）
├── test/dom.mjs                整站 DOM 测试（jsdom）
└── .github/workflows/deploy.yml
```

## 存档

自动保存到浏览器 `localStorage`（键名 `xineqidian_save_v1`），每 15 秒一次，切后台 / 关页面时也会保存；导入时会做字段校验与数值修正，坏存档不会污染进度。

## 数值设计要点

- 产能价格按几何级数增长，批量购买价格 = 逐台价格之和（测试已校验）
- 点击力绑定每秒产量（5%），所以任何阶段点击都有意义
- 坍缩收益 `⌊5·√(本轮能量/1e12)⌋`，飞升收益 `⌊3·√(累计星尘/2e5)⌋`
- 全局倍率 = 星尘共鸣 × 成就加成 × 奇点碎片，三者乘算，长线成长不断档
