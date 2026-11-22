export interface WidgetState {
	impressions:  number;
	submitted:    boolean;
	dismissed_at: number | null;
}

export interface SurveyConfig {
	id:                 number;
	is_logged_in:       boolean;
	show_to?:           'all' | 'logged_in' | 'logged_out';
	display_frequency?: 'once' | 'until_submit';
	max_impressions?:   number;
	reshow_after_days?: number;
	server_state?:      WidgetState;
	trigger_icon?:      'message' | 'chat' | 'smile' | 'star' | 'pen';
	widget_position?:   'bottom-right' | 'bottom-left' | 'side-tab';
	widget_color?:      string;
	widget_label?:      string;
}

export interface AllfbSettings {
	color:              string;
	position:           'bottom-right' | 'bottom-left' | 'side-tab';
	trigger:            'auto' | 'scroll' | 'exit-intent' | 'manual';
	delay:              number;
	scroll_threshold:   number;
	show_on_mobile:     boolean;
	survey_id?:         number;
	survey_configs?:    SurveyConfig[];
	require_consent?:    boolean;
	consent_text?:       string;
	privacy_policy_url?: string;
}

export interface AllfbConfig {
	siteUrl:     string;
	restUrl:     string;
	nonce:       string;
	submitNonce: string;
	version:     string;
	settings:    AllfbSettings;
}

export interface SurveyField {
	id:              string;
	type:            'short_text' | 'long_text' | 'radio' | 'checkboxes' | 'star_rating' | 'scale' | 'nps';
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
	settings?:       Record<string, unknown>;
}

export interface FormSection {
	id:     string;
	title:  string;
	fields: SurveyField[];
}

export interface FormSchema {
	version:  string;
	sections: FormSection[];
}

export interface SurveySettings {
	thankYouEnabled?:     boolean;
	thankYouTitle?:       string;
	thankYouDescription?: string;
	submitLabel?:         string;
	nextLabel?:           string;
	backLabel?:           string;
	submit_label?:        string;
	next_label?:          string;
	back_label?:          string;
	progressIndicator?:   'dots' | 'numbers' | 'bar' | 'none';
	triggerIcon?:         'message' | 'chat' | 'smile' | 'star' | 'pen';
}

export interface Survey {
	id:          number;
	title:       string;
	form_schema: FormSchema | SurveyField[] | null;
	settings:    SurveySettings | null;
}

export interface NormalizedSettings {
	submitLabel:         string;
	nextLabel:           string;
	backLabel:           string;
	thankYouEnabled:     boolean;
	thankYouTitle:       string;
	thankYouDescription: string;
	progressIndicator:   'dots' | 'numbers' | 'bar' | 'none';
	triggerIcon:         'message' | 'chat' | 'smile' | 'star' | 'pen';
}
