const { test, expect } = require('@playwright/test');
const { collectPageErrors, openDashboard, register, stubMarketApis, submitTransaction, uniqueUser } = require('./helpers');
const { CHART_METRICS, countRequests } = require('./chart-instrumentation');

async function openChartWithOneTransaction(page) {
    const user = uniqueUser();
    await register(page, user);
    await stubMarketApis(page);
    await submitTransaction(page, { quantity: '2', price: '100' });
    await openDashboard(page);
    await expect(page.locator('#chart canvas').first()).toBeVisible();
}

test.describe('dashboard chart', () => {
    test('the chart is created once and only updated incrementally', async ({ page }) => {
        const problems = collectPageErrors(page);
        await page.addInitScript(CHART_METRICS);

        await openChartWithOneTransaction(page);
        const afterLoad = await page.evaluate(() => window.__chartMetrics);

        // let a few 5s ticks pass
        await page.waitForTimeout(12_000);
        const afterTicks = await page.evaluate(() => window.__chartMetrics);
        console.log('LOAD  ', JSON.stringify(afterLoad));
        console.log('TICKS ', JSON.stringify(afterTicks));

        // one chart instance for the whole visit, never rebuilt
        expect(afterTicks.createChart).toBe(afterLoad.createChart);
        expect(afterTicks.createChart).toBe(1);
        // one full data set, then incremental updates
        expect(afterTicks.setData).toBe(1);
        expect(afterTicks.update).toBeGreaterThanOrEqual(2);
        // no repeated fitContent on every tick
        expect(afterTicks.fitContent).toBeLessThanOrEqual(2);
        expect(problems).toEqual([]);
    });

    test('the 5s tick refreshes prices with one batched request and no klines', async ({ page }) => {
        const problems = collectPageErrors(page);
        const requests = countRequests(page);

        await openChartWithOneTransaction(page);
        // a second asset: the price feed must still use one request per tick
        await submitTransaction(page, { symbolId: 'ethereum', quantity: '3', price: '1000' });
        await openDashboard(page);

        const baseline = { ...requests };

        await page.waitForTimeout(12_000);
        const delta = {
            txs: requests.txs - baseline.txs,
            klines: requests.klines - baseline.klines,
            prices: requests.prices - baseline.prices,
        };
        console.log('12s DELTA (2 assets)', JSON.stringify(delta));

        expect(delta.klines).toBe(0); // candles are only fetched for a new dataset
        expect(delta.prices).toBeLessThanOrEqual(delta.txs + 1); // one batched call per tick
        expect(delta.txs).toBeGreaterThanOrEqual(2);
        expect(problems).toEqual([]);
    });

    test('polling pauses while the tab is hidden', async ({ page }) => {
        const problems = collectPageErrors(page);
        const requests = countRequests(page);

        await openChartWithOneTransaction(page);
        await page.evaluate(() => {
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
            document.dispatchEvent(new Event('visibilitychange'));
        });
        const hidden = { ...requests };

        await page.waitForTimeout(11_000);

        expect(requests.txs).toBe(hidden.txs);
        expect(requests.prices).toBe(hidden.prices);
        expect(problems).toEqual([]);
    });
});
