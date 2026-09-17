/**
 * Shared helpers for the browser tests.
 *
 * The market feeds are stubbed with `page.route` so that prices, charts and
 * assertions are deterministic (the free Coingecko tier is rate limited and
 * Binance blocks whole regions). Everything else is the real application,
 * including the Django server.
 */

const PRICE = 150;

const COINS = [
    {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        image: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
        market_cap_rank: 1,
        market_cap: 1200000000000,
        current_price: PRICE,
        total_volume: 30000000000,
        price_change_percentage_24h: 1.5,
        price_change_percentage_7d_in_currency: 2.5,
        last_updated: '2024-01-01T00:00:00.000Z',
    },
    {
        id: 'ethereum',
        symbol: 'eth',
        name: 'Ethereum',
        image: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
        market_cap_rank: 2,
        market_cap: 400000000000,
        current_price: 2000,
        total_volume: 15000000000,
        price_change_percentage_24h: -0.5,
        price_change_percentage_7d_in_currency: 1.1,
        last_updated: '2024-01-01T00:00:00.000Z',
    },
];

/** Deterministic 4h candles (Binance klines shape: [openTime, open, ...]). */
function klines(count = 80) {
    const step = 4 * 60 * 60 * 1000;
    const now = Date.now();
    return Array.from({ length: count }, (_, index) => {
        const openTime = now - (count - index) * step;
        const open = String(PRICE + index);
        return [
            openTime,
            open,
            String(Number(open) + 5),
            String(Number(open) - 5),
            String(Number(open) + 1),
            '10',
            openTime + step - 1,
            '1500',
            25,
            '6',
            '750',
            '0',
        ];
    });
}

/** Replace every market feed the bundles ask for with fixed data. */
async function stubMarketApis(page, coins = COINS) {
    await page.route('**/api.coingecko.com/api/v3/coins/markets**', (route) => {
        const requested = (new URL(route.request().url()).searchParams.get('ids') || '')
            .split(',')
            .filter(Boolean);
        const body = requested.length ? coins.filter((coin) => requested.includes(coin.id)) : coins;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.route('**/api.binance.com/api/v3/uiKlines**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(klines()) })
    );
    await page.route('**/api.binance.com/api/v3/avgPrice**', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ mins: 5, price: String(PRICE), closeTime: Date.now() }),
        })
    );
    // batched price feed: /ticker/price?symbols=["BTCUSDT","ETHUSDT"]
    await page.route('**/api.binance.com/api/v3/ticker/price**', (route) => {
        const symbols = (new URL(route.request().url()).searchParams.get('symbols') || '')
            .replace(/[[\]"]/g, '')
            .split(',')
            .filter(Boolean);
        const wanted = symbols.length ? symbols : ['BTCUSDT', 'ETHUSDT'];
        const body = wanted.map((symbol) => ({
            symbol,
            price: String(symbol.startsWith('BTC') ? PRICE : 2000),
        }));
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(body.length === 1 ? body[0] : body),
        });
    });
}

/**
 * The collection endpoints answer 404 while nothing is recorded (/txs and
 * /txs_data/<id>), which both bundles translate into an empty state. Tests that
 * legitimately hit that contract add this to `collectPageErrors(..., { allow })`
 * so the console assertion stays meaningful everywhere else.
 */
const EMPTY_COLLECTION_404 = [
    /http 404: .*\/txs$/,
    /http 404: .*\/txs_data\/\d+$/,
    /Failed to load resource: the server responded with a status of 404/,
];

