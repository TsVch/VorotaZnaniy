import { test, expect } from '@playwright/test';

test.describe('ErrorBoundary Component', () => {
  test('should render the default fallback UI', async ({ page }) => {
    await page.goto('/iframe.html?id=ui-errorboundary--default-fallback&viewMode=story');
    await expect(page).toHaveScreenshot('error-boundary-default.png', {
      maxDiffPixels: 20,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('should render a custom fallback UI', async ({ page }) => {
    await page.goto('/iframe.html?id=ui-errorboundary--custom-fallback&viewMode=story');
    await expect(page).toHaveScreenshot('error-boundary-custom.png', {
      maxDiffPixels: 20,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('should render healthy children untouched', async ({ page }) => {
    await page.goto('/iframe.html?id=ui-errorboundary--healthy-children&viewMode=story');
    await expect(page).toHaveScreenshot('error-boundary-healthy.png', {
      maxDiffPixels: 20,
      maxDiffPixelRatio: 0.02,
    });
  });
});
