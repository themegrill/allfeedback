import type { SubmitFormData, SurveyStatus } from '@/admin/api/surveys';
import { surveysApi } from '@/admin/api/surveys';
import { Tooltip } from '@/admin/components/Tooltip';
import { cn } from '@/lib/utils';
import { FieldPreview } from '@/shared/FieldPreview';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { __ } from '@wordpress/i18n';
import {
	ArrowLeft,
	ArrowRight,
	ChevronLeft,
	ChevronRight,
	Eye,
	Globe,
	Lock,
	MessageCircle,
	MessageSquare,
	Minus,
	Monitor,
	MoreHorizontal,
	Plus,
	RotateCw,
	Smartphone,
	Star,
	Tablet,
	X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const genId = (): string =>
	Math.random().toString(36).slice(2) + Date.now().toString(36);

const SmileBubbleIcon = (props: React.SVGProps<SVGSVGElement>) => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
		{...props}
	>
		<circle cx="12" cy="12" r="10" />
		<path d="M8 14s1.5 2 4 2 4-2 4-2" />
		<line x1="9" y1="9" x2="9.01" y2="9" />
		<line x1="15" y1="9" x2="15.01" y2="9" />
	</svg>
);

const PenLineIcon = (props: React.SVGProps<SVGSVGElement>) => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
		{...props}
	>
		<path d="M12 20h9" />
		<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
	</svg>
);

import { settingsQuery } from '@/admin/queries/settings';
import { filterVisibleSections } from '@/shared/extensions';
import { toast } from 'sonner';
import type {
	FormField,
	FormSection,
	FormSettings,
	PreviewDevice,
	WidgetPosition,
} from './types';
import { DEFAULT_CONSENT_TEXT } from './types';

interface PreviewPanelProps {
	sections: FormSection[];
	settings: FormSettings;
	device: PreviewDevice;
	onDeviceChange: (device: PreviewDevice) => void;
	surveyId?: number;
	surveyStatus?: SurveyStatus;
	activeSectionIndex?: number;
	onActiveSectionChange?: (sectionIndex: number) => void;
}

const DEVICES: { value: PreviewDevice; Icon: typeof Monitor; label: string }[] =
	[
		{ value: 'desktop', Icon: Monitor, label: 'Desktop' },
		{ value: 'tablet', Icon: Tablet, label: 'Tablet' },
		{ value: 'mobile', Icon: Smartphone, label: 'Mobile' },
	];

const DEVICE_MAX_W: Record<PreviewDevice, string> = {
	desktop: '400px',
	tablet: '400px',
	mobile: '100%',
};

const DEVICE_PAGE_W: Record<PreviewDevice, string | null> = {
	desktop: null,
	tablet: '768px',
	mobile: '390px',
};

type PreviewView = 'page' | 'widget';

const TRIGGER_ICON_MAP: Record<string, React.ElementType> = {
	message: MessageSquare,
	chat: MessageCircle,
	smile: SmileBubbleIcon,
	star: Star,
	pen: PenLineIcon,
};

const ALLFB_VARS_BASE = {
	'--allfb-white': '#ffffff',
	'--allfb-text': '#1a1a2e',
	'--allfb-muted': '#6b7280',
	'--allfb-border': '#e5e7eb',
	'--allfb-bg': '#ffffff',
	'--allfb-panel-h': '480px',
	'--allfb-font':
		'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
} as React.CSSProperties;

const buildAllfbVars = (color: string): React.CSSProperties =>
	({
		...ALLFB_VARS_BASE,
		'--allfb-color': color,
		'--allfb-color-dark': `color-mix(in srgb, ${color} 85%, #000)`,
	}) as React.CSSProperties;

