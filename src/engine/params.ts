/**
 * Declarative parameter schema.
 *
 * A module describes its controls as data; the shell renders them and the
 * engine stores values. Modules never build their own sliders unless they
 * opt into a custom panel via `ModuleInstance.ui`.
 */

export type ParamValue = number | boolean | string;

interface ParamBase {
  key: string;
  label: string;
  /** Optional group heading for the auto-generated control panel. */
  group?: string;
  description?: string;
}

export interface RangeParam extends ParamBase {
  kind: 'range';
  min: number;
  max: number;
  step?: number;
  default: number;
  unit?: string;
}
export interface ToggleParam extends ParamBase {
  kind: 'toggle';
  default: boolean;
}
export interface SelectParam extends ParamBase {
  kind: 'select';
  options: { value: string; label: string }[];
  default: string;
}
export interface ColorParam extends ParamBase {
  kind: 'color';
  /** `#rrggbb` */
  default: string;
}
/** A button. Fires `ModuleInstance.onAction(key)`; has no stored value. */
export interface ActionParam extends ParamBase {
  kind: 'action';
}
export type ParamSpec = RangeParam | ToggleParam | SelectParam | ColorParam | ActionParam;

export type ParamListener = (key: string, value: ParamValue) => void;

/** Reactive key/value store seeded from a list of specs. */
export class ParamStore {
  private values = new Map<string, ParamValue>();
  private listeners = new Set<ParamListener>();
  readonly specs: readonly ParamSpec[];

  constructor(specs: readonly ParamSpec[], initial?: Record<string, ParamValue>) {
    this.specs = specs;
    for (const s of specs) {
      if (s.kind === 'action') continue;
      this.values.set(s.key, s.default);
    }
    if (initial) for (const [k, v] of Object.entries(initial)) if (this.values.has(k)) this.values.set(k, v);
  }

  get<T extends ParamValue = ParamValue>(key: string): T {
    const v = this.values.get(key);
    if (v === undefined) throw new Error(`Unknown param "${key}"`);
    return v as T;
  }
  number(key: string): number { return Number(this.get(key)); }
  bool(key: string): boolean { return Boolean(this.get(key)); }
  string(key: string): string { return String(this.get(key)); }

  set(key: string, value: ParamValue): void {
    const spec = this.specs.find((s) => s.key === key);
    if (!spec || spec.kind === 'action') return;
    if (spec.kind === 'range') {
      const n = Math.min(spec.max, Math.max(spec.min, Number(value)));
      value = Number.isFinite(n) ? n : spec.default;
    }
    if (this.values.get(key) === value) return;
    this.values.set(key, value);
    for (const l of this.listeners) l(key, value);
  }

  reset(): void {
    for (const s of this.specs) if (s.kind !== 'action') this.set(s.key, s.default);
  }

  subscribe(fn: ParamListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  snapshot(): Record<string, ParamValue> {
    return Object.fromEntries(this.values);
  }
}

/** Parse `#rrggbb` to normalised RGB for uniforms. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
