/**
 * Resolve the site under test and its admin credentials.
 *
 * Order: real environment variables first (CI sets them from secrets), then
 * .themegrill-qa/.env.local (a developer's machine). The file is gitignored and
 * the values are never logged.
 */
import fs from 'node:fs';
import path from 'node:path';

const ENV_FILE = path.resolve(__dirname, '../../../.themegrill-qa/.env.local');

function fromFile(): Record<string, string> {
	if (!fs.existsSync(ENV_FILE)) return {};
	return Object.fromEntries(
		fs
			.readFileSync(ENV_FILE, 'utf8')
			.split('\n')
			.filter((line) => line.includes('=') && !line.trimStart().startsWith('#'))
			.map((line) => {
				const i = line.indexOf('=');
				return [
					line.slice(0, i).trim(),
					line
						.slice(i + 1)
						.trim()
						.replace(/^["']|["']$/g, ''),
				];
			}),
	);
}

const file = fromFile();

/**
 * Each value has two accepted names. `.themegrill-qa/suite.json` declares the
 * `ALLFEEDBACK_*` names, which is what the claudegrill runner and CI inject;
 * `.env.local` on a developer's machine uses the `TGQA_*` names. Reading both
 * means the suite runs identically either way.
 */
function required(names: [string, string]): string {
	for (const name of names) {
		const value = process.env[name] ?? file[name];
		if (value) return value;
	}
	throw new Error(
		`none of ${names.join(' / ')} is set. Add one to .themegrill-qa/.env.local or the environment.`,
	);
}

export const baseURL = required([
	'ALLFEEDBACK_BASE_URL',
	'TGQA_BASE_URL',
]).replace(/\/$/, '');
export const adminUser = required([
	'ALLFEEDBACK_ADMIN_USER',
	'TGQA_ADMIN_USER',
]);
export const adminPass = required([
	'ALLFEEDBACK_ADMIN_PASS',
	'TGQA_ADMIN_PASS',
]);

/** Where auth.setup.ts parks the logged-in storage state. */
export const STORAGE_STATE = 'test-results/.auth/admin.json';

/** The plugin's REST namespace. */
export const REST = '/wp-json/allfeedback/v1';

/** The admin SPA lives on one page; every screen is a hash route into it. */
export const ADMIN_PAGE = '/wp-admin/admin.php?page=allfeedback';
