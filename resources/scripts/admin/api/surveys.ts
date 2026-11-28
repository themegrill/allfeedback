import { request, toQuery } from './client';
import type { PaginatedMeta, PaginationParams } from './client';

export type SurveyStatus = 'draft' | 'published' | 'paused' | 'archived' | 'trashed';

export type Survey = {
	id:              number;
	title:           string;
	description:     string;
	form_schema:     SurveyFormSchema | null;
	settings:        Record<string, unknown> | null;
	styling:         Record<string, unknown> | null;
	status:          SurveyStatus;
	conflict_reason: string | null;
	/** Add-on features this form needs that aren't active; the form is offline while non-empty. */
	missing_features?: string[];
	response_count:  number;
	created_by:      number;
	created_at:      string;
	updated_at:      string | null;
};

export type SurveyFormSchemaField = {
	id:       string;
	type:     string;
	label:    string;
	required: boolean;
	settings: Record<string, unknown>;
};

export type SurveyFormSchemaSection = {
	id:     string;
	title:  string;
	fields: SurveyFormSchemaField[];
};

export type SurveyFormSchema = {
	version:   string;
	sections:  SurveyFormSchemaSection[];
	/** Add-on features the form uses, e.g. 'conditional-logic'. */
	requires?: string[];
};

export type SurveyListResponse = PaginatedMeta & {
	surveys: Survey[];
};

export type SurveyListParams = PaginationParams & {
	search?:  string;
	status?:  string;
	orderby?: string;
	order?:   'ASC' | 'DESC';
};

export type CreateSurveyData = {
	title:        string;
	description?: string;
	form_schema?: SurveyFormSchema;
	settings?:    Record<string, unknown>;
	styling?:     Record<string, unknown>;
	targeting?:   unknown[];
};

export type UpdateSurveyData = Partial<CreateSurveyData> & {
	status?: SurveyStatus;
};

export type TrashSurveyResponse = {
	trashed: boolean;
	id:      number;
};

export type DeleteSurveyResponse = {
	deleted: boolean;
	id:      number;
};

export type BulkTrashResponse = {
	trashed: number;
	skipped: number[];
	failed:  number[];
};

export type BulkDeleteResponse = {
	deleted: number;
	skipped: number[];
	failed:  number[];
};

export type SurveyResponse = {
	id:            number;
	survey_id:     number;
	response_data: Record<string, unknown> | null;
	score:         number | null;
	page_url:      string | null;
	device_type:   string | null;
	user_id:       number | null;
	consent_given: boolean;
	is_read:       boolean;
	ip_address:    string | null;
	created_at:    string;
};

export type ResponseListResponse = PaginatedMeta & {
	responses: SurveyResponse[];
};

export type ResponseListParams = PaginationParams & {
	date_from?: string;
	date_to?:   string;
	search?:    string;
	sort_by?:   'id' | 'created_at' | 'score';
	order?:     'ASC' | 'DESC';
	is_read?:   boolean;
};

export type DeleteResponseResult = {
	deleted: boolean;
	id:      number;
};

export type BulkDeleteResponsesResult = {
	deleted: number;
	failed:  number[];
};

export type BulkMarkReadResult = {
	updated: number;
	failed:  number[];
};

export type UpdateResponseData = {
	response_data?: Record<string, unknown> | null;
	is_read?:       boolean;
};

export type SubmitFormData = {
	nonce:         string;
	response_data: Record<string, unknown>;
	score?:        number;
	page_url?:     string;
	device_type?:  string;
	session_id?:   string;
	consent_given?: boolean;
};

export type SubmitFormResult = {
	id:         number;
	survey_id:  number;
	created_at: string;
};

export type ContentSearchItem = {
	id:    number;
	title: string;
	type:  string;
	url:   string;
};

export type ContentSearchResponse = PaginatedMeta & {
	items: ContentSearchItem[];
};

export type ContentSearchParams = {
	search?:    string;
	post_type?: string;
	page?:      number;
	per_page?:  number;
};

