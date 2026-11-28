import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}

export function htmlToText(html: string): string {
	const div = document.createElement('div');
	div.innerHTML = html;
	// textContent includes <style>/<script> bodies, which would surface raw CSS/JS as label text.
	div.querySelectorAll('style, script, template').forEach((el) => el.remove());
	return div.textContent ?? div.innerText ?? '';
}

export function deepMerge(
	target: Record<string, unknown>,
	...sources: Record<string, unknown>[]
): Record<string, unknown> {
	const result = { ...target };
	for (const source of sources) {
		for (const [k, v] of Object.entries(source)) {
			if (
				v !== null &&
				typeof v === 'object' &&
				!Array.isArray(v) &&
				result[k] !== null &&
				typeof result[k] === 'object' &&
				!Array.isArray(result[k])
			) {
				result[k] = deepMerge(
					result[k] as Record<string, unknown>,
					v as Record<string, unknown>,
				);
			} else {
				result[k] = v;
			}
		}
	}
	return result;
}
