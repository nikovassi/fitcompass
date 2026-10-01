/**
 * Инсулинов индекс (Food Insulin Index, FII) — само измерени стойности.
 *
 * ПРАВИЛА ЗА ТАЗИ БАЗА ДАННИ
 *  - Всяка стойност е преписана от таблица в рецензирана публикация.
 *  - Нищо не е изчислено от ГИ, нищо не е прогнозирано, нищо не е "оценка".
 *  - Скала: бял хляб = 100, порция от 1000 kJ (≈239 kcal). Стойности от
 *    изследвания с различна референтна храна (напр. глюкоза) НЕ са смесени тук.
 *  - `per1000kJ` е съставът на тестваната порция, както е публикуван
 *    (Holt 1997, Table 2) или преизчислен пропорционално до 1000 kJ от
 *    публикуваната порция (Bao 2009, Table 1).
 *  - `glucoseScore` (само Holt 1997) е гликемичният отговор в същото изследване
 *    спрямо бял хляб = 100. Това НЕ е ГИ по скалата с глюкоза.
 *  - `gi` е ГИ по скалата глюкоза = 100: от Atkinson 2008 (Table 1) или
 *    стойността, публикувана в Bao 2009 (Table 1). Източникът е в `giSource`.
 *  - `foodId` свързва записа с храна от data/foods.js, когато тестваната храна
 *    съответства. Ако тестваният продукт се различава, това е описано в `note`.
 */
import { SOURCES } from './sources.js';

export const II_SCALE = Object.freeze({
  reference: 'Бял хляб = 100',
  portion: '1000 kJ (≈239 kcal)',
  kcalPerPortion: 239,
});

