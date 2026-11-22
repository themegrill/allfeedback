declare let __webpack_public_path__: string;
__webpack_public_path__ = __ALLFB_ADMIN__.buildUrl;

import { WIZARD_STATUS_QUERY_KEY } from '@/admin/api/wizard';
import { Tooltip } from '@/admin/components/Tooltip';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Toaster } from '@/components/ui/sonner';
import { queryClient } from '@/lib/query-client';
import { cn, htmlToText } from '@/lib/utils';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from '@tanstack/react-router';
import apiFetch from '@wordpress/api-fetch';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles/admin.pcss';
import { createRouter } from './router';

export const router = createRouter();

// UI building blocks shared with add-ons (e.g. AllFeedback Pro), so their
// builder panels match free's look. Treat as a public API.
window.AllFeedback = {
	...window.AllFeedback,
	components: {
		Button,
		Input,
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
		SelectValue,
		Tooltip,
	},
	utils: { cn, htmlToText },
};

document.addEventListener('DOMContentLoaded', () => {

	apiFetch.use(apiFetch.createNonceMiddleware(__ALLFB_ADMIN__.nonce));

	queryClient.setQueryData(WIZARD_STATUS_QUERY_KEY, { status: __ALLFB_ADMIN__.wizardStatus });

	const rootElement = document.getElementById('ALLFB-Admin-Root');

	if (!rootElement) {
		console.warn('[RMB] Admin: Root element #ALLFB-Admin-Root not found.');
		return;
	}

	createRoot(rootElement).render(
		<StrictMode>
			<ErrorBoundary>
				<QueryClientProvider client={queryClient}>
					<RouterProvider router={router} />
					<Toaster closeButton position="bottom-center" />
					<ReactQueryDevtools initialIsOpen={false} />
				</QueryClientProvider>
			</ErrorBoundary>
		</StrictMode>,
	);
});
