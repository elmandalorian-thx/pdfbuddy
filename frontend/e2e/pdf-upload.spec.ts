import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('PDF Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the upload area on landing page', async ({ page }) => {
    await expect(page.getByText('PDF Buddy')).toBeVisible();
    await expect(page.getByText('Drag & Drop')).toBeVisible();
    await expect(page.getByRole('button', { name: /browse/i })).toBeVisible();
  });

  test('should upload a PDF file successfully', async ({ page }) => {
    // Create a test PDF file
    const fileInput = page.locator('input[type="file"]');

    // Upload test PDF
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'test.pdf'));

    // Wait for upload to complete
    await expect(page.getByText('File loaded successfully!')).toBeVisible({ timeout: 30000 });

    // Verify document is loaded
    await expect(page.locator('[data-testid="page-grid"]')).toBeVisible();
  });

  test('should show error for non-PDF files', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');

    // Try to upload a text file
    await fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('This is not a PDF'),
    });

    // Expect an error message
    await expect(page.getByText(/invalid file type|only pdf/i)).toBeVisible({ timeout: 10000 });
  });

  test('should display page count after upload', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'test.pdf'));

    // Wait for document to load
    await expect(page.locator('[data-testid="page-grid"]')).toBeVisible({ timeout: 30000 });

    // Check that page count is displayed in header
    await expect(page.getByText(/\d+ page/)).toBeVisible();
  });
});

test.describe('Theme Toggle', () => {
  test('should toggle between light and dark mode', async ({ page }) => {
    await page.goto('/');

    // Find theme toggle button
    const themeButton = page.getByTitle(/switch to/i);

    // Get initial theme
    const html = page.locator('html');
    const initialTheme = await html.getAttribute('class');

    // Toggle theme
    await themeButton.click();

    // Wait for theme change
    await page.waitForTimeout(300);

    // Verify theme changed
    const newTheme = await html.getAttribute('class');
    expect(newTheme).not.toBe(initialTheme);
  });
});

test.describe('Keyboard Shortcuts', () => {
  test('should open keyboard shortcuts help with ? key', async ({ page }) => {
    await page.goto('/');

    // Press ? key
    await page.keyboard.press('?');

    // Expect keyboard shortcuts dialog to open
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible();
  });
});
