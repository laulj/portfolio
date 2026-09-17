const { test, expect } = require('@playwright/test');
const {
    collectPageErrors,
    openDashboard,
    register,
    stubMarketApis,
    submitTransaction,
    uniqueUser,
} = require('./helpers');

test.describe('dashboard', () => {
    test('a brand new portfolio shows the empty state instead of an error', async ({ page }) => {
        // /txs_data answers 404 while nothing is recorded, which the dashboard
        // must treat as "empty" rather than as a failure.
        const problems = collectPageErrors(page);
        const user = uniqueUser();

        await register(page, user);
        await stubMarketApis(page);
        await openDashboard(page);

        await expect(page.getByText('Please add some transactions.')).toBeVisible();
        await expect(page.locator('.spinner-border')).toHaveCount(0);
        await expect(page.locator('.portfolio_total_pnl').first()).toContainText('Total PNL: 0%');
        await expect(page.locator('.portfolio_total_pnl').nth(1)).toContainText('Networth: $ 0.00');
        expect(problems).toEqual([]);
    });

    test('the networth chart and the asset table render for a portfolio with transactions', async ({ page }) => {
        const problems = collectPageErrors(page);
        const user = uniqueUser();

        await register(page, user);
        await stubMarketApis(page);
        await submitTransaction(page, { quantity: '2', price: '100' });
        await openDashboard(page);

        const row = page.locator('.ticker-container').first();
        await expect(row).toContainText('BTC');
        await expect(row).toContainText('300.00'); // 2 × 150 (stubbed price)
        await expect(row).toContainText('50.00%'); // (150 - 100) / 100
        await expect(page.locator('.portfolio_total_pnl').first()).toContainText('50.00%');

        // Lightweight Charts draws into one canvas per pane/scale
        await expect(page.locator('#chart canvas').first()).toBeVisible();
        expect(problems).toEqual([]);
    });

    test('a position that was fully sold disappears instead of rendering NaN', async ({ page }) => {
        const problems = collectPageErrors(page);
        const user = uniqueUser();

        await register(page, user);
        await stubMarketApis(page);
        await submitTransaction(page, { quantity: '2', price: '100' });
        await submitTransaction(page, { type: 'S', quantity: '2', price: '120' });
        await openDashboard(page);

        await expect(page.locator('.ticker-container')).toHaveCount(0);
        const totals = (await page.locator('.portfolio_total_pnl').allInnerTexts()).join(' ');
        expect(totals).not.toContain('NaN');
        expect(totals).not.toContain('Infinity');
        expect(problems).toEqual([]);
    });
});
