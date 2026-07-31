import { test, expect } from '@playwright/test';

/**
 * Visual regression tests for the DocumentStatusBadge component
 * (KnowledgeVault's badge — replaces the generic Badge from the original
 * task package, which does not exist in this codebase).
 */
test.describe('DocumentStatusBadge Component', () => {
  test('should render all three statuses', async ({ page }) => {
    await page.goto(
      '/iframe.html?id=dashboard-documentstatusbadge--all-statuses&viewMode=story',
    );
    await expect(page).toHaveScreenshot('badge-all-statuses.png', {
      maxDiffPixels: 20,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('should render PROCESSING status', async ({ page }) => {
    await page.goto(
      '/iframe.html?id=dashboard-documentstatusbadge--processing&viewMode=story',
    );
    // Processing badge pulses — allow higher tolerance
    await expect(page).toHaveScreenshot('badge-processing.png', {
      maxDiffPixels: 50,
      maxDiffPixelRatio: 0.05,
    });
  });

  test('should render READY status', async ({ page }) => {
    await page.goto(
      '/iframe.html?id=dashboard-documentstatusbadge--ready&viewMode=story',
    );
    await expect(page).toHaveScreenshot('badge-ready.png', {
      maxDiffPixels: 20,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('should render ERROR status', async ({ page }) => {
    await page.goto(
      '/iframe.html?id=dashboard-documentstatusbadge--error&viewMode=story',
    );
    await expect(page).toHaveScreenshot('badge-error.png', {
      maxDiffPixels: 20,
      maxDiffPixelRatio: 0.02,
    });
  });
});
