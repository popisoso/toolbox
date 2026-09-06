import type { Page } from '@playwright/test';

export interface PixelStats {
  width: number; height: number;
  /** Fraction of pixels within 6/255 of the darkest colour (background between dots). */
  bgFraction: number;
  /** Mean |Δ| between horizontal neighbours, 0..255. */
  meanNeighbourDiff: number;
  /** Fraction of horizontal neighbour pairs that are exactly equal (mosaic cells). */
  equalNeighbourFraction: number;
  /** Number of distinct grey levels seen (sampled). */
  distinctLevels: number;
  meanLuma: number;
  /** Fraction of pixels that are (near) pure black, e.g. gaps between dots. */
  blackFraction: number;
}

/** Wait for the module to be mounted and have rendered a few frames. */
export async function waitForTool(page: Page): Promise<void> {
  await page.waitForFunction(() => !!window.__toolbox);
  await page.evaluate(() => window.__toolbox!.ready);
  await page.waitForFunction(() => (window.__toolbox!.host.loop.clock.frame > 3));
}

export async function setParam(page: Page, key: string, value: number | boolean | string): Promise<void> {
  await page.evaluate(([k, v]) => window.__toolbox!.setParam(k as string, v as number), [key, value]);
  // let two frames render with the new value
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

export async function pixelStats(page: Page): Promise<PixelStats> {
  const dataUrl = await page.evaluate(() => window.__toolbox!.snapshot());
  return page.evaluate(async (url) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
    let minL = 255;
    const luma = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const l = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
      luma[i] = l;
      if (l < minL) minL = l;
    }
    let bg = 0, diffSum = 0, eq = 0, pairs = 0, sum = 0, black = 0;
    const levels = new Set<number>();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const l = luma[y * width + x];
      sum += l;
      if (l - minL <= 6) bg++;
      if (data[(y * width + x) * 4] < 8 && data[(y * width + x) * 4 + 1] < 8 && data[(y * width + x) * 4 + 2] < 8) black++;
      if ((x & 7) === 0 && (y & 7) === 0) levels.add(Math.round(l));
      if (x + 1 < width) {
        const d = Math.abs(l - luma[y * width + x + 1]);
        diffSum += d;
        if (d < 0.5) eq++;
        pairs++;
      }
    }
    const n = width * height;
    return {
      width, height,
      bgFraction: bg / n,
      meanNeighbourDiff: diffSum / pairs,
      equalNeighbourFraction: eq / pairs,
      distinctLevels: levels.size,
      meanLuma: sum / n,
      blackFraction: black / n,
    };
  }, dataUrl);
}

/** Freeze the module clock (dt = 0) so stateful modules hold their frame. */
export async function pause(page: Page, paused = true): Promise<void> {
  await page.evaluate((p) => window.__toolbox!.host.loop.setPaused(p), paused);
  await waitFrames(page, 2);
}

export async function waitFrames(page: Page, n: number): Promise<void> {
  const start = await page.evaluate(() => window.__toolbox!.host.loop.clock.frame);
  await page.waitForFunction((target) => window.__toolbox!.host.loop.clock.frame >= target, start + n, { timeout: 60_000 });
}

export async function clickAction(page: Page, key: string): Promise<void> {
  await page.locator(`button[data-action="${key}"]`).click();
  await waitFrames(page, 2);
}

export async function snapshotBytes(page: Page): Promise<Buffer> {
  const url = await page.evaluate(() => window.__toolbox!.snapshot());
  return Buffer.from(url.split(',')[1]!, 'base64');
}
