import { useEffect, useRef, useState } from 'react';

export interface SharedField {
	id:              string;
	type:            string;
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

interface FieldPreviewProps {
	field:       SharedField;
	value:       string | string[];
	error:       string;
	onChange:    ( value: string | string[] ) => void;
	focusFirst?: boolean;
}

const normalizeLabel = ( html: string ): string => {
	const t = html.trim();
	if ( t.startsWith( '<p>' ) && t.endsWith( '</p>' ) && t.indexOf( '<p>', 1 ) === -1 ) {
		return t.slice( 3, -4 );
	}
	return t;
};

const StarSvg = () => (
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
		<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
	</svg>
);

const StarRatingField = ( { field, value, onChange }: { field: SharedField; value: string; onChange: ( v: string ) => void } ) => {
	const [ hovered, setHovered ] = useState( 0 );
	const scale    = field.starScale ?? 'star';
	const range    = field.starRange ?? 5;
	const selected = Number( value ) || 0;
	const active   = hovered || selected;

	return (
		<div className="allfb-stars" onMouseLeave={ () => setHovered( 0 ) }>
			{ Array.from( { length: range }, ( _, i ) => i + 1 ).map( ( n ) => (
				<button
					key={ n }
					type="button"
					onMouseEnter={ () => setHovered( n ) }
					onClick={ () => onChange( String( selected === n ? 0 : n ) ) }
					className={ `allfb-star${ n <= active ? ' is-active' : '' }${ scale === 'number' ? ' allfb-star--number' : '' }` }
					aria-label={ `${ n } star${ n !== 1 ? 's' : '' }` }
				>
					{ scale === 'number' ? String( n ) : <StarSvg /> }
				</button>
			) ) }
		</div>
	);
};

const ScaleField = ( { field, value, onChange }: { field: SharedField; value: string; onChange: ( v: string ) => void } ) => {
	const [ hovered, setHovered ] = useState<number | null>( null );
	const min      = field.scaleMin ?? 0;
	const max      = field.scaleMax ?? 10;
	const selected = value !== '' ? Number( value ) : null;
	const active   = hovered ?? selected;
	const points   = Array.from( { length: max - min + 1 }, ( _, i ) => min + i );

	return (
		<div className="allfb-scale" onMouseLeave={ () => setHovered( null ) }>
			<div className="allfb-scale__btns">
				{ points.map( ( n ) => (
					<button
						key={ n }
						type="button"
						onMouseEnter={ () => setHovered( n ) }
						onClick={ () => onChange( selected === n ? '' : String( n ) ) }
						className={ `allfb-scale__btn${ active !== null && n <= active ? ' is-active' : '' }` }
					>
						{ String( n ) }
					</button>
				) ) }
			</div>
			{ ( field.scaleLowLabel || field.scaleHighLabel ) && (
				<div className="allfb-scale__labels">
					{ field.scaleLowLabel  && <span>{ field.scaleLowLabel }</span> }
					{ field.scaleHighLabel && <span className="allfb-scale__label--high">{ field.scaleHighLabel }</span> }
				</div>
			) }
		</div>
	);
};

const NpsField = ( { value, onChange }: { value: string; onChange: ( v: string ) => void } ) => {
	const [ hovered, setHovered ] = useState<number | null>( null );
	const selected = value !== '' ? Number( value ) : null;

	const sentimentClass = ( n: number ) => {
		if ( n <= 6 ) return 'allfb-scale__btn--detractor';
		if ( n <= 8 ) return 'allfb-scale__btn--passive';
		return 'allfb-scale__btn--promoter';
	};

	return (
		<div className="allfb-scale allfb-scale--nps" onMouseLeave={ () => setHovered( null ) }>
			<div className="allfb-scale__btns">
				{ Array.from( { length: 11 }, ( _, i ) => i ).map( ( n ) => (
					<button
						key={ n }
						type="button"
						onMouseEnter={ () => setHovered( n ) }
						onClick={ () => onChange( selected === n ? '' : String( n ) ) }
						className={ `allfb-scale__btn allfb-scale__btn--nps ${ sentimentClass( n ) }${ ( hovered ?? selected ) === n ? ' is-active' : '' }` }
					>
						{ String( n ) }
					</button>
				) ) }
			</div>
			<div className="allfb-scale__labels">
				<span>Not at all likely</span>
				<span className="allfb-scale__label--high">Extremely likely</span>
			</div>
		</div>
	);
};

export const FieldPreview = ( { field, value, error, onChange, focusFirst = false }: FieldPreviewProps ) => {
	const inputRef    = useRef<HTMLInputElement>( null );
	const textareaRef = useRef<HTMLTextAreaElement>( null );

	useEffect( () => {
		if ( ! focusFirst || ! error ) return;
		inputRef.current?.focus();
		textareaRef.current?.focus();
	}, [ error, focusFirst ] );

	const labelHtml = field.label?.trim()
		? normalizeLabel( field.label )
		: '<span style="opacity:0.4">Untitled</span>';

	const strVal = typeof value === 'string' ? value : '';
	const arrVal = Array.isArray( value ) ? value : [];

	const toggleCheckbox = ( opt: string ) => {
		const next = arrVal.includes( opt )
			? arrVal.filter( ( v ) => v !== opt )
			: [ ...arrVal, opt ];
		onChange( next );
	};

	return (
		<div className="allfb-field">
			<div className="allfb-field__label">
				<span dangerouslySetInnerHTML={ { __html: labelHtml } } />
				{ field.required && <span className="allfb-field__required"> *</span> }
			</div>

			{ field.type === 'short_text' && (
				<input
					ref={ inputRef }
					type="text"
					className={ `allfb-input${ error ? ' is-error' : '' }` }
					placeholder={ field.placeholder ?? '' }
					value={ strVal }
					onChange={ ( e ) => onChange( e.target.value ) }
				/>
			) }

			{ field.type === 'email' && (
				<input
					ref={ inputRef }
					type="email"
					inputMode="email"
					autoComplete="email"
					className={ `allfb-input${ error ? ' is-error' : '' }` }
					placeholder={ field.placeholder ?? '' }
					value={ strVal }
					onChange={ ( e ) => onChange( e.target.value ) }
				/>
			) }

			{ field.type === 'long_text' && (
				<textarea
					ref={ textareaRef }
					className={ `allfb-textarea${ error ? ' is-error' : '' }` }
					placeholder={ field.placeholder ?? '' }
					rows={ 3 }
					value={ strVal }
					onChange={ ( e ) => onChange( e.target.value ) }
				/>
			) }

			{ field.type === 'radio' && (
				<div className="allfb-options">
					{ ( field.options ?? [] ).map( ( opt, i ) => (
						<label key={ i } className="allfb-option">
							<span className={ `allfb-option__radio${ strVal === opt ? ' is-checked' : '' }` } />
							<input
								type="radio"
								name={ field.id }
								value={ opt }
								checked={ strVal === opt }
								onChange={ () => onChange( opt ) }
								className="sr-only"
							/>
							<span className="allfb-option__text">{ opt || `Option ${ i + 1 }` }</span>
						</label>
					) ) }
				</div>
			) }

			{ field.type === 'checkboxes' && (
				<div className="allfb-options">
					{ ( field.options ?? [] ).map( ( opt, i ) => (
						<label key={ i } className="allfb-option">
							<span className={ `allfb-option__checkbox${ arrVal.includes( opt ) ? ' is-checked' : '' }` } />
							<input
								type="checkbox"
								value={ opt }
								checked={ arrVal.includes( opt ) }
								onChange={ () => toggleCheckbox( opt ) }
								className="sr-only"
							/>
							<span className="allfb-option__text">{ opt || `Option ${ i + 1 }` }</span>
						</label>
					) ) }
				</div>
			) }

			{ field.type === 'star_rating' && (
				<StarRatingField field={ field } value={ strVal } onChange={ onChange } />
			) }

			{ field.type === 'scale' && (
				<ScaleField field={ field } value={ strVal } onChange={ onChange } />
			) }

			{ field.type === 'nps' && (
				<NpsField value={ strVal } onChange={ onChange } />
			) }

			{ ! [ 'short_text', 'long_text', 'email', 'radio', 'checkboxes', 'star_rating', 'scale', 'nps' ].includes( field.type ) && (
				<input
					type="text"
					className="allfb-input"
					value={ strVal }
					onChange={ ( e ) => onChange( e.target.value ) }
				/>
			) }

			{ error && <p className="allfb-field__error">{ error }</p> }
		</div>
	);
};
