import { EXTENSION_FILTERS } from '@/shared/extensions';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';
import type { FormField, FormSection } from './types';

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
	/**
	 * Feature id saved in `form_schema.requires` when a field uses this extension.
	 * If the add-on is later inactive, free takes the form offline instead of
	 * silently ignoring the feature.
	 */
	feature?: string;
	/** Whether the field uses this extension's feature. */
	isUsedBy?: (field: FormField) => boolean;
}

export const getFieldExtensions = (): FieldExtension[] => {
	const list = applyFilters(EXTENSION_FILTERS.fieldExtensions, []);
	return Array.isArray(list) ? (list as FieldExtension[]) : [];
};

/**
 * Add-on features the form uses, for `form_schema.requires`.
 *
 * Features whose add-on isn't loaded are kept from the last save while any
 * field still carries add-on settings, so saving without the add-on can't
 * quietly bring a form back online with its features ignored.
 */
export const computeRequiredFeatures = (
	sections: FormSection[],
	previous: string[],
): string[] => {
	const extensions = getFieldExtensions().filter((ext) => ext.feature);
	const provided = new Set(extensions.map((ext) => ext.feature as string));
	const fields = sections.flatMap((s) => s.fields);
	const used = extensions
		.filter((ext) => fields.some((f) => ext.isUsedBy?.(f)))
		.map((ext) => ext.feature as string);
	const hasAddonSettings = fields.some(
		(f) => f.settings && Object.keys(f.settings).length > 0,
	);
	const kept = hasAddonSettings
		? previous.filter((feature) => !provided.has(feature))
		: [];
	return [...new Set([...kept, ...used])];
};
