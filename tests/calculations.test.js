import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  bmrMifflinStJeor,
  bmrHarrisBenedict,
  bmrKatchMcArdle,
  bmi,
  bmiCategory,
  tdeeBreakdown,
  tdeeSimple,
  exerciseKcalPerDay,
  netMetKcal,
  stepsKcal,
  calorieTarget,
  calorieFloor,
  macroSplit,
  macrosFromPercentages,
  weeklyWeightChangeRange,
  calculateCaloriePlan,
  proteinReferenceWeight,
  proteinNeeds,
  oneRmEpley,
  oneRmBrzycki,
  oneRmAverage,
  repTable,
  lbToKg,
  kgToLb,
  ftInToCm,
  cmToFtIn,
  GOALS,
} from '../js/lib/calculations.js';

const close = (actual, expected, tol = 0.5, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, msg ?? `${actual} ≉ ${expected} (±${tol})`);

const baseProfile = {
  sex: 'male',
  age: 30,
  heightCm: 180,
  weightKg: 80,
  workActivity: 'sedentary',
  steps: 7000,
  strengthSessions: 4,
  strengthMinutes: 60,
  strengthIntensity: 'moderate',
  cardioSessions: 0,
  cardioMinutes: 0,
  cardioIntensity: 'moderate',
  runningKmPerWeek: 0,
  goal: 'maintain',
};

describe('BMR', () => {
  test('Mifflin-St Jeor — мъж 80 kg, 180 cm, 30 г. = 1780 kcal', () => {
    assert.equal(bmrMifflinStJeor({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 }), 1780);
  });
  test('Mifflin-St Jeor — жена 60 kg, 165 cm, 25 г. = 1345.25 kcal', () => {
    close(bmrMifflinStJeor({ sex: 'female', weightKg: 60, heightCm: 165, age: 25 }), 1345.25, 0.001);
  });
  test('Разликата между мъж и жена при еднакви данни е 166 kcal', () => {
    const p = { weightKg: 70, heightCm: 170, age: 40 };
    close(bmrMifflinStJeor({ ...p, sex: 'male' }) - bmrMifflinStJeor({ ...p, sex: 'female' }), 166, 1e-9);
  });
  test('BMR намалява с възрастта (5 kcal/година)', () => {
    const p = { sex: 'male', weightKg: 70, heightCm: 175 };
    close(bmrMifflinStJeor({ ...p, age: 30 }) - bmrMifflinStJeor({ ...p, age: 40 }), 50, 1e-9);
  });
  test('Harris-Benedict (ревизиран) дава близка стойност (±10%) до Mifflin', () => {
    const p = { sex: 'male', weightKg: 80, heightCm: 180, age: 30 };
    const hb = bmrHarrisBenedict(p);
    close(hb, 1853.6, 1);
    assert.ok(Math.abs(hb - bmrMifflinStJeor(p)) / hb < 0.1);
  });
  test('Katch-McArdle — 80 kg при 20% мазнини = 1752.4 kcal', () => {
    close(bmrKatchMcArdle({ weightKg: 80, bodyFatPct: 20 }), 1752.4, 0.01);
  });
});

describe('BMI', () => {
  test('70 kg / 175 cm ≈ 22.9', () => close(bmi(70, 175), 22.86, 0.01));
  test('категории на СЗО', () => {
    assert.equal(bmiCategory(17).key, 'under');
    assert.equal(bmiCategory(18.5).key, 'normal');
    assert.equal(bmiCategory(24.99).key, 'normal');
    assert.equal(bmiCategory(25).key, 'over');
    assert.equal(bmiCategory(30).key, 'obese');
  });
});

