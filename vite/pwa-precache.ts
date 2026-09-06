/**
 * Emits `sw.js` with the exact list of built assets, so the offline cache is
 * always complete and versioned by content hash. Zero runtime dependencies.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

export function pwaPrecache(): Plugin {
  let config: ResolvedConfig;
  const buildId = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '') + '-' + Math.random().toString(36).slice(2, 6);
  return {
    name: 'toolbox:pwa-precache',
    apply: 'build',
    configResolved(c) { config = c; },
    config() {
      return { define: { __BUILD_ID__: JSON.stringify(buildId) } };
    },
    generateBundle(_opts, bundle) {
      const assets = new Set<string>(['index.html']);
      for (const file of Object.keys(bundle)) if (!file.endsWith('.map')) assets.add(file);
      // static files copied from public/
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir)) {
          const p = join(dir, entry);
          if (statSync(p).isDirectory()) walk(p);
          else assets.add(relative(config.publicDir, p).split('\\').join('/'));
        }
      };
      try { walk(config.publicDir); } catch { /* no public dir */ }
      const list = [...assets].filter((a) => a !== 'sw.js').sort();
      const hash = createHash('sha256').update(list.join('\n')).update(buildId).digest('hex').slice(0, 12);
      const template = readFileSync(new URL('./sw.template.js', import.meta.url), 'utf8');
      const source = template.replaceAll('__VERSION__', hash).replaceAll('__PRECACHE__', JSON.stringify(list, null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}
