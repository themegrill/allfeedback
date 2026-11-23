import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/tools/import-export')({
	component: lazyRouteComponent(() => import('@/admin/pages/tools/ImportExport')),
});
