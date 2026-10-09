import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Client journeys: field validations, modal closure, and list updates', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/clients');
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();
  });

  test('displays field validation errors when submitting invalid client data', async ({ page }) => {
    // Open New Client modal
    await page.getByRole('button', { name: 'New Client' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Add client')).toBeVisible();

    // 1. Submit empty form to trigger required full_name error
    await dialog.getByRole('button', { name: 'Create client' }).click();
    await expect(dialog.getByText('Full name is required')).toBeVisible();

    // 2. Input invalid TIN format
    await dialog.locator('#create-client-name').fill('Test Client With Bad TIN');
    await dialog.locator('#create-client-tin').fill('123456'); // invalid format (needs XXX-XXX-XXX)
    await dialog.getByRole('button', { name: 'Create client' }).click();
    await expect(
      dialog.getByText('TIN must follow the format XXX-XXX-XXX with numbers only')
    ).toBeVisible();

    // Modal should remain open when there are validation errors
    await expect(dialog).toBeVisible();

    // Cancel closes the modal
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('successfully creates a client, closes modal, displays toast, and updates list', async ({ page }) => {
    // Client names cannot contain digits, so the timestamp is spelled with letters.
    const uniqueSuffix = Date.now().toString().replace(/\d/g, (d) => "abcdefghij"[Number(d)]);
    const uniqueClientName = `Test Auto Client ${uniqueSuffix}`;
    const testAddress = 'E2E Testing Avenue, Davao City';
    const testTin = '987-654-321';

    // Open New Client modal
    await page.getByRole('button', { name: 'New Client' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Fill valid data
    await dialog.locator('#create-client-name').fill(uniqueClientName);
    await dialog.locator('#create-client-address').fill(testAddress);
    await dialog.locator('#create-client-tin').fill(testTin);

    // Submit form
    await dialog.getByRole('button', { name: 'Create client' }).click();

    // Modal closes upon successful creation
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Toast notification appears
    await expect(page.getByText('Client created successfully')).toBeVisible();

    // Newly created client appears in the table list
    await expect(page.getByText(uniqueClientName)).toBeVisible();
  });
});
