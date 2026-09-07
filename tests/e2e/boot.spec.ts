import { test, expect } from '@playwright/test';

test.describe('boot fallback', () => {
  test('is removed once the shell renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="tool-grid"] .tool-card')).toHaveCount(6);
    await expect(page.locator('#boot')).toHaveCount(0);
  });

  test('a script that fails to load is reported, not a blank page', async ({ page }) => {
    await page.route(/\/assets\/index-[^/]+\.js$/, (route) => route.abort());
    await page.goto('/');
    const boot = page.locator('#boot.failed');
    await expect(boot).toBeVisible();
    await expect(boot.locator('.boot-err pre')).toContainText('Could not load');
    await expect(boot.locator('.boot-err pre')).toContainText('/assets/index-');
  });

  test('a service worker that stalls requests is unregistered and the page recovers', async ({ page, context }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    // Empty the precache so the worker must go to the network for the entry
    // script, then let that first network request hang forever. The boot guard
    // must notice, unregister the worker, clear its caches and reload; the
    // reloaded page's request is the second one and goes through.
    await page.evaluate(async () => { for (const k of await caches.keys()) await caches.delete(k); });
    let requests = 0;
    await context.route(/\/assets\/index-[^/]+\.js$/, (route) => { if (requests++ === 0) return; void route.continue(); });
    await page.reload({ waitUntil: 'commit' });
    await expect(page.locator('[data-testid="tool-grid"] .tool-card')).toHaveCount(6, { timeout: 30_000 });
    expect(await page.evaluate(() => sessionStorage.getItem('toolbox.healed'))).toBe('1');
    expect(requests).toBeGreaterThanOrEqual(2);
  });

  test('an exception during startup is reported with its message', async ({ page }) => {
    await page.addInitScript(() => {
      window.matchMedia = () => { throw new Error('boot-spec: matchMedia exploded'); };
    });
    await page.goto('/');
    const boot = page.locator('#boot.failed');
    await expect(boot).toBeVisible();
    await expect(boot.locator('.boot-err pre')).toContainText('boot-spec: matchMedia exploded');
  });
});
