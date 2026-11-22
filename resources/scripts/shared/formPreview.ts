/**
 * Survey form preview — shared HTML-string renderer.
 *
 * This is the SINGLE SOURCE OF TRUTH for how a survey form looks.
 * It is used by the Gutenberg block editor React component to generate
 * a static, read-only preview that is pixel-perfect identical to the
 * live frontend widget output.
 *
 * HTML structure and allfb-* CSS classes must stay in sync with
 * buildForm() / buildField() in resources/scripts/frontend/index.ts.
 * Both files live side-by-side in this repo, but they serve different
 * purposes: this one generates HTML strings (for dangerouslySetInnerHTML);
 * buildForm() generates interactive DOM nodes with event listeners.
 *
 * @see resources/scripts/frontend/index.ts – buildForm / buildField
 * @see resources/scripts/block/index.tsx   – consumes surveyPreviewHtml()
 */

// ---------------------------------------------------------------------------
// Types (mirror frontend SurveyField / FormSection / Survey)
// ---------------------------------------------------------------------------

export interface PreviewField {
	id:              string;
	type:            'short_text' | 'long_text' | 'email' | 'radio' | 'checkboxes' | 'star_rating' | 'scale' | 'nps';
	label:           string;
	required:        boolean;
	placeholder?:    string;
	options?:        string[];
	starScale?:      'star' | 'number';
	starRange?:      5 | 10;
	scaleMin?:       number;
	scaleMax?:       number;
	scaleLowLabel?:  string;
	scaleHighLabel?: string;
}

export interface PreviewSection {
	id:     string;
	title:  string;
	fields: PreviewField[];
}

