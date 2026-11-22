/**
 * Extension points for add-ons such as AllFeedback Pro.
 *
 * Add-ons hook in with `wp.hooks.addFilter()` from a script that loads before
 * free's own (see the `allfeedback_*_script_dependencies` PHP filters).
 * Treat these filter names and payloads as a public API.
 */
import { applyFilters } from '@wordpress/hooks';

export const EXTENSION_FILTERS = {
	/** ( sections, answers ) => sections — remove fields/pages that should not be shown. */
	visibleSections: 'allfeedback.form.visibleSections',
	/** ( extensions ) => extensions — add panels and badges to each field in the builder. */
	fieldExtensions: 'allfeedback.builder.fieldExtensions',
	/** ( sections ) => sections — add sections to the bottom of Settings → Advanced. */
	advancedSettingsSections: 'allfeedback.settings.advancedSections',
} as const;

type Answers = Record<string, string | string[] | undefined>;

/**
 * Sections the respondent should see for the current answers.
 * Used by the live widget and the builder preview.
 */
export function filterVisibleSections<S>( sections: S[], answers: Answers ): S[] {
	const filtered = applyFilters( EXTENSION_FILTERS.visibleSections, sections, answers );
	return Array.isArray( filtered ) ? ( filtered as S[] ) : sections;
}
