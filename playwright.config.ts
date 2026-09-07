/**
 * Playwright configuration for the AllFeedback e2e suite.
 *
 * Credentials come from .themegrill-qa/.env.local (gitignored) or the
 * environment, so nothing secret lives in this file. See tests/e2e/support/env.ts.
 *
 * Chromium only — the claudegrill runner targets it and the other browsers are a
 * slow download nobody uses.
 */
import { defineConfig, devices } from '@playwright/test';
import { baseURL } from './tests/e2e/support/env';

export default defineConfig({
	testDir: './tests/e2e/specs',
	testMatch: '**/*.spec.ts',
	outputDir: './test-results/artifacts',

	fullyParallel: false, // the suite mutates one shared WordPress install
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	timeout: 60_000,
	expect: { timeout: 15_000 },

	reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],

	use: {
		baseURL,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'off',
		actionTimeout: 15_000,
		navigationTimeout: 30_000,
	},

	projects: [
		{
			name: 'setup',
			testDir: './tests/e2e/support',
			testMatch: /auth\.setup\.ts/,
		},
		{
			name: 'chromium',
			dependencies: ['setup'],
			use: {
				...devices['Desktop Chrome'],
				storageState: 'test-results/.auth/admin.json',
			},
		},
	],
});
