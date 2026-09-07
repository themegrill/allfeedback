/**
 * Capability boundaries for users who ARE logged in but are not administrators.
 *
 * The sibling spec proves the anonymous boundary, but a 401 there is ambiguous:
 * a missing nonce looks identical to a missing capability. These specs remove
 * that ambiguity by authenticating each fixture user with an application
 * password, which carries their real capabilities and needs no nonce. A 401
 * here therefore means "your role is not allowed", full stop.
 *
 * The plugin registers no roles of its own — RoleManager's methods are
 * deliberately empty — so every admin surface is plain `manage_options`, i.e.
 * administrators only.
 */
import { expect, test } from '@playwright/test';
import { getNonce } from '../../support/api';
import { REST } from '../../support/env';
import { Wp, type RoleUser, type WpRole } from '../../support/wp';

const ADMIN_ONLY = [
	'surveys',
	'settings',
	'responses',
	'analytics/overview',
	'logs',
	'bootstrap',
];

const ROLES: WpRole[] = ['editor', 'author', 'contributor', 'subscriber'];

test.describe('role boundaries', () => {
	let wp: Wp;
	// Kept open for the whole file: `Wp` borrows this page's request context, so
	// closing it early would break the afterAll cleanup.
	let adminPage: Awaited<
		ReturnType<import('@playwright/test').Browser['newPage']>
	>;
	const users: RoleUser[] = [];

	test.beforeAll(async ({ browser }) => {
		adminPage = await browser.newPage({
			storageState: 'test-results/.auth/admin.json',
		});
		const nonce = await getNonce(adminPage);
		wp = await Wp.create(adminPage, nonce);

		for (const role of ROLES) {
			const user = await wp.createRoleUser(role);
			if (user) users.push({ ...user, username: `${role}:${user.username}` });
		}
	});

	test.afterAll(async () => {
		for (const user of users) await wp.deleteUser(user.id);
		await adminPage?.close();
	});

	/**
	 * @area permissions
	 * @tier fresh
	 * @why  Without application passwords the role specs cannot authenticate as a non-admin, and a skip is honest where a pass would be a lie.
	 */
	test('application passwords are available, or these specs cannot prove anything @fresh @permissions', async () => {
		test.skip(
			users.length === 0,
			'application passwords are unavailable on this site (needs HTTPS or a local/development environment type)',
		);
		expect(users.length).toBe(ROLES.length);
	});

	for (const role of ROLES) {
		/**
		 * @area permissions
		 * @tier fresh
		 * @why  Authenticated as a real non-admin user, so a 401 here means the capability check works — not merely that a nonce was missing.
		 */
		test(`a ${role} is refused every admin route @fresh @permissions`, async ({
			request,
		}) => {
			const user = users.find((u) => u.username.startsWith(`${role}:`));
			test.skip(!user, 'fixture user unavailable');

			for (const endpoint of ADMIN_ONLY) {
				const res = await request.get(`${REST}/${endpoint}`, {
					headers: { Authorization: `Basic ${user!.basic}` },
				});
				expect(res.status(), `${role} must not read /${endpoint}`).toBe(401);
				expect((await res.json()).code).toBe('rest_forbidden');
			}
		});
	}

	/**
	 * @area permissions
	 * @tier fresh
	 * @why  Editors can publish site content, which makes them the most plausible role to be over-granted by accident.
	 */
	test('an editor cannot create a survey @fresh @permissions', async ({
		request,
	}) => {
		const user = users.find((u) => u.username.startsWith('editor:'));
		test.skip(!user, 'fixture user unavailable');

		const res = await request.post(`${REST}/surveys`, {
			headers: {
				Authorization: `Basic ${user!.basic}`,
				'Content-Type': 'application/json',
			},
			data: JSON.stringify({ title: 'TGQA editor should not manage forms' }),
		});

		expect(res.status()).toBe(401);
	});

	/**
	 * @area permissions
	 * @tier fresh
	 * @why  Settings include privacy controls and the uninstall behaviour, so write access below administrator would be a genuine escalation.
	 */
	test('an editor cannot write settings @fresh @permissions', async ({
		request,
	}) => {
		const user = users.find((u) => u.username.startsWith('editor:'));
		test.skip(!user, 'fixture user unavailable');

		const res = await request.fetch(`${REST}/settings`, {
			method: 'PUT',
			headers: {
				Authorization: `Basic ${user!.basic}`,
				'Content-Type': 'application/json',
			},
			data: JSON.stringify({ general: { widget: { position: 'side-tab' } } }),
		});

		expect(res.status()).toBe(401);
	});

	/**
	 * @area permissions
	 * @tier fresh
	 * @why  Tests the page rather than the API, which is the boundary a real low-privilege user actually walks into.
	 */
	test('a subscriber logged into wp-admin cannot reach the AllFeedback screen @fresh @permissions', async ({
		browser,
	}) => {
		const user = users.find((u) => u.username.startsWith('subscriber:'));
		test.skip(!user, 'fixture user unavailable');

		// Log in as the subscriber for real. A clean context that merely *isn't*
		// the admin proves nothing here — WordPress would bounce it to the login
		// form and the assertion would pass for the wrong reason.
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		await page.goto('/wp-login.php');
		await page.fill('#user_login', user!.username.split(':')[1]);
		await page.fill('#user_pass', user!.password);
		await page.click('#wp-submit');
		await expect
			.poll(async () =>
				(await ctx.cookies()).some((c) =>
					c.name.startsWith('wordpress_logged_in'),
				),
			)
			.toBe(true);

		await page.goto('/wp-admin/admin.php?page=allfeedback');

		// WordPress refuses the page outright; the SPA never mounts.
		await expect(page.locator('#ALLFB-Admin-Root')).toHaveCount(0);
		await expect(
			page.getByText(
				/not allowed to access this page|Sorry, you are not allowed/i,
			),
		).toBeVisible();

		await ctx.close();
	});
});
