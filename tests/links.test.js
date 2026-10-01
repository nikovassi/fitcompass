import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { EXERCISES } from '../data/exercises.js';
import { FOODS } from '../data/foods.js';

const root = new URL('..', import.meta.url).pathname;
const pages = readdirSync(root).filter((f) => f.endsWith('.html') && f !== '404.html');

test('всички вътрешни връзки сочат към съществуващи страници и секции', () => {
  const dynamicIds = new Set([...EXERCISES.map((e) => e.id), ...FOODS.map((f) => f.id)]);
  for (const page of pages) {
    const html = readFileSync(root + page, 'utf8');
    for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
      if (/^(https?:|mailto:|#$)/.test(href) || href.startsWith('https://fonts')) continue;
      const [pathPart, hash] = href.split('#');
      const file = pathPart.split('?')[0] || page;
      assert.ok(existsSync(root + file), `${page}: липсва ${file}`);
      if (hash && file.endsWith('.html')) {
        const target = readFileSync(root + file, 'utf8');
        const ok = target.includes(`id="${hash}"`) || target.includes(`data-tab="${hash}"`) || dynamicIds.has(hash);
        assert.ok(ok, `${page}: липсва #${hash} в ${file}`);
      }
    }
  }
});

test('всяка страница има lang="bg", заглавие, описание и скрипта за тема', () => {
  for (const page of pages) {
    const html = readFileSync(root + page, 'utf8');
    assert.match(html, /<html lang="bg">/, page);
    assert.match(html, /<title>[^<]{5,}<\/title>/, page);
    assert.match(html, /name="description"/, page);
    assert.match(html, /fc-theme/, page);
    assert.match(html, /id="site-header"/, page);
  }
});
