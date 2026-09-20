// ============ 入口：读档 → 构建界面 → 主循环 ============
import * as core from './core.js';
import { initUi, hud, renderAll, showOfflineModal, toast } from './ui.js';
import * as fx from './fx.js';
import * as audio from './audio.js';

let last = 0;
let started = false;

function boot() {
  // 1. 读档
  const had = core.load(core.state);
  core.state.nextOrbAt = 0;
  core.state.pulseStart = Date.now();
  window.__haptics = core.state.haptics !== false;

  // 2. 渲染器 + 界面
  const canvas = document.getElementById('fx');
  const stage = document.getElementById('stage');
  fx.initFx(canvas, stage);
  initUi();
  renderAll();

  // 3. 离线收益
  const now = Date.now();
  if (had) {
    const off = core.applyOffline(now, core.state);
    if (off && off.gain > 1) showOfflineModal(off);
    else if (off) toast('离线收益 +' + Math.round(off.gain), 'green');
  } else {
    toast('轻点核心踩节拍 · 拖动吞噬光团', 'gold');
  }

  // 4. 首次交互解锁音频
  const kick = () => {
    audio.initAudio();
    audio.resumeAudio();
    window.removeEventListener('pointerdown', kick);
    window.removeEventListener('touchstart', kick);
  };
  window.addEventListener('pointerdown', kick, { once: true });
  window.addEventListener('touchstart', kick, { once: true });

  // 5. 主循环
  last = performance.now();
  requestAnimationFrame(loop);

  // 6. 自动保存
  setInterval(() => core.save(Date.now(), core.state), 15000);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      core.save(Date.now(), core.state);
    } else {
      const t = Date.now();
      const off = core.applyOffline(t, core.state);
      if (off && off.gain > 1) showOfflineModal(off);
      renderAll();
    }
  });
  window.addEventListener('beforeunload', () => core.save(Date.now(), core.state));
  window.addEventListener('pagehide', () => core.save(Date.now(), core.state));

  // 7. 离线可玩
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
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
  core.tick(dt, now, core.state);
  fx.render(dt, now);
  hud(now);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
