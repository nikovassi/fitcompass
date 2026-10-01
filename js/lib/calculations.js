/**
 * FitCompass — формули за калории, енергоразход и макронутриенти.
 *
 * Всички функции тук са "чисти" (без DOM, без странични ефекти), за да могат
 * да се тестват лесно с `node --test`. Всяка формула е описана с източника си.
 *
 * Единици: тегло в kg, ръст в cm, възраст в години, енергия в kcal.
 */

export const KCAL_PER_G = Object.freeze({ protein: 4, carbs: 4, fat: 9 });

/** Приблизителна енергия на 1 kg промяна в телесната маса (смес мазнини/нетлъста маса). */
export const KCAL_PER_KG_BODY_MASS = 7700;

// ---------------------------------------------------------------------------
// Преобразуване на мерни единици
// ---------------------------------------------------------------------------

export const LB_TO_KG = 0.45359237;
export const IN_TO_CM = 2.54;

export function lbToKg(lb) {
  return lb * LB_TO_KG;
}

export function kgToLb(kg) {
  return kg / LB_TO_KG;
}

export function ftInToCm(feet, inches = 0) {
  return (feet * 12 + inches) * IN_TO_CM;
}

export function cmToFtIn(cm) {
  const totalIn = cm / IN_TO_CM;
  let feet = Math.floor(totalIn / 12);
  let inches = Math.round((totalIn - feet * 12) * 10) / 10;
  if (inches >= 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}

// ---------------------------------------------------------------------------
// Базов метаболизъм (BMR)
// ---------------------------------------------------------------------------

/**
 * Mifflin-St Jeor (1990): BMR = 10·kg + 6.25·cm − 5·възраст + s,
 * s = +5 за мъже, −161 за жени. Препоръчвана от Academy of Nutrition and
 * Dietetics като най-точното уравнение при здрави възрастни без измерен състав.
 */
export function bmrMifflinStJeor({ sex, weightKg, heightCm, age }) {
  const s = sex === 'female' ? -161 : 5;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + s;
}

/** Revised Harris-Benedict (Roza & Shizgal, 1984) — за сравнение. */
export function bmrHarrisBenedict({ sex, weightKg, heightCm, age }) {
  if (sex === 'female') {
    return 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age;
  }
  return 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age;
}

/** Katch-McArdle: BMR = 370 + 21.6·нетлъста маса (kg). Изисква % телесни мазнини. */
export function bmrKatchMcArdle({ weightKg, bodyFatPct }) {
  const leanMass = weightKg * (1 - bodyFatPct / 100);
  return 370 + 21.6 * leanMass;
}

// ---------------------------------------------------------------------------
// Индекс на телесна маса
// ---------------------------------------------------------------------------

export function bmi(weightKg, heightCm) {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** Категории на СЗО за възрастни. */
export function bmiCategory(value) {
  if (value < 18.5) return { key: 'under', label: 'Поднормено тегло' };
  if (value < 25) return { key: 'normal', label: 'Нормално тегло' };
  if (value < 30) return { key: 'over', label: 'Наднормено тегло' };
  return { key: 'obese', label: 'Затлъстяване' };
}

/** Тегло при даден BMI за даден ръст. */
export function weightForBmi(bmiValue, heightCm) {
  const m = heightCm / 100;
  return bmiValue * m * m;
}

// ---------------------------------------------------------------------------
// Общ дневен енергоразход (TDEE) — компонентен модел
// ---------------------------------------------------------------------------
//
// Вместо един общ множител, TDEE се сглобява от отделни компоненти:
//
//   1. BMR — базов метаболизъм (Mifflin-St Jeor).
//   2. Трудова/битова активност без ходене — дял от BMR според типа работа.
//   3. Ходене — нетни kcal от средните дневни крачки.
//   4. Тренировки — нетни kcal от силови, кардио и бягане (MET метод),
//      осреднени на ден от седмичния обем.
//   5. Термичен ефект на храната (TEF) — ~10% от общия разход.
//
//   TDEE = (BMR + работа + крачки + тренировки) × (1 + TEF)
//
// "Нетни" означава над нивото на покой (MET − 1), за да не се брои BMR два пъти.
// Крачките и активността в работата са отделени, за да не се дублира ходенето.

/** Допълнителен разход от работата (без ходене) като дял от BMR. */
export const WORK_ACTIVITY = Object.freeze({
  sedentary: { factor: 0.05, label: 'Предимно седяща (офис, шофиране)' },
  standing: { factor: 0.15, label: 'Предимно права (продавач, учител, лаборант)' },
  physical: { factor: 0.3, label: 'Физическа (склад, сервитьор, строител на леко)' },
  heavy: { factor: 0.45, label: 'Тежка физическа (строителство, земеделие, товарене)' },
});

/** Нетни kcal на крачка за kg телесно тегло (≈0.04 kcal/крачка при 70–80 kg). */
export const KCAL_PER_STEP_PER_KG = 0.0005;

/** MET стойности (Compendium of Physical Activities, Ainsworth et al. 2011). */
export const MET = Object.freeze({
  strength: { light: 3.5, moderate: 5.0, vigorous: 6.0 },
  cardio: { light: 4.0, moderate: 7.0, vigorous: 10.0 },
});

/** Нетни kcal/kg/km при бягане (≈1 kcal/kg/km бруто, минус покой). */
export const RUN_NET_KCAL_PER_KG_PER_KM = 0.9;

export const TEF_RATE = 0.1;

/** Нетни kcal за активност по MET: (MET − 1) × kg × часове. */
export function netMetKcal(met, weightKg, minutes) {
  return Math.max(0, met - 1) * weightKg * (minutes / 60);
}

export function stepsKcal(steps, weightKg) {
  return steps * weightKg * KCAL_PER_STEP_PER_KG;
}

/**
 * Седмичен тренировъчен разход, осреднен на ден.
 * @param {object} t
 * @param {number} t.strengthSessions силови тренировки седмично
 * @param {number} t.strengthMinutes продължителност на силовата тренировка (мин)
 * @param {'light'|'moderate'|'vigorous'} t.strengthIntensity
 * @param {number} t.cardioSessions кардио сесии седмично (без бягане)
 * @param {number} t.cardioMinutes продължителност на кардио сесия (мин)
 * @param {'light'|'moderate'|'vigorous'} t.cardioIntensity
 * @param {number} t.runningKmPerWeek километри бягане седмично
 */
export function exerciseKcalPerDay(t, weightKg) {
  const strengthMet = MET.strength[t.strengthIntensity] ?? MET.strength.moderate;
  const cardioMet = MET.cardio[t.cardioIntensity] ?? MET.cardio.moderate;
  const strength = (t.strengthSessions || 0) * netMetKcal(strengthMet, weightKg, t.strengthMinutes || 0);
  const cardio = (t.cardioSessions || 0) * netMetKcal(cardioMet, weightKg, t.cardioMinutes || 0);
  const running = (t.runningKmPerWeek || 0) * weightKg * RUN_NET_KCAL_PER_KG_PER_KM;
  return {
    strength: strength / 7,
    cardio: cardio / 7,
    running: running / 7,
    total: (strength + cardio + running) / 7,
  };
}

/**
 * Пълна разбивка на TDEE.
 * @returns {{bmr:number, work:number, steps:number, exercise:object, tef:number, tdee:number, activityMultiplier:number}}
 */
export function tdeeBreakdown(profile) {
  const bmr = bmrMifflinStJeor(profile);
  const workFactor = (WORK_ACTIVITY[profile.workActivity] ?? WORK_ACTIVITY.sedentary).factor;
  const work = bmr * workFactor;
  const steps = stepsKcal(profile.steps || 0, profile.weightKg);
  const exercise = exerciseKcalPerDay(profile, profile.weightKg);
  const subtotal = bmr + work + steps + exercise.total;
  const tef = subtotal * TEF_RATE;
  const tdee = subtotal + tef;
  return { bmr, work, steps, exercise, tef, tdee, activityMultiplier: tdee / bmr };
}

/** Класически множители (за опростения TDEE калкулатор). */
export const SIMPLE_ACTIVITY_MULTIPLIERS = Object.freeze({
  sedentary: { value: 1.2, label: 'Заседнал начин на живот' },
  light: { value: 1.375, label: 'Лека активност (1–3 тренировки/седм.)' },
  moderate: { value: 1.55, label: 'Умерена активност (3–5 тренировки/седм.)' },
  high: { value: 1.725, label: 'Висока активност (6–7 тренировки/седм.)' },
  extreme: { value: 1.9, label: 'Много висока (физически труд + тренировки)' },
});

export function tdeeSimple(bmrValue, activityKey) {
  const m = SIMPLE_ACTIVITY_MULTIPLIERS[activityKey]?.value ?? 1.2;
  return bmrValue * m;
}

// ---------------------------------------------------------------------------
// Цели и калориен прием
// ---------------------------------------------------------------------------

/**
 * Настройки по цел.
 *  - adjustPct: промяна спрямо TDEE (отрицателна = дефицит)
 *  - minAdjust/maxAdjust: граници на абсолютната промяна в kcal
 *  - proteinPerKg: препоръчан белтък (g/kg референтно тегло)
 *  - fatPct: дял на мазнините от калориите
 */
export const GOALS = Object.freeze({
  lose: {
    label: 'Отслабване',
    adjustPct: -0.2,
    minAdjust: 300,
    maxAdjust: 750,
    proteinPerKg: 2.0,
    proteinRange: [1.8, 2.4],
    fatPct: 0.25,
  },
  maintain: {
    label: 'Поддържане',
    adjustPct: 0,
    minAdjust: 0,
    maxAdjust: 0,
    proteinPerKg: 1.6,
    proteinRange: [1.2, 2.0],
    fatPct: 0.3,
  },
  gain: {
    label: 'Качване на тегло',
    adjustPct: 0.15,
    minAdjust: 300,
    maxAdjust: 600,
    proteinPerKg: 1.6,
    proteinRange: [1.4, 2.0],
    fatPct: 0.25,
  },
  muscle: {
    label: 'Покачване на мускулна маса',
    adjustPct: 0.08,
    minAdjust: 150,
    maxAdjust: 350,
    proteinPerKg: 1.8,
    proteinRange: [1.6, 2.2],
    fatPct: 0.25,
  },
  performance: {
    label: 'Спортни постижения',
    adjustPct: 0.05,
    minAdjust: 0,
    maxAdjust: 250,
    proteinPerKg: 1.6,
    proteinRange: [1.4, 2.0],
    fatPct: 0.25,
  },
});

/** Практичен минимум на калориите без медицинско наблюдение. */
export function calorieFloor(sex, bmrValue) {
  const absolute = sex === 'female' ? 1200 : 1500;
  return Math.max(absolute, Math.round(bmrValue));
}

/**
 * Изчислява калорийната цел според TDEE и целта.
 * Връща и реално приложената промяна (след ограниченията).
 */
export function calorieTarget({ tdee, bmr, sex, goal }) {
  const g = GOALS[goal] ?? GOALS.maintain;
  let adjust = tdee * g.adjustPct;
  if (adjust !== 0) {
    const sign = Math.sign(adjust);
    const abs = Math.min(Math.max(Math.abs(adjust), g.minAdjust), g.maxAdjust);
    adjust = sign * abs;
  }
  let target = tdee + adjust;
  let floored = false;
  if (adjust < 0) {
    const floor = calorieFloor(sex, bmr);
    if (target < floor) {
      target = Math.min(floor, tdee);
      floored = true;
    }
  }
  return { target, adjust: target - tdee, floored };
}

/**
 * Референтно тегло за белтък. При BMI > 30 белтъкът се изчислява спрямо
 * теглото при BMI 27, за да не се надценява нуждата при висок % мазнини.
 */
export function proteinReferenceWeight(weightKg, heightCm) {
  const currentBmi = bmi(weightKg, heightCm);
  if (currentBmi > 30) return weightForBmi(27, heightCm);
  return weightKg;
}

/**
 * Разпределение на макронутриентите.
 * Белтък: g/kg референтно тегло. Мазнини: % от калориите, но не под 0.6 g/kg.
 * Въглехидрати: останалото (не под 0).
 */
export function macroSplit({ calories, weightKg, heightCm, proteinPerKg, fatPct }) {
  const refWeight = heightCm ? proteinReferenceWeight(weightKg, heightCm) : weightKg;
  let proteinG = proteinPerKg * refWeight;
  let fatG = Math.max((calories * fatPct) / KCAL_PER_G.fat, 0.6 * weightKg);

  // Ако белтъкът и мазнините надхвърлят калориите, намаляваме пропорционално.
  const pfKcal = proteinG * KCAL_PER_G.protein + fatG * KCAL_PER_G.fat;
  if (pfKcal > calories) {
    const k = calories / pfKcal;
    proteinG *= k;
    fatG *= k;
  }
  const carbsKcal = Math.max(0, calories - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat);
  const carbsG = carbsKcal / KCAL_PER_G.carbs;

  const kcal = {
    protein: proteinG * KCAL_PER_G.protein,
    carbs: carbsG * KCAL_PER_G.carbs,
    fat: fatG * KCAL_PER_G.fat,
  };
  const total = kcal.protein + kcal.carbs + kcal.fat;
  return {
    grams: { protein: proteinG, carbs: carbsG, fat: fatG },
    kcal,
    pct: {
      protein: total ? kcal.protein / total : 0,
      carbs: total ? kcal.carbs / total : 0,
      fat: total ? kcal.fat / total : 0,
    },
    proteinReferenceWeight: refWeight,
  };
}

/** Разпределение по зададени проценти (за Макро калкулатора). */
export function macrosFromPercentages(calories, { protein, carbs, fat }) {
  const sum = protein + carbs + fat;
  const p = protein / sum;
  const c = carbs / sum;
  const f = fat / sum;
  return {
    grams: {
      protein: (calories * p) / KCAL_PER_G.protein,
      carbs: (calories * c) / KCAL_PER_G.carbs,
      fat: (calories * f) / KCAL_PER_G.fat,
    },
    kcal: { protein: calories * p, carbs: calories * c, fat: calories * f },
    pct: { protein: p, carbs: c, fat: f },
  };
}

/**
 * Очаквана седмична промяна на теглото като диапазон (kg/седмица).
 * Моделът 7700 kcal/kg е опростяване: реалната промяна зависи от водата,
 * гликогена, адаптацията и точността на отчитане, затова връщаме ±25%.
 */
export function weeklyWeightChangeRange(dailyAdjustKcal) {
  const mid = (dailyAdjustKcal * 7) / KCAL_PER_KG_BODY_MASS;
  const a = mid * 0.75;
  const b = mid * 1.25;
  return { low: Math.min(a, b), high: Math.max(a, b), mid };
}

/** Диапазон на несигурност на TDEE оценката (±10%). */
export function tdeeRange(tdee) {
  return { low: tdee * 0.9, high: tdee * 1.1 };
}

// ---------------------------------------------------------------------------
// Пълен резултат за калорийния калкулатор
// ---------------------------------------------------------------------------

export function calculateCaloriePlan(profile) {
  const breakdown = tdeeBreakdown(profile);
  const goalCfg = GOALS[profile.goal] ?? GOALS.maintain;
  const target = calorieTarget({
    tdee: breakdown.tdee,
    bmr: breakdown.bmr,
    sex: profile.sex,
    goal: profile.goal,
  });
  const macros = macroSplit({
    calories: target.target,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    proteinPerKg: goalCfg.proteinPerKg,
    fatPct: goalCfg.fatPct,
  });
  const refW = macros.proteinReferenceWeight;
  return {
    ...breakdown,
    goal: profile.goal,
    goalLabel: goalCfg.label,
    tdeeRange: tdeeRange(breakdown.tdee),
    target: target.target,
    adjust: target.adjust,
    floored: target.floored,
    macros,
    proteinRange: goalCfg.proteinRange.map((x) => x * refW),
    weeklyChange: weeklyWeightChangeRange(target.adjust),
    bmi: bmi(profile.weightKg, profile.heightCm),
  };
}

// ---------------------------------------------------------------------------
// Протеин калкулатор
// ---------------------------------------------------------------------------

export const PROTEIN_LEVELS = Object.freeze({
  sedentary: { range: [0.8, 1.0], label: 'Без редовни тренировки' },
  active: { range: [1.2, 1.6], label: 'Редовна активност / издръжливост' },
  strength: { range: [1.6, 2.2], label: 'Силови тренировки / мускулна маса' },
  cutting: { range: [1.8, 2.4], label: 'Силови тренировки при калориен дефицит' },
});

export function proteinNeeds({ weightKg, heightCm, level }) {
  const cfg = PROTEIN_LEVELS[level] ?? PROTEIN_LEVELS.active;
  const refW = heightCm ? proteinReferenceWeight(weightKg, heightCm) : weightKg;
  const [lo, hi] = cfg.range;
  return { low: lo * refW, high: hi * refW, mid: ((lo + hi) / 2) * refW, referenceWeight: refW };
}

// ---------------------------------------------------------------------------
// Едноповторен максимум (1RM)
// ---------------------------------------------------------------------------

/** Epley (1985): 1RM = w · (1 + reps/30). */
export function oneRmEpley(weight, reps) {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Brzycki (1993): 1RM = w · 36 / (37 − reps). Валидна до ~10 повторения. */
export function oneRmBrzycki(weight, reps) {
  if (reps === 1) return weight;
  return (weight * 36) / (37 - reps);
}

/** Lombardi: 1RM = w · reps^0.10. */
export function oneRmLombardi(weight, reps) {
  return weight * Math.pow(reps, 0.1);
}

export function oneRmAverage(weight, reps) {
  const values = [oneRmEpley(weight, reps), oneRmBrzycki(weight, reps), oneRmLombardi(weight, reps)];
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Таблица с приблизителни тежести за брой повторения (обратен Epley). */
export function repTable(oneRm) {
  return [1, 2, 3, 4, 5, 6, 8, 10, 12, 15].map((reps) => ({
    reps,
    weight: reps === 1 ? oneRm : oneRm / (1 + reps / 30),
    pct: reps === 1 ? 1 : 1 / (1 + reps / 30),
  }));
}