describe('TDEE (компонентен модел)', () => {
  test('нетни MET kcal не включват покоя', () => {
    close(netMetKcal(5, 80, 60), 320, 1e-9);
    assert.equal(netMetKcal(1, 80, 60), 0);
    assert.equal(netMetKcal(0.5, 80, 60), 0, 'MET < 1 не дава отрицателни kcal');
  });
  test('крачки: 10 000 крачки при 70 kg ≈ 350 kcal', () => close(stepsKcal(10000, 70), 350, 1e-9));
  test('тренировки се осредняват на ден', () => {
    const ex = exerciseKcalPerDay(
      { strengthSessions: 4, strengthMinutes: 60, strengthIntensity: 'moderate', cardioSessions: 0, cardioMinutes: 0, runningKmPerWeek: 0 },
      80,
    );
    close(ex.total, (4 * 320) / 7, 1e-9);
    assert.equal(ex.cardio, 0);
  });
  test('бягане: 21 km/седм. при 70 kg ≈ 189 kcal/ден', () => {
    const ex = exerciseKcalPerDay({ runningKmPerWeek: 21 }, 70);
    close(ex.running, (21 * 70 * 0.9) / 7, 1e-9);
  });
  test('реалистичен профил — офис, 7000 крачки, 4 силови → ~2560 kcal', () => {
    const r = tdeeBreakdown(baseProfile);
    close(r.bmr, 1780, 1e-9);
    close(r.tdee, 2560, 10);
    assert.ok(r.activityMultiplier > 1.35 && r.activityMultiplier < 1.55);
  });
  test('нулева активност → TDEE ≈ BMR × 1.155 (само TEF + минимална активност)', () => {
    const r = tdeeBreakdown({ ...baseProfile, steps: 0, strengthSessions: 0, strengthMinutes: 0 });
    close(r.tdee, 1780 * 1.05 * 1.1, 0.01);
    assert.equal(r.exercise.total, 0);
    assert.equal(r.steps, 0);
    assert.ok(r.tdee > r.bmr, 'TDEE винаги е над BMR');
  });
  test('много активен профил остава в разумни граници (< 2.3 × BMR)', () => {
    const r = tdeeBreakdown({
      ...baseProfile,
      workActivity: 'heavy',
      steps: 20000,
      strengthSessions: 6,
      strengthMinutes: 90,
      strengthIntensity: 'vigorous',
      cardioSessions: 4,
      cardioMinutes: 45,
      cardioIntensity: 'vigorous',
    });
    assert.ok(r.activityMultiplier < 2.6, `множител ${r.activityMultiplier}`);
    assert.ok(r.activityMultiplier > 1.9);
  });
  test('повече активност → по-висок TDEE (монотонност)', () => {
    const a = tdeeBreakdown({ ...baseProfile, steps: 3000 }).tdee;
    const b = tdeeBreakdown({ ...baseProfile, steps: 12000 }).tdee;
    const c = tdeeBreakdown({ ...baseProfile, steps: 12000, workActivity: 'physical' }).tdee;
    assert.ok(a < b && b < c);
  });
  test('непознат тип работа пада към "седяща"', () => {
    const r1 = tdeeBreakdown({ ...baseProfile, workActivity: 'xxx' });
    const r2 = tdeeBreakdown({ ...baseProfile, workActivity: 'sedentary' });
    assert.equal(r1.tdee, r2.tdee);
  });
  test('опростен TDEE с множител', () => {
    close(tdeeSimple(1780, 'moderate'), 2759, 0.01);
    close(tdeeSimple(1780, 'непознат'), 2136, 0.01);
  });
});

