import { test, expect } from '@playwright/test';
import { clickAction, pause, pixelStats, setParam, snapshotBytes, waitForTool, waitFrames } from './helpers';

test.describe('feedback-loop @slow', () => {
  test('accumulates, decays to black without injection, and clears', async ({ page }) => {
    await page.goto('/#/tool/feedback-loop');
    await waitForTool(page);
    await waitFrames(page, 40);
    const running = await pixelStats(page);
    expect(running.meanLuma).toBeGreaterThan(8);      // loop holds an image
    expect(running.distinctLevels).toBeGreaterThan(10);

    await setParam(page, 'inject', 0);
    await setParam(page, 'decay', 0.85);
    await waitFrames(page, 60);
    const faded = await pixelStats(page);
    expect(faded.meanLuma).toBeLessThan(2);           // memory decays when nothing enters

    await setParam(page, 'inject', 0.5);
    await setParam(page, 'decay', 1);
    await waitFrames(page, 20);
    expect((await pixelStats(page)).meanLuma).toBeGreaterThan(8);
    await pause(page);                                 // hold the loop, then wipe its memory
    await clickAction(page, 'clear');
    expect((await pixelStats(page)).meanLuma).toBeLessThan(1);
  });

  test('paused clock holds the frame byte-for-byte', async ({ page }) => {
    await page.goto('/#/tool/feedback-loop');
    await waitForTool(page);
    await waitFrames(page, 20);
    await pause(page);
    const a = await snapshotBytes(page);
    await waitFrames(page, 5);
    const b = await snapshotBytes(page);
    expect(a.equals(b)).toBe(true);
  });
});

test.describe('morphogenesis @slow', () => {
  test('grows structure from seeds, clears flat, and the pointer paints catalyst', async ({ page }) => {
    test.slow(); // ten simulation steps per frame on software GL
    await page.goto('/#/tool/morphogenesis');
    await waitForTool(page);
    await setParam(page, 'steps', 8);
    await waitFrames(page, 20);
    const grown = await pixelStats(page);
    expect(grown.distinctLevels).toBeGreaterThan(6);
    expect(grown.bgFraction).toBeGreaterThan(0.2);   // dark field remains
    expect(grown.bgFraction).toBeLessThan(0.98);     // …with growth on it

    await clickAction(page, 'clear');
    await waitFrames(page, 3);
    const flat = await pixelStats(page);
    expect(flat.distinctLevels).toBeLessThanOrEqual(2);

    // paint with the pointer in the middle of the canvas
    const box = (await page.locator('.tool__canvas').boundingBox())!;
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 0; i < 6; i++) { await page.mouse.move(cx + i * 8, cy + i * 4); await waitFrames(page, 1); }
    await page.mouse.up();
    await waitFrames(page, 12);
    const painted = await pixelStats(page);
    expect(painted.distinctLevels).toBeGreaterThan(4);
    expect(painted.bgFraction).toBeLessThan(flat.bgFraction);
  });

  test('presets set feed/kill and manual edits switch to custom', async ({ page }) => {
    await page.goto('/#/tool/morphogenesis');
    await waitForTool(page);
    await setParam(page, 'preset', 'worms');
    expect(await page.evaluate(() => window.__toolbox!.getParam('feed'))).toBeCloseTo(0.058, 4);
    await setParam(page, 'kill', 0.07);
    expect(await page.evaluate(() => window.__toolbox!.getParam('preset'))).toBe('custom');
  });
});

test.describe('datamosh @slow', () => {
  test('intensity 0 is a clean pass-through; corruption is deterministic in seed and time', async ({ page }) => {
    await page.goto('/#/tool/datamosh');
    await waitForTool(page);
    await waitFrames(page, 5);
    await pause(page);
    await setParam(page, 'intensity', 0);
    await setParam(page, 'seed', 1);
    const clean1 = await snapshotBytes(page);
    await setParam(page, 'seed', 42);
    const clean2 = await snapshotBytes(page);
    expect(clean1.equals(clean2)).toBe(true);        // seed has no effect at intensity 0

    await setParam(page, 'intensity', 1);
    const glitched = await snapshotBytes(page);
    expect(glitched.equals(clean1)).toBe(false);
    const again = await snapshotBytes(page);
    expect(again.equals(glitched)).toBe(true);        // stable while paused
    await setParam(page, 'seed', 7);
    expect((await snapshotBytes(page)).equals(glitched)).toBe(false); // seed changes the corruption

    const stats = await pixelStats(page);
    await setParam(page, 'posterize', 1);
    const poster = await pixelStats(page);
    expect(poster.distinctLevels).toBeLessThan(stats.distinctLevels / 2);
  });
});

test.describe('time-slice @slow', () => {
  test('static buffer equals the live frame; a moving buffer displaces time by position', async ({ page }) => {
    await page.goto('/#/tool/time-slice');
    await waitForTool(page);
    await setParam(page, 'smooth', false);
    await pause(page);
    await waitFrames(page, 60);                        // ring fills with identical frames
    await setParam(page, 'depth', 0);
    const live = await snapshotBytes(page);
    await setParam(page, 'depth', 1);
    const sliced = await snapshotBytes(page);
    expect(sliced.equals(live)).toBe(true);

    await pause(page, false);
    await waitFrames(page, 50);                        // ring fills with moving frames
    await pause(page);
    await setParam(page, 'depth', 0);
    const live2 = await pixelStats(page);
    await setParam(page, 'depth', 1);
    const sliced2 = await snapshotBytes(page);
    expect(sliced2.equals(await (async () => { await setParam(page, 'depth', 0); return snapshotBytes(page); })())).toBe(false);
    expect(live2.distinctLevels).toBeGreaterThan(10);

    for (const mode of ['horizontal', 'radial', 'noise', 'luma']) {
      await setParam(page, 'mode', mode);
      await setParam(page, 'depth', 1);
      expect((await pixelStats(page)).distinctLevels, mode).toBeGreaterThan(10);
    }
    await expect(page.getByTestId('tool-error')).toBeHidden();
  });
});
