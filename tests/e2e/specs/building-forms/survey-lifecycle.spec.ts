/**
 * The survey status machine: draft → published → trashed → gone.
 *
 * The two-step deletion is a deliberate contract, not an inconvenience:
 * DELETE /surveys/{id}/delete on a survey that is not trashed answers 409
 * (SurveysController::destroyPermanent). A regression that made it delete
 * anything reachable would be data loss, so it is asserted directly.
 */
import { expect, test } from '@playwright/test';
import { AllFeedbackApi } from '../../support/api';

test.describe('survey lifecycle', () => {
	let api: AllFeedbackApi;
	const created: number[] = [];

	test.beforeEach(async ({ page }) => {
		api = await AllFeedbackApi.create(page);
	});

	test.afterEach(async () => {
		while (created.length) {
			await api.destroy(created.pop() as number);
		}
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  Creation must never produce a live form; the API ignores any status passed in, and that is the guarantee editors rely on.
	 */
	test('a new survey is created as a draft @fresh @building-forms', async () => {
		const survey = await api.createSurvey({ title: 'TGQA lifecycle draft' });
		created.push(survey.id);

		expect(survey.status).toBe('draft');
		expect(survey.title).toBe('TGQA lifecycle draft');
		expect(survey.response_count).toBe(0);
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  Publishing is the only transition that puts a form in front of visitors, so it is the one worth asserting directly.
	 */
	test('publishing moves a draft to published @fresh @building-forms', async () => {
		const survey = await api.createSurvey();
		created.push(survey.id);

		const res = await api.publish(survey.id);
		expect(res.status()).toBe(200);

		expect((await api.getSurvey(survey.id)).status).toBe('published');
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  Deleting a live survey in one call would be silent data loss; the 409 is the contract that prevents it.
	 */
	test('permanent deletion is refused with 409 until the survey is trashed @fresh @building-forms', async () => {
		const survey = await api.createSurvey();
		created.push(survey.id);

		const premature = await api.deletePermanently(survey.id);
		expect(
			premature.status(),
			'deleting a live survey must be refused, not silently accepted',
		).toBe(409);
		expect(await premature.text()).toContain('trashed');

		// Still there.
		expect((await api.getSurvey(survey.id)).status).toBe('draft');
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  The two-step path must actually complete, otherwise the 409 guard would make surveys undeletable.
	 */
	test('trash then delete removes the survey for good @fresh @building-forms', async () => {
		const survey = await api.createSurvey();

		expect((await api.trash(survey.id)).status()).toBe(200);
		expect((await api.getSurvey(survey.id)).status).toBe('trashed');

		expect((await api.deletePermanently(survey.id)).status()).toBe(200);

		const gone = await api.raw('GET', `surveys/${survey.id}`);
		expect(gone.status()).toBe(404);
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  Re-trashing must not reset trash metadata or silently succeed, which would make the trash date meaningless.
	 */
	test('trashing an already-trashed survey is refused with 409 @fresh @building-forms', async () => {
		const survey = await api.createSurvey();
		created.push(survey.id);

		await api.trash(survey.id);
		const again = await api.trash(survey.id);

		expect(again.status()).toBe(409);
		expect(await again.text()).toContain('trash');
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  The shortcode string shown here is what users copy; the list is also the churn-heaviest screen in the product (AllForms.tsx, 50 modifications).
	 */
	test('a survey appears in the forms list with its shortcode @fresh @building-forms', async ({
		page,
	}) => {
		const survey = await api.createSurvey({ title: 'TGQA listed form' });
		created.push(survey.id);

		// AllFeedbackApi.create() already navigated here to read the nonce, so a
		// goto to the same URL would not refetch. Reload so the list sees the
		// survey this test just created.
		await page.goto('/wp-admin/admin.php?page=allfeedback#/forms', {
			waitUntil: 'domcontentloaded',
		});
		await page.reload({ waitUntil: 'domcontentloaded' });

		await expect(page.getByText('TGQA listed form')).toBeVisible();
		await expect(
			page.getByText(`[allfeedback_survey id="${survey.id}"]`, {
				exact: false,
			}),
		).toBeVisible();
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  An unvalidated status would reach the query layer as a raw string; the enum is draft, published, trashed and nothing else.
	 */
	test('the surveys list rejects a status outside the enum @fresh @building-forms', async () => {
		const res = await api.raw('GET', 'surveys?status=all');

		expect(res.status()).toBe(400);
		const body = await res.json();
		expect(body.code).toBe('rest_invalid_param');
	});
});
