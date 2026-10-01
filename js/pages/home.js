import { PILLARS } from '../layout.js';
import { FOODS } from '../../data/foods.js';
import { fmt, fmtG, escapeHtml } from '../lib/format.js';
import { icon } from '../icons.js';

document.getElementById('pillars').innerHTML = PILLARS.map(
  (p) => `<div class="pillar reveal in">
    <div class="pillar-head"><span class="icon-tile" style="margin:0">${icon(p.icon)}</span><h3>${p.title}</h3></div>
    <ul>${p.links.map(([h, l]) => `<li><a href="${h}"><span>${l}</span>${icon('arrowRight')}</a></li>`).join('')}</ul>
  </div>`,
).join('');

const picks = ['chicken-breast', 'greek-yogurt', 'oats', 'lentils', 'avocado'];
document.getElementById('home-foods').innerHTML = picks
  .map((id) => FOODS.find((f) => f.id === id))
  .map(
    (f) => `<a class="card card-link" href="food-database.html#${f.id}" style="padding:14px 18px;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center">
      <span><b>${escapeHtml(f.name)}</b><br><span class="tiny muted">${f.categoryLabel} · на 100 г</span></span>
      <span class="row" style="gap:14px;font-variant-numeric:tabular-nums;font-weight:800;font-size:.9rem;flex-wrap:nowrap">
        <span>${fmt(f.per100.kcal)} <span class="tiny muted">kcal</span></span>
        <span class="val-protein">${fmtG(f.per100.protein)}<span class="tiny muted"> Б</span></span>
        <span class="val-carbs">${fmtG(f.per100.carbs)}<span class="tiny muted"> В</span></span>
        <span class="val-fat">${fmtG(f.per100.fat)}<span class="tiny muted"> М</span></span>
      </span>
    </a>`,
  )
  .join('');
