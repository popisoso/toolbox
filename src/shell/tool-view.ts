/** Fullscreen host for one module: canvas + auto controls + export. */
import { ModuleHost, deliverBlob, extensionFor, getModule, missingCapabilities, type ParamValue } from '@engine/index';
import { buildControls } from './controls';
import { el, toast } from './dom';
import { href } from './router';

const PARAMS_STORAGE = (id: string) => `toolbox.params.${id}`;

declare global {
  interface Window {
    /** Test/automation handle for the mounted tool. */
    __toolbox?: {
      moduleId: string;
      setParam(key: string, value: ParamValue): void;
      getParam(key: string): ParamValue;
      snapshot(): Promise<string>;
      ready: Promise<void>;
      host: ModuleHost;
    };
  }
}

export function renderTool(root: HTMLElement, id: string): () => void {
  const manifest = getModule(id);
  if (!manifest) {
    root.replaceChildren(el('main', { className: 'page' }, el('p', { text: `Unknown tool “${id}”.` }), el('a', { className: 'btn', href: href({ name: 'home' }), text: 'Back to tools' })));
    return () => undefined;
  }
  const missing = missingCapabilities(manifest.requires);
  if (missing.length) {
    root.replaceChildren(el('main', { className: 'page' }, el('p', { text: `${manifest.name} needs: ${missing.join(', ')}.` }), el('a', { className: 'btn', href: href({ name: 'home' }), text: 'Back to tools' })));
    return () => undefined;
  }

  const canvas = el('canvas', { className: 'tool__canvas' });
  const errorBox = el('pre', { className: 'tool__error', hidden: true, dataset: { testid: 'tool-error' } });
  const panelBody = el('div', { className: 'panel__body' });
  const custom = el('div', { className: 'panel__custom' });
  const collapse = el('button', { className: 'panel__handle', type: 'button' }, el('span', { text: 'Controls' }), el('span', { className: 'panel__collapse', text: '▾' }));
  const panel = el('aside', { className: 'tool__panel', dataset: { testid: 'tool-panel' } }, collapse, panelBody);
  collapse.addEventListener('click', () => { panel.dataset.collapsed = panel.dataset.collapsed === 'true' ? 'false' : 'true'; });
  // Start collapsed on narrow screens so the canvas is the first thing seen.
  panel.dataset.collapsed = String(!matchMedia('(min-width: 900px)').matches);

  const back = el('a', { className: 'btn btn--icon', href: href({ name: 'home' }), title: 'Back', text: '‹' });
  const snap = el('button', { className: 'btn', type: 'button', text: 'Still', title: 'Export PNG' });
  const rec = el('button', { className: 'btn', type: 'button', text: 'Record', title: 'Record video' });
  const immersive = el('button', { className: 'btn', type: 'button', text: 'Hide UI', title: 'Hide interface (tap canvas to show)' });
  const bar = el('div', { className: 'tool__bar' }, back, el('span', { className: 'tool__name', text: manifest.name }), snap, rec, immersive);
  const stage = el('div', { className: 'tool__stage' }, canvas, bar, errorBox);
  const view = el('div', { className: 'tool' }, stage, panel);
  root.replaceChildren(view);

  let initial: Record<string, ParamValue> | undefined;
  try { initial = JSON.parse(localStorage.getItem(PARAMS_STORAGE(id)) ?? 'null') ?? undefined; } catch { /* ignore */ }

  let host: ModuleHost;
  try {
    host = new ModuleHost(manifest, canvas, { initialParams: initial });
  } catch (e) {
    errorBox.hidden = false;
    errorBox.textContent = String(e instanceof Error ? e.message : e);
    return () => undefined;
  }
  host.onError = (e) => { errorBox.hidden = false; errorBox.textContent = e.message; };

  const unsubControls = buildControls(host, panelBody);
  panelBody.prepend(custom);
  const cleanupUi = host.instance?.ui?.(custom);
  const unsubPersist = host.params.subscribe(() => {
    try { localStorage.setItem(PARAMS_STORAGE(id), JSON.stringify(host.params.snapshot())); } catch { /* ignore */ }
  });

  snap.addEventListener('click', async () => {
    try {
      const blob = await host.exporter.snapshot();
      const how = await deliverBlob(blob, `${id}-${stamp()}.png`);
      toast(how === 'shared' ? 'Still shared.' : 'Still saved.');
    } catch (e) { toast(`Export failed: ${(e as Error).message}`); }
  });
  rec.addEventListener('click', async () => {
    try {
      if (!host.exporter.recording) {
        host.exporter.startRecording({ fps: 60 });
        rec.replaceChildren(el('span', { className: 'tool__rec' }), document.createTextNode(' Stop'));
        rec.setAttribute('aria-pressed', 'true');
      } else {
        const blob = await host.exporter.stopRecording();
        rec.textContent = 'Record';
        rec.removeAttribute('aria-pressed');
        const how = await deliverBlob(blob, `${id}-${stamp()}.${extensionFor(blob.type)}`);
        toast(how === 'shared' ? 'Recording shared.' : `Recording saved (${(blob.size / 1e6).toFixed(1)} MB).`);
      }
    } catch (e) { toast(`Recording failed: ${(e as Error).message}`); }
  });
  if (!host.exporter.recordingMimeType()) rec.hidden = true;

  const setImmersive = (on: boolean) => view.classList.toggle('tool--immersive', on);
  immersive.addEventListener('click', () => setImmersive(true));
  canvas.addEventListener('pointerdown', () => { if (view.classList.contains('tool--immersive')) setImmersive(false); });

  const ready = host.mount().catch((e: Error) => { errorBox.hidden = false; errorBox.textContent = e.message; });

  window.__toolbox = {
    moduleId: id,
    host,
    ready,
    setParam: (k, v) => host.params.set(k, v),
    getParam: (k) => host.params.get(k),
    snapshot: async () => {
      const blob = await host.exporter.snapshot();
      return new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(blob); });
    },
  };

  return () => {
    unsubControls();
    unsubPersist();
    if (typeof cleanupUi === 'function') cleanupUi();
    host.dispose();
    delete window.__toolbox;
  };
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
