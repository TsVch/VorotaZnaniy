import { test, expect } from '@playwright/test';

/**
 * Visual regression tests for the Button component.
 * Each test navigates to a Storybook iframe and compares the rendered
 * story against a committed baseline screenshot.
 */
test.describe('Button Component', () => {
  test('should render the default button', async ({ page }) => {
    await page.goto('/iframe.html?id=ui-button--default&viewMode=story');
    await expect(page).toHaveScreenshot('button-default.png', {
      maxDiffPixels: 10,
      maxDiffPixelRatio: 0.01,
    });
  });

  test('should render all button variants', async ({ page }) => {
    await page.goto('/iframe.html?id=ui-button--variants&viewMode=story');
    await expect(page).toHaveScreenshot('button-variants.png', {
      maxDiffPixels: 20,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('should render all button sizes', async ({ page }) => {
    await page.goto('/iframe.html?id=ui-button--sizes&viewMode=story');
    await expect(page).toHaveScreenshot('button-sizes.png', {
      maxDiffPixels: 20,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('should render icon-only buttons', async ({ page }) => {
    await page.goto('/iframe.html?id=ui-button--icon-buttons&viewMode=story');
    await expect(page).toHaveScreenshot('button-icon.png', {
      maxDiffPixels: 20,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('should render loading/disabled state', async ({ page }) => {
    await page.goto('/iframe.html?id=ui-button--loading&viewMode=story');
    // Loading spinner animates — allow a higher tolerance
    await expect(page).toHaveScreenshot('button-loading.png', {
      maxDiffPixels: 50,
      maxDiffPixelRatio: 0.05,
    });
  });
});
