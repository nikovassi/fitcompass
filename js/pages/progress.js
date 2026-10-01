import { loadData, saveData, sanitize, upsertWeight, weightStats, workoutsThisWeek, goalProgress, todayISO, emptyData } from '../lib/progress.js';
import { toNumber } from '../lib/validation.js';
import { lineChart } from '../lib/charts.js';
import { fmt, fmtSigned, escapeHtml } from '../lib/format.js';
import { icon, hydrateIcons } from '../icons.js';

const $ = (id) => document.getElementById(id);
let data = loadData();
let plan = null;
try {
  plan = JSON.parse(localStorage.getItem('fc-plan') || 'null');
} catch {
  plan = null;
}
const df = new Intl.DateTimeFormat('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtDate = (s) => df.format(new Date(`${s}T12:00:00`));

function persist() {
  if (!saveData(data)) $('data-msg').textContent = 'Браузърът не позволява запис — данните ще се загубят при затваряне на страницата.';
  render();
}

function render() {
  const ws = weightStats(data.weights);
  const week = workoutsThisWeek(data.workouts, todayISO());
  const g = data.goals;
  const stat = (label, value, unit, desc) => `<div class="stat"><div class="s-label">${label}</div><div class="s-value">${value}<small>${unit}</small></div><div class="s-desc">${desc}</div></div>`;
  $('summary').innerHTML = [
    stat('Текущо тегло', ws ? fmt(ws.current, 1) : '—', 'kg', ws ? `Начало: ${fmt(ws.start, 1)} kg` : 'Добави първото измерване'),
    stat('Промяна', ws ? fmtSigned(ws.change, 1) : '—', 'kg', ws?.perWeek != null ? `${fmtSigned(ws.perWeek, 2)} kg/седмица средно` : 'Нужни са поне 7 дни данни'),
    stat('Тренировки тази седмица', `${week.length}`, `/ ${g.workoutsPerWeek}`, `${fmt(week.reduce((a, w) => a + w.minutes, 0))} минути общо`),
    stat('Калорийна цел', plan ? fmt(plan.target) : '—', 'kcal', plan ? `${escapeHtml(plan.goalLabel)} · <a href="calorie-calculator.html">преизчисли</a>` : '<a href="calorie-calculator.html">Изчисли в калкулатора →</a>'),
  ].join('');

  lineChart(
    $('w-chart'),
    data.weights.map((w) => ({ x: new Date(`${w.date}T12:00:00`), y: w.kg })),
    { goal: g.targetWeight, unit: 'kg' },
  );
  $('w-list').innerHTML = [...data.weights]
    .reverse()
    .map((w, i, arr) => {
      const prev = arr[i + 1];
      const d = prev ? w.kg - prev.kg : null;
      return `<li><span style="flex:1">${fmtDate(w.date)}</span><b>${fmt(w.kg, 1)} kg</b>${d != null ? `<span class="badge ${d < 0 ? 'badge-primary' : d > 0 ? 'badge-accent' : ''}">${fmtSigned(d, 1)}</span>` : ''}<button class="icon-btn" style="width:32px;height:32px" data-del-w="${w.date}" aria-label="Изтрий измерването от ${fmtDate(w.date)}">${icon('trash')}</button></li>`;
    })
    .join('');

  const ws2 = [...data.workouts].sort((a, b) => b.date.localeCompare(a.date));
  $('t-list').innerHTML = ws2.length
    ? ws2
        .map(
          (w) => `<li><span class="icon-tile" style="width:36px;height:36px;margin:0">${icon(w.type === 'Силова' ? 'dumbbell' : w.type === 'Бягане' ? 'run' : 'activity')}</span><span style="flex:1"><b>${escapeHtml(w.type)}</b> · ${fmt(w.minutes)} мин<br><span class="small muted">${fmtDate(w.date)}${w.notes ? ` — ${escapeHtml(w.notes)}` : ''}</span></span><button class="icon-btn" style="width:32px;height:32px" data-del-t="${w.id}" aria-label="Изтрий тренировката">${icon('trash')}</button></li>`,
        )
        .join('')
    : '<li class="muted">Все още няма записани тренировки.</li>';

  $('g-weight').value = g.targetWeight ?? '';
  $('g-workouts').value = g.workoutsPerWeek ?? '';
  $('g-steps').value = g.steps ?? '';
  const wp = ws ? goalProgress(ws.start, ws.current, g.targetWeight) : null;
  const wkp = g.workoutsPerWeek ? Math.min(1, week.length / g.workoutsPerWeek) : 0;
  $('g-view').innerHTML = `
    <div><div class="row" style="justify-content:space-between"><b>Целево тегло</b><span class="muted small">${g.targetWeight != null && ws ? `${fmt(Math.abs(ws.current - g.targetWeight), 1)} kg до целта` : 'задай цел и добави тегло'}</span></div>
      <div class="progress-bar" style="margin-top:8px"><i style="width:${(wp ?? 0) * 100}%"></i></div></div>
    <div><div class="row" style="justify-content:space-between"><b>Тренировки тази седмица</b><span class="muted small">${week.length} от ${g.workoutsPerWeek}</span></div>
      <div class="progress-bar" style="margin-top:8px"><i style="width:${wkp * 100}%;background:var(--accent)"></i></div></div>`;
  hydrateIcons();
}

// Тегло
$('w-date').value = todayISO();
$('w-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const kg = toNumber($('w-kg').value);
  const date = $('w-date').value;
  const err = $('w-err');
  if (!date) return (err.innerHTML = `${icon('alert')}Изберете дата.`), (err.style.display = 'flex');
  if (kg == null || kg < 20 || kg > 400) return (err.innerHTML = `${icon('alert')}Въведете тегло между 20 и 400 kg.`), (err.style.display = 'flex');
  if (date > todayISO()) return (err.innerHTML = `${icon('alert')}Датата не може да е в бъдещето.`), (err.style.display = 'flex');
  err.style.display = 'none';
  data.weights = upsertWeight(data.weights, date, kg);
  $('w-kg').value = '';
  persist();
});
$('w-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-del-w]');
  if (!b) return;
  data.weights = data.weights.filter((w) => w.date !== b.dataset.delW);
  persist();
});

