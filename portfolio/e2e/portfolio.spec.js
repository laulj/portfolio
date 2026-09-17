const { test, expect } = require('@playwright/test');
const { collectPageErrors, openDashboard, register, stubMarketApis, submitTransaction, uniqueUser } = require('./helpers');

async function deleteActivePortfolio(page) {
    await page.click('button[data-bs-target^="#deletePortfolioModal"]');
    const modal = page.locator('.modal.show');
    await expect(modal).toBeVisible();
    await modal.locator('.modal-footer button.btn-danger').click();
}

test.describe('portfolios', () => {
    test('deleting the only portfolio reports the error without breaking the page', async ({ page }) => {
        // The API deliberately answers 404 for "cannot delete the only portfolio".
        const problems = collectPageErrors(page, { allow: [/http 404: .*\/portfolio\/\d+$/] });
        const user = uniqueUser();

        await register(page, user);
        await stubMarketApis(page);
        await openDashboard(page);

        await deleteActivePortfolio(page);

        await expect(page.locator('.queryAlert')).toContainText("Couldn't delete the only portfolio.");
        await expect(page.locator('#portfolioName')).toHaveText('Default');
        expect(problems).toEqual([]);
    });

    test('deleting the active portfolio switches to the remaining one', async ({ page }) => {
        const problems = collectPageErrors(page);
        const user = uniqueUser();
        const second = `Second${Date.now().toString(36).slice(-3)}`;

        await register(page, user);
        await stubMarketApis(page);
        await submitTransaction(page, { portfolio: second, quantity: '1', price: '100' });
        await openDashboard(page);

        await expect(page.locator('#portfolioName')).toHaveText('Default');
        await deleteActivePortfolio(page);

        await expect(page.locator('#portfolioName')).toHaveText(second);
        await expect(page.locator('.queryAlert')).toHaveCount(0);
        await expect(page.locator('.ticker-container').first()).toContainText('BTC');
        expect(problems).toEqual([]);
    });
});
