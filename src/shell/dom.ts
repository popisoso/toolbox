/** Tiny DOM helpers so the shell stays framework-free. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Omit<HTMLElementTagNameMap[K], 'style' | 'dataset'>> & { className?: string; dataset?: Record<string, string>; text?: string } = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { dataset, text, ...rest } = props;
  Object.assign(node, rest);
  if (dataset) for (const [k, v] of Object.entries(dataset)) node.dataset[k] = v;
  if (text !== undefined) node.textContent = text;
  for (const c of children) if (c) node.append(c);
  return node;
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

let toastTimer = 0;
export function toast(message: string, action?: { label: string; onClick: () => void }, ms = 6000): void {
  document.querySelector('.toast')?.remove();
  const t = el('div', { className: 'toast', role: 'status' }, el('span', { text: message }));
  if (action) {
    const b = el('button', { className: 'btn', text: action.label, type: 'button' });
    b.addEventListener('click', () => { action.onClick(); t.remove(); });
    t.append(b);
  }
  document.body.append(t);
  clearTimeout(toastTimer);
  if (ms > 0) toastTimer = window.setTimeout(() => t.remove(), ms);
}
