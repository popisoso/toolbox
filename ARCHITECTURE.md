# Architecture

Running note for structural decisions. What the code already shows is not repeated here; this records *why*.

## Shape

```
src/
  engine/        the runtime: contract, GL, loop, params, seams   ← never edited to add a tool
  modules/       one folder per tool; auto-discovered              ← where all new work goes
  shell/         home screen, tool view, settings, PWA plumbing    ← knows nothing about specific tools
  styles/        tokens.css (identity) + base/shell CSS (tokens only)
vite/            build-time service-worker generation
```

Stack: Vite + TypeScript, no UI framework, WebGL2, hand-written service worker. Chosen so that the
whole thing is readable end to end and owned outright: no framework upgrade cycle, no PWA plugin
whose Workbox internals decide caching, no design system fighting the token layer.

## The module contract (`src/engine/module.ts`)

A tool is a `ModuleManifest`: identity, `requires` (capabilities), a declarative `params` list,
optional texture `inputs`/`outputs`, and `create(ctx) → ModuleInstance`. The instance has
`init / render(clock, target) / resize / onParam / onAction / ui / dispose`.

Decisions:

- **Params are data, not UI.** The shell builds controls from `ParamSpec`s and stores values in a
  `ParamStore`. Modules read `ctx.params` each frame. This is what makes presets, persistence,
  timeline automation and remote control possible without touching modules.
- **Modules render into a `RenderTarget`, never "the screen".** The single-tool view hands them a
  `ScreenTarget`; the `Compositor` hands them an `OffscreenTarget` and gets a texture back. Same
  instance code in both modes. This is the compositing seam and it is exercised, not theoretical.
- **Everything a module touches comes through `ModuleContext`.** GL, params, clock, viewport,
  video sources, the AI hook, GPU info, wired-in input textures. No globals, so a module can be
  hosted in a test, in the compositor, or in a future worker without change.
- **Discovery by folder.** `src/modules/index.ts` uses `import.meta.glob` on `./*/index.ts`.
  Adding a module never edits engine or shell code. `_shared/` is excluded from discovery.
- **`ui()` is an escape hatch, not the default.** Auto-generated controls cover ranges, toggles,
  selects, colours and actions. A module mounts custom UI only for things that are genuinely
  interactive (the source picker). Custom UI must use tokens. It is called after `init()` so it may
  rely on GL resources.
- **Paused clock = held frame.** `RenderLoop.setPaused` freezes `clock.time` and sets `dt = 0`.
  Stateful modules (feedback, simulations, ring buffers) advance only when `dt > 0`. This is what
  lets "Still" export a frame that is byte-identical to what is on screen, and it is tested that way.
- **Pointer is part of the context.** `ctx.pointer` (normalised, y up, `down`, `inside`) is tracked
  by the host on the canvas, so interaction never requires a module to touch the DOM.

## Seams

| Seam | Where | State this pass |
|---|---|---|
| Real-time video I/O | `engine/video/source.ts` (`VideoSource`, `VideoSourceFactory`) | Working: camera (with flip) and file sources, per-frame texture upload. Used by `video-input`. |
| Compositing | `engine/compose/compositor.ts` | Working: N layers → offscreen targets → blend pass (normal/add/multiply/screen). No UI yet. |
| Sequencing | `engine/compose/timeline.ts` | Data model + `clipsAt()` with fades, unit-tested. No UI yet. |
| Export | `engine/export/exporter.ts` | Working: PNG stills; MP4 (Safari) / WebM (Chromium) recording via `MediaRecorder`; share sheet on iOS. Frame-accurate offline render (WebCodecs) is the planned second implementation behind the same interface. |
| AI (Anthropic) | `engine/ai/assistant.ts` (`AIHook`) | Hook only. Official SDK, lazy-loaded chunk, user's own key from Settings, browser-direct calls. No module uses it. A relay server would replace the provider behind the same interface. |
| GPU compute | `engine/gpu/webgpu.ts` (`GpuInfo`) | Detection + lazy device. Baseline stays WebGL2 (see below). |
| State buffers | `engine/gl/target.ts` (`OffscreenTarget({float})`, `PingPong`, `TextureArrayTarget`) | Working: half-float targets with RGBA8 fallback, ping-pong pairs, layered frame buffers. Used by feedback-loop, morphogenesis, datamosh, time-slice. |
| Interaction | `ModuleContext.pointer` | Working: pointer/touch over the canvas. Used by morphogenesis (brush). |

## Rendering baseline: WebGL2, WebGPU as an opt-in accelerator

WebGL2 runs on every target device (iOS Safari included) with one code path, and every effect in
scope for the first modules is fragment-shader shaped. WebGPU's real advantage is compute
(particles, optical flow, big convolutions). So: the engine and shell depend on WebGL2 only; a
module that benefits from compute checks `ctx.gpu.available`, does its heavy pass in WebGPU, and
still renders through WebGL2 (or declares `requires: ['webgpu']` and is greyed out elsewhere).
Interop between the two contexts is the cost; it is paid per module, only where the win is real.

