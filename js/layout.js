/**
 * Общо оформление: хедър, навигация, футър, тема, мобилно меню, подсказки.
 * Всяка страница съдържа <div id="site-header"></div> и <div id="site-footer"></div>.
 */
import { icon, hydrateIcons } from './icons.js';

export const NAV = [
  { href: 'index.html', label: 'Начало' },
  {
    label: 'Тренировки',
    href: 'workouts.html',
    children: [
      { href: 'workouts.html', label: 'Тренировъчни програми', desc: 'Готови седмични планове' },
      { href: 'exercises.html', label: 'Упражнения', desc: 'Библиотека с техника' },
    ],
  },
  { href: 'exercises.html', label: 'Упражнения', hideDesktop: true },
  {
    label: 'Хранене',
    href: 'nutrition.html',
    children: [
      { href: 'nutrition.html', label: 'Основи на храненето', desc: 'Енергия, макроси, хидратация' },
      { href: 'nutrition.html#recipes', label: 'Рецепти', desc: 'С изчислени макроси' },
      { href: 'calorie-calculator.html', label: 'Калориен калкулатор', desc: 'Персонален дневен прием', noActive: true },
    ],
  },
  {
    label: 'База данни храни',
    href: 'food-database.html',
    children: [
      { href: 'food-database.html', label: 'Хранителни стойности', desc: `Над 100 храни, данни от USDA` },
      { href: 'insulin-index.html', label: 'Инсулинов индекс', desc: 'Какво е и таблица с данни' },
    ],
  },
  {
    label: 'Добавки',
    href: 'supplements.html',
    children: [
      { href: 'supplements.html', label: 'Добавки', desc: 'Какво казват доказателствата' },
      { href: 'supplements.html#vitamins', label: 'Витамини и минерали', desc: 'Функции и източници' },
      { href: 'guides.html', label: 'Фитнес ръководства', desc: 'Кратки практични статии' },
    ],
  },
  {
    label: 'Калкулатори',
    href: 'calculators.html',
    children: [
      { href: 'calorie-calculator.html', label: 'Калориен калкулатор', desc: 'Основният ни инструмент' },
      { href: 'calculators.html#bmi', label: 'BMI калкулатор' },
      { href: 'calculators.html#bmr', label: 'BMR калкулатор' },
      { href: 'calculators.html#tdee', label: 'TDEE калкулатор' },
      { href: 'calculators.html#macro', label: 'Макро калкулатор' },
      { href: 'calculators.html#protein', label: 'Протеин калкулатор' },
      { href: 'calculators.html#one-rm', label: '1RM калкулатор' },
    ],
  },
  { href: 'progress.html', label: 'Прогрес' },
];

export const PILLARS = [
  {
    key: 'train',
    title: 'Тренирай',
    icon: 'dumbbell',
    links: [
      ['workouts.html', 'Тренировъчни програми'],
      ['exercises.html', 'Упражнения'],
      ['calculators.html#one-rm', '1RM калкулатор'],
    ],
  },
  {
    key: 'eat',
    title: 'Храни се',
    icon: 'utensils',
    links: [
      ['nutrition.html', 'Основи на храненето'],
      ['nutrition.html#recipes', 'Рецепти'],
      ['food-database.html', 'База данни храни'],
      ['calorie-calculator.html', 'Калориен калкулатор'],
    ],
  },
  {
    key: 'understand',
    title: 'Разбери',
    icon: 'book',
    links: [
      ['supplements.html', 'Добавки'],
      ['supplements.html#vitamins', 'Витамини'],
      ['insulin-index.html', 'Инсулинов индекс'],
      ['guides.html', 'Фитнес ръководства'],
    ],
  },
  {
    key: 'track',
    title: 'Следи',
    icon: 'chart',
    links: [
      ['progress.html', 'Прогрес и тегло'],
      ['progress.html#workouts', 'История на тренировките'],
      ['progress.html#goals', 'Цели'],
    ],
  },
];

const currentFile = () => {
  const f = location.pathname.split('/').pop();
  return f && f.length ? f : 'index.html';
};

function isCurrent(href) {
  const [file] = href.split('#');
  return file === currentFile() && !href.includes('#');
}

function isSectionActive(item) {
  if (item.href && isCurrent(item.href)) return true;
  return (item.children || []).some((c) => !c.noActive && c.href.split('#')[0] === currentFile());
}

const brand = `
  <a class="brand" href="index.html" aria-label="FitCompass — начало">
    <span class="brand-mark">${icon('compass')}</span>
    <span>Fit<b>Compass</b></span>
  </a>`;

