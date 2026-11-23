import type { Settings as SettingsData } from '@/admin/api/settings';
import { settingsApi } from '@/admin/api/settings';
import { settingsQuery } from '@/admin/queries/settings';
import type { FileRoutesByFullPath } from '@/admin/routeTree.gen';
import { Button } from '@/components/ui/button';
import { deepMerge } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, useBlocker } from '@tanstack/react-router';
import { __ } from '@wordpress/i18n';
import { Loader2, Mail, Settings2, SlidersHorizontal } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';

const isMac =
	typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

type SettingsPath = Exclude<
	Extract<keyof FileRoutesByFullPath, `/settings/${string}`>,
	'/settings/'
>;

type NavItem = {
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	to: SettingsPath;
};

const NAV_ITEMS: NavItem[] = [
	{
		label: __('General', 'allfeedback'),
		icon: Settings2,
		to: '/settings/general',
	},
	{
		label: __('Email', 'allfeedback'),
		icon: Mail,
		to: '/settings/email',
	},
	{
		label: __('Advanced', 'allfeedback'),
		icon: SlidersHorizontal,
		to: '/settings/advanced',
	},
];

type SettingsDirtyCtx = {
	isDirty: boolean;
	isSaving: boolean;
	setDirty: (key: string, dirty: boolean) => void;
	patches: Record<string, Record<string, unknown>>;
	setPatch: (key: string, patch: Record<string, unknown> | null) => void;
	resetDirty: () => void;
};

export const SettingsDirtyContext = createContext<SettingsDirtyCtx>({
	isDirty: false,
	isSaving: false,
	setDirty: () => {},
	patches: {},
	setPatch: () => {},
	resetDirty: () => {},
});

export const useSettingsDirty = () => useContext(SettingsDirtyContext);

const Settings = () => {
	const queryClient = useQueryClient();
	const [dirtyMap, setDirtyMap] = useState<Record<string, boolean>>({});
	const [patchMap, setPatchMap] = useState<
		Record<string, Record<string, unknown>>
	>({});
	const anyDirty = Object.values(dirtyMap).some(Boolean);

	const setDirty = useCallback((key: string, dirty: boolean) => {
		setDirtyMap((prev) => ({ ...prev, [key]: dirty }));
	}, []);

	const resetDirty = useCallback(() => {
		setDirtyMap({});
		setPatchMap({});
	}, []);

	const setPatch = useCallback(
		(key: string, patch: Record<string, unknown> | null) => {
			setPatchMap((prev) => {
				if (patch === null) {
					const next = { ...prev };
					delete next[key];
					return next;
				}
				return { ...prev, [key]: patch };
			});
		},
		[],
	);

	const { mutate, isPending: isSaving } = useMutation({
		mutationFn: settingsApi.update,
		onSuccess: (updated) => {
			queryClient.setQueryData(settingsQuery().queryKey, updated);
			resetDirty();
			toast.success(__('Settings saved successfully.', 'allfeedback'));
		},
		onError: () => {
			toast.error(
				__('Failed to save settings. Please try again.', 'allfeedback'),
			);
		},
	});

	const save = useCallback(() => {
		const cached = queryClient.getQueryData<SettingsData>(
			settingsQuery().queryKey,
		);
		const full = deepMerge(
			(cached ?? {}) as Record<string, unknown>,
			...Object.values(patchMap),
		);
		mutate(full as SettingsData);
	}, [queryClient, patchMap, mutate]);

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 's') {
				e.preventDefault();
				save();
			}
		};
		document.addEventListener('keydown', handler);
		return () => document.removeEventListener('keydown', handler);
	}, [save]);

	useBlocker({
		shouldBlockFn: ({ next }) => {
			if (!anyDirty) return false;
			if (next.pathname.startsWith('/settings')) return false;
			return !window.confirm(
				__(
					'You have unsaved changes. Are you sure you want to leave?',
					'allfeedback',
				),
			);
		},
		enableBeforeUnload: () => anyDirty,
	});

	return (
		<SettingsDirtyContext.Provider
			value={{
				isDirty: anyDirty,
				isSaving,
				setDirty,
				patches: patchMap,
				setPatch,
				resetDirty,
			}}
		>
			<div className="p-6 md:p-8">
				<div className="mx-auto max-w-[1340px]">
					<div className="flex flex-col gap-6 lg:flex-row lg:items-start">
						<nav
							aria-label={__('Settings navigation', 'allfeedback')}
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

						<div className="border-border/60 min-w-0 flex-1 overflow-hidden rounded-2xl border bg-white">
							<Outlet />
							<div className="border-border/50 flex items-center justify-end gap-3 border-t px-6 py-4">
								{!isSaving && (
									<span className="flex items-center gap-1">
										{(isMac ? ['⌘', 'S'] : ['Ctrl', 'S']).map((k) => (
											<kbd
												key={k}
												className="border-border bg-muted/60 text-2xs text-muted-foreground/60 rounded border px-1.5 py-0.5 leading-none font-medium"
											>
												{k}
											</kbd>
										))}
									</span>
								)}
								<Button onClick={save} disabled={isSaving}>
									{isSaving && <Loader2 className="animate-spin" />}
									{isSaving
										? __('Saving…', 'allfeedback')
										: __('Save Changes', 'allfeedback')}
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</SettingsDirtyContext.Provider>
	);
};

export default Settings;
