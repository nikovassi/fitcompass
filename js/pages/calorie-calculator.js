import {
  calculateCaloriePlan,
  exerciseKcalPerDay,
  stepsKcal,
  kgToLb,
  lbToKg,
  cmToFtIn,
  ftInToCm,
  GOALS,
  WORK_ACTIVITY,
  TEF_RATE,
  KCAL_PER_STEP_PER_KG,
  MET,
  RUN_NET_KCAL_PER_KG_PER_KM,
} from '../lib/calculations.js';
import { validateBasics, validateActivity, validateTraining, validateGoal, validateProfile, toNumber } from '../lib/validation.js';
import { fmt, fmtG, fmtPct, fmtSigned } from '../lib/format.js';
import { donutChart } from '../lib/charts.js';
import { icon, hydrateIcons } from '../icons.js';
import { tip, initTips } from '../layout.js';

const STORAGE_KEY = 'fc-calorie-form';
const PLAN_KEY = 'fc-plan';

const form = document.getElementById('calc-form');
const panels = [...form.querySelectorAll('.step-panel')];
const stepperItems = [...document.querySelectorAll('#stepper li')];
const btnBack = document.getElementById('btn-back');
const btnNext = document.getElementById('btn-next');
const btnCalc = document.getElementById('btn-calc');
const btnReset = document.getElementById('btn-reset');
const resultsEl = document.getElementById('results');
const wizardEl = document.getElementById('wizard');
const formErrors = document.getElementById('form-errors');

let step = 0;
let maxReached = 0;
let units = 'metric';
const seg = { strengthIntensity: 'moderate', cardioIntensity: 'moderate' };

const VALIDATORS = [validateBasics, validateActivity, validateTraining, validateGoal];

// ---------------------------------------------------------------------------
// Четене и запис на формуляра
// ---------------------------------------------------------------------------
function readRaw() {
  const fd = new FormData(form);
  const raw = Object.fromEntries(fd.entries());
  raw.units = units;
  raw.strengthIntensity = seg.strengthIntensity;
  raw.cardioIntensity = seg.cardioIntensity;
  return raw;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readRaw(), step: maxReached }));
  } catch {
    /* без хранилище */
  }
}

function restore() {
  let data = null;
  try {
    data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    data = null;
  }
  if (!data) return;
  if (data.units === 'imperial') setUnits('imperial', false);
  for (const [k, v] of Object.entries(data)) {
    const els = form.querySelectorAll(`[name="${k}"]`);
    els.forEach((el) => {
      if (el.type === 'radio') el.checked = el.value === v;
      else el.value = v;
    });
  }
  for (const k of Object.keys(seg)) if (data[k]) setSeg(k, data[k]);
  syncAllRanges();
}

// ---------------------------------------------------------------------------
// Плъзгачи ↔ полета
// ---------------------------------------------------------------------------
function paintRange(r) {
  const pct = ((r.value - r.min) / (r.max - r.min)) * 100;
  r.style.setProperty('--fill', `${pct}%`);
}

function syncAllRanges() {
  form.querySelectorAll('input[type=range][data-sync]').forEach((r) => {
    const input = document.getElementById(r.dataset.sync);
    const n = toNumber(input.value);
    if (n !== null) r.value = Math.min(Math.max(n, r.min), r.max);
    paintRange(r);
  });
}

form.querySelectorAll('input[type=range][data-sync]').forEach((r) => {
  const input = document.getElementById(r.dataset.sync);
  r.addEventListener('input', () => {
    input.value = r.value;
    paintRange(r);
    clearFieldError(input.closest('[data-field]'));
    onChange();
  });
  input.addEventListener('input', () => {
    const n = toNumber(input.value);
    if (n !== null) {
      r.value = Math.min(Math.max(n, r.min), r.max);
      paintRange(r);
    }
  });
  paintRange(r);
});

form.querySelectorAll('[data-steps]').forEach((b) =>
  b.addEventListener('click', () => {
    document.getElementById('steps').value = b.dataset.steps;
    syncAllRanges();
    onChange();
  }),
);

// Сегментирани превключватели (интензивност)
function setSeg(key, value) {
  seg[key] = value;
  form.querySelectorAll(`[data-seg="${key}"] button`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === value)));
}
form.querySelectorAll('[data-seg]').forEach((g) =>
  g.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-value]');
    if (!b) return;
    setSeg(g.dataset.seg, b.dataset.value);
    onChange();
  }),
);

