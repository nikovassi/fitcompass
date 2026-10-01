import {
  bmi,
  bmiCategory,
  weightForBmi,
  bmrMifflinStJeor,
  bmrHarrisBenedict,
  bmrKatchMcArdle,
  tdeeSimple,
  SIMPLE_ACTIVITY_MULTIPLIERS,
  macrosFromPercentages,
  proteinNeeds,
  PROTEIN_LEVELS,
  oneRmEpley,
  oneRmBrzycki,
  oneRmLombardi,
  oneRmAverage,
  repTable,
} from '../lib/calculations.js';
import { validateNumber, LIMITS } from '../lib/validation.js';
import { fmt, fmtG, fmtPct } from '../lib/format.js';
import { donutChart } from '../lib/charts.js';
import { icon } from '../icons.js';

// ---------- Табове (с дълбоки връзки #bmi, #tdee...) ----------
const tabs = [...document.querySelectorAll('#calc-tabs [role=tab]')];
function showTab(id, focus = false) {
  if (!tabs.some((t) => t.dataset.tab === id)) id = 'bmi';
  tabs.forEach((t) => {
    const on = t.dataset.tab === id;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.dataset.tab).hidden = !on;
    if (on && focus) t.focus();
  });
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => {
    showTab(t.dataset.tab);
    history.replaceState(null, '', `#${t.dataset.tab}`);
  });
  t.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (d) showTab(tabs[(i + d + tabs.length) % tabs.length].dataset.tab, true);
  });
});
window.addEventListener('hashchange', () => showTab(location.hash.slice(1)));
showTab(location.hash.slice(1) || 'bmi');

// ---------- Помощни ----------
function setErr(form, name, msg) {
  const f = form.querySelector(`[data-field="${name}"]`);
  if (!f) return;
  f.classList.toggle('has-error', !!msg);
  const m = f.querySelector('.error-msg');
  if (m) m.innerHTML = msg ? `${icon('alert')}<span>${msg}</span>` : '';
}
function num(form, name, opts) {
  const r = validateNumber(form.elements[name].value, opts);
  setErr(form, name, r.valid ? '' : r.error);
  return r.valid ? r.value : null;
}
const out = (k) => document.querySelector(`[data-out="${k}"]`);
const radio = {};
document.querySelectorAll('[data-radio]').forEach((g) => {
  const form = g.closest('form');
  radio[form.dataset.calc] = g.querySelector('[aria-pressed=true]').dataset.value;
  g.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-value]');
    if (!b) return;
    radio[form.dataset.calc] = b.dataset.value;
    g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  });
});
const H = { min: LIMITS.heightCm.min, max: LIMITS.heightCm.max, label: 'ръст' };
const W = { min: LIMITS.weightKg.min, max: LIMITS.weightKg.max, label: 'тегло' };
const A = { min: LIMITS.age.min, max: LIMITS.age.max, label: 'възраст', integer: true };

function bind(name, fn, initialHtml) {
  const form = document.querySelector(`[data-calc="${name}"]`);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    fn(form);
  });
  form.addEventListener('reset', () => {
    setTimeout(() => {
      form.querySelectorAll('[data-field]').forEach((f) => setErr(form, f.dataset.field, ''));
      out(name).innerHTML = initialHtml;
      form.dispatchEvent(new Event('input'));
    });
  });
  return form;
}
const initial = (k) => out(k).innerHTML;

