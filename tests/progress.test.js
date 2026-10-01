import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sanitize, upsertWeight, weightStats, weekStart, workoutsThisWeek, goalProgress, movingAverage, loadData, saveData, emptyData } from '../js/lib/progress.js';
import { RECIPES } from '../data/recipes.js';
import { EXERCISES } from '../data/exercises.js';

describe('Прогрес', () => {
  test('upsertWeight заменя запис за същата дата и сортира', () => {
    let w = upsertWeight([], '2026-09-10', 80);
    w = upsertWeight(w, '2026-09-01', 81);
    w = upsertWeight(w, '2026-09-10', 79.5);
    assert.deepEqual(w, [{ date: '2026-09-01', kg: 81 }, { date: '2026-09-10', kg: 79.5 }]);
  });
  test('статистика на теглото', () => {
    const s = weightStats([{ date: '2026-09-01', kg: 80 }, { date: '2026-09-15', kg: 79 }]);
    assert.equal(s.change, -1);
    assert.equal(s.days, 14);
    assert.equal(s.perWeek, -0.5);
    assert.equal(weightStats([]), null);
  });
  test('седмицата започва в понеделник, независимо от часовата зона', () => {
    assert.equal(weekStart('2026-09-30'), '2026-09-28'); // сряда
    assert.equal(weekStart('2026-09-28'), '2026-09-28'); // понеделник
    assert.equal(weekStart('2026-10-04'), '2026-09-28'); // неделя
    const w = [{ date: '2026-09-27' }, { date: '2026-09-28' }, { date: '2026-10-01' }];
    assert.equal(workoutsThisWeek(w, '2026-09-30').length, 2);
  });
  test('прогрес към цел', () => {
    assert.equal(goalProgress(90, 85, 80), 0.5);
    assert.equal(goalProgress(60, 62, 65), 0.4);
    assert.equal(goalProgress(90, 95, 80), 0);
    assert.equal(goalProgress(90, 70, 80), 1);
    assert.equal(goalProgress(90, 85, null), null);
  });
  test('плъзгаща се средна', () => {
    const m = movingAverage([{ date: 'a', kg: 80 }, { date: 'b', kg: 82 }], 7);
    assert.equal(m[1].kg, 81);
  });
  test('sanitize премахва невалидни данни', () => {
    const d = sanitize({ weights: [{ date: '2026-01-01', kg: 70 }, { date: 'x', kg: 70 }, { date: '2026-01-02', kg: -5 }, null], workouts: [{ date: '2026-01-01', type: 'Силова', minutes: 60 }, { date: '2026-01-01', type: 'x', minutes: 0 }], goals: { targetWeight: 'abc' } });
    assert.equal(d.weights.length, 1);
    assert.equal(d.workouts.length, 1);
    assert.equal(d.goals.targetWeight, null);
    assert.deepEqual(sanitize(null), emptyData());
  });
  test('хранилище, което хвърля грешка, не чупи приложението', () => {
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    assert.deepEqual(loadData(broken), emptyData());
    assert.equal(saveData(emptyData(), broken), false);
    const mem = new Map();
    const ok = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
    const data = { ...emptyData(), weights: [{ date: '2026-09-01', kg: 70 }] };
    assert.equal(saveData(data, ok), true);
    assert.deepEqual(loadData(ok).weights, data.weights);
  });
});

describe('Рецепти и упражнения', () => {
  test('макросите на рецептите се изчисляват от базата и са разумни', () => {
    for (const r of RECIPES) {
      assert.ok(r.ingredients.every((i) => i.name), r.id);
      const m = r.perServing;
      assert.ok(m.kcal > 100 && m.kcal < 1200, `${r.id}: ${m.kcal}`);
      const atw = m.protein * 4 + m.carbs * 4 + m.fat * 9;
      assert.ok(Math.abs(atw - m.kcal) / m.kcal < 0.2, r.id);
    }
  });
  test('упражненията имат уникални id и стъпки', () => {
    assert.equal(new Set(EXERCISES.map((e) => e.id)).size, EXERCISES.length);
    assert.ok(EXERCISES.every((e) => e.steps.length >= 3 && e.muscleLabel && e.equipmentLabel && e.levelLabel));
  });
});
