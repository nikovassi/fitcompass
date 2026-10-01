import { RECIPES } from '../../data/recipes.js';
import { fmt, fmtG, escapeHtml } from '../lib/format.js';
import { icon } from '../icons.js';

const tags = ['Всички', ...new Set(RECIPES.flatMap((r) => r.tags))];
let active = 'Всички';
const tagEl = document.getElementById('recipe-tags');
const grid = document.getElementById('recipes-grid');

function render() {
  tagEl.innerHTML = tags.map((t) => `<button type="button" class="chip" data-t="${t}" aria-pressed="${t === active}">${t}</button>`).join('');
  grid.innerHTML = RECIPES.filter((r) => active === 'Всички' || r.tags.includes(active))
    .map((r) => {
      const m = r.perServing;
      return `<article class="card recipe-card" id="${r.id}">
        <div class="row" style="gap:6px">${r.tags.map((t) => `<span class="badge">${t}</span>`).join('')}</div>
        <h3 style="margin-top:10px">${escapeHtml(r.name)}</h3>
        <p class="small muted">${escapeHtml(r.desc)}</p>
        <div class="row tiny muted" style="gap:14px">${icon('clock')}<span>${r.minutes} мин</span><span>${r.servings} ${r.servings === 1 ? 'порция' : 'порции'}</span></div>
        <div class="r-macros">
          <div><b>${fmt(m.kcal)}</b>kcal</div>
          <div><b class="val-protein">${fmtG(m.protein)}</b>белтък г</div>
          <div><b class="val-carbs">${fmtG(m.carbs)}</b>въгл. г</div>
          <div><b class="val-fat">${fmtG(m.fat)}</b>мазн. г</div>
        </div>
        <details>
          <summary style="cursor:pointer;font-weight:800;color:var(--primary)">Съставки и приготвяне ▾</summary>
          <ul class="small" style="padding-left:1.1em">${r.ingredients.map((i) => `<li><a href="food-database.html#${i.foodId}">${escapeHtml(i.name)}</a> — ${fmt(i.grams)} г</li>`).join('')}</ul>
          <ol class="small" style="padding-left:1.2em">${r.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
          <p class="tiny muted">Стойностите са на порция; фибри ≈ ${fmtG(m.fiber)} г.</p>
        </details>
      </article>`;
    })
    .join('');
  grid.querySelectorAll('svg').forEach((s) => {
    s.style.width = '14px';
    s.style.height = '14px';
  });
}
tagEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-t]');
  if (!b) return;
  active = b.dataset.t;
  render();
});
render();
