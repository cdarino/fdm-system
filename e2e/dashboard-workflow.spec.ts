import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Sprint 3 dashboard workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('offers working current modules in workflow order', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation', exact: true });
    await expect(nav.getByRole('link', { name: 'Client records' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Property inventory' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Title releases' })).toBeVisible();
    await expect(nav.getByText('Invoicing & Billing')).toHaveCount(0);
    await expect(nav.getByText('Accounts Payable')).toHaveCount(0);
    await expect(nav.getByText('Operations Log')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Your daily workflow' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent changes' })).toBeVisible();
    await page.locator('main > div').first().evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: '/tmp/fdm-dashboard-desktop.png', fullPage: true });

    await nav.getByRole('link', { name: 'Title releases' }).click();
    await expect(page.getByRole('heading', { name: 'Title releases', exact: true })).toBeVisible();
    const stages = page.getByRole('navigation', { name: 'Title release workflow' });
    await stages.getByRole('button', { name: 'Title release workflow', exact: true }).click();
    await page.getByRole('menuitem', { name: /Prepare documents/ }).click();
    await expect(page.getByRole('heading', { name: 'Prepare documents', exact: true })).toBeVisible();
    await stages.getByRole('button', { name: 'Title release workflow', exact: true }).click();
    await page.getByRole('menuitem', { name: /Legal verification/ }).click();
    await expect(page.getByRole('heading', { name: 'Legal verification', exact: true })).toBeVisible();
    await stages.getByRole('button', { name: 'Title release workflow', exact: true }).click();
    await page.getByRole('menuitem', { name: /Management signature/ }).click();
    await expect(page.getByRole('heading', { name: 'Management signature', exact: true })).toBeVisible();
    await stages.getByRole('button', { name: 'Title release workflow', exact: true }).click();
    await page.getByRole('menuitem', { name: /Ready for claim/ }).click();
    await expect(page.getByRole('heading', { name: 'Ready for claim', exact: true })).toBeVisible();
    await expect(page.getByText('Contact the client, issue a claim notice, and record delivery and follow-ups.')).toBeVisible();
  });

  test('keeps stage navigation accessible on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard/legal');
    await expect(page.getByRole('navigation', { name: 'Title release workflow' })).toBeVisible();
    await page.getByRole('button', { name: 'Title release workflow', exact: true }).click();
    await page.getByRole('menuitem', { name: /Released/ }).click();
    await expect(page.getByRole('heading', { name: 'Released', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: '/tmp/fdm-title-mobile.png', fullPage: true });
  });

  test('lets a mobile user reach client documents and assigned lots', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard/clients');
    await page.locator('main a[href^="/dashboard/clients/"]').first().click();
    const documents = page.getByRole('tab', { name: '2. Documents', exact: true });
    await documents.scrollIntoViewIfNeeded();
    await expect(documents).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'Next: assigned lots' }).click();
    await expect(page.getByRole('tab', { name: '3. Assigned lots', exact: true })).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: '/tmp/fdm-client-mobile.png', fullPage: true });
  });

  test('opens legacy client links in the active profile page', async ({ page }) => {
    await page.goto('/dashboard/clients');
    const href = await page.locator('main a[href^="/dashboard/clients/"]').first().getAttribute('href');
    expect(href).toBeTruthy();
    const clientPath = new URL(href!, 'http://localhost:3000').pathname;
    const clientId = clientPath.split('/').pop();
    await page.goto(`/dashboard/clients?client=${clientId}`);
    await page.waitForURL(url => url.pathname === clientPath);
    await expect(page.getByRole('tab', { name: '2. Documents', exact: true })).toBeVisible();
  });
});
