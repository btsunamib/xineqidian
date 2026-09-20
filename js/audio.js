// WebAudio 程序化音效：零资源文件，音高随连击上升形成旋律
let ac = null;
let master = null;
let enabled = true;
let noiseBuf = null;
let lastPlay = 0;

export function initAudio() {
  if (ac) {
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
  } catch (e) {
    ac = null;
  }
  return ac;
}

export function setAudioEnabled(v) {
  enabled = !!v;
  if (master) master.gain.value = enabled ? 0.5 : 0;
}

export function isAudioEnabled() { return enabled; }

export function resumeAudio() {
  if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
}

function now() { return ac ? ac.currentTime : 0; }

// 基础音：带包络的振荡器
function tone(freq, dur, type, vol, delay, slideTo) {
  if (!ac || !enabled) return;
  const t0 = now() + (delay || 0);
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + Math.min(0.012, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function noise(dur, vol, filterFreq, delay) {
  if (!ac || !enabled) return;
  if (!noiseBuf) {
    const len = Math.floor(ac.sampleRate * 0.5);
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = now() + (delay || 0);
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = filterFreq || 1200;
  f.Q.value = 1.1;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

// ---- 具体音效 ----

// 点击：音高随连击升高（五声音阶，越点越像旋律）
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
export function sfxTap(combo) {
  if (!ac || !enabled) return;
  const step = SCALE[Math.min(SCALE.length - 1, Math.floor((combo || 0) / 3))];
  const freq = 320 * Math.pow(2, step / 12);
  tone(freq, 0.13, 'triangle', 0.16);
  tone(freq * 2, 0.07, 'sine', 0.05);
}

export function sfxPerfect(combo, reso) {
  if (!ac || !enabled) return;
  const base = 523.25 * Math.pow(2, Math.min(14, Math.floor((reso || 0) / 3)) / 12);
  tone(base, 0.30, 'sine', 0.24);
  tone(base * 1.5, 0.26, 'sine', 0.15, 0.012);
  tone(base * 2, 0.22, 'triangle', 0.10, 0.024);
  noise(0.10, 0.07, 3200);
}

export function sfxCrit() {
  if (!ac || !enabled) return;
  tone(90, 0.28, 'square', 0.16, 0, 50);
  noise(0.16, 0.11, 700);
}

export function sfxDevour(n) {
  if (!ac || !enabled) return;
  const t = now();
  if (t - lastPlay < 0.035) return;
  lastPlay = t;
  const f = 700 + Math.min(20, n || 0) * 42;
  tone(f, 0.10, 'sine', 0.10, 0, f * 1.7);
}

export function sfxOrb() {
  if (!ac || !enabled) return;
  [0, 4, 7, 12].forEach((s, i) => tone(660 * Math.pow(2, s / 12), 0.30, 'sine', 0.16, i * 0.055));
  noise(0.2, 0.05, 2600);
}

export function sfxBurst() {
  if (!ac || !enabled) return;
  tone(70, 0.85, 'sawtooth', 0.20, 0, 620);
  tone(140, 0.9, 'sine', 0.14, 0.02, 1200);
  noise(0.7, 0.13, 900);
  [0, 7, 12, 19].forEach((s, i) => tone(392 * Math.pow(2, s / 12), 0.5, 'triangle', 0.09, 0.08 + i * 0.05));
}

export function sfxBuy() {
  if (!ac || !enabled) return;
  tone(880, 0.07, 'square', 0.07, 0, 1180);
}

export function sfxUpgrade() {
  if (!ac || !enabled) return;
  [0, 5, 9].forEach((s, i) => tone(523 * Math.pow(2, s / 12), 0.24, 'triangle', 0.13, i * 0.05));
}

export function sfxPrestige() {
  if (!ac || !enabled) return;
  tone(1200, 1.3, 'sawtooth', 0.18, 0, 60);
  noise(1.1, 0.12, 500);
  [0, 12, 19, 24].forEach((s, i) => tone(261 * Math.pow(2, s / 12), 0.9, 'sine', 0.10, 0.25 + i * 0.09));
}

export function sfxAchieve() {
  if (!ac || !enabled) return;
  [0, 4, 7, 12, 16].forEach((s, i) => tone(659 * Math.pow(2, s / 12), 0.34, 'sine', 0.12, i * 0.07));
}

export function sfxError() {
  if (!ac || !enabled) return;
  tone(160, 0.14, 'square', 0.07, 0, 110);
}
