import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  toNumber,
  validateBasics,
  validateActivity,
  validateTraining,
  validateGoal,
  validateProfile,
  validateNumber,
} from '../js/lib/validation.js';
import { calculateCaloriePlan } from '../js/lib/calculations.js';

const ok = { sex: 'male', age: '30', heightCm: '180', weightKg: '80', units: 'metric' };

describe('toNumber', () => {
  test('приема числа и низове, вкл. десетична запетая', () => {
    assert.equal(toNumber('72,5'), 72.5);
    assert.equal(toNumber(' 80 '), 80);
    assert.equal(toNumber(12), 12);
  });
  test('празни и невалидни стойности → null', () => {
    for (const v of ['', '   ', null, undefined, 'abc', '12kg', '1.2.3', NaN, Infinity, '--5']) {
      assert.equal(toNumber(v), null, `стойност: ${String(v)}`);
    }
  });
});

describe('Основни данни', () => {
  test('валиден профил', () => {
    const r = validateBasics(ok);
    assert.equal(r.valid, true);
    assert.deepEqual(r.values, { sex: 'male', age: 30, heightCm: 180, weightKg: 80 });
  });
  test('празни полета', () => {
    const r = validateBasics({ units: 'metric' });
    assert.equal(r.valid, false);
    assert.ok(r.errors.sex && r.errors.age && r.errors.heightCm && r.errors.weightKg);
  });
  test('отрицателни стойности', () => {
    const r = validateBasics({ ...ok, age: '-5', heightCm: '-170', weightKg: '-60' });
    assert.equal(r.valid, false);
    assert.match(r.errors.age, /отрицателна/);
    assert.match(r.errors.heightCm, /отрицателна/);
    assert.match(r.errors.weightKg, /отрицателна/);
  });
  test('невъзможни възрасти', () => {
    for (const age of ['0', '5', '15', '101', '150', '30.5']) {
      assert.equal(validateBasics({ ...ok, age }).valid, false, `възраст ${age}`);
    }
    assert.equal(validateBasics({ ...ok, age: '16' }).valid, true);
    assert.equal(validateBasics({ ...ok, age: '100' }).valid, true);
  });
  test('невъзможни ръстове', () => {
    for (const h of ['0', '50', '119', '231', '400']) {
      assert.equal(validateBasics({ ...ok, heightCm: h }).valid, false, `ръст ${h}`);
    }
  });
  test('невъзможни тегла', () => {
    for (const w of ['0', '10', '34.9', '301', '1000']) {
      assert.equal(validateBasics({ ...ok, weightKg: w }).valid, false, `тегло ${w}`);
    }
  });
  test('невалиден пол', () => {
    assert.equal(validateBasics({ ...ok, sex: 'other' }).valid, false);
  });
  test('текст вместо число', () => {
    const r = validateBasics({ ...ok, weightKg: 'осемдесет' });
    assert.equal(r.valid, false);
    assert.ok(r.errors.weightKg);
  });
  test('имперски единици се превръщат в kg/cm', () => {
    const r = validateBasics({ sex: 'female', age: '30', units: 'imperial', heightFt: '5', heightIn: '6', weightLb: '140' });
    assert.equal(r.valid, true);
    assert.ok(Math.abs(r.values.heightCm - 167.64) < 0.01);
    assert.ok(Math.abs(r.values.weightKg - 63.503) < 0.01);
  });
  test('имперски: инчове ≥ 12 са невалидни', () => {
    const r = validateBasics({ sex: 'female', age: '30', units: 'imperial', heightFt: '5', heightIn: '14', weightLb: '140' });
    assert.equal(r.valid, false);
  });
});

