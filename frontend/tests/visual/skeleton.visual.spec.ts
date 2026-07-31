import { test, expect } from '@playwright/test';

test.describe('Skeleton Component', () => {
  test('should render basic skeleton blocks', async ({ page }) => {
    await page.goto('/iframe.html?id=ui-skeleton--basic&viewMode=story');
    // Skeleton pulses — allow higher tolerance
    await expect(page).toHaveScreenshot('skeleton-basic.png', {
      maxDiffPixels: 50,
      maxDiffPixelRatio: 0.05,
    });
  });

  test('should render card-shaped skeleton', async ({ page }) => {
    await page.goto('/iframe.html?id=ui-skeleton--card-layout&viewMode=story');
    await expect(page).toHaveScreenshot('skeleton-card.png', {
      maxDiffPixels: 50,
      maxDiffPixelRatio: 0.05,
    });
  });

  test('should render avatar-list skeleton', async ({ page }) => {
    await page.goto('/iframe.html?id=ui-skeleton--avatar-list&viewMode=story');
    await expect(page).toHaveScreenshot('skeleton-avatar-list.png', {
      maxDiffPixels: 50,
      maxDiffPixelRatio: 0.05,
    });
  });
});
