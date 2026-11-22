declare const __ALLFB_ADMIN__: {

	adminUrl: string;

	adminEmail: string;

	widgetColor: string;

	widgetPosition: string;

	pluginUrl: string;

	buildUrl: string;

	currentUserId: number;

	isAdmin: boolean;

	nonce: string;

	submitNonce: string;

	// Plugin
	version: string;

	// WordPress Environment
	homeUrl: string;

	siteUrl: string;

	wpVersion: string;

	isMultisite: boolean;

	wpMemoryLimit: string;

	debug: boolean;

	wpCron: boolean;

	language: string;

	extObjectCache: boolean;

	// Server Environment
	serverInfo: string;

	mysqlVersion: string;

	phpVersion: string;

	defaultTimezone: string;

	phpPostMaxSize: string;

	phpTimeLimit: string;

	curlVersion: string | null;

	hasFsockopen: boolean;

	hasGzip: boolean;

	hasDomDocument: boolean;

	hasMultibyte: boolean;

	wizardStatus: 'not_started' | 'pending_redirect' | 'initiated' | 'completed';
};

/** Shared with add-ons such as AllFeedback Pro — see admin/index.tsx. */
interface Window {
	AllFeedback?: {
		components?: Record<string, unknown>;
		utils?: Record<string, unknown>;
	};
}
