// 粒子特效引擎：背景星尘 + 爆发粒子 + 飘字 + 震动
let canvas = null;
let ctx = null;
let dpr = 1;
let W = 0;
let H = 0;
let parts = [];
let stars = [];
let enabled = true;
let lastT = 0;
let rafId = 0;

const PALETTE = [
  [67, 232, 255],
  [255, 91, 214],
  [92, 255, 168],
  [255, 204, 77],
  [169, 184, 255],
];

export function initFx(el) {
  canvas = el;
  if (!canvas || !canvas.getContext) return;
  ctx = canvas.getContext('2d');
  resize();
  seedStars();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 220));
  lastT = performance.now();
  rafId = requestAnimationFrame(loop);
}

export function setFxEnabled(v) {
  enabled = !!v;
  if (!enabled) {
    parts.length = 0;
    if (ctx) ctx.clearRect(0, 0, W, H);
  } else if (canvas) {
    seedStars();
  }
}

export function resize() {
  if (!canvas) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function seedStars() {
  stars = [];
  const n = Math.min(110, Math.max(30, Math.floor((W * H) / 15000)));
  for (let i = 0; i < n; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      a: Math.random() * 0.5 + 0.12,
      vy: Math.random() * 0.22 + 0.04,
      c: PALETTE[(Math.random() * PALETTE.length) | 0],
    });
  }
}

// 爆发粒子
export function burst(x, y, count = 12, opts = {}) {
  if (!enabled || !ctx) return;
  const crit = !!opts.crit;
  const speed = opts.speed || (crit ? 7.5 : 4.2);
  const color = opts.color || null;
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = speed * (0.4 + Math.random() * 0.9);
    const c = color || (crit ? [255, 204, 77] : PALETTE[(Math.random() * PALETTE.length) | 0]);
    parts.push({
      x, y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - (crit ? 1.4 : 0.5),
      life: 1,
      decay: 0.014 + Math.random() * 0.022,
      size: (crit ? 3.4 : 2.2) * (0.6 + Math.random() * 0.9),
      c,
      g: 0.055,
    });
  }
  if (parts.length > 420) parts.splice(0, parts.length - 420);
}

export function ring(x, y, color = [255, 204, 77]) {
  if (!enabled || !ctx) return;
  for (let i = 0; i < 26; i++) {
    const ang = (i / 26) * Math.PI * 2;
    parts.push({
      x, y,
      vx: Math.cos(ang) * 6.4,
      vy: Math.sin(ang) * 6.4,
      life: 1,
      decay: 0.02,
      size: 3,
      c: color,
      g: 0,
    });
  }
}

function loop(t) {
  rafId = requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);

  if (enabled) {
    for (const s of stars) {
      s.y += s.vy * 60 * dt;
      if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
      ctx.globalAlpha = s.a;
      ctx.fillStyle = 'rgb(' + s.c[0] + ',' + s.c[1] + ',' + s.c[2] + ')';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.x += p.vx * 60 * dt;
    p.y += p.vy * 60 * dt;
    p.vy += p.g * 60 * dt;
    p.vx *= 0.99;
    p.life -= p.decay * 60 * dt;
    if (p.life <= 0 || p.y > H + 60) { parts.splice(i, 1); continue; }
    const a = Math.max(0, Math.min(1, p.life));
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgb(' + p.c[0] + ',' + p.c[1] + ',' + p.c[2] + ')';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.7), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function floatText(x, y, text, cls = '') {
  if (!enabled) return;
  const d = document.createElement('div');
  d.className = 'float ' + cls;
  d.textContent = text;
  d.style.left = x + 'px';
  d.style.top = y + 'px';
  d.style.color = cls === 'crit' ? '#ffcc4d' : '#8ff4ff';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 1000);
}

export function shake(el) {
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 340);
}

export function confetti() {
  if (!enabled || !ctx) return;
  const colors = [[255, 204, 77], [67, 232, 255], [255, 91, 214], [92, 255, 168]];
  for (let i = 0; i < 70; i++) {
    parts.push({
      x: Math.random() * W,
      y: -10 - Math.random() * 80,
      vx: (Math.random() - 0.5) * 2.2,
      vy: 2 + Math.random() * 3,
      life: 1,
      decay: 0.008 + Math.random() * 0.008,
      size: 2 + Math.random() * 2.6,
      c: colors[(Math.random() * colors.length) | 0],
      g: 0.02,
    });
  }
}