// ---------------------------------------------------------------------------
// Мерни единици
// ---------------------------------------------------------------------------
function setUnits(next, convert = true) {
  if (next === units) return;
  const f = (id) => document.getElementById(id);
  if (convert) {
    if (next === 'imperial') {
      const cm = toNumber(f('heightCm').value);
      const kg = toNumber(f('weightKg').value);
      if (cm) {
        const { feet, inches } = cmToFtIn(cm);
        f('heightFt').value = feet;
        f('heightIn').value = Math.round(inches);
      }
      if (kg) f('weightLb').value = Math.round(kgToLb(kg) * 10) / 10;
    } else {
      const ft = toNumber(f('heightFt').value);
      const inch = toNumber(f('heightIn').value) ?? 0;
      const lb = toNumber(f('weightLb').value);
      if (ft !== null) f('heightCm').value = Math.round(ftInToCm(ft, inch));
      if (lb) f('weightKg').value = Math.round(lbToKg(lb) * 10) / 10;
      syncAllRanges();
    }
  }
  units = next;
  form.querySelectorAll('[data-units]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.units === next)));
  form.querySelectorAll('.metric-only').forEach((el) => (el.hidden = next !== 'metric'));
  form.querySelectorAll('.imperial-only').forEach((el) => (el.hidden = next !== 'imperial'));
  clearErrors();
}
form.querySelectorAll('[data-units]').forEach((b) => b.addEventListener('click', () => (setUnits(b.dataset.units), save())));

// ---------------------------------------------------------------------------
// Грешки
// ---------------------------------------------------------------------------
function clearFieldError(fieldEl) {
  if (!fieldEl) return;
  fieldEl.classList.remove('has-error');
  const m = fieldEl.querySelector('.error-msg');
  if (m) m.textContent = '';
  fieldEl.querySelectorAll('input').forEach((i) => i.removeAttribute('aria-invalid'));
}

function clearErrors() {
  form.querySelectorAll('[data-field]').forEach(clearFieldError);
  formErrors.innerHTML = '';
}

function showErrors(errors) {
  clearErrors();
  let first = null;
  for (const [key, msg] of Object.entries(errors)) {
    const fieldEl = form.querySelector(`[data-field="${key}"]`);
    if (!fieldEl) continue;
    fieldEl.classList.add('has-error');
    const m = fieldEl.querySelector('.error-msg');
    if (m) m.innerHTML = `${icon('alert')}<span>${msg}</span>`;
    const input = fieldEl.querySelector('input:not([type=range]):not([hidden])');
    input?.setAttribute('aria-invalid', 'true');
    if (!first) first = fieldEl;
  }
  if (first) {
    const focusable = first.querySelector('input:not([type=range])');
    first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => focusable?.focus({ preventScroll: true }), 250);
  }
}

form.addEventListener('input', (e) => {
  clearFieldError(e.target.closest('[data-field]'));
  onChange();
});
form.addEventListener('change', (e) => {
  clearFieldError(e.target.closest('[data-field]'));
  onChange();
});

// ---------------------------------------------------------------------------
// Навигация между стъпките
// ---------------------------------------------------------------------------
function goTo(i) {
  step = Math.max(0, Math.min(panels.length - 1, i));
  maxReached = Math.max(maxReached, step);
  panels.forEach((p, idx) => (p.hidden = idx !== step));
  stepperItems.forEach((li, idx) => {
    li.classList.toggle('current', idx === step);
    li.classList.toggle('done', idx < step);
    const b = li.querySelector('button');
    b.disabled = idx > maxReached;
    if (idx === step) b.setAttribute('aria-current', 'step');
    else b.removeAttribute('aria-current');
  });
  btnBack.hidden = step === 0;
  btnNext.hidden = step === panels.length - 1;
  btnCalc.hidden = step !== panels.length - 1;
  clearErrors();
  updateLive();
  const top = wizardEl.getBoundingClientRect().top + window.scrollY - 90;
  if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
}

function validateStep(i) {
  const r = VALIDATORS[i](readRaw());
  if (!r.valid) showErrors(r.errors);
  return r.valid;
}

