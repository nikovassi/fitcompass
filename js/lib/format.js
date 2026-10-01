/** Форматиране на числа по български стандарт (десетична запетая, интервал за хиляди). */
const cache = new Map();
function nf(digits) {
  if (!cache.has(digits)) {
    cache.set(digits, new Intl.NumberFormat('bg-BG', { minimumFractionDigits: 0, maximumFractionDigits: digits }));
  }
  return cache.get(digits);
}

export function fmt(value, digits = 0) {
  if (value == null || !Number.isFinite(value)) return '—';
  return nf(digits).format(value);
}

/** Грамове: под 10 — с един знак след запетаята. */
export function fmtG(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return fmt(value, Math.abs(value) < 10 ? 1 : 0);
}

export function fmtPct(fraction, digits = 0) {
  return `${fmt(fraction * 100, digits)}%`;
}

export function fmtSigned(value, digits = 0) {
  if (!Number.isFinite(value)) return '—';
  const s = fmt(Math.abs(value), digits);
  if (value > 0) return `+${s}`;
  if (value < 0) return `−${s}`;
  return s;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
