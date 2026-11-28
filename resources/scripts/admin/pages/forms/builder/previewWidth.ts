/** localStorage key for the builder's preview pane width, in px. */
export const PREVIEW_WIDTH_KEY = 'allfeedback_preview_width_v2';

/**
 * Starting width of the preview pane: the saved width, or 40% of the space
 * beside the WP admin menu. Shared by the builder and its loading skeleton so
 * the layout does not jump when the builder finishes loading.
 */
export const getInitialPreviewWidth = (): number => {
	const saved = parseInt(localStorage.getItem(PREVIEW_WIDTH_KEY) ?? '', 10);
	if (!isNaN(saved) && saved >= 280) {
		return Math.min(saved, Math.round(window.innerWidth * 0.72));
	}
	const adminMenu = document.getElementById('adminmenuwrap')?.offsetWidth ?? 0;
	return Math.max(280, Math.round((window.innerWidth - adminMenu) * 0.4));
};
