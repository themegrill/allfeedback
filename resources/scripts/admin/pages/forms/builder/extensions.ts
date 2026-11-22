import { EXTENSION_FILTERS } from '@/shared/extensions';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';
import type { FormField } from './types';

export interface FieldExtensionProps {
	field: FormField;
	/** Every field that comes before this one, across all pages. */
	precedingFields: FormField[];
	/** Every field in the form, in order. */
	allFields: FormField[];
	onChange: (field: FormField) => void;
}

export interface FieldExtension {
	name: string;
	/** Rendered at the bottom of the field's expanded settings. */
	Panel?: ComponentType<FieldExtensionProps>;
	/** Rendered in the field header, before the Required toggle. */
	HeaderBadge?: ComponentType<FieldExtensionProps>;
	/** 'warning' outlines the field card in amber. */
	getStatus?: (props: FieldExtensionProps) => 'warning' | undefined;
}

export const getFieldExtensions = (): FieldExtension[] => {
	const list = applyFilters(EXTENSION_FILTERS.fieldExtensions, []);
	return Array.isArray(list) ? (list as FieldExtension[]) : [];
};
