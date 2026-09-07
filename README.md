# Toolbox

An owned, modular, studio-grade media production toolkit. Real-time shader, video and
post-production tools in one installable web app (PWA) for iPhone and Mac. No accounts,
no rented software: everything runs in the browser on your own hardware.

## Tools

| Tool | What it does |
|---|---|
| **Noise Grid** | Procedural noise field; one control takes it from a continuous surface to a coarse discrete point grid. Reference module. |
| **Video Input** | Camera or video file with grading and the grid resampler on live frames. |
| **Feedback Loop** | Recursive video feedback: zoom, rotate, drift, decay and hue-shift the previous frame while injecting the source. |
| **Morphogenesis** | Gray-Scott reaction-diffusion. Presets, pointer brush, and video that biases the chemistry. |
| **Datamosh** | Compression artefacts as material: block displacement, stuck macroblocks, tearing, channel split, posterise. |
| **Time Slice** | Slit-scan and temporal displacement over a ring buffer of the last frames. |

Every tool exports a Still (PNG) and a Recording (MP4 on Safari, WebM on Chromium), works
offline once installed, and takes the camera or a video file where that makes sense.

## Run

```
npm install
npm run dev        # local dev server, also reachable from your phone on the same Wi-Fi
npm run build      # production build in dist/ (includes the service worker)
npm run preview    # serve the production build
npm test           # Playwright browser suite (desktop + phone profiles)
npm run test:unit  # engine unit tests
```

## Install on your devices

The app needs an HTTPS origin. GitHub Pages is wired up: enable it once under
Settings → Pages → Source: **GitHub Actions**, and every push to `main` deploys to

**https://popisoso.github.io/toolbox/**

Note the `/toolbox/` path: a project site lives under the repository name. The bare
`https://popisoso.github.io/` is a different site (it would need a repository named
`popisoso.github.io`) and shows GitHub's 404 page.

- **iPhone (Safari):** Share → **Add to Home Screen**.
- **Mac (Safari):** File → **Add to Dock…**
- **Mac (Chrome/Edge):** the install icon in the address bar, or the Install button on the home screen.

## Add a tool

Create `src/modules/<id>/index.ts` exporting a module manifest. It appears on the home screen;
nothing in the engine or shell changes. Step-by-step in [TOOLBOX.md](TOOLBOX.md).

## Re-skin

All colour, type, spacing, radii, shadows and motion live in `src/styles/tokens.css`. The shipped
values are neutral placeholders.

## Privacy and security

- **Nothing leaves your device by default.** No analytics, no telemetry, no third-party scripts or
  fonts. The service worker caches only this site's own files.
- **Camera and files** are processed on the GPU in your browser and never uploaded. The camera
  starts only when you press the button and stops when you press Stop or leave the tool.
- **AI hook**: the one optional external connection is to the Anthropic API, only if you enter your
  own API key in Settings. The key is stored in this browser's local storage, in plain text, and
  sent only to `api.anthropic.com`. Remove it from Settings at any time. No tool uses it yet.
- **Exports** (stills, recordings) go straight to your Files app / share sheet / downloads folder.
- The production page ships a strict Content-Security-Policy (scripts, styles and workers from this
  origin only; network only to this origin and the Anthropic API) and a no-referrer policy.
- If you self-host or fork: the app has no server side, so there is nothing to configure or leak.

## Documentation

- [TOOLBOX.md](TOOLBOX.md): tools, running, adding a tool, re-skinning, renaming, installing, what is not done yet.
- [ARCHITECTURE.md](ARCHITECTURE.md): the module contract, engine seams, and why the structure is the way it is.

## Status

Foundation plus six modules. Verified by 62 browser tests (shell, each module's behaviour, token
re-skin, offline service worker, and byte-exact export downloads) and unit tests. Installation on
real iOS/macOS devices is the one step not covered by automated tests.