## Video texture seam inside the shader module

`noise-grid/shader.frag.glsl` has `uniform int uSourceMode; uniform sampler2D uSource;` and a
`field()` function that returns luma from `uSource` when `uSourceMode == 1`. The module ships in
mode 0 (procedural) so it needs no permissions. `video-input` is the proof that the same grid chunk
(`_shared/glsl/grid.glsl`) runs on a live texture. Swapping the noise for video inside noise-grid
itself is: open a source via `ctx.sources`, call `source.update(gl)` each frame, bind
`source.texture(gl)` to `uSource`, set `uSourceMode = 1`.

## Design-token layer

`src/styles/tokens.css` is the only file that names colours, fonts, sizes, radii, shadows and
motion. Everything else uses `var(--…)`. A Playwright test walks `src/shell` and `src/styles` and
fails on any literal colour outside tokens.css. `<meta name="theme-color">` is set at runtime from
`--color-bg`, so the manifest's `theme_color`/`background_color` are the only other place a colour
is written (manifests cannot read CSS). Theme choice is one attribute: `<html data-theme>`.

## PWA layer

- `public/manifest.webmanifest` uses relative URLs so the same build works at `/` and `/toolbox/`.
- `vite/pwa-precache.ts` emits `sw.js` at build with the exact asset list and a content hash.
- `index.html` never stays blank: a CSP-hashed inline boot fallback shows "Loading" after 1.5 s and
  a hint after 8 s, and a CSP-hashed inline boot guard (inline so it runs even when no other
  request completes) prints a failed script load or a startup exception into it. If nothing has
  rendered after 6 s while a service worker controls the page, the guard unregisters the worker,
  clears its caches and reloads once per session. The shell's first render replaces `#app`'s
  children, which removes the fallback.
- The worker's fetch path never writes to the cache (the precache at install is complete) and
  every cache lookup has a timeout, so a misbehaving CacheStorage cannot leave requests pending.
  Seen in the wild on iOS Safari: page HTML arrives, every script and stylesheet stays pending.
  Cache-first for hashed assets, network-first for navigation with the cached shell as fallback.
  `ignoreVary: true` is deliberate: hosts that send `Vary: Origin` otherwise miss crossorigin
  module scripts (found via vite preview, which does exactly that).
- Updates: the new worker waits; the shell shows "Update ready → Reload". Reload happens only on
  that click, never on first install (a `clients.claim()` also fires `controllerchange`).
- The service worker is registered only in production builds.

## Host lifecycle (`engine/host.ts`)

`ModuleHost` owns context creation, the `RenderLoop` (pauses when the tab is hidden), DPR-capped
canvas fitting via `ResizeObserver`, param persistence hooks, the exporter, source disposal, and
error capture (a throwing module stops its loop and the shell shows the message; the app stays up).
Stills are captured with `RenderLoop.onceAfterFrame` instead of `preserveDrawingBuffer`, which is
cheaper on mobile GPUs.

## Shared module code lives in `src/modules/_shared`, not the engine

`SourceInput` (procedural field or live video behind one texture), `Blit`, and the GLSL chunk
library (`noise`, `grid`, `fit`, `hash`) are module-level conveniences. They depend on the engine;
the engine never depends on them. Anything a module *needs* to talk to the shell goes through the
contract; anything modules merely *share* stays here, so the engine stays small.

## Testing strategy

- Unit (`node --test`): pure engine logic (params, timeline).
- Browser (Playwright, Chromium with SwiftShader, desktop + iPhone-sized projects): shell
  navigation, generated controls, pixel-statistics assertions on the shader's three regimes,
  fake-camera video path, token re-skin, manifest shape, offline reload through the service worker.
- Per-module behaviour: feedback decays to black and clears; reaction-diffusion grows from seeds,
  clears flat, and grows again under the pointer; datamosh is a pass-through at intensity 0 and
  deterministic in seed/time; time-slice equals the live frame on a static buffer and differs on a
  moving one.
- Export: for every module, the "Still" download is decoded in Node (own PNG decoder), checked for
  canvas dimensions and non-blank content, and compared byte-for-byte with the frame the module
  rendered. "Record" is downloaded and its container is probed with ffmpeg.
- CI: software GL makes browser tests 5–10× slower than on a laptop, so the suite is split by a
  `@slow` tag into a fast tier and a sharded heavy tier, with test-level scheduling
  (`fullyParallel: true`) so shards balance. Markdown and Pages-workflow changes skip CI.
- Not verifiable in CI: actual Add to Home Screen / Add to Dock. Those need a real iOS/macOS
  device against an HTTPS origin; see TOOLBOX.md → Install.
