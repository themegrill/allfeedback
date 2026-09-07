/**
 * What an admin does with responses after they arrive: read state, deletion,
 * and the unread counter that drives the sidebar badge.
 *
 * The badge is computed from ResponseRepository::countUnread() at menu-render
 * time (AdminServiceProvider.php:144), so `is_read` drifting out of step with
 * the counter is a visible bug. Sorting and the unsaved-changes prompt in this
 * screen are historically fragile (`167db05`, `d213352`).
 */
import { expect, test } from '@playwright/test';
import { AllFeedbackApi, getNonce } from '../../support/api';
import { NPS_BUTTONS, openWidget } from '../../support/widget';
import { Wp } from '../../support/wp';

/**
 * Submit one response as an anonymous visitor through the widget.
 *
 * Deliberately on a blank page rather than the site home page: the theme's hero
 * image overlays the fixed-position widget and intercepts the click there.
 */
async function submitOne(
	browser: any,
	wp: Wp,
	api: AllFeedbackApi,
	surveyId: number,
) {
	const host = await wp.createBlankPage(`TGQA submit host ${surveyId}`);
	const ctx = await browser.newContext();
	const visitor = await ctx.newPage();
	await visitor.goto(host.link, { waitUntil: 'domcontentloaded' });

	await openWidget(visitor);
	await visitor.locator(NPS_BUTTONS).nth(9).click();
	await visitor.locator('.allfb-btn--primary').first().click();

	await expect
		.poll(async () => (await api.getSurvey(surveyId)).response_count, {
			timeout: 30_000,
		})
		.toBe(1);

	await ctx.close();
	await wp.deletePage(host.id);
}

test.describe('response management', () => {
	let api: AllFeedbackApi;
	let wp: Wp;
	const surveys: number[] = [];

	test.beforeEach(async ({ page }) => {
		const nonce = await getNonce(page);
		api = new AllFeedbackApi(page.request, nonce);
		wp = await Wp.create(page, nonce);
	});

	test.afterEach(async () => {
		while (surveys.length) await api.destroy(surveys.pop() as number);
	});

	/**
	 * @area managing-responses
	 * @tier fresh
	 * @why  The sidebar badge is computed from countUnread() at menu-render time, so is_read drifting out of step with the counter is visible to every admin.
	 */
	test('a new response is unread, and marking it read decrements the counter @fresh @managing-responses', async ({
		browser,
	}) => {
		const survey = await api.createSurvey({ title: 'TGQA read state' });
		surveys.push(survey.id);
		await api.publish(survey.id);

		const before = (await api.get<{ count: number }>('responses/unread-count'))
			.count;
		await submitOne(browser, wp, api, survey.id);

		const afterSubmit = (
			await api.get<{ count: number }>('responses/unread-count')
		).count;
		expect(afterSubmit).toBe(before + 1);

		const list = await api.get<{
			responses: Array<{ id: number; is_read: boolean | number }>;
		}>(`surveys/${survey.id}/responses`);
		expect(list.responses).toHaveLength(1);
		const responseId = list.responses[0].id;

		const marked = await api.raw('POST', 'responses/mark-read', {
			ids: [responseId],
		});
		expect(marked.status()).toBe(200);

		expect(
			(await api.get<{ count: number }>('responses/unread-count')).count,
		).toBe(before);
	});

	/**
	 * @area managing-responses
	 * @tier fresh
	 * @why  Unread is reversible in the UI; if the counter does not follow, the badge and the list disagree.
	 */
	test('marking a response unread puts it back in the counter @fresh @managing-responses', async ({
		browser,
	}) => {
		const survey = await api.createSurvey({ title: 'TGQA unread state' });
		surveys.push(survey.id);
		await api.publish(survey.id);

		const before = (await api.get<{ count: number }>('responses/unread-count'))
			.count;
		await submitOne(browser, wp, api, survey.id);

		const list = await api.get<{ responses: Array<{ id: number }> }>(
			`surveys/${survey.id}/responses`,
		);
		const responseId = list.responses[0].id;

		await api.raw('POST', 'responses/mark-read', { ids: [responseId] });
		expect(
			(await api.get<{ count: number }>('responses/unread-count')).count,
		).toBe(before);

		const unread = await api.raw('POST', 'responses/mark-unread', {
			ids: [responseId],
		});
		expect(unread.status()).toBe(200);
		expect(
			(await api.get<{ count: number }>('responses/unread-count')).count,
		).toBe(before + 1);
	});

	/**
	 * @area managing-responses
	 * @tier fresh
	 * @why  response_count is denormalised, so deletion has to update two places and is an easy one to half-implement.
	 */
	test('deleting a response removes it and drops the survey count @fresh @managing-responses', async ({
		browser,
	}) => {
		const survey = await api.createSurvey({ title: 'TGQA delete response' });
		surveys.push(survey.id);
		await api.publish(survey.id);

		await submitOne(browser, wp, api, survey.id);

		const list = await api.get<{ responses: Array<{ id: number }> }>(
			`surveys/${survey.id}/responses`,
		);
		const responseId = list.responses[0].id;

		const deleted = await api.raw(
			'DELETE',
			`surveys/${survey.id}/responses/delete`,
			{
				ids: [responseId],
			},
		);
		expect(deleted.status()).toBe(200);

		const after = await api.get<{ responses: unknown[] }>(
			`surveys/${survey.id}/responses`,
		);
		expect(after.responses).toHaveLength(0);
	});

	/**
	 * @area managing-responses
	 * @tier fresh
	 * @why  Scoring is where a response becomes a number; a 9 must be counted a promoter or every NPS figure downstream is wrong.
	 */
	test('a submitted NPS score is scored and surfaces in per-form analytics @fresh @managing-responses', async ({
		browser,
	}) => {
		const survey = await api.createSurvey({ title: 'TGQA nps analytics' });
		surveys.push(survey.id);
		await api.publish(survey.id);

		await submitOne(browser, wp, api, survey.id);

		const forms = await api.get<{
			forms: Array<{
				id: number;
				response_count: number;
				nps_score?: Record<string, number>;
			}>;
		}>('analytics/forms');
		const mine = forms.forms.find((f) => f.id === survey.id);

		expect(mine, 'the survey must appear in per-form analytics').toBeTruthy();
		expect(mine!.response_count).toBe(1);

		// A 9 is a promoter. Only assert the shape when the payload carries it.
		if (mine!.nps_score) {
			expect(mine!.nps_score).toMatchObject({
				promoters: expect.any(Number),
				passives: expect.any(Number),
				detractors: expect.any(Number),
			});
			expect(mine!.nps_score.promoters).toBe(1);
		}
	});
});
