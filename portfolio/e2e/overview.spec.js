const { test, expect } = require('@playwright/test');
const { collectPageErrors, register, stubMarketApis, uniqueUser } = require('./helpers');

test.describe('overview', () => {
    test('renders the market feed and marks the Overview nav link as active', async ({ page }) => {
        const problems = collectPageErrors(page);
        await stubMarketApis(page);

        await page.goto('/');

        const rows = page.locator('.ticker-container');
        await expect(rows).toHaveCount(2);
        await expect(rows.first()).toContainText('BTC');
        await expect(rows.first()).toContainText('150.00');
        await expect(rows.nth(1)).toContainText('ETH');

        // layout.js keeps the nav underline in sync with the page title
        await expect(page.locator('.nav-overview')).toHaveClass(/active/);
        expect(problems).toEqual([]);
    });

    test('a signed in visitor gets the dashboard and account links', async ({ page }) => {
        const user = uniqueUser();
        await register(page, user);

        await expect(page.locator('.nav-dashboard')).toBeVisible();
        await page.click('#dropdownMenuOffset');
        await expect(page.locator('#profile')).toBeVisible();
        await expect(page.locator('a[href="/logout"]')).toBeVisible();
    });
});
