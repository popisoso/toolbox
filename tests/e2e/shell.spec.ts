import { test, expect } from '@playwright/test';
import { waitForTool } from './helpers';

test.describe('shell', () => {
  test('home lists every registered module and opens one', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('[data-testid="tool-grid"] .tool-card');
    await expect(cards).toHaveCount(6);
    await expect(page.locator('.tool-card[data-module="noise-grid"]')).toBeVisible();
    await expect(page.locator('.tool-card[data-module="video-input"]')).toBeVisible();

    await page.locator('.tool-card[data-module="noise-grid"]').click();
    await expect(page).toHaveURL(/#\/tool\/noise-grid$/);
    await waitForTool(page);
    await expect(page.getByTestId('tool-error')).toBeHidden();
    // Controls were generated from the manifest: one slider per range param.
    await expect(page.locator('input[type="range"][data-param="grid"]')).toBeAttached();
    await expect(page.locator('button[data-action="reseed"]')).toBeAttached();
  });

  test('back navigation disposes the tool and returns home', async ({ page }) => {
    await page.goto('/#/tool/noise-grid');
    await waitForTool(page);
    await page.locator('.tool__bar a').click();
    await expect(page.locator('[data-testid="tool-grid"]')).toBeVisible();
    expect(await page.evaluate(() => window.__toolbox === undefined)).toBe(true);
  });

  test('unknown tool shows a friendly message', async ({ page }) => {
    await page.goto('/#/tool/does-not-exist');
    await expect(page.getByText('Unknown tool')).toBeVisible();
  });

  test('controls panel: sheet on phones, sidebar on desktop', async ({ page }, testInfo) => {
    await page.goto('/#/tool/noise-grid');
    await waitForTool(page);
    const panel = page.getByTestId('tool-panel');
    const isPhone = testInfo.project.name === 'phone';
    expect(await panel.getAttribute('data-collapsed')).toBe(String(isPhone));
    if (isPhone) {
      await page.locator('.panel__handle').tap();
      expect(await panel.getAttribute('data-collapsed')).toBe('false');
    }
    // Moving the slider updates the param store.
    const slider = page.locator('input[type="range"][data-param="grid"]');
    await slider.evaluate((el: HTMLInputElement) => { el.value = '0.7'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(await page.evaluate(() => window.__toolbox!.getParam('grid'))).toBeCloseTo(0.7);
    // and is persisted per module
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('toolbox.params.noise-grid')!).grid)).toBeCloseTo(0.7);
    // no horizontal overflow at any size
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('settings page renders capabilities and theme choice', async ({ page }) => {
    await page.goto('/#/settings');
    await expect(page.getByText('This device')).toBeVisible();
    await page.selectOption('#theme-choice', 'dark');
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  });
});
