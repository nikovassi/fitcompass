import { INSULIN_INDEX, GROUPS } from '../../data/insulin-index.js';
import { SOURCES } from '../../data/sources.js';
import { sortFoods, normalize } from '../lib/foodRules.js';
import { fmt, fmtG, escapeHtml } from '../lib/format.js';
import { icon } from '../icons.js';
import { initTips } from '../layout.js';

const state = { q: '', group: 'all', sort: 'ii', dir: 'desc' };
const $ = (id) => document.getElementById(id);
const MAX = Math.max(...INSULIN_INDEX.map((e) => e.ii));

function giCell(e) {
  if (e.gi == null) return '<span class="na" title="Няма публикуван ГИ в използваните източници">—</span>';
  return `<span title="ГИ (глюкоза = 100), ${SOURCES[e.giSource].short}">${e.gi}</span>`;
}
function iiBar(e) {
  const w = (e.ii / MAX) * 100;
  const ref = e.id === 'holt-whitebread';
  return `<span class="ii-bar"><b style="min-width:2.2em;font-size:1.05rem">${e.ii}</b>${e.iiSem ? `<span class="tiny muted">±${e.iiSem}</span>` : ''}<i><b class="${ref ? 'ref' : ''}" style="width:${w}%"></b></i></span>`;
}

function sourceLink(e) {
  const s = SOURCES[e.sourceId];
  return `<a href="${s.url}" target="_blank" rel="noopener">${s.short}</a>`;
}

function render() {
  const q = normalize(state.q);
  let list = INSULIN_INDEX.filter(
    (e) => (state.group === 'all' || e.group === state.group) && (!q || q.split(' ').every((w) => normalize(`${e.name} ${e.tested} ${e.groupLabel}`).includes(w))),
  );
  const getters = {
    name: (e) => e.name,
    ii: (e) => e.ii,
    gi: (e) => e.gi,
    carbs: (e) => e.per1000kJ.carbs,
    protein: (e) => e.per1000kJ.protein,
  };
  list = sortFoods(list, state.sort, state.dir, getters[state.sort]);
  $('isort').value = state.sort;
  $('idir').textContent = state.dir === 'asc' ? '↑ възходящо' : '↓ низходящо';
  document.querySelectorAll('#itable th[data-sort]').forEach((th) => {
    if (th.dataset.sort === state.sort) th.setAttribute('aria-sort', state.dir === 'asc' ? 'ascending' : 'descending');
    else th.removeAttribute('aria-sort');
  });
  $('icount').textContent = `${list.length} измервания`;

  if (!list.length) {
    const m = `<div class="empty-state">${icon('search')}<p>Няма съвпадения. Ако храната липсва, за нея няма надеждни данни в използваните изследвания.</p></div>`;
    $('itbody').innerHTML = `<tr><td colspan="8">${m}</td></tr>`;
    $('icards').innerHTML = m;
    return;
  }

  $('itbody').innerHTML = list
    .map(
      (e) => `<tr style="cursor:default">
        <td><span class="food-name">${escapeHtml(e.name)}</span><span class="food-cat">${e.groupLabel} · тествано: ${escapeHtml(e.tested)}${e.note ? ` <span class="tip"><button type="button" class="tip-btn" aria-label="Бележка">i</button><span class="tip-body" role="tooltip">${escapeHtml(e.note)}</span></span>` : ''}</span></td>
        <td>${fmt(e.per1000kJ.grams)} г</td>
        <td class="left">${iiBar(e)}</td>
        <td>${giCell(e)}</td>
        <td>${e.per1000kJ.kcal}</td>
        <td class="val-carbs">${fmtG(e.per1000kJ.carbs)}</td>
        <td class="val-protein">${fmtG(e.per1000kJ.protein)}</td>
        <td class="left small">${sourceLink(e)}${e.foodId ? `<br><a href="food-database.html#${e.foodId}" class="tiny">в базата →</a>` : ''}</td>
      </tr>`,
    )
    .join('');

  $('icards').innerHTML = list
    .map(
      (e) => `<article class="food-card">
        <button type="button" aria-expanded="false">
          <span><span class="fc-name">${escapeHtml(e.name)}</span><br><span class="fc-cat">${e.groupLabel}</span></span>
          <span class="row" style="gap:10px;flex-wrap:nowrap"><span class="fc-kcal">${e.ii}<small>инсулинов индекс</small></span>${icon('chevronDown', 'fc-chevron')}</span>
        </button>
        <div class="fc-macros">
          <div><b>${fmt(e.per1000kJ.grams)} г</b>порция</div>
          <div><b class="val-carbs">${fmtG(e.per1000kJ.carbs)} г</b>въгл.</div>
          <div><b>${e.gi ?? '—'}</b>ГИ</div>
        </div>
        <div class="fc-more">
          <dl>
            <dt>Тествано</dt><dd>${escapeHtml(e.tested)}</dd>
            <dt>Белтък в порцията</dt><dd>${fmtG(e.per1000kJ.protein)} г</dd>
            <dt>Мазнини в порцията</dt><dd>${fmtG(e.per1000kJ.fat)} г</dd>
            <dt>Енергия</dt><dd>1000 kJ (${e.per1000kJ.kcal} kcal)</dd>
            ${e.iiSem ? `<dt>Грешка (± SEM)</dt><dd>±${e.iiSem}</dd>` : ''}
            ${e.glucoseScore != null ? `<dt>Глюкозен отговор (хляб = 100)</dt><dd>${e.glucoseScore}</dd>` : ''}
            <dt>Източник</dt><dd>${sourceLink(e)}</dd>
          </dl>
          ${e.note ? `<p class="small muted">${escapeHtml(e.note)}</p>` : ''}
          ${e.foodId ? `<a class="btn btn-sm" href="food-database.html#${e.foodId}">Виж в базата с храни</a>` : ''}
        </div>
      </article>`,
    )
    .join('');
  initTips($('itbody'));
}

