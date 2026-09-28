import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Property journeys: field validations, modal closure, and lot creation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/properties');
    await expect(page.getByRole('heading', { name: 'Property Lots', level: 1 })).toBeVisible();
  });

  test('displays field validation errors when submitting incomplete property lot', async ({ page }) => {
    await page.getByRole('button', { name: 'New Lot' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('New Property Lot')).toBeVisible();

    // Submit without choosing a site or entering required numbers
    await dialog.getByRole('button', { name: 'Create Lot' }).click();

    // Verify validation errors are displayed beneath the inputs
    await expect(dialog.getByText('Block number is required')).toBeVisible();
    await expect(dialog.getByText('Lot number is required')).toBeVisible();

    // Modal remains open on error
    await expect(dialog).toBeVisible();

    // Cancel closes dialog
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('creates a new property lot, closes modal, shows toast notification, and updates lot table', async ({ page }) => {
    const randomBlock = Math.floor(Math.random() * 800) + 100;
    const randomLot = Math.floor(Math.random() * 80) + 10;

    await page.getByRole('button', { name: 'New Lot' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Choose a site from the select dropdown
    const siteSelectTrigger = dialog.locator('#site_id');
    await siteSelectTrigger.click();
    // Select first site option in dropdown
    const firstOption = page.locator('[role="option"]').first();
    await expect(firstOption).toBeVisible();
    await firstOption.click();

    // Fill valid lot details
    await dialog.locator('#block_number').fill(String(randomBlock));
    await dialog.locator('#lot_number').fill(String(randomLot));
    await dialog.locator('#area_size').fill('200');
    await dialog.locator('#price_per_sqm').fill('5000');

    // Submit
    await dialog.getByRole('button', { name: 'Create Lot' }).click();

    // Modal closes
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Toast notification appears
    await expect(page.getByText('Property lot created successfully')).toBeVisible();

    // The new lot shows in the table
    await expect(page.getByText(`Block ${randomBlock} Lot ${randomLot}`)).toBeVisible();
  });
});
