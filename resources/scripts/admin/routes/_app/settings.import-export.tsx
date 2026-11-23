import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/settings/import-export')({
	component: lazyRouteComponent(() => import('@/admin/pages/settings/ImportExportSettings')),
});
