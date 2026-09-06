/**
 * Reusable source-picker widget. A module mounts it from `ModuleInstance.ui`
 * and receives a `VideoSource` when the user starts the camera or picks a
 * file. Uses only design tokens through the shell's class names.
 */
import type { VideoSource, VideoSourceFactory } from './source';

export interface SourcePickerOptions {
  factory: VideoSourceFactory;
  onSource(source: VideoSource | null): void;
  onError?(e: Error): void;
  /** Camera access needs a user gesture on iOS, so the picker never auto-starts. */
  allowCamera?: boolean;
  allowFile?: boolean;
}

export function mountSourcePicker(host: HTMLElement, opts: SourcePickerOptions): () => void {
  let current: VideoSource | null = null;
  const root = document.createElement('div');
  root.className = 'source-picker';
  root.dataset.testid = 'source-picker';

  const status = document.createElement('p');
  status.className = 'source-picker__status';
  status.textContent = 'No source';

  const row = document.createElement('div');
  row.className = 'source-picker__row';

  const setSource = (s: VideoSource | null) => {
    current?.dispose();
    current = s;
    status.textContent = s ? `${s.kind === 'camera' ? 'Camera' : 'File'} · ${s.width}×${s.height}` : 'No source';
    flipBtn.hidden = !(s?.kind === 'camera');
    stopBtn.hidden = !s;
    opts.onSource(s);
  };
  const fail = (e: unknown) => {
    const err = e instanceof Error ? e : new Error(String(e));
    status.textContent = err.message;
    opts.onError?.(err);
  };

  const camBtn = button('Start camera', async () => {
    camBtn.disabled = true;
    try { setSource(await opts.factory.camera({ facing: 'user' })); } catch (e) { fail(e); } finally { camBtn.disabled = false; }
  });
  camBtn.dataset.testid = 'source-camera';

  const flipBtn = button('Flip', async () => {
    if (!current?.flip) return;
    try { await current.flip(); status.textContent = `Camera · ${current.width}×${current.height}`; } catch (e) { fail(e); }
  });
  flipBtn.hidden = true;

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'video/*';
  fileInput.hidden = true;
  fileInput.dataset.testid = 'source-file';
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    try { setSource(await opts.factory.file(f)); } catch (e) { fail(e); }
    fileInput.value = '';
  });
  const fileBtn = button('Open video file', () => fileInput.click());

  const stopBtn = button('Stop', () => setSource(null));
  stopBtn.hidden = true;

  if (opts.allowCamera ?? true) row.append(camBtn, flipBtn);
  if (opts.allowFile ?? true) row.append(fileBtn, fileInput);
  row.append(stopBtn);
  root.append(row, status);
  host.append(root);

  return () => {
    current?.dispose();
    current = null;
    root.remove();
  };
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}
