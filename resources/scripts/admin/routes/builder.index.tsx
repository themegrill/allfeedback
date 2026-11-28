import NotFound from '@/admin/pages/NotFound';
import { surveyQuery } from '@/admin/queries/surveys';
import { getInitialPreviewWidth } from '@/admin/pages/forms/builder/previewWidth';
import { createFileRoute, lazyRouteComponent, notFound } from '@tanstack/react-router';

const BuilderPending = () => (
	<div className="allfb-builder fixed inset-0 z-[99999] flex flex-col bg-background">
		<header className="flex h-[68px] shrink-0 items-center justify-between border-b border-border bg-white px-6">
			<div className="flex flex-1 items-center gap-2">
				<div className="size-8 animate-pulse rounded-lg bg-muted/60" />
				<span className="h-5 w-px bg-border" />
				<div className="h-7 w-64 animate-pulse rounded-lg bg-muted/60" />
			</div>
			<div className="flex items-center gap-3">
				<div className="flex gap-0.5">
					<div className="size-8 animate-pulse rounded-lg bg-muted/60" />
					<div className="size-8 animate-pulse rounded-lg bg-muted/60" />
				</div>
				<div className="h-10 w-28 animate-pulse rounded-lg bg-muted/60" />
			</div>
		</header>

		<div className="flex flex-1 overflow-hidden">

			<div className="flex flex-1 flex-col overflow-hidden">
				<div className="flex h-[72px] shrink-0 items-center justify-center border-b border-border/40 bg-white px-8">
					{[60, 66, 56].map((w, i) => (
						<div key={i} className="flex items-center">
							{i > 0 && <div className="mx-4 h-px w-12 shrink-0 bg-border/50" />}
							<div className="flex items-center gap-2.5">
								<div className="size-10 shrink-0 animate-pulse rounded-full bg-muted/60" />
								<div className="h-3.5 animate-pulse rounded bg-muted/60" style={{ width: w }} />
							</div>
						</div>
					))}
				</div>

				<div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-background p-7">
					{[1, 2].map((n) => (
						<div key={n} className="overflow-hidden rounded-2xl border border-border/60 bg-white">
							<div className="flex items-center gap-3 border-b border-border/50 bg-white px-5 py-4">
								<div className="size-4 animate-pulse rounded bg-muted/60" />
								<div className="h-5 w-32 animate-pulse rounded bg-muted/60" />
							</div>
							<div className="space-y-3 p-5">
								<div className="h-20 animate-pulse rounded-xl bg-muted/60" />
								<div className="h-10 animate-pulse rounded-lg bg-muted/60" />
							</div>
						</div>
					))}
				</div>
			</div>

			<div className="relative flex w-0.5 shrink-0 items-center justify-center">
				<div className="h-full w-0.5 bg-border" />
				<div className="absolute flex h-7 w-5 items-center justify-center rounded-full border border-border bg-background shadow-sm">
					<div className="h-3.5 w-0.5 rounded-full bg-foreground/35" />
				</div>
			</div>

			<div className="shrink-0 bg-background px-7 pb-6 pt-7" style={{ width: getInitialPreviewWidth() }}>
				<div className="h-full animate-pulse rounded-2xl bg-muted/60" />
			</div>
		</div>
	</div>
);

const BuilderNotFound = () => (
	<div
		className="flex items-center justify-center bg-background"
		style={{ height: 'calc(100vh - var(--wp-admin--admin-bar--height, 32px))' }}
	>
		<NotFound />
	</div>
);

export const Route = createFileRoute('/builder/')({
	validateSearch: (search: Record<string, unknown>) => {

		let rawId = search.id;
		if ((rawId === undefined || rawId === null) && typeof window !== 'undefined') {
			const qi = window.location.hash.indexOf('?');
			if (qi !== -1) {
				rawId = new URLSearchParams(window.location.hash.slice(qi + 1)).get('id') ?? undefined;
			}
		}
		const numId = rawId !== undefined && rawId !== null ? Number(rawId) : undefined;

		let rawNew = search.new;
		if ((rawNew === undefined || rawNew === null) && typeof window !== 'undefined') {
			const qi = window.location.hash.indexOf('?');
			if (qi !== -1) {
				rawNew = new URLSearchParams(window.location.hash.slice(qi + 1)).get('new') ?? undefined;
			}
		}

		return {
			new: rawNew === true || rawNew === 'true',

			id:  numId !== undefined && !Number.isNaN(numId) ? numId : undefined,
		};
	},

	loaderDeps: ({ search }) => ({ id: search.id }),

	loader: async ({ context: { queryClient }, deps: { id } }) => {
		if (id !== undefined && !Number.isNaN(id)) {
			const result = await queryClient.ensureQueryData(surveyQuery(id)).catch(() => null);
			if (!result) throw notFound();
		}
	},

	component:          lazyRouteComponent(() => import('@/admin/pages/forms/FormBuilder')),
	notFoundComponent:  BuilderNotFound,
	pendingComponent:   BuilderPending,
	pendingMs:          100,
	pendingMinMs:       300,
});
