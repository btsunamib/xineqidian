# 吸能奇点 · 增量进化

一款纯前端、手机友好的爽快增量（放置）游戏。零依赖、零构建，打开即玩，支持离线收益与 PWA 安装。

## 玩法

| 系统 | 说明 |
| --- | --- |
| 🌀 点击吸能 | 点核心获得能量，点击力 = 1 + 每秒产量的 5%，永远不脱节 |
| 🔗 连击 | 1.5 秒内连续点击叠加连击，最高 ×6，叠加 10% 概率 ×5 暴击 |
| ⚛️ 10 级产线 | 微尘收集器 → 熵之终结，价格 1.15~1.17 倍递增，支持 ×1 / ×10 / ×100 / MAX 批量购买 |
| 🌟 黄金粒子 | 随机刷出，点中即获 7 倍收益 30 秒，可强化频率与时长 |
| 💫 坍缩转生 | 累计 1e12 能量后可坍缩，获得 ✦ 星尘购买 8 种永久强化 |
| 🕳️ 奇点飞升 | 累计 20 万星尘可飞升，每枚碎片 +100% 产量 / +10% 速度，永久叠加 |
| 🏆 29 个成就 | 每个 +2% 全局产量，覆盖点击、连击、产量、转生各维度 |
| 🌙 离线收益 | 最长结算 8 小时，基础效率 50%，可用「深眠协议」升至 100% |
| 🤖 自动化 | 自动点击器、自动购买最便宜机器 |

## 本地运行

```bash
cd 增量游戏1
npm test          # 核心逻辑冒烟测试（纯 Node，无需浏览器）
npm run serve     # 起本地服务，默认 http://127.0.0.1:5173
```

直接用 `file://` 打开 `index.html` 也能玩，但 Service Worker / PWA 安装需要 http(s)。

## 部署到 GitHub Pages

仓库已初始化 git 并完成首次提交，按下面三步推到 GitHub：

```bash
# 1. 在 GitHub 网页端新建一个空仓库（不要勾选 README），例如 xineqidian
# 2. 关联远程并推送
git remote add origin https://github.com/<你的用户名>/xineqidian.git
git branch -M main
git push -u origin main

# 3. 仓库 Settings -> Pages -> Build and deployment -> Source 选择 "GitHub Actions"
```

推送后 `.github/workflows/deploy.yml` 会自动发布，地址：

```
https://<你的用户名>.github.io/xineqidian/
```

不想用 Actions 时：Settings -> Pages -> Source 选 `Deploy from a branch` -> 分支 `main`、目录 `/ (root)`，同样可访问上面的地址。

## 手机体验

- 竖屏优先、`100dvh` 布局 + 安全区适配（刘海屏不遮挡）
- 大按钮 / 大点击热区，`touch-action: manipulation` 禁用双击缩放
- 点击有震动反馈（可在设置里关闭）、飘字、粒子爆发、暴击屏幕震动
- 设置页可导出/导入存档码，换设备或清缓存都不怕丢档
- 加到主屏幕后全屏运行，断网也能打开（Service Worker 缓存）

## 文件结构

```
增量游戏1/
├── index.html              页面骨架
├── css/style.css           手机优先样式
├── js/
│   ├── data.js             数值配置（产线 / 星尘强化 / 成就 / 常量）
│   ├── core.js             纯逻辑核心（产量、价格、转生、存档、离线）
│   ├── ui.js               渲染与交互
│   ├── fx.js               Canvas 粒子 / 飘字 / 震动
│   ├── util.js             数字格式化与解析
│   └── main.js             启动、主循环、自动保存
├── sw.js                   离线缓存
├── manifest.webmanifest    PWA 清单
├── icon.svg                图标
├── test/smoke.mjs          核心逻辑测试
└── .github/workflows/deploy.yml
```

## 存档

自动保存到浏览器 `localStorage`（键名 `xineqidian_save_v1`），每 15 秒一次，切后台 / 关闭页面时也会保存。
