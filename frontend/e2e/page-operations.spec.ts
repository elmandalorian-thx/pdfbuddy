import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Page Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Upload a test PDF
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'multi-page.pdf'));

    // Wait for document to load
    await expect(page.locator('[data-testid="page-grid"]')).toBeVisible({ timeout: 30000 });
  });

  test('should select a page by clicking', async ({ page }) => {
    // Click on first page thumbnail
    const firstPage = page.locator('[data-testid="page-thumbnail-1"]');
    await firstPage.click();

    // Verify page is selected (has selection indicator)
    await expect(firstPage).toHaveClass(/selected|ring/);
  });

  test('should select multiple pages with Ctrl+Click', async ({ page }) => {
    const firstPage = page.locator('[data-testid="page-thumbnail-1"]');
    const secondPage = page.locator('[data-testid="page-thumbnail-2"]');

    // Click first page
    await firstPage.click();

    // Ctrl+Click second page
    await secondPage.click({ modifiers: ['Control'] });

    // Both pages should be selected
    await expect(firstPage).toHaveClass(/selected|ring/);
    await expect(secondPage).toHaveClass(/selected|ring/);
  });

  test('should select page range with Shift+Click', async ({ page }) => {
    const firstPage = page.locator('[data-testid="page-thumbnail-1"]');
    const thirdPage = page.locator('[data-testid="page-thumbnail-3"]');

    // Click first page
    await firstPage.click();

    // Shift+Click third page
    await thirdPage.click({ modifiers: ['Shift'] });

    // All pages from 1 to 3 should be selected
    await expect(firstPage).toHaveClass(/selected|ring/);
    await expect(page.locator('[data-testid="page-thumbnail-2"]')).toHaveClass(/selected|ring/);
    await expect(thirdPage).toHaveClass(/selected|ring/);
  });

  test('should rotate selected page', async ({ page }) => {
    // Select first page
    const firstPage = page.locator('[data-testid="page-thumbnail-1"]');
    await firstPage.click();

    // Find and click rotate button
    const rotateButton = page.getByTitle(/rotate/i).first();
    await rotateButton.click();

    // Wait for operation to complete
    await expect(page.getByText(/processing/i)).not.toBeVisible({ timeout: 30000 });
  });

  test('should delete selected page', async ({ page }) => {
    // Get initial page count
    const initialCount = await page.locator('[data-testid^="page-thumbnail-"]').count();

    // Select first page
    await page.locator('[data-testid="page-thumbnail-1"]').click();

    // Press Delete key
    await page.keyboard.press('Delete');

    // Wait for operation
    await expect(page.getByText(/processing/i)).not.toBeVisible({ timeout: 30000 });

    // Verify page count decreased
    const newCount = await page.locator('[data-testid^="page-thumbnail-"]').count();
    expect(newCount).toBe(initialCount - 1);
  });

  test('should select all pages with Ctrl+A', async ({ page }) => {
    // Press Ctrl+A
    await page.keyboard.press('Control+a');

    // All pages should be selected
    const pageCount = await page.locator('[data-testid^="page-thumbnail-"]').count();
    const selectedCount = await page.locator('[data-testid^="page-thumbnail-"].selected, [data-testid^="page-thumbnail-"][class*="ring"]').count();

    expect(selectedCount).toBe(pageCount);
  });
});

test.describe('Drag and Drop Reordering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'multi-page.pdf'));
    await expect(page.locator('[data-testid="page-grid"]')).toBeVisible({ timeout: 30000 });
  });

  test('should reorder pages via drag and drop', async ({ page }) => {
    const firstPage = page.locator('[data-testid="page-thumbnail-1"]');
    const thirdPage = page.locator('[data-testid="page-thumbnail-3"]');

    // Get bounding boxes
    const firstBox = await firstPage.boundingBox();
    const thirdBox = await thirdPage.boundingBox();

    if (firstBox && thirdBox) {
      // Drag first page to third position
      await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(thirdBox.x + thirdBox.width / 2, thirdBox.y + thirdBox.height / 2, { steps: 10 });
      await page.mouse.up();

      // Wait for reorder to complete
      await page.waitForTimeout(500);
    }
  });
});

test.describe('PDF Download', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'test.pdf'));
    await expect(page.locator('[data-testid="page-grid"]')).toBeVisible({ timeout: 30000 });
  });

  test('should download PDF file', async ({ page }) => {
    // Start waiting for download before clicking
    const downloadPromise = page.waitForEvent('download');

    // Click download button
    await page.getByTitle(/download/i).click();

    // Wait for download to start
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });
});
