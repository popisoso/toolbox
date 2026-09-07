/**
 * Injects a Content-Security-Policy <meta> into the production index.html.
 * Build-only: Vite's dev server relies on inline styles/scripts for HMR.
 *
 * What the policy allows, and why:
 *  - scripts/styles/workers/manifest from this origin only (no CDNs, no inline)
 *  - connect-src: this origin (service worker precache) + the Anthropic API,
 *    the only external endpoint the app can ever talk to, and only when the
 *    user has entered their own key
 *  - img/media: blob: and data: for exported stills, video files and the
 *    camera MediaStream
 *  - object/base/form: none. Nothing embeds, nothing rebases, nothing posts.
 *  - frame-ancestors is deliberately absent: it is ignored (with a console
 *    error) when delivered via <meta>, and Pages cannot send headers.
 *  - the one inline <style> in index.html (the boot fallback) is allowed by
 *    its SHA-256 hash, computed here from the final HTML, so 'unsafe-inline'
 *    is never needed.
 */
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: mediastream:",
  "connect-src 'self' https://api.anthropic.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  // frame-ancestors is header-only; browsers ignore it in a <meta> tag and log
  // an error. GitHub Pages cannot set response headers, so it is left out.
].join('; ');

export function csp(): Plugin {
  return {
    name: 'toolbox:csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const hashes = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
          .map((m) => `'sha256-${createHash('sha256').update(m[1]!).digest('base64')}'`);
        const policy = CSP.replace("style-src 'self'", ["style-src 'self'", ...hashes].join(' '));
        return html.replace(
          '<meta charset="utf-8" />',
          `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
        );
      },
    },
  };
}