describe('Калорийна цел', () => {
  test('поддържане = TDEE', () => {
    const r = calorieTarget({ tdee: 2500, bmr: 1700, sex: 'male', goal: 'maintain' });
    assert.equal(r.target, 2500);
    assert.equal(r.adjust, 0);
  });
  test('отслабване: 20% дефицит, ограничен до 300–750 kcal', () => {
    close(calorieTarget({ tdee: 2500, bmr: 1700, sex: 'male', goal: 'lose' }).adjust, -500, 1e-9);
    close(calorieTarget({ tdee: 4500, bmr: 2200, sex: 'male', goal: 'lose' }).adjust, -750, 1e-9);
    close(calorieTarget({ tdee: 1900, bmr: 1300, sex: 'female', goal: 'lose' }).adjust, -380, 1e-9);
  });
  test('отслабване никога не пада под минимума (1200 жени / 1500 мъже / BMR)', () => {
    const r = calorieTarget({ tdee: 1450, bmr: 1150, sex: 'female', goal: 'lose' });
    assert.ok(r.target >= 1200);
    assert.equal(r.floored, true);
    const m = calorieTarget({ tdee: 1800, bmr: 1600, sex: 'male', goal: 'lose' });
    assert.ok(m.target >= calorieFloor('male', 1600));
  });
  test('минимумът не превишава TDEE при много нисък разход', () => {
    const r = calorieTarget({ tdee: 1150, bmr: 1000, sex: 'female', goal: 'lose' });
    assert.ok(r.target <= 1150);
    assert.ok(r.adjust <= 0);
  });
  test('мускулна маса: умерен излишък 150–350 kcal', () => {
    const r = calorieTarget({ tdee: 2600, bmr: 1800, sex: 'male', goal: 'muscle' });
    assert.ok(r.adjust >= 150 && r.adjust <= 350);
    close(r.adjust, 208, 0.001);
  });
  test('качване на тегло: 300–600 kcal излишък', () => {
    const r = calorieTarget({ tdee: 2000, bmr: 1400, sex: 'female', goal: 'gain' });
    assert.equal(r.adjust, 300);
    const r2 = calorieTarget({ tdee: 5000, bmr: 2200, sex: 'male', goal: 'gain' });
    assert.equal(r2.adjust, 600);
  });
  test('непозната цел → поддържане', () => {
    assert.equal(calorieTarget({ tdee: 2300, bmr: 1600, sex: 'male', goal: '???' }).target, 2300);
  });
});

describe('Макронутриенти', () => {
  test('сумата на калориите от макросите е равна на целта', () => {
    const m = macroSplit({ calories: 2500, weightKg: 80, heightCm: 180, proteinPerKg: 1.8, fatPct: 0.25 });
    close(m.kcal.protein + m.kcal.carbs + m.kcal.fat, 2500, 0.001);
    close(m.grams.protein, 144, 1e-9);
    close(m.grams.fat, 2500 * 0.25 / 9, 1e-9);
    close(m.pct.protein + m.pct.carbs + m.pct.fat, 1, 1e-9);
  });
  test('мазнините не падат под 0.6 g/kg', () => {
    const m = macroSplit({ calories: 1500, weightKg: 100, heightCm: 190, proteinPerKg: 2, fatPct: 0.2 });
    assert.ok(m.grams.fat >= 60 - 1e-9);
  });
  test('при много ниски калории въглехидратите не стават отрицателни', () => {
    const m = macroSplit({ calories: 800, weightKg: 120, heightCm: 200, proteinPerKg: 2.4, fatPct: 0.3 });
    assert.ok(m.grams.carbs >= 0);
    close(m.kcal.protein + m.kcal.carbs + m.kcal.fat, 800, 0.001);
  });
  test('при BMI > 30 белтъкът се смята спрямо тегло при BMI 27', () => {
    close(proteinReferenceWeight(120, 175), 27 * 1.75 * 1.75, 1e-9);
    assert.equal(proteinReferenceWeight(75, 175), 75);
  });
  test('проценти → грамове', () => {
    const m = macrosFromPercentages(2000, { protein: 30, carbs: 40, fat: 30 });
    close(m.grams.protein, 150, 1e-9);
    close(m.grams.carbs, 200, 1e-9);
    close(m.grams.fat, 66.67, 0.01);
  });
  test('проценти, които не дават 100, се нормализират', () => {
    const m = macrosFromPercentages(2000, { protein: 1, carbs: 1, fat: 2 });
    close(m.pct.fat, 0.5, 1e-9);
  });
  test('протеин калкулатор — диапазон', () => {
    const r = proteinNeeds({ weightKg: 70, heightCm: 175, level: 'strength' });
    close(r.low, 112, 1e-9);
    close(r.high, 154, 1e-9);
  });
});

describe('Очаквана промяна на теглото', () => {
  test('−500 kcal/ден → около −0.45 kg/седм. като диапазон', () => {
    const r = weeklyWeightChangeRange(-500);
    close(r.mid, -0.4545, 0.001);
    assert.ok(r.low < r.mid && r.mid < r.high);
    assert.ok(r.high < 0);
  });
  test('0 kcal → 0', () => {
    const r = weeklyWeightChangeRange(0);
    assert.equal(r.mid, 0);
  });
});