btnNext.addEventListener('click', () => {
  if (validateStep(step)) goTo(step + 1);
});
btnBack.addEventListener('click', () => goTo(step - 1));
stepperItems.forEach((li, idx) =>
  li.querySelector('button').addEventListener('click', () => {
    if (idx <= step) return goTo(idx);
    // напред — само ако всички предишни стъпки са валидни
    for (let s = step; s < idx; s++) {
      if (!validateStep(s)) return goTo(s);
    }
    goTo(idx);
  }),
);

btnReset.addEventListener('click', () => {
  form.reset();
  setSeg('strengthIntensity', 'moderate');
  setSeg('cardioIntensity', 'moderate');
  setUnits('metric', false);
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* */
  }
  maxReached = 0;
  resultsEl.hidden = true;
  resultsEl.innerHTML = '';
  wizardEl.hidden = false;
  syncAllRanges();
  goTo(0);
});

// ---------------------------------------------------------------------------
// Живи оценки в стъпки 2 и 3
// ---------------------------------------------------------------------------
function currentWeight() {
  const b = validateBasics(readRaw());
  return b.values.weightKg ?? null;
}

function updateLive() {
  const w = currentWeight();
  const liveSteps = document.getElementById('live-steps');
  const liveTraining = document.getElementById('live-training');
  const raw = readRaw();
  if (w && step === 1) {
    const s = toNumber(raw.steps) ?? 0;
    liveSteps.hidden = false;
    liveSteps.innerHTML = `${icon('footprints')}<span>${fmt(s)} крачки ≈ ${fmt(stepsKcal(Math.max(0, s), w))} kcal на ден над нивото на покой</span>`;
  } else liveSteps.hidden = true;
  if (w && step === 2) {
    const t = validateTraining(raw);
    const ex = exerciseKcalPerDay({ ...t.values }, w);
    liveTraining.hidden = false;
    liveTraining.innerHTML = `${icon('flame')}<span>Тренировките добавят средно ≈ ${fmt(ex.total)} kcal на ден (${fmt(ex.total * 7)} kcal седмично)</span>`;
  } else liveTraining.hidden = true;
}

function onChange() {
  updateLive();
  save();
}

// ---------------------------------------------------------------------------
// Изчисление и резултати
// ---------------------------------------------------------------------------
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const r = validateProfile(readRaw());
  if (!r.valid) {
    // отиди до първата стъпка с грешка
    for (let s = 0; s < VALIDATORS.length; s++) {
      const sr = VALIDATORS[s](readRaw());
      if (!sr.valid) {
        goTo(s);
        showErrors(sr.errors);
        formErrors.innerHTML = `<div class="notice notice-warn">${icon('alert')}<p>Моля, коригирайте маркираните полета.</p></div>`;
        return;
      }
    }
    return;
  }
  const plan = calculateCaloriePlan(r.values);
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify({ date: new Date().toISOString(), target: plan.target, tdee: plan.tdee, goal: plan.goal, goalLabel: plan.goalLabel, protein: plan.macros.grams.protein, carbs: plan.macros.grams.carbs, fat: plan.macros.grams.fat, weightKg: r.values.weightKg }));
  } catch {
    /* */
  }
  renderResults(plan, r.values);
});

const COLORS = { protein: 'var(--protein)', carbs: 'var(--carbs)', fat: 'var(--fat)' };
const MACRO_LABELS = { protein: 'Белтъчини', carbs: 'Въглехидрати', fat: 'Мазнини' };