// Holt et al. 1997 — Table 2 (състав на 1000 kJ порция) и Table 4 (средни ± SEM).
// [id, име, тествана храна (англ.), група, грамове, мазнини, белтък, захари, нишесте, фибри, глюкозен резултат, ±, инсулинов индекс, ±, foodId, ГИ ключ, бележка]
const HOLT = [
  ['holt-grapes', 'Грозде', 'Grapes', 'fruit', 395, 0.4, 3.2, 56.9, 0.0, 3.6, 74, 9, 82, 6, 'grapes', null],
  ['holt-bananas', 'Банани', 'Bananas', 'fruit', 279, 0.3, 4.7, 47.2, 8.4, 6.1, 79, 10, 81, 5, 'banana', 'banana'],
  ['holt-apples', 'Ябълки', 'Apples', 'fruit', 435, 0.0, 1.3, 56.5, 2.2, 9.1, 50, 6, 59, 4, 'apple', 'apple'],
  ['holt-oranges', 'Портокали', 'Oranges', 'fruit', 625, 0.6, 6.9, 50.6, 0.0, 12.5, 39, 7, 60, 3, 'orange', 'orange'],
  ['holt-croissant', 'Кроасан', 'Croissants', 'bakery', 61, 14.4, 6.1, 3.1, 18.6, 1.8, 74, 9, 79, 14, 'croissant', null],
  ['holt-cake', 'Шоколадова торта с глазура', 'Cake (chocolate, iced)', 'bakery', 64, 11.9, 4.3, 20.1, 10.5, 0.7, 56, 14, 82, 12, null, null],
  ['holt-doughnuts', 'Понички (с канела и захар)', 'Doughnuts', 'bakery', 65, 13.4, 4.3, 8.9, 17.0, 1.4, 63, 12, 74, 9, null, null],
  ['holt-cookies', 'Бисквити с шоколадови парченца', 'Cookies (chocolate chip)', 'bakery', 51, 10.9, 2.4, 18.7, 16.2, 1.0, 74, 11, 92, 15, null, null],
  ['holt-crackers', 'Воден крекер', 'Crackers (water crackers)', 'bakery', 58, 5.4, 5.8, 1.3, 40.2, 1.6, 118, 24, 87, 12, 'crackers', null, 'Тестван е воден крекер; в нашата база има солени бисквити (saltines) — сходни, но не идентични продукти.'],
  ['holt-mars', 'Шоколадов бар (Mars)', 'Mars Bar', 'snacks', 54, 9.4, 2.9, 36.7, 1.1, 1.7, 79, 13, 122, 15, null, null],
  ['holt-yogurt', 'Кисело мляко с ягоди (подсладено)', 'Yogurt (strawberry)', 'snacks', 241, 5.3, 11.8, 37.6, 0.0, 0.5, 62, 15, 115, 13, null, null, 'Тестван е подсладен плодов йогурт — стойността не се отнася за натурално кисело мляко.'],
  ['holt-icecream', 'Сладолед (ванилия)', 'Ice cream (vanilla)', 'snacks', 120, 13.4, 5.2, 25.8, 0.0, 0.0, 70, 19, 89, 13, 'ice-cream', 'iceCream'],
  ['holt-jellybeans', 'Желирани бонбони', 'Jellybeans', 'snacks', 88, 0.0, 5.3, 44.6, 11.5, 0.0, 118, 18, 160, 16, null, null],
  ['holt-peanuts', 'Фъстъци (печени, солени)', 'Peanuts (salted, roasted)', 'snacks', 38, 20.1, 9.6, 1.7, 3.7, 2.4, 12, 4, 20, 5, 'peanuts', null],
  ['holt-chips', 'Картофен чипс', 'Potato chips', 'snacks', 44, 16.2, 2.7, 0.2, 22.1, 2.4, 52, 9, 61, 14, 'potato-chips', 'crisps'],
  ['holt-popcorn', 'Пуканки', 'Popcorn', 'snacks', 47, 13.0, 4.6, 2.1, 25.3, 6.2, 62, 16, 54, 9, null, 'popcorn', 'Тестваните пуканки съдържат мазнина (13 г на порция) — не са въздушни пуканки без мазнина.'],
  ['holt-cheese', 'Сирене чедър', 'Cheese (cheddar)', 'protein', 59, 20.0, 15.0, 0.1, 0.0, 0.0, 55, 18, 45, 13, 'cheddar', null],
  ['holt-eggs', 'Яйца (поширани)', 'Eggs (poached)', 'protein', 159, 17.9, 19.6, 0.5, 0.0, 0.0, 42, 16, 31, 6, 'egg', null],
  ['holt-lentils', 'Леща в доматен сос', 'Lentils (in tomato sauce)', 'protein', 253, 4.6, 19.4, 4.2, 24.9, 11.4, 62, 22, 58, 12, 'lentils', 'lentils', 'Тествана е леща, сготвена с доматен сос, лук и зехтин.'],
  ['holt-bakedbeans', 'Боб в доматен сос', 'Baked beans', 'protein', 351, 1.7, 16.1, 16.1, 23.2, 16.8, 114, 18, 120, 19, 'baked-beans', null],
  ['holt-beef', 'Телешки стек (на скара)', 'Beef steak (grilled)', 'protein', 158, 7.7, 42.0, 0.0, 0.0, 0.0, 21, 8, 51, 16, 'beef-sirloin', null],
  ['holt-fish', 'Бяла риба (на пара)', 'Fish (steamed white fish)', 'protein', 333, 1.0, 56.3, 0.0, 0.0, 0.0, 28, 13, 59, 18, 'cod', null, 'Тествана е бяла риба на пара; в нашата база е свързана с треска.'],
  ['holt-whitebread', 'Бял хляб (референтна храна)', 'White bread', 'carb', 94, 2.1, 8.5, 1.8, 44.1, 3.3, 100, 0, 100, 0, 'bread-white', 'whiteBread', 'Референтна храна — по дефиниция = 100.'],
  ['holt-wholemeal', 'Пълнозърнест хляб', 'Whole-meal bread', 'carb', 101, 2.6, 7.6, 1.7, 43.7, 6.6, 97, 17, 96, 12, 'bread-ww', 'wholeWheatBread'],
  ['holt-grainbread', 'Ръжен хляб със зърна', 'Grain bread (rye kernels)', 'carb', 108, 5.4, 9.4, 2.4, 37.6, 6.5, 60, 12, 56, 6, 'bread-multigrain', 'grainBread', 'Тестван е хляб с цели ръжени зърна.'],
  ['holt-whiterice', 'Бял ориз', 'White rice', 'carb', 203, 0.5, 5.0, 0.1, 56.0, 0.4, 110, 15, 79, 12, 'rice-white', 'whiteRice'],
  ['holt-brownrice', 'Кафяв ориз', 'Brown rice', 'carb', 148, 2.1, 5.2, 0.5, 52.6, 1.4, 104, 18, 62, 11, 'rice-brown', 'brownRice'],
  ['holt-whitepasta', 'Бяла паста', 'White pasta', 'carb', 201, 0.8, 7.8, 2.0, 47.1, 3.5, 46, 10, 40, 5, 'pasta', 'spaghettiWhite'],
  ['holt-brownpasta', 'Пълнозърнеста паста', 'Brown pasta', 'carb', 218, 1.6, 11.3, 0.7, 47.8, 10.9, 68, 10, 40, 5, 'pasta-ww', 'spaghettiWholemeal'],
  ['holt-potatoes', 'Картофи (сварени)', 'Potatoes (boiled)', 'carb', 368, 1.0, 10.0, 3.1, 45.9, 9.2, 141, 35, 121, 11, 'potato-boiled', 'potatoBoiled'],
  ['holt-fries', 'Пържени картофи (във фурна)', 'French fries (oven-baked)', 'carb', 93, 8.7, 3.9, 1.1, 35.4, 3.5, 71, 16, 74, 12, 'french-fries', 'fries', 'Тествани са предварително пържени картофки, изпечени във фурна.'],
  ['holt-cornflakes', 'Корнфлейкс (с мляко)', 'Cornflakes', 'cereal', 170, 2.1, 8.4, 10.2, 36.1, 1.5, 76, 11, 75, 8, 'cornflakes', 'cornflakes', 'Всички закуски са сервирани със 125 мл мляко 1,5% (включено в порцията).'],
  ['holt-specialk', 'Special K (с мляко)', 'Special K', 'cereal', 172, 2.1, 15.3, 14.0, 27.2, 1.4, 70, 9, 66, 5, null, null, 'Сервирано със 125 мл мляко 1,5%.'],
  ['holt-honeysmacks', 'Honeysmacks (с мляко)', 'Honeysmacks', 'cereal', 172, 2.2, 8.7, 31.1, 17.0, 2.6, 60, 7, 67, 6, null, null, 'Сервирано със 125 мл мляко 1,5%.'],
  ['holt-sustain', 'Sustain (с мляко)', 'Sustain', 'cereal', 168, 3.1, 9.7, 13.7, 29.1, 3.2, 66, 6, 71, 6, null, null, 'Сервирано със 125 мл мляко 1,5%.'],
  ['holt-muesli', 'Мюсли (натурално, с мляко)', 'Muesli (natural)', 'cereal', 175, 6.1, 10.7, 17.1, 19.8, 6.6, 43, 7, 46, 5, null, null, 'Сервирано със 125 мл мляко 1,5%.'],
  ['holt-porridge', 'Овесена каша (с мляко)', 'Porridge (oatmeal)', 'cereal', 383, 6.2, 10.9, 7.5, 29.0, 4.7, 60, 12, 40, 4, 'oatmeal', 'porridge', 'Сервирано със 125 мл мляко 1,5%.'],
  ['holt-allbran', 'All-Bran (с мляко)', 'All-Bran', 'cereal', 174, 2.9, 11.7, 13.9, 29.4, 14.1, 40, 7, 32, 4, null, null, 'Сервирано със 125 мл мляко 1,5%.'],
];

