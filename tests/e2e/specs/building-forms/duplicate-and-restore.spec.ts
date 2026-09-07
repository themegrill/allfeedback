/**
 * Duplicate, and restoring a trashed survey.
 *
 * Restore is not a route of its own: it is a status write back to `draft`,
 * handled by the same match in SurveysController that governs every other
 * transition (`SurveysController.php:419`). Worth pinning precisely because it
 * shares that code path with publish and trash.
 */
import { expect, test } from '@playwright/test';
import { AllFeedbackApi, getNonce } from '../../support/api';

test.describe('duplicate and restore', () => {
	let api: AllFeedbackApi;
	const surveys: number[] = [];

	test.beforeEach(async ({ page }) => {
		api = new AllFeedbackApi(page.request, await getNonce(page));
	});

	test.afterEach(async () => {
		while (surveys.length) await api.destroy(surveys.pop() as number);
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  A duplicate that inherited published state would put an unreviewed copy of a form in front of visitors the moment it was created.
	 */
	test('duplicating a published survey yields a separate draft copy @fresh @building-forms', async () => {
		const original = await api.createSurvey({ title: 'TGQA original' });
		surveys.push(original.id);
		await api.publish(original.id);

		const res = await api.raw('POST', `surveys/${original.id}/duplicate`);
		expect([200, 201]).toContain(res.status());

		const body = await res.json();
		const copy = body.data.survey ?? body.data;
		surveys.push(copy.id);

		expect(copy.id).not.toBe(original.id);
		// A duplicate must never inherit published state.
		expect(copy.status).toBe('draft');
		// The original is untouched.
		expect((await api.getSurvey(original.id)).status).toBe('published');
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  response_count is denormalised onto the survey row, so a copy that inherited it would misreport analytics for a form with no responses.
	 */
	test('a duplicate carries its own empty response count @fresh @building-forms', async () => {
		const original = await api.createSurvey({ title: 'TGQA dup counts' });
		surveys.push(original.id);

		const res = await api.raw('POST', `surveys/${original.id}/duplicate`);
		const body = await res.json();
		const copy = body.data.survey ?? body.data;
		surveys.push(copy.id);

		expect(copy.response_count).toBe(0);
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  Restore is not its own route but a status write, sharing the transition match with publish and trash; a change there can break undo without touching any delete code.
	 */
	test('a trashed survey can be restored to draft @fresh @building-forms', async () => {
		const survey = await api.createSurvey({ title: 'TGQA restore me' });
		surveys.push(survey.id);

		await api.trash(survey.id);
		expect((await api.getSurvey(survey.id)).status).toBe('trashed');

		const restored = await api.raw('PUT', `surveys/${survey.id}`, {
			status: 'draft',
		});
		expect(restored.status()).toBe(200);

		expect((await api.getSurvey(survey.id)).status).toBe('draft');
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  Leaving the trash must re-arm the deletion guard, otherwise restore becomes a way to bypass it.
	 */
	test('a restored survey is no longer permanently deletable @fresh @building-forms', async () => {
		const survey = await api.createSurvey({ title: 'TGQA restore then guard' });
		surveys.push(survey.id);

		await api.trash(survey.id);
		await api.raw('PUT', `surveys/${survey.id}`, { status: 'draft' });

		// Back out of the trash means back behind the 409 guard.
		expect((await api.deletePermanently(survey.id)).status()).toBe(409);
	});
});
