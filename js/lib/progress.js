/**
 * Логика за проследяване на прогреса (чисти функции) + безопасно локално хранилище.
 * Данните се пазят само в браузъра на потребителя (localStorage).
 */
export const STORE_KEY = 'fc-progress-v1';

export function emptyData() {
  return { weights: [], workouts: [], goals: { targetWeight: null, workoutsPerWeek: 3, steps: 8000 } };
}

export function loadData(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(STORE_KEY);
    if (!raw) return emptyData();
    return sanitize(JSON.parse(raw));
  } catch {
    return emptyData();
  }
}

export function saveData(data, storage = globalThis.localStorage) {
  try {
    storage?.setItem(STORE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Премахва невалидни записи (напр. от ръчно редактиран или повреден импорт). */
export function sanitize(d) {
  const out = emptyData();
  if (!d || typeof d !== 'object') return out;
  if (Array.isArray(d.weights)) {
    out.weights = d.weights
      .filter((w) => w && isDate(w.date) && Number.isFinite(w.kg) && w.kg >= 20 && w.kg <= 400)
      .map((w) => ({ date: w.date, kg: w.kg }));
  }
  if (Array.isArray(d.workouts)) {
    out.workouts = d.workouts
      .filter((w) => w && isDate(w.date) && typeof w.type === 'string' && Number.isFinite(w.minutes) && w.minutes > 0 && w.minutes <= 600)
      .map((w) => ({ id: String(w.id ?? `${w.date}-${Math.random().toString(36).slice(2, 8)}`), date: w.date, type: w.type, minutes: w.minutes, notes: String(w.notes ?? '').slice(0, 300) }));
  }
  if (d.goals && typeof d.goals === 'object') {
    const g = d.goals;
    out.goals.targetWeight = Number.isFinite(g.targetWeight) ? g.targetWeight : null;
    out.goals.workoutsPerWeek = Number.isFinite(g.workoutsPerWeek) ? g.workoutsPerWeek : 3;
    out.goals.steps = Number.isFinite(g.steps) ? g.steps : 8000;
  }
  return out;
}

/** Добавя/заменя измерване на тегло за дата (едно на ден), сортирано по дата. */
export function upsertWeight(weights, date, kg) {
  const next = weights.filter((w) => w.date !== date).concat({ date, kg });
  return next.sort((a, b) => a.date.localeCompare(b.date));
}

/** Плъзгаща се средна стойност за последните N измервания. */
export function movingAverage(weights, n = 7) {
  return weights.map((w, i) => {
    const slice = weights.slice(Math.max(0, i - n + 1), i + 1);
    return { date: w.date, kg: slice.reduce((a, b) => a + b.kg, 0) / slice.length };
  });
}

export function weightStats(weights) {
  if (!weights.length) return null;
  const first = weights[0];
  const last = weights[weights.length - 1];
  const days = (Date.parse(last.date) - Date.parse(first.date)) / 86400000;
  return {
    start: first.kg,
    current: last.kg,
    change: last.kg - first.kg,
    days,
    perWeek: days >= 7 ? ((last.kg - first.kg) / days) * 7 : null,
    min: Math.min(...weights.map((w) => w.kg)),
    max: Math.max(...weights.map((w) => w.kg)),
  };
}

/** Понеделник на седмицата за дадена дата (ISO седмица). */
export function weekStart(dateStr) {
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, day));
  const dow = (d.getUTCDay() + 6) % 7; // понеделник = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function workoutsThisWeek(workouts, todayStr) {
  const ws = weekStart(todayStr);
  return workouts.filter((w) => weekStart(w.date) === ws);
}

/** Прогрес към целево тегло (0–1) спрямо началното тегло. */
export function goalProgress(start, current, target) {
  if (target == null || start == null || current == null || start === target) return null;
  const p = (start - current) / (start - target);
  return Math.max(0, Math.min(1, p));
}

export function todayISO(d = new Date()) {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}