function countUp(el, to, duration = 900) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    el.textContent = fmt(to);
    return;
  }
  const t0 = performance.now();
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / duration);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(to * e);
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function goalSection(plan, v) {
  const g = plan.goal;
  const m = plan.macros.grams;
  const [pLo, pHi] = plan.proteinRange;
  const wk = plan.weeklyChange;
  const pctBw = (x) => fmt((Math.abs(x) / v.weightKg) * 100, 1);
  const kv = (label, value) => `<div class="kv-item"><span>${label}</span><b>${value}</b></div>`;
  let title;
  let items;
  let text;
  if (g === 'lose') {
    title = 'План за отслабване';
    items = [
      kv('Калорийна цел', `${fmt(plan.target)} kcal`),
      kv('Дефицит', `${fmt(Math.abs(plan.adjust))} kcal/ден`),
      kv('Белтъчини', `${fmt(pLo)}–${fmt(pHi)} г`),
      kv('Очаквана промяна', `${fmt(Math.abs(wk.high), 2)}–${fmt(Math.abs(wk.low), 2)} kg/седм.`),
    ];
    text = `При дефицит от ${fmt(Math.abs(plan.adjust))} kcal на ден теоретичната загуба е около ${fmt(Math.abs(wk.mid), 2)} kg седмично (≈ ${pctBw(wk.mid)}% от телесното тегло). Показваме диапазон, защото водата, гликогенът и адаптацията на организма карат реалното тегло да се колебае. През първите 1–2 седмици спадът често е по-голям заради вода. Високият белтък и силовите тренировки помагат да се запази мускулната маса.${plan.floored ? ' <b>Целта е ограничена до безопасен минимум</b>, затова дефицитът е по-малък от стандартния.' : ''}`;
  } else if (g === 'muscle' || g === 'gain') {
    title = g === 'muscle' ? 'План за мускулна маса' : 'План за качване на тегло';
    items = [
      kv('Калорийна цел', `${fmt(plan.target)} kcal`),
      kv('Излишък', `+${fmt(plan.adjust)} kcal/ден`),
      kv('Белтъчини', `${fmt(pLo)}–${fmt(pHi)} г`),
      kv('Въглехидрати', `${fmt(m.carbs)} г`),
    ];
    text =
      g === 'muscle'
        ? `Малкият излишък (${fmt(plan.adjust)} kcal) подкрепя изграждането на мускули с минимално натрупване на мазнини. Реалистично за повечето трениращи е покачване около ${fmt(wk.low, 2)}–${fmt(wk.high, 2)} kg седмично, като напредващите растат по-бавно от начинаещите. Ако теглото не се променя 2–3 седмици, добавете 100–150 kcal.`
        : `Излишъкът от ${fmt(plan.adjust)} kcal е подходящ, ако качването на тегло е трудно. Очаквайте около ${fmt(wk.low, 2)}–${fmt(wk.high, 2)} kg седмично — част от това е вода и гликоген, а не само тъкан. Съчетайте с тренировки, за да е повече от покачването мускулна маса.`;
  } else if (g === 'performance') {
    title = 'План за спортни постижения';
    items = [
      kv('Калорийна цел', `${fmt(plan.target)} kcal`),
      kv('Въглехидрати', `${fmt(m.carbs)} г (${fmt(m.carbs / v.weightKg, 1)} г/kg)`),
      kv('Белтъчини', `${fmt(pLo)}–${fmt(pHi)} г`),
      kv('Мазнини', `${fmt(m.fat)} г`),
    ];
    text = `Лекият излишък предпазва от недостиг на енергия при тежки тренировъчни седмици. Въглехидратите са основното гориво при интензивна работа — при голям обем издръжливост нуждите могат да достигнат 6–10 г/kg, затова ги увеличавайте в дните с повече натоварване.`;
  } else {
    title = 'План за поддържане';
    items = [
      kv('Поддържащи калории', `${fmt(plan.target)} kcal`),
      kv('Белтъчини', `${fmt(m.protein)} г`),
      kv('Въглехидрати', `${fmt(m.carbs)} г`),
      kv('Мазнини', `${fmt(m.fat)} г`),
    ];
    text = `Това е оценката за приема, при който теглото ти остава стабилно. Следи теглото 2–3 седмици: ако средната стойност се променя с повече от ~0,5 kg, коригирай с 100–200 kcal.`;
  }
  return `<div class="goal-panel reveal in">
    <div class="row"><span class="icon-tile" style="margin:0" data-icon="target"></span><div><span class="eyebrow" style="margin:0">Твоята цел: ${plan.goalLabel}</span><h3 style="margin:0">${title}</h3></div></div>
    <div class="kv">${items.join('')}</div>
    <p class="muted" style="margin:0">${text}</p>
  </div>`;
}

