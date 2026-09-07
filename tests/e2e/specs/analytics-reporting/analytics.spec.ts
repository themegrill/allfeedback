/**
 * Analytics shape, and the guard that keeps it from dividing by nothing.
 *
 * `ff8e32e` fixed a week-over-week change that blew up on a float-zero
 * baseline. On a site with no responses every rate is legitimately null rather
 * than 0 or NaN, which is exactly the state that regressed — so a zero-data
 * site is the useful fixture here, not an inconvenience.
 */
import { expect, test } from '@playwright/test';
import { AllFeedbackApi } from '../../support/api';
import { ADMIN_PAGE } from '../../support/env';

type Stat = { value: number | null; change: number | null };

test.describe('analytics', () => {
	let api: AllFeedbackApi;

	test.beforeEach(async ({ page }) => {
		api = await AllFeedbackApi.create(page);
	});

	/**
	 * @area analytics-reporting
	 * @tier fresh
	 * @why  ff8e32e fixed a week-over-week change that broke on a float-zero baseline; a site with no responses is exactly that state, and NaN or Infinity reaching the dashboard is the regression.
	 */
	test('the overview returns stats without NaN or Infinity @fresh @analytics-reporting', async () => {
		const data = await api.get<{ stats: Record<string, Stat> }>(
			'analytics/overview',
		);

		expect(data.stats.total_feedback).toBeDefined();
		expect(data.stats.completion_rate).toBeDefined();

		for (const [name, stat] of Object.entries(data.stats)) {
			for (const field of ['value', 'change'] as const) {
				const v: unknown = stat?.[field];
				if (typeof v === 'number') {
					expect(
						Number.isFinite(v),
						`${name}.${field} must be finite, got ${v}`,
					).toBe(true);
				} else {
					expect(v, `${name}.${field} must be a number or null`).toBeNull();
				}
			}
		}
	});

	/**
	 * @area analytics-reporting
	 * @tier fresh
	 * @why  Session data is written from three different places (9cf7b10, 7e95ff1, 265d2d6), so a form missing session_metrics means one of those paths stopped writing.
	 */
	test('per-form analytics carry session metrics for every form @fresh @analytics-reporting', async () => {
		const data = await api.get<{
			forms: Array<{
				id: number;
				status: string;
				response_count: number;
				session_metrics: unknown;
			}>;
		}>('analytics/forms');

		expect(Array.isArray(data.forms)).toBe(true);
		for (const form of data.forms) {
			expect(
				form.session_metrics,
				`form ${form.id} is missing session_metrics`,
			).toBeTruthy();
			expect(['draft', 'published', 'trashed']).toContain(form.status);
			expect(form.response_count).toBeGreaterThanOrEqual(0);
		}
	});

	/**
	 * @area analytics-reporting
	 * @tier fresh
	 * @why  This value drives the sidebar badge; a negative or non-numeric count renders visible nonsense in wp-admin.
	 */
	test('the unread count is a non-negative number @fresh @analytics-reporting', async () => {
		const data = await api.get<{ count: number }>('responses/unread-count');

		expect(typeof data.count).toBe('number');
		expect(data.count).toBeGreaterThanOrEqual(0);
	});

	/**
	 * @area analytics-reporting
	 * @tier fresh
	 * @why  The dashboard is the product's most-modified screen; this is the cheapest check that it still mounts and renders rather than failing blank.
	 */
	test('the analytics screen renders its cards @fresh @analytics-reporting', async ({
		page,
	}) => {
		await page.goto(`${ADMIN_PAGE}#/analytics`, {
			waitUntil: 'domcontentloaded',
		});

		for (const heading of [
			'Responses over time',
			'Recent responses',
			'Device distribution',
		]) {
			await expect(
				page.getByText(heading, { exact: false }).first(),
			).toBeVisible();
		}
	});
});
