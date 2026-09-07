/**
 * The admin shell: one page, seven hash routes, one React mount point.
 *
 * Every AllFeedback admin screen is a hash route into a single WordPress page
 * (`admin.php?page=allfeedback`), so these assertions guard the registration in
 * AdminServiceProvider::registerMenus() rather than seven separate screens.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_PAGE } from '../../support/env';

test.describe('admin surfaces', () => {
	/**
	 * @area getting-started
	 * @tier fresh
	 * @why  Every admin screen is a hash route into one page, so a lost menu entry is the only way a whole screen becomes unreachable.
	 */
	test('the sidebar registers every AllFeedback route @fresh @getting-started', async ({
		page,
	}) => {
		await page.goto(ADMIN_PAGE, { waitUntil: 'domcontentloaded' });

		const links = await page
			.locator('#adminmenu a[href*="page=allfeedback"]')
			.evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));

		// The top-level entry's own submenu item is deliberately removed
		// (AdminServiceProvider::registerMenus, remove_submenu_page), so the
		// parent link points at the first real route instead.
		for (const route of [
			'#/analytics',
			'#/forms',
			'#/responses',
			'#/settings',
			'#/tools',
			'#/about',
		]) {
			expect(links.some((h) => h.endsWith(`page=allfeedback${route}`))).toBe(
				true,
			);
		}
	});

	/**
	 * @area getting-started
	 * @tier fresh
	 * @why  Without #ALLFB-Admin-Root the React app has nowhere to mount and the page renders blank with no error.
	 */
	test('the SPA mount point is present and the bare page redirects to analytics @fresh @getting-started', async ({
		page,
	}) => {
		await page.goto(ADMIN_PAGE, { waitUntil: 'domcontentloaded' });

		await expect(page.locator('#ALLFB-Admin-Root')).toBeAttached();
		await expect.poll(() => page.url()).toContain('#/analytics');
	});

	/**
	 * @area getting-started
	 * @tier fresh
	 * @why  Every admin API call depends on this nonce; if it stops being localized the entire SPA 401s while looking like a permission bug.
	 */
	test('the bootstrap object is localized with a REST nonce @fresh @getting-started', async ({
		page,
	}) => {
		await page.goto(ADMIN_PAGE, { waitUntil: 'domcontentloaded' });

		const boot = await page.evaluate(
			() =>
				(
					window as unknown as {
						__ALLFB_ADMIN__?: {
							nonce?: string;
							version?: string;
							isAdmin?: unknown;
						};
					}
				).__ALLFB_ADMIN__,
		);

		expect(boot, '__ALLFB_ADMIN__ must exist on the admin page').toBeTruthy();
		expect(
			boot?.nonce,
			'a wp_rest nonce is required for every admin REST call',
		).toBeTruthy();
		expect(boot?.version).toBeTruthy();
	});

	test.describe('SPA routes settle without console errors', () => {
		for (const [route, heading] of [
			['#/analytics', 'Responses over time'],
			['#/settings', 'General'],
			['#/tools', 'System Info'],
		] as const) {
			/**
			 * @area getting-started
			 * @tier fresh
			 * @why  A smoke check that each route mounts and paints its heading without throwing — the cheapest guard against a routing or build regression.
			 */
			test(`${route} renders @fresh @getting-started`, async ({ page }) => {
				const errors: string[] = [];
				page.on('pageerror', (e) => errors.push(String(e)));
				page.on('console', (m) => {
					if (m.type() === 'error') errors.push(m.text());
				});

				await page.goto(`${ADMIN_PAGE}${route}`, {
					waitUntil: 'domcontentloaded',
				});

				await expect(
					page.getByText(heading, { exact: false }).first(),
				).toBeVisible();
				expect(errors, `console errors on ${route}`).toEqual([]);
			});
		}
	});
});
