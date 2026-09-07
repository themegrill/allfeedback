/**
 * Page targeting, and where the decision is actually made.
 *
 * Worth knowing before reading these: the choice is split across two layers.
 * PHP (`TargetingEngine::matchesSettingsTargeting`, `evaluateRule`) decides
 * which surveys are eligible for the current URL from `targetPages` /
 * `target_page_ids` and the `page_id` / `post_id` / `post_type` rules. The
 * React widget then applies **audience** (`checkAudience`) and **frequency**
 * (`checkFrequency`) client-side from `show_to`, `display_frequency`,
 * `max_impressions` and `reshow_after_days`
 * (resources/scripts/frontend/index.tsx:9,16).
 *
 * These specs cover the PHP half, which is the half that decides whether the
 * widget is on the page at all.
 */
import { expect, test } from '@playwright/test';
import { AllFeedbackApi, getNonce } from '../../support/api';
import { Wp } from '../../support/wp';

test.describe('page targeting', () => {
	let api: AllFeedbackApi;
	let wp: Wp;
	const surveys: number[] = [];
	const pages: number[] = [];

	test.beforeEach(async ({ page }) => {
		const nonce = await getNonce(page);
		api = new AllFeedbackApi(page.request, nonce);
		wp = await Wp.create(page, nonce);
	});

	test.afterEach(async () => {
		while (surveys.length) await api.destroy(surveys.pop() as number);
		while (pages.length) await wp.deletePage(pages.pop() as number);
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  The default targeting mode is what most sites use, so a regression here hides the widget everywhere at once.
	 */
	test('targetPages "all" shows the widget on an arbitrary page @fresh @building-forms', async ({
		browser,
	}) => {
		const target = await wp.createPage('TGQA targeting anywhere');
		pages.push(target.id);

		const survey = await api.createSurvey({
			title: 'TGQA target all',
			settings: {
				widget: { enabled: true, position: 'bottom-right' },
				targetPages: 'all',
			},
		});
		surveys.push(survey.id);
		await api.publish(survey.id);

		const ctx = await browser.newContext();
		const visitor = await ctx.newPage();
		await visitor.goto(target.link, { waitUntil: 'domcontentloaded' });

		await expect(visitor.locator('.allfb-launcher')).toBeVisible();
		await ctx.close();
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  Both halves matter: appearing on the wrong page is as much a defect as not appearing on the right one.
	 */
	test('targeting specific pages shows the widget there and nowhere else @fresh @building-forms', async ({
		browser,
	}) => {
		const included = await wp.createPage('TGQA targeting included');
		const excluded = await wp.createPage('TGQA targeting excluded');
		pages.push(included.id, excluded.id);

		const survey = await api.createSurvey({
			title: 'TGQA target specific',
			settings: {
				widget: { enabled: true, position: 'bottom-right' },
				targetPages: 'specific_pages',
				target_page_ids: [included.id],
			},
		});
		surveys.push(survey.id);
		await api.publish(survey.id);

		const ctx = await browser.newContext();
		const visitor = await ctx.newPage();

		await visitor.goto(included.link, { waitUntil: 'domcontentloaded' });
		await expect(visitor.locator('.allfb-launcher')).toBeVisible();

		await visitor.goto(excluded.link, { waitUntil: 'domcontentloaded' });
		await expect(visitor.locator('.allfb-widget')).toHaveCount(0);

		await ctx.close();
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  The docs state this explicitly, and the safe reading of an empty selection is 'nowhere' rather than 'everywhere'.
	 */
	test('targeting specific pages with no page selected shows the widget nowhere @fresh @building-forms', async ({
		browser,
	}) => {
		// The docs state this explicitly: "If you set a form to Specific Pages or
		// Posts but do not select any pages or posts, the widget will never appear."
		const anywhere = await wp.createPage('TGQA targeting empty selection');
		pages.push(anywhere.id);

		const survey = await api.createSurvey({
			title: 'TGQA target none selected',
			settings: {
				widget: { enabled: true, position: 'bottom-right' },
				targetPages: 'specific_pages',
				target_page_ids: [],
			},
		});
		surveys.push(survey.id);
		await api.publish(survey.id);

		const ctx = await browser.newContext();
		const visitor = await ctx.newPage();
		await visitor.goto(anywhere.link, { waitUntil: 'domcontentloaded' });

		await expect(visitor.locator('.allfb-widget')).toHaveCount(0);
		await ctx.close();
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  A scalar reaching the targeting query would be coerced silently and match the wrong pages.
	 */
	test('target_page_ids must be an array @fresh @building-forms', async () => {
		const res = await api.raw('POST', 'surveys', {
			title: 'TGQA bad targeting',
			settings: {
				targetPages: 'specific_pages',
				target_page_ids: 'not-an-array',
			},
		});

		// 422 from the plugin's own settings validation
		// (SurveysController::validateSettings); 400 would be WordPress's arg
		// schema rejecting it first. Either is a refusal, which is the contract.
		expect([400, 422]).toContain(res.status());
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  Documented behaviour, and two stacked launchers would be an obvious visual defect on any site with more than one form.
	 */
	test('only one widget renders even when two published surveys both match @fresh @building-forms', async ({
		browser,
	}) => {
		// Documented: "Only one widget is shown per page."
		const first = await api.createSurvey({
			title: 'TGQA one-widget A',
			settings: {
				widget: { enabled: true, position: 'bottom-right' },
				targetPages: 'all',
			},
		});
		surveys.push(first.id);
		await api.publish(first.id);

		const second = await api.createSurvey({
			title: 'TGQA one-widget B',
			settings: {
				widget: { enabled: true, position: 'bottom-right' },
				targetPages: 'all',
			},
		});
		surveys.push(second.id);
		await api.publish(second.id);

		const ctx = await browser.newContext();
		const visitor = await ctx.newPage();
		await visitor.goto('/', { waitUntil: 'domcontentloaded' });

		await expect(visitor.locator('.allfb-launcher')).toHaveCount(1);
		await ctx.close();
	});
});
