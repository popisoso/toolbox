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
