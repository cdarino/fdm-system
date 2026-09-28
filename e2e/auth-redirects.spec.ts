import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Role-gated navigation and auth redirects', () => {
  test('redirects unauthenticated user accessing /dashboard to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL((url) => url.pathname === '/login');
    expect(page.url()).toContain('/login');
    expect(page.url()).toContain('next=');
  });

  test('redirects unauthenticated user accessing /dashboard/clients to /login', async ({ page }) => {
    await page.goto('/dashboard/clients');
    await page.waitForURL((url) => url.pathname === '/login');
    expect(page.url()).toContain('/login');
    expect(page.url()).toContain('next=%2Fdashboard%2Fclients');
  });

  test('redirects unauthenticated user accessing /dashboard/admin to /login', async ({ page }) => {
    await page.goto('/dashboard/admin');
    await page.waitForURL((url) => url.pathname === '/login');
    expect(page.url()).toContain('/login');
    expect(page.url()).toContain('next=%2Fdashboard%2Fadmin');
  });

  test('authenticates valid admin and redirects to dashboard', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('authenticated admin can access /dashboard/admin', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/admin');
    await expect(page).toHaveURL(/\/dashboard\/admin/);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
