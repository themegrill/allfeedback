/**
 * Log in once as administrator and save the storage state for every other
 * project to reuse. Runs as its own Playwright project (see playwright.config.ts).
 */
import { expect, test as setup } from '@playwright/test';
import { ADMIN_PAGE, adminPass, adminUser, REST, STORAGE_STATE } from './env';

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

	// Seed the one piece of state a fresh install does not have: a completed
	// setup wizard.
	//
	// While `allfeedback_wizard_status` is `not_started`, the first admin page
	// load is redirected to `#/wizard` and the request exits
	// (AdminServiceProvider::maybeRedirectToWizard). That redirect flips the
	// status to `initiated`, so it fires exactly once — meaning on a fresh site
	// it lands on whichever spec happens to reach wp-admin first, and the suite
	// breaks somewhere different each run. Completing it here gives every spec
	// the same starting point.
	await page.goto(ADMIN_PAGE, { waitUntil: 'domcontentloaded' });
	const nonce = await page.evaluate(
		() =>
			(window as unknown as { __ALLFB_ADMIN__?: { nonce?: string } })
				.__ALLFB_ADMIN__?.nonce,
	);

	if (nonce) {
		const status = await page.request.get(`${REST}/wizard`, {
			headers: { 'X-WP-Nonce': nonce },
		});
		const completed =
			status.ok() && (await status.json())?.data?.status === 'completed';

		if (!completed) {
			await page.request.post(`${REST}/wizard/complete`, {
				headers: { 'X-WP-Nonce': nonce, 'Content-Type': 'application/json' },
				data: JSON.stringify({}),
			});
		}
	}

	await context.storageState({ path: STORAGE_STATE });
});
