import type { ConditionRule } from '@/shared/conditions';
import type { FormSection, NormalizedSettings, SurveyField, SurveySettings } from './types';

export async function trackEvent(
	restUrl:   string,
	nonce:     string,
	surveyId:  number,
	event:     'viewed' | 'started' | 'abandoned' | 'heartbeat',
	sessionId: string,
	guestId?:  string,
): Promise<void> {
	await fetch( `${ restUrl }surveys/${ surveyId }/analytics/event`, {
		method:  'POST',
		headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
		body:    JSON.stringify( { event, session_id: sessionId, ...( guestId ? { guest_id: guestId } : {} ) } ),
	} ).catch( () => {} ); // analytics must never break the widget
}

export function normalizeSettings( raw: SurveySettings | null | undefined ): NormalizedSettings {
	const s = raw ?? {};
	return {
		submitLabel:         ( s.submitLabel         || s.submit_label         || '' ) || 'Submit',
		nextLabel:           ( s.nextLabel           || s.next_label           || '' ) || 'Next',
		backLabel:           ( s.backLabel           || s.back_label           || '' ) || 'Back',
		thankYouEnabled:     s.thankYouEnabled     ?? false,
		thankYouTitle:       s.thankYouTitle       || 'Thank you!',
		thankYouDescription: s.thankYouDescription || 'Your response has been recorded.',
		progressIndicator:   s.progressIndicator   ?? 'dots',
		triggerIcon:         s.triggerIcon         ?? 'message',
	};
}

export function normalizeLabel( html: string ): string {
	const t = html.trim();
	if ( t.startsWith( '<p>' ) && t.endsWith( '</p>' ) && t.indexOf( '<p>', 1 ) === -1 ) {
		return t.slice( 3, -4 );
	}
	return t;
}

export function activeSections( sections: FormSection[] ): FormSection[] {
	return sections.filter( ( s ) => s.fields.length > 0 );
}

function normalizeField( raw: unknown ): SurveyField {
	const f        = raw as Record<string, unknown>;
	const settings = ( ( f.settings as Record<string, unknown> ) ?? {} );
	return {
		...( f as object ),
		...( settings.options        !== undefined && { options:        settings.options        as string[] } ),
		...( settings.placeholder    !== undefined && { placeholder:    settings.placeholder    as string } ),
		...( settings.starScale      !== undefined && { starScale:      settings.starScale      as 'star' | 'number' } ),
		...( settings.starRange      !== undefined && { starRange:      settings.starRange      as 5 | 10 } ),
		...( settings.scaleMin       !== undefined && { scaleMin:       settings.scaleMin       as number } ),
		...( settings.scaleMax       !== undefined && { scaleMax:       settings.scaleMax       as number } ),
		...( settings.scaleLowLabel  !== undefined && { scaleLowLabel:  settings.scaleLowLabel  as string } ),
		...( settings.scaleHighLabel !== undefined && { scaleHighLabel: settings.scaleHighLabel as string } ),
		...( settings.condition      !== undefined && { condition:      settings.condition      as ConditionRule } ),
	} as SurveyField;
}

export function parseSections( rawSchema: unknown ): FormSection[] {
	if ( Array.isArray( rawSchema ) ) {
		return [ { id: 'default', title: '', fields: rawSchema.map( normalizeField ) } ];
	}
	const schema = rawSchema as { sections?: Array<{ id: string; title: string; fields?: unknown[] }> } | null;
	return ( schema?.sections ?? [] ).map( ( s ) => ( {
		id:     s.id,
		title:  s.title,
		fields: ( s.fields ?? [] ).map( normalizeField ),
	} ) );
}
