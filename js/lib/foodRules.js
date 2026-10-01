/**
 * Правила за филтри и етикети "Подходящо за" в базата данни с храни.
 * Всички прагове са на 100 г и са описани тук, за да са прозрачни.
 */
import { KCAL_PER_G } from './calculations.js';

/** Дял на енергията от белтък (0–1). */
export function proteinEnergyShare(n) {
  return n.kcal > 0 ? (n.protein * KCAL_PER_G.protein) / n.kcal : 0;
}

export const FILTERS = Object.freeze({
  highProtein: {
    label: 'Високо съдържание на белтък',
    short: 'Много белтък',
    rule: '≥ 15 г белтък на 100 г или ≥ 30% от енергията от белтък',
    test: (n) => n.protein >= 15 || (n.protein >= 5 && proteinEnergyShare(n) >= 0.3),
  },
  lowCalorie: {
    label: 'Нискокалорично',
    short: 'Нискокалорично',
    rule: '≤ 100 kcal на 100 г',
    test: (n) => n.kcal <= 100,
  },
  lowCarb: {
    label: 'Малко въглехидрати',
    short: 'Малко въглехидрати',
    rule: '≤ 5 г въглехидрати на 100 г',
    test: (n) => n.carbs <= 5,
  },
  highCarb: {
    label: 'Много въглехидрати',
    short: 'Много въглехидрати',
    rule: '≥ 20 г въглехидрати на 100 г',
    test: (n) => n.carbs >= 20,
  },
  lowFat: {
    label: 'Малко мазнини',
    short: 'Малко мазнини',
    rule: '≤ 3 г мазнини на 100 г',
    test: (n) => n.fat <= 3,
  },
  highFiber: {
    label: 'Богато на фибри',
    short: 'Много фибри',
    rule: '≥ 6 г фибри на 100 г',
    test: (n) => (n.fiber ?? 0) >= 6,
  },
  lowGi: {
    label: 'Нисък ГИ',
    short: 'Нисък ГИ',
    rule: 'Измерен ГИ ≤ 55',
    test: (n, food) => food?.gi?.status === 'measured' && food.gi.value <= 55,
  },
  highGi: {
    label: 'Висок ГИ',
    short: 'Висок ГИ',
    rule: 'Измерен ГИ ≥ 70',
    test: (n, food) => food?.gi?.status === 'measured' && food.gi.value >= 70,
  },
});

/**
 * Етикети "Подходящо за". Показват се само когато хранителният профил
 * ги подкрепя. Това е ориентир, а не хранителен съвет.
 */
export const GOOD_FOR = Object.freeze({
  highProtein: {
    label: 'Високо съдържание на белтък',
    why: 'Поне 15 г белтък на 100 г или ≥ 30% от калориите от белтък.',
    test: (n) => FILTERS.highProtein.test(n),
  },
  lowCalorie: {
    label: 'Нискокалорично',
    why: 'До 100 kcal на 100 г — голям обем при малко калории.',
    test: (n) => n.kcal <= 100,
  },
  fatLoss: {
    label: 'Отслабване',
    why: 'Ниска енергийна плътност (≤ 150 kcal/100 г) и засищащ белтък (≥ 10 г) или фибри (≥ 2,5 г).',
    test: (n) => n.kcal <= 150 && (n.protein >= 10 || (n.fiber ?? 0) >= 2.5),
  },
  muscleGain: {
    label: 'Мускулна маса',
    why: 'Много белтък (≥ 20 г/100 г) или енергийно плътна храна с поне 10 г белтък.',
    test: (n) => n.protein >= 20 || (n.kcal >= 250 && n.protein >= 10),
  },
  preWorkout: {
    label: 'Преди тренировка',
    why: 'Поне 15 г въглехидрати с малко мазнини (≤ 5 г) и умерено фибри (≤ 4 г) — по-лесно за храносмилане.',
    test: (n) => n.carbs >= 15 && n.fat <= 5 && (n.fiber ?? 0) <= 4,
  },
  postWorkout: {
    label: 'След тренировка',
    why: 'Белтък ≥ 15 г с умерено мазнини (≤ 10 г) или лесни въглехидрати (≥ 20 г, ≤ 3 г мазнини).',
    test: (n) =>
      (n.protein >= 15 && n.fat <= 10) || (n.carbs >= 20 && n.fat <= 3 && (n.fiber ?? 0) <= 4),
  },
});

export function goodForLabels(food) {
  return Object.entries(GOOD_FOR)
    .filter(([, g]) => g.test(food.per100, food))
    .map(([key, g]) => ({ key, label: g.label, why: g.why }));
}

/** Стойности за порция (линейно мащабиране от 100 г). */
export function perServing(per100, grams) {
  const k = grams / 100;
  const out = {};
  for (const [key, v] of Object.entries(per100)) out[key] = v == null ? null : v * k;
  return out;
}

/** Нормализира текст за търсене: малки букви, без диакритика и пунктуация. */
export function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Частично търсене: всяка дума от заявката трябва да е начало/част от текста. */
export function matchesQuery(food, query) {
  const q = normalize(query);
  if (!q) return true;
  const hay = normalize(`${food.name} ${food.nameEn} ${food.aliases} ${food.categoryLabel}`);
  return q.split(' ').every((word) => hay.includes(word));
}

export function filterFoods(foods, { query = '', category = 'all', filters = [] } = {}) {
  return foods.filter(
    (f) =>
      (category === 'all' || f.category === category) &&
      matchesQuery(f, query) &&
      filters.every((k) => FILTERS[k]?.test(f.per100, f)),
  );
}

/** Сортиране; липсващите стойности (null) винаги отиват накрая. */
export function sortFoods(foods, key, dir = 'asc', getValue) {
  const get = getValue ?? ((f) => f.per100[key]);
  const mul = dir === 'desc' ? -1 : 1;
  return [...foods].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'string') return mul * va.localeCompare(vb, 'bg');
    return mul * (va - vb);
  });
}
