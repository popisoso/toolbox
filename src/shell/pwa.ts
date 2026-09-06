/**
 * PWA plumbing: service-worker registration with an update toast, and
 * install affordances for the three targets (iOS Safari share sheet, macOS
 * Safari "Add to Dock", Chromium `beforeinstallprompt`).
 */
import { toast } from './dom';

type BeforeInstallPromptEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferredPrompt: BeforeInstallPromptEvent | null = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  document.dispatchEvent(new CustomEvent('toolbox:installable'));
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  toast('Installed. Open it from your Home Screen or Dock.');
});

export type InstallState =
  | { kind: 'installed' }
  | { kind: 'prompt'; hint: string }
  | { kind: 'manual'; hint: string };

export function installState(): InstallState {
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (standalone) return { kind: 'installed' };
  if (deferredPrompt) return { kind: 'prompt', hint: 'Install this app for fullscreen and offline use.' };
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
  if (isIOS) return { kind: 'manual', hint: 'Install: tap Share, then “Add to Home Screen”.' };
  if (isSafari) return { kind: 'manual', hint: 'Install: File → “Add to Dock…” in Safari.' };
  return { kind: 'manual', hint: 'Install: use your browser’s “Install app” option in the address bar or menu.' };
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === 'accepted';
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  const url = `${import.meta.env.BASE_URL}sw.js`;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register(url, { scope: import.meta.env.BASE_URL });
      // Reload only after the user accepted an update; a first install also
      // fires controllerchange (clients.claim) and must not reload the page.
      let reloadOnControllerChange = false;
      const promptUpdate = (worker: ServiceWorker) => {
        toast('Update ready.', {
          label: 'Reload',
          onClick: () => { reloadOnControllerChange = true; worker.postMessage({ type: 'SKIP_WAITING' }); },
        }, 0);
      };
      if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(w);
        });
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!reloadOnControllerChange) return;
        reloadOnControllerChange = false;
        location.reload();
      });
    } catch (e) {
      console.warn('[pwa] service worker registration failed', e);
    }
  });
}