// Bao et al. 2009 — Table 1. Включени са само храни, които не са в Holt 1997,
// плюс многозърнестия хляб (различен продукт с различна стойност).
// Стойностите за банан, кисело мляко, кроасан, яйца, пълнозърнест хляб, бисквити,
// сладолед, леща, телешко, картофи, паста, бял ориз и All-Bran в Table 1 са същите
// като в Holt 1997 (от същата база данни) и не се дублират.
// [id, име, тествана храна, група, публикувана порция г, kJ, белтък, мазнини, фибри, въгл., ГИ, FII, foodId, бележка]
const BAO = [
  ['bao-grainbread', 'Хляб със соя и ленено семе', 'Grain bread (Burgen Soy-Lin)', 'carb', 77.7, 786, 12.0, 5.4, 4.2, 23.2, 36, 71, 'bread-multigrain', 'Различен продукт от хляба в Holt 1997: съдържа пшеничен шрот, соя и ленено семе.'],
  ['bao-peanutbutter', 'Фъстъчено масло', 'Peanut butter (smooth)', 'protein', 25.0, 668, 5.8, 13.4, 2.9, 4.4, 14, 15, 'peanut-butter'],
  ['bao-milk', 'Прясно мляко (пълномаслено)', 'Full-fat milk', 'protein', 352, 1000, 12.0, 13.7, 0.0, 16.5, 31, 33, 'milk-whole'],
  ['bao-honeydew', 'Пъпеш (медена дюля)', 'Honeydew melon', 'fruit', 100, 140, 0.7, 0.3, 1.0, 6.5, 62, 127, null],
  ['bao-applejuice', 'Ябълков сок', 'Apple juice', 'drinks', 200, 340, 0.2, 0.0, 0.0, 20.2, 39, 64, null],
  ['bao-walnuts', 'Орехи', 'Walnuts', 'snacks', 44, 1276, 7.2, 29.6, 4.0, 1.6, null, 7, 'walnuts'],
  ['bao-raisins', 'Стафиди', 'Raisins', 'fruit', 28.3, 396, 0.7, 0.1, 1.2, 22.6, 64, 42, 'raisins'],
  ['bao-carrotjuice', 'Сок от моркови', 'Carrot juice', 'drinks', 250, 328, 2.0, 0.3, 0.8, 13.5, 47, 56, null],
  ['bao-jam', 'Конфитюр от малини', 'Raspberry jam', 'snacks', 30, 351, 0.0, 0.0, 0.0, 20.4, 51, 85, 'jam', 'Тестван е малинов конфитюр.'],
  ['bao-icetea', 'Студен чай (подсладен)', 'Ice tea', 'drinks', 214, 345, 0.0, 0.0, 0.0, 20.6, 59, 95, null],
  ['bao-chicken', 'Печено пиле', 'Roast chicken', 'protein', 75, 662, 20.2, 8.6, 0.0, 0.0, null, 23, 'chicken-breast', 'Тествано е печено пиле (частта не е уточнена) — може да се различава от чисти пилешки гърди.'],
  ['bao-avocado', 'Авокадо', 'Avocado', 'fruit', 40, 356, 0.8, 9.0, 0.6, 0.2, null, 6, 'avocado'],
  ['bao-tuna', 'Риба тон', 'Tuna', 'protein', 110, 815, 19.6, 12.3, 0.0, 1.8, null, 22, 'tuna-water', 'Тестваният продукт е съдържал ~11 г мазнини на 100 г — повече от риба тон в собствен сос.'],
  ['bao-corn', 'Царевица (замразена, зърна)', 'Corn (frozen kernels)', 'carb', 45, 204, 1.3, 0.7, 0.0, 8.7, 47, 53, 'corn'],
  ['bao-pizza', 'Пица (бяло тесто, доматен сос, сирене)', 'Pizza', 'snacks', 90, 1000, 12.4, 7.6, 0.0, 30.2, 60, 64, 'pizza'],
  ['bao-cola', 'Кола', 'Coca-Cola', 'drinks', 583, 1000, 0.0, 0.0, 0.0, 61.8, 53, 60, 'cola'],
];