interface WidgetBodyProps {
	steps: FormSection[];
	stepIndex: number;
	totalSteps: number;
	hasSteps: boolean;
	isLastStep: boolean;
	currentFields: FormField[];
	isSubmitted: boolean;
	hasSubmitted: boolean;
	fieldValues: Record<string, string | string[]>;
	fieldErrors: Record<string, string>;
	submitError: string;
	requireConsent: boolean;
	consentText: string;
	privacyPolicyUrl: string;
	consentChecked: boolean;
	consentError: string;
	onConsentChange: (checked: boolean) => void;
	isMinimized: boolean;
	isClosed: boolean;
	showControls: boolean;
	showMinimize: boolean;
	className?: string;
	settings: FormSettings;
	widgetPosition: WidgetPosition;
	widgetColor: string;
	onMinimize: () => void;
	onClose: () => void;
	onChange: (fieldId: string, value: string | string[]) => void;
	isSubmitting: boolean;
	onNext: () => void;
	onBack: () => void;
	onSubmit: () => void;
	onResubmit: () => void;
}

const WidgetBody = ({
	steps,
	stepIndex,
	totalSteps,
	hasSteps,
	isLastStep,
	currentFields,
	isSubmitted,
	hasSubmitted,
	fieldValues,
	fieldErrors,
	submitError,
	requireConsent,
	consentText,
	privacyPolicyUrl,
	consentChecked,
	consentError,
	onConsentChange,
	isMinimized,
	isClosed,
	showControls,
	showMinimize,
	settings,
	isSubmitting,
	onMinimize,
	onClose,
	onChange,
	onNext,
	onBack,
	onSubmit,
	widgetPosition,
	widgetColor,
	className,
}: WidgetBodyProps) => {
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key !== 'Enter') return;
		if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
		if (isSubmitted || isMinimized || isClosed || !hasSteps || isSubmitting)
			return;
		e.preventDefault();
		if (isLastStep) {
			onSubmit();
		} else {
			onNext();
		}
	};

	return (
		<div
			className={cn(
				'allfb-preview-panel flex flex-col overflow-hidden rounded-2xl shadow-lg transition-all duration-200',
				className,
				isClosed || isMinimized
					? 'pointer-events-none scale-90 opacity-0'
					: 'scale-100 opacity-100',
			)}
			style={{
				...buildAllfbVars(widgetColor),
				transformOrigin:
					widgetPosition === 'bottom-left'
						? 'bottom left'
						: widgetPosition === 'side-tab'
							? 'right center'
							: 'bottom right',
			}}
			onKeyDown={handleKeyDown}
		>
			<div className="allfb-panel__header">
				{settings.widgetLabel && (
					<span className="allfb-panel__title">{settings.widgetLabel}</span>
				)}
				{showControls && (
					<>
						{showMinimize && (
							<button
								type="button"
								onClick={onMinimize}
								className="allfb-panel__close"
								aria-label={__('Minimise', 'allfeedback')}
							>
								<Minus />
							</button>
						)}
						<button
							type="button"
							onClick={onClose}
							className="allfb-panel__close"
							aria-label={__('Close', 'allfeedback')}
						>
							<X />
						</button>
					</>
				)}
			</div>

			<div className="allfb-panel__body">
				{isSubmitted ? (
					<div className="allfb-thankyou">
						<div className="allfb-thankyou__check">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
								focusable="false"
							>
								<polyline points="20 6 9 17 4 12" />
							</svg>
						</div>
						<p className="allfb-thankyou__title !my-0">
							{settings.thankYouEnabled && settings.thankYouTitle
								? settings.thankYouTitle
								: __('Thank you!', 'allfeedback')}
						</p>
						<p className="allfb-thankyou__desc !my-0">
							{settings.thankYouEnabled && settings.thankYouDescription
								? settings.thankYouDescription
								: __('Your response has been recorded.', 'allfeedback')}
						</p>
					</div>
				) : !hasSteps ? (
					<div className="flex flex-col items-center justify-center py-6 text-center">
						<Eye className="text-muted-foreground/25 mb-1.5 size-4" />
						<p className="text-muted-foreground/80 text-[8.5px]">
							{__('Add fields to preview', 'allfeedback')}
						</p>
					</div>
				) : (
					<div className="allfb-form-wrapper">
						{totalSteps > 1 && settings.progressIndicator !== 'none' && (
							<div
								className={`allfb-steps${settings.progressIndicator === 'bar' ? 'allfb-steps--bar' : ''}`}
							>
								{settings.progressIndicator === 'dots' && (
									<div className="allfb-steps__dots">
										{steps.map((_, i) => (
											<span
												key={i}
												className={`allfb-steps__dot${i === stepIndex ? 'is-active' : i < stepIndex ? 'is-done' : ''}`}
											/>
										))}
									</div>
								)}
								{settings.progressIndicator === 'numbers' && (
									<span className="allfb-steps__count allfb-steps__count">
										{stepIndex + 1} / {totalSteps}
									</span>
								)}
								{settings.progressIndicator === 'bar' && (
									<div className="allfb-steps__bar-track">
										<div
											className="allfb-steps__bar-fill"
											style={{
												width: `${((stepIndex + 1) / totalSteps) * 100}%`,
											}}
										/>
									</div>
								)}
							</div>
						)}

						<div className="allfb-form__fields">
							{(() => {
								const firstErrorId = currentFields.find(
									(f) => fieldErrors[f.id],
								)?.id;
								return currentFields.map((field) => (
									<FieldPreview
										key={field.id}
										field={field}
										value={fieldValues[field.id] ?? ''}
										error={fieldErrors[field.id] ?? ''}
										focusFirst={field.id === firstErrorId}
										onChange={(val) => onChange(field.id, val)}
									/>
								));
							})()}
						</div>

						{isLastStep && requireConsent && (
							<div className="allfb-consent-wrap">
								<label className="allfb-consent">
									<span
										className={`allfb-option__checkbox${consentChecked ? ' is-checked' : ''}`}
									/>
									<input
										type="checkbox"
										className="sr-only"
										checked={consentChecked}
										onChange={(e) => onConsentChange(e.target.checked)}
									/>
									<span className="allfb-consent__text">
										{consentText}
										{privacyPolicyUrl && (
											<>
												{' '}
												<a
													href={privacyPolicyUrl}
													target="_blank"
													rel="noopener noreferrer"
												>
													{__('Privacy Policy', 'allfeedback')}
												</a>
											</>
										)}
									</span>
								</label>
								{consentError && (
									<p className="allfb-field__error">{consentError}</p>
								)}
							</div>
						)}

						<div className="allfb-form__footer">
							{submitError && (
								<p className="allfb-form__submit-error">{submitError}</p>
							)}
							{stepIndex > 0 && (
								<button
									type="button"
									className="allfb-btn allfb-btn--secondary"
									onClick={onBack}
								>
									{settings.backLabel || __('Back', 'allfeedback')}
								</button>
							)}
							{isLastStep ? (
								<button
									type="button"
									className="allfb-btn allfb-btn--primary"
									disabled={
										isSubmitting ||
										hasSubmitted ||
										(requireConsent && !consentChecked)
									}
									onClick={onSubmit}
								>
									{hasSubmitted
										? __('Already submitted', 'allfeedback')
										: isSubmitting
											? __('Submitting\u2026', 'allfeedback')
											: settings.submitLabel || __('Submit', 'allfeedback')}
								</button>
							) : (
								<button
									type="button"
									className="allfb-btn allfb-btn--primary"
									onClick={onNext}
								>
									{settings.nextLabel || __('Next', 'allfeedback')}
								</button>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

const allFields = (sections: FormSection[]): FormField[] =>
	sections.flatMap((s) => s.fields);

const activeSections = (sections: FormSection[]) =>
	sections.filter((s) => s.fields.length > 0);

const getSiteHostname = (): string => {
	try {
		return new URL(__ALLFB_ADMIN__.adminUrl).hostname;
	} catch {
		return window.location.hostname;
	}
};

const PreviewPanel = ({
	sections,
	settings,
	device,
	onDeviceChange,
	surveyId,
	surveyStatus,
	activeSectionIndex,
	onActiveSectionChange,
}: PreviewPanelProps) => {
	const maxW = DEVICE_MAX_W[device];
	const pageMaxW = DEVICE_PAGE_W[device];
	const isMobile = device === 'mobile';
	const siteHostname = getSiteHostname();
	const queryClient = useQueryClient();

	const { data: globalSettings } = useQuery(settingsQuery());
	const cachedWidget = globalSettings?.general?.widget;

	const privacy = globalSettings?.advanced?.privacy;
	const requireConsent = !!privacy?.require_consent;
	const consentText =
		privacy?.consent_text?.trim() || DEFAULT_CONSENT_TEXT;
	const privacyPolicyUrl = privacy?.privacy_policy_url ?? '';
	const globalColor =
		cachedWidget?.color ?? __ALLFB_ADMIN__.widgetColor ?? '#6366f1';
	const globalPosition = (cachedWidget?.position ??
		(__ALLFB_ADMIN__.widgetPosition as WidgetPosition) ??
		'bottom-right') as Exclude<WidgetPosition, ''>;
	const widgetColor = globalColor;
	const widgetPosition =
		(settings.widgetPosition as Exclude<WidgetPosition, ''>) || globalPosition;

	const sessionIdRef = useRef<string>(genId());

	const [viewMode, setViewMode] = useState<PreviewView>('widget');
	const [isMinimized, setIsMinimized] = useState(false);
	const [isClosed, setIsClosed] = useState(false);
	const [fieldValues, setFieldValues] = useState<
		Record<string, string | string[]>
	>({});
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const [submitError, setSubmitError] = useState('');
	const [consentChecked, setConsentChecked] = useState(false);
	const [consentError, setConsentError] = useState('');
	const [currentStep, setCurrentStep] = useState(0);
	const [isSubmitted, setIsSubmitted] = useState(false);
	const [hasSubmitted, setHasSubmitted] = useState(false);

	const steps = activeSections(filterVisibleSections(sections, fieldValues));
	const totalSteps = steps.length;
	const hasSteps = totalSteps > 0;

	const stepIndex = Math.min(currentStep, Math.max(0, totalSteps - 1));
	const isLastStep = stepIndex === totalSteps - 1;

	// User-driven navigation in the preview — mirror it in the builder.
	const goToStep = (step: number) => {
		setCurrentStep(step);
		const id = steps[step]?.id;
		const sectionIdx = sections.findIndex((s) => s.id === id);
		if (sectionIdx >= 0) onActiveSectionChange?.(sectionIdx);
	};
	const currentFields = steps[stepIndex]?.fields ?? [];

	const submitMutation = useMutation({
		mutationFn: (data: SubmitFormData) => surveysApi.submit(surveyId!, data),
		onSuccess: () => {
			if (settings.thankYouEnabled) {
				setIsSubmitted(true);
			} else {
				setHasSubmitted(true);
				setIsMinimized(true);
			}
			setSubmitError('');
			void queryClient.invalidateQueries({ queryKey: ['responses'] });

			toast.success(
				surveyStatus === 'draft'
					? __('Form preview submitted successfully.', 'allfeedback')
					: __('Response submitted successfully.', 'allfeedback'),
			);
		},
		onError: () => {
			setSubmitError(__('Submission failed. Please try again.', 'allfeedback'));
		},
	});

	useEffect(() => {
		setFieldValues({});
		setFieldErrors({});
		setSubmitError('');
		setConsentChecked(false);
		setConsentError('');
		const activeId =
			activeSectionIndex != null && activeSectionIndex >= 0
				? sections[activeSectionIndex]?.id
				: undefined;
		setCurrentStep(
			Math.max(
				0,
				steps.findIndex((s) => s.id === activeId),
			),
		);
		setIsSubmitted(false);
	}, [
		allFields(sections)
			.map((f) => f.id)
			.join(','),
	]);

	// Sync preview page when the user interacts with a section in the canvas
	useEffect(() => {
		if (activeSectionIndex == null || activeSectionIndex < 0) return;
		const targetId = sections[activeSectionIndex]?.id;
		if (!targetId) return;
		const targetStep = steps.findIndex(
			(s) => s.id === targetId,
		);
		if (targetStep >= 0 && targetStep !== currentStep) {
			setFieldErrors({});
			setCurrentStep(targetStep);
		}
	}, [activeSectionIndex, sections]); // eslint-disable-line react-hooks/exhaustive-deps

	const handleChange = (fieldId: string, value: string | string[]) => {
		setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
		if (fieldErrors[fieldId]) {
			setFieldErrors((prev) => ({ ...prev, [fieldId]: '' }));
		}
	};

	const validateStep = (fields: typeof currentFields) => {
		const errors: Record<string, string> = {};
		fields.forEach((field) => {
			if (!field.required) return;
			const val = fieldValues[field.id];
			const empty =
				!val || (Array.isArray(val) ? val.length === 0 : !val.trim());
			if (empty)
				errors[field.id] = __('This field is required.', 'allfeedback');
		});
		return errors;
	};

	const handleNext = () => {
		const errors = validateStep(currentFields);
		if (Object.keys(errors).length) {
			setFieldErrors(errors);
			return;
		}
		setFieldErrors({});
		goToStep(stepIndex + 1);
	};

	const handleConsentChange = (checked: boolean) => {
		setConsentChecked(checked);
		if (checked) setConsentError('');
	};

	const handleSubmit = () => {
		const errors = validateStep(currentFields);
		if (Object.keys(errors).length) {
			setFieldErrors(errors);
			return;
		}
		setFieldErrors({});

		if (requireConsent && !consentChecked) {
			setConsentError(
				__('You must provide consent to submit.', 'allfeedback'),
			);
			return;
		}
		setConsentError('');

		if (surveyId) {
			const allFormFields = allFields(sections);
			const scoreField = allFormFields.find((f) =>
				['nps', 'star_rating', 'scale'].includes(f.type),
			);
			const scoreRaw = scoreField ? fieldValues[scoreField.id] : '';
			const score =
				typeof scoreRaw === 'string' && scoreRaw !== ''
					? Number(scoreRaw)
					: undefined;
			const visibleIds = new Set(allFields(steps).map((f) => f.id));
			const responseData: Record<string, unknown> = Object.fromEntries(
				allFormFields.map((f) => {
					const empty = f.type === 'checkboxes' ? [] : '';
					return [
						f.id,
						visibleIds.has(f.id) ? (fieldValues[f.id] ?? empty) : empty,
					];
				}),
			);
			submitMutation.mutate({
				nonce: __ALLFB_ADMIN__.submitNonce,
				response_data: responseData,
				...(score !== undefined && !isNaN(score) && { score }),
				page_url: window.location.href,
				device_type: device,
				session_id: sessionIdRef.current,
				...(requireConsent && { consent_given: consentChecked }),
			});
		} else {
			if (settings.thankYouEnabled) {
				setIsSubmitted(true);
			} else {
				setHasSubmitted(true);
				setIsMinimized(true);
			}
			toast.success(__('Form preview submitted successfully.', 'allfeedback'));
		}
	};

	const handleReset = () => {
		sessionIdRef.current = genId();
		submitMutation.reset();
		setIsClosed(false);
		setIsMinimized(false);
		setIsSubmitted(false);
		setHasSubmitted(false);
		setFieldValues({});
		setFieldErrors({});
		setSubmitError('');
		setConsentChecked(false);
		setConsentError('');
		setCurrentStep(0);
	};

	const sharedWidgetProps = {
		steps,
		stepIndex,
		totalSteps,
		hasSteps,
		isLastStep,
		currentFields,
		isSubmitted,
		hasSubmitted,
		fieldValues,
		fieldErrors,
		submitError,
		requireConsent,
		consentText,
		privacyPolicyUrl,
		consentChecked,
		consentError,
		onConsentChange: handleConsentChange,
		isMinimized,
		isClosed,
		settings,
		widgetPosition,
		widgetColor,
		showMinimize: true,
		isSubmitting: submitMutation.isPending,
		onMinimize: () => setIsMinimized(true),
		onClose: () => setIsClosed(true),
		onChange: handleChange,
		onNext: handleNext,
		onBack: () => {
			setFieldErrors({});
			goToStep(stepIndex - 1);
		},
		onSubmit: handleSubmit,
		onResubmit: () => {
			setIsSubmitted(false);
			setFieldValues({});
			setFieldErrors({});
			setSubmitError('');
			setConsentChecked(false);
			setConsentError('');
			setCurrentStep(0);
		},
	};

	const needsReset = isSubmitted || isClosed || hasSubmitted;

	const adminTotalPages = totalSteps + 1;
	const adminCurrentPage = isSubmitted ? totalSteps : stepIndex;

	const adminPrev = () => {
		if (isSubmitted) {
			setIsSubmitted(false);
			goToStep(totalSteps - 1);
		} else if (currentStep > 0) {
			setFieldErrors({});
			goToStep(stepIndex - 1);
		}
	};

	const adminNext = () => {
		if (!isSubmitted && stepIndex < totalSteps - 1) {
			setFieldErrors({});
			goToStep(stepIndex + 1);
		} else if (!isSubmitted && stepIndex === totalSteps - 1) {
			setIsSubmitted(true);
		}
	};

	const adminCanPrev = hasSteps && adminCurrentPage > 0;
	const adminCanNext = hasSteps && !isSubmitted;

	const pager = hasSteps ? (
		<div className="flex items-center gap-0.5">
			<Tooltip content={__('Previous page', 'allfeedback')}>
				<button
					type="button"
					onClick={adminPrev}
					disabled={!adminCanPrev}
					className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-9 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-30"
				>
					<ChevronLeft className="size-5" />
				</button>
			</Tooltip>
			<span className="text-muted-foreground min-w-[52px] text-center text-sm font-medium">
				{isSubmitted
					? __('Thanks', 'allfeedback')
					: `${stepIndex + 1} / ${adminTotalPages}`}
			</span>
			<Tooltip content={__('Next page', 'allfeedback')}>
				<button
					type="button"
					onClick={adminNext}
					disabled={!adminCanNext}
					className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-9 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-30"
				>
					<ChevronRight className="size-5" />
				</button>
			</Tooltip>
		</div>
	) : null;

	return (
		<div className="flex h-full flex-col bg-white">
			<div className="flex h-[72px] shrink-0 items-center px-6">
				<span className="text-muted-foreground flex-1 text-base font-medium">
					{__('Preview changes', 'allfeedback')}
				</span>
				<div className="flex flex-1 items-center justify-end gap-2">
					{needsReset && (
						<button
							type="button"
							onClick={handleReset}
							className="border-border/60 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors"
						>
							<RotateCw className="size-3" />
							{__('Reset', 'allfeedback')}
						</button>
					)}

					<div className="border-border/60 flex items-center rounded-lg border p-0.5">
						<button
							type="button"
							onClick={() => setViewMode('widget')}
							style={{ fontSize: '12px' }}
							className={cn(
								'flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors',
								viewMode === 'widget'
									? 'bg-primary/10 text-primary'
									: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
							)}
						>
							<MessageSquare className="size-3.5" />
							{__('Widget', 'allfeedback')}
						</button>
						<button
							type="button"
							onClick={() => setViewMode('page')}
							style={{ fontSize: '12px' }}
							className={cn(
								'flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors',
								viewMode === 'page'
									? 'bg-primary/10 text-primary'
									: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
							)}
						>
							<Globe className="size-3.5" />
							{__('Page', 'allfeedback')}
						</button>
					</div>
				</div>
			</div>

			{viewMode === 'page' ? (
				<div className="bg-background flex flex-1 flex-col overflow-hidden">
					<div className="flex flex-1 items-start justify-center overflow-hidden p-5">
						<div
							className="border-border/60 flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-md"
							style={{ width: pageMaxW ? `min(${pageMaxW}, 100%)` : '100%' }}
						>
							<div className="shrink-0 bg-[#dee1e6] select-none">
								<div className="flex items-end px-3 pt-2">
									<div className="flex shrink-0 items-center gap-[5px] pr-3 pb-[6px]">
										<span className="size-[11px] rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.12)]" />
										<span className="size-[11px] rounded-full bg-[#ffbd2e] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.12)]" />
										<span className="size-[11px] rounded-full bg-[#28c840] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.12)]" />
									</div>

									<div className="flex max-w-[172px] min-w-0 items-center gap-1.5 rounded-t-[7px] bg-white px-2.5 pt-[5px] pb-[6px]">
										<Globe className="text-muted-foreground/50 size-3 shrink-0" />
										<span className="text-foreground/70 min-w-0 flex-1 truncate text-[8.5px]">
											{siteHostname}
										</span>
										<X className="text-muted-foreground/35 size-2.5 shrink-0" />
									</div>

									<div className="text-foreground/40 ml-3 flex size-[18px] items-center justify-center self-center rounded">
										<Plus className="size-3" />
									</div>
								</div>

								<div className="flex items-center gap-0.5 px-2 pt-2 pb-2">
									<div className="text-foreground/20 flex size-[22px] items-center justify-center rounded-full">
										<ArrowLeft className="size-3.5" />
									</div>
									<div className="text-foreground/20 flex size-[22px] items-center justify-center rounded-full">
										<ArrowRight className="size-3.5" />
									</div>
									<div className="text-foreground/50 flex size-[22px] items-center justify-center rounded-full">
										<RotateCw className="size-3" />
									</div>

									<div className="mx-1.5 flex flex-1 items-center gap-1.5 rounded-full bg-white/95 px-3 py-[3px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.10),0_1px_2px_rgba(0,0,0,0.06)]">
										<Lock className="size-2.5 shrink-0 text-[#1e8e3e]" />
										<span className="text-foreground/70 min-w-0 flex-1 truncate text-center text-[8.5px]">
											{siteHostname}
										</span>
										<Star className="text-muted-foreground/30 size-2.5 shrink-0" />
									</div>

									<div className="text-foreground/50 flex size-[22px] items-center justify-center rounded-full">
										<MoreHorizontal className="size-3.5" />
									</div>
								</div>
							</div>

							<div className="allfb-preview-bg relative flex-1 overflow-hidden">
								<div className="pointer-events-none absolute inset-0 flex flex-col overflow-hidden">
									<div className="flex h-9 shrink-0 items-center gap-3 border-b border-black/5 bg-white px-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
										<div className="bg-foreground/10 h-2.5 w-14 rounded-full" />
										<div className="flex flex-1 items-center justify-end gap-2.5">
											<div className="bg-foreground/8 h-1.5 w-7 rounded-full" />
											<div className="bg-foreground/8 h-1.5 w-7 rounded-full" />
											<div className="bg-foreground/8 h-1.5 w-7 rounded-full" />
										</div>
									</div>
									<div className="flex flex-1 justify-center overflow-hidden">
										<div className="w-full max-w-[480px]">
											<p className="text-foreground/30 px-4 pt-4 text-center text-[7px] leading-snug font-medium tracking-wide">
												{__(
													'Approximate preview — styling may vary on your live site',
													'allfeedback',
												)}
											</p>
											<div className="mt-4 grid grid-cols-3 gap-2 px-4">
												{[0, 1, 2].map((i) => (
													<div
														key={i}
														className="rounded-lg bg-white/75 p-2 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
													>
														<div className="bg-foreground/[0.06] mb-1.5 h-7 rounded-md" />
														<div className="bg-foreground/[0.08] mb-1 h-1.5 rounded-full" />
														<div className="bg-foreground/[0.06] h-1.5 w-3/4 rounded-full" />
													</div>
												))}
											</div>
										</div>
									</div>
								</div>

								{!isMobile &&
									(widgetPosition === 'side-tab' ? (
										/* Side-tab launcher — always visible, matches the frontend's vertical pill */
										<div
											className={cn(
												'transition-all duration-200',
												!isClosed
													? 'opacity-100'
													: 'pointer-events-none opacity-0',
											)}
											style={{
												position: 'absolute',
												top: '50%',
												right: 0,
												transform: 'translateY(-50%)',
											}}
										>
											<button
												type="button"
												onClick={() => setIsMinimized((v) => !v)}
												className={cn(
													'flex items-center justify-center transition-all duration-200',
													!isClosed ? 'scale-100' : 'scale-90',
												)}
												style={{
													backgroundColor: widgetColor,
													padding: '10px 8px',
													borderRadius: '8px 0 0 8px',
													boxShadow: '-2px 4px 12px rgba(0,0,0,0.15)',
													transformOrigin: 'right center',
												}}
												aria-label={__('Open feedback widget', 'allfeedback')}
											>
												<span
													style={{
														writingMode: 'vertical-rl',
														transform: 'rotate(180deg)',
														fontSize: '13px',
														fontWeight: 600,
														letterSpacing: '0.06em',
														whiteSpace: 'nowrap',
														userSelect: 'none',
														color: '#fff',
													}}
												>
													{settings.widgetLabel ||
														__('Feedback', 'allfeedback')}
												</span>
											</button>
										</div>
									) : (
										/* Round launcher — bottom-left / bottom-right, always visible */
										<button
											type="button"
											onClick={() => setIsMinimized((v) => !v)}
											className={cn(
												'flex size-12 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95',
												!isClosed
													? 'scale-100 opacity-100'
													: 'pointer-events-none scale-75 opacity-0',
											)}
											style={{
												position: 'absolute',
												backgroundColor: widgetColor,
												...(widgetPosition === 'bottom-right'
													? {
															bottom: '20px',
															right: '16px',
															transformOrigin: 'bottom right',
														}
													: {
															bottom: '20px',
															left: '16px',
															transformOrigin: 'bottom left',
														}),
											}}
											aria-label={__('Open feedback widget', 'allfeedback')}
										>
											{(() => {
												const TriggerIcon =
													TRIGGER_ICON_MAP[settings.triggerIcon] ??
													MessageSquare;
												return <TriggerIcon className="size-5 text-white" />;
											})()}
										</button>
									))}

								<div
									className={cn(
										(isClosed || isMinimized) && 'pointer-events-none',
									)}
									style={
										isMobile
											? {
													/* Mobile: bottom-sheet — full width with side breathing room */
													position: 'absolute',
													bottom: 0,
													left: '10px',
													right: '10px',
													width: 'auto',
												}
											: {
													position: 'absolute',
													width: `min(${maxW}, calc(100% - 2rem))`,
													// bottom positions: 20px launcher bottom + 48px launcher height + 12px gap = 80px
													// side-tab: ~34px launcher width + 10px gap = 44px from right edge
													...(widgetPosition === 'bottom-right'
														? { bottom: '80px', right: '16px' }
														: widgetPosition === 'bottom-left'
															? { bottom: '80px', left: '16px' }
															: {
																	top: '50%',
																	right: '44px',
																	transform: 'translateY(-50%)',
																}),
												}
									}
								>
									<WidgetBody
										{...sharedWidgetProps}
										showControls={true}
										showMinimize={!isMobile}
										className={
											isMobile ? 'rounded-t-2xl rounded-b-none' : undefined
										}
									/>
								</div>
							</div>
						</div>
					</div>
				</div>
			) : (
				<div className="bg-background/50 flex flex-1 items-center justify-center overflow-hidden px-7 py-8">
					<div style={{ width: `min(${maxW}, 100%)` }}>
						<WidgetBody
							{...sharedWidgetProps}
							showControls={true}
							showMinimize={false}
							isMinimized={false}
							isClosed={false}
							onMinimize={() => {}}
							onClose={() => {}}
						/>
						{pager && (
							<div className="mt-3 flex justify-center">{pager}</div>
						)}
					</div>
				</div>
			)}

			<div className="border-border flex shrink-0 items-center border-t px-4 py-3">
				<div className="flex flex-1" />
				<div
					className={cn(
						'flex items-center gap-1 transition-opacity',
						viewMode === 'widget' && 'pointer-events-none opacity-35',
					)}
				>
					{DEVICES.map(({ value, Icon, label }) => (
						<Tooltip key={value} content={label}>
							<button
								type="button"
								onClick={() => onDeviceChange(value)}
								className={cn(
									'flex size-8 items-center justify-center rounded-lg transition-colors',
									device === value
										? 'bg-primary/10 text-primary'
										: 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
								)}
							>
								<Icon className="size-4" />
							</button>
						</Tooltip>
					))}
				</div>
				<div className="flex flex-1 items-center justify-end">
					{viewMode === 'page' && pager}
				</div>
			</div>
		</div>
	);
};

export default PreviewPanel;
