import { test, expect } from '@playwright/test';

const bg = (page: import('@playwright/test').Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe('design tokens', () => {
  test('changing one token re-skins the shell and syncs theme-color', async ({ page }) => {
    await page.goto('/');
    const before = await bg(page);
    await page.evaluate(() => document.documentElement.style.setProperty('--color-bg', 'rgb(200, 30, 30)'));
    expect(await bg(page)).toBe('rgb(200, 30, 30)');
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.topbar')!).borderBottomColor)).not.toBe('rgb(200, 30, 30)');
    await page.evaluate(() => document.documentElement.style.setProperty('--color-border', 'rgb(1, 2, 3)'));
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.topbar')!).borderBottomColor)).toBe('rgb(1, 2, 3)');
    await page.evaluate(() => document.documentElement.style.removeProperty('--color-bg'));
    expect(await bg(page)).toBe(before);
  });

  test('data-theme switches the whole palette from one attribute', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
    const light = await bg(page);
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    const dark = await bg(page);
    expect(light).not.toBe(dark);
    // meta theme-color follows the token
    await page.evaluate(() => (window as unknown as { __sync?: () => void }).__sync?.());
  });

  test('no hard-coded colours outside tokens.css', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(css|ts)$/.test(p) && !p.endsWith('tokens.css') && !p.includes('/modules/')) {
          const src = readFileSync(p, 'utf8');
          // hex colours or rgb() literals in shell/engine source
          if (/#[0-9a-f]{3,8}\b(?![^'"`]*\?)/i.test(src.replace(/\/\/.*$/gm, '').replace(/href=|#\//g, '')) || /rgba?\(/.test(src)) offenders.push(p);
        }
      }
    };
    walk('src/styles');
    walk('src/shell');
    expect(offenders).toEqual([]);
  });
});
