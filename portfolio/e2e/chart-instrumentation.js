/**
 * Instrumentation for the chart: counts how often the chart and its series are
 * created/updated, whichever of the Lightweight Charts APIs the bundle uses.
 *
 * The UMD build assigns an empty object to `window.LightweightCharts` and fills
 * it afterwards, so the global is exposed through a Proxy that intercepts
 * `createChart` at call time instead of at assignment time.
 */
const CHART_METRICS = () => {
    window.__chartMetrics = { createChart: 0, series: 0, setData: 0, update: 0, fitContent: 0 };
    window.__chartMetricsCache = {};

    const wrapSeries = (series) => {
        ['setData', 'update'].forEach((method) => {
            if (typeof series[method] !== 'function') {
                return;
            }
            const original = series[method].bind(series);
            series[method] = (...args) => {
                window.__chartMetrics[method] += 1;
                return original(...args);
            };
        });
        return series;
    };

    const instrumentCreateChart = (original) => {
        if (window.__chartMetricsCache.createChart) {
            return window.__chartMetricsCache.createChart;
        }
        const wrapper = (...args) => {
            window.__chartMetrics.createChart += 1;
            const chart = original(...args);

            ['addAreaSeries', 'addLineSeries', 'addSeries'].forEach((method) => {
                if (typeof chart[method] !== 'function') {
                    return;
                }
                const addSeries = chart[method].bind(chart);
                chart[method] = (...seriesArgs) => {
                    window.__chartMetrics.series += 1;
                    return wrapSeries(addSeries(...seriesArgs));
                };
            });

            const timeScale = chart.timeScale();
            const fitContent = timeScale.fitContent.bind(timeScale);
            timeScale.fitContent = (...args2) => {
                window.__chartMetrics.fitContent += 1;
                return fitContent(...args2);
            };

            return chart;
        };
        window.__chartMetricsCache.createChart = wrapper;
        return wrapper;
    };

    let library = null;
    let facade = null;

    /**
     * The bundle exposes its exports as non-configurable getters, so the global
     * cannot be proxied (a Proxy must return the exact value for those). A plain
     * copy of the exports works because the bundle only ever reads from it.
     */
    const buildFacade = (source) => {
        const copy = {};
        Reflect.ownKeys(source).forEach((key) => {
            try {
                copy[key] = source[key];
            } catch (error) {
                // ignore getters that throw before the library is ready
            }
        });
        if (typeof copy.createChart === 'function') {
            copy.createChart = instrumentCreateChart(copy.createChart);
        }
        return copy;
    };

    Object.defineProperty(window, 'LightweightCharts', {
        configurable: true,
        get() {
            if (!library) {
                return library;
            }
            if (!facade) {
                facade = buildFacade(library);
            }
            return facade;
        },
        set(value) {
            library = value;
            facade = null;
        },
    });
};

/** Count the requests the dashboard makes, split by feed. */
function countRequests(page) {
    const counters = { txs: 0, klines: 0, prices: 0 };
    page.on('request', (request) => {
        const url = request.url();
        if (url.includes('/txs_data')) {
            counters.txs += 1;
        } else if (url.includes('/api.binance.com/api/v3/uiKlines')) {
            counters.klines += 1;
        } else if (url.includes('/api.binance.com/api/v3/')) {
            counters.prices += 1;
        }
    });
    return counters;
}

module.exports = { CHART_METRICS, countRequests };
