// 入口：启动循环、自动保存、离线结算、Service Worker
import * as core from './core.js';
import { initUi, updateHud, renderAll, showOfflineModal, showToast } from './ui.js';
import { initFx } from './fx.js';

let last = 0;
let lastSave = 0;
let started = false;

function boot() {
  // 1. 先读档，再构建界面
  const had = core.load();
  window.__haptics = core.state.haptics !== false;
  core.state.nextOrbAt = 0;

  // 2. 特效与界面
  initFx(document.getElementById('fx'));
  initUi();
  renderAll();

  const now = Date.now();

  // 3. 离线收益
  if (had) {
    const off = core.applyOffline(now);
    if (off && off.gain > 1) showOfflineModal(off);
    else if (off) showToast('离线收益 +' + Math.round(off.gain), 'green');
  } else {
    showToast('点击核心开始吸能', 'gold');
  }

  // 4. 主循环
  last = performance.now();
  requestAnimationFrame(loop);

  // 5. 自动保存
  setInterval(() => {
    core.save();
    lastSave = Date.now();
  }, 15000);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      core.save();
    } else {
      const t = Date.now();
      const off = core.applyOffline(t);
      if (off && off.gain > 1) showOfflineModal(off);
      renderAll();
    }
  });

  window.addEventListener('beforeunload', () => core.save());
  window.addEventListener('pagehide', () => core.save());

  // 6. 可安装 / 离线
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  started = true;
}

function loop(t) {
  requestAnimationFrame(loop);
  if (!started) return;
  let dt = (t - last) / 1000;
  last = t;
  if (!Number.isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.5) dt = 0.5;

  const now = Date.now();
  core.tick(dt, now);
  updateHud(now);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
