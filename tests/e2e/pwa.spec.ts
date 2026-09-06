import { test, expect } from '@playwright/test';

test.describe('PWA', () => {
  test('manifest is linked, valid and installable-shaped', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const res = await request.get(new URL(href!, page.url()).href);
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBeTruthy();
    const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
    for (const icon of m.icons) {
      const r = await request.get(new URL(icon.src, res.url()).href);
      expect(r.ok(), icon.src).toBe(true);
      expect(r.headers()['content-type']).toContain('image/png');
    }
    // iOS-specific install hooks
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    expect(await page.evaluate(() => document.querySelector('meta[name="viewport"]')!.getAttribute('content'))).toContain('viewport-fit=cover');
  });

  test('service worker installs and the app works offline', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    // wait for precache to finish (activated worker + cache populated)
    await page.waitForFunction(async () => {
      const keys = await caches.keys();
      if (!keys.length) return false;
      const c = await caches.open(keys[0]!);
      return (await c.keys()).length >= 8;
    });
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('[data-testid="tool-grid"] .tool-card')).toHaveCount(2);
    await page.goto('/#/tool/noise-grid');
    await page.waitForFunction(() => !!window.__toolbox);
    await context.setOffline(false);
  });

  test('install hint is shown when not running standalone', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('install-hint')).toBeVisible();
  });
});