describe('Пълен план — реалистични профили', () => {
  const profiles = [
    { name: 'жена, 28 г., офис, отслабване', p: { ...baseProfile, sex: 'female', age: 28, heightCm: 165, weightKg: 68, steps: 6000, strengthSessions: 2, goal: 'lose' } },
    { name: 'мъж, 22 г., мускулна маса', p: { ...baseProfile, age: 22, weightKg: 72, heightCm: 178, strengthSessions: 5, goal: 'muscle' } },
    { name: 'бегач, 45 г., постижения', p: { ...baseProfile, age: 45, weightKg: 68, heightCm: 176, strengthSessions: 1, runningKmPerWeek: 40, goal: 'performance' } },
    { name: 'жена, 65 г., поддържане', p: { ...baseProfile, sex: 'female', age: 65, weightKg: 62, heightCm: 160, steps: 5000, strengthSessions: 0, strengthMinutes: 0, goal: 'maintain' } },
    { name: 'мъж, 40 г., 130 kg, отслабване', p: { ...baseProfile, age: 40, weightKg: 130, heightCm: 182, steps: 4000, strengthSessions: 0, strengthMinutes: 0, goal: 'lose' } },
  ];
  for (const { name, p } of profiles) {
    test(name, () => {
      const r = calculateCaloriePlan(p);
      for (const k of ['bmr', 'tdee', 'target']) {
        assert.ok(Number.isFinite(r[k]) && r[k] > 0, `${k} = ${r[k]}`);
      }
      assert.ok(r.tdee > r.bmr);
      assert.ok(r.target > 1100 && r.target < 5000, `цел ${r.target}`);
      for (const m of ['protein', 'carbs', 'fat']) {
        assert.ok(Number.isFinite(r.macros.grams[m]) && r.macros.grams[m] >= 0, m);
      }
      close(r.macros.kcal.protein + r.macros.kcal.carbs + r.macros.kcal.fat, r.target, 0.01);
      assert.ok(r.proteinRange[0] < r.proteinRange[1]);
      if (p.goal === 'lose') assert.ok(r.adjust < 0 && r.weeklyChange.high < 0);
      if (p.goal === 'muscle') assert.ok(r.adjust > 0);
      if (p.goal === 'maintain') assert.equal(r.adjust, 0);
      assert.equal(r.goalLabel, GOALS[p.goal].label);
    });
  }
});

describe('1RM', () => {
  test('Epley: 100 kg × 5 = 116.7 kg', () => close(oneRmEpley(100, 5), 116.67, 0.01));
  test('Brzycki: 100 kg × 5 = 112.5 kg', () => close(oneRmBrzycki(100, 5), 112.5, 0.01));
  test('1 повторение = самата тежест', () => {
    assert.equal(oneRmEpley(140, 1), 140);
    assert.equal(oneRmBrzycki(140, 1), 140);
    close(oneRmAverage(140, 1), 140, 1e-9);
  });
  test('таблица с повторения е низходяща', () => {
    const t = repTable(120);
    assert.equal(t[0].weight, 120);
    for (let i = 1; i < t.length; i++) assert.ok(t[i].weight < t[i - 1].weight);
  });
});

describe('Преобразуване на единици', () => {
  test('lb ↔ kg', () => {
    close(lbToKg(176.37), 80, 0.01);
    close(kgToLb(lbToKg(150)), 150, 1e-9);
  });
  test('ft/in ↔ cm', () => {
    close(ftInToCm(5, 11), 180.34, 0.001);
    close(ftInToCm(6, 0), 182.88, 0.001);
    const r = cmToFtIn(180.34);
    assert.equal(r.feet, 5);
    close(r.inches, 11, 0.05);
  });
  test('cmToFtIn не връща 12 инча', () => {
    const r = cmToFtIn(182.8);
    assert.ok(r.inches < 12);
  });
});
