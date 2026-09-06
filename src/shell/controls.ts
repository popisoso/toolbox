/** Turns a module's ParamSpec list into a control panel. */
import type { ModuleHost, ParamSpec } from '@engine/index';
import { el } from './dom';

export function buildControls(host: ModuleHost, body: HTMLElement): () => void {
  const { params } = host;
  const groups = new Map<string, ParamSpec[]>();
  for (const s of params.specs) {
    const g = s.group ?? '';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(s);
  }

  const updaters = new Map<string, (v: unknown) => void>();

  for (const [name, specs] of groups) {
    const group = el('section', { className: 'panel__group' });
    if (name) group.append(el('h3', { className: 'panel__group-title', text: name }));
    const actions = el('div', { className: 'panel__row' });
    for (const spec of specs) {
      const id = `p-${host.manifest.id}-${spec.key}`;
      switch (spec.kind) {
        case 'range': {
          const out = el('output', { text: fmt(params.number(spec.key), spec.step) });
          const input = el('input', { type: 'range', id, min: String(spec.min), max: String(spec.max), step: String(spec.step ?? 'any'), value: String(params.number(spec.key)) });
          input.dataset.param = spec.key;
          input.addEventListener('input', () => params.set(spec.key, Number(input.value)));
          updaters.set(spec.key, (v) => { input.value = String(v); out.textContent = fmt(Number(v), spec.step) + (spec.unit ? ` ${spec.unit}` : ''); });
          group.append(el('div', { className: 'field' },
            el('label', { className: 'field__label', htmlFor: id }, el('span', { text: spec.label }), out),
            input,
            spec.description ? el('p', { className: 'field__hint', text: spec.description }) : null,
          ));
          break;
        }
        case 'toggle': {
          const input = el('input', { type: 'checkbox', id, checked: params.bool(spec.key) });
          input.dataset.param = spec.key;
          input.addEventListener('change', () => params.set(spec.key, input.checked));
          updaters.set(spec.key, (v) => { input.checked = Boolean(v); });
          group.append(el('label', { className: 'switch', htmlFor: id }, el('span', { text: spec.label }), input));
          break;
        }
        case 'select': {
          const select = el('select', { id });
          select.dataset.param = spec.key;
          for (const o of spec.options) select.append(el('option', { value: o.value, text: o.label }));
          select.value = params.string(spec.key);
          select.addEventListener('change', () => params.set(spec.key, select.value));
          updaters.set(spec.key, (v) => { select.value = String(v); });
          group.append(el('div', { className: 'field' }, el('label', { className: 'field__label', htmlFor: id }, el('span', { text: spec.label })), select));
          break;
        }
        case 'color': {
          const input = el('input', { type: 'color', id, value: params.string(spec.key) });
          input.dataset.param = spec.key;
          input.addEventListener('input', () => params.set(spec.key, input.value));
          updaters.set(spec.key, (v) => { input.value = String(v); });
          group.append(el('label', { className: 'field--inline', htmlFor: id }, el('span', { text: spec.label }), input));
          break;
        }
        case 'action': {
          const b = el('button', { className: 'btn', type: 'button', text: spec.label });
          b.dataset.action = spec.key;
          b.addEventListener('click', () => void host.action(spec.key));
          actions.append(b);
          break;
        }
      }
    }
    if (actions.childElementCount) group.append(actions);
    body.append(group);
  }

  const reset = el('button', { className: 'btn btn--ghost', type: 'button', text: 'Reset to defaults' });
  reset.addEventListener('click', () => params.reset());
  body.append(el('div', { className: 'panel__row' }, reset));

  return params.subscribe((k, v) => updaters.get(k)?.(v));
}

function fmt(v: number, step?: number): string {
  const decimals = step && step < 1 ? Math.min(3, Math.ceil(-Math.log10(step))) : 0;
  return v.toFixed(decimals);
}
