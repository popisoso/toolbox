/** Hash router: works offline, on static hosts and inside standalone PWAs. */
export type Route =
  | { name: 'home' }
  | { name: 'tool'; id: string }
  | { name: 'settings' };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  const [head, ...rest] = path.split('/');
  if (head === 'tool' && rest[0]) return { name: 'tool', id: decodeURIComponent(rest[0]) };
  if (head === 'settings') return { name: 'settings' };
  return { name: 'home' };
}

export function href(route: Route): string {
  switch (route.name) {
    case 'home': return '#/';
    case 'tool': return `#/tool/${encodeURIComponent(route.id)}`;
    case 'settings': return '#/settings';
  }
}

export function navigate(route: Route): void {
  location.hash = href(route);
}

export function onRoute(fn: (r: Route) => void): () => void {
  const handler = () => fn(parseRoute(location.hash));
  window.addEventListener('hashchange', handler);
  handler();
  return () => window.removeEventListener('hashchange', handler);
}
