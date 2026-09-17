const { test, expect } = require('@playwright/test');
const { collectPageErrors, logout, register, uniqueUser } = require('./helpers');

test.describe('authentication', () => {
    test('registering signs the new user in and lands on the overview', async ({ page }) => {
        const problems = collectPageErrors(page);
        const user = uniqueUser();

        await register(page, user);

        await expect(page.locator('.nav-dashboard')).toBeVisible();
        await expect(page.locator('.alert-success')).toContainText(
            `Successfully registered as ${user.username}`
        );
        expect(problems).toEqual([]);
    });

    test('a protected page bounces to the login form and returns to it afterwards', async ({ page }) => {
        const user = uniqueUser();
        await register(page, user);
        await logout(page);
        await expect(page.locator('.nav-login')).toBeVisible();

        await page.goto('/dashboard');
        await expect(page).toHaveURL(/\/login\?next=/);

        await page.fill('#id_username', user.username);
        await page.fill('#id_password', user.password);
        await page.click('input[type="submit"][value="Login"]');

        await expect(page).toHaveURL(/\/dashboard$/);
    });

    test('a failed login keeps the user on the form', async ({ page }) => {
        const user = uniqueUser();
        await register(page, user);
        await logout(page);

        await page.goto('/login');
        await page.fill('#id_username', user.username);
        await page.fill('#id_password', 'not-my-password');
        await page.click('input[type="submit"][value="Login"]');

        await expect(page.locator('.alert-danger, .invalid-feedback').first()).toBeVisible();
        await expect(page).toHaveURL(/\/login/);
    });
});
