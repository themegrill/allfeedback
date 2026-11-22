export type FieldType =
	| 'short_text'
	| 'long_text'
	| 'email'
	| 'radio'
	| 'checkboxes'
	| 'star_rating'
	| 'scale'
	| 'nps';

export interface FormField {
	id: string;
	type: FieldType;
	label: string;
	required: boolean;
	placeholder?: string;
	options?: string[];
	starScale?: 'star' | 'number';
	starRange?: 5 | 10;
	scaleMin?: number;
	scaleMax?: number;
	scaleLowLabel?: string;
	scaleHighLabel?: string;
	/** Settings added by extensions; saved and loaded untouched. */
	settings?: Record<string, unknown>;
}

export interface FormSection {
	id: string;
	title: string;
	fields: FormField[];
}

export type TargetDevice      = 'all' | 'desktop' | 'tablet' | 'mobile';
export type TargetPages       = 'all' | 'specific_pages' | 'specific_posts';
export type UserState         = 'all' | 'logged_in' | 'logged_out';
export type TriggerType       = 'immediate' | 'time_delay' | 'scroll_depth';
export type DelayUnit         = 'seconds' | 'minutes' | 'hours';
export type DisplayFrequency  = 'once' | 'until_submit';
export type DismissUnit       = 'hours' | 'days' | 'weeks';
export type ProgressIndicator = 'dots' | 'numbers' | 'bar' | 'none';
export type TriggerIcon       = 'message' | 'chat' | 'smile' | 'star' | 'pen';
export type WidgetPosition = '' | 'bottom-right' | 'bottom-left' | 'side-tab';

export interface FormSettings {
	thankYouEnabled: boolean;
	thankYouTitle: string;
	thankYouDescription: string;
	submitLabel: string;
	nextLabel: string;
	backLabel: string;
	targetDevice: TargetDevice;
	targetPages: TargetPages;
	targetUrls: string;

	userState: UserState;
	targetPageIds: { id: number; title: string }[];
	targetPostIds: { id: number; title: string }[];
	triggerType: TriggerType;
	delayValue: number;
	delayUnit: DelayUnit;
	scrollDepth: number;
	displayFrequency: DisplayFrequency;
	maxImpressions: number;
	dismissWaitValue: number;
	dismissWaitUnit: DismissUnit;
	progressIndicator: ProgressIndicator;
	triggerIcon: TriggerIcon;
	widgetPosition: WidgetPosition;
	widgetLabel: string;
}

export const DEFAULT_CONSENT_TEXT =
	'I agree to the storage and handling of my data.';

export const DEFAULT_FORM_SETTINGS: FormSettings = {
	thankYouEnabled: true,
	thankYouTitle: 'Thank you!',
	thankYouDescription: 'Your response has been recorded.',
	submitLabel: 'Submit',
	nextLabel: 'Next',
	backLabel: 'Back',
	targetDevice: 'all',
	targetPages: 'all',
	targetUrls: '',
	userState: 'all',
	targetPageIds: [],
	targetPostIds: [],
	triggerType: 'immediate',
	delayValue: 0,
	delayUnit: 'seconds',
	scrollDepth: 50,
	displayFrequency: 'until_submit',
	maxImpressions: 3,
	dismissWaitValue: 3,
	dismissWaitUnit: 'days',
	progressIndicator: 'dots',
	triggerIcon: 'message',
	widgetPosition: '',
	widgetLabel: '',
};

export type PreviewMode   = 'widget' | 'page' | 'success';
export type PreviewDevice = 'desktop' | 'tablet' | 'mobile';
export type BuilderTab    = 'builder' | 'settings' | 'styling';
