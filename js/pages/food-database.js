import { FOODS, CATEGORIES } from '../../data/foods.js';
import { insulinIndexForFood, hasDisagreement, II_SCALE } from '../../data/insulin-index.js';
import { SOURCES } from '../../data/sources.js';
import { FILTERS, filterFoods, sortFoods, goodForLabels, perServing } from '../lib/foodRules.js';
import { fmt, fmtG, fmtPct, escapeHtml } from '../lib/format.js';
import { donutChart } from '../lib/charts.js';
import { icon, hydrateIcons } from '../icons.js';
import { initTips } from '../layout.js';

const state = { q: '', category: 'all', filters: new Set(), sort: 'name', dir: 'asc', basis: '100' };

const $ = (id) => document.getElementById(id);
const tbody = $('tbody');
const cards = $('cards');
const modal = $('food-modal');

// ---------- Инсулинов индекс: обобщение ----------
function iiSummary(food) {
  const entries = insulinIndexForFood(food.id);
  if (!entries.length) return { entries, value: null };
  const vals = entries.map((e) => e.ii);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  return {
    entries,
    value: vals.reduce((a, b) => a + b, 0) / vals.length,
    display: min === max ? String(min) : `${min}–${max}`,
    disagree: hasDisagreement(entries),
  };
}
const II = new Map(FOODS.map((f) => [f.id, iiSummary(f)]));

function giCell(f) {
  if (f.gi.status === 'measured') return `<span title="Измерен ГИ (${escapeHtml(f.gi.tested)})">${f.gi.value}</span>`;
  if (f.gi.status === 'na') return `<span class="na" title="Храната почти няма въглехидрати — ГИ не може да бъде измерен">н/п</span>`;
  return `<span class="na" title="Няма измерена стойност в използвания източник">няма данни</span>`;
}
function iiCell(f) {
  const s = II.get(f.id);
  if (!s.entries.length) return `<span class="na" title="Няма надеждни данни за инсулинов индекс">няма данни</span>`;
  return `<span title="${s.disagree ? 'Стойностите се различават между изследвания/продукти' : 'Измерена стойност'}">${s.display}${s.disagree ? ' <span class="badge badge-warn" style="padding:1px 6px">≠</span>' : ''}</span>`;
}

// ---------- Контроли ----------
function renderControls() {
  const cats = [['all', 'Всички'], ...Object.entries(CATEGORIES)];
  $('cats').innerHTML = cats
    .map(([k, l]) => `<button type="button" class="chip" data-cat="${k}" aria-pressed="${state.category === k}">${l}</button>`)
    .join('');
  $('filters').innerHTML = Object.entries(FILTERS)
    .map(([k, f]) => `<button type="button" class="chip" data-filter="${k}" aria-pressed="${state.filters.has(k)}" title="${escapeHtml(f.rule)}">${f.short}</button>`)
    .join('');
  $('filter-rules').innerHTML = Object.values(FILTERS)
    .map((f) => `<b>${f.short}:</b> ${f.rule}`)
    .join('<br>');
  const measuredGi = FOODS.filter((f) => f.gi.status === 'measured').length;
  const withIi = FOODS.filter((f) => II.get(f.id).entries.length).length;
  $('db-stats').innerHTML = `
    <div><b>${FOODS.length}</b><span>храни</span></div>
    <div><b>${measuredGi}</b><span>с измерен ГИ</span></div>
    <div><b>${withIi}</b><span>с измерен инсулинов индекс</span></div>
    <div><b>USDA</b><span>източник на стойностите</span></div>`;
}

$('cats').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  state.category = b.dataset.cat;
  $('cats').querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
  render();
});
$('filters').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filter]');
  if (!b) return;
  const k = b.dataset.filter;
  // взаимно изключващи се двойки
  const opposite = { lowCarb: 'highCarb', highCarb: 'lowCarb', lowGi: 'highGi', highGi: 'lowGi' };
  if (state.filters.has(k)) state.filters.delete(k);
  else {
    state.filters.add(k);
    if (opposite[k]) state.filters.delete(opposite[k]);
  }
  $('filters').querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(state.filters.has(c.dataset.filter))));
  render();
});

