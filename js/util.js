// 通用工具：数字格式化、随机、震动反馈
const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];

export function format(n) {
  if (n === Infinity) return '∞';
  if (Number.isNaN(n)) return '0';
  const neg = n < 0;
  n = Math.abs(n);
  if (n < 1000) {
    const s = n < 10 ? n.toFixed(n % 1 === 0 ? 0 : 1) : Math.floor(n).toString();
    return (neg ? '-' : '') + s;
  }
  let tier = Math.floor(Math.log10(n) / 3);
  if (tier >= UNITS.length) {
    const exp = Math.floor(Math.log10(n));
    const mant = n / Math.pow(10, exp);
    return (neg ? '-' : '') + mant.toFixed(2) + 'e' + exp;
  }
  const scaled = n / Math.pow(10, tier * 3);
  const digits = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
  return (neg ? '-' : '') + scaled.toFixed(digits) + UNITS[tier];
}

export function formatInt(n) {
  if (n < 1000) return Math.floor(n).toString();
  return format(n);
}

// 把 1.23M / 4.5e12 这类字符串解析回数字
export function parseNum(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  const s = String(str).trim().replace(/,/g, '');
  const m = s.match(/^(-?[\d.]+)\s*([a-zA-Z]*)$/);
  if (!m) return 0;
  let val = parseFloat(m[1]);
  if (Number.isNaN(val)) return 0;
  const suf = m[2];
  if (!suf) return val;
  if (/^e\d+$/i.test(suf)) return val * Math.pow(10, parseInt(suf.slice(1), 10));
  const idx = UNITS.findIndex(u => u.toLowerCase() === suf.toLowerCase());
  if (idx > 0) val *= Math.pow(10, idx * 3);
  return val;
}

export function formatTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return h + '小时' + m + '分';
  if (m > 0) return m + '分' + s + '秒';
  return s + '秒';
}

export function formatDuration(ms) {
  return formatTime(ms / 1000);
}

export function rand(min, max) { return min + Math.random() * (max - min); }

export function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

export function vibrate(ms) {
  try {
    if (navigator.vibrate && window.__haptics !== false) navigator.vibrate(ms);
  } catch (e) { /* 忽略 */ }
}