describe('Активност и тренировки', () => {
  test('празни крачки = 0 (незадължително поле)', () => {
    const r = validateActivity({ workActivity: 'sedentary', steps: '' });
    assert.equal(r.valid, true);
    assert.equal(r.values.steps, 0);
  });
  test('отрицателни/огромни крачки са невалидни', () => {
    assert.equal(validateActivity({ workActivity: 'sedentary', steps: '-100' }).valid, false);
    assert.equal(validateActivity({ workActivity: 'sedentary', steps: '90000' }).valid, false);
  });
  test('липсващ тип работа', () => {
    assert.equal(validateActivity({ steps: '5000' }).valid, false);
  });
  test('нулева активност е валидна', () => {
    const r = validateTraining({});
    assert.equal(r.valid, true);
    assert.equal(r.values.strengthSessions, 0);
    assert.equal(r.values.cardioSessions, 0);
    assert.equal(r.values.runningKmPerWeek, 0);
  });
  test('тренировки без продължителност са невалидни', () => {
    assert.equal(validateTraining({ strengthSessions: '3', strengthMinutes: '' }).valid, false);
    assert.equal(validateTraining({ cardioSessions: '2', cardioMinutes: '0' }).valid, false);
  });
  test('твърде много тренировки', () => {
    assert.equal(validateTraining({ strengthSessions: '20', strengthMinutes: '60' }).valid, false);
    assert.equal(validateTraining({ strengthSessions: '10', strengthMinutes: '60', cardioSessions: '10', cardioMinutes: '30' }).valid, false);
  });
  test('отрицателни минути', () => {
    assert.equal(validateTraining({ strengthSessions: '3', strengthMinutes: '-60' }).valid, false);
  });
  test('невалидна интензивност пада към умерена', () => {
    assert.equal(validateTraining({ strengthIntensity: 'mega' }).values.strengthIntensity, 'moderate');
  });
  test('цел', () => {
    assert.equal(validateGoal({ goal: 'lose' }).valid, true);
    assert.equal(validateGoal({ goal: 'fly' }).valid, false);
    assert.equal(validateGoal({}).valid, false);
  });
});

describe('Пълен профил → резултат', () => {
  test('валиден профил дава крайни положителни резултати', () => {
    const r = validateProfile({ ...ok, workActivity: 'standing', steps: '8000', strengthSessions: '3', strengthMinutes: '50', goal: 'lose' });
    assert.equal(r.valid, true);
    const plan = calculateCaloriePlan(r.values);
    assert.ok(Number.isFinite(plan.target) && plan.target > 0);
  });
  test('невалиден профил връща всички грешки наведнъж', () => {
    const r = validateProfile({ age: '-1', heightCm: 'abc', weightKg: '', steps: '-5' });
    assert.equal(r.valid, false);
    for (const k of ['sex', 'age', 'heightCm', 'weightKg', 'workActivity', 'steps', 'goal']) {
      assert.ok(r.errors[k], `очаквана грешка за ${k}`);
    }
  });
  test('граничните стойности не дават NaN', () => {
    for (const [age, h, w] of [[16, 120, 35], [100, 230, 300], [16, 230, 35], [100, 120, 300]]) {
      const r = validateProfile({ sex: 'female', age: String(age), heightCm: String(h), weightKg: String(w), workActivity: 'sedentary', goal: 'lose' });
      assert.equal(r.valid, true);
      const plan = calculateCaloriePlan(r.values);
      for (const v of [plan.bmr, plan.tdee, plan.target, plan.macros.grams.protein, plan.macros.grams.carbs, plan.macros.grams.fat]) {
        assert.ok(Number.isFinite(v) && v >= 0, `${age}/${h}/${w}: ${v}`);
      }
    }
  });
});

describe('validateNumber', () => {
  test('граници и цели числа', () => {
    assert.equal(validateNumber('5', { min: 1, max: 12, label: 'повторения', integer: true }).valid, true);
    assert.equal(validateNumber('5.5', { min: 1, max: 12, label: 'повторения', integer: true }).valid, false);
    assert.equal(validateNumber('13', { min: 1, max: 12, label: 'повторения' }).valid, false);
    assert.equal(validateNumber('', { min: 1, max: 12, label: 'повторения' }).valid, false);
  });
});
