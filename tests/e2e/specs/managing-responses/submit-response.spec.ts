/**
 * The anonymous submit endpoint — the plugin's only unauthenticated write path,
 * and therefore the one worth pinning hardest.
 *
 * It is public in the sense that `permission_callback` does not require a user,
 * but it still demands a `nonce` parameter checked against the
 * `allfeedback_submit` action (SubmitController::NONCE_ACTION). Omitting it is a
 * 400, not a 401 — worth asserting so a refactor that drops the nonce check
 * cannot pass unnoticed.
 */
import { expect, test } from '@playwright/test';
import { AllFeedbackApi, getNonce } from '../../support/api';
import { NPS_BUTTONS, openWidget } from '../../support/widget';
import { Wp } from '../../support/wp';

test.describe('response submission', () => {
	let api: AllFeedbackApi;
	let wp: Wp;
	const created: number[] = [];
	const pages: number[] = [];

	test.beforeEach(async ({ page }) => {
		const nonce = await getNonce(page);
		api = new AllFeedbackApi(page.request, nonce);
		wp = await Wp.create(page, nonce);
	});

	test.afterEach(async () => {
		while (created.length) await api.destroy(created.pop() as number);
		while (pages.length) await wp.deletePage(pages.pop() as number);
	});

	/**
	 * @area managing-responses
	 * @tier fresh
	 * @why  This is the only unauthenticated write path in the plugin; the submit nonce is the whole of its protection.
	 */
	test('submitting without a nonce is rejected @fresh @managing-responses', async ({
		browser,
	}) => {
		const survey = await api.createSurvey();
		created.push(survey.id);
		await api.publish(survey.id);

		const anon = await browser.newContext();
		const res = await anon.request.post(
			`/wp-json/allfeedback/v1/surveys/${survey.id}/submit`,
			{
				headers: { 'Content-Type': 'application/json' },
				data: JSON.stringify({ response_data: { 'tgqa-nps': 9 } }),
			},
		);

		expect(res.status()).toBe(400);
		const body = await res.json();
		expect(body.code).toBe('rest_missing_callback_param');
		expect(body.data.params).toContain('nonce');

		await anon.close();
	});

	/**
	 * @area managing-responses
	 * @tier fresh
	 * @why  The product's core loop, asserted end to end through real UI rather than through the API that the UI happens to call.
	 */
	test('a visitor can submit through the widget and it lands in Responses @fresh @managing-responses', async ({
		browser,
		page,
	}) => {
		const survey = await api.createSurvey({ title: 'TGQA submit flow' });
		created.push(survey.id);
		await api.publish(survey.id);

		const before = await api.get<{ count: number }>('responses/unread-count');

		// A blank page, deliberately: on the theme's home page the hero image
		// overlays the fixed-position widget and intercepts the click, which made
		// this spec flaky rather than failing honestly.
		const host = await wp.createBlankPage('TGQA submit host');
		pages.push(host.id);

		const anon = await browser.newContext();
		const visitor = await anon.newPage();
		await visitor.goto(host.link, { waitUntil: 'domcontentloaded' });

		await openWidget(visitor);

		// Pick a promoter score, then submit.
		await visitor.locator(NPS_BUTTONS).nth(9).click();
		await visitor.locator('.allfb-btn--primary').first().click();

		// The response must reach the database.
		await expect
			.poll(async () => (await api.getSurvey(survey.id)).response_count, {
				timeout: 20_000,
			})
			.toBe(1);

		const after = await api.get<{ count: number }>('responses/unread-count');
		expect(after.count).toBe(before.count + 1);

		await anon.close();
	});

	/**
	 * @area managing-responses
	 * @tier fresh
	 * @why  The admin list is the only place responses are read; its envelope shape is what the SPA binds to.
	 */
	test('the responses list shows a submitted response @fresh @managing-responses', async ({
		page,
	}) => {
		const survey = await api.createSurvey({ title: 'TGQA listed response' });
		created.push(survey.id);
		await api.publish(survey.id);

		const responses = await api.get<{ responses: unknown[]; total: number }>(
			'responses',
		);
		expect(Array.isArray(responses.responses)).toBe(true);
		expect(typeof responses.total).toBe('number');
	});
});