// ---------- BMI ----------
bind(
  'bmi',
  (f) => {
    const h = num(f, 'h', H);
    const w = num(f, 'w', W);
    if (h == null || w == null) return;
    const v = bmi(w, h);
    const cat = bmiCategory(v);
    const pos = Math.min(100, Math.max(0, ((v - 15) / (40 - 15)) * 100));
    out('bmi').innerHTML = `
      <div class="s-label">Твоят BMI</div>
      <div class="big-number" style="font-size:3.4rem">${fmt(v, 1)}</div>
      <p><span class="badge badge-primary" style="font-size:.9rem">${cat.label}</span></p>
      <div style="position:relative;margin:26px 0 8px">
        <div style="display:flex;height:12px;border-radius:99px;overflow:hidden">
          <span style="flex:3.5;background:var(--protein)"></span><span style="flex:6.5;background:var(--success)"></span><span style="flex:5;background:var(--carbs)"></span><span style="flex:10;background:var(--fat)"></span>
        </div>
        <span style="position:absolute;top:-6px;left:calc(${pos}% - 3px);width:6px;height:24px;border-radius:3px;background:var(--text)"></span>
      </div>
      <div class="row tiny muted" style="justify-content:space-between"><span>15</span><span>18,5</span><span>25</span><span>30</span><span>40</span></div>
      <p class="small" style="margin-top:16px">Нормален BMI (18,5–24,9) за ръст ${fmt(h)} cm отговаря на <b>${fmt(weightForBmi(18.5, h), 1)}–${fmt(weightForBmi(24.9, h), 1)} kg</b>.</p>
      <p class="small muted" style="margin:0">BMI не различава мускули от мазнини — при трениращи с повече мускулна маса може да надценява. Категориите на СЗО са за възрастни.</p>`;
  },
  initial('bmi'),
);

// ---------- BMR ----------
bind(
  'bmr',
  (f) => {
    const age = num(f, 'age', A);
    const h = num(f, 'h', H);
    const w = num(f, 'w', W);
    let bf = null;
    if (f.elements.bf.value.trim()) bf = num(f, 'bf', { ...LIMITS.bodyFatPct, label: '% мазнини' });
    else setErr(f, 'bf', '');
    if ([age, h, w].includes(null) || (f.elements.bf.value.trim() && bf == null)) return;
    const p = { sex: radio.bmr, age, heightCm: h, weightKg: w };
    const ms = bmrMifflinStJeor(p);
    const hb = bmrHarrisBenedict(p);
    const km = bf != null ? bmrKatchMcArdle({ weightKg: w, bodyFatPct: bf }) : null;
    out('bmr').innerHTML = `
      <div class="s-label">Базов метаболизъм (Mifflin-St Jeor)</div>
      <div class="big-number" style="font-size:3.4rem">${fmt(ms)}<small>kcal/ден</small></div>
      <div class="legend" style="margin-top:20px">
        <div class="legend-row"><span class="swatch" style="background:var(--primary)"></span><span>Mifflin-St Jeor (1990) — препоръчвано</span><b>${fmt(ms)} kcal</b></div>
        <div class="legend-row"><span class="swatch" style="background:var(--carbs)"></span><span>Harris-Benedict (ревизирано, 1984)</span><b>${fmt(hb)} kcal</b></div>
        <div class="legend-row"><span class="swatch" style="background:var(--protein)"></span><span>Katch-McArdle (по нетлъста маса)</span><b>${km != null ? `${fmt(km)} kcal` : '<span class="na">нужен е % мазнини</span>'}</b></div>
      </div>
      <p class="small muted" style="margin-top:16px">BMR е разходът в пълен покой. Реалният дневен разход (TDEE) е обикновено 1,2–2 пъти по-голям. <a href="calorie-calculator.html">Изчисли TDEE и калорийна цел →</a></p>`;
  },
  initial('bmr'),
);

// ---------- TDEE ----------
const actSel = document.getElementById('tdee-act');
actSel.innerHTML = Object.entries(SIMPLE_ACTIVITY_MULTIPLIERS)
  .map(([k, v]) => `<option value="${k}"${k === 'moderate' ? ' selected' : ''}>${v.label} — × ${fmt(v.value, 3)}</option>`)
  .join('');
