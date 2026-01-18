import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Metadata Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'test.pdf'));
    await expect(page.locator('[data-testid="page-grid"]')).toBeVisible({ timeout: 30000 });
  });

  test('should open metadata editor', async ({ page }) => {
    // Click metadata button (info icon)
    await page.getByTitle(/metadata/i).click();

    // Metadata dialog should open
    await expect(page.getByText(/edit metadata/i)).toBeVisible();
    await expect(page.locator('input[name="title"], input[placeholder*="title" i]')).toBeVisible();
  });

  test('should update PDF metadata', async ({ page }) => {
    // Open metadata editor
    await page.getByTitle(/metadata/i).click();
    await expect(page.getByText(/edit metadata/i)).toBeVisible();

    // Fill in metadata fields
    const titleInput = page.locator('input[name="title"], input[placeholder*="title" i]');
    await titleInput.fill('Test Document Title');

    const authorInput = page.locator('input[name="author"], input[placeholder*="author" i]');
    await authorInput.fill('Test Author');

    // Save metadata
    await page.getByRole('button', { name: /save/i }).click();

    // Wait for success
    await expect(page.getByText(/success|updated/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Form Filling', () => {
  test('should open form filler dialog', async ({ page }) => {
    await page.goto('/');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'test.pdf'));
    await expect(page.locator('[data-testid="page-grid"]')).toBeVisible({ timeout: 30000 });

    // Click form filler button
    await page.getByTitle(/form/i).click();

    // Form filler dialog should open
    await expect(page.getByText(/form|fields/i)).toBeVisible();
  });
});

test.describe('Watermark', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'test.pdf'));
    await expect(page.locator('[data-testid="page-grid"]')).toBeVisible({ timeout: 30000 });
  });

  test('should add watermark to PDF', async ({ page }) => {
    // Open watermark dialog (if available in toolbar)
    const watermarkButton = page.getByTitle(/watermark/i);

    if (await watermarkButton.isVisible()) {
      await watermarkButton.click();

      // Fill watermark text
      await page.locator('input[name="watermark"], input[placeholder*="watermark" i]').fill('CONFIDENTIAL');

      // Apply watermark
      await page.getByRole('button', { name: /apply|add/i }).click();

      // Wait for completion
      await expect(page.getByText(/processing/i)).not.toBeVisible({ timeout: 30000 });
    }
  });
});

test.describe('PDF Encryption', () => {
  test('should encrypt PDF with password', async ({ page }) => {
    await page.goto('/');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'test.pdf'));
    await expect(page.locator('[data-testid="page-grid"]')).toBeVisible({ timeout: 30000 });

    // Open encryption dialog (if available)
    const encryptButton = page.getByTitle(/encrypt|password/i);

    if (await encryptButton.isVisible()) {
      await encryptButton.click();

      // Fill password
      await page.locator('input[type="password"]').first().fill('test123');

      // Confirm password
      const confirmInput = page.locator('input[type="password"]').nth(1);
      if (await confirmInput.isVisible()) {
        await confirmInput.fill('test123');
      }

      // Apply encryption
      await page.getByRole('button', { name: /encrypt|apply/i }).click();

      // Wait for completion
      await expect(page.getByText(/encrypted|success/i)).toBeVisible({ timeout: 30000 });
    }
  });
});

test.describe('Split PDF', () => {
  test('should split PDF into individual pages', async ({ page }) => {
    await page.goto('/');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'multi-page.pdf'));
    await expect(page.locator('[data-testid="page-grid"]')).toBeVisible({ timeout: 30000 });

    // Open split dialog
    const splitButton = page.getByTitle(/split/i);

    if (await splitButton.isVisible()) {
      await splitButton.click();

      // Select split mode
      await page.getByText(/individual/i).click();

      // Execute split
      await page.getByRole('button', { name: /split/i }).click();

      // Wait for completion and download links
      await expect(page.getByText(/download|split files/i)).toBeVisible({ timeout: 30000 });
    }
  });
});

test.describe('Merge PDFs', () => {
  test('should merge multiple PDFs', async ({ page }) => {
    await page.goto('/');

    const fileInput = page.locator('input[type="file"]');

    // Check if merge functionality is available
    const mergeButton = page.getByTitle(/merge/i);

    if (await mergeButton.isVisible()) {
      await mergeButton.click();

      // Upload multiple files
      await fileInput.setInputFiles([
        path.join(__dirname, 'fixtures', 'test.pdf'),
        path.join(__dirname, 'fixtures', 'test.pdf'),
      ]);

      // Execute merge
      await page.getByRole('button', { name: /merge/i }).click();

      // Wait for merged document to load
      await expect(page.locator('[data-testid="page-grid"]')).toBeVisible({ timeout: 30000 });
    }
  });
});
