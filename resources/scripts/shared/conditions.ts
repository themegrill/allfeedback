/**
 * Conditional logic — shared by the live widget and the builder preview.
 *
 * A condition targets a question that comes before the field. If that question
 * is deleted or moved below the field, or the selected answer no longer exists,
 * the condition is "broken" and the field stays hidden until the admin fixes it.
 */

export type ConditionOperator = 'is' | 'is_not' | 'greater_than' | 'less_than';

export interface ConditionRule {
	enabled:   boolean;
	fieldId:   string;
	operator?: ConditionOperator;
	value:     string;
}

interface ConditionalField {
	id:         string;
	type:       string;
	condition?: ConditionRule;
	options?:   string[];
	starRange?: number;
	scaleMin?:  number;
	scaleMax?:  number;
}

interface ConditionalSection<F extends ConditionalField> {
	id:     string;
	fields: F[];
}

type Answers = Record<string, string | string[] | undefined>;

export const NUMERIC_FIELD_TYPES = [ 'star_rating', 'scale', 'nps' ];

/**
 * Whether the condition is switched on and points at a question that comes before the field.
 */
export function isConditionActive( rule: ConditionRule | undefined, precedingIds: string[] ): rule is ConditionRule {
	return !! rule?.enabled && rule.fieldId !== '' && rule.value !== '' && precedingIds.includes( rule.fieldId );
}

/**
 * Answers the target question can give, or null when any text is allowed.
 */
export function getAnswerOptions( source: ConditionalField ): string[] | null {
	const range = ( min: number, max: number ) =>
		Array.from( { length: Math.max( 0, max - min + 1 ) }, ( _, i ) => String( min + i ) );
	switch ( source.type ) {
		case 'star_rating': return range( 1, source.starRange ?? 5 );
		case 'scale':       return range( source.scaleMin ?? 0, source.scaleMax ?? 10 );
		case 'nps':         return range( 0, 10 );
		case 'radio':
		case 'checkboxes':  return ( source.options ?? [] ).filter( ( o ) => o.trim() !== '' );
		default:            return null;
	}
}

/**
 * Whether the selected answer no longer exists on the target question.
 */
export function isAnswerBroken( rule: ConditionRule | undefined, source: ConditionalField | undefined ): boolean {
	if ( ! rule?.enabled || ! source || rule.value === '' ) return false;
	const options = getAnswerOptions( source );
	return options !== null && ! options.includes( rule.value );
}

/**
 * Whether the condition is switched on but its target question is missing, comes after the field,
 * or its selected answer no longer exists.
 */
export function isConditionBroken( rule: ConditionRule | undefined, preceding: ConditionalField[] ): boolean {
	if ( ! rule?.enabled || rule.fieldId === '' ) return false;
	const source = preceding.find( ( f ) => f.id === rule.fieldId );
	return ! source || isAnswerBroken( rule, source );
}

function matches( rule: ConditionRule, sourceType: string, answer: string | string[] | undefined ): boolean {
	const operator = rule.operator ?? 'is';

	if ( Array.isArray( answer ) ) {
		if ( answer.length === 0 ) return false;
		const has = answer.includes( rule.value );
		return operator === 'is_not' ? ! has : has;
	}

	const raw = ( answer ?? '' ).trim();
	if ( raw === '' ) return false;

	if ( NUMERIC_FIELD_TYPES.includes( sourceType ) ) {
		const a = Number( raw );
		const b = Number( rule.value );
		if ( Number.isNaN( a ) || Number.isNaN( b ) ) return false;
		switch ( operator ) {
			case 'is_not':       return a !== b;
			case 'greater_than': return a > b;
			case 'less_than':    return a < b;
			default:             return a === b;
		}
	}

	const equal = raw.toLowerCase() === rule.value.trim().toLowerCase();
	return operator === 'is_not' ? ! equal : equal;
}

/**
 * Ids of every field that should be shown for the given answers.
 * A field whose target question is itself hidden is hidden too.
 */
export function getVisibleFieldIds<F extends ConditionalField>(
	sections: ConditionalSection<F>[],
	answers:  Answers,
): Set<string> {
	const visible = new Set<string>();
	const seen: F[] = [];

	sections.forEach( ( section ) => section.fields.forEach( ( field ) => {
		const rule = field.condition;
		const seenIds = seen.map( ( f ) => f.id );
		if ( isConditionBroken( rule, seen ) ) {
			// Target or answer deleted, or target moved below: keep hidden until the admin fixes it.
		} else if ( ! isConditionActive( rule, seenIds ) ) {
			visible.add( field.id );
		} else {
			const source = seen.find( ( f ) => f.id === rule.fieldId )!;
			if ( visible.has( source.id ) && matches( rule, source.type, answers[ source.id ] ) ) {
				visible.add( field.id );
			}
		}
		seen.push( field );
	} ) );

	return visible;
}

/**
 * Sections with hidden fields removed; pages left with no fields are dropped.
 */
export function visibleSections<F extends ConditionalField, S extends ConditionalSection<F>>(
	sections: S[],
	answers:  Answers,
): S[] {
	const visible = getVisibleFieldIds( sections, answers );
	return sections
		.map( ( s ) => ( { ...s, fields: s.fields.filter( ( f ) => visible.has( f.id ) ) } ) )
		.filter( ( s ) => s.fields.length > 0 );
}
