/**
 * База данни с храни.
 *
 * Хранителни стойности: USDA FoodData Central, SR Legacy (2018) — стойности на 100 г,
 * извлечени директно от официалния CSV набор. Всеки запис пази fdcId, за да може
 * стойността да се провери в USDA.
 *
 * Гликемичен индекс (ГИ): само измерени стойности от Atkinson et al. 2008 (Table 1).
 * Ако храната не е в таблицата — ГИ е "няма данни". Ако храната почти няма
 * въглехидрати (< 5 г/100 г) — ГИ е "неприложим" (не може да бъде тестван).
 *
 * Инсулинов индекс: НЕ се съхранява тук. Той идва само от data/insulin-index.js
 * (измервания от рецензирани изследвания) и се свързва чрез `foodId`.
 *
 * Размер на порцията: типична порция, определена от редакцията (не е от USDA).
 */
import { SOURCES } from './sources.js';

export const CATEGORIES = Object.freeze({
  meat: 'Месо и птици',
  fish: 'Риба и морски дарове',
  dairy: 'Яйца и млечни',
  grains: 'Зърнени и хляб',
  starchy: 'Картофи и царевица',
  fruit: 'Плодове',
  veg: 'Зеленчуци',
  legumes: 'Бобови',
  nuts: 'Ядки и семена',
  fats: 'Мазнини и масла',
  sweets: 'Сладко и десерти',
  fastfood: 'Бързи храни и снаксове',
  drinks: 'Напитки',
});

/**
 * ГИ стойности (глюкоза = 100) от Atkinson et al. 2008, Table 1.
 * `tested` е името на храната в таблицата — показва се, когато се различава
 * от записа в нашата база (напр. овесени ядки → овесена каша).
 */
const GI = {
  whiteBread: { value: 75, tested: 'White wheat bread' },
  wholeWheatBread: { value: 74, tested: 'Whole wheat/whole meal bread' },
  grainBread: { value: 53, tested: 'Specialty grain bread' },
  whiteRice: { value: 73, tested: 'White rice, boiled' },
  brownRice: { value: 68, tested: 'Brown rice, boiled' },
  barley: { value: 28, tested: 'Barley' },
  sweetCorn: { value: 52, tested: 'Sweet corn' },
  spaghettiWhite: { value: 49, tested: 'Spaghetti, white' },
  spaghettiWholemeal: { value: 48, tested: 'Spaghetti, whole meal' },
  riceNoodles: { value: 53, tested: 'Rice noodles' },
  couscous: { value: 65, tested: 'Couscous' },
  cornflakes: { value: 81, tested: 'Cornflakes' },
  porridge: { value: 55, tested: 'Porridge, rolled oats', note: 'Стойността е за овесена каша от овесени ядки.' },
  apple: { value: 36, tested: 'Apple, raw' },
  orange: { value: 43, tested: 'Orange, raw' },
  banana: { value: 51, tested: 'Banana, raw' },
  pineapple: { value: 59, tested: 'Pineapple, raw' },
  mango: { value: 51, tested: 'Mango, raw' },
  watermelon: { value: 76, tested: 'Watermelon, raw' },
  dates: { value: 42, tested: 'Dates, raw' },
  orangeJuice: { value: 50, tested: 'Orange juice' },
  potatoBoiled: { value: 78, tested: 'Potato, boiled' },
  fries: { value: 63, tested: 'Potato, french fries' },
  carrotsBoiled: { value: 39, tested: 'Carrots, boiled', note: 'Стойността е за варени моркови.' },
  sweetPotato: { value: 63, tested: 'Sweet potato, boiled', note: 'Стойността е за варен сладък картоф.' },
  milkFull: { value: 39, tested: 'Milk, full fat' },
  iceCream: { value: 51, tested: 'Ice cream' },
  chickpeas: { value: 28, tested: 'Chickpeas' },
  kidneyBeans: { value: 24, tested: 'Kidney beans' },
  lentils: { value: 32, tested: 'Lentils' },
  chocolate: { value: 40, tested: 'Chocolate', note: 'Стойността е за шоколад като цяло, не специално за черен.' },
  popcorn: { value: 65, tested: 'Popcorn' },
  crisps: { value: 56, tested: 'Potato crisps' },
  soda: { value: 59, tested: 'Soft drink/soda' },
  sucrose: { value: 65, tested: 'Sucrose' },
  honey: { value: 61, tested: 'Honey' },
  jam: { value: 49, tested: 'Strawberry jam/jelly', note: 'Стойността е за ягодов конфитюр.' },
};

