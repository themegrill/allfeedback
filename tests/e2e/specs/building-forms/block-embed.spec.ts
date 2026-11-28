/**
 * The `allfeedback/survey` block embed.
 *
 * Guards the block renderer: a published survey renders a mount point, a
 * draft or missing survey renders nothing, and the page never errors.
 */
import { expect, test } from '@playwright/test';
import { AllFeedbackApi, getNonce } from '../../support/api';
import { Wp } from '../../support/wp';

const block = (surveyId: number) =>
	`<!-- wp:allfeedback/survey {"surveyId":${surveyId}} /-->`;

test.describe('block embed', () => {
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
	 * @why  surveyId 0 returns before the broken line, so this passes today and proves the fixture and block registration are sound rather than the whole file being red for one reason.
	 */
	test('a block with no survey selected renders nothing and does not error @fresh @building-forms', async ({
		browser,
	}) => {
		// surveyId 0 returns early, before the broken line — so this one passes,
		// and proves the fixture and block registration are sound.
		const host = await wp.createPage('TGQA block unset host', block(0));
		pages.push(host.id);

		const ctx = await browser.newContext();
		const visitor = await ctx.newPage();
		const res = await visitor.goto(host.link, {
			waitUntil: 'domcontentloaded',
		});

		expect(res?.status()).toBe(200);
		await expect(visitor.locator('.allfb-embed')).toHaveCount(0);
		await ctx.close();
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  A comment once swallowed the repository lookup in the block renderer, so every positive survey id took the page down with a 500.
	 */
	test('a published survey embedded as a block renders a mount point @fresh @building-forms', async ({
		browser,
	}) => {
		const survey = await api.createSurvey({ title: 'TGQA block published' });
		surveys.push(survey.id);
		await api.publish(survey.id);

		const host = await wp.createPage(
			'TGQA block published host',
			block(survey.id),
		);
		pages.push(host.id);

		const ctx = await browser.newContext();
		const visitor = await ctx.newPage();
		const res = await visitor.goto(host.link, {
			waitUntil: 'domcontentloaded',
		});

		expect(res?.status(), 'a page containing the block must not 500').toBe(200);
		await expect(
			visitor.locator(`.allfb-embed[data-survey-id="${survey.id}"]`),
		).toBeVisible();
		await ctx.close();
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  A draft embed must render empty rather than 500 — the same fatal fires before the status check is ever reached.
	 */
	test('a draft survey embedded as a block renders nothing @fresh @building-forms', async ({
		browser,
	}) => {
		const survey = await api.createSurvey({ title: 'TGQA block draft' });
		surveys.push(survey.id);
		expect(survey.status).toBe('draft');

		const host = await wp.createPage('TGQA block draft host', block(survey.id));
		pages.push(host.id);

		const ctx = await browser.newContext();
		const visitor = await ctx.newPage();
		const res = await visitor.goto(host.link, {
			waitUntil: 'domcontentloaded',
		});

		expect(res?.status(), 'a draft embed must render empty, not 500').toBe(200);
		await expect(visitor.locator('.allfb-embed')).toHaveCount(0);
		await ctx.close();
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  A dangling survey id is ordinary after a deletion and must degrade to empty output, not a site-wide fatal.
	 */
	test('a block pointing at a survey that does not exist renders nothing @fresh @building-forms', async ({
		browser,
	}) => {
		const host = await wp.createPage('TGQA block missing host', block(999999));
		pages.push(host.id);

		const ctx = await browser.newContext();
		const visitor = await ctx.newPage();
		const res = await visitor.goto(host.link, {
			waitUntil: 'domcontentloaded',
		});

		expect(
			res?.status(),
			'a dangling survey id must render empty, not 500',
		).toBe(200);
		await expect(visitor.locator('.allfb-embed')).toHaveCount(0);
		await ctx.close();
	});

	/**
	 * @area building-forms
	 * @tier fresh
	 * @why  Same survey, same page, different renderer — this isolates the fault to SurveyBlock instead of to survey loading in general.
	 */
	test('the shortcode path still works, so the fault is the block renderer alone @fresh @building-forms', async ({
		browser,
	}) => {
		// Same survey, same page, different renderer: this isolates the bug to
		// SurveyBlock rather than to survey loading in general.
		const survey = await api.createSurvey({ title: 'TGQA shortcode control' });
		surveys.push(survey.id);
		await api.publish(survey.id);

		const host = await wp.createPage(
			'TGQA shortcode control host',
			`[allfeedback_survey id="${survey.id}"]`,
		);
		pages.push(host.id);

		const ctx = await browser.newContext();
		const visitor = await ctx.newPage();
		const res = await visitor.goto(host.link, {
			waitUntil: 'domcontentloaded',
		});

		expect(res?.status()).toBe(200);
		await ctx.close();
	});
});
