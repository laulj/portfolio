const { test, expect } = require('@playwright/test');
const { collectPageErrors, register, stubMarketApis, submitTransaction, uniqueUser } = require('./helpers');

test.describe('transaction history', () => {
    test('an empty history renders without an error banner', async ({ page }) => {
        // /txs answers 404 while nothing is recorded, which the page must treat as
        // "no transactions" rather than as a failure.
        const problems = collectPageErrors(page);
        const user = uniqueUser();

        await register(page, user);
        await page.goto('/transactionHistory');

        await expect(page.getByRole('heading', { name: 'Transaction History' })).toBeVisible();
        await expect(page.locator('.queryAlert')).toHaveCount(0);
        await expect(page.locator('.ticker-container')).toHaveCount(0);
        expect(problems).toEqual([]);
    });

    test('lists transactions with their portfolio and keeps it selected while editing', async ({ page }) => {
        const problems = collectPageErrors(page);
        const user = uniqueUser();

        await register(page, user);
        await stubMarketApis(page);
        await submitTransaction(page, { quantity: '2', price: '100', comment: 'first buy' });
        await page.goto('/transactionHistory');

        const row = page.locator('.ticker-container').first();
        await expect(row).toContainText('B');
        // the stored ticker comes from the Coingecko feed, which reports it upper case
        await expect(row).toContainText('BTC');
        await expect(row).toContainText('100.00');
        await expect(row).toContainText('first buy');
        await expect(row).toContainText('Default');
        await expect(page.locator('#portfolioFilter').locator('option')).toHaveText(['Default']);

        await row.locator('button[data-bs-target^="#editModal"]').click();
        const modal = page.locator('.modal.show');
        await expect(modal).toBeVisible();

        // The portfolios of the transaction must be pre-selected, otherwise the
        // PUT that follows would drop them.
        await expect(modal.locator('select[id^="id_portfolio"] option:checked')).toHaveText(['Default']);

        await modal.locator('input[id^="id_bought_at"]').fill('123.45');
        await modal.locator('input[id^="id_quantity"]').fill('1');
        await modal.locator('textarea[id^="id_comment"]').fill('updated note');
        await modal.locator('button', { hasText: 'Submit' }).click();

        await expect(modal).toBeHidden();
        // the table is refetched after the PUT, so the new values must show up
        await expect(page.locator('.ticker-container').first()).toContainText('123.45');
        await expect(page.locator('.ticker-container').first()).toContainText('updated note');
        expect(problems).toEqual([]);
    });

    test('removes a transaction through the delete modal', async ({ page }) => {
        const problems = collectPageErrors(page);
        const user = uniqueUser();

        await register(page, user);
        await stubMarketApis(page);
        await submitTransaction(page, { quantity: '1', price: '100' });
        await page.goto('/transactionHistory');

        const row = page.locator('.ticker-container').first();
        await expect(row).toBeVisible();
        await row.locator('button[data-bs-target^="#deleteModal"]').click();

        const modal = page.locator('.modal.show');
        await expect(modal).toBeVisible();
        await modal.locator('button', { hasText: 'Delete' }).click();

        await expect(page.locator('.ticker-container')).toHaveCount(0);
        await expect(page.locator('.queryAlert')).toHaveCount(0);
        expect(problems).toEqual([]);
    });
});