// Тренировки
$('t-date').value = todayISO();
$('t-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const min = toNumber($('t-min').value);
  const err = $('t-err');
  if (!$('t-date').value) return (err.innerHTML = `${icon('alert')}Изберете дата.`), (err.style.display = 'flex');
  if (min == null || min <= 0 || min > 600) return (err.innerHTML = `${icon('alert')}Въведете продължителност между 1 и 600 минути.`), (err.style.display = 'flex');
  err.style.display = 'none';
  data.workouts.push({ id: `${Date.now()}`, date: $('t-date').value, type: $('t-type').value, minutes: Math.round(min), notes: $('t-notes').value.trim().slice(0, 300) });
  $('t-min').value = '';
  $('t-notes').value = '';
  persist();
});
$('t-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-del-t]');
  if (!b) return;
  data.workouts = data.workouts.filter((w) => w.id !== b.dataset.delT);
  persist();
});

// Цели
$('g-form').addEventListener('change', () => {
  const tw = $('g-weight').value.trim() ? toNumber($('g-weight').value) : null;
  const wk = toNumber($('g-workouts').value);
  const st = toNumber($('g-steps').value);
  const err = $('g-err');
  if ((tw != null && (tw < 30 || tw > 300)) || ($('g-weight').value.trim() && tw == null)) return (err.innerHTML = `${icon('alert')}Целевото тегло трябва да е между 30 и 300 kg.`), (err.style.display = 'flex');
  if (wk == null || wk < 0 || wk > 14) return (err.innerHTML = `${icon('alert')}Тренировките седмично: между 0 и 14.`), (err.style.display = 'flex');
  if (st == null || st < 0 || st > 50000) return (err.innerHTML = `${icon('alert')}Крачки: между 0 и 50 000.`), (err.style.display = 'flex');
  err.style.display = 'none';
  data.goals = { targetWeight: tw, workoutsPerWeek: Math.round(wk), steps: Math.round(st) };
  persist();
});

// Резервно копие
$('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fitcompass-progress-${todayISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('import').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const parsed = sanitize(JSON.parse(await file.text()));
    data = parsed;
    persist();
    $('data-msg').textContent = `Възстановени: ${parsed.weights.length} измервания и ${parsed.workouts.length} тренировки.`;
  } catch {
    $('data-msg').textContent = 'Файлът не може да бъде прочетен. Използвай резервно копие, изтеглено от тази страница.';
  }
  e.target.value = '';
});
let clearArmed = false;
$('clear').addEventListener('click', () => {
  if (!clearArmed) {
    clearArmed = true;
    $('clear').textContent = 'Натисни отново, за да изтриеш';
    setTimeout(() => {
      clearArmed = false;
      $('clear').textContent = 'Изтрий всички данни';
    }, 4000);
    return;
  }
  data = emptyData();
  clearArmed = false;
  $('clear').textContent = 'Изтрий всички данни';
  persist();
  $('data-msg').textContent = 'Всички данни са изтрити.';
});

render();
