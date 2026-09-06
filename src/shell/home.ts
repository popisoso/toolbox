import { listModules, missingCapabilities, detectCapabilities } from '@engine/index';
import { el } from './dom';
import { href } from './router';
import { installState, promptInstall } from './pwa';
import { APP_NAME } from './app-config';

export function renderHome(root: HTMLElement): void {
  const caps = detectCapabilities();
  const modules = listModules();

  const grid = el('div', { className: 'tool-grid', dataset: { testid: 'tool-grid' } });
  for (const m of modules) {
    const missing = missingCapabilities(m.requires);
    const card = el('a', { className: 'tool-card', href: href({ name: 'tool', id: m.id }) },
      el('span', { className: 'tool-card__cat', text: m.category }),
      el('span', { className: 'tool-card__name', text: m.name }),
      el('span', { className: 'tool-card__desc', text: m.description }),
      missing.length ? el('span', { className: 'tool-card__missing', text: `Needs: ${missing.join(', ')}` }) : null,
    );
    card.dataset.module = m.id;
    if (missing.length) {
      card.setAttribute('aria-disabled', 'true');
      card.addEventListener('click', (e) => e.preventDefault());
    }
    grid.append(card);
  }

  const bar = el('header', { className: 'topbar' },
    el('h1', { className: 'topbar__title', text: APP_NAME }),
    el('a', { className: 'btn btn--ghost', href: href({ name: 'settings' }), text: 'Settings' }),
  );

  const page = el('main', { className: 'page' });
  const install = installState();
  if (!caps.standalone && install.kind !== 'installed') {
    const notice = el('div', { className: 'notice', dataset: { testid: 'install-hint' } }, el('p', { text: install.hint }));
    if (install.kind === 'prompt') {
      const b = el('button', { className: 'btn btn--primary', type: 'button', text: 'Install' });
      b.addEventListener('click', () => void promptInstall());
      notice.append(b);
    }
    page.append(notice);
  }
  page.append(
    el('section', { className: 'page__section' },
      el('h2', { className: 'page__heading', text: `Tools · ${modules.length}` }),
      grid,
    ),
  );
  root.replaceChildren(bar, page);
}
