/**
 * Draft surveys must not reach visitors — the single most important frontend
 * contract the docs make, and the one a status-machine regression would break
 * silently.
 *
 * Observed widget DOM (resources/scripts frontend build):
 *   .allfb-widget       wrapper, carries data-position
 *   .allfb-launcher     the closed-state button ("Open feedback")
 *   #allfb-panel        the open panel
 *   .allfb-scale--nps   the 0-10 NPS scale inside it
 */
import { expect, test } from '@playwright/test';
import { AllFeedbackApi } from '../../support/api';
import { NPS_BUTTONS, PANEL, openWidget } from '../../support/widget';

test.describe('widget visibility', () => {
	let api: AllFeedbackApi;
	const created: number[] = [];

	test.beforeEach(async ({ page }) => {
		api = await AllFeedbackApi.create(page);
	});

	test.afterEach(async () => {
		while (created.length) await api.destroy(created.pop() as number);
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  The single most important frontend contract: unfinished forms must never reach visitors.
	 */
	test('a draft survey renders no widget for an anonymous visitor @fresh @building-forms', async ({
		browser,
	}) => {
		const survey = await api.createSurvey({ title: 'TGQA draft widget' });
		created.push(survey.id);
		expect(survey.status).toBe('draft');

		const anon = await browser.newContext();
		const page = await anon.newPage();
		await page.goto('/', { waitUntil: 'domcontentloaded' });

		await expect(page.locator('.allfb-widget')).toHaveCount(0);
		await expect(page.locator('.allfb-launcher')).toHaveCount(0);

		await anon.close();
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  The positive half of the draft contract — proving the widget is hidden is worthless if it is never shown either.
	 */
	test('a published survey renders the launcher for an anonymous visitor @fresh @building-forms', async ({
		browser,
	}) => {
		const survey = await api.createSurvey({ title: 'TGQA published widget' });
		created.push(survey.id);
		await api.publish(survey.id);

		const anon = await browser.newContext();
		const page = await anon.newPage();
		await page.goto('/', { waitUntil: 'domcontentloaded' });

		await expect(page.locator('.allfb-launcher')).toBeVisible();
		await expect(page.locator('.allfb-widget')).toHaveAttribute(
			'data-position',
			/bottom-(right|left)|side-tab/,
		);

		await anon.close();
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  NPS is 0-10, so eleven buttons; ten would mean an off-by-one that quietly changes every score submitted.
	 */
	test('the open panel shows an eleven-point NPS scale @fresh @building-forms', async ({
		browser,
	}) => {
		const survey = await api.createSurvey({ title: 'TGQA open panel' });
		created.push(survey.id);
		await api.publish(survey.id);

		const anon = await browser.newContext();
		const page = await anon.newPage();
		await page.goto('/', { waitUntil: 'domcontentloaded' });

		await openWidget(page);

		await expect(page.locator(PANEL)).toBeVisible();
		await expect(page.locator('.allfb-scale--nps')).toBeVisible();
		// NPS is a 0-10 scale: eleven buttons, not ten.
		await expect(page.locator(NPS_BUTTONS)).toHaveCount(11);

		await anon.close();
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  The default auto trigger opens the panel on load, so the launcher's real job is toggling — and that is the behaviour a spec is most likely to get wrong.
	 */
	test('the launcher toggles the panel shut and open again @fresh @building-forms', async ({
		browser,
	}) => {
		const survey = await api.createSurvey({ title: 'TGQA toggle panel' });
		created.push(survey.id);
		await api.publish(survey.id);

		const anon = await browser.newContext();
		const page = await anon.newPage();
		await page.goto('/', { waitUntil: 'domcontentloaded' });

		await openWidget(page);

		await page.locator('.allfb-launcher').click();
		await expect(page.locator('.allfb-panel.is-open')).toHaveCount(0);
		await expect(page.locator(PANEL)).toHaveAttribute('aria-hidden', 'true');

		await page.locator('.allfb-launcher').click();
		await expect(page.locator('.allfb-panel.is-open')).toHaveCount(1);

		await anon.close();
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  The shortcode must be consumed rather than printed raw, and must respect draft status like every other surface.
	 */
	test('a draft survey embedded by shortcode renders nothing @fresh @building-forms', async ({
		page,
		browser,
	}) => {
		const survey = await api.createSurvey({ title: 'TGQA shortcode draft' });
		created.push(survey.id);

		const created_page = await page.request.post('/wp-json/wp/v2/pages', {
			headers: {
				'X-WP-Nonce': await page.evaluate(
					() => (window as any).__ALLFB_ADMIN__.nonce,
				),
				'Content-Type': 'application/json',
			},
			data: JSON.stringify({
				title: 'TGQA shortcode draft probe',
				status: 'publish',
				content: `[allfeedback_survey id="${survey.id}"]`,
			}),
		});
		expect(created_page.status()).toBe(201);
		const { id: pageId, link } = await created_page.json();

		try {
			const anon = await browser.newContext();
			const visitor = await anon.newPage();
			await visitor.goto(link, { waitUntil: 'domcontentloaded' });

			// The shortcode itself must be consumed, not printed raw…
			await expect(
				visitor.getByText('[allfeedback_survey', { exact: false }),
			).toHaveCount(0);
			// …and it must not render a form for a draft survey.
			await expect(visitor.locator('.allfb-form-wrapper')).toHaveCount(0);

			await anon.close();
		} finally {
			await page.request.delete(`/wp-json/wp/v2/pages/${pageId}?force=true`, {
				headers: {
					'X-WP-Nonce': await page.evaluate(
						() => (window as any).__ALLFB_ADMIN__.nonce,
					),
				},
			});
		}
	});
});
