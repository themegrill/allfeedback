import type { Settings } from '@/admin/api/settings';
import { useSettingsDirty } from '@/admin/pages/settings/Settings';
import { settingsQuery } from '@/admin/queries/settings';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import UnsavedChangesBadge from '@/components/ui/unsaved-changes-badge';
import { cn } from '@/lib/utils';
import { EXTENSION_FILTERS } from '@/shared/extensions';
import { useForm, useStore } from '@tanstack/react-form';
import { useQuery } from '@tanstack/react-query';
import { applyFilters } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';
import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, type ComponentType } from 'react';

const labelCls = 'text-base font-normal text-foreground/90';

const Row = ({
	label,
	description,
	children,
}: {
	label: string;
	description?: string;
	children: React.ReactNode;
}) => (
	<div className="flex items-start gap-4">
		<div className="w-[40%] shrink-0">
			<label className={labelCls}>{label}</label>
			{description && (
				<p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground/90">
					{description}
				</p>
			)}
		</div>
		<div
			className={cn('min-w-0 flex-1', !description && 'flex items-center')}
			style={description ? { paddingTop: '2px' } : undefined}
		>
			{children}
		</div>
	</div>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
	<div className="mt-5 mb-4">
		<span className="text-sm font-semibold tracking-widest uppercase text-foreground/60">{children}</span>
	</div>
);

const Collapse = ({
	open,
	children,
}: {
	open: boolean;
	children: React.ReactNode;
}) => (
	<div
		className={cn(
			'grid transition-[grid-template-rows] duration-200 ease-in-out',
			open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
		)}
	>
		<div className="overflow-hidden">
			<div className="border-primary/20 ml-1 space-y-4 border-l-2 pt-4 pl-4">
				{children}
			</div>
		</div>
	</div>
);

/** Props free gives an add-on section so it saves with the page's Save button. */
export interface AdvancedSettingsSectionProps {
	/** Saved settings, as returned by GET /settings. */
	settings: Settings | undefined;
	/** This section's unsaved changes, or undefined when there are none. */
	patch: Record<string, unknown> | undefined;
	/** Stage changes as a partial settings object (merged into Save), or null to discard them. */
	setPatch: (patch: Record<string, unknown> | null) => void;
}

/** A section an add-on adds to the bottom of this page. */
interface AdvancedSettingsSection {
	name: string;
	title: string;
	Component: ComponentType<AdvancedSettingsSectionProps>;
}

const getExtensionSections = (): AdvancedSettingsSection[] => {
	const list = applyFilters(EXTENSION_FILTERS.advancedSettingsSections, []);
	return Array.isArray(list) ? (list as AdvancedSettingsSection[]) : [];
};

const AdvancedSettingsSkeleton = () => (
	<div>
		<div className="border-border/50 flex items-center gap-3 border-b px-6 py-4">
			<Skeleton className="size-9 rounded-xl" />
			<Skeleton className="h-5 w-24" />
		</div>

		<div className="p-5">
			<div className="space-y-4">
				<Skeleton className="h-2.5 w-20" />
				<div className="flex items-start gap-4">
					<div className="w-[40%] shrink-0 space-y-1.5">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-3 w-4/5" />
					</div>
					<Skeleton className="mt-0.5 h-5 w-9 rounded-full" />
				</div>
			</div>

			<div className="border-border/50 my-6 border-t" />

			<div className="space-y-4">
				<Skeleton className="h-2.5 w-14" />
				<div className="flex items-center gap-4">
					<Skeleton className="h-4 w-[40%] shrink-0" />
					<Skeleton className="h-5 w-9 rounded-full" />
				</div>
			</div>

			<div className="border-border/50 my-6 border-t" />

			<div className="space-y-4">
				<Skeleton className="h-2.5 w-28" />
				<div className="flex items-center gap-4">
					<Skeleton className="h-4 w-[40%] shrink-0" />
					<Skeleton className="h-5 w-9 rounded-full" />
				</div>
				<div className="flex items-center gap-4">
					<Skeleton className="h-4 w-[40%] shrink-0" />
					<Skeleton className="h-5 w-9 rounded-full" />
				</div>
			</div>
		</div>
	</div>
);

const DEFAULT_CONSENT_TEXT = 'I agree to the storage and handling of my data.';

const DEFAULT_VALUES = {
	disable_user_details: false,
	require_consent: false,
	consent_text: DEFAULT_CONSENT_TEXT,
	privacy_policy_url: '',
	logging_enabled: false,
	delete_on_uninstall: false,
};