let qTimer;
$('q').addEventListener('input', (e) => {
  clearTimeout(qTimer);
  qTimer = setTimeout(() => {
    state.q = e.target.value;
    $('q-clear').hidden = !state.q;
    render();
  }, 60);
});
$('q-clear').addEventListener('click', () => {
  $('q').value = '';
  state.q = '';
  $('q-clear').hidden = true;
  $('q').focus();
  render();
});
$('sort').addEventListener('change', (e) => {
  state.sort = e.target.value;
  state.dir = state.sort === 'name' ? 'asc' : 'desc';
  render();
});
$('sort-dir').addEventListener('click', () => {
  state.dir = state.dir === 'asc' ? 'desc' : 'asc';
  render();
});
$('basis').addEventListener('click', (e) => {
  const b = e.target.closest('[data-basis]');
  if (!b) return;
  state.basis = b.dataset.basis;
  $('basis').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  render();
});
$('reset').addEventListener('click', () => {
  state.q = '';
  state.category = 'all';
  state.filters.clear();
  $('q').value = '';
  $('q-clear').hidden = true;
  renderControls();
  render();
});
document.querySelectorAll('#table thead th[data-sort] button').forEach((b) =>
  b.addEventListener('click', () => {
    const key = b.parentElement.dataset.sort;
    if (state.sort === key) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
    else {
      state.sort = key;
      state.dir = key === 'name' ? 'asc' : 'desc';
    }
    render();
  }),
);

// ---------- Таблица и карти ----------
function valuesFor(f) {
  return state.basis === 'serving' ? perServing(f.per100, f.serving.grams) : f.per100;
}

function sortValue(key) {
  if (key === 'name') return (f) => f.name;
  if (key === 'gi') return (f) => f.gi.value;
  if (key === 'ii') return (f) => II.get(f.id).value;
  return (f) => valuesFor(f)[key];
}

function render() {
  let list = filterFoods(FOODS, { query: state.q, category: state.category, filters: [...state.filters] });
  list = sortFoods(list, state.sort, state.dir, sortValue(state.sort));

  $('sort').value = state.sort;
  $('sort-dir').textContent = state.dir === 'asc' ? '↑ възходящо' : '↓ низходящо';
  document.querySelectorAll('#table thead th[data-sort]').forEach((th) => {
    if (th.dataset.sort === state.sort) th.setAttribute('aria-sort', state.dir === 'asc' ? 'ascending' : 'descending');
    else th.removeAttribute('aria-sort');
    const b = th.querySelector('button');
    b.textContent = b.textContent.replace(/ [↑↓]$/, '') + (th.dataset.sort === state.sort ? (state.dir === 'asc' ? ' ↑' : ' ↓') : '');
  });
  const basisLabel = state.basis === 'serving' ? 'на порция' : 'на 100 г';
  $('count').textContent = `${list.length} ${list.length === 1 ? 'храна' : 'храни'} · стойности ${basisLabel}`;
  $('reset').hidden = !(state.q || state.category !== 'all' || state.filters.size);

  if (!list.length) {
    const msg = `<div class="empty-state">${icon('search')}<p><b>Няма намерени храни.</b><br>Опитайте с друга дума или премахнете някой филтър.</p></div>`;
    tbody.innerHTML = `<tr><td colspan="9">${msg}</td></tr>`;
    cards.innerHTML = msg;
    return;
  }

  tbody.innerHTML = list
    .map((f) => {
      const v = valuesFor(f);
      return `<tr data-id="${f.id}" tabindex="0" aria-label="${escapeHtml(f.name)} — детайли">
        <td><span class="food-name">${escapeHtml(f.name)}</span><span class="food-cat">${f.categoryLabel}</span></td>
        <td class="val-kcal">${fmt(v.kcal)}</td>
        <td class="val-protein">${fmtG(v.protein)}</td>
        <td class="val-carbs">${fmtG(v.carbs)}</td>
        <td class="val-fat">${fmtG(v.fat)}</td>
        <td>${v.fiber == null ? '<span class="na">н.д.</span>' : fmtG(v.fiber)}</td>
        <td>${giCell(f)}</td>
        <td>${iiCell(f)}</td>
        <td class="left small muted">${fmt(f.serving.grams, 1)} г · ${escapeHtml(f.serving.label)}</td>
      </tr>`;
    })
    .join('');

  cards.innerHTML = list
    .map((f) => {
      const v = valuesFor(f);
      return `<article class="food-card" data-id="${f.id}">
        <button type="button" aria-expanded="false">
          <span><span class="fc-name">${escapeHtml(f.name)}</span><br><span class="fc-cat">${f.categoryLabel}</span></span>
          <span class="row" style="gap:10px;flex-wrap:nowrap"><span class="fc-kcal">${fmt(v.kcal)}<small>kcal ${basisLabel}</small></span>${icon('chevronDown', 'fc-chevron')}</span>
        </button>
        <div class="fc-macros">
          <div><b class="val-protein">${fmtG(v.protein)} г</b>белтък</div>
          <div><b class="val-carbs">${fmtG(v.carbs)} г</b>въгл.</div>
          <div><b class="val-fat">${fmtG(v.fat)} г</b>мазн.</div>
        </div>
        <div class="fc-more">
          <dl>
            <dt>Фибри</dt><dd>${v.fiber == null ? 'н.д.' : `${fmtG(v.fiber)} г`}</dd>
            <dt>Гликемичен индекс</dt><dd>${giCell(f)}</dd>
            <dt>Инсулинов индекс</dt><dd>${iiCell(f)}</dd>
            <dt>Порция</dt><dd>${fmt(f.serving.grams, 1)} г · ${escapeHtml(f.serving.label)}</dd>
          </dl>
          <button type="button" class="btn btn-primary btn-sm" data-open="${f.id}">Пълна информация</button>
        </div>
      </article>`;
    })
    .join('');
}