bind(
  'tdee',
  (f) => {
    const age = num(f, 'age', A);
    const h = num(f, 'h', H);
    const w = num(f, 'w', W);
    if ([age, h, w].includes(null)) return;
    const b = bmrMifflinStJeor({ sex: radio.tdee, age, heightCm: h, weightKg: w });
    const t = tdeeSimple(b, f.elements.act.value);
    out('tdee').innerHTML = `
      <div class="s-label">Поддържащи калории (TDEE)</div>
      <div class="big-number" style="font-size:3.4rem">${fmt(t)}<small>kcal/ден</small></div>
      <p class="range-line">Вероятен диапазон: ${fmt(t * 0.9)}–${fmt(t * 1.1)} kcal · BMR ${fmt(b)} kcal</p>
      <div class="kv" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:18px">
        <div class="kv-item"><span>Отслабване (−20%)</span><b>${fmt(t * 0.8)}</b></div>
        <div class="kv-item"><span>Поддържане</span><b>${fmt(t)}</b></div>
        <div class="kv-item"><span>Мускулна маса (+8%)</span><b>${fmt(t * 1.08)}</b></div>
      </div>
      <p class="small muted" style="margin-top:16px">Общите множители не различават крачки, работа и вид тренировки. <a href="calorie-calculator.html">Калорийният калкулатор</a> ги изчислява поотделно.</p>`;
  },
  initial('tdee'),
);

// ---------- Макроси ----------
const macroForm = document.querySelector('[data-calc="macro"]');
function macroSplitVals() {
  const p = Number(macroForm.elements.p.value);
  const c = Number(macroForm.elements.c.value);
  return { p, c, f: 100 - p - c };
}
function paintMacro() {
  const { p, c, f } = macroSplitVals();
  document.getElementById('mp-p').textContent = `${p}%`;
  document.getElementById('mp-c').textContent = `${c}%`;
  document.getElementById('mp-f').textContent = `${f}%`;
  macroForm.querySelectorAll('input[type=range]').forEach((r) => r.style.setProperty('--fill', `${((r.value - r.min) / (r.max - r.min)) * 100}%`));
  setErr(macroForm, 'split', f < 15 ? 'Мазнините трябва да са поне 15% — намали белтъка или въглехидратите.' : '');
}
macroForm.addEventListener('input', paintMacro);
document.getElementById('macro-presets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-p]');
  if (!b) return;
  const [p, c] = b.dataset.p.split(',').map(Number);
  macroForm.elements.p.value = p;
  macroForm.elements.c.value = c;
  paintMacro();
});
paintMacro();
bind(
  'macro',
  (f) => {
    const kcal = num(f, 'kcal', { min: 800, max: 8000, label: 'калориите' });
    const { p, c, f: fat } = macroSplitVals();
    if (kcal == null || fat < 15) return paintMacro();
    const m = macrosFromPercentages(kcal, { protein: p, carbs: c, fat });
    const C = { protein: 'var(--protein)', carbs: 'var(--carbs)', fat: 'var(--fat)' };
    const L = { protein: 'Белтъчини', carbs: 'Въглехидрати', fat: 'Мазнини' };
    out('macro').innerHTML = `
      <div class="donut" id="macro-d" style="max-width:220px"></div>
      <div class="macro-rows" style="margin-top:20px">${['protein', 'carbs', 'fat']
        .map(
          (k) => `<div class="macro-row" style="--c:${C[k]};cursor:default"><span class="m-ico">${fmtPct(m.pct[k])}</span><span><span class="m-top"><span>${L[k]}</span><span>${fmtG(m.grams[k])} г</span></span><span class="m-sub"><span>${fmt(m.kcal[k])} kcal</span><span>≈ ${fmtG(m.grams[k] / 4)} г на хранене (4 хранения)</span></span></span></div>`,
        )
        .join('')}</div>`;
    donutChart(
      document.getElementById('macro-d'),
      ['protein', 'carbs', 'fat'].map((k) => ({ key: k, label: L[k], value: m.kcal[k], color: C[k] })),
      { center: (s) => (s ? `<div><b style="color:${s.color}">${fmtG(m.grams[s.key])} г</b><span>${s.label}</span></div>` : `<div><b>${fmt(kcal)}</b><span>kcal</span></div>`) },
    );
  },
  initial('macro'),
);
macroForm.addEventListener('reset', () => setTimeout(paintMacro));