function init() {
  $('groups').innerHTML = [['all', 'Всички'], ...Object.entries(GROUPS)]
    .map(([k, l]) => `<button type="button" class="chip" data-group="${k}" aria-pressed="${state.group === k}">${l}</button>`)
    .join('');
  $('groups').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-group]');
    if (!b) return;
    state.group = b.dataset.group;
    $('groups').querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    render();
  });
  $('iq').addEventListener('input', (ev) => {
    state.q = ev.target.value;
    render();
  });
  $('isort').addEventListener('change', (ev) => {
    state.sort = ev.target.value;
    state.dir = state.sort === 'name' ? 'asc' : 'desc';
    render();
  });
  $('idir').addEventListener('click', () => {
    state.dir = state.dir === 'asc' ? 'desc' : 'asc';
    render();
  });
  document.querySelectorAll('#itable th[data-sort] button').forEach((b) =>
    b.addEventListener('click', () => {
      const k = b.parentElement.dataset.sort;
      if (state.sort === k) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
      else {
        state.sort = k;
        state.dir = k === 'name' ? 'asc' : 'desc';
      }
      render();
    }),
  );
  $('icards').addEventListener('click', (ev) => {
    const head = ev.target.closest('.food-card > button');
    if (!head) return;
    const card = head.parentElement;
    const exp = !card.classList.contains('expanded');
    card.classList.toggle('expanded', exp);
    head.setAttribute('aria-expanded', String(exp));
  });
  $('source-list').innerHTML = [SOURCES.holt1997, SOURCES.bao2009, SOURCES.atkinson2008]
    .map((s) => `<li>${escapeHtml(s.citation)} <a href="${s.url}" target="_blank" rel="noopener">${s.url.replace('https://', '')}</a><br><span class="muted">База на измерването: ${escapeHtml(s.basis)}</span></li>`)
    .join('');
  render();
}

init();
