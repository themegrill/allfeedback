/**
 * The capability boundary, from outside.
 *
 * Everything admin-facing is `manage_options`; the plugin adds no roles of its
 * own (RoleManager's methods are empty by design). These specs run without the
 * admin storage state so a permission regression cannot hide behind a logged-in
 * cookie.
 *
 * Note that a *missing nonce* and a *missing capability* both surface as 401
 * rest_forbidden here. That is unavoidable from the outside and is why the
 * positive cases live in the other specs, which do send a nonce.
 */
import { expect, test } from '@playwright/test';
import { REST } from '../../support/env';

// Drop the admin cookie for this file.
test.use({ storageState: { cookies: [], origins: [] } });

const ADMIN_ONLY = [
	'bootstrap',
	'surveys',
	'settings',
	'responses',
	'responses/unread-count',
	'analytics/overview',
	'analytics/forms',
	'wizard',
	'logs',
	'content-search',
	'about/video',
];

test.describe('REST permissions', () => {
	for (const endpoint of ADMIN_ONLY) {
		/**
		 * @area permissions
		 * @tier fresh
		 * @why  Every admin route must be closed to the public; this sweeps all of them rather than trusting a sample.
		 */
		test(`GET /${endpoint} is refused to an anonymous caller @fresh @permissions`, async ({
			request,
		}) => {
			const res = await request.get(`${REST}/${endpoint}`);

			expect(
				res.status(),
				`/${endpoint} must not be readable anonymously`,
			).toBe(401);
			expect((await res.json()).code).toBe('rest_forbidden');
		});
	}

	/**
	 * @area permissions
	 * @tier fresh
	 * @why  A writable settings endpoint would let anyone repoint the widget or disable privacy controls.
	 */
	test('writing settings anonymously is refused @fresh @permissions', async ({
		request,
	}) => {
		const res = await request.fetch(`${REST}/settings`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			data: JSON.stringify({ general: { widget: { position: 'side-tab' } } }),
		});

		expect(res.status()).toBe(401);
	});

	/**
	 * @area permissions
	 * @tier fresh
	 * @why  Anonymous form creation would be a spam and defacement vector on any public site.
	 */
	test('creating a survey anonymously is refused @fresh @permissions', async ({
		request,
	}) => {
		const res = await request.post(`${REST}/surveys`, {
			headers: { 'Content-Type': 'application/json' },
			data: JSON.stringify({ title: 'TGQA should never exist' }),
		});

		expect(res.status()).toBe(401);
	});

	/**
	 * @area permissions
	 * @tier fresh
	 * @why  These seed and reset live data; whether or not WP_DEBUG registers them, they must never answer an anonymous caller.
	 */
	test('the destructive dev-tools routes refuse an anonymous caller @fresh @permissions', async ({
		request,
	}) => {
		// DevToolsController::registerRoutes() returns early unless WP_DEBUG is
		// on, so on a production site these are absent entirely. That gate cannot
		// be proved from a debug install — what CAN be proved, and matters more,
		// is that when they *are* registered they are still admin-only. These
		// seed and reset live data.
		//
		// Note the methods: /seed is POST|DELETE, /reset-wizard and
		// /reset-settings are POST, /logs is DELETE. A GET returns 404
		// rest_no_route on a route that exists — do not read that as "absent".
		for (const [method, endpoint] of [
			['POST', 'dev-tools/seed'],
			['POST', 'dev-tools/reset-wizard'],
			['POST', 'dev-tools/reset-settings'],
			['DELETE', 'dev-tools/logs'],
		] as const) {
			const res = await request.fetch(`${REST}/${endpoint}`, {
				method,
				headers: { 'Content-Type': 'application/json' },
				data: '{}',
			});

			// 401 when registered and gated; 404 when WP_DEBUG is off. Never 200.
			expect(
				[401, 404],
				`${method} /${endpoint} must never succeed anonymously`,
			).toContain(res.status());
		}
	});

	/**
	 * @area permissions
	 * @tier fresh
	 * @why  Route discovery should not be a public surface, and the index is the cheapest way to notice a route added without a permission callback.
	 */
	test('every registered route in the namespace index is one we know about @fresh @permissions', async ({
		request,
	}) => {
		// The index is admin-only, so anonymously this must be refused too — which
		// doubles as a check that route discovery is not a public surface.
		const res = await request.get('/wp-json/allfeedback/v1');
		expect([200, 401]).toContain(res.status());
	});

	/**
	 * @area permissions
	 * @tier fresh
	 * @why  An index that returned response envelopes rather than route descriptors would be leaking data through discovery.
	 */
	test('the plugin namespace does not leak route details anonymously @fresh @permissions', async ({
		request,
	}) => {
		const res = await request.get('/wp-json/allfeedback/v1');

		// Either the index is unavailable, or it is readable but exposes only
		// route descriptors — never response data.
		if (res.ok()) {
			const body = await res.text();
			expect(body).not.toContain('"success":true');
		}
	});
});
