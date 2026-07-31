import { test, expect } from '@playwright/test';

test.describe('Toast Component', () => {
  test('should render all toast variants', async ({ page }) => {
    await page.goto('/iframe.html?id=ui-toast--all-variants&viewMode=story');
    // Toasts animate in — allow a slightly higher tolerance
    await expect(page).toHaveScreenshot('toast-all-variants.png', {
      maxDiffPixels: 50,
      maxDiffPixelRatio: 0.05,
    });
  });

  test('should render a success toast', async ({ page }) => {
    await page.goto('/iframe.html?id=ui-toast--success&viewMode=story');
    await expect(page).toHaveScreenshot('toast-success.png', {
      maxDiffPixels: 50,
      maxDiffPixelRatio: 0.05,
    });
  });

  test('should render a warning toast', async ({ page }) => {
    await page.goto('/iframe.html?id=ui-toast--warning&viewMode=story');
    await expect(page).toHaveScreenshot('toast-warning.png', {
      maxDiffPixels: 50,
      maxDiffPixelRatio: 0.05,
    });
  });

  test('should render a destructive toast', async ({ page }) => {
    await page.goto('/iframe.html?id=ui-toast--destructive&viewMode=story');
    await expect(page).toHaveScreenshot('toast-destructive.png', {
      maxDiffPixels: 50,
      maxDiffPixelRatio: 0.05,
    });
  });
});
