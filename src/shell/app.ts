import { onRoute, type Route } from './router';
import { renderHome } from './home';
import { renderTool } from './tool-view';
import { renderSettings } from './settings';

export function startShell(root: HTMLElement): void {
  let teardown: (() => void) | null = null;
  const render = (route: Route) => {
    teardown?.();
    teardown = null;
    window.scrollTo(0, 0);
    switch (route.name) {
      case 'home': renderHome(root); break;
      case 'settings': renderSettings(root); break;
      case 'tool': teardown = renderTool(root, route.id); break;
    }
    document.body.dataset.route = route.name;
  };
  onRoute(render);
  document.addEventListener('toolbox:installable', () => { if (document.body.dataset.route === 'home') renderHome(root); });
}
