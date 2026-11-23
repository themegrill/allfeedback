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

type SectionLike = {
	id: string;
	fields: { id: string; settings?: Record< string, unknown > }[];
};

/**
 * Whether answering the current page could still reveal later pages: a hidden
 * later question has a show condition (`settings.condition`, saved by add-ons)
 * that points at a question on this page that is still unanswered. While true,
 * the page shows "Next" instead of "Submit".
 */
export function mayRevealLaterPages(
	allSections: SectionLike[],
	visible: SectionLike[],
	currentId: string | undefined,
	answers: Answers,
): boolean {
	const current = visible.find( ( s ) => s.id === currentId );
	const start = allSections.findIndex( ( s ) => s.id === currentId );
	if ( ! current || start < 0 ) {
		return false;
	}

	const unanswered = current.fields
		.filter( ( f ) => {
			const v = answers[ f.id ];
			return Array.isArray( v ) ? v.length === 0 : ! v?.trim();
		} )
		.map( ( f ) => f.id );
	if ( unanswered.length === 0 ) {
		return false;
	}

	const visibleIds = new Set( visible.flatMap( ( s ) => s.fields.map( ( f ) => f.id ) ) );
	return allSections.slice( start + 1 ).some( ( s ) =>
		s.fields.some( ( f ) => {
			if ( visibleIds.has( f.id ) || ! f.settings?.condition ) {
				return false;
			}
			const condition = JSON.stringify( f.settings.condition );
			return unanswered.some( ( id ) => condition.includes( `"fieldId":${ JSON.stringify( id ) }` ) );
		} )
	);
}
