/**
 * A thin AllFeedback REST client, plus survey fixtures.
 *
 * Two things this file encodes, both learned the hard way against a live site:
 *
 *  1. Cookie auth alone is NOT enough for the WordPress REST API. Every admin
 *     request needs an `X-WP-Nonce` header. The nonce is localized into
 *     `window.__ALLFB_ADMIN__.nonce` on the admin page, so we load the admin SPA
 *     once and read it from there. Without it every route answers 401
 *     `rest_forbidden`, which looks exactly like a permission bug and is not one.
 *
 *  2. Permanent deletion is a two-step: DELETE /surveys/{id}/trash, then
 *     DELETE /surveys/{id}/delete. Calling /delete on a live survey answers 409
 *     by design (SurveysController::destroyPermanent).
 */
import type { APIRequestContext, Page } from '@playwright/test';
import { ADMIN_PAGE, REST } from './env';

/** The `{ success, data }` envelope every AllFeedback route returns. */
export type Envelope<T = unknown> = { success: boolean; data: T };

export type Survey = {
	id: number;
	title: string;
	status: 'draft' | 'published' | 'trashed';
	response_count: number;
	form_schema?: unknown;
	settings?: Record<string, unknown>;
	styling?: Record<string, unknown>;
	targeting?: unknown;
	conflict_reason: string | null;
};

/**
 * Read the REST nonce out of the admin SPA's localized bootstrap object.
 * Navigates to the admin page as a side effect.
 */
export async function getNonce(page: Page): Promise<string> {
	await page.goto(`${ADMIN_PAGE}#/forms`, { waitUntil: 'domcontentloaded' });
	const nonce = await page.evaluate(
		() =>
			(window as unknown as { __ALLFB_ADMIN__?: { nonce?: string } })
				.__ALLFB_ADMIN__?.nonce,
	);
	if (!nonce) {
		throw new Error('__ALLFB_ADMIN__.nonce was not present on the admin page');
	}
	return nonce;
}

/** An authenticated AllFeedback API caller bound to one nonce. */
export class AllFeedbackApi {
	constructor(
		private request: APIRequestContext,
		private nonce: string,
	) {}

	static async create(page: Page): Promise<AllFeedbackApi> {
		return new AllFeedbackApi(page.request, await getNonce(page));
	}

	private headers() {
		return { 'X-WP-Nonce': this.nonce, 'Content-Type': 'application/json' };
	}

	async raw(
		method: 'GET' | 'POST' | 'PUT' | 'DELETE',
		endpoint: string,
		body?: unknown,
	) {
		return this.request.fetch(`${REST}/${endpoint.replace(/^\//, '')}`, {
			method,
			headers: this.headers(),
			data: body === undefined ? undefined : JSON.stringify(body),
		});
	}

	async get<T>(endpoint: string): Promise<T> {
		const res = await this.raw('GET', endpoint);
		const json = (await res.json()) as Envelope<T>;
		if (!res.ok()) {
			throw new Error(
				`GET ${endpoint} -> ${res.status()} ${JSON.stringify(json)}`,
			);
		}
		return json.data;
	}

	async listSurveys(): Promise<Survey[]> {
		return (await this.get<{ surveys: Survey[] }>('surveys')).surveys;
	}

	async getSurvey(id: number): Promise<Survey> {
		const data = await this.get<Survey | { survey: Survey }>(`surveys/${id}`);
		return 'survey' in (data as { survey?: Survey })
			? (data as { survey: Survey }).survey
			: (data as Survey);
	}

	async getSettings(): Promise<Record<string, any>> {
		return this.get<Record<string, any>>('settings');
	}

	/**
	 * Create a survey. Defaults to a one-page NPS + long-text form matching the
	 * shape the plugin's own template produces.
	 */
	async createSurvey(overrides: Record<string, unknown> = {}): Promise<Survey> {
		const res = await this.raw('POST', 'surveys', {
			title: `TGQA fixture ${Date.now()}`,
			form_schema: {
				version: '1',
				sections: [
					{
						id: 'tgqa-s1',
						title: 'Page 1',
						fields: [
							{
								id: 'tgqa-nps',
								type: 'nps',
								label: 'How likely are you to recommend us?',
								required: true,
								settings: [],
							},
							{
								id: 'tgqa-why',
								type: 'long_text',
								label: 'What is the main reason for your score?',
								required: false,
								settings: { placeholder: 'Share your thoughts…' },
							},
						],
					},
				],
			},
			settings: {
				widget: { enabled: true, position: 'bottom-right' },
				targetPages: 'all',
			},
			styling: { brand_color: '#6366F1' },
			...overrides,
		});
		if (res.status() !== 201) {
			throw new Error(`createSurvey -> ${res.status()} ${await res.text()}`);
		}
		const json = (await res.json()) as Envelope<Survey | { survey: Survey }>;
		const data = json.data as Survey & { survey?: Survey };
		return data.survey ?? data;
	}

	async publish(id: number) {
		return this.raw('POST', `surveys/${id}/publish`);
	}

	async trash(id: number) {
		return this.raw('DELETE', `surveys/${id}/trash`);
	}

	async deletePermanently(id: number) {
		return this.raw('DELETE', `surveys/${id}/delete`);
	}

	/** Trash-then-delete, tolerating a survey that is already gone. */
	async destroy(id: number): Promise<void> {
		const survey = await this.raw('GET', `surveys/${id}`);
		if (survey.status() === 404) return;
		await this.trash(id);
		await this.deletePermanently(id);
	}
}
