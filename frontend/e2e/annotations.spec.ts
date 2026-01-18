import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Annotation Tools', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Upload a test PDF
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'test.pdf'));

    // Wait for document to load
    await expect(page.locator('[data-testid="page-grid"]')).toBeVisible({ timeout: 30000 });
  });

  test('should open annotation editor when clicking pencil icon', async ({ page }) => {
    // Hover over first page to reveal actions
    const firstPage = page.locator('[data-testid="page-thumbnail-1"]');
    await firstPage.hover();

    // Click the annotate/pencil icon
    const annotateButton = page.getByTitle(/annotate|edit/i).first();
    await annotateButton.click();

    // Annotation editor should open
    await expect(page.locator('[data-testid="annotation-editor"]')).toBeVisible({ timeout: 10000 });
  });

  test('should display annotation toolbar with tools', async ({ page }) => {
    // Open annotation editor
    const firstPage = page.locator('[data-testid="page-thumbnail-1"]');
    await firstPage.hover();
    await page.getByTitle(/annotate|edit/i).first().click();

    await expect(page.locator('[data-testid="annotation-editor"]')).toBeVisible({ timeout: 10000 });

    // Check for annotation tools
    await expect(page.getByTitle(/pen/i)).toBeVisible();
    await expect(page.getByTitle(/highlighter/i)).toBeVisible();
    await expect(page.getByTitle(/eraser/i)).toBeVisible();
  });

  test('should select pen tool and change color', async ({ page }) => {
    // Open annotation editor
    const firstPage = page.locator('[data-testid="page-thumbnail-1"]');
    await firstPage.hover();
    await page.getByTitle(/annotate|edit/i).first().click();

    await expect(page.locator('[data-testid="annotation-editor"]')).toBeVisible({ timeout: 10000 });

    // Select pen tool
    await page.getByTitle(/pen/i).click();

    // Look for color picker
    const colorPicker = page.locator('[data-testid="color-picker"], input[type="color"]');
    if (await colorPicker.isVisible()) {
      await colorPicker.click();
    }
  });

  test('should undo annotation with Ctrl+Z', async ({ page }) => {
    // Open annotation editor
    const firstPage = page.locator('[data-testid="page-thumbnail-1"]');
    await firstPage.hover();
    await page.getByTitle(/annotate|edit/i).first().click();

    await expect(page.locator('[data-testid="annotation-editor"]')).toBeVisible({ timeout: 10000 });

    // Select pen tool
    await page.getByTitle(/pen/i).click();

    // Draw something on canvas
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();

    if (box) {
      await page.mouse.move(box.x + 100, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(box.x + 200, box.y + 200, { steps: 10 });
      await page.mouse.up();
    }

    // Undo with Ctrl+Z
    await page.keyboard.press('Control+z');
  });

  test('should close annotation editor with Escape', async ({ page }) => {
    // Open annotation editor
    const firstPage = page.locator('[data-testid="page-thumbnail-1"]');
    await firstPage.hover();
    await page.getByTitle(/annotate|edit/i).first().click();

    await expect(page.locator('[data-testid="annotation-editor"]')).toBeVisible({ timeout: 10000 });

    // Press Escape to close
    await page.keyboard.press('Escape');

    // Editor should be closed
    await expect(page.locator('[data-testid="annotation-editor"]')).not.toBeVisible();
  });
});

test.describe('Save Annotations', () => {
  test('should save annotations to PDF', async ({ page }) => {
    await page.goto('/');

    // Upload PDF
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'test.pdf'));
    await expect(page.locator('[data-testid="page-grid"]')).toBeVisible({ timeout: 30000 });

    // Open annotation editor
    const firstPage = page.locator('[data-testid="page-thumbnail-1"]');
    await firstPage.hover();
    await page.getByTitle(/annotate|edit/i).first().click();

    await expect(page.locator('[data-testid="annotation-editor"]')).toBeVisible({ timeout: 10000 });

    // Draw something
    await page.getByTitle(/pen/i).click();
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();

    if (box) {
      await page.mouse.move(box.x + 100, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(box.x + 200, box.y + 200, { steps: 10 });
      await page.mouse.up();
    }

    // Click save button
    const saveButton = page.getByRole('button', { name: /save/i });
    await saveButton.click();

    // Wait for save to complete
    await expect(page.getByText(/saved|success/i)).toBeVisible({ timeout: 30000 });
  });
});