const FORM_KEY = 'advanced';

type AdvancedPatch = {
	advanced?: {
		privacy?: Partial<Settings['advanced']['privacy']>;
		logging?: Partial<Settings['advanced']['logging']>;
		plugin?: Partial<Settings['advanced']['plugin']>;
	};
};

const AdvancedSettings = () => {
	const extensionSections = getExtensionSections();
	const { data, isPending } = useQuery(settingsQuery());
	const {
		isDirty: sharedIsDirty,
		isSaving,
		setDirty,
		patches,
		setPatch,
	} = useSettingsDirty();

	const stagedAdv = (patches[FORM_KEY] as AdvancedPatch | undefined)?.advanced;
	const initValues = stagedAdv
		? {
				disable_user_details:
					stagedAdv.privacy?.disable_user_details ??
					DEFAULT_VALUES.disable_user_details,
				require_consent:
					stagedAdv.privacy?.require_consent ?? DEFAULT_VALUES.require_consent,
				consent_text:
					stagedAdv.privacy?.consent_text ?? DEFAULT_VALUES.consent_text,
				privacy_policy_url:
					stagedAdv.privacy?.privacy_policy_url ??
					DEFAULT_VALUES.privacy_policy_url,
				logging_enabled:
					stagedAdv.logging?.enabled ?? DEFAULT_VALUES.logging_enabled,
				delete_on_uninstall:
					stagedAdv.plugin?.delete_on_uninstall ??
					DEFAULT_VALUES.delete_on_uninstall,
			}
		: data
			? {
					disable_user_details:
						data.advanced?.privacy?.disable_user_details ??
						DEFAULT_VALUES.disable_user_details,
					require_consent:
						data.advanced?.privacy?.require_consent ??
						DEFAULT_VALUES.require_consent,
					consent_text:
						data.advanced?.privacy?.consent_text ??
						DEFAULT_VALUES.consent_text,
					privacy_policy_url:
						data.advanced?.privacy?.privacy_policy_url ??
						DEFAULT_VALUES.privacy_policy_url,
					logging_enabled:
						data.advanced?.logging?.enabled ?? DEFAULT_VALUES.logging_enabled,
					delete_on_uninstall:
						data.advanced?.plugin?.delete_on_uninstall ??
						DEFAULT_VALUES.delete_on_uninstall,
				}
			: DEFAULT_VALUES;

	const form = useForm({
		defaultValues: initValues,
		onSubmit: async () => {
			// saving is handled centrally by Settings.tsx
		},
	});

	const markedDirtyRef = useRef(false);
	useEffect(() => {
		if (stagedAdv && !markedDirtyRef.current) {
			setDirty(FORM_KEY, true);
			markedDirtyRef.current = true;
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (!data || patches[FORM_KEY]) return;
		form.reset(
			{
				disable_user_details:
					data.advanced?.privacy?.disable_user_details ??
					DEFAULT_VALUES.disable_user_details,
				require_consent:
					data.advanced?.privacy?.require_consent ??
					DEFAULT_VALUES.require_consent,
				consent_text:
					data.advanced?.privacy?.consent_text ?? DEFAULT_VALUES.consent_text,
				privacy_policy_url:
					data.advanced?.privacy?.privacy_policy_url ??
					DEFAULT_VALUES.privacy_policy_url,
				logging_enabled:
					data.advanced?.logging?.enabled ?? DEFAULT_VALUES.logging_enabled,
				delete_on_uninstall:
					data.advanced?.plugin?.delete_on_uninstall ??
					DEFAULT_VALUES.delete_on_uninstall,
			},
			{ keepDefaultValues: true },
		);
	}, [data]); // eslint-disable-line react-hooks/exhaustive-deps

	const values = useStore(form.store, (s) => s.values);
	const isDirty = useStore(form.store, (s) => s.isDirty);

	useEffect(() => {
		if (!isDirty) return;
		// Skip when values still match server data (e.g. right after a save resets the form)
		const srv = data?.advanced;
		if (
			values.disable_user_details ===
				(srv?.privacy?.disable_user_details ??
					DEFAULT_VALUES.disable_user_details) &&
			values.require_consent ===
				(srv?.privacy?.require_consent ?? DEFAULT_VALUES.require_consent) &&
			values.consent_text ===
				(srv?.privacy?.consent_text ?? DEFAULT_VALUES.consent_text) &&
			values.privacy_policy_url ===
				(srv?.privacy?.privacy_policy_url ??
					DEFAULT_VALUES.privacy_policy_url) &&
			values.logging_enabled ===
				(srv?.logging?.enabled ?? DEFAULT_VALUES.logging_enabled) &&
			values.delete_on_uninstall ===
				(srv?.plugin?.delete_on_uninstall ?? DEFAULT_VALUES.delete_on_uninstall)
		)
			return;
		setDirty(FORM_KEY, true);
		setPatch(FORM_KEY, {
			advanced: {
				privacy: {
					disable_user_details: values.disable_user_details,
					require_consent: values.require_consent,
					consent_text: values.consent_text,
					privacy_policy_url: values.privacy_policy_url,
				},
				logging: { enabled: values.logging_enabled },
				plugin: { delete_on_uninstall: values.delete_on_uninstall },
			},
		} as Record<string, unknown>);
	}, [values, isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

	if (isPending) return <AdvancedSettingsSkeleton />;

	return (
		<div>
			<div className="border-border/50 flex items-center justify-between gap-3 border-b px-6 py-4">
				<div className="flex items-center gap-3">
					<div className="bg-primary/10 flex size-9 items-center justify-center rounded-xl">
						<SlidersHorizontal className="text-primary size-[18px]" />
					</div>
					<h3
						className="text-md text-foreground font-semibold"
						style={{ margin: 0 }}
					>
						{__('Advanced', 'allfeedback')}
					</h3>
				</div>
				{sharedIsDirty && !isSaving && <UnsavedChangesBadge />}
			</div>

			<div className="px-6 pt-4 pb-6">
				<div className="space-y-3">
					<SectionLabel>{__('User Privacy', 'allfeedback')}</SectionLabel>
					<Row
						label={__('Disable User Details', 'allfeedback')}
						description={__(
							'Disable storing the IP address and User Agent on all forms.',
							'allfeedback',
						)}
					>
						<Switch
							checked={values.disable_user_details}
							onCheckedChange={(v) =>
								form.setFieldValue('disable_user_details', v)
							}
						/>
					</Row>

					<Row
						label={__('Require consent', 'allfeedback')}
						description={__(
							'Show a consent checkbox that visitors must tick before submitting any form.',
							'allfeedback',
						)}
					>
						<Switch
							checked={values.require_consent}
							onCheckedChange={(v) => form.setFieldValue('require_consent', v)}
						/>
					</Row>

					<Collapse open={values.require_consent}>
						<Row
							label={__('Consent text', 'allfeedback')}
							description={__(
								'Label shown next to the consent checkbox.',
								'allfeedback',
							)}
						>
							<Textarea
								value={values.consent_text}
								onChange={(e) =>
									form.setFieldValue('consent_text', e.target.value)
								}
								placeholder={DEFAULT_CONSENT_TEXT}
								rows={3}
							/>
						</Row>

						<Row
							label={__('Privacy policy URL', 'allfeedback')}
							description={__(
								'Linked from the consent text. Leave blank to use your site privacy policy page.',
								'allfeedback',
							)}
						>
							<Input
								type="url"
								value={values.privacy_policy_url}
								onChange={(e) =>
									form.setFieldValue('privacy_policy_url', e.target.value)
								}
								placeholder="https://example.com/privacy-policy"
							/>
						</Row>
					</Collapse>
				</div>

				<div className="border-border/50 my-6 border-t" />

				<div className="space-y-3">
					<SectionLabel>{__('Logging', 'allfeedback')}</SectionLabel>
					<Row label={__('Enable logging', 'allfeedback')}>
						<Switch
							checked={values.logging_enabled}
							onCheckedChange={(v) => form.setFieldValue('logging_enabled', v)}
						/>
					</Row>
				</div>

				<div className="border-border/50 my-6 border-t" />

				<div className="space-y-3">
					<SectionLabel>{__('Plugin Management', 'allfeedback')}</SectionLabel>
					<Row label={__('Delete data on uninstall', 'allfeedback')}>
						<Switch
							checked={values.delete_on_uninstall}
							onCheckedChange={(v) =>
								form.setFieldValue('delete_on_uninstall', v)
							}
						/>
					</Row>
				</div>

				{extensionSections.map(({ name, title, Component }) => {
					const key = `extension:${name}`;
					return (
						<div key={name}>
							<div className="border-border/50 my-6 border-t" />
							<div className="space-y-3">
								<SectionLabel>{title}</SectionLabel>
								<Component
									settings={data}
									patch={patches[key]}
									setPatch={(patch) => {
										setPatch(key, patch);
										setDirty(key, patch !== null);
									}}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default AdvancedSettings;