// ГИ по скалата с глюкоза, Atkinson 2008 Table 1 (само ключовете, които се ползват тук).
const GI_2008 = {
  banana: 51, apple: 36, orange: 43, iceCream: 51, crisps: 56, popcorn: 65, lentils: 32,
  whiteBread: 75, wholeWheatBread: 74, grainBread: 53, whiteRice: 73, brownRice: 68,
  spaghettiWhite: 49, spaghettiWholemeal: 48, potatoBoiled: 78, fries: 63, cornflakes: 81, porridge: 55,
};

export const GROUPS = Object.freeze({
  fruit: 'Плодове',
  bakery: 'Тестени изделия',
  snacks: 'Снаксове и сладки',
  protein: 'Богати на белтък',
  carb: 'Богати на въглехидрати',
  cereal: 'Зърнени закуски',
  drinks: 'Напитки',
});

const r1 = (x) => Math.round(x * 10) / 10;

function fromHolt(row) {
  const [id, name, tested, group, grams, fat, protein, sugar, starch, fiber, gs, gsSem, ii, iiSem, foodId, giKey, note] = row;
  return Object.freeze({
    id,
    name,
    tested,
    group,
    groupLabel: GROUPS[group],
    ii,
    iiSem,
    glucoseScore: gs,
    glucoseScoreSem: gsSem,
    gi: giKey ? GI_2008[giKey] : null,
    giSource: giKey ? SOURCES.atkinson2008.id : null,
    per1000kJ: { grams: grams, kcal: 239, protein, fat, carbs: r1(sugar + starch), fiber },
    foodId: foodId || null,
    note: note || null,
    sourceId: SOURCES.holt1997.id,
    measurement: SOURCES.holt1997.basis,
  });
}

function fromBao(row) {
  const [id, name, tested, group, grams, kJ, protein, fat, fiber, carbs, gi, ii, foodId, note] = row;
  const k = 1000 / kJ;
  return Object.freeze({
    id,
    name,
    tested,
    group,
    groupLabel: GROUPS[group],
    ii,
    iiSem: null,
    glucoseScore: null,
    glucoseScoreSem: null,
    gi: gi ?? null,
    giSource: gi != null ? SOURCES.bao2009.id : null,
    per1000kJ: {
      grams: r1(grams * k),
      kcal: 239,
      protein: r1(protein * k),
      fat: r1(fat * k),
      carbs: r1(carbs * k),
      fiber: r1(fiber * k),
    },
    foodId: foodId || null,
    note: note || null,
    sourceId: SOURCES.bao2009.id,
    measurement: SOURCES.bao2009.basis,
  });
}

export const INSULIN_INDEX = Object.freeze([...HOLT.map(fromHolt), ...BAO.map(fromBao)]);

/** Всички измервания за дадена храна от базата данни (може да са няколко). */
export function insulinIndexForFood(foodId) {
  return INSULIN_INDEX.filter((e) => e.foodId === foodId);
}

/** Дали наличните стойности за храната се различават между изследвания/продукти. */
export function hasDisagreement(entries) {
  if (entries.length < 2) return false;
  const values = entries.map((e) => e.ii);
  return Math.max(...values) - Math.min(...values) >= 5;
}
