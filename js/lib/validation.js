/**
 * Валидация на входните данни за калкулаторите.
 * Приема сурови стойности (низове от формуляри или числа) и връща
 * нормализирани стойности в kg/cm + речник с грешки на български.
 */
import { lbToKg, ftInToCm } from './calculations.js';

export const LIMITS = Object.freeze({
  age: { min: 16, max: 100 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 35, max: 300 },
  steps: { min: 0, max: 50000 },
  sessions: { min: 0, max: 14 },
  minutes: { min: 0, max: 300 },
  runningKm: { min: 0, max: 250 },
  bodyFatPct: { min: 3, max: 60 },
});

const SEXES = ['male', 'female'];
const WORK = ['sedentary', 'standing', 'physical', 'heavy'];
const INTENSITY = ['light', 'moderate', 'vigorous'];
const GOAL_KEYS = ['lose', 'maintain', 'gain', 'muscle', 'performance'];

/**
 * Превръща стойност в крайно число. Празни низове, null, NaN, Infinity → null.
 * Приема и запетая като десетичен знак ("72,5").
 */
export function toNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = String(value).trim().replace(',', '.');
  if (s === '') return null;
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function checkRange(errors, key, value, { min, max }, label, unit = '') {
  if (value === null) {
    errors[key] = `Въведете ${label}.`;
    return false;
  }
  if (value < 0) {
    errors[key] = `${capitalize(label)} не може да е отрицателна стойност.`;
    return false;
  }
  if (value < min || value > max) {
    errors[key] = `${capitalize(label)} трябва да е между ${min} и ${max}${unit ? ' ' + unit : ''}.`;
    return false;
  }
  return true;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Валидира основните антропометрични данни (стъпка 1). */
export function validateBasics(raw) {
  const errors = {};
  const values = {};
  const units = raw.units === 'imperial' ? 'imperial' : 'metric';

  if (!SEXES.includes(raw.sex)) errors.sex = 'Изберете пол.';
  else values.sex = raw.sex;

  const age = toNumber(raw.age);
  if (age !== null && !Number.isInteger(age)) {
    errors.age = 'Възрастта трябва да е цяло число.';
  } else if (checkRange(errors, 'age', age, LIMITS.age, 'възраст', 'години')) {
    values.age = age;
  }

  let heightCm = null;
  if (units === 'imperial') {
    const ft = toNumber(raw.heightFt);
    const inch = toNumber(raw.heightIn) ?? 0;
    if (ft === null) errors.heightCm = 'Въведете ръст.';
    else if (ft < 0 || inch < 0) errors.heightCm = 'Ръстът не може да е отрицателен.';
    else if (inch >= 12) errors.heightCm = 'Инчовете трябва да са между 0 и 11.9.';
    else heightCm = ftInToCm(ft, inch);
  } else {
    heightCm = toNumber(raw.heightCm);
  }
  if (!errors.heightCm && checkRange(errors, 'heightCm', heightCm, LIMITS.heightCm, 'ръст', 'cm')) {
    values.heightCm = heightCm;
  }

  let weightKg = toNumber(units === 'imperial' ? raw.weightLb : raw.weightKg);
  if (units === 'imperial' && weightKg !== null) weightKg = lbToKg(weightKg);
  if (checkRange(errors, 'weightKg', weightKg, LIMITS.weightKg, 'тегло', 'kg')) {
    values.weightKg = weightKg;
  }

  return { valid: Object.keys(errors).length === 0, errors, values };
}

/** Валидира дневната активност (стъпка 2). */
export function validateActivity(raw) {
  const errors = {};
  const values = {};
  if (!WORK.includes(raw.workActivity)) errors.workActivity = 'Изберете тип работа.';
  else values.workActivity = raw.workActivity;

  const steps = toNumber(raw.steps);
  if (steps === null) values.steps = 0; // крачките са по избор — 0 означава "без данни"
  else if (checkRange(errors, 'steps', steps, LIMITS.steps, 'броят крачки')) values.steps = Math.round(steps);
  return { valid: Object.keys(errors).length === 0, errors, values };
}

/** Валидира тренировките (стъпка 3). Празни полета = 0. */
export function validateTraining(raw) {
  const errors = {};
  const values = {};
  const fields = [
    ['strengthSessions', LIMITS.sessions, 'броят силови тренировки'],
    ['strengthMinutes', LIMITS.minutes, 'продължителността на силовата тренировка'],
    ['cardioSessions', LIMITS.sessions, 'броят кардио тренировки'],
    ['cardioMinutes', LIMITS.minutes, 'продължителността на кардиото'],
    ['runningKmPerWeek', LIMITS.runningKm, 'километрите бягане'],
  ];
  for (const [key, lim, label] of fields) {
    const n = toNumber(raw[key]);
    if (n === null) values[key] = 0;
    else if (checkRange(errors, key, n, lim, label)) values[key] = n;
  }
  values.strengthIntensity = INTENSITY.includes(raw.strengthIntensity) ? raw.strengthIntensity : 'moderate';
  values.cardioIntensity = INTENSITY.includes(raw.cardioIntensity) ? raw.cardioIntensity : 'moderate';

  if (values.strengthSessions > 0 && values.strengthMinutes === 0) {
    errors.strengthMinutes = 'Посочете колко минути трае силовата тренировка.';
  }
  if (values.cardioSessions > 0 && values.cardioMinutes === 0) {
    errors.cardioMinutes = 'Посочете колко минути трае кардиото.';
  }
  if ((values.strengthSessions || 0) + (values.cardioSessions || 0) > 14) {
    errors.cardioSessions = 'Общо не повече от 14 тренировки седмично.';
  }
  return { valid: Object.keys(errors).length === 0, errors, values };
}

/** Валидира целта (стъпка 4). */
export function validateGoal(raw) {
  const errors = {};
  const values = {};
  if (!GOAL_KEYS.includes(raw.goal)) errors.goal = 'Изберете цел.';
  else values.goal = raw.goal;
  return { valid: Object.keys(errors).length === 0, errors, values };
}

/** Пълна валидация на профила за калорийния калкулатор. */
export function validateProfile(raw) {
  const parts = [validateBasics(raw), validateActivity(raw), validateTraining(raw), validateGoal(raw)];
  const errors = Object.assign({}, ...parts.map((p) => p.errors));
  const values = Object.assign({}, ...parts.map((p) => p.values));
  return { valid: Object.keys(errors).length === 0, errors, values };
}

/** Проста валидация на едно числово поле по граници (за малките калкулатори). */
export function validateNumber(value, { min, max, label, integer = false }) {
  const n = toNumber(value);
  if (n === null) return { valid: false, error: `Въведете ${label}.` };
  if (integer && !Number.isInteger(n)) return { valid: false, error: `${capitalize(label)} трябва да е цяло число.` };
  if (n < min || n > max) return { valid: false, error: `${capitalize(label)}: между ${min} и ${max}.` };
  return { valid: true, value: n };
}