// [id, име, английско име, допълнителни търсения, категория, fdcId, kcal, белтък, въгл., мазн., фибри, порция г, порция описание, ГИ ключ]
const ROWS = [
  // Месо и птици
  ['chicken-breast', 'Пилешки гърди (печени, без кожа)', 'Chicken breast', 'пиле пилешко филе chicken', 'meat', 171477, 165, 31.02, 0, 3.57, 0, 150, '1 филе', null],
  ['chicken-thigh', 'Пилешко бутче (печено, без кожа)', 'Chicken thigh', 'пиле пилешко chicken', 'meat', 172388, 179, 24.76, 0, 8.15, 0, 120, '1 бутче без кост', null],
  ['turkey-breast', 'Пуешки гърди (печени)', 'Turkey breast', 'пуйка пуешко turkey', 'meat', 174516, 136, 29.51, 0, 1.97, 0, 150, '1 порция', null],
  ['ground-beef-90', 'Телешка кайма 90/10 (запечена)', 'Ground beef 90% lean', 'телешко говеждо кайма beef', 'meat', 171794, 230, 28.45, 0, 12.04, 0, 125, '1 порция', null],
  ['beef-sirloin', 'Телешки стек (филе от бут, на скара)', 'Beef top sirloin steak', 'телешко говеждо пържола стек beef steak', 'meat', 168634, 183, 30.55, 0, 5.79, 0, 150, '1 стек', null],
  ['pork-tenderloin', 'Свинско филе (печено)', 'Pork tenderloin', 'свинско pork', 'meat', 168250, 143, 26.17, 0, 3.51, 0, 150, '1 порция', null],
  ['pork-chop', 'Свинска пържола (на скара, постна част)', 'Pork loin chop', 'свинско пържола pork', 'meat', 168240, 180, 26.76, 0, 7.29, 0, 150, '1 пържола без кост', null],
  ['ham', 'Шунка (нарязана)', 'Ham, sliced', 'шунка колбас ham', 'meat', 173864, 164, 16.6, 3.63, 8.8, 1.3, 30, '2 резена', null],
  // Риба
  ['salmon', 'Сьомга (атлантическа, ферма, печена)', 'Salmon, Atlantic, farmed', 'риба сьомга salmon', 'fish', 175168, 206, 22.1, 0, 12.35, 0, 150, '1 филе', null],
  ['tuna-water', 'Риба тон консерва (в собствен сос, отцедена)', 'Tuna, light, canned in water', 'риба тон консерва tuna', 'fish', 173709, 86, 19.44, 0, 0.96, 0, 100, '1 консерва (отцедена)', null],
  ['cod', 'Треска (печена)', 'Cod, Atlantic', 'риба треска бяла риба cod fish', 'fish', 171956, 105, 22.83, 0, 0.86, 0, 150, '1 филе', null],
  ['mackerel', 'Скумрия (печена)', 'Mackerel, Atlantic', 'риба скумрия mackerel', 'fish', 175120, 262, 23.85, 0, 17.81, 0, 120, '1 филе', null],
  ['shrimp', 'Скариди (сварени)', 'Shrimp, cooked', 'скариди морски дарове shrimp', 'fish', 175180, 99, 23.98, 0.2, 0.28, 0, 100, '1 порция', null],
  // Яйца и млечни
  ['egg', 'Яйце (твърдо сварено)', 'Egg, whole, hard-boiled', 'яйца яйце egg eggs', 'dairy', 173424, 155, 12.58, 1.12, 10.61, 0, 50, '1 голямо яйце', null],
  ['egg-white', 'Яйчен белтък', 'Egg white', 'белтък яйце egg white', 'dairy', 172183, 52, 10.9, 0.73, 0.17, 0, 33, '1 белтък', null],
  ['greek-yogurt', 'Гръцко кисело мляко (0%, натурално)', 'Greek yogurt, plain, nonfat', 'кисело мляко гръцко йогурт greek yogurt', 'dairy', 170894, 59, 10.19, 3.6, 0.39, 0, 170, '1 кофичка', null],
  ['yogurt-lowfat', 'Кисело мляко (нискомаслено, натурално)', 'Yogurt, plain, low fat', 'кисело мляко йогурт yogurt', 'dairy', 170886, 63, 5.25, 7.04, 1.55, 0, 200, '1 купичка', null],
  ['yogurt-whole', 'Кисело мляко (пълномаслено, натурално)', 'Yogurt, plain, whole milk', 'кисело мляко йогурт yogurt', 'dairy', 171284, 61, 3.47, 4.66, 3.25, 0, 200, '1 купичка', null],
  ['milk-whole', 'Прясно мляко 3,25%', 'Milk, whole 3.25%', 'мляко прясно milk', 'dairy', 171265, 61, 3.15, 4.8, 3.25, 0, 250, '1 чаша (250 мл)', 'milkFull'],
  ['milk-1', 'Прясно мляко 1%', 'Milk, lowfat 1%', 'мляко прясно нискомаслено milk', 'dairy', 170872, 42, 3.37, 4.99, 0.97, 0, 250, '1 чаша (250 мл)', null],
  ['cottage', 'Извара / котидж сирене 2%', 'Cottage cheese, lowfat 2%', 'извара котидж cottage cheese', 'dairy', 172182, 81, 10.45, 4.76, 2.27, 0, 150, '1/2 кутия', null],
  ['feta', 'Сирене тип фета', 'Feta cheese', 'сирене фета бяло сирене feta cheese', 'dairy', 173420, 265, 14.21, 3.88, 21.49, 0, 30, '1 парче', null],
  ['cheddar', 'Чедър', 'Cheddar cheese', 'кашкавал сирене чедър cheddar cheese', 'dairy', 173414, 403, 22.87, 3.37, 33.31, 0, 30, '1 резен', null],
  ['mozzarella', 'Моцарела (частично обезмаслена)', 'Mozzarella, part skim', 'моцарела сирене mozzarella cheese', 'dairy', 170847, 254, 24.26, 2.77, 15.92, 0, 30, '1 порция', null],
  // Зърнени и хляб
  ['rice-white', 'Бял ориз (сварен)', 'White rice, long-grain, cooked', 'ориз бял rice', 'grains', 168878, 130, 2.69, 28.17, 0.28, 0.4, 150, '1 порция сварен', 'whiteRice'],
  ['rice-brown', 'Кафяв ориз (сварен)', 'Brown rice, cooked', 'ориз кафяв пълнозърнест rice', 'grains', 169704, 123, 2.74, 25.58, 0.97, 1.6, 150, '1 порция сварен', 'brownRice'],
  ['rice-parboiled', 'Ориз, обработен на пара (сварен)', 'Parboiled rice, cooked', 'ориз пара rice parboiled', 'grains', 169708, 123, 2.91, 26.05, 0.37, 0.9, 150, '1 порция сварен', null],
  ['rice-short', 'Бял ориз, кръглозърнест (сварен)', 'White rice, short-grain, cooked', 'ориз кръгъл суши rice', 'grains', 168882, 130, 2.36, 28.73, 0.19, null, 150, '1 порция сварен', null],
  ['rice-wild', 'Див ориз (сварен)', 'Wild rice, cooked', 'ориз див rice wild', 'grains', 168897, 101, 3.99, 21.34, 0.34, 1.8, 150, '1 порция сварен', null],
  ['rice-noodles', 'Оризови нудли (сварени)', 'Rice noodles, cooked', 'нудли ориз rice noodles', 'grains', 168914, 108, 1.79, 24.01, 0.2, 1, 180, '1 порция', 'riceNoodles'],
  ['oats', 'Овесени ядки (сухи)', 'Oats, rolled, dry', 'овес овесени ядки oats oatmeal', 'grains', 173904, 379, 13.15, 67.7, 6.52, 10.1, 40, '4 с.л.', 'porridge'],
  ['oatmeal', 'Овесена каша (сварена с вода)', 'Oatmeal, cooked with water', 'овесена каша порич oatmeal porridge', 'grains', 173905, 71, 2.54, 12, 1.52, 1.7, 250, '1 купа', 'porridge'],
  ['pasta', 'Паста / спагети (сварени)', 'Pasta, cooked', 'паста спагети макарони pasta spaghetti', 'grains', 169737, 158, 5.8, 30.86, 0.93, 1.8, 180, '1 порция сварена', 'spaghettiWhite'],
  ['pasta-ww', 'Пълнозърнеста паста (сварена)', 'Whole-wheat pasta, cooked', 'паста пълнозърнеста спагети pasta', 'grains', 168910, 149, 5.99, 30.07, 1.71, 3.9, 180, '1 порция сварена', 'spaghettiWholemeal'],
  ['bread-ww', 'Пълнозърнест хляб', 'Whole-wheat bread', 'хляб пълнозърнест bread', 'grains', 172688, 252, 12.45, 42.71, 3.5, 6, 30, '1 филия', 'wholeWheatBread'],
  ['bread-white', 'Бял хляб', 'White bread', 'хляб бял bread', 'grains', 174924, 266, 8.85, 49.42, 3.33, 2.7, 30, '1 филия', 'whiteBread'],
  ['bread-multigrain', 'Многозърнест хляб', 'Multi-grain bread', 'хляб многозърнест зърнест bread', 'grains', 168013, 265, 13.36, 43.34, 4.23, 7.4, 30, '1 филия', 'grainBread'],
  ['bread-rye', 'Ръжен хляб', 'Rye bread', 'хляб ръжен bread rye', 'grains', 172684, 259, 8.5, 48.3, 3.3, 5.8, 32, '1 филия', null],
  ['pita', 'Питка / пита (бяла)', 'Pita bread, white', 'пита питка хляб pita', 'grains', 174915, 275, 9.1, 55.7, 1.2, 2.2, 60, '1 пита', null],
  ['tortilla', 'Тортила (пшенична)', 'Flour tortilla', 'тортила питка tortilla wrap', 'grains', 175037, 306, 8.2, 49.38, 7.99, 3.5, 49, '1 тортила (25 см)', null],
  ['bagel', 'Геврек тип бейгъл', 'Bagel, plain', 'геврек бейгъл bagel', 'grains', 174899, 264, 10.56, 52.38, 1.32, 1.6, 100, '1 бейгъл', null],
  ['quinoa', 'Киноа (сварена)', 'Quinoa, cooked', 'киноа quinoa', 'grains', 168917, 120, 4.4, 21.3, 1.92, 2.8, 150, '1 порция', null],
  ['couscous', 'Кускус (сварен)', 'Couscous, cooked', 'кускус couscous', 'grains', 169700, 112, 3.79, 23.22, 0.16, 1.4, 150, '1 порция', 'couscous'],
  ['bulgur', 'Булгур (сварен)', 'Bulgur, cooked', 'булгур bulgur', 'grains', 170287, 83, 3.08, 18.58, 0.24, 4.5, 150, '1 порция', null],
  ['buckwheat', 'Елда (сварена)', 'Buckwheat groats, cooked', 'елда хељда buckwheat', 'grains', 170686, 92, 3.38, 19.94, 0.62, 2.7, 150, '1 порция', null],
  ['barley', 'Перлен ечемик (сварен)', 'Pearled barley, cooked', 'ечемик barley', 'grains', 170285, 123, 2.26, 28.22, 0.44, 3.8, 150, '1 порция', 'barley'],
  ['cornflakes', 'Корнфлейкс', 'Corn flakes cereal', 'зърнена закуска корнфлейкс cereal cornflakes', 'grains', 174648, 384, 5.9, 88.01, 0.91, 2.7, 30, '1 купичка (сухи)', 'cornflakes'],
  ['granola', 'Гранола (домашна)', 'Granola, homemade', 'гранола мюсли зърнена закуска cereal granola', 'grains', 171646, 489, 13.67, 53.88, 24.31, 8.9, 50, '1/2 чаша', null],
  ['rice-cakes', 'Оризовки (кафяв ориз)', 'Rice cakes, brown rice', 'оризовки ориз rice cakes', 'grains', 170250, 387, 8.2, 81.5, 2.8, 4.2, 9, '1 оризовка', null],
  ['crackers', 'Солени бисквити / крекери', 'Saltine crackers', 'крекери солети бисквити crackers', 'grains', 172746, 418, 9.46, 74.05, 8.64, 2.8, 30, '10 броя', null],
  ['croissant', 'Кроасан с масло', 'Croissant, butter', 'кроасан croissant', 'grains', 174987, 406, 8.2, 45.8, 21, 2.6, 57, '1 среден', null],
  // Картофи и царевица
  ['potato-boiled', 'Картофи (сварени, без кора)', 'Potatoes, boiled', 'картофи картоф potato potatoes', 'starchy', 170440, 86, 1.71, 20.01, 0.1, 1.8, 200, '1 голям картоф', 'potatoBoiled'],
  ['sweet-potato', 'Сладък картоф (печен)', 'Sweet potato, baked', 'сладък картоф батат sweet potato', 'starchy', 168483, 90, 2.01, 20.71, 0.15, 3.3, 150, '1 среден', 'sweetPotato'],
  ['corn', 'Сладка царевица (сварена)', 'Sweet corn, boiled', 'царевица corn', 'starchy', 169999, 96, 3.41, 20.98, 1.5, 2.4, 100, '1/2 кочан / 1/2 чаша', 'sweetCorn'],
  // Плодове
  ['banana', 'Банан', 'Banana', 'банан banana', 'fruit', 173944, 89, 1.09, 22.84, 0.33, 2.6, 120, '1 среден (без кора)', 'banana'],
  ['apple', 'Ябълка (с кора)', 'Apple, with skin', 'ябълка apple', 'fruit', 171688, 52, 0.26, 13.81, 0.17, 2.4, 180, '1 средна', 'apple'],
  ['orange', 'Портокал', 'Orange', 'портокал orange', 'fruit', 169097, 47, 0.94, 11.75, 0.12, 2.4, 150, '1 среден', 'orange'],
  ['pear', 'Круша', 'Pear', 'круша pear', 'fruit', 169118, 57, 0.36, 15.23, 0.14, 3.1, 180, '1 средна', null],
  ['peach', 'Праскова', 'Peach', 'праскова peach', 'fruit', 169928, 39, 0.91, 9.54, 0.25, 1.5, 150, '1 средна', null],
  ['cherries', 'Череши', 'Sweet cherries', 'череши cherries', 'fruit', 171719, 63, 1.06, 16.01, 0.2, 2.1, 140, '1 чаша', null],
  ['strawberries', 'Ягоди', 'Strawberries', 'ягоди strawberry strawberries', 'fruit', 167762, 32, 0.67, 7.68, 0.3, 2, 150, '1 купичка', null],
  ['blueberries', 'Боровинки', 'Blueberries', 'боровинки blueberry blueberries', 'fruit', 171711, 57, 0.74, 14.49, 0.33, 2.4, 100, '2/3 чаша', null],
  ['grapes', 'Грозде', 'Grapes', 'грозде grapes', 'fruit', 174683, 69, 0.72, 18.1, 0.16, 0.9, 100, '1 чепка (малка)', null],
  ['avocado', 'Авокадо', 'Avocado', 'авокадо avocado', 'fruit', 171705, 160, 2, 8.53, 14.66, 6.7, 70, '1/2 авокадо', null],
  ['mango', 'Манго', 'Mango', 'манго mango', 'fruit', 169910, 60, 0.82, 14.98, 0.38, 1.6, 150, '1/2 плод', 'mango'],
  ['pineapple', 'Ананас', 'Pineapple', 'ананас pineapple', 'fruit', 169124, 50, 0.54, 13.12, 0.12, 1.4, 150, '1 чаша на кубчета', 'pineapple'],
  ['watermelon', 'Диня', 'Watermelon', 'диня watermelon', 'fruit', 167765, 30, 0.61, 7.55, 0.15, 0.4, 250, '1 резен', 'watermelon'],
  ['kiwi', 'Киви', 'Kiwi', 'киви kiwi', 'fruit', 168153, 61, 1.14, 14.66, 0.52, 3, 75, '1 плод', null],
  ['dates', 'Фурми (меджул)', 'Medjool dates', 'фурми дати dates', 'fruit', 168191, 277, 1.81, 74.97, 0.15, 6.7, 24, '1 фурма', 'dates'],
  ['raisins', 'Стафиди', 'Raisins', 'стафиди raisins', 'fruit', 168165, 299, 3.3, 79.32, 0.25, 4.5, 30, '1 шепа', null],
  // Зеленчуци
  ['broccoli', 'Броколи (сурови)', 'Broccoli, raw', 'броколи broccoli', 'veg', 170379, 34, 2.82, 6.64, 0.37, 2.6, 100, '1 чаша', null],
  ['cauliflower', 'Карфиол (суров)', 'Cauliflower, raw', 'карфиол cauliflower', 'veg', 169986, 25, 1.92, 4.97, 0.28, 2, 100, '1 чаша', null],
  ['carrot', 'Морков (суров)', 'Carrot, raw', 'морков моркови carrot carrots', 'veg', 170393, 41, 0.93, 9.58, 0.24, 2.8, 60, '1 среден', 'carrotsBoiled'],
  ['tomato', 'Домат', 'Tomato', 'домат домати tomato tomatoes', 'veg', 170457, 18, 0.88, 3.89, 0.2, 1.2, 120, '1 среден', null],
  ['cucumber', 'Краставица (с кора)', 'Cucumber', 'краставица краставици cucumber', 'veg', 168409, 15, 0.65, 3.63, 0.11, 0.5, 150, '1/2 голяма', null],
  ['pepper-red', 'Червена чушка', 'Red bell pepper', 'чушка пипер чушки pepper', 'veg', 170108, 26, 0.99, 6.03, 0.3, 2.1, 120, '1 средна', null],
  ['spinach', 'Спанак (суров)', 'Spinach, raw', 'спанак spinach', 'veg', 168462, 23, 2.86, 3.63, 0.39, 2.2, 30, '1 шепа', null],
  ['lettuce', 'Зелена салата', 'Green leaf lettuce', 'салата маруля lettuce', 'veg', 169249, 15, 1.36, 2.87, 0.15, 1.3, 50, '1 купичка листа', null],
  ['cabbage', 'Зеле (сурово)', 'Cabbage, raw', 'зеле cabbage', 'veg', 169975, 25, 1.28, 5.8, 0.1, 2.5, 100, '1 чаша нарязано', null],
  ['zucchini', 'Тиквичка (сурова)', 'Zucchini, raw', 'тиквичка тиквички zucchini', 'veg', 169291, 17, 1.21, 3.11, 0.32, 1, 150, '1 средна', null],
  ['onion', 'Лук (суров)', 'Onion, raw', 'лук onion', 'veg', 170000, 40, 1.1, 9.34, 0.1, 1.7, 100, '1 среден', null],
  ['mushrooms', 'Гъби печурки (сурови)', 'White mushrooms, raw', 'гъби печурки mushrooms', 'veg', 169251, 22, 3.09, 3.26, 0.34, 1, 100, '1 чаша', null],
  ['peas', 'Грах (замразен, сварен)', 'Green peas, boiled', 'грах peas', 'veg', 170017, 78, 5.15, 14.26, 0.27, 4.5, 80, '1/2 чаша', null],
  // Бобови
  ['lentils', 'Леща (сварена)', 'Lentils, boiled', 'леща lentils', 'legumes', 172421, 116, 9.02, 20.13, 0.38, 7.9, 180, '1 порция', 'lentils'],
  ['beans-white', 'Бял боб (сварен)', 'White beans, boiled', 'боб бял фасул beans', 'legumes', 175203, 139, 9.73, 25.09, 0.35, 6.3, 180, '1 порция', null],
  ['beans-kidney', 'Червен боб (сварен)', 'Kidney beans, boiled', 'боб червен beans kidney', 'legumes', 173740, 127, 8.67, 22.8, 0.5, 6.4, 180, '1 порция', 'kidneyBeans'],
  ['beans-black', 'Черен боб (сварен)', 'Black beans, boiled', 'боб черен beans black', 'legumes', 173735, 132, 8.86, 23.71, 0.54, 8.7, 170, '1 порция', null],
  ['chickpeas', 'Нахут (сварен)', 'Chickpeas, boiled', 'нахут chickpeas garbanzo', 'legumes', 173757, 164, 8.86, 27.42, 2.59, 7.6, 160, '1 порция', 'chickpeas'],
  ['baked-beans', 'Боб в доматен сос (консерва)', 'Baked beans, canned', 'боб консерва baked beans', 'legumes', 175182, 94, 4.75, 21.14, 0.37, 4.1, 130, '1/2 консерва', null],
  ['hummus', 'Хумус', 'Hummus', 'хумус нахут hummus', 'legumes', 174289, 237, 7.78, 15, 17.82, 5.5, 30, '2 с.л.', null],
  ['tofu', 'Тофу (твърдо)', 'Tofu, firm', 'тофу соя tofu', 'legumes', 172448, 78, 9.04, 2.85, 4.17, 0.9, 100, '1 порция', null],
  // Ядки и семена
  ['almonds', 'Бадеми', 'Almonds', 'бадем бадеми almonds nuts', 'nuts', 170567, 579, 21.15, 21.55, 49.93, 12.5, 28, '1 шепа (~23 бр.)', null],
  ['walnuts', 'Орехи', 'Walnuts', 'орех орехи walnuts nuts', 'nuts', 170187, 654, 15.23, 13.71, 65.21, 6.7, 28, '1 шепа (~7 цели)', null],
  ['cashews', 'Кашу (сурово)', 'Cashews, raw', 'кашу cashew nuts', 'nuts', 170162, 553, 18.22, 30.19, 43.85, 3.3, 28, '1 шепа', null],
  ['peanuts', 'Фъстъци (печени, несолени)', 'Peanuts, dry-roasted', 'фъстъци фъстък peanuts', 'nuts', 173806, 587, 24.35, 21.26, 49.66, 8.4, 28, '1 шепа', null],
  ['peanut-butter', 'Фъстъчено масло', 'Peanut butter, smooth', 'фъстъчено масло peanut butter', 'nuts', 172470, 598, 22.21, 22.31, 51.36, 5, 16, '1 с.л.', null],
  ['sunflower-seeds', 'Слънчогледови семки (белени, печени)', 'Sunflower seed kernels, roasted', 'семки слънчоглед sunflower seeds', 'nuts', 170563, 582, 19.33, 24.07, 49.8, 11.1, 28, '1 шепа', null],
  ['pumpkin-seeds', 'Тиквени семки (белени)', 'Pumpkin seed kernels', 'тиквени семки pumpkin seeds', 'nuts', 170556, 559, 30.23, 10.71, 49.05, 6, 28, '1 шепа', null],
  ['chia', 'Чиа семена', 'Chia seeds', 'чиа семена chia', 'nuts', 170554, 486, 16.54, 42.12, 30.74, 34.4, 12, '1 с.л.', null],
  // Мазнини
  ['olive-oil', 'Зехтин', 'Olive oil', 'зехтин олио маслиново olive oil', 'fats', 171413, 884, 0, 0, 100, 0, 13.5, '1 с.л.', null],
  ['sunflower-oil', 'Слънчогледово олио', 'Sunflower oil', 'олио слънчогледово sunflower oil', 'fats', 171017, 884, 0, 0, 100, 0, 13.6, '1 с.л.', null],
  ['butter', 'Масло (краве, солено)', 'Butter, salted', 'масло краве butter', 'fats', 173410, 717, 0.85, 0.06, 81.11, 0, 10, '1 ч.л. с връх', null],
  // Сладко
  ['dark-chocolate', 'Черен шоколад 70–85%', 'Dark chocolate 70–85%', 'шоколад черен chocolate', 'sweets', 170273, 598, 7.79, 45.9, 42.63, 10.9, 20, '2 блокчета', 'chocolate'],
  ['honey', 'Мед', 'Honey', 'мед honey', 'sweets', 169640, 304, 0.3, 82.4, 0, 0.2, 21, '1 с.л.', 'honey'],
  ['sugar', 'Захар (бяла)', 'Sugar, granulated', 'захар sugar', 'sweets', 169655, 387, 0, 99.98, 0, 0, 4, '1 ч.л.', 'sucrose'],
  ['jam', 'Конфитюр / сладко', 'Jam and preserves', 'конфитюр мармалад сладко jam', 'sweets', 169641, 278, 0.37, 68.86, 0.07, 1.1, 20, '1 с.л.', 'jam'],
  ['ice-cream', 'Сладолед (ванилия)', 'Ice cream, vanilla', 'сладолед ice cream', 'sweets', 167575, 207, 3.5, 23.6, 11, 0.7, 66, '1 топка', 'iceCream'],
  // Бързи храни и снаксове
  ['pizza', 'Пица с кашкавал (замразена, изпечена)', 'Pizza, cheese, regular crust', 'пица pizza', 'fastfood', 170317, 268, 10.36, 29.02, 12.28, 2.2, 107, '1 парче', null],
  ['french-fries', 'Пържени картофи (фаст фуд)', 'French fries, fast food', 'картофки пържени картофи фри french fries', 'fastfood', 170698, 312, 3.43, 41.44, 14.73, 3.8, 117, '1 средна порция', 'fries'],
  ['potato-chips', 'Картофен чипс (солен)', 'Potato chips, salted', 'чипс crisps chips', 'fastfood', 169677, 532, 6.39, 53.83, 33.98, 3.1, 28, '1 малък плик', 'crisps'],
  ['popcorn', 'Пуканки (без мазнина)', 'Popcorn, air-popped', 'пуканки popcorn', 'fastfood', 170246, 382, 12, 77.9, 4.2, 15.1, 24, '3 чаши', 'popcorn'],
  // Напитки
  ['orange-juice', 'Портокалов сок (фреш)', 'Orange juice, fresh', 'сок портокалов фреш orange juice', 'drinks', 169098, 45, 0.7, 10.4, 0.2, 0.2, 250, '1 чаша (250 мл)', 'orangeJuice'],
  ['cola', 'Кола (с захар)', 'Cola, regular', 'кола газирана напитка cola soda', 'drinks', 174852, 42, 0, 10.36, 0.25, 0, 330, '1 кенче (330 мл)', 'soda'],
];

function buildFood(row) {
  const [id, name, nameEn, aliases, category, fdcId, kcal, protein, carbs, fat, fiber, servingG, servingLabel, giKey] = row;
  const per100 = { kcal, protein, carbs, fat, fiber };
  let gi;
  if (giKey) {
    gi = { status: 'measured', ...GI[giKey], sourceId: SOURCES.atkinson2008.id };
  } else if (per100.carbs < 5) {
    gi = { status: 'na', value: null };
  } else {
    gi = { status: 'nodata', value: null };
  }
  return Object.freeze({
    id,
    name,
    nameEn,
    aliases,
    category,
    categoryLabel: CATEGORIES[category],
    per100,
    serving: { grams: servingG, label: servingLabel },
    gi,
    source: {
      id: SOURCES.usda.id,
      fdcId,
      url: `https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients`,
    },
  });
}

export const FOODS = Object.freeze(ROWS.map(buildFood));

export function getFood(id) {
  return FOODS.find((f) => f.id === id);
}
