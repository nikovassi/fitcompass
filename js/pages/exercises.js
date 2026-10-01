import { EXERCISES, MUSCLES, EQUIPMENT } from '../../data/exercises.js';
import { normalize } from '../lib/foodRules.js';
import { escapeHtml } from '../lib/format.js';

const state = { q: '', muscle: 'all', equip: 'all' };
const $ = (id) => document.getElementById(id);

function chips(el, entries, key) {
  el.innerHTML = [['all', key === 'muscle' ? 'Всички мускули' : 'Всяко оборудване'], ...Object.entries(entries)]
    .map(([k, l]) => `<button type="button" class="chip" data-v="${k}" aria-pressed="${state[key] === k}">${l}</button>`)
    .join('');
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    state[key] = b.dataset.v;
    el.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    render();
  });
}

function render() {
  const q = normalize(state.q);
  const list = EXERCISES.filter(
    (x) =>
      (state.muscle === 'all' || x.muscle === state.muscle) &&
      (state.equip === 'all' || x.equipment === state.equip) &&
      (!q || q.split(' ').every((w) => normalize(`${x.name} ${x.muscleLabel} ${x.secondary} ${x.equipmentLabel}`).includes(w))),
  );
  $('ecount').textContent = `${list.length} упражнения`;
  $('ex-grid').innerHTML = list.length
    ? list
        .map(
          (x) => `<article class="card ex-card" id="${x.id}">
        <h3>${escapeHtml(x.name)}</h3>
        <div class="ex-meta"><span class="badge badge-primary">${x.muscleLabel}</span><span class="badge">${x.equipmentLabel}</span><span class="badge badge-muted">${x.levelLabel}</span></div>
        ${x.secondary ? `<p class="small muted" style="margin:0 0 10px">Помощни: ${escapeHtml(x.secondary)}</p>` : ''}
        <details><summary>Техника ▾</summary><ol>${x.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol><p class="small" style="margin:10px 0 0"><b>Съвет:</b> ${escapeHtml(x.tip)}</p></details>
      </article>`,
        )
        .join('')
    : '<div class="empty-state">Няма упражнения по тези критерии.</div>';
}

chips($('muscles'), MUSCLES, 'muscle');
chips($('equip'), EQUIPMENT, 'equip');
$('eq').addEventListener('input', (e) => {
  state.q = e.target.value;
  render();
});
render();
if (location.hash) document.getElementById(location.hash.slice(1))?.querySelector('details')?.setAttribute('open', '');
