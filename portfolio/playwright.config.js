// @ts-check
const fs = require('fs');
const path = require('path');
const { defineConfig } = require('@playwright/test');

const PORT = Number(process.env.E2E_PORT || 8011);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Django needs an interpreter that has the project requirements installed.
 * E2E_PYTHON wins, otherwise the usual virtualenv locations are probed.
 */
function pythonExecutable() {
    if (process.env.E2E_PYTHON) {
        return process.env.E2E_PYTHON;
    }
    const candidates = [
        path.join(__dirname, '.venv', 'bin', 'python'),
        path.join(__dirname, 'venv', 'bin', 'python'),
        path.join(__dirname, '..', 'venv', 'bin', 'python'),
        // the virtualenv the README's development setup creates
        path.join(__dirname, '..', 'portfolio_venv', 'bin', 'python'),
        '/tmp/portfolio-venv/bin/python',
    ];
    return candidates.find((candidate) => fs.existsSync(candidate)) || 'python3';
}

module.exports = defineConfig({
    testDir: './e2e',
    // All specs share the single SQLite database, so run them one at a time.
    fullyParallel: false,
    workers: 1,
    timeout: 90_000,
    expect: { timeout: 10_000 },
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
    // Fail fast on a wrong selector instead of waiting for the whole test timeout.
    use: {
        baseURL: BASE_URL,
        actionTimeout: 15_000,
        // Drive the Chrome that is already installed on the machine, so no
        // `playwright install` (browser download) is needed.
        channel: process.env.E2E_BROWSER || 'chrome',
        headless: process.env.E2E_HEADED !== '1',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    webServer: {
        command: `${pythonExecutable()} manage.py runserver 127.0.0.1:${PORT} --noreload`,
        cwd: __dirname,
        url: `${BASE_URL}/login`,
        reuseExistingServer: true,
        timeout: 120_000,
        // The dev server logs every request; traces are the debugging tool here.
        stdout: 'ignore',
        stderr: 'ignore',
    },
});
