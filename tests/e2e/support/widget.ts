/**
 * Driving the frontend widget.
 *
 * The subtlety worth encoding: the default `general.widget.trigger` is `auto`,
 * so the panel opens itself on load. A spec that unconditionally clicks the
 * launcher therefore *closes* the panel, and the next click lands on whatever
 * theme content is underneath. Check the state first, then act.
 *
 * Open state is `.allfb-panel.is-open` with `aria-hidden="false"`
 * (resources/scripts/frontend/components/Widget.tsx).
 */
import { expect, type Page } from '@playwright/test';

export const WIDGET = '.allfb-widget';
export const LAUNCHER = '.allfb-launcher';
export const PANEL = '#allfb-panel';
export const NPS_BUTTONS = '.allfb-scale--nps .allfb-scale__btn';

/** Wait for the widget to mount, then make sure its panel is open. */
export async function openWidget(page: Page): Promise<void> {
	await expect(page.locator(LAUNCHER)).toBeVisible();

	if ((await page.locator('.allfb-panel.is-open').count()) === 0) {
		await page.locator(LAUNCHER).click();
	}

	await expect(page.locator('.allfb-panel.is-open')).toHaveCount(1);
	await expect(page.locator(PANEL)).toHaveAttribute('aria-hidden', 'false');
}
