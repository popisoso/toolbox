import { test, expect } from '@playwright/test';
import { pixelStats, setParam, waitForTool } from './helpers';

test.describe('noise-grid module @slow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/tool/noise-grid');
    await waitForTool(page);
    await setParam(page, 'speed', 0); // freeze the field so measurements are stable
    await setParam(page, 'maxCells', 12);
  });

  test('grid = 0 is a continuous field', async ({ page }) => {
    await setParam(page, 'grid', 0);
    const s = await pixelStats(page);
    expect(s.distinctLevels).toBeGreaterThan(40);       // rich tonal range
    expect(s.meanNeighbourDiff).toBeLessThan(3);        // smooth: neighbours nearly equal
    expect(s.equalNeighbourFraction).toBeLessThan(0.75); // …but not flat mosaic cells
    expect(s.bgFraction).toBeLessThan(0.15);            // no empty background between dots
  });

  test('grid = 0.5 is a coarse mosaic', async ({ page }) => {
    await setParam(page, 'grid', 0.5);
    const s = await pixelStats(page);
    expect(s.equalNeighbourFraction).toBeGreaterThan(0.85); // most neighbours share a flat cell
    expect(s.bgFraction).toBeLessThan(0.4);                 // cells still filled, not dots
  });

  test('grid = 1 is a discrete point grid', async ({ page }) => {
    await setParam(page, 'grid', 1);
    const s = await pixelStats(page);
    expect(s.bgFraction).toBeGreaterThan(0.35);             // background between dots
    expect(s.equalNeighbourFraction).toBeGreaterThan(0.7);  // flat regions (background + dot interiors)
    // Dots are sized by the field: cell luma varies across the frame.
    expect(s.distinctLevels).toBeGreaterThan(8);
  });

  test('transition is monotonic in background fraction', async ({ page }) => {
    const values: number[] = [];
    for (const g of [0, 0.25, 0.5, 0.75, 1]) {
      await setParam(page, 'grid', g);
      values.push((await pixelStats(page)).bgFraction);
    }
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]! - 0.02);
    expect(values[4]!).toBeGreaterThan(values[0]! + 0.3);
  });

  test('colour params reach the shader', async ({ page }) => {
    await setParam(page, 'grid', 0);
    await setParam(page, 'colorA', '#ffffff');
    await setParam(page, 'colorB', '#ffffff');
    const s = await pixelStats(page);
    expect(s.meanLuma).toBeGreaterThan(250);
  });

  test('still export produces a PNG of the drawing buffer', async ({ page }) => {
    const url = await page.evaluate(() => window.__toolbox!.snapshot());
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    expect(url.length).toBeGreaterThan(5000);
  });
});
