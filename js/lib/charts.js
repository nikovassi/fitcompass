/**
 * Леки SVG диаграми без външни библиотеки.
 */
import { fmt } from './format.js';

/**
 * Интерактивна кръгова (donut) диаграма.
 * @param {HTMLElement} el контейнер (.donut)
 * @param {{key:string,label:string,value:number,color:string}[]} segments
 * @param {{center?:(active:object|null)=>string, onActivate?:(key:string|null)=>void}} opts
 */
export function donutChart(el, segments, opts = {}) {
  const R = 80;
  const C = 2 * Math.PI * R;
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0) || 1;
  const gap = segments.filter((s) => s.value > 0).length > 1 ? 3 : 0;
  let offset = 0;
  const circles = segments
    .map((s) => {
      const len = (Math.max(0, s.value) / total) * C;
      const dash = Math.max(0, len - gap);
      const c = `<circle class="seg" data-key="${s.key}" cx="100" cy="100" r="${R}" stroke="${s.color}"
        stroke-dasharray="0 ${C}" data-dash="${dash} ${C - dash}" stroke-dashoffset="${-offset}"
        tabindex="0" role="img" aria-label="${s.label}: ${fmt((s.value / total) * 100)}%"></circle>`;
      offset += len;
      return c;
    })
    .join('');
  el.innerHTML = `<svg viewBox="0 0 200 200"><circle class="track" cx="100" cy="100" r="${R}"></circle>${circles}</svg>
    <div class="donut-center" aria-live="polite"></div>`;
  const center = el.querySelector('.donut-center');
  const render = (key) => {
    const s = segments.find((x) => x.key === key) || null;
    center.innerHTML = opts.center ? opts.center(s) : '';
    el.classList.toggle('has-active', !!s);
    el.querySelectorAll('.seg').forEach((c) => c.classList.toggle('active', c.dataset.key === key));
  };
  render(null);
  // анимирано изчертаване
  requestAnimationFrame(() =>
    requestAnimationFrame(() => el.querySelectorAll('.seg').forEach((c) => c.setAttribute('stroke-dasharray', c.dataset.dash))),
  );
  let locked = null;
  el.querySelectorAll('.seg').forEach((c) => {
    const k = c.dataset.key;
    c.addEventListener('mouseenter', () => !locked && (render(k), opts.onActivate?.(k)));
    c.addEventListener('mouseleave', () => !locked && (render(null), opts.onActivate?.(null)));
    c.addEventListener('focus', () => (render(k), opts.onActivate?.(k)));
    c.addEventListener('blur', () => !locked && (render(null), opts.onActivate?.(null)));
    c.addEventListener('click', () => {
      locked = locked === k ? null : k;
      render(locked);
      opts.onActivate?.(locked);
    });
  });
  return {
    activate(key) {
      locked = key;
      render(key);
    },
  };
}

/**
 * Линейна диаграма за времеви редове (напр. тегло).
 * @param {HTMLElement} el
 * @param {{x:Date,y:number}[]} points сортирани по дата
 * @param {{goal?:number, unit?:string}} opts
 */
export function lineChart(el, points, opts = {}) {
  if (!points.length) {
    el.innerHTML = '<div class="empty-state">Все още няма записи. Добавете първото си измерване.</div>';
    return;
  }
  const W = 640;
  const H = 260;
  const pad = { l: 44, r: 16, t: 16, b: 32 };
  const ys = points.map((p) => p.y).concat(opts.goal != null ? [opts.goal] : []);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (maxY - minY < 2) {
    minY -= 1;
    maxY += 1;
  }
  const spanY = maxY - minY;
  minY -= spanY * 0.1;
  maxY += spanY * 0.1;
  const t0 = points[0].x.getTime();
  const t1 = points[points.length - 1].x.getTime();
  const spanT = Math.max(1, t1 - t0);
  const X = (d) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : ((d.getTime() - t0) / spanT) * (W - pad.l - pad.r));
  const Y = (v) => pad.t + (1 - (v - minY) / (maxY - minY)) * (H - pad.t - pad.b);
  const ticks = 4;
  let grid = '';
  for (let i = 0; i <= ticks; i++) {
    const v = minY + ((maxY - minY) * i) / ticks;
    grid += `<line class="grid-line" x1="${pad.l}" x2="${W - pad.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis-label" x="${pad.l - 8}" y="${Y(v) + 4}" text-anchor="end">${fmt(v, 1)}</text>`;
  }
  const df = new Intl.DateTimeFormat('bg-BG', { day: 'numeric', month: 'short' });
  const labelIdx = points.length <= 6 ? points.map((_, i) => i) : [0, Math.floor(points.length / 2), points.length - 1];
  const xLabels = labelIdx
    .map((i) => `<text class="axis-label" x="${X(points[i].x)}" y="${H - 8}" text-anchor="middle">${df.format(points[i].x)}</text>`)
    .join('');
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x)},${Y(p.y)}`).join(' ');
  const area = `${d} L${X(points[points.length - 1].x)},${H - pad.b} L${X(points[0].x)},${H - pad.b} Z`;
  const goal =
    opts.goal != null
      ? `<line class="goal-line" x1="${pad.l}" x2="${W - pad.r}" y1="${Y(opts.goal)}" y2="${Y(opts.goal)}"/><text class="axis-label" x="${W - pad.r}" y="${Y(opts.goal) - 6}" text-anchor="end" style="fill:var(--accent)">цел ${fmt(opts.goal, 1)}</text>`
      : '';
  const pts = points
    .map((p) => `<circle class="pt" cx="${X(p.x)}" cy="${Y(p.y)}" r="4"><title>${df.format(p.x)}: ${fmt(p.y, 1)} ${opts.unit ?? ''}</title></circle>`)
    .join('');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Графика на теглото">${grid}${goal}<path class="area" d="${area}"/><path class="line" d="${d}"/>${pts}${xLabels}</svg>`;
}