function renderHeader() {
  const activeItem = NAV.filter((i) => !i.hideDesktop).find((i) => i.href && isCurrent(i.href)) ?? NAV.find(isSectionActive);
  const items = NAV.filter((i) => !i.hideDesktop)
    .map((item) => {
      const active = item === activeItem ? ' aria-current="page"' : '';
      if (!item.children) {
        return `<li class="nav-item"><a class="nav-link" href="${item.href}"${active}>${item.label}</a></li>`;
      }
      const sub = item.children
        .map(
          (c) =>
            `<li><a href="${c.href}"${isCurrent(c.href) ? ' aria-current="page"' : ''}>${c.label}${c.desc ? `<small>${c.desc}</small>` : ''}</a></li>`,
        )
        .join('');
      return `<li class="nav-item"><a class="nav-link" href="${item.href}"${active} aria-haspopup="true">${item.label}${icon('chevronDown')}</a><ul class="dropdown">${sub}</ul></li>`;
    })
    .join('');

  const mobileGroups = [
    { title: 'Основни', links: [['index.html', 'Начало'], ['calorie-calculator.html', 'Калориен калкулатор'], ['food-database.html', 'База данни храни'], ['progress.html', 'Прогрес']] },
    ...PILLARS.map((p) => ({ title: p.title, links: p.links })),
    { title: 'Калкулатори', links: NAV.find((n) => n.label === 'Калкулатори').children.map((c) => [c.href, c.label]) },
  ];
  const mobile = mobileGroups
    .map(
      (g) =>
        `<h4>${g.title}</h4>${g.links.map(([h, l]) => `<a href="${h}"${isCurrent(h) ? ' aria-current="page"' : ''}>${l}</a>`).join('')}`,
    )
    .join('');

  return `
  <a class="skip-link" href="#main">Към съдържанието</a>
  <header class="site-header">
    <div class="container header-inner">
      ${brand}
      <nav class="main-nav" aria-label="Основна навигация"><ul>${items}</ul></nav>
      <div class="header-actions">
        <a class="btn btn-primary btn-sm header-cta" href="calorie-calculator.html">${icon('flame')}Изчисли калориите</a>
        <button class="icon-btn theme-toggle" type="button" aria-label="Смени темата (светла/тъмна)" title="Светла / тъмна тема">
          ${icon('moon', 'i-moon')}${icon('sun', 'i-sun')}
        </button>
        <button class="icon-btn menu-toggle" type="button" aria-label="Меню" aria-expanded="false" aria-controls="mobile-nav">${icon('menu')}</button>
      </div>
    </div>
  </header>
  <nav class="mobile-nav" id="mobile-nav" aria-label="Мобилна навигация">${mobile}</nav>`;
}

function renderFooter() {
  const cols = PILLARS.map(
    (p) => `<div><h4>${p.title}</h4><ul>${p.links.map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join('')}</ul></div>`,
  ).join('');
  return `
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          ${brand}
          <p class="muted small" style="margin-top:12px;max-width:34ch">Безплатни инструменти и ясна информация за тренировки, хранене и прогрес.</p>
        </div>
        ${cols}
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} FitCompass. Информацията е с образователна цел и не е медицински съвет.</span>
        <span>Данни: <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noopener">USDA FoodData Central</a> · рецензирани изследвания</span>
      </div>
    </div>
  </footer>`;
}

// ---------- Тема ----------
const THEME_KEY = 'fc-theme';

function effectiveTheme() {
  const set = document.documentElement.getAttribute('data-theme');
  if (set) return set;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function toggleTheme() {
  const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* няма достъп до хранилището — темата важи само за сесията */
  }
  document.dispatchEvent(new CustomEvent('themechange', { detail: next }));
}

// ---------- Инициализация ----------
function initMenu() {
  const btn = document.querySelector('.menu-toggle');
  const nav = document.getElementById('mobile-nav');
  if (!btn || !nav) return;
  const set = (open) => {
    nav.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.innerHTML = icon(open ? 'x' : 'menu');
  };
  btn.addEventListener('click', () => set(!nav.classList.contains('open')));
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) set(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) set(false);
  });
  window.matchMedia('(min-width: 1080px)').addEventListener('change', (m) => m.matches && set(false));
}

function initTips(root = document) {
  root.querySelectorAll('.tip-btn').forEach((b) => {
    if (b.dataset.bound) return;
    b.dataset.bound = '1';
    b.addEventListener('click', (e) => {
      e.preventDefault();
      const tip = b.closest('.tip');
      const open = !tip.classList.contains('open');
      document.querySelectorAll('.tip.open').forEach((t) => t.classList.remove('open'));
      tip.classList.toggle('open', open);
      b.setAttribute('aria-expanded', String(open));
    });
  });
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.tip')) document.querySelectorAll('.tip.open').forEach((t) => t.classList.remove('open'));
});

function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    },
    { threshold: 0.08 },
  );
  els.forEach((el) => io.observe(el));
}

/** HTML за подсказка (ⓘ). */
export function tip(text, label = 'Какво означава това?') {
  return `<span class="tip"><button type="button" class="tip-btn" aria-label="${label}">i</button><span class="tip-body" role="tooltip">${text}</span></span>`;
}

export function initLayout() {
  const h = document.getElementById('site-header');
  const f = document.getElementById('site-footer');
  if (h) h.outerHTML = renderHeader();
  if (f) f.outerHTML = renderFooter();
  document.querySelector('.theme-toggle')?.addEventListener('click', toggleTheme);
  initMenu();
  hydrateIcons();
  initTips();
  initReveal();
}

export { initTips, hydrateIcons };

initLayout();
