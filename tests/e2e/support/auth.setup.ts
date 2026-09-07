/**
 * Log in once as administrator and save the storage state for every other
 * project to reuse. Runs as its own Playwright project (see playwright.config.ts).
 */
import { expect, test as setup } from '@playwright/test';
import { adminPass, adminUser, STORAGE_STATE } from './env';

setup('authenticate as administrator', async ({ page, context }) => {
	await page.goto('/wp-login.php');
	await page.fill('#user_login', adminUser);
	await page.fill('#user_pass', adminPass);
	await page.click('#wp-submit');

	// WordPress may interpose the "confirm admin email" screen; either way the
	// logged-in cookie is what actually matters.
	await expect
		.poll(async () =>
			(await context.cookies()).some((c) =>
				c.name.startsWith('wordpress_logged_in'),
			),
		)
		.toBe(true);

	await context.storageState({ path: STORAGE_STATE });
});
