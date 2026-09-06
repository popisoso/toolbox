import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { globSync } from 'node:fs';
import { pause, snapshotBytes, waitForTool, waitFrames } from './helpers';
import { decodePng, lumaStats } from './png';

const MODULES = ['noise-grid', 'feedback-loop', 'morphogenesis', 'datamosh', 'time-slice', 'video-input'];

test.describe('export', () => {
  for (const id of MODULES) {
    test(`${id}: Still downloads the exact rendered frame as a valid PNG`, async ({ page }, testInfo) => {
      await page.goto(`/#/tool/${id}`);
      await waitForTool(page);
      await waitFrames(page, 20);
      await pause(page);
      if (id === 'time-slice') await waitFrames(page, 60); // ring converges while paused
      const expected = await snapshotBytes(page);

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Still' }).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(new RegExp(`^${id}-.*\\.png$`));
      const path = testInfo.outputPath(`${id}.png`);
      await download.saveAs(path);
      const file = readFileSync(path);

      const png = decodePng(file);
      const size = await page.evaluate(() => [window.__toolbox!.host.canvas.width, window.__toolbox!.host.canvas.height]);
      expect([png.width, png.height]).toEqual(size);
      expect(file.equals(expected)).toBe(true);        // the file is the frame, byte for byte
      if (id !== 'video-input') {                       // video-input without a source is a flat placeholder
        const { stddev } = lumaStats(png);
        expect(stddev).toBeGreaterThan(5);              // real content, not a blank frame
      }
      await expect(page.getByText(/Still saved/)).toBeVisible();
    });
  }

  test('Record produces a playable video file of the canvas', async ({ page }, testInfo) => {
    await page.goto('/#/tool/noise-grid');
    await waitForTool(page);
    const rec = page.getByRole('button', { name: 'Record' });
    await rec.click();
    await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
    await page.waitForTimeout(1500);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Stop' }).click(),
    ]);
    const name = download.suggestedFilename();
    expect(name).toMatch(/^noise-grid-.*\.(webm|mp4)$/);
    const ext = name.split('.').pop()!;
    const path = testInfo.outputPath(`recording.${ext}`);
    await download.saveAs(path);
    const file = readFileSync(path);
    expect(file.length).toBeGreaterThan(10_000);
    // Container magic matches the extension we named it with.
    if (ext === 'webm') expect(file.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))).toBe(true);
    else expect(file.toString('ascii', 4, 8)).toBe('ftyp');

    // If Playwright's ffmpeg is around, prove the stream decodes to video frames.
    const ffmpeg = findFfmpeg();
    if (ffmpeg) {
      // `ffmpeg -i file` with no output exits non-zero but prints the parsed streams.
      let info = '';
      try { execFileSync(ffmpeg, ['-hide_banner', '-i', path], { stdio: ['ignore', 'pipe', 'pipe'] }); }
      catch (e) { info = String((e as { stderr?: Buffer }).stderr ?? ''); }
      expect(info, info).toMatch(/Stream #0:0.*Video: (vp9|vp8|h264)/);
      expect(info, info).not.toMatch(/Invalid data|parsing failed/);
    }
    test.info().annotations.push({ type: 'ffmpeg', description: ffmpeg ? 'decoded' : 'not found, skipped' });
    await expect(page.getByText(/Recording saved/)).toBeVisible();
  });
});

function findFfmpeg(): string | null {
  const candidates = [
    ...globSync('/opt/pw-browsers/ffmpeg-*/ffmpeg-linux'),
    ...globSync(`${process.env.HOME ?? ''}/.cache/ms-playwright/ffmpeg-*/ffmpeg-linux`),
  ];
  return candidates.find((c) => existsSync(c)) ?? null;
}