tbody.addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-id]');
  if (tr) openFood(tr.dataset.id);
});
tbody.addEventListener('keydown', (e) => {
  const tr = e.target.closest('tr[data-id]');
  if (tr && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    openFood(tr.dataset.id);
  }
});
cards.addEventListener('click', (e) => {
  const open = e.target.closest('[data-open]');
  if (open) return openFood(open.dataset.open);
  const head = e.target.closest('.food-card > button');
  if (head) {
    const card = head.parentElement;
    const exp = !card.classList.contains('expanded');
    card.classList.toggle('expanded', exp);
    head.setAttribute('aria-expanded', String(exp));
  }
});

// ---------- Детайли (модален прозорец) ----------
let modalGrams = null;

function openFood(id) {
  const f = FOODS.find((x) => x.id === id);
  if (!f) return;
  modalGrams = state.basis === 'serving' ? f.serving.grams : 100;
  renderModal(f);
  if (!modal.open) modal.showModal();
  history.replaceState(null, '', `#${id}`);
}

function renderModal(f) {
  const grams = modalGrams;
  const v = perServing(f.per100, grams);
  const kcalP = v.protein * 4;
  const kcalC = v.carbs * 4;
  const kcalF = v.fat * 9;
  const totalMacroKcal = kcalP + kcalC + kcalF || 1;
  const labels = goodForLabels(f);
  const ii = II.get(f.id);
  const src = SOURCES.usda;

  const giBlock =
    f.gi.status === 'measured'
      ? `<p><b style="font-size:1.3rem">${f.gi.value}</b> · ${f.gi.value <= 55 ? 'нисък' : f.gi.value < 70 ? 'среден' : 'висок'} ГИ (глюкоза = 100)</p>
         <p class="small muted">Тествана храна: ${escapeHtml(f.gi.tested)}.${f.gi.note ? ` ${escapeHtml(f.gi.note)}` : ''} Източник: <a href="${SOURCES.atkinson2008.url}" target="_blank" rel="noopener">${SOURCES.atkinson2008.short}</a>.</p>`
      : f.gi.status === 'na'
        ? `<p class="muted">Неприложимо — храната съдържа под 5 г въглехидрати на 100 г, затова ГИ не може да бъде измерен.</p>`
        : `<p class="muted">Няма измерена стойност в използвания източник. Не показваме оценки.</p>`;

  const iiBlock = ii.entries.length
    ? `${ii.disagree ? `<div class="notice notice-warn" style="margin-bottom:8px">${icon('alert')}<p><b>Отчетените стойности се различават между изследванията.</b> Често причината е, че са тествани различни продукти или рецепти.</p></div>` : ''}
       ${ii.entries
         .map(
           (e) => `<div class="ii-entry">
             <div class="row" style="justify-content:space-between"><span class="ii-val">${e.ii}${e.iiSem ? `<span class="small muted"> ± ${e.iiSem}</span>` : ''}</span><span class="badge">${SOURCES[e.sourceId].short}</span></div>
             <div class="small muted">Тествано: ${escapeHtml(e.tested)} · порция ${fmt(e.per1000kJ.grams)} г (1000 kJ) · ${II_SCALE.reference}</div>
             ${e.note ? `<div class="small" style="margin-top:4px">${escapeHtml(e.note)}</div>` : ''}
           </div>`,
         )
         .join('')}
       <p class="small muted" style="margin-top:8px">Стойността се отнася за порция от 1000 kJ (≈239 kcal), не за 100 г. <a href="insulin-index.html">Как да я разчитаме?</a></p>`
    : `<p class="muted">Няма надеждни данни за инсулиновия индекс на тази храна.</p>`;

  modal.innerHTML = `
    <div class="modal-head">
      <div style="flex:1;min-width:0">
        <span class="badge badge-primary">${f.categoryLabel}</span>
        <h2 id="fm-title" style="margin-top:8px">${escapeHtml(f.name)}</h2>
        <div class="small muted">${escapeHtml(f.nameEn)}</div>
      </div>
      <button type="button" class="icon-btn" data-close aria-label="Затвори">${icon('x')}</button>
    </div>
    <div class="modal-body">
      <div class="row" style="justify-content:space-between">
        <div class="segmented" role="group" aria-label="Количество" id="fm-basis">
          <button type="button" data-g="100" aria-pressed="${grams === 100}">100 г</button>
          <button type="button" data-g="${f.serving.grams}" aria-pressed="${grams === f.serving.grams && grams !== 100}">Порция (${fmt(f.serving.grams, 1)} г)</button>
        </div>
        <label class="row small" style="gap:8px;font-weight:700">Свое количество
          <span class="input-wrap" style="width:120px"><input class="input" id="fm-grams" inputmode="decimal" value="${fmt(grams, 1)}" style="min-height:40px;padding:6px 36px 6px 10px;font-size:.95rem"><span class="unit">г</span></span>
        </label>
      </div>
      <p class="small muted" style="margin:8px 0 0">Типична порция: ${escapeHtml(f.serving.label)} (${fmt(f.serving.grams, 1)} г)</p>

      <div class="nutri-grid">
        <div class="nutri"><span>Калории</span><b>${fmt(v.kcal)}<small>kcal</small></b></div>
        <div class="nutri"><span>Белтъчини</span><b class="val-protein">${fmtG(v.protein)}<small>г</small></b></div>
        <div class="nutri"><span>Въглехидрати</span><b class="val-carbs">${fmtG(v.carbs)}<small>г</small></b></div>
        <div class="nutri"><span>Мазнини</span><b class="val-fat">${fmtG(v.fat)}<small>г</small></b></div>
        <div class="nutri"><span>Фибри</span><b>${v.fiber == null ? '—' : fmtG(v.fiber)}<small>${v.fiber == null ? 'н.д.' : 'г'}</small></b></div>
      </div>

      <div class="donut-wrap" style="grid-template-columns:minmax(0,180px) 1fr;gap:20px">
        <div class="donut" id="fm-donut" style="max-width:180px"></div>
        <div>
          <h3 style="margin-bottom:8px">Откъде идват калориите</h3>
          <div class="legend" style="margin-top:0">
            <div class="legend-row"><span class="swatch" style="background:var(--protein)"></span><span>Белтъчини</span><b>${fmtPct(kcalP / totalMacroKcal)}</b></div>
            <div class="legend-row"><span class="swatch" style="background:var(--carbs)"></span><span>Въглехидрати</span><b>${fmtPct(kcalC / totalMacroKcal)}</b></div>
            <div class="legend-row"><span class="swatch" style="background:var(--fat)"></span><span>Мазнини</span><b>${fmtPct(kcalF / totalMacroKcal)}</b></div>
          </div>
          <p class="tiny muted" style="margin-top:8px">По 4 kcal/г за белтък и въглехидрати и 9 kcal/г за мазнини. Сумата може леко да се различава от калориите по USDA, които използват специфични фактори.</p>
        </div>
      </div>

      <h3 style="margin-top:24px">Подходящо за</h3>
      ${labels.length ? `<div class="goodfor">${labels.map((l) => `<span class="badge badge-primary" title="${escapeHtml(l.why)}">${icon('check')} ${l.label}</span>`).join('')}</div>
        <ul class="small muted" style="padding-left:1.1em;margin-top:10px">${labels.map((l) => `<li><b>${l.label}:</b> ${l.why}</li>`).join('')}</ul>` : `<p class="muted small">Храната не отговаря на критериите за нито един етикет. Това не значи, че е „лоша“ — само че профилът ѝ не е специфичен за тези цели.</p>`}

      <div class="grid grid-2" style="margin-top:20px;gap:16px">
        <div><h3>Гликемичен индекс</h3>${giBlock}</div>
        <div><h3>Инсулинов индекс</h3>${iiBlock}</div>
      </div>

      <div class="source-box">
        <p><b>Източник на хранителните стойности:</b> ${src.short}, SR Legacy — FDC ID <a href="${f.source.url}" target="_blank" rel="noopener">${f.source.fdcId}</a>. Стойностите на порция са пресметнати пропорционално от стойностите на 100 г.</p>
        <p>Хранителните стойности на конкретни продукти варират според сорт, производител и начин на приготвяне.</p>
      </div>
    </div>`;

  hydrateIcons(modal);
  initTips(modal);
  donutChart(
    modal.querySelector('#fm-donut'),
    [
      { key: 'p', label: 'Белтъчини', value: kcalP, color: 'var(--protein)' },
      { key: 'c', label: 'Въглехидрати', value: kcalC, color: 'var(--carbs)' },
      { key: 'f', label: 'Мазнини', value: kcalF, color: 'var(--fat)' },
    ],
    { center: (s) => (s ? `<div><b style="color:${s.color};font-size:1.4rem">${fmtPct(s.value / totalMacroKcal)}</b><span>${s.label}</span></div>` : `<div><b style="font-size:1.4rem">${fmt(v.kcal)}</b><span>kcal</span></div>`) },
  );

  modal.querySelector('#fm-basis').addEventListener('click', (e) => {
    const b = e.target.closest('[data-g]');
    if (!b) return;
    modalGrams = Number(b.dataset.g);
    renderModal(f);
  });
  const gi = modal.querySelector('#fm-grams');
  gi.addEventListener('change', () => {
    const n = Number(String(gi.value).replace(',', '.'));
    if (Number.isFinite(n) && n > 0 && n <= 2000) {
      modalGrams = n;
      renderModal(f);
    } else {
      gi.value = fmt(modalGrams, 1);
    }
  });
}

modal.addEventListener('click', (e) => {
  if (e.target === modal || e.target.closest('[data-close]')) modal.close();
});
modal.addEventListener('close', () => history.replaceState(null, '', location.pathname + location.search));

// ---------- Старт ----------
const params = new URLSearchParams(location.search);
if (params.get('q')) {
  state.q = params.get('q');
  $('q').value = state.q;
  $('q-clear').hidden = false;
}
if (params.get('cat') && CATEGORIES[params.get('cat')]) state.category = params.get('cat');
renderControls();
render();
hydrateIcons();
initTips();
if (location.hash.length > 1) openFood(decodeURIComponent(location.hash.slice(1)));
