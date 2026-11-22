﻿import type { SurveyFormSchema, SurveyStatus } from '@/admin/api/surveys';
import { surveysApi } from '@/admin/api/surveys';
import { Tooltip } from '@/admin/components/Tooltip';
import { surveyQuery } from '@/admin/queries/surveys';
import { Route } from '@/admin/routes/builder.index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ShortcodeChip from '@/components/ui/shortcode-chip';
import UnsavedChangesBadge from '@/components/ui/unsaved-changes-badge';
import { cn } from '@/lib/utils';
import { useForm } from '@tanstack/react-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useStore } from '@tanstack/react-store';
import { __ } from '@wordpress/i18n';
import {
	AlertTriangle,
	ArrowLeft,
	Check,
	ChevronDown,
	Info,
	LayoutGrid,
	Loader2,
	Palette,
	Pencil,
	Redo2,
	Settings2,
	Undo2,
	X,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import BuilderCanvas from './builder/BuilderCanvas';
import { computeRequiredFeatures } from './builder/extensions';
import { INACTIVE_FORM_MESSAGE } from './inactiveForm';
import PreviewPanel from './builder/PreviewPanel';
import SettingsPanel from './builder/SettingsPanel';
import StylingPanel from './builder/StylingPanel';
import type {
	BuilderTab,
	FieldType,
	FormField,
	FormSection,
	FormSettings,
	PreviewDevice,
} from './builder/types';
import { DEFAULT_FORM_SETTINGS } from './builder/types';

const WP_ELEMENTS = [
	'#wpadminbar',
	'#adminmenuwrap',
	'#adminmenuback',
] as const;

const TABS: {
	value: BuilderTab;
	label: string;
	Icon: typeof LayoutGrid;
	pro?: boolean;
}[] = [
	{ value: 'builder', label: __('Builder', 'allfeedback'), Icon: LayoutGrid },
	{ value: 'styling', label: __('Styling', 'allfeedback'), Icon: Palette },
	{ value: 'settings', label: __('Settings', 'allfeedback'), Icon: Settings2 },
];

const CORE_SETTING_KEYS = [
	'placeholder',
	'options',
	'starScale',
	'starRange',
	'scaleMin',
	'scaleMax',
	'scaleLowLabel',
	'scaleHighLabel',
];

/** Settings saved by extensions (anything that isn't a core field setting). */
const extraSettings = (
	settings: Record<string, unknown>,
): { settings?: Record<string, unknown> } => {
	const extra = Object.fromEntries(
		Object.entries(settings ?? {}).filter(
			([key]) => !CORE_SETTING_KEYS.includes(key),
		),
	);
	return Object.keys(extra).length ? { settings: extra } : {};
};

const deserializeFormSchema = (
	schema: SurveyFormSchema | null,
): FormSection[] => {
	if (!schema) return [];
	return schema.sections.map((section) => ({
		id: section.id,
		title: section.title,
		fields: section.fields.map(
			(field): FormField => ({
				id: field.id,
				type: field.type as FieldType,
				label: field.label,
				required: field.required,
				...(field.settings.placeholder !== undefined && {
					placeholder: field.settings.placeholder as string,
				}),
				...(field.settings.options !== undefined && {
					options: field.settings.options as string[],
				}),
				...(field.settings.starScale !== undefined && {
					starScale: field.settings.starScale as 'star' | 'number',
				}),
				...(field.settings.starRange !== undefined && {
					starRange: field.settings.starRange as 5 | 10,
				}),
				...(field.settings.scaleMin !== undefined && {
					scaleMin: field.settings.scaleMin as number,
				}),
				...(field.settings.scaleMax !== undefined && {
					scaleMax: field.settings.scaleMax as number,
				}),
				...(field.settings.scaleLowLabel !== undefined && {
					scaleLowLabel: field.settings.scaleLowLabel as string,
				}),
				...(field.settings.scaleHighLabel !== undefined && {
					scaleHighLabel: field.settings.scaleHighLabel as string,
				}),
				...extraSettings(field.settings),
			}),
		),
	}));
};

const serializeSettings = (s: FormSettings): Record<string, unknown> => ({
	submit_label: s.submitLabel,
	next_label: s.nextLabel,
	back_label: s.backLabel,
	user_state: s.userState,

	target_pages: s.targetPages === 'all' ? 'all' : 'specific',

	target_page_ids:
		s.targetPages === 'specific_pages'
			? s.targetPageIds.map((p) => p.id)
			: s.targetPages === 'specific_posts'
				? s.targetPostIds.map((p) => p.id)
				: [],
	trigger_type: s.triggerType,
	delay_value: s.delayValue,
	delay_unit: s.delayUnit,
	scroll_depth: s.scrollDepth,
	display_frequency: s.displayFrequency,
	max_impressions: s.maxImpressions,
	dismiss_wait_value: s.dismissWaitValue,
	dismiss_wait_unit: s.dismissWaitUnit,

	thankYouEnabled: s.thankYouEnabled,
	thankYouTitle: s.thankYouTitle,
	thankYouDescription: s.thankYouDescription,
	targetDevice: s.targetDevice,
	targetUrls: s.targetUrls,

	targetPages: s.targetPages,
	targetPageIds: s.targetPageIds,
	targetPostIds: s.targetPostIds,

	widget_label: s.widgetLabel,
});

const serializeStyling = (s: FormSettings): Record<string, unknown> => ({
	widget_position: s.widgetPosition,
	widget_icon: s.triggerIcon,
	progress_indicator: s.progressIndicator,
});

const deserializeSettings = (
	raw: Record<string, unknown>,
): Partial<FormSettings> => ({
	...(raw.submit_label !== undefined && {
		submitLabel: raw.submit_label as string,
	}),
	...(raw.next_label !== undefined && { nextLabel: raw.next_label as string }),
	...(raw.back_label !== undefined && { backLabel: raw.back_label as string }),
	...(raw.user_state !== undefined && {
		userState: raw.user_state as FormSettings['userState'],
	}),

	...(raw.targetPages !== undefined
		? { targetPages: raw.targetPages as FormSettings['targetPages'] }
		: raw.target_pages !== undefined && {
				targetPages:
					raw.target_pages === 'specific'
						? 'specific_pages'
						: (raw.target_pages as FormSettings['targetPages']),
			}),

	...(raw.targetPageIds !== undefined
		? { targetPageIds: raw.targetPageIds as FormSettings['targetPageIds'] }
		: raw.target_page_ids !== undefined && {
				targetPageIds: (raw.target_page_ids as number[]).map((id) => ({
					id,
					title: `#${id}`,
				})),
			}),
	...(raw.targetPostIds !== undefined && {
		targetPostIds: raw.targetPostIds as FormSettings['targetPostIds'],
	}),
	...(raw.trigger_type !== undefined && {
		triggerType: raw.trigger_type as FormSettings['triggerType'],
	}),
	...(raw.delay_value !== undefined && {
		delayValue: raw.delay_value as number,
	}),
	...(raw.delay_unit !== undefined && {
		delayUnit: raw.delay_unit as FormSettings['delayUnit'],
	}),
	...(raw.scroll_depth !== undefined && {
		scrollDepth: raw.scroll_depth as number,
	}),
	...(raw.display_frequency !== undefined && {
		displayFrequency: raw.display_frequency as FormSettings['displayFrequency'],
	}),
	...(raw.max_impressions !== undefined && {
		maxImpressions: raw.max_impressions as number,
	}),
	...(raw.dismiss_wait_value !== undefined && {
		dismissWaitValue: raw.dismiss_wait_value as number,
	}),
	...(raw.dismiss_wait_unit !== undefined && {
		dismissWaitUnit: raw.dismiss_wait_unit as FormSettings['dismissWaitUnit'],
	}),

	...(raw.thankYouEnabled !== undefined && {
		thankYouEnabled: raw.thankYouEnabled as boolean,
	}),
	...(raw.thankYouTitle !== undefined && {
		thankYouTitle: raw.thankYouTitle as string,
	}),
	...(raw.thankYouDescription !== undefined && {
		thankYouDescription: raw.thankYouDescription as string,
	}),
	...(raw.targetDevice !== undefined && {
		targetDevice: raw.targetDevice as FormSettings['targetDevice'],
	}),
	...(raw.targetUrls !== undefined && { targetUrls: raw.targetUrls as string }),
	// widget_label lives in settings; support both new snake_case and legacy camelCase
	...(raw.widget_label !== undefined && {
		widgetLabel: raw.widget_label as string,
	}),
	...(raw.widgetLabel !== undefined && {
		widgetLabel: raw.widgetLabel as string,
	}),
});

const deserializeStyling = (
	raw: Record<string, unknown>,
): Partial<FormSettings> => ({
	...(raw.widget_position !== undefined && {
		widgetPosition: raw.widget_position as FormSettings['widgetPosition'],
	}),
	...(raw.widget_icon !== undefined && {
		triggerIcon: raw.widget_icon as FormSettings['triggerIcon'],
	}),
	...(raw.progress_indicator !== undefined && {
		progressIndicator:
			raw.progress_indicator as FormSettings['progressIndicator'],
	}),
	// backward-compat: old data stored these in settings as camelCase
	...(raw.widgetPosition !== undefined && {
		widgetPosition: raw.widgetPosition as FormSettings['widgetPosition'],
	}),
	...(raw.progressIndicator !== undefined && {
		progressIndicator:
			raw.progressIndicator as FormSettings['progressIndicator'],
	}),
});

const serializeFormSchema = (
	sections: FormSection[],
	requires: string[],
): SurveyFormSchema => ({
	version: '1.0',
	...(requires.length && { requires }),
	sections: sections.map((section) => ({
		id: section.id,
		title: section.title,
		fields: section.fields.map((field) => ({
			id: field.id,
			type: field.type,
			label: field.label,
			required: field.required,
			settings: {
				...field.settings,
				...(field.placeholder !== undefined && {
					placeholder: field.placeholder,
				}),
				...(field.options !== undefined && { options: field.options }),
				...(field.starScale !== undefined && { starScale: field.starScale }),
				...(field.starRange !== undefined && { starRange: field.starRange }),
				...(field.scaleMin !== undefined && { scaleMin: field.scaleMin }),
				...(field.scaleMax !== undefined && { scaleMax: field.scaleMax }),
				...(field.scaleLowLabel !== undefined && {
					scaleLowLabel: field.scaleLowLabel,
				}),
				...(field.scaleHighLabel !== undefined && {
					scaleHighLabel: field.scaleHighLabel,
				}),
			},
		})),
	})),
});

const FormBuilder = () => {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { new: isNewForm, id: formId } = Route.useSearch();

	const [activeTab, setActiveTab] = useState<BuilderTab>('builder');

	const { data: surveyData } = useQuery({
		...surveyQuery(formId!),
		enabled: !!formId,
		staleTime: Infinity,
	});

	const [surveyStatus, setSurveyStatus] = useState<SurveyStatus>('draft');
	const [conflictWarning, setConflictWarning] = useState<string | null>(null);
	const [missingFeatures, setMissingFeatures] = useState<string[]>([]);
	const requiredFeaturesRef = useRef<string[]>([]);

	const submitActionRef = useRef<'publish' | 'draft' | 'trashed'>('draft');

	const form = useForm({
		defaultValues: {
			title: '' as string,
			sections: [] as FormSection[],
			settings: DEFAULT_FORM_SETTINGS as FormSettings,
		},
		onSubmit: async ({ value }) => {
			if (!formId) return;
			const action = submitActionRef.current;

			const requires = computeRequiredFeatures(
				value.sections,
				requiredFeaturesRef.current,
			);
			const saveData: Parameters<typeof surveysApi.update>[1] = {
				title: value.title,
				form_schema: serializeFormSchema(value.sections, requires),
				settings: serializeSettings(value.settings),
				styling: serializeStyling(value.settings),
			};

			if (action !== 'publish') {
				saveData.status = action === 'trashed' ? 'trashed' : 'draft';
			}

			const updated = await surveysApi.update(formId, saveData);
			requiredFeaturesRef.current = requires;
			setMissingFeatures(updated.missing_features ?? []);
			setIsDirty(false);
			queryClient.setQueryData(surveyQuery(formId).queryKey, updated);

			if (action === 'publish') {
				const published = await surveysApi.publish(formId);
				setSurveyStatus(published.status);
				setConflictWarning(published.conflict_reason ?? null);
				setMissingFeatures(published.missing_features ?? []);
				queryClient.setQueryData(surveyQuery(formId).queryKey, published);
				void queryClient.invalidateQueries({ queryKey: ['surveys'] });

				if (published.conflict_reason) {
					toast.warning(
						__(
							'Conflict detected — saved as draft instead of publishing.',
							'allfeedback',
						),
					);
					return;
				}

				if (published.missing_features?.length) {
					toast.warning(INACTIVE_FORM_MESSAGE);
					return;
				}

				toast.success(__('Form published successfully.', 'allfeedback'));
				return;
			}

			setSurveyStatus(updated.status);
			setConflictWarning(updated.conflict_reason ?? null);
			void queryClient.invalidateQueries({ queryKey: ['surveys'] });
			toast.success(
				action === 'trashed'
					? __('Trashed form saved successfully.', 'allfeedback')
					: __('Draft saved successfully.', 'allfeedback'),
			);
		},
	});

	const isSubmitting = useStore(form.store, (s) => s.isSubmitting);

	const title = useStore(form.store, (s) => s.values.title);
	const sections = useStore(form.store, (s) => s.values.sections);
	const settings = useStore(form.store, (s) => s.values.settings);

	const [isDirty, setIsDirty] = useState(false);

	useEffect(() => {
		if (!isDirty) return;
		const unblock = router.history.block({
			blockerFn: () =>
				!window.confirm(
					__(
						'You have unsaved changes. Are you sure you want to leave?',
						'allfeedback',
					),
				),
			enableBeforeUnload: false,
		});
		return unblock;
	}, [isDirty, router.history]);

	const handleSettingsChange = useCallback(
		(next: FormSettings) => {
			form.setFieldValue('settings', next);
			setIsDirty(true);
		},
		[form],
	);

	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const titleSnapshotRef = useRef('');
	const titleInputRef = useRef<HTMLInputElement>(null);

	const [activeSectionIndex, setActiveSectionIndex] = useState(-1);
	const [canvasScrolled, setCanvasScrolled] = useState(false);
	const [canvasProgress, setCanvasProgress] = useState(0);
	const [settingsScrolled, setSettingsScrolled] = useState(false);
	const [settingsProgress, setSettingsProgress] = useState(0);
	const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop');
	const [previewWidth, setPreviewWidth] = useState(() => {
		const saved = localStorage.getItem('allfeedback_preview_width_v2');
		if (saved) {
			const n = parseInt(saved, 10);
			if (!isNaN(n) && n >= 280)
				return Math.min(n, Math.round(window.innerWidth * 0.72));
		}
		const adminMenu = document.getElementById('adminmenuwrap')?.offsetWidth ?? 0;
		return Math.max(280, Math.round((window.innerWidth - adminMenu) * 0.4));
	});
	const [publishMenuOpen, setPublishMenuOpen] = useState(false);
	const [shortcutsOpen, setShortcutsOpen] = useState(false);

	const historyRef = useRef<FormSection[][]>([[]]);
	const [historyIdx, setHistoryIdx] = useState(0);

	const initializedFormIdRef = useRef<number | undefined>(undefined);

	useEffect(() => {
		initializedFormIdRef.current = undefined;
		setIsDirty(false);
		setActiveTab('builder');
	}, [formId]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (!surveyData || surveyData.id === initializedFormIdRef.current) return;
		initializedFormIdRef.current = surveyData.id;
		const loadedSections = deserializeFormSchema(surveyData.form_schema);
		const loadedSettings = {
			...DEFAULT_FORM_SETTINGS,
			...(surveyData.settings
				? deserializeSettings(surveyData.settings as Record<string, unknown>)
				: {}),
			...(surveyData.styling
				? deserializeStyling(surveyData.styling as Record<string, unknown>)
				: {}),
		};
		setSurveyStatus(surveyData.status);
		setConflictWarning(surveyData.conflict_reason ?? null);
		setMissingFeatures(surveyData.missing_features ?? []);
		requiredFeaturesRef.current = surveyData.form_schema?.requires ?? [];
		historyRef.current = [loadedSections];
		setHistoryIdx(0);

		form.reset(
			{
				title: surveyData.title,
				sections: loadedSections,
				settings: loadedSettings,
			},
			{ keepDefaultValues: true },
		);

		if (isNewForm) {
			titleSnapshotRef.current = surveyData.title;
			setIsEditingTitle(true);
		}
	}, [surveyData]); // eslint-disable-line react-hooks/exhaustive-deps
	const canUndo = historyIdx > 0;
	const canRedo = historyIdx < historyRef.current.length - 1;

	const handleSectionsChange = useCallback(
		(next: FormSection[]) => {
			const trimmed = historyRef.current.slice(0, historyIdx + 1);
			trimmed.push(next);
			historyRef.current = trimmed;
			setHistoryIdx(trimmed.length - 1);
			form.setFieldValue('sections', next);
			setIsDirty(true);
		},
		[form, historyIdx],
	);

	const undo = useCallback(() => {
		if (!canUndo) return;
		const newIdx = historyIdx - 1;
		setHistoryIdx(newIdx);
		form.setFieldValue('sections', historyRef.current[newIdx]);
		setIsDirty(true);
	}, [canUndo, form, historyIdx]);

	const redo = useCallback(() => {
		if (!canRedo) return;
		const newIdx = historyIdx + 1;
		setHistoryIdx(newIdx);
		form.setFieldValue('sections', historyRef.current[newIdx]);
		setIsDirty(true);
	}, [canRedo, form, historyIdx]);

	const publishMenuRef = useRef<HTMLDivElement>(null);
	const shortcutsRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const hidden: { el: HTMLElement; display: string }[] = [];
		WP_ELEMENTS.forEach((selector) => {
			const el = document.querySelector<HTMLElement>(selector);
			if (!el) return;
			hidden.push({ el, display: el.style.display });
			el.style.display = 'none';
		});

		const resets: { el: HTMLElement; prop: string; prev: string }[] = [];
		const resetProp = (
			selector: string,
			prop: keyof CSSStyleDeclaration,
			value: string,
		) => {
			const el = document.querySelector<HTMLElement>(selector);
			if (!el) return;
			resets.push({
				el,
				prop: prop as string,
				prev: (el.style as Record<string, string>)[prop as string] ?? '',
			});
			(el.style as Record<string, string>)[prop as string] = value;
		};

		resetProp('html', 'marginTop', '0');
		resetProp('html', 'overflow', 'hidden');
		resetProp('body', 'overflow', 'hidden');
		resetProp('#wpbody', 'paddingTop', '0');
		resetProp('#wpcontent', 'marginLeft', '0');
		resetProp('#wpwrap', 'paddingTop', '0');

		return () => {
			hidden.forEach(({ el, display }) => (el.style.display = display));
			resets.forEach(
				({ el, prop, prev }) =>
					((el.style as Record<string, string>)[prop] = prev),
			);
		};
	}, []);

	useEffect(() => {
		if (isEditingTitle) {
			titleInputRef.current?.focus();
			titleInputRef.current?.select();
		}
	}, [isEditingTitle]);

	useEffect(() => {
		if (!publishMenuOpen) return;
		const handle = (e: MouseEvent) => {
			if (
				publishMenuRef.current &&
				!publishMenuRef.current.contains(e.target as Node)
			) {
				setPublishMenuOpen(false);
			}
		};
		document.addEventListener('mousedown', handle);
		return () => document.removeEventListener('mousedown', handle);
	}, [publishMenuOpen]);

	useEffect(() => {
		if (!shortcutsOpen) return;
		const handle = (e: MouseEvent) => {
			if (
				shortcutsRef.current &&
				!shortcutsRef.current.contains(e.target as Node)
			) {
				setShortcutsOpen(false);
			}
		};
		document.addEventListener('mousedown', handle);
		return () => document.removeEventListener('mousedown', handle);
	}, [shortcutsOpen]);

	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (!isDirty) return;
			e.preventDefault();
			e.returnValue = '';
		};
		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => window.removeEventListener('beforeunload', handleBeforeUnload);
	}, [isDirty]);

	const startResize = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			const startX = e.clientX;
			const startWidth = previewWidth;

			const onMove = (ev: MouseEvent) => {
				const delta = startX - ev.clientX;
				const next = Math.max(
					280,
					Math.min(Math.round(window.innerWidth * 0.72), startWidth + delta),
				);
				setPreviewWidth(next);
				localStorage.setItem('allfeedback_preview_width_v2', String(next));
			};
			const onUp = () => {
				document.removeEventListener('mousemove', onMove);
				document.removeEventListener('mouseup', onUp);
				document.body.style.cursor = '';
				document.body.style.userSelect = '';
			};

			document.body.style.cursor = 'col-resize';
			document.body.style.userSelect = 'none';
			document.addEventListener('mousemove', onMove);
			document.addEventListener('mouseup', onUp);
		},
		[previewWidth],
	);

	const startEditingTitle = () => {
		titleSnapshotRef.current = title;
		setIsEditingTitle(true);
	};

	const commitTitle = () => {
		if (!form.state.values.title.trim()) {
			form.setFieldValue('title', titleSnapshotRef.current);
		}
		setIsEditingTitle(false);
	};

	const cancelTitle = () => {
		form.setFieldValue('title', titleSnapshotRef.current);
		setIsEditingTitle(false);
	};

	const handleBack = () => {
		router.navigate({ to: '/forms' });
	};

	const isMac =
		typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

	const handlePublish = () => {
		submitActionRef.current = 'publish';
		form.handleSubmit().catch(() => {
			toast.error(__('Failed to save. Please try again.', 'allfeedback'));
		});
		setPublishMenuOpen(false);
	};

	const handleSaveAsDraft = () => {
		submitActionRef.current = 'draft';
		form.handleSubmit().catch(() => {
			toast.error(__('Failed to save. Please try again.', 'allfeedback'));
		});
		setPublishMenuOpen(false);
	};

	const handleMoveToTrash = () => {
		submitActionRef.current = 'trashed';
		form.handleSubmit().catch(() => {
			toast.error(__('Failed to save. Please try again.', 'allfeedback'));
		});
		setPublishMenuOpen(false);
	};

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const mod = e.ctrlKey || e.metaKey;
			if (!mod) return;
			if (e.key === 's') {
				e.preventDefault();
				submitActionRef.current =
					surveyStatus === 'published'
						? 'publish'
						: surveyStatus === 'trashed'
							? 'trashed'
							: 'draft';
				form.handleSubmit().catch(() => {});
				return;
			}
			if (e.key === 'z' && !e.shiftKey) {
				e.preventDefault();
				undo();
				return;
			}
			if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
				e.preventDefault();
				redo();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [form, undo, redo, surveyStatus]);

	return (
		<div className="allfb-builder bg-background fixed inset-0 z-[99999] flex flex-col">
			<header className="border-border flex h-[68px] shrink-0 items-center justify-between border-b bg-white px-6">
				<div className="flex min-w-0 flex-1 items-center gap-2">
					<Tooltip content={__('Back to forms', 'allfeedback')}>
						<Button
							variant="ghost"
							size="icon-sm"
							onClick={handleBack}
							aria-label={__('Back', 'allfeedback')}
						>
							<ArrowLeft className="size-4" />
						</Button>
					</Tooltip>

					<span className="bg-border h-5 w-px" />

					{isEditingTitle ? (
						<div
							className="flex items-center gap-1.5"
							onBlur={(e) => {
								if (!e.currentTarget.contains(e.relatedTarget as Node))
									commitTitle();
							}}
						>
							<Input
								ref={titleInputRef}
								type="text"
								value={title}
								autoFocus
								onFocus={(e) => e.target.select()}
								onChange={(e) => {
									form.setFieldValue('title', e.target.value);
									setIsDirty(true);
								}}
								onKeyDown={(e) => {
									if (e.key === 'Enter') commitTitle();
									if (e.key === 'Escape') cancelTitle();
								}}
								className="builder-title w-[520px] bg-transparent"
							/>
							<Button
								variant="ghost"
								size="icon-xs"
								onClick={commitTitle}
								className="text-success hover:bg-success/10 active:bg-success/15"
								aria-label={__('Confirm', 'allfeedback')}
							>
								<Check className="size-3.5" />
							</Button>
							<Button
								variant="ghost"
								size="icon-xs"
								onClick={cancelTitle}
								aria-label={__('Cancel', 'allfeedback')}
							>
								<X className="size-3.5" />
							</Button>
						</div>
					) : (
						<Tooltip content={__('Click to edit', 'allfeedback')}>
							<button
								type="button"
								className="builder-title group text-foreground hover:bg-muted/50 flex w-[520px] items-center gap-2 rounded-lg transition-colors"
								onClick={startEditingTitle}
							>
								<span className="min-w-0 flex-1 truncate px-[2px] py-[4.5px]">
									{title}
								</span>
								<Pencil
									className="text-muted-foreground/50 size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
									onClick={(e) => {
										e.stopPropagation();
										startEditingTitle();
									}}
								/>
							</button>
						</Tooltip>
					)}
				</div>

				<div className="flex items-center gap-3">
					{surveyStatus === 'draft' && !isDirty && (
						<div className="border-border bg-muted/60 flex items-center gap-1.5 rounded-full border px-3 py-1">
							<span className="text-muted-foreground text-xs font-medium">
								{__('Draft', 'allfeedback')}
							</span>
						</div>
					)}
					{surveyStatus === 'published' && !isDirty && (
						<div className="border-success/25 bg-success-subtle flex items-center gap-1.5 rounded-full border px-3 py-1">
							<span className="bg-success block h-1.5 w-1.5 rounded-full" />
							<span className="text-success text-xs font-medium">
								{__('Published', 'allfeedback')}
							</span>
						</div>
					)}
					{surveyStatus === 'trashed' && !isDirty && (
						<div className="border-destructive/20 bg-destructive/5 flex items-center gap-1.5 rounded-full border px-3 py-1">
							<span className="text-destructive text-xs font-medium">
								{__('Trashed', 'allfeedback')}
							</span>
						</div>
					)}
					{isDirty && <UnsavedChangesBadge />}

					{formId && (
						<ShortcodeChip
							shortcode={`[allfeedback_survey id="${formId}"]`}
							size="md"
						/>
					)}

					<div className="flex items-center gap-0.5">
						<Tooltip content={isMac ? '⌘Z' : 'Ctrl+Z'}>
							<button
								type="button"
								onClick={undo}
								disabled={!canUndo}
								className="text-muted-foreground hover:bg-muted/60 hover:text-foreground flex size-8 items-center justify-center rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-35"
							>
								<Undo2 className="size-4" />
							</button>
						</Tooltip>
						<Tooltip content={isMac ? '⌘⇧Z' : 'Ctrl+Y'}>
							<button
								type="button"
								onClick={redo}
								disabled={!canRedo}
								className="text-muted-foreground hover:bg-muted/60 hover:text-foreground flex size-8 items-center justify-center rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-35"
							>
								<Redo2 className="size-4" />
							</button>
						</Tooltip>
					</div>

					<div ref={shortcutsRef} className="relative">
						<button
							type="button"
							onClick={() => setShortcutsOpen((v) => !v)}
							className="text-muted-foreground hover:bg-muted/60 hover:text-foreground flex size-8 items-center justify-center rounded-lg transition-colors"
							aria-label={__('Keyboard shortcuts', 'allfeedback')}
						>
							<Info className="size-4" />
						</button>

						{shortcutsOpen && (
							<div className="border-border shadow-dropdown absolute top-full right-0 z-10 mt-1.5 w-56 overflow-hidden rounded-xl border bg-white">
								<div className="border-border border-b px-4 py-2.5">
									<p className="text-foreground text-sm font-semibold">
										{__('Keyboard shortcuts', 'allfeedback')}
									</p>
								</div>
								<div className="px-4 py-2">
									{[
										{
											label: __('Save / Publish', 'allfeedback'),
											keys: isMac ? ['⌘', 'S'] : ['Ctrl', 'S'],
										},
										{
											label: __('Undo', 'allfeedback'),
											keys: isMac ? ['⌘', 'Z'] : ['Ctrl', 'Z'],
										},
										{
											label: __('Redo', 'allfeedback'),
											keys: isMac ? ['⌘', '⇧', 'Z'] : ['Ctrl', 'Y'],
										},
									].map(({ label, keys }) => (
										<div
											key={label}
											className="flex items-center justify-between py-1.5"
										>
											<span className="text-muted-foreground text-sm">
												{label}
											</span>
											<div className="flex items-center gap-1">
												{keys.map((k) => (
													<kbd
														key={k}
														className="border-border bg-muted/60 text-2xs text-foreground rounded border px-1 py-px leading-none font-medium"
													>
														{k}
													</kbd>
												))}
											</div>
										</div>
									))}
								</div>
							</div>
						)}
					</div>

					<div ref={publishMenuRef} className="relative">
						<Tooltip content={isMac ? '⌘S' : 'Ctrl+S'}>
							<div className="publish-split flex items-stretch overflow-hidden rounded-lg shadow-sm">
								<button
									type="button"
									onClick={handlePublish}
									disabled={isSubmitting}
									className="bg-primary text-primary-foreground hover:bg-brand-600 active:bg-brand-700 flex h-10 items-center gap-2 px-5 text-base font-medium transition-colors disabled:opacity-70"
								>
									{isSubmitting && (
										<Loader2 className="size-3.5 animate-spin" />
									)}
									{__('Publish', 'allfeedback')}
								</button>
								<button
									type="button"
									onClick={() => setPublishMenuOpen((v) => !v)}
									className="publish-split__arrow bg-primary text-primary-foreground hover:bg-brand-600 active:bg-brand-700 flex h-10 items-center px-3 transition-colors"
									aria-label={__('More publish options', 'allfeedback')}
								>
									<ChevronDown className="size-4" />
								</button>
							</div>
						</Tooltip>

						{publishMenuOpen && (
							<div className="border-border shadow-dropdown absolute top-full right-0 z-10 mt-1.5 w-44 overflow-hidden rounded-xl border bg-white py-1">
								<button
									type="button"
									onClick={handleSaveAsDraft}
									className="text-foreground hover:bg-muted/60 flex w-full items-center px-4 py-2.5 text-sm transition-colors"
								>
									{__('Save as Draft', 'allfeedback')}
								</button>
								<button
									type="button"
									onClick={handleMoveToTrash}
									className="text-destructive hover:bg-destructive/5 flex w-full items-center px-4 py-2.5 text-sm transition-colors"
								>
									{__('Move to Trash', 'allfeedback')}
								</button>
							</div>
						)}
					</div>
				</div>
			</header>

			{missingFeatures.length > 0 && (
				<div className="border-warning/20 bg-warning-subtle flex shrink-0 items-center gap-2 border-b px-6 py-1.5">
					<AlertTriangle className="text-warning-foreground/60 size-3.5 shrink-0" />
					<p className="text-warning-foreground/90 flex-1 text-xs">
						<span className="font-semibold">
							{__('Inactive:', 'allfeedback')}
						</span>{' '}
						{INACTIVE_FORM_MESSAGE}
					</p>
				</div>
			)}

			{conflictWarning && (
				<div className="border-warning/20 bg-warning-subtle flex shrink-0 items-center gap-2 border-b px-6 py-1.5">
					<AlertTriangle className="text-warning-foreground/60 size-3.5 shrink-0" />
					<p className="text-warning-foreground/90 flex-1 text-xs">
						<span className="font-semibold">
							{__('Conflict:', 'allfeedback')}
						</span>{' '}
						{conflictWarning}
					</p>
				</div>
			)}

			<div className="flex flex-1 overflow-hidden">
				<div className="flex flex-1 flex-col overflow-hidden">
					<div
						className={cn(
							'relative flex h-[72px] shrink-0 items-center justify-center bg-white px-8 transition-shadow duration-150',
							((canvasScrolled && activeTab === 'builder') ||
								(settingsScrolled && activeTab === 'settings')) &&
								'shadow-[0_1px_0_0_hsl(var(--border)),0_4px_10px_-2px_rgba(0,0,0,0.06)]',
						)}
					>
						{TABS.map(({ value, label, Icon }, idx) => {
							const isActive = activeTab === value;
							return (
								<Fragment key={value}>
									{idx > 0 && (
										<div className="bg-border/70 mx-4 h-px w-12 shrink-0" />
									)}
									<button
										type="button"
										onClick={() => setActiveTab(value)}
										className={cn(
											'group flex items-center gap-2.5 text-base font-medium transition-colors',
											isActive
												? 'text-primary'
												: 'text-muted-foreground hover:text-foreground',
										)}
									>
										<span
											className={cn(
												'flex size-10 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200',
												isActive
													? 'border-primary bg-primary'
													: 'border-border group-hover:border-border/80 group-hover:bg-muted/40 bg-white',
											)}
										>
											<Icon
												className={cn(
													'size-4 transition-colors',
													isActive ? 'text-white' : 'text-muted-foreground/60',
												)}
											/>
										</span>
										{label}
									</button>
								</Fragment>
							);
						})}

						{activeTab === 'builder' && canvasScrolled && (
							<div className="bg-border/40 absolute inset-x-0 bottom-0 h-[2px]">
								<div
									className="bg-primary/60 h-full transition-[width] duration-75"
									style={{ width: `${canvasProgress * 100}%` }}
								/>
							</div>
						)}
						{activeTab === 'settings' && settingsScrolled && (
							<div className="bg-border/40 absolute inset-x-0 bottom-0 h-[2px]">
								<div
									className="bg-primary/60 h-full transition-[width] duration-75"
									style={{ width: `${settingsProgress * 100}%` }}
								/>
							</div>
						)}
					</div>

					<div className="flex flex-1 overflow-hidden">
						{activeTab === 'builder' && (
							<BuilderCanvas
								sections={sections}
								onSectionsChange={handleSectionsChange}
								activeSectionIndex={activeSectionIndex}
								onActiveSectionChange={setActiveSectionIndex}
								onScrollChange={(scrolled, progress) => {
									setCanvasScrolled(scrolled);
									setCanvasProgress(progress);
								}}
							/>
						)}

						{activeTab === 'settings' && (
							<SettingsPanel
								settings={settings}
								onChange={handleSettingsChange}
								onScrollChange={(scrolled, progress) => {
									setSettingsScrolled(scrolled);
									setSettingsProgress(progress);
								}}
							/>
						)}

						{activeTab === 'styling' && (
							<StylingPanel
								settings={settings}
								onChange={handleSettingsChange}
								isMultiStep={
									sections.filter((s) => s.fields.length > 0).length > 1
								}
							/>
						)}
					</div>
				</div>

				<div
					className="group relative flex w-1 shrink-0 cursor-col-resize items-center justify-center"
					onMouseDown={startResize}
				>
					<div className="bg-border group-hover:bg-primary/50 h-full w-0.5 transition-colors" />
					<div
						className="border-border bg-background group-hover:border-primary/40 group-hover:bg-primary/5 absolute flex h-7 w-5 cursor-col-resize items-center justify-center rounded-full border shadow-sm transition-colors"
						onMouseDown={startResize}
					>
						<div className="bg-foreground/35 group-hover:bg-primary/60 h-3.5 w-0.5 rounded-full transition-colors" />
					</div>
				</div>

				<div
					className="preview-panel-wrapper shrink-0 overflow-hidden"
					style={
						{ '--preview-width': `${previewWidth}px` } as React.CSSProperties
					}
				>
					<PreviewPanel
						sections={sections}
						settings={settings}
						device={previewDevice}
						onDeviceChange={setPreviewDevice}
						surveyId={formId ?? undefined}
						surveyStatus={surveyStatus}
						activeSectionIndex={activeSectionIndex}
						onActiveSectionChange={setActiveSectionIndex}
					/>
				</div>
			</div>
		</div>
	);
};

export default FormBuilder;
