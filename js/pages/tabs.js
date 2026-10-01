/** Прости табове за статични страници: [role=tablist] с бутони data-tab="id на панела". */
document.querySelectorAll('[role=tablist]').forEach((list) => {
  const tabs = [...list.querySelectorAll('[role=tab]')];
  const show = (id) =>
    tabs.forEach((t) => {
      const on = t.dataset.tab === id;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const p = document.getElementById(t.dataset.tab);
      if (p) p.hidden = !on;
    });
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      const n = tabs[(i + d + tabs.length) % tabs.length];
      show(n.dataset.tab);
      n.focus();
    });
  });
  const hash = location.hash.slice(1);
  if (tabs.some((t) => t.dataset.tab === hash)) show(hash);
});
