import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { FOODS, CATEGORIES } from '../data/foods.js';
import { INSULIN_INDEX, insulinIndexForFood, hasDisagreement } from '../data/insulin-index.js';
import { SOURCES } from '../data/sources.js';
import { filterFoods, sortFoods, goodForLabels, perServing, FILTERS } from '../js/lib/foodRules.js';

describe('База данни с храни — цялост', () => {
  test('поне 60 храни с уникални id', () => {
    assert.ok(FOODS.length >= 60);
    assert.equal(new Set(FOODS.map((f) => f.id)).size, FOODS.length);
  });
  test('всяка храна има източник USDA с fdcId', () => {
    for (const f of FOODS) {
      assert.equal(f.source.id, 'usda', f.id);
      assert.ok(Number.isInteger(f.source.fdcId) && f.source.fdcId > 100000, f.id);
      assert.ok(CATEGORIES[f.category], `категория ${f.category}`);
    }
  });
  test('хранителните стойности са физически възможни', () => {
    for (const f of FOODS) {
      const n = f.per100;
      for (const k of ['kcal', 'protein', 'carbs', 'fat']) assert.ok(n[k] >= 0, `${f.id}.${k}`);
      assert.ok(n.protein + n.carbs + n.fat <= 100.5, `${f.id}: макроси > 100 г`);
      assert.ok(n.kcal <= 900, f.id);
      if (n.fiber != null) assert.ok(n.fiber <= n.carbs + 0.01, `${f.id}: фибри > въглехидрати`);
      // Енергията трябва грубо да отговаря на Атуотър (±25%, допуск за фибри/алкохол/фактори).
      const atwater = n.protein * 4 + n.carbs * 4 + n.fat * 9;
      if (n.kcal > 50) assert.ok(Math.abs(atwater - n.kcal) / n.kcal < 0.25, `${f.id}: ${atwater} vs ${n.kcal}`);
      assert.ok(f.serving.grams > 0);
    }
  });
  test('ГИ е или измерен със източник, или изрично без данни/неприложим', () => {
    for (const f of FOODS) {
      assert.ok(['measured', 'na', 'nodata'].includes(f.gi.status), f.id);
      if (f.gi.status === 'measured') {
        assert.equal(f.gi.sourceId, 'atkinson2008');
        assert.ok(f.gi.value > 0 && f.gi.value <= 110);
        assert.ok(f.gi.tested);
      } else {
        assert.equal(f.gi.value, null);
      }
    }
  });
  test('задължителните храни от заданието присъстват', () => {
    const required = ['chicken', 'turkey', 'beef', 'pork', 'salmon', 'tuna', 'egg', 'greek', 'milk', 'cottage', 'rice', 'oats', 'potato', 'sweet potato', 'pasta', 'whole-wheat bread', 'white bread', 'banana', 'apple', 'orange', 'strawberr', 'blueberr', 'avocado', 'broccoli', 'carrot', 'tomato', 'cucumber', 'lentil', 'beans', 'chickpea', 'almond', 'walnut', 'peanut butter', 'dark chocolate', 'honey', 'sugar', 'pizza', 'french fries', 'cereal'];
    for (const r of required) {
      assert.ok(FOODS.some((f) => `${f.nameEn} ${f.aliases}`.toLowerCase().includes(r)), `липсва: ${r}`);
    }
  });
});