export type SurveyExportItem = {
	title:       string;
	description: string;
	form_schema: SurveyFormSchema | Record<string, unknown> | unknown[];
	settings:    Record<string, unknown> | unknown[];
	styling:     Record<string, unknown> | unknown[];
};

export type SurveyExportBundle = {
	plugin:      'allfeedback';
	version:     string;
	exported_at: string;
	surveys:     SurveyExportItem[];
};

export type SurveyImportResult = {
	imported: number;
	surveys:  Survey[];
	failed:   { index: number; title: string; reason: string }[];
};

export const surveysApi = {
	list: (params?: SurveyListParams) =>
		request<SurveyListResponse>('/surveys' + toQuery(params)),

	get: (id: number) =>
		request<Survey>(`/surveys/${id}`),

	create: (data: CreateSurveyData) =>
		request<Survey>('/surveys', { method: 'POST', data }),

	update: (id: number, data: UpdateSurveyData) =>
		request<Survey>(`/surveys/${id}`, { method: 'PUT', data }),

	trash: (id: number) =>
		request<TrashSurveyResponse>(`/surveys/${id}/trash`, { method: 'DELETE' }),

	delete: (id: number) =>
		request<DeleteSurveyResponse>(`/surveys/${id}/delete`, { method: 'DELETE' }),

	bulkTrash: (ids: number[]) =>
		request<BulkTrashResponse>('/surveys/trash', { method: 'DELETE', data: { ids } }),

	bulkDelete: (ids: number[]) =>
		request<BulkDeleteResponse>('/surveys/delete', { method: 'DELETE', data: { ids } }),

	duplicate: (id: number) =>
		request<Survey>(`/surveys/${id}/duplicate`, { method: 'POST' }),

	publish: (id: number) =>
		request<Survey>(`/surveys/${id}/publish`, { method: 'POST' }),

	pause: (id: number) =>
		request<Survey>(`/surveys/${id}/pause`, { method: 'POST' }),

	export: (ids: number[]) =>
		request<SurveyExportBundle>('/surveys/export' + toQuery({ ids: ids.join(',') })),

	import: (surveys: unknown[]) =>
		request<SurveyImportResult>('/surveys/import', { method: 'POST', data: { surveys } }),

	contentSearch: (params?: ContentSearchParams) =>
		request<ContentSearchResponse>('/content-search' + toQuery(params)),

	listAllResponses: (params?: ResponseListParams) =>
		request<ResponseListResponse>('/responses' + toQuery(params)),

	listResponses: (surveyId: number, params?: ResponseListParams) =>
		request<ResponseListResponse>(`/surveys/${surveyId}/responses` + toQuery(params)),

	getResponse: (surveyId: number, responseId: number) =>
		request<SurveyResponse>(`/surveys/${surveyId}/responses/${responseId}`),

	updateResponse: (surveyId: number, responseId: number, data: UpdateResponseData) =>
		request<SurveyResponse>(`/surveys/${surveyId}/responses/${responseId}`, { method: 'PUT', data }),

	deleteResponse: (surveyId: number, responseId: number) =>
		request<DeleteResponseResult>(`/surveys/${surveyId}/responses/${responseId}`, { method: 'DELETE' }),

	bulkDeleteResponses: (ids: number[]) =>
		request<BulkDeleteResponsesResult>('/responses/delete', { method: 'DELETE', data: { ids } }),

	bulkMarkResponsesRead: (ids: number[]) =>
		request<BulkMarkReadResult>('/responses/mark-read', { method: 'POST', data: { ids } }),

	bulkMarkResponsesUnread: (ids: number[]) =>
		request<BulkMarkReadResult>('/responses/mark-unread', { method: 'POST', data: { ids } }),

	getUnreadCount: () =>
		request<{ count: number }>('/responses/unread-count'),

	submit: (surveyId: number, data: SubmitFormData) =>
		request<SubmitFormResult>(`/surveys/${surveyId}/submit`, { method: 'POST', data }),
};
