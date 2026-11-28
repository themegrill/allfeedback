import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { __ } from '@wordpress/i18n';
import { ArrowLeftRight, Info, ScrollText, Wand2 } from 'lucide-react';

declare const __ALLFB_ADMIN__: { debug: boolean };

type NavItem = {
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	to:
		| '/tools/system-info'
		| '/tools/logs'
		| '/tools/import-export'
		| '/tools/dev-tools';
};

const NAV_ITEMS: NavItem[] = [
	{
		label: __('System Info', 'allfeedback'),
		icon: Info,
		to: '/tools/system-info',
	},
	{
		label: __('Logs', 'allfeedback'),
		icon: ScrollText,
		to: '/tools/logs',
	},
	{
		label: __('Import / Export', 'allfeedback'),
		icon: ArrowLeftRight,
		to: '/tools/import-export',
	},
	...( __ALLFB_ADMIN__.debug ? [{
		label: __('Dev Tools', 'allfeedback'),
		icon: Wand2,
		to: '/tools/dev-tools' as const,
	}] : [] ),
];

const Tools = () => {
	const isNavigating = useRouterState({ select: (s) => s.isLoading });
	return (
	<div className="p-6 md:p-8">
		<div className="mx-auto max-w-[1340px]">
			<div className="flex flex-col gap-6 lg:flex-row lg:items-start">
				<nav
					aria-label={__('Tools navigation', 'allfeedback')}
					className="border-border/60 flex gap-1 overflow-x-auto rounded-2xl border bg-white p-3 lg:w-64 lg:shrink-0 lg:flex-col lg:gap-1"
				>
					{NAV_ITEMS.map(({ label, icon: Icon, to }) => (
						<Link
							key={to}
							to={to}
							className="group text-foreground/70 hover:bg-muted/60 hover:text-foreground data-[status=active]:bg-primary/10 data-[status=active]:text-primary flex shrink-0 cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-base font-medium transition-colors lg:w-full"
						>
							<Icon className="text-muted-foreground/50 group-data-[status=active]:text-primary size-[18px] shrink-0 transition-colors" />
							{label}
						</Link>
					))}
				</nav>

				<div className={cn(
					'min-w-0 flex-1 overflow-hidden rounded-2xl border border-border/60 bg-white transition-opacity duration-200',
					isNavigating && 'pointer-events-none opacity-50',
				)}>
					<Outlet />
				</div>
			</div>
		</div>
	</div>
	);
};

export default Tools;