export interface PreviewSurvey {
	id:          number;
	title:       string;
	form_schema: { version: string; sections: PreviewSection[] } | PreviewField[] | null;
	settings: {
		// camelCase (in-memory form state)
		submitLabel?:         string;
		nextLabel?:           string;
		thankYouTitle?:       string;
		thankYouDescription?: string;
		// snake_case (DB / REST API)
		submit_label?:        string;
		next_label?:          string;
	} | null;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

const STAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;

/** Minimal HTML-attribute escaping for interpolated values. */
function esc( s: string ): string {
	return ( s ?? '' )
		.replace( /&/g, '&amp;' )
		.replace( /</g, '&lt;' )
		.replace( />/g, '&gt;' )
		.replace( /"/g, '&quot;' );
}

/** Strip single <p>…</p> wrapper that TipTap adds to label HTML. */
function normalizeLabel( html: string ): string {
	const t = ( html ?? '' ).trim();
	if ( t.startsWith( '<p>' ) && t.endsWith( '</p>' ) && t.indexOf( '<p>', 1 ) === -1 ) {
		return t.slice( 3, -4 );
	}
	return t;
}

function extractSections( survey: PreviewSurvey ): PreviewSection[] {
	const schema = survey.form_schema as any;
	if ( ! schema ) return [];
	const raw: PreviewSection[] = Array.isArray( schema )
		? [ { id: 'default', title: '', fields: schema } ]
		: ( schema?.sections ?? [] );
	return raw.filter( ( s ) => s.fields?.length > 0 );
}

function inputHtml( field: PreviewField ): string {
	switch ( field.type ) {

		case 'short_text':
			return `<input class="allfb-input" type="text" placeholder="${ esc( field.placeholder ?? '' ) }" readonly tabindex="-1">`;

		case 'email':
			return `<input class="allfb-input" type="email" placeholder="${ esc( field.placeholder ?? '' ) }" readonly tabindex="-1">`;

		case 'long_text':
			return `<textarea class="allfb-textarea" placeholder="${ esc( field.placeholder ?? '' ) }" rows="3" readonly tabindex="-1"></textarea>`;

		case 'radio':
		case 'checkboxes': {
			const spanClass = field.type === 'radio' ? 'allfb-option__radio' : 'allfb-option__checkbox';
			const opts = ( field.options ?? [] ).map( ( opt, i ) =>
				`<label class="allfb-option" style="pointer-events:none">` +
				`<span class="${ spanClass }"></span>` +
				`<span class="allfb-option__text">${ esc( opt || `Option ${ i + 1 }` ) }</span>` +
				`</label>`
			).join( '' );
			return `<div class="allfb-options">${ opts }</div>`;
		}

		case 'star_rating': {
			const range = field.starRange ?? 5;
			const isNum = field.starScale === 'number';
			const stars = Array.from( { length: range }, ( _, i ) => i + 1 ).map( ( n ) => {
				const cls = 'allfb-star' + ( isNum ? ' allfb-star--number' : '' );
				return `<span class="${ cls }">${ isNum ? String( n ) : STAR_SVG }</span>`;
			} ).join( '' );
			return `<div class="allfb-stars" style="pointer-events:none">${ stars }</div>`;
		}

		case 'scale': {
			const min    = field.scaleMin ?? 0;
			const max    = field.scaleMax ?? 10;
			const btns   = Array.from( { length: max - min + 1 }, ( _, i ) => min + i )
				.map( ( n ) => `<span class="allfb-scale__btn">${ n }</span>` ).join( '' );
			const labels = ( field.scaleLowLabel || field.scaleHighLabel )
				? `<div class="allfb-scale__labels">` +
				  `<span>${ esc( field.scaleLowLabel ?? '' ) }</span>` +
				  `<span class="allfb-scale__label--high">${ esc( field.scaleHighLabel ?? '' ) }</span>` +
				  `</div>`
				: '';
			return `<div class="allfb-scale" style="pointer-events:none">` +
				`<div class="allfb-scale__btns">${ btns }</div>${ labels }</div>`;
		}

		case 'nps': {
			const btns = Array.from( { length: 11 }, ( _, i ) => i ).map( ( n ) => {
				const s = n <= 6 ? 'detractor' : n <= 8 ? 'passive' : 'promoter';
				return `<span class="allfb-scale__btn allfb-scale__btn--nps allfb-scale__btn--${ s }">${ n }</span>`;
			} ).join( '' );
			return `<div class="allfb-scale allfb-scale--nps" style="pointer-events:none">` +
				`<div class="allfb-scale__btns">${ btns }</div>` +
				`<div class="allfb-scale__labels">` +
				`<span>Not at all likely</span>` +
				`<span class="allfb-scale__label--high">Extremely likely</span>` +
				`</div></div>`;
		}

		default:
			return '';
	}
}

function fieldHtml( field: PreviewField ): string {
	const label    = normalizeLabel( field.label || '' );
	const labelHtml = ( label || '<span style="opacity:0.4">Untitled</span>' )
		+ ( field.required ? ' <span class="allfb-field__required"> *</span>' : '' );

	return `<div class="allfb-field">` +
		`<div class="allfb-field__label">${ labelHtml }</div>` +
		inputHtml( field ) +
		`</div>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a static HTML snapshot of the survey as it appears on step 1.
 *
 * The output is intentionally read-only (pointer-events disabled on
 * interactive elements) — the block editor canvas is for preview only.
 *
 * Accent colour is applied as an inline CSS custom property so the preview
 * respects whatever colour the site owner configured in plugin settings.
 *
 * @param survey  Survey object from the REST API.
 * @param color   Accent colour hex string (injected by PHP via __ALLFB_BLOCK__).
 * @returns       HTML string safe to use with dangerouslySetInnerHTML.
 */
export function surveyPreviewHtml( survey: PreviewSurvey, color = '#6366f1' ): string {
	const sections = extractSections( survey );

	if ( sections.length === 0 ) {
		return `<div class="allfb-embed" style="--allfb-color:${ esc( color ) }">` +
			`<p class="allfb-panel__placeholder">This survey has no questions yet.</p>` +
			`</div>`;
	}

	const totalSteps  = sections.length;
	const isMultiStep = totalSteps > 1;
	const stepFields  = sections[ 0 ].fields;
	const ss          = survey.settings ?? {};
	const btnLabel    = isMultiStep
		? ( ss.nextLabel   || ss.next_label   || 'Next'   )
		: ( ss.submitLabel || ss.submit_label || 'Submit' );

	// Step indicator — mirrors buildForm()'s stepEl rendering.
	const stepsHtml = isMultiStep
		? `<div class="allfb-steps">` +
		  `<div class="allfb-steps__dots">` +
		  Array.from( { length: totalSteps }, ( _, i ) =>
		  	`<span class="allfb-steps__dot${ i === 0 ? ' is-active' : '' }"></span>`
		  ).join( '' ) +
		  `</div>` +
		  `<span class="allfb-steps__count">1 / ${ totalSteps }</span>` +
		  `</div>`
		: '';

	return `<div class="allfb-embed" style="--allfb-color:${ esc( color ) }">` +
		`<div class="allfb-form-wrapper">` +
		stepsHtml +
		`<div class="allfb-form__fields">${ stepFields.map( fieldHtml ).join( '' ) }</div>` +
		`<div class="allfb-form__footer">` +
		`<span class="allfb-btn allfb-btn--primary" style="pointer-events:none">${ esc( btnLabel ) }</span>` +
		`</div>` +
		`</div>` +
		`</div>`;
}
