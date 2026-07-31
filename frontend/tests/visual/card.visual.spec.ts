import { test, expect } from '@playwright/test';

test.describe('Card Component', () => {
  test('should render a minimal card', async ({ page }) => {
    await page.goto('/iframe.html?id=ui-card--default&viewMode=story');
    await expect(page).toHaveScreenshot('card-default.png', {
      maxDiffPixels: 20,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('should render card with header and footer', async ({ page }) => {
    await page.goto('/iframe.html?id=ui-card--with-header-and-footer&viewMode=story');
    await expect(page).toHaveScreenshot('card-header-footer.png', {
      maxDiffPixels: 20,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('should render compact card', async ({ page }) => {
    await page.goto('/iframe.html?id=ui-card--compact&viewMode=story');
    await expect(page).toHaveScreenshot('card-compact.png', {
      maxDiffPixels: 20,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('should render card with header action', async ({ page }) => {
    await page.goto('/iframe.html?id=ui-card--with-action&viewMode=story');
    await expect(page).toHaveScreenshot('card-action.png', {
      maxDiffPixels: 20,
      maxDiffPixelRatio: 0.02,
    });
  });
});
