const { test, expect } = require('@playwright/test');
const { collectPageErrors, login, logout, register, uniqueUser } = require('./helpers');

// 1x1 red PNG, enough for the ImageField validation
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
    'base64'
);

test.describe('profile', () => {
    test('updates the username and the email address', async ({ page }) => {
        const problems = collectPageErrors(page);
        const user = uniqueUser();
        await register(page, user);
        await page.goto('/userProfile');

        const renamed = `${user.username}_x`;
        await page.fill('#id_username', renamed);
        await page.fill('#id_email', `renamed_${user.email}`);
        await page.click('input[type="submit"][value="Update"]');

        await expect(page.locator('.alert-success')).toContainText('User profile updated!');
        await expect(page.locator('p.display-5')).toContainText(renamed);
        expect(problems).toEqual([]);
    });

    test('rejects a rename that only differs in case from another account', async ({ page }) => {
        // Authentication matches usernames case-insensitively, so a case-only
        // duplicate would make the next login ambiguous (HTTP 500).
        const problems = collectPageErrors(page);
        const existing = uniqueUser();
        await register(page, existing);
        await logout(page);

        const other = uniqueUser();
        await register(page, other);
        await page.goto('/userProfile');

        await page.fill('#id_username', existing.username.toUpperCase());
        await page.click('input[type="submit"][value="Update"]');

        await expect(page).toHaveURL(/\/userProfile$/);
        await expect(page.locator('.invalid-feedback').first()).toContainText(
            'A user with that username already exists.'
        );
        // the signed in account itself is untouched
        await expect(page.locator('p.display-5')).toContainText(other.username);
        expect(problems).toEqual([]);
    });

    test('changes the password, keeps the session and allows a fresh login', async ({ page }) => {
        const problems = collectPageErrors(page);
        const user = uniqueUser();
        const newPassword = 'N3wPassw0rd!x';
        await register(page, user);
        await page.goto('/userProfile');

        await page.click('button[data-bs-target="#collapseChangePasswordForm"]');
        await page.fill('#id_old_password', user.password);
        await page.fill('#id_new_password1', newPassword);
        await page.fill('#id_new_password2', newPassword);
        await page.click('input[type="submit"][value="Change"]');

        await expect(page.locator('.alert-success')).toContainText('Password changed!');
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/\/dashboard$/);

        await logout(page);
        await login(page, { ...user, password: newPassword });
        await expect(page).toHaveURL(/\/$/);
        expect(problems).toEqual([]);
    });

    test('uploads a new profile image', async ({ page }) => {
        const user = uniqueUser();
        await register(page, user);
        await page.goto('/userProfile');

        const avatar = page.locator('img.profileImage');
        const before = await avatar.getAttribute('src');

        await page.setInputFiles('#id_profile_image', {
            name: 'avatar.png',
            mimeType: 'image/png',
            buffer: PNG,
        });
        await page.click('input[type="submit"][value="Update"]');

        await expect(page.locator('.alert-success')).toContainText('User profile updated!');
        const after = await page.locator('img.profileImage').getAttribute('src');
        expect(after).not.toBe(before);
        expect(after).toContain('profileImg/user_');
    });
});
