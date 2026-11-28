/**
 * The survey builder: page tabs on the canvas and the live preview beside it.
 *
 * Both views share one "current page" (FormBuilder's `activeSectionIndex`).
 * The preview only steps through pages that have questions, so an empty page
 * exists in the builder but never in the preview — the sync has to handle that.
 */
import { expect, test, type Page } from '@playwright/test';
import { AllFeedbackApi, getNonce } from '../../support/api';
import { ADMIN_PAGE } from '../../support/env';

const field = (id: string, label: string) => ({
	id,
	type: 'short_text',
	label,
	required: false,
	settings: {},
});

/** Page 1 and 3 have one question each; page 2 is empty. */
const THREE_PAGES = {
	version: '1',
	sections: [
		{ id: 'tgqa-p1', title: 'Page 1', fields: [field('tgqa-q1', 'TGQA first question')] },
		{ id: 'tgqa-p2', title: 'Page 2', fields: [] },
		{ id: 'tgqa-p3', title: 'Page 3', fields: [field('tgqa-q3', 'TGQA third question')] },
	],
};

const pageTab = (page: Page, n: number) =>
	page.getByRole('button', { name: `Page ${n}`, exact: true });

/** The preview pager: a label like "1 / 3", "Empty" or "Thanks" between two buttons. */
const pager = (page: Page) =>
	page.locator('div:has(> span:text-matches("^(\\\\d+ / \\\\d+|Empty|Thanks)$"))').first();

test.describe('form builder', () => {
	let api: AllFeedbackApi;
	const surveys: number[] = [];

	test.beforeEach(async ({ page }) => {
		api = new AllFeedbackApi(page.request, await getNonce(page));
		const survey = await api.createSurvey({
			title: 'TGQA builder sync',
			form_schema: THREE_PAGES,
		});
		surveys.push(survey.id);
		// getNonce already left us on #/forms; a hash-only goto would not remount the SPA.
		await page.goto(`${ADMIN_PAGE}#/builder?id=${survey.id}`);
		await page.reload();
		await expect(pageTab(page, 1)).toBeVisible();
	});

	test.afterEach(async () => {
		while (surveys.length) await api.destroy(surveys.pop() as number);
	});

	/**
	 * @area   building-forms
	 * @tier   fresh
	 * @guards PR-29
	 * @source write-spec 2026-11-23
	 * @why    Editing page 3 while the preview still shows page 1 means the author
	 *         never sees what they are changing. Asserts only which page each view
	 *         is on, not how the preview renders the question.
	 */
	test('selecting a builder page tab moves the preview, and the pager moves the builder @fresh @building-forms', async ({ page }) => {
		await pageTab(page, 3).click();
		await expect(page.getByText('TGQA third question').last()).toBeVisible();
		await expect(pager(page).locator('span')).toHaveText('2 / 3');

		await pager(page).locator('button').first().click();
		await expect(pageTab(page, 1)).toHaveAttribute('aria-current', 'page');
	});

	/**
	 * @area   building-forms
	 * @tier   fresh
	 * @guards PR-29
	 * @source write-spec 2026-11-23
	 * @why    Selecting an empty page used to leave the preview showing a different
	 *         page's questions, so it looked like the wrong page was being edited.
	 *         Does not assert the placeholder's styling.
	 */
	test('selecting an empty page shows the empty-page state in the preview @fresh @building-forms', async ({ page }) => {
		await pageTab(page, 2).click();
		await expect(
			page.getByText('This page has no questions yet. Visitors skip empty pages.'),
		).toBeVisible();
		await expect(pager(page).locator('span')).toHaveText('Empty');
		await expect(page.getByText('TGQA first question')).toHaveCount(0);
	});

	/**
	 * @area   building-forms
	 * @tier   fresh
	 * @guards PR-29
	 * @source write-spec 2026-11-23
	 * @why    Reset sent the preview back to page 1 but left the builder on the last
	 *         page, so the two views disagreed. Reaches the thank-you state through
	 *         the pager, so no response is submitted.
	 */
	test('Reset returns both the preview and the builder to page 1 @fresh @building-forms', async ({ page }) => {
		await pageTab(page, 3).click();
		await pager(page).locator('button').last().click();
		await expect(pager(page).locator('span')).toHaveText('Thanks');

		await page.getByRole('button', { name: 'Reset', exact: true }).click();
		await expect(pager(page).locator('span')).toHaveText('1 / 3');
		await expect(pageTab(page, 1)).toHaveAttribute('aria-current', 'page');
	});
});
