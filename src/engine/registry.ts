import type { ModuleManifest } from './module';

const modules = new Map<string, ModuleManifest>();

export function registerModule(manifest: ModuleManifest): void {
  if (modules.has(manifest.id)) throw new Error(`Duplicate module id "${manifest.id}"`);
  modules.set(manifest.id, manifest);
}

export function getModule(id: string): ModuleManifest | undefined {
  return modules.get(id);
}

export function listModules(): ModuleManifest[] {
  return [...modules.values()].sort((a, b) => a.name.localeCompare(b.name));
}