function renderResults(plan, v) {
  const m = plan.macros;
  const ex = plan.exercise;
  const tdeeParts = [
    { key: 'bmr', label: 'Базов метаболизъм (BMR)', value: plan.bmr, color: 'var(--primary)' },
    { key: 'work', label: 'Работа и битова активност', value: plan.work, color: 'color-mix(in srgb, var(--primary) 55%, var(--carbs))' },
    { key: 'steps', label: 'Ходене (крачки)', value: plan.steps, color: 'var(--carbs)' },
    { key: 'exercise', label: 'Тренировки', value: ex.total, color: 'var(--accent)' },
    { key: 'tef', label: 'Смилане на храната (TEF)', value: plan.tef, color: 'var(--protein)' },
  ];

  const statCard = (label, value, unit, desc, tipText, cls = '', dot = '') =>
    `<div class="stat ${cls}"><div class="s-label">${dot ? `<span class="dot" style="background:${dot}"></span>` : ''}${label} ${tip(tipText)}</div><div class="s-value">${value}<small>${unit}</small></div><div class="s-desc">${desc}</div></div>`;

  resultsEl.innerHTML = `
    <div class="result-hero">
      <div>
        <span class="eyebrow">${icon('flame')} Твоите изчислени дневни калории</span>
        <div class="big-number"><span id="kcal-count">0</span><small>kcal/ден</small></div>
        <p class="range-line">Препоръчителен прием за цел „${plan.goalLabel}“. Поддържащи калории: <b>${fmt(plan.tdee)}</b> kcal (вероятен диапазон ${fmt(plan.tdeeRange.low)}–${fmt(plan.tdeeRange.high)}).</p>
        <div class="row no-print" style="margin-top:18px">
          <button type="button" class="btn btn-primary" id="btn-edit">${icon('arrowLeft')}Промени данните</button>
          <button type="button" class="btn" id="btn-recalc">${icon('refresh')}Изчисли отново</button>
          <a class="btn btn-ghost" href="food-database.html">${icon('database')}Към базата с храни</a>
        </div>
      </div>
      <div class="card" style="padding:20px">
        <div class="s-label" style="font-weight:800;font-size:.85rem;margin-bottom:10px">От какво се формира дневният ти разход (${fmt(plan.tdee)} kcal)</div>
        <div class="stackbar" id="stackbar">${tdeeParts.map((p) => `<span data-w="${(p.value / plan.tdee) * 100}" style="background:${p.color}" title="${p.label}: ${fmt(p.value)} kcal"></span>`).join('')}</div>
        <div class="legend">${tdeeParts
          .map((p) => `<div class="legend-row"><span class="swatch" style="background:${p.color}"></span><span>${p.label}</span><b>${fmt(p.value)} kcal</b></div>`)
          .join('')}</div>
      </div>
    </div>

    <h2 style="margin-top:44px">Основни показатели</h2>
    <div class="stat-grid">
      ${statCard('BMR', fmt(plan.bmr), 'kcal', 'Енергия за основните функции в пълен покой.', 'Базов метаболизъм по уравнението Mifflin-St Jeor — колко калории изгаря тялото, ако лежиш цял ден.')}
      ${statCard('TDEE', fmt(plan.tdee), 'kcal', `Общ дневен разход (${fmt(plan.activityMultiplier, 2)} × BMR). При този прием теглото остава стабилно.`, 'Total Daily Energy Expenditure — BMR + работа + ходене + тренировки + смилане на храната.')}
      ${statCard('Калорийна цел', fmt(plan.target), 'kcal', plan.adjust === 0 ? 'Равна на поддържащите калории.' : `${fmtSigned(plan.adjust)} kcal спрямо TDEE.`, 'Препоръчителният дневен прием за избраната цел.', 'highlight')}
      ${statCard('Белтъчини', fmtG(m.grams.protein), 'г', `${fmt(m.grams.protein / v.weightKg, 1)} г/kg · ${fmt(m.kcal.protein)} kcal`, 'Белтъкът поддържа и изгражда мускулна маса и засища. При BMI над 30 го изчисляваме спрямо тегло при BMI 27.', '', COLORS.protein)}
      ${statCard('Въглехидрати', fmtG(m.grams.carbs), 'г', `${fmt(m.grams.carbs / v.weightKg, 1)} г/kg · ${fmt(m.kcal.carbs)} kcal`, 'Основното гориво за интензивни тренировки. Получават останалите калории след белтъка и мазнините.', '', COLORS.carbs)}
      ${statCard('Мазнини', fmtG(m.grams.fat), 'г', `${fmt(m.grams.fat / v.weightKg, 1)} г/kg · ${fmt(m.kcal.fat)} kcal`, 'Нужни за хормоните и усвояването на мастноразтворимите витамини. Минимум 0,6 г/kg.', '', COLORS.fat)}
    </div>

    <div class="card card-lg" style="margin-top:28px">
      <div class="row" style="justify-content:space-between;margin-bottom:18px">
        <div><h2 style="margin:0">Разпределение на макронутриентите</h2><p class="muted" style="margin:0">Докосни сегмент или ред за детайли.</p></div>
        <div class="segmented" role="group" aria-label="Показване" id="macro-view">
          <button type="button" data-view="pct" aria-pressed="true">%</button>
          <button type="button" data-view="g" aria-pressed="false">Грамове</button>
          <button type="button" data-view="kcal" aria-pressed="false">kcal</button>
        </div>
      </div>
      <div class="donut-wrap">
        <div class="donut" id="macro-donut"></div>
        <div class="macro-rows" id="macro-rows">
          ${['protein', 'carbs', 'fat']
            .map(
              (k) => `<button type="button" class="macro-row" data-key="${k}" style="--c:${COLORS[k]}">
                <span class="m-ico">${fmtPct(m.pct[k])}</span>
                <span><span class="m-top"><span>${MACRO_LABELS[k]}</span><span>${fmtG(m.grams[k])} г</span></span>
                <span class="m-sub"><span>${fmtPct(m.pct[k])} от калориите</span><span>${fmt(m.kcal[k])} kcal</span><span>${fmt(m.grams[k] / v.weightKg, 1)} г/kg</span></span>
                <span class="m-bar"><i data-w="${m.pct[k] * 100}"></i></span></span>
              </button>`,
            )
            .join('')}
        </div>
      </div>
    </div>

    <div style="margin-top:28px">${goalSection(plan, v)}</div>

    <div class="grid grid-2" style="margin-top:28px">
      <div class="card">
        <h3>${icon('info')} Какво означават числата</h3>
        <ul class="small" style="padding-left:1.1em;margin:0;color:var(--text-2)">
          <li><b>BMR</b> — минималната енергия за дишане, кръвообращение и работа на органите.</li>
          <li><b>TDEE</b> — общият разход за денонощие. Това са твоите „поддържащи“ калории.</li>
          <li><b>Калорийна цел</b> — TDEE, коригиран според целта (дефицит или излишък).</li>
          <li><b>Макроси</b> — как целта се разпределя между белтъчини, въглехидрати и мазнини (1 г белтък или въглехидрати = 4 kcal, 1 г мазнини = 9 kcal).</li>
        </ul>
      </div>
      <div class="card">
        <h3>${icon('alert')} Важно</h3>
        <p class="small muted">Резултатите са <b>оценки</b> на базата на научно валидирани уравнения, а не медицински съвет. Реалният разход на отделния човек може да се различава с ±10% или повече. Използвай числата като отправна точка и ги коригирай според промяната на теглото за 2–3 седмици.</p>
        <p class="small muted" style="margin:0">При бременност, кърмене, хронични заболявания, хранителни разстройства или под 18 години се консултирай с лекар или регистриран диетолог.</p>
      </div>
    </div>

    <details class="card" style="margin-top:20px">
      <summary style="cursor:pointer;font-weight:800">Как изчислихме твоите числа</summary>
      <div class="small" style="margin-top:14px;color:var(--text-2)">
        <p><b>1. BMR (Mifflin-St Jeor):</b> 10 × ${fmt(v.weightKg, 1)} kg + 6,25 × ${fmt(v.heightCm, 1)} cm − 5 × ${v.age} г. ${v.sex === 'female' ? '− 161' : '+ 5'} = <b>${fmt(plan.bmr)} kcal</b></p>
        <p><b>2. Работа:</b> ${fmt(WORK_ACTIVITY[v.workActivity].factor * 100)}% от BMR за „${WORK_ACTIVITY[v.workActivity].label.toLowerCase()}“ = ${fmt(plan.work)} kcal</p>
        <p><b>3. Крачки:</b> ${fmt(v.steps)} × ${fmt(v.weightKg, 1)} kg × ${String(KCAL_PER_STEP_PER_KG).replace('.', ',')} = ${fmt(plan.steps)} kcal</p>
        <p><b>4. Тренировки</b> (нетни kcal = (MET − 1) × kg × часове, осреднени на 7 дни): силови ${fmt(ex.strength)} + кардио ${fmt(ex.cardio)} + бягане ${fmt(ex.running)} = ${fmt(ex.total)} kcal/ден. MET: силови ${MET.strength[v.strengthIntensity]}, кардио ${MET.cardio[v.cardioIntensity]}; бягане ${String(RUN_NET_KCAL_PER_KG_PER_KM).replace('.', ',')} kcal/kg/km.</p>
        <p><b>5. Смилане на храната (TEF):</b> ${fmt(TEF_RATE * 100)}% от сумата = ${fmt(plan.tef)} kcal</p>
        <p><b>TDEE</b> = ${fmt(plan.tdee)} kcal · <b>Цел</b> = TDEE ${fmtSigned(plan.adjust)} kcal = ${fmt(plan.target)} kcal</p>
        <p><b>Макроси:</b> белтък ${fmt(GOALS[v.goal].proteinPerKg, 1)} г/kg${plan.bmi > 30 ? ` (референтно тегло ${fmt(m.proteinReferenceWeight, 1)} kg при BMI 27)` : ''}, мазнини ${fmt(GOALS[v.goal].fatPct * 100)}% от калориите (мин. 0,6 г/kg), въглехидрати — останалото.</p>
        <p style="margin:0">Източници: Mifflin et al., Am J Clin Nutr 1990; Ainsworth et al., Compendium of Physical Activities 2011; Jäger et al., ISSN Position Stand: Protein and Exercise 2017.</p>
      </div>
    </details>
  `;

  wizardEl.hidden = true;
  resultsEl.hidden = false;
  hydrateIcons(resultsEl);
  initTips(resultsEl);
  resultsEl.focus({ preventScroll: true });
  window.scrollTo({ top: resultsEl.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });

  countUp(document.getElementById('kcal-count'), Math.round(plan.target));
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      resultsEl.querySelectorAll('[data-w]').forEach((el) => (el.style.width = `${el.dataset.w}%`));
    }),
  );

  // Кръгова диаграма с превключване %/г/kcal
  let view = 'pct';
  const seg3 = ['protein', 'carbs', 'fat'].map((k) => ({ key: k, label: MACRO_LABELS[k], value: m.kcal[k], color: COLORS[k] }));
  const centerFor = (s) => {
    if (!s) {
      if (view === 'g') return `<div><b>${fmt(m.grams.protein + m.grams.carbs + m.grams.fat)}</b><span>грама общо</span></div>`;
      return `<div><b>${fmt(plan.target)}</b><span>kcal на ден</span></div>`;
    }
    const k = s.key;
    const val = view === 'pct' ? fmtPct(m.pct[k]) : view === 'g' ? `${fmtG(m.grams[k])} г` : `${fmt(m.kcal[k])}`;
    const sub = view === 'kcal' ? `kcal · ${s.label}` : s.label;
    return `<div><b style="color:${s.color}">${val}</b><span>${sub}</span></div>`;
  };
  const rows = resultsEl.querySelectorAll('.macro-row');
  const chart = donutChart(document.getElementById('macro-donut'), seg3, {
    center: centerFor,
    onActivate: (k) => rows.forEach((r) => r.classList.toggle('active', r.dataset.key === k)),
  });
  let active = null;
  rows.forEach((r) =>
    r.addEventListener('click', () => {
      active = active === r.dataset.key ? null : r.dataset.key;
      chart.activate(active);
      rows.forEach((x) => x.classList.toggle('active', x.dataset.key === active));
    }),
  );
  resultsEl.querySelector('#macro-view').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-view]');
    if (!b) return;
    view = b.dataset.view;
    resultsEl.querySelectorAll('#macro-view button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    rows.forEach((r) => {
      const k = r.dataset.key;
      r.querySelector('.m-ico').textContent = view === 'pct' ? fmtPct(m.pct[k]) : view === 'g' ? fmtG(m.grams[k]) : fmt(m.kcal[k]);
    });
    chart.activate(active);
  });

  const backToForm = (toStep) => {
    resultsEl.hidden = true;
    wizardEl.hidden = false;
    goTo(toStep);
    wizardEl.scrollIntoView({ behavior: 'smooth' });
  };
  document.getElementById('btn-edit').addEventListener('click', () => backToForm(3));
  document.getElementById('btn-recalc').addEventListener('click', () => backToForm(0));
}

// ---------------------------------------------------------------------------
restore();
goTo(0);
