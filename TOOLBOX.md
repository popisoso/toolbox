# Toolbox

What exists, how to run it, how to add a tool, how to install it.

## Tools

| id | Category | What it does | Requires |
|---|---|---|---|
| `noise-grid` | shader | Procedural noise field; the **Grid** control (0→1) goes continuous → mosaic → discrete point grid. Reference module. | webgl2 |
| `video-input` | video | Camera or video file with grading (exposure/contrast/saturation, mirror) and the same grid resampler on live frames. | webgl2 (+ camera when used) |

Shell features shared by every tool: auto-generated controls (bottom sheet on phones, side panel on
wide screens), per-tool param persistence, Still export (PNG), Record (MP4 on Safari, WebM on
Chromium), Hide UI, Settings (theme, Anthropic API key, device capabilities).

## Run

```
npm install
npm run dev        # http://localhost:5173, also on your LAN IP for phone testing
npm run build      # dist/ (typecheck + bundle + sw.js)
npm run preview    # serve dist/ on :4173; the service worker only runs in production builds
# sub-path build (as GitHub Pages serves it): BASE_PATH=/toolbox/ npm run build && BASE_PATH=/toolbox/ npm run preview
npm run test:unit
CHROMIUM_PATH=/path/to/chrome npm test   # Playwright; omit CHROMIUM_PATH if `npx playwright install chromium` was run
npm run icons      # regenerate public/icons from scripts/make-icons.mjs
```

## Add a tool

1. Create `src/modules/<id>/index.ts` that `export default defineModule({...})`.
2. Declare `params` as data; read them with `ctx.params.number('key')` in `render`.
3. In `render`, call `target.bind(gl)` first, then draw. Use `Program`, `FullscreenQuad`, and
   `resolveIncludes()` for shared GLSL (`_shared/glsl/*.glsl`) if it is a fragment-shader tool.
4. Need live video? Mount `mountSourcePicker` in `ui()` and read `source.texture(gl)`.
5. Need a button? Add an `action` param and implement `onAction`.
6. Done. It appears on the home screen; the shell greys it out on devices missing a `requires`.

Nothing in `src/engine` or `src/shell` changes. `video-input` was added this way after
`noise-grid`, with zero engine edits.

Minimal skeleton:

```ts
import { defineModule, FullscreenQuad, FULLSCREEN_VS, Program,
  type Clock, type ModuleContext, type ModuleInstance, type RenderTarget } from '@engine/index';
import frag from './shader.frag.glsl?raw';

export default defineModule({
  id: 'my-tool', name: 'My Tool', description: '…', category: 'shader', version: '0.1.0',
  requires: ['webgl2'],
  params: [{ kind: 'range', key: 'amount', label: 'Amount', min: 0, max: 1, default: 0.5 }],
  create: (ctx) => new MyTool(ctx),
});

class MyTool implements ModuleInstance {
  private program!: Program; private quad!: FullscreenQuad;
  constructor(private ctx: ModuleContext) {}
  init() { this.program = new Program(this.ctx.gl, FULLSCREEN_VS, frag); this.quad = new FullscreenQuad(this.ctx.gl); }
  render(clock: Clock, target: RenderTarget) {
    const { gl, params } = this.ctx;
    target.bind(gl); this.program.use();
    this.program.v2('uResolution', target.width, target.height);
    this.program.f('uTime', clock.time);
    this.program.f('uAmount', params.number('amount'));
    this.quad.draw();
  }
  dispose() { this.program.dispose(); this.quad.dispose(); }
}
```

## Re-skin

Edit `src/styles/tokens.css`. That is the whole job: colour, type, spacing, radii, shadows,
motion, control heights. `public/manifest.webmanifest` `theme_color`/`background_color` and the
icon script (`scripts/make-icons.mjs` → `npm run icons`) are the only other places visual identity
lives, because the OS reads those before any CSS loads.

## Rename

Placeholder name is "Toolbox". Change `APP_NAME` in `src/shell/app-config.ts`, `name`/`short_name`
in `public/manifest.webmanifest`, and `<title>` + `apple-mobile-web-app-title` in `index.html`.

## Install

The app must be served over HTTPS (or `localhost`) for the service worker and install prompts.

**Free hosting that is already wired up: GitHub Pages.**
`.github/workflows/pages.yml` builds with `BASE_PATH=/toolbox/` and deploys on every push to
`main`. One-time setup in the repo: Settings → Pages → Source: **GitHub Actions**. The app is then
at `https://<owner>.github.io/toolbox/`.

- **iPhone (iOS Safari):** open the URL → Share → **Add to Home Screen** → Add. Opens fullscreen
  (standalone), works offline after the first visit.
- **MacBook, Safari:** open the URL → File → **Add to Dock…**.
- **MacBook, Chrome/Edge:** click the install icon in the address bar (or ⋮ → Install), or use the
  **Install** button the home screen shows when the browser offers a prompt.

Local testing on a phone without hosting: `npm run dev` and open the LAN URL Vite prints. Add to
Home Screen works, but offline caching does not (not a secure context).

## Not done yet (honest list)

- Add to Home Screen / Add to Dock were not exercised on real iOS/macOS from this environment.
  Everything a device checks (manifest, icons, standalone display, apple meta tags, service worker,
  offline reload) is tested in Chromium; the final tap is yours.
- Compositor and timeline have no UI. They are working engine APIs with tests, not tools yet.
- WebGPU: detection and device seam only.
- AI hook: wired and lazy-loaded; no tool calls it.
- Recording on iOS Safari produces MP4 via MediaRecorder; long recordings on older iPhones may be
  memory-limited. A frame-accurate offline exporter is the planned fix.
