/**
 * MODULE DISCOVERY
 * Every `src/modules/<id>/index.ts` that default-exports a ModuleManifest is
 * picked up here automatically. Adding a tool = adding a folder. Folders
 * starting with `_` are shared code, not modules.
 */
import { registerModule, type ModuleManifest } from '@engine/index';

const found = import.meta.glob<{ default: ModuleManifest }>(['./*/index.ts', '!./_*/**'], { eager: true });

export function registerAllModules(): ModuleManifest[] {
  const list: ModuleManifest[] = [];
  for (const [path, mod] of Object.entries(found)) {
    const manifest = mod.default;
    if (!manifest || typeof manifest.create !== 'function') {
      console.warn(`[modules] ${path} has no default ModuleManifest export; skipped`);
      continue;
    }
    registerModule(manifest);
    list.push(manifest);
  }
  return list;
}
