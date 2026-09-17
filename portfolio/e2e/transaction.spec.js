const { test, expect } = require('@playwright/test');
const { collectPageErrors, openDashboard, register, stubMarketApis, submitTransaction, uniqueUser } = require('./helpers');

test.describe('transactions', () => {
    test('creates a portfolio from a typed name and links the transaction to it', async ({ page }) => {
        const problems = collectPageErrors(page);
        const user = uniqueUser();
        const portfolioName = `E2E${Date.now().toString(36).slice(-4)}`;

        await register(page, user);
        await stubMarketApis(page);
        await submitTransaction(page, { portfolio: portfolioName, quantity: '1', price: '100' });
        await openDashboard(page);

        await page.click('#portfolioName');
        const option = page.locator('.dropdown-menu .dropdown-item', { hasText: portfolioName });
        await expect(option).toBeVisible();
        await option.click();

        await expect(page.locator('#portfolioName')).toHaveText(portfolioName);
        await expect(page.locator('.ticker-container').first()).toContainText('BTC');
        expect(problems).toEqual([]);
    });

    test('selling more than the holdings shows an inline error and records nothing', async ({ page }) => {
        const problems = collectPageErrors(page);
        const user = uniqueUser();

        await register(page, user);
        await stubMarketApis(page);
        await submitTransaction(page, {
            type: 'S',
            quantity: '3',
            price: '100',
            expectRedirect: false,
        });

        await expect(page).toHaveURL(/\/transaction$/);
        await expect(page.locator('.invalid-feedback').first()).toContainText(
            'You do not have enough'
        );

        await page.goto('/transactionHistory');
        await expect(page.locator('.ticker-container')).toHaveCount(0);
        expect(problems).toEqual([]);
    });

    test('rejects an unknown symbol', async ({ page }) => {
        const user = uniqueUser();
        await register(page, user);
        await stubMarketApis(page);

        await submitTransaction(page, { symbolId: 'not-a-coin', expectRedirect: false });

        await expect(page).toHaveURL(/\/transaction$/);
        await expect(page.locator('.invalid-feedback').first()).toContainText('is not a valid symbol');
    });
});
