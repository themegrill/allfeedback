/**
 * The settings tree and its enums.
 *
 * Everything lives in one option (`_allfeedback_settings`) as a three-level
 * tree, so a save that drops a branch is easy to ship and hard to notice. These
 * specs pin the shape and the enum rejections; each mutating test restores what
 * it changed.
 */
import { expect, test } from '@playwright/test';
import { AllFeedbackApi } from '../../support/api';
import { ADMIN_PAGE } from '../../support/env';

test.describe('settings contract', () => {
	let api: AllFeedbackApi;

	test.beforeEach(async ({ page }) => {
		api = await AllFeedbackApi.create(page);
	});

	/**
	 * @area settings
	 * @tier fresh
	 * @why  Everything lives in one option as a three-level tree, so a save that drops a branch is easy to ship and hard to notice.
	 */
	test('the settings tree exposes all three top-level groups @fresh @settings', async () => {
		const settings = await api.getSettings();

		expect(Object.keys(settings).sort()).toEqual([
			'advanced',
			'email',
			'general',
		]);
		expect(settings.general.widget).toMatchObject({
			position: expect.any(String),
			trigger: expect.any(String),
			delay: expect.any(Number),
			scroll_threshold: expect.any(Number),
			show_on_mobile: expect.any(Boolean),
		});
		expect(settings.advanced.privacy).toMatchObject({
			disable_user_details: expect.any(Boolean),
			require_consent: expect.any(Boolean),
		});
		expect(settings.advanced.logging).toMatchObject({
			enabled: expect.any(Boolean),
			level: expect.any(String),
			retention_days: expect.any(Number),
		});
		expect(settings.advanced.plugin).toMatchObject({
			delete_on_uninstall: expect.any(Boolean),
		});
	});

	/**
	 * @area settings
	 * @tier fresh
	 * @why  An invalid position reaches CSS as a class name and breaks the widget's placement silently.
	 */
	test('a widget position outside the enum is rejected @fresh @settings', async () => {
		const before = await api.getSettings();

		const res = await api.raw('PUT', 'settings', {
			general: { widget: { position: 'middle-of-nowhere' } },
		});

		expect(res.status()).toBe(400);
		// And nothing changed.
		expect((await api.getSettings()).general.widget.position).toBe(
			before.general.widget.position,
		);
	});

	/**
	 * @area settings
	 * @tier fresh
	 * @why  An unrecognised level would either log everything or nothing, and neither failure announces itself.
	 */
	test('a logging level outside the enum is rejected @fresh @settings', async () => {
		const res = await api.raw('PUT', 'settings', {
			advanced: { logging: { level: 'chatty' } },
		});

		expect(res.status()).toBe(400);
	});

	/**
	 * @area settings
	 * @tier fresh
	 * @why  A partial write must not wipe the branches it did not mention — the classic way a nested settings tree loses data.
	 */
	test('a widget position change round-trips and leaves siblings intact @fresh @settings', async () => {
		const before = await api.getSettings();
		const original = before.general.widget.position;
		const next = original === 'bottom-left' ? 'bottom-right' : 'bottom-left';

		try {
			const res = await api.raw('PUT', 'settings', {
				general: { widget: { position: next } },
			});
			expect(res.status()).toBe(200);

			const after = await api.getSettings();
			expect(after.general.widget.position).toBe(next);
			// A partial write must not wipe the branches it did not mention.
			expect(after.general.widget.trigger).toBe(before.general.widget.trigger);
			expect(after.advanced.privacy.consent_text).toBe(
				before.advanced.privacy.consent_text,
			);
			expect(after.email.notifications).toEqual(before.email.notifications);
		} finally {
			await api.raw('PUT', 'settings', {
				general: { widget: { position: original } },
			});
		}
	});

	/**
	 * @area settings
	 * @tier fresh
	 * @why  Proves the three documented positions are actually offered, and that #/settings resolves to its first tab.
	 */
	test('the settings screen renders the general tab with the three position choices @fresh @settings', async ({
		page,
	}) => {
		await page.goto(`${ADMIN_PAGE}#/settings`, {
			waitUntil: 'domcontentloaded',
		});

		// #/settings redirects to its first tab.
		await expect.poll(() => page.url()).toContain('#/settings/general');

		// Each position appears twice: once as a labelled choice and once as an
		// icon-only button inside the live preview mockup (which carries the name
		// in `title`, not as text). Match on visible text to get the choice.
		for (const label of ['Bottom left', 'Bottom right', 'Side tab']) {
			await expect(
				page.locator('button').filter({ hasText: new RegExp(`^${label}$`) }),
			).toHaveCount(1);
		}
		await expect(
			page.getByRole('button', { name: 'Save Changes' }),
		).toBeVisible();
	});
});
