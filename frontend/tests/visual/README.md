# Visual Regression Tests

Playwright screenshot-comparison tests for the KnowledgeVault design system.
Each test renders a Storybook story in a headless Chrome iframe and compares
the screenshot against a committed baseline.

## Setup

Dependencies are already in `frontend/package.json`:

- `@playwright/test`
- `storybook` + `@storybook/nextjs` + `@storybook/addon-essentials`
- `serve` (static file server for the built Storybook)

The config uses `channel: 'chrome'` — the **system-installed Chrome** — so no
Playwright browser binaries are downloaded. This avoids download failures on
Windows machines with non-ASCII (e.g. Cyrillic) user paths.

If your machine does not have Chrome installed, install it or switch the
config to Playwright's bundled Chromium (`npx playwright install chromium`).

## Run tests

```bash
pnpm run test:visual           # Build Storybook, serve it, run all visual tests
pnpm run test:visual:ui        # Run with Playwright UI (inspect/interact)
pnpm run test:visual:update    # Rebuild baselines from current rendering
pnpm run test:visual:report    # Open the HTML report
```

The `webServer` in `playwright.config.ts` builds Storybook and serves it on
port 6006 automatically, so no manual server is needed.

## Adding new visual tests

1. Create a Storybook story for the component (see `components/**/*.stories.tsx`).
   The story id is derived from its path: `components/ui/button.tsx` →
   `ui-button`, story name `Variants` → id `ui-button--variants`.
2. Create `tests/visual/<component>.visual.spec.ts`:
   ```ts
   test('should render X', async ({ page }) => {
     await page.goto('/iframe.html?id=ui-button--variants&viewMode=story');
     await expect(page).toHaveScreenshot('button-variants.png', {
       maxDiffPixels: 20,
       maxDiffPixelRatio: 0.02,
     });
   });
   ```
3. Run `pnpm run test:visual:update` to generate the baseline screenshot.
4. Commit the new spec **and** the baseline PNG in the matching
   `tests/visual/<spec>.visual.spec.ts-snapshots/` folder.

> Tip: a story with no `export const` args uses the *default* rendering; for
> multi-variant views, use `render: () => (...)` in the story.

> Note: full-page screenshots include Storybook's preview canvas background
> (light gray by default). Baselines are consistent, but if the canvas
> background ever changes, run `test:visual:update` once to refresh them.

## Tolerance guidelines

| Content                          | maxDiffPixels | maxDiffPixelRatio |
| :------------------------------- | :------------ | :---------------- |
| Static components (plain buttons) | 10            | 0.01              |
| Components with text/containers  | 20            | 0.02              |
| Animated states (loading, pulse) | 50            | 0.05              |

These thresholds absorb anti-aliasing and font-rendering differences between
runs. If a test is flaky, raise the tolerance for that screenshot rather than
removing the assertion.

## How it works

- `playwright.config.ts` → `testDir: ./tests/visual`, base URL
  `http://localhost:6006`, one Chromium project using system Chrome.
- Baselines live in per-file snapshot folders next to each spec
  (`tests/visual/<spec>.visual.spec.ts-snapshots/`), e.g.
  `tests/visual/button.visual.spec.ts-snapshots/button-variants.png`.
  A single platform-independent set is used (no `-win32`/`-linux` suffix),
  so the same baselines are compared locally and on CI.
- On CI, retries are enabled (2) and workers are pinned to 1 for stability.

## CI (optional)

A workflow example is provided in
`.github/workflows/visual-regression.yml`. It builds Storybook and runs the
same suite on Ubuntu. Note that font rendering differs between OSes — on a
new OS you may need to regenerate baselines (`test:visual:update`) once.
