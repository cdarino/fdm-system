import { Page, expect } from '@playwright/test';

export const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'tester@example.com';
export const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'tester123!';

/**
 * Logs in as system administrator via the UI form and waits for redirection to dashboard.
 */
export async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await expect(page.locator('#email')).toBeVisible();
  await page.fill('#email', ADMIN_EMAIL);
  await page.fill('#password', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => url.pathname.startsWith('/dashboard'), { timeout: 30000 });
}
