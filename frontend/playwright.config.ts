import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for visual regression testing.
 *
 * Renders Storybook iframes (built static site) and compares screenshots
 * against committed baselines in tests/visual/__snapshots__.
 *
 * Uses the system-installed Chrome (`channel: 'chrome'`) instead of
 * downloading Playwright's own browsers — avoids download failures on
 * Windows machines with non-ASCII (Cyrillic) user paths.
 */
export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:6006',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    viewport: { width: 1200, height: 800 },
  },
  // Store one set of platform-independent baselines per test file
  // (e.g. tests/visual/button.visual.spec.ts-snapshots/button-default.png).
  // The default template adds a `-{platform}` suffix (chromium-win32 /
  // chromium-linux) which would make CI look for a different file than the
  // one committed from a dev machine. Rendering consistency is instead
  // guaranteed by forcing the same Chrome channel everywhere.
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use the system Chrome everywhere (local AND CI — GitHub's
        // ubuntu-latest runners ship Google Chrome). This keeps rendering
        // identical between environments so committed baselines match CI,
        // and avoids Playwright browser downloads on Windows / Cyrillic paths.
        channel: 'chrome',
      },
    },
  ],
  webServer: {
    // storybook build can take a while on a cold cache, so allow 5 minutes.
    command: 'pnpm exec storybook build && pnpm exec serve storybook-static -l 6006',
    url: 'http://localhost:6006',
    timeout: 300 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