/** Collect browser problems so a test can assert the console stayed clean. */
function collectPageErrors(page, { allow = [] } = {}) {
    const problems = [];
    // The empty-collection 404s are part of the API contract (see above), every
    // other unexpected response, console error or exception is reported.
    const ignored = [...EMPTY_COLLECTION_404, ...allow];
    const push = (message) => {
        if (!ignored.some((pattern) => pattern.test(message))) {
            problems.push(message);
        }
    };
    const isLocal = (url) => url.startsWith('http://127.0.0.1');

    page.on('pageerror', (error) => push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
        if (message.type() === 'error') {
            push(`console.error: ${message.text()}`);
        }
    });
    page.on('requestfailed', (request) => {
        const errorText = request.failure() ? request.failure().errorText : '';
        // Requests cancelled by a navigation are reported as ERR_ABORTED (or
        // ERR_FAILED) and are not application failures.
        if (errorText.includes('ERR_ABORTED') || errorText.includes('ERR_FAILED')) {
            return;
        }
        push(`requestfailed: ${request.method()} ${request.url()} (${errorText})`);
    });
    page.on('response', (response) => {
        const status = response.status();
        if (status >= 500 || (status >= 400 && isLocal(response.url()))) {
            push(`http ${status}: ${response.url()}`);
        }
    });

    return problems;
}

function uniqueUser(prefix = 'e2e') {
    const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    return {
        username: `${prefix}_${stamp}`,
        email: `${prefix}_${stamp}@example.com`,
        password: 'Str0ngPass!23',
    };
}

const SUBMIT = (value) => `input[type="submit"][value="${value}"]`;

/**
 * Register a new account. The market feeds are stubbed before navigating because
 * the page it lands on fetches them: they are external, rate limited and
 * irrelevant to these flows. Pass `{ stubFeeds: false }` to keep them real.
 */
async function register(page, user, { stubFeeds = true } = {}) {
    if (stubFeeds) {
        await stubMarketApis(page);
    }
    await page.goto('/register');
    await page.fill('#id_username', user.username);
    await page.fill('#id_email', user.email);
    await page.fill('#id_password1', user.password);
    await page.fill('#id_password2', user.password);
    await page.click(SUBMIT('Register'));
    await page.waitForURL((url) => url.pathname === '/');
}

async function login(page, user, { next = null, stubFeeds = true } = {}) {
    if (stubFeeds) {
        await stubMarketApis(page);
    }
    await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
    await page.fill('#id_username', user.username);
    await page.fill('#id_password', user.password);
    await page.click(SUBMIT('Login'));
}

async function logout(page) {
    await page.click('#dropdownMenuOffset');
    await page.click('a[href="/logout"]');
}

/** Open the dashboard and wait until the portfolio list has been applied. */
async function openDashboard(page) {
    await page.goto('/dashboard');
    await page.waitForFunction(
        () => document.getElementById('portfolioName').textContent.trim() !== 'Portfolio',
        null,
        { timeout: 20_000 }
    );
}

const TX_FIELD = {
    type: '#id_type',
    symbolId: '#id_symbol_id',
    price: '#id_bought_at',
    quantity: '#id_quantity',
    comment: '#id_comment',
    date: '#id_created_on',
};

/** Fill and submit the real /transaction form (select2 included). */
async function submitTransaction(
    page,
    {
        type = 'B',
        symbolId = 'btc',
        price = '100',
        quantity = '1',
        portfolio = 'Default',
        comment = 'e2e',
        date = null,
        expectRedirect = true,
    } = {}
) {
    await page.goto('/transaction');
    await page.selectOption(TX_FIELD.type, type);
    await page.fill(TX_FIELD.symbolId, symbolId);
    await page.fill(TX_FIELD.price, price);
    await page.fill(TX_FIELD.quantity, quantity);
    await page.fill(TX_FIELD.comment, comment);
    if (date) {
        await page.fill(TX_FIELD.date, date);
    }

    // select2 with `tags: true`: typing an existing name selects it, a new name
    // is created when the form is submitted.
    await page.click('.select2-selection');
    await page.fill('.select2-search__field', portfolio);
    await page.keyboard.press('Enter');
    await page.waitForSelector('.select2-selection__choice');

    await page.click(SUBMIT('Submit'));
    if (expectRedirect) {
        await page.waitForURL((url) => url.pathname === '/dashboard');
    }
}

module.exports = {
    COINS,
    EMPTY_COLLECTION_404,
    PRICE,
    TX_FIELD,
    collectPageErrors,
    klines,
    login,
    logout,
    openDashboard,
    register,
    stubMarketApis,
    submitTransaction,
    uniqueUser,
};
