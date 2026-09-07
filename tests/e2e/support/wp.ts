/**
 * WordPress-side fixtures: pages, posts and users with real roles.
 *
 * Role boundaries need a caller that is genuinely authenticated as a non-admin,
 * otherwise a 401 proves nothing — a missing nonce produces the same status. So
 * these fixtures mint a WordPress **application password** per user and call the
 * plugin with HTTP Basic auth, which carries that user's capabilities and needs
 * no nonce at all. Application passwords require WP 5.6+ and either HTTPS or a
 * `local`/`development` environment type; skip the spec if creation fails rather
 * than reporting a false pass.
 */
import type { APIRequestContext, Page } from '@playwright/test';

export type WpRole = 'editor' | 'author' | 'contributor' | 'subscriber';

export type RoleUser = {
	id: number;
	username: string;
	/** Plaintext login password — a throwaway, generated per run. */
	password: string;
	/** Value for an `Authorization: Basic …` header, already encoded. */
	basic: string;
};

export class Wp {
	constructor(
		private request: APIRequestContext,
		private nonce: string,
		private selfId: number,
	) {}

	static async create(page: Page, nonce: string): Promise<Wp> {
		const me = await page.request.get('/wp-json/wp/v2/users/me', {
			headers: { 'X-WP-Nonce': nonce },
		});
		const { id } = await me.json();
		return new Wp(page.request, nonce, id);
	}

	private headers() {
		return { 'X-WP-Nonce': this.nonce, 'Content-Type': 'application/json' };
	}

	async createPage(
		title: string,
		content = '',
	): Promise<{ id: number; link: string }> {
		// `_fields` keeps WordPress from rendering `the_content` in the response.
		// That matters: a page whose content contains a block that fatals on
		// render would otherwise 500 the *creation* call, hiding the real
		// failure behind a fixture error.
		const res = await this.request.post(
			'/wp-json/wp/v2/pages?_fields=id,link',
			{
				headers: this.headers(),
				data: JSON.stringify({ title, status: 'publish', content }),
			},
		);
		if (res.status() !== 201)
			throw new Error(`createPage -> ${res.status()} ${await res.text()}`);
		const { id, link } = await res.json();
		return { id, link };
	}

	/**
	 * Delete a page, defensively.
	 *
	 * Blank the content before deleting: WordPress renders the deleted post in
	 * the delete response, so a page containing a block whose renderer fatals
	 * cannot otherwise be removed at all (the DELETE answers 500 and the fixture
	 * leaks). `_fields` then keeps the response from rendering anything.
	 */
	async deletePage(id: number): Promise<void> {
		await this.request.post(`/wp-json/wp/v2/pages/${id}?_fields=id`, {
			headers: this.headers(),
			data: JSON.stringify({ content: '' }),
		});
		await this.request.delete(
			`/wp-json/wp/v2/pages/${id}?force=true&_fields=id`,
			{
				headers: { 'X-WP-Nonce': this.nonce },
			},
		);
	}

	/** A page with no theme furniture to intercept clicks on a fixed-position widget. */
	async createBlankPage(title: string): Promise<{ id: number; link: string }> {
		return this.createPage(
			title,
			'<p>Intentionally blank — widget interaction fixture.</p>',
		);
	}

	/**
	 * Create a user in `role` with an application password.
	 * Returns null when application passwords are unavailable on this site.
	 */
	async createRoleUser(role: WpRole): Promise<RoleUser | null> {
		const username = `tgqa_${role}_${Date.now()}`;
		const password = `Tgqa!${Math.random().toString(36).slice(2)}#2026`;
		const created = await this.request.post('/wp-json/wp/v2/users', {
			headers: this.headers(),
			data: JSON.stringify({
				username,
				email: `${username}@example.test`,
				password,
				roles: [role],
			}),
		});
		if (created.status() !== 201) {
			throw new Error(
				`createRoleUser(${role}) -> ${created.status()} ${await created.text()}`,
			);
		}
		const { id } = await created.json();

		const appPw = await this.request.post(
			`/wp-json/wp/v2/users/${id}/application-passwords`,
			{
				headers: this.headers(),
				data: JSON.stringify({ name: 'tgqa-e2e' }),
			},
		);
		if (appPw.status() !== 201) {
			await this.deleteUser(id);
			return null;
		}
		const { password: appPassword } = await appPw.json();

		return {
			id,
			username,
			password,
			basic: Buffer.from(`${username}:${appPassword}`).toString('base64'),
		};
	}

	async deleteUser(id: number): Promise<void> {
		await this.request.delete(
			`/wp-json/wp/v2/users/${id}?force=true&reassign=${this.selfId}`,
			{
				headers: { 'X-WP-Nonce': this.nonce },
			},
		);
	}
}