describe('Инсулинов индекс — цялост на данните', () => {
  test('всяка стойност има източник от рецензирано изследване', () => {
    for (const e of INSULIN_INDEX) {
      assert.ok(['holt1997', 'bao2009'].includes(e.sourceId), e.id);
      assert.ok(SOURCES[e.sourceId].url.startsWith('https://doi.org/'));
      assert.ok(SOURCES[e.sourceId].year);
      assert.ok(e.measurement);
      assert.ok(Number.isInteger(e.ii) && e.ii > 0 && e.ii < 200, e.id);
    }
  });
  test('Holt 1997 има точно 38 храни, бял хляб = 100', () => {
    const holt = INSULIN_INDEX.filter((e) => e.sourceId === 'holt1997');
    assert.equal(holt.length, 38);
    assert.equal(INSULIN_INDEX.find((e) => e.id === 'holt-whitebread').ii, 100);
  });
  test('контролни стойности от публикациите', () => {
    const v = (id) => INSULIN_INDEX.find((e) => e.id === id).ii;
    assert.equal(v('holt-jellybeans'), 160);
    assert.equal(v('holt-peanuts'), 20);
    assert.equal(v('holt-potatoes'), 121);
    assert.equal(v('holt-beef'), 51);
    assert.equal(v('holt-fish'), 59);
    assert.equal(v('holt-eggs'), 31);
    assert.equal(v('holt-yogurt'), 115);
    assert.equal(v('bao-chicken'), 23);
    assert.equal(v('bao-avocado'), 6);
  });
  test('порциите са 1000 kJ', () => {
    for (const e of INSULIN_INDEX) {
      const n = e.per1000kJ;
      const kcal = n.protein * 4 + n.carbs * 4 + n.fat * 9;
      assert.ok(kcal > 170 && kcal < 290, `${e.id}: ${kcal}`);
    }
  });
  test('свързаните храни съществуват в базата', () => {
    for (const e of INSULIN_INDEX.filter((x) => x.foodId)) {
      assert.ok(FOODS.some((f) => f.id === e.foodId), e.foodId);
    }
  });
  test('разминаване между изследвания се открива (многозърнест хляб: 56 срещу 71)', () => {
    const entries = insulinIndexForFood('bread-multigrain');
    assert.equal(entries.length, 2);
    assert.equal(hasDisagreement(entries), true);
    assert.equal(hasDisagreement(insulinIndexForFood('egg')), false);
  });
  test('храни без измерване нямат стойност (без измислени данни)', () => {
    for (const id of ['salmon', 'greek-yogurt', 'strawberries', 'broccoli', 'almonds', 'honey', 'sugar', 'dark-chocolate', 'sweet-potato']) {
      assert.equal(insulinIndexForFood(id).length, 0, id);
    }
  });
});

describe('Търсене, филтри и сортиране', () => {
  test('"chicken" намира пилешко', () => {
    const r = filterFoods(FOODS, { query: 'chicken' });
    assert.ok(r.length >= 2);
    assert.ok(r.every((f) => /пил/i.test(f.name)));
  });
  test('"ориз" / "rice" връща няколко вида ориз', () => {
    assert.ok(filterFoods(FOODS, { query: 'ориз' }).length >= 5);
    assert.ok(filterFoods(FOODS, { query: 'rice' }).length >= 5);
  });
  test('частично търсене "пил" и главни букви', () => {
    assert.ok(filterFoods(FOODS, { query: 'ПИЛ' }).length >= 2);
  });
  test('комбинирани филтри', () => {
    const r = filterFoods(FOODS, { filters: ['highProtein', 'lowFat'] });
    assert.ok(r.length > 0);
    for (const f of r) {
      assert.ok(FILTERS.highProtein.test(f.per100));
      assert.ok(f.per100.fat <= 3);
    }
  });
  test('категория', () => {
    const r = filterFoods(FOODS, { category: 'fruit' });
    assert.ok(r.every((f) => f.category === 'fruit'));
  });
  test('нисък ГИ само за измерени стойности', () => {
    const r = filterFoods(FOODS, { filters: ['lowGi'] });
    assert.ok(r.every((f) => f.gi.status === 'measured' && f.gi.value <= 55));
  });
  test('сортиране по белтък низходящо, null накрая', () => {
    const s = sortFoods(FOODS, 'protein', 'desc');
    for (let i = 1; i < s.length; i++) assert.ok(s[i - 1].per100.protein >= s[i].per100.protein);
    const byGi = sortFoods(FOODS, 'gi', 'asc', (f) => f.gi.value);
    const firstNull = byGi.findIndex((f) => f.gi.value == null);
    assert.ok(byGi.slice(firstNull).every((f) => f.gi.value == null));
  });
  test('етикети "подходящо за"', () => {
    const chicken = FOODS.find((f) => f.id === 'chicken-breast');
    const keys = goodForLabels(chicken).map((l) => l.key);
    assert.ok(keys.includes('highProtein') && keys.includes('muscleGain') && keys.includes('postWorkout'));
    assert.ok(!keys.includes('preWorkout'));
    const oil = FOODS.find((f) => f.id === 'olive-oil');
    assert.equal(goodForLabels(oil).length, 0, 'зехтинът няма етикети');
    const banana = FOODS.find((f) => f.id === 'banana');
    assert.ok(goodForLabels(banana).some((l) => l.key === 'preWorkout'));
  });
  test('стойности на порция', () => {
    const s = perServing({ kcal: 200, protein: 10, fiber: null }, 150);
    assert.equal(s.kcal, 300);
    assert.equal(s.protein, 15);
    assert.equal(s.fiber, null);
  });
});
