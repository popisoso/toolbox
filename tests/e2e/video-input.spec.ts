import { test, expect } from '@playwright/test';
import { pixelStats, setParam, waitForTool } from './helpers';

test.describe('video-input module (fake camera) @slow', () => {
  test('starts the camera and renders frames through the grid resampler', async ({ page }) => {
    await page.goto('/#/tool/video-input');
    await waitForTool(page);
    await expect(page.getByTestId('tool-error')).toBeHidden();

    const before = await pixelStats(page);
    expect(before.distinctLevels).toBeLessThan(4); // placeholder is flat

    await page.getByTestId('source-camera').click();
    await expect(page.locator('.source-picker__status')).toHaveText(/Camera · \d+×\d+/);
    // wait until frames are actually flowing into the texture
    await page.waitForFunction(() => (window as unknown as { __toolbox: { host: { loop: { clock: { frame: number } } } } }).__toolbox.host.loop.clock.frame > 30);

    await setParam(page, 'grid', 0);
    const live = await pixelStats(page);
    expect(live.distinctLevels).toBeGreaterThan(10); // Chromium's fake camera is a moving test pattern

    await setParam(page, 'grid', 1);
    const dots = await pixelStats(page);
    expect(live.blackFraction).toBeLessThan(0.05);               // test pattern has no true black
    expect(dots.blackFraction).toBeGreaterThan(0.3);             // pure-black gaps between dots
    expect(dots.distinctLevels).toBeGreaterThan(8);              // dots still carry the image

    await page.getByRole('button', { name: 'Stop' }).click();
    await expect(page.locator('.source-picker__status')).toHaveText('No source');
  });
});
