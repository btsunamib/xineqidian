// ============ Canvas 实时渲染：黑洞核心 / 吸积盘 / 轨道 / 吞噬光团 / 冲击波 ============
import * as core from './core.js';
import { GENERATORS } from './data.js';

let canvas = null;
let ctx = null;
let stageEl = null;
let dpr = 1;
let W = 0, H = 0;
let cx = 0, cy = 0;
let orbitScale = 34;
let coreR = 26;
let enabled = true;
let t = 0;

let stars = [];
let sparkPool = [];
let waves = [];
let streams = [];
let motes = [];
let rays = [];

let shakeAmp = 0;
let flashAmt = 0;
let lastLayout = 0;

const MAX_SPARKS = 460;
const MAX_STREAMS = 200;
const MOTE_TARGET = 11;

export function initFx(canvasEl, stage) {
  canvas = canvasEl;
  stageEl = stage || null;
  if (!canvas || !canvas.getContext) return;
  ctx = canvas.getContext('2d');
  layout();
  seedStars();
  seedMotes();
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 220));
  return true;
}

export function setFxEnabled(v) {
  enabled = !!v;
  if (!enabled && ctx) ctx.clearRect(0, 0, W, H);
}

export function layout() {
  if (!canvas) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  let sx = W / 2;
  let sy = H * 0.3;
  let sw = W;
  let sh = H * 0.5;
  if (stageEl && stageEl.getBoundingClientRect) {
    const r = stageEl.getBoundingClientRect();
    if (r.width > 10) {
      sx = r.left + r.width / 2;
      sy = r.top + r.height / 2;
      sw = r.width;
      sh = r.height;
    }
  }
  cx = sx;
  cy = sy;
  orbitScale = Math.max(22, Math.min(48, Math.min(sw, sh) * 0.118));
  coreR = orbitScale * 0.8;
  seedStars();
}

export function coreScreenPos() { return { x: cx, y: cy, r: coreR, orbit: orbitScale }; }

function seedStars() {
  stars = [];
  const n = Math.min(120, Math.max(40, Math.floor((W * H) / 13000)));
  for (let i = 0; i < n; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.4 + 0.25,
      a: Math.random() * 0.5 + 0.1,
      ph: Math.random() * Math.PI * 2,
      sp: Math.random() * 0.9 + 0.25,
      c: Math.random() < 0.75 ? [180, 220, 255] : (Math.random() < 0.5 ? [255, 190, 235] : [200, 255, 225]),
    });
  }
}

function seedMotes() {
  motes = [];
  for (let i = 0; i < MOTE_TARGET; i++) motes.push(makeMote());
}

function makeMote() {
  const ang = Math.random() * Math.PI * 2;
  const dist = orbitScale * (1.3 + Math.random() * 2.6);
  return {
    x: cx + Math.cos(ang) * dist,
    y: cy + Math.sin(ang) * dist,
    vx: (Math.random() - 0.5) * 0.24,
    vy: (Math.random() - 0.5) * 0.24,
    r: 3.2 + Math.random() * 3.4,
    ph: Math.random() * Math.PI * 2,
    life: 1,
    c: Math.random() < 0.5 ? [120, 235, 255] : (Math.random() < 0.5 ? [190, 160, 255] : [140, 255, 200]),
  };
}

/* ---------------- 事件入口 ---------------- */
export function shockwave(x, y, power, color) {
  if (!enabled) return;
  waves.push({ x, y, r: coreR * 0.6, max: coreR * (2.6 + power * 2.4), a: 1, w: 2 + power * 2, c: color || [120, 235, 255] });
  if (waves.length > 14) waves.shift();
}

export function sparks(x, y, count, opts) {
  if (!enabled) return;
  const o = opts || {};
  const sp = o.speed || 4.4;
  const col = o.color || null;
  for (let i = 0; i < count; i++) {
    const ang = o.dir !== undefined ? o.dir + (Math.random() - 0.5) * (o.spread || 1.2) : Math.random() * Math.PI * 2;
    const v = sp * (0.35 + Math.random());
    sparkPool.push({
      x, y,
      vx: Math.cos(ang) * v,
      vy: Math.sin(ang) * v,
      life: 1,
      dec: 0.016 + Math.random() * 0.024,
      sz: (o.size || 2.3) * (0.6 + Math.random()),
      c: col || (Math.random() < 0.5 ? [120, 235, 255] : [255, 200, 120]),
      g: o.g === undefined ? 0.05 : o.g,
    });
  }
  if (sparkPool.length > MAX_SPARKS) sparkPool.splice(0, sparkPool.length - MAX_SPARKS);
}

