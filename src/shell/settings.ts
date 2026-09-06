import { detectCapabilities, getStoredApiKey, setStoredApiKey, AI_MODEL } from '@engine/index';
import { el, toast } from './dom';
import { href } from './router';
import { applyTheme, getThemeChoice, type ThemeChoice } from './theme';
import { installState } from './pwa';

declare const __BUILD_ID__: string;

export function renderSettings(root: HTMLElement): void {
  const caps = detectCapabilities();

  const themeSel = el('select', { id: 'theme-choice' });
  for (const [v, l] of [['system', 'Follow system'], ['light', 'Light'], ['dark', 'Dark']] as [ThemeChoice, string][]) themeSel.append(el('option', { value: v, text: l }));
  themeSel.value = getThemeChoice();
  themeSel.addEventListener('change', () => applyTheme(themeSel.value as ThemeChoice));

  const key = el('input', { type: 'password', id: 'ai-key', placeholder: 'sk-ant-…', value: getStoredApiKey() ?? '', autocomplete: 'off' });
  const save = el('button', { className: 'btn btn--primary', type: 'button', text: 'Save key' });
  save.addEventListener('click', () => { setStoredApiKey(key.value || null); toast(key.value ? 'API key saved on this device.' : 'API key removed.'); });

  const kv = (rows: [string, string][]) => el('dl', { className: 'kv' }, ...rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]));

  const bar = el('header', { className: 'topbar' },
    el('a', { className: 'btn btn--ghost', href: href({ name: 'home' }), text: '‹ Tools' }),
    el('h1', { className: 'topbar__title', text: 'Settings' }),
  );
  const page = el('main', { className: 'page' },
    el('section', { className: 'page__section' },
      el('h2', { className: 'page__heading', text: 'Appearance' }),
      el('div', { className: 'field' }, el('label', { className: 'field__label', htmlFor: 'theme-choice' }, el('span', { text: 'Theme' })), themeSel),
      el('p', { className: 'field__hint', text: 'Colours, type, spacing and radii are all tokens in src/styles/tokens.css.' }),
    ),
    el('section', { className: 'page__section' },
      el('h2', { className: 'page__heading', text: 'AI (Anthropic API)' }),
      el('div', { className: 'field' }, el('label', { className: 'field__label', htmlFor: 'ai-key' }, el('span', { text: 'API key' })), key),
      el('div', { className: 'panel__row' }, save),
      el('p', { className: 'field__hint', text: `Stored only in this browser. Used by modules that call the AI hook (model ${AI_MODEL}). No module uses it yet.` }),
    ),
    el('section', { className: 'page__section' },
      el('h2', { className: 'page__heading', text: 'Install' }),
      el('p', { className: 'field__hint', text: installHint() }),
    ),
    el('section', { className: 'page__section' },
      el('h2', { className: 'page__heading', text: 'This device' }),
      kv([
        ['WebGL2', String(caps.webgl2)], ['WebGPU', String(caps.webgpu)], ['Camera API', String(caps.camera)],
        ['Recording', String(caps.mediarecorder)], ['Standalone', String(caps.standalone)], ['Touch', String(caps.touch)],
        ['Build', __BUILD_ID__],
      ]),
    ),
  );
  root.replaceChildren(bar, page);
}

function installHint(): string {
  const s = installState();
  return s.kind === 'installed' ? 'Running as an installed app.' : s.hint;
}