// ---------- Протеин ----------
const lvl = document.getElementById('pr-l');
lvl.innerHTML = Object.entries(PROTEIN_LEVELS)
  .map(([k, v]) => `<option value="${k}"${k === 'strength' ? ' selected' : ''}>${v.label} (${fmt(v.range[0], 1)}–${fmt(v.range[1], 1)} г/kg)</option>`)
  .join('');
bind(
  'protein',
  (f) => {
    const w = num(f, 'w', W);
    let h = null;
    if (f.elements.h.value.trim()) h = num(f, 'h', H);
    else setErr(f, 'h', '');
    if (w == null || (f.elements.h.value.trim() && h == null)) return;
    const r = proteinNeeds({ weightKg: w, heightCm: h, level: f.elements.level.value });
    out('protein').innerHTML = `
      <div class="s-label">Дневен белтък</div>
      <div class="big-number" style="font-size:3.4rem">${fmt(r.low)}–${fmt(r.high)}<small>г/ден</small></div>
      <p class="range-line">≈ ${fmt(r.mid / 4)} г на хранене при 4 хранения (${fmt(r.mid / 3)} г при 3)</p>
      ${r.referenceWeight !== w ? `<div class="notice notice-info" style="margin-top:14px">${icon('info')}<p>При BMI над 30 изчисляваме спрямо тегло при BMI 27 (${fmt(r.referenceWeight, 1)} kg), за да не се надцени нуждата.</p></div>` : ''}
      <p class="small muted" style="margin-top:16px">Ориентир: 100 г пилешки гърди ≈ 31 г белтък, 1 яйце ≈ 6 г, 170 г гръцко кисело мляко ≈ 17 г. <a href="food-database.html?cat=meat">Виж храни, богати на белтък →</a></p>
      <p class="tiny muted" style="margin:0">Източници: Jäger et al., ISSN Position Stand 2017; Morton et al., Br J Sports Med 2018. При бъбречно заболяване се консултирай с лекар.</p>`;
  },
  initial('protein'),
);

// ---------- 1RM ----------
bind(
  'onerm',
  (f) => {
    const w = num(f, 'w', { min: 1, max: 600, label: 'тежестта' });
    const r = num(f, 'r', { min: 1, max: 15, label: 'повторенията', integer: true });
    if (w == null || r == null) return;
    const avg = oneRmAverage(w, r);
    const table = repTable(avg);
    out('onerm').innerHTML = `
      <div class="s-label">Оценен 1RM (средно от 3 формули)</div>
      <div class="big-number" style="font-size:3.4rem">${fmt(avg, 1)}<small>kg</small></div>
      <p class="range-line">Epley ${fmt(oneRmEpley(w, r), 1)} · Brzycki ${fmt(oneRmBrzycki(w, r), 1)} · Lombardi ${fmt(oneRmLombardi(w, r), 1)} kg</p>
      ${r > 10 ? `<div class="notice notice-warn" style="margin-top:12px">${icon('alert')}<p>Над 10 повторения оценката е по-неточна.</p></div>` : ''}
      <div class="table-wrap" style="margin-top:18px"><table class="data"><thead><tr><th>Повторения</th><th>% от 1RM</th><th>Тежест</th></tr></thead><tbody>
      ${table.map((t) => `<tr style="cursor:default"><td>${t.reps}</td><td>${fmt(t.pct * 100)}%</td><td><b>${fmt(t.weight, 1)} kg</b></td></tr>`).join('')}
      </tbody></table></div>`;
  },
  initial('onerm'),
);