export function burstRing(x, y, n, color) {
  if (!enabled) return;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    sparkPool.push({
      x, y,
      vx: Math.cos(ang) * (5 + Math.random() * 3),
      vy: Math.sin(ang) * (5 + Math.random() * 3),
      life: 1, dec: 0.019, sz: 2.8,
      c: color || [255, 205, 90], g: 0,
    });
  }
}

export function shakeScreen(amp) { shakeAmp = Math.min(22, shakeAmp + amp); }
export function flash(v) { flashAmt = Math.min(1, flashAmt + v); }

export function floatText(x, y, text, cls) {
  if (!enabled || !document || !document.body) return;
  const d = document.createElement('div');
  d.className = 'float ' + (cls || '');
  d.textContent = text;
  d.style.left = x + 'px';
  d.style.top = y + 'px';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 1000);
}

// 拖动吞噬：返回本次吞掉的光团数量
export function devourAt(x, y, radius) {
  if (!enabled) return 0;
  let n = 0;
  for (let i = motes.length - 1; i >= 0; i--) {
    const m = motes[i];
    const dx = m.x - x;
    const dy = m.y - y;
    if (dx * dx + dy * dy < (radius + m.r) * (radius + m.r)) {
      sparks(m.x, m.y, 7, { color: m.c, speed: 3.2, size: 2 });
      motes.splice(i, 1);
      motes.push(makeMote());
      n++;
    }
  }
  return n;
}

export function moteCount() { return motes.length; }

/* ---------------- 主渲染 ---------------- */
export function render(dt, now) {
  if (!ctx || !enabled) return;
  t += dt;
  if (now - lastLayout > 700 && stageEl && stageEl.getBoundingClientRect) {
    lastLayout = now;
    const r = stageEl.getBoundingClientRect();
    const ncx = r.left + r.width / 2;
    const ncy = r.top + r.height / 2;
    if (Math.abs(ncx - cx) > 1 || Math.abs(ncy - cy) > 1) layout();
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  let ox = 0, oy = 0;
  if (shakeAmp > 0.1) {
    ox = (Math.random() - 0.5) * shakeAmp;
    oy = (Math.random() - 0.5) * shakeAmp;
    shakeAmp *= Math.pow(0.001, dt);
    if (shakeAmp < 0.12) shakeAmp = 0;
  }
  ctx.translate(ox, oy);

  const s = core.state;
  const bursting = core.burstActive(now);
  const ph = core.pulsePhase(now, s);
  const pWin = core.perfectWindow(s);
  const boost = core.boostActive(now, s);

  drawNebula(bursting, boost);
  drawStars(now);
  drawOrbits(s, now, bursting);
  drawStreams(dt, s);
  drawMotes(now);
  drawCore(s, now, ph, pWin, bursting, boost);
  drawWaves(dt);
  drawSparks(dt);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (flashAmt > 0.002) {
    ctx.globalAlpha = flashAmt * 0.55;
    ctx.fillStyle = '#dff6ff';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    flashAmt *= Math.pow(0.004, dt);
    if (flashAmt < 0.004) flashAmt = 0;
  }
}

function drawNebula(bursting, boost) {
  const g = ctx.createRadialGradient(cx, cy, coreR * 0.4, cx, cy, Math.max(W, H) * 0.85);
  if (bursting) {
    g.addColorStop(0, 'rgba(255,140,60,0.30)');
    g.addColorStop(0.35, 'rgba(255,60,90,0.13)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
  } else if (boost) {
    g.addColorStop(0, 'rgba(255,205,90,0.24)');
    g.addColorStop(0.4, 'rgba(255,150,60,0.10)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
  } else {
    g.addColorStop(0, 'rgba(70,150,255,0.17)');
    g.addColorStop(0.4, 'rgba(150,80,255,0.09)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawStars(now) {
  for (const st of stars) {
    const tw = 0.55 + 0.45 * Math.sin(now / 900 * st.sp + st.ph);
    ctx.globalAlpha = st.a * tw;
    ctx.fillStyle = 'rgb(' + st.c[0] + ',' + st.c[1] + ',' + st.c[2] + ')';
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// 每个已拥有的机器类型 = 一圈轨道
function drawOrbits(s, now, bursting) {
  const spin = now / 1000;
  for (let i = 0; i < GENERATORS.length; i++) {
    const count = s.gens[i];
    if (count <= 0) continue;
    const g = GENERATORS[i];
    const R = orbitScale * g.orbit;
    const strength = Math.min(1, 0.28 + Math.log10(count + 1) * 0.36);
    const [r, gg, b] = hexToRgb(g.color);

    // 轨道环
    ctx.globalAlpha = 0.14 + strength * 0.28;
    ctx.strokeStyle = 'rgb(' + r + ',' + gg + ',' + b + ')';
    ctx.lineWidth = 0.8 + strength * 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    // 轨道粒子
    const n = Math.min(11, 2 + Math.floor(Math.log10(count + 1) * 2.4));
    const dir = i % 2 === 0 ? 1 : -1;
    const spd = (0.24 + strength * 0.5) * dir * (bursting ? 2.1 : 1);
    for (let k = 0; k < n; k++) {
      const a = spin * spd + (k / n) * Math.PI * 2 + i;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R * 0.42;
      const sz = 1.3 + strength * 2.1;
      ctx.globalAlpha = 0.5 + strength * 0.5;
      ctx.fillStyle = 'rgb(' + r + ',' + gg + ',' + b + ')';
      ctx.beginPath();
      ctx.arc(x, y, sz, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.13;
      ctx.beginPath();
      ctx.arc(x, y, sz * 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// 落入核心的粒子流
function drawStreams(dt, s) {
  const prod = core.rawProd(s);
  const target = prod > 0 ? Math.min(MAX_STREAMS, 14 + Math.floor(Math.log10(prod + 1) * 16)) : 6;
  while (streams.length < target) streams.push(newStream());
  while (streams.length > target) streams.pop();

  for (let i = streams.length - 1; i >= 0; i--) {
    const p = streams[i];
    p.ang += p.spd * dt;
    p.rad -= p.fall * dt * 60;
    if (p.rad <= coreR * 0.85) {
      sparks(cx + Math.cos(p.ang) * p.rad, cy + Math.sin(p.ang) * p.rad * 0.42, 2, { speed: 1.6, size: 1.5, color: p.c, g: 0 });
      streams[i] = newStream();
      continue;
    }
    const x = cx + Math.cos(p.ang) * p.rad;
    const y = cy + Math.sin(p.ang) * p.rad * 0.42;
    ctx.globalAlpha = p.a;
    ctx.fillStyle = 'rgb(' + p.c[0] + ',' + p.c[1] + ',' + p.c[2] + ')';
    ctx.beginPath();
    ctx.arc(x, y, p.sz, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function newStream() {
  const ang = Math.random() * Math.PI * 2;
  const rad = orbitScale * (1.4 + Math.random() * 2.4);
  const c = Math.random() < 0.6 ? [130, 225, 255] : [200, 160, 255];
  return {
    ang, rad,
    spd: (0.5 + Math.random() * 0.9) * (Math.random() < 0.5 ? 1 : -1),
    fall: 0.0016 + Math.random() * 0.0032,
    sz: 1 + Math.random() * 1.7,
    a: 0.35 + Math.random() * 0.5,
    c,
  };
}

// 可拖动吞噬的能量团
function drawMotes(now) {
  for (const m of motes) {
    m.x += m.vx;
    m.y += m.vy;
    const dx = m.x - cx;
    const dy = (m.y - cy) / 0.42;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > orbitScale * 4.2) {
      const k = (orbitScale * 4.0) / d;
      m.x = cx + dx * k;
      m.y = cy + dy * 0.42 * k;
      m.vx *= -1; m.vy *= -1;
    }
    const pulse = 0.72 + 0.28 * Math.sin(now / 420 + m.ph);
    ctx.globalAlpha = 0.16 * pulse;
    ctx.fillStyle = 'rgb(' + m.c[0] + ',' + m.c[1] + ',' + m.c[2] + ')';
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r * 3.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(m.x - m.r * 0.3, m.y - m.r * 0.3, m.r * 0.34 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawCore(s, now, ph, pWin, bursting, boost) {
  const inWindow = ph >= 1 - pWin || ph <= pWin * 0.33;
  // 收缩到最小时 = 完美时机
  const shrink = 1 - 0.22 * Math.pow(ph, 1.6);
  const R = coreR * shrink;

  // 吸积盘
  ctx.save();
  ctx.translate(cx, cy);
  const diskSpin = now / 1400;
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate(diskSpin * (i % 2 === 0 ? 1 : -1) + i * 1.05);
    const rr = R * (1.9 + i * 0.45);
    const grd = ctx.createLinearGradient(-rr, 0, rr, 0);
    if (bursting) {
      grd.addColorStop(0, 'rgba(255,120,40,0)');
      grd.addColorStop(0.5, 'rgba(255,190,90,' + (0.30 - i * 0.07) + ')');
      grd.addColorStop(1, 'rgba(255,60,60,0)');
    } else if (boost) {
      grd.addColorStop(0, 'rgba(255,205,90,0)');
      grd.addColorStop(0.5, 'rgba(255,220,130,' + (0.28 - i * 0.06) + ')');
      grd.addColorStop(1, 'rgba(255,150,60,0)');
    } else {
      grd.addColorStop(0, 'rgba(90,180,255,0)');
      grd.addColorStop(0.5, 'rgba(150,210,255,' + (0.26 - i * 0.06) + ')');
      grd.addColorStop(1, 'rgba(180,120,255,0)');
    }
    ctx.strokeStyle = grd;
    ctx.lineWidth = R * (0.16 + i * 0.05);
    ctx.beginPath();
    ctx.ellipse(0, 0, rr, rr * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // 完美窗口光环
  if (inWindow) {
    const a = 0.35 + 0.4 * Math.sin(now / 90);
    ctx.globalAlpha = a;
    ctx.strokeStyle = bursting ? '#ff9a3c' : '#ffcc4d';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 外发光
  const glowR = R * (inWindow ? 3.4 : 2.6);
  const gl = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, glowR);
  const gc = bursting ? [255, 140, 60] : (boost ? [255, 205, 90] : (inWindow ? [255, 210, 110] : [90, 190, 255]));
  gl.addColorStop(0, 'rgba(' + gc[0] + ',' + gc[1] + ',' + gc[2] + ',0.55)');
  gl.addColorStop(0.45, 'rgba(' + gc[0] + ',' + gc[1] + ',' + gc[2] + ',0.16)');
  gl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gl;
  ctx.beginPath();
  ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
  ctx.fill();

  // 事件视界（黑球）
  const bh = ctx.createRadialGradient(cx - R * 0.28, cy - R * 0.28, R * 0.08, cx, cy, R);
  bh.addColorStop(0, '#1a2340');
  bh.addColorStop(0.55, '#070a16');
  bh.addColorStop(1, '#000000');
  ctx.fillStyle = bh;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  // 事件视界边缘光
  ctx.strokeStyle = 'rgba(' + gc[0] + ',' + gc[1] + ',' + gc[2] + ',' + (inWindow ? 0.95 : 0.55) + ')';
  ctx.lineWidth = inWindow ? 2.6 : 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  // 高光
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(cx - R * 0.34, cy - R * 0.36, R * 0.2, R * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // 爆发射线
  if (bursting) {
    const raysN = 12;
    for (let i = 0; i < raysN; i++) {
      const a = (i / raysN) * Math.PI * 2 + now / 900;
      const len = R * (3.2 + Math.sin(now / 200 + i) * 0.7);
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = i % 2 ? '#ff8a2b' : '#ffcc4d';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * 1.1, cy + Math.sin(a) * R * 1.1);
      ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function drawWaves(dt) {
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i];
    w.r += (w.max - w.r) * Math.min(1, dt * 5.5) + 26 * dt;
    w.a -= dt * 1.7;
    if (w.a <= 0) { waves.splice(i, 1); continue; }
    ctx.globalAlpha = Math.max(0, w.a) * 0.75;
    ctx.strokeStyle = 'rgb(' + w.c[0] + ',' + w.c[1] + ',' + w.c[2] + ')';
    ctx.lineWidth = w.w * Math.max(0.2, w.a);
    ctx.beginPath();
    ctx.ellipse(w.x, w.y, w.r, w.r * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawSparks(dt) {
  for (let i = sparkPool.length - 1; i >= 0; i--) {
    const p = sparkPool[i];
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.vy += p.g * dt * 60;
    p.vx *= 0.985;
    p.life -= p.dec * dt * 60;
    if (p.life <= 0) { sparkPool.splice(i, 1); continue; }
    const a = Math.max(0, Math.min(1, p.life));
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgb(' + p.c[0] + ',' + p.c[1] + ',' + p.c[2] + ')';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.sz * (0.4 + a * 0.8), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function confettiBurst() {
  if (!enabled) return;
  const cols = [[255, 205, 90], [120, 235, 255], [255, 130, 220], [140, 255, 200]];
  for (let i = 0; i < 90; i++) {
    sparkPool.push({
      x: Math.random() * W,
      y: -12 - Math.random() * 90,
      vx: (Math.random() - 0.5) * 2.4,
      vy: 2.2 + Math.random() * 3.2,
      life: 1,
      dec: 0.007 + Math.random() * 0.008,
      sz: 2 + Math.random() * 2.6,
      c: cols[(Math.random() * cols.length) | 0],
      g: 0.02,
    });
  }
}
