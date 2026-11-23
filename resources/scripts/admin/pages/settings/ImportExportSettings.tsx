import { surveysApi } from '@/admin/api/surveys';
import { surveysQuery } from '@/admin/queries/surveys';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	ArrowLeftRight,
	ChevronDown,
	CircleAlert,
	Download,
	FileJson,
	Loader2,
	Search,
	Upload,
	X,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

const Row = ({
	label,
	description,
	children,
}: {
	label: string;
	description: string;
	children: React.ReactNode;
}) => (
	<div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
		<div className="md:w-[40%] md:shrink-0">
			<p className="text-foreground/90 m-0 text-base font-normal">{label}</p>
			<p className="text-muted-foreground/90 mt-0.5 mb-0 text-[13px] leading-relaxed">
				{description}
			</p>
		</div>
		<div className="min-w-0 flex-1 space-y-3">{children}</div>
	</div>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
	<div className="mt-5 mb-4">
		<span className="text-foreground/60 text-sm font-semibold tracking-widest uppercase">
			{children}
		</span>
	</div>
);

const errorMessage = (e: unknown, fallback: string) =>
	e && typeof e === 'object' && 'message' in e && typeof e.message === 'string'
		? e.message
		: fallback;

const downloadJson = (data: unknown, filename: string) => {
	const blob = new Blob([JSON.stringify(data, null, 2)], {
		type: 'application/json',
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
};

const ExportSection = () => {
	const { data, isPending } = useQuery(surveysQuery({ per_page: 100 }));
	const surveys = useMemo(
		() => (data?.surveys ?? []).filter((s) => s.status !== 'trashed'),
		[data],
	);
	const [selected, setSelected] = useState<number[]>([]);
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState('');

	const visible = useMemo(() => {
		const q = search.trim().toLowerCase();
		return q
			? surveys.filter((s) => s.title.toLowerCase().includes(q))
			: surveys;
	}, [surveys, search]);
	const visibleIds = visible.map((s) => s.id);
	const visibleSelected = visibleIds.filter((id) =>
		selected.includes(id),
	).length;
	const allSelected = visible.length > 0 && visibleSelected === visible.length;

	const toggleAllVisible = () =>
		setSelected((prev) =>
			allSelected
				? prev.filter((id) => !visibleIds.includes(id))
				: [...new Set([...prev, ...visibleIds])],
		);

	const toggle = (id: number) =>
		setSelected((prev) =>
			prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
		);

	const { mutate, isPending: isExporting } = useMutation({
		mutationFn: () => surveysApi.export(selected),
		onSuccess: (bundle) => {
			const date = new Date().toISOString().slice(0, 10);
			downloadJson(bundle, `allfeedback-surveys-${date}.json`);
			toast.success(
				sprintf(
					/* translators: %d: number of surveys exported */
					_n(
						'%d survey exported.',
						'%d surveys exported.',
						bundle.surveys.length,
						'allfeedback',
					),
					bundle.surveys.length,
				),
			);
		},
		onError: (e) =>
			toast.error(
				errorMessage(e, __('Export failed. Please try again.', 'allfeedback')),
			),
	});

	const triggerLabel =
		selected.length === 0
			? __('Select surveys', 'allfeedback')
			: sprintf(
					/* translators: %d: number of selected surveys */
					_n(
						'%d survey selected',
						'%d surveys selected',
						selected.length,
						'allfeedback',
					),
					selected.length,
				);

	return (
		<Row
			label={__('Export Surveys', 'allfeedback')}
			description={__(
				'Download one or more surveys as a JSON file, including their fields, settings and styling. Responses are not included.',
				'allfeedback',
			)}
		>
			<Popover
				open={open}
				onOpenChange={(next) => {
					setOpen(next);
					if (!next) setSearch('');
				}}
			>
				<PopoverTrigger asChild>
					<button
						type="button"
						disabled={isPending || surveys.length === 0}
						className="border-border text-foreground hover:border-primary/40 focus-visible:ring-primary/30 flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border bg-white px-3 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
					>
						<span
							className={cn(
								'truncate',
								selected.length === 0 && 'text-muted-foreground',
							)}
						>
							{isPending
								? __('Loading surveys…', 'allfeedback')
								: surveys.length === 0
									? __('No surveys to export', 'allfeedback')
									: triggerLabel}
						</span>
						<ChevronDown className="text-muted-foreground size-4 shrink-0" />
					</button>
				</PopoverTrigger>
				<PopoverContent
					align="start"
					className="w-[var(--radix-popover-trigger-width)] overflow-hidden"
				>
					<div className="border-border/50 relative border-b p-2">
						<Search className="text-muted-foreground/50 pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2" />
						<input
							type="search"
							autoFocus
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={__('Search surveys…', 'allfeedback')}
							aria-label={__('Search surveys', 'allfeedback')}
							className="border-border focus:border-primary/50 h-8 w-full rounded-md border bg-white pr-2 pl-7 text-sm shadow-none outline-none"
						/>
					</div>
					{visible.length === 0 ? (
						<p className="text-muted-foreground m-0 px-3 py-6 text-center text-sm">
							{__('No surveys match your search.', 'allfeedback')}
						</p>
					) : (
						<>
							<label className="border-border/50 hover:bg-muted/50 flex cursor-pointer items-center gap-3 border-b px-3 py-2.5 text-sm font-medium">
								<Checkbox
									checked={
										allSelected
											? true
											: visibleSelected > 0
												? 'indeterminate'
												: false
									}
									onCheckedChange={toggleAllVisible}
								/>
								{search.trim()
									? __('Select all results', 'allfeedback')
									: __('Select all', 'allfeedback')}
							</label>
							<div className="max-h-64 overflow-y-auto py-1">
								{visible.map((s) => (
									<label
										key={s.id}
										className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 px-3 py-2 text-sm"
									>
										<Checkbox
											checked={selected.includes(s.id)}
											onCheckedChange={() => toggle(s.id)}
										/>
										<span className="min-w-0 flex-1 truncate">
											{s.title || __('(Untitled)', 'allfeedback')}
										</span>
										<span className="text-muted-foreground text-xs capitalize">
											{s.status}
										</span>
									</label>
								))}
							</div>
						</>
					)}
				</PopoverContent>
			</Popover>

			{selected.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{surveys
						.filter((s) => selected.includes(s.id))
						.map((s) => (
							<span
								key={s.id}
								className="bg-primary/10 text-primary inline-flex max-w-full items-center gap-1 rounded-full py-1 pr-1.5 pl-2.5 text-xs font-medium"
							>
								<span className="truncate">
									{s.title || __('(Untitled)', 'allfeedback')}
								</span>
								<button
									type="button"
									onClick={() => toggle(s.id)}
									aria-label={__('Remove', 'allfeedback')}
									className="hover:bg-primary/15 cursor-pointer rounded-full p-0.5"
								>
									<X className="size-3" />
								</button>
							</span>
						))}
				</div>
			)}

			<Button
				onClick={() => mutate()}
				disabled={selected.length === 0 || isExporting}
			>
				{isExporting ? <Loader2 className="animate-spin" /> : <Download />}
				{__('Export', 'allfeedback')}
			</Button>
		</Row>
	);
};

const ImportSection = () => {
	const queryClient = useQueryClient();
	const inputRef = useRef<HTMLInputElement>(null);
	const [file, setFile] = useState<File | null>(null);
	const [showNotice, setShowNotice] = useState(false);

	const { mutate, isPending } = useMutation({
		mutationFn: async (f: File) => {
			let parsed: unknown;
			try {
				parsed = JSON.parse(await f.text());
			} catch {
				throw new Error(__('This file is not valid JSON.', 'allfeedback'));
			}
			const surveys =
				parsed && typeof parsed === 'object' && 'surveys' in parsed
					? (parsed as { surveys: unknown }).surveys
					: null;
			if (!Array.isArray(surveys) || surveys.length === 0) {
				throw new Error(
					__(
						'This is not an AllFeedback export file, or it has no surveys.',
						'allfeedback',
					),
				);
			}
			return surveysApi.import(surveys);
		},
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: ['surveys'] });
			if (result.imported > 0) {
				toast.success(
					sprintf(
						/* translators: %d: number of surveys imported */
						_n(
							'%d survey imported as a draft.',
							'%d surveys imported as drafts.',
							result.imported,
							'allfeedback',
						),
						result.imported,
					),
				);
			}
			result.failed.forEach((f) =>
				toast.error(
					sprintf(
						/* translators: 1: survey title, 2: reason */
						__('Skipped "%1$s": %2$s', 'allfeedback'),
						f.title || __('(Untitled)', 'allfeedback'),
						f.reason,
					),
				),
			);
			setShowNotice(result.imported > 0);
			setFile(null);
			if (inputRef.current) inputRef.current.value = '';
		},
		onError: (e) =>
			toast.error(
				errorMessage(e, __('Import failed. Please try again.', 'allfeedback')),
			),
	});

	return (
		<Row
			label={__('Import Surveys', 'allfeedback')}
			description={__(
				'Upload a JSON file exported from AllFeedback. Each survey is added as a new draft.',
				'allfeedback',
			)}
		>
			<input
				ref={inputRef}
				type="file"
				accept=".json,application/json"
				className="hidden"
				onChange={(e) => {
					setFile(e.target.files?.[0] ?? null);
					setShowNotice(false);
				}}
			/>
			<button
				type="button"
				onClick={() => inputRef.current?.click()}
				className="border-border hover:border-primary/40 hover:bg-primary/5 flex w-full cursor-pointer items-center gap-3 rounded-lg border border-dashed bg-white px-4 py-4 text-left transition-colors"
			>
				<div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-lg">
					<FileJson className="text-primary size-[18px]" />
				</div>
				<div className="min-w-0">
					<p className="text-foreground m-0 truncate text-sm font-medium">
						{file ? file.name : __('Select file', 'allfeedback')}
					</p>
					<p className="text-muted-foreground m-0 text-xs">
						{file
							? sprintf(
									/* translators: %s: file size in KB */
									__('%s KB', 'allfeedback'),
									(file.size / 1024).toFixed(1),
								)
							: __('.json files only', 'allfeedback')}
					</p>
				</div>
			</button>

			<Button
				onClick={() => file && mutate(file)}
				disabled={!file || isPending}
			>
				{isPending ? <Loader2 className="animate-spin" /> : <Upload />}
				{__('Import', 'allfeedback')}
			</Button>

			{showNotice && (
				<div
					role="status"
					className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] leading-relaxed text-amber-900"
				>
					<CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
					<p className="m-0">
						{__(
							'Check the target pages if your survey has any, otherwise it may not show on the right pages.',
							'allfeedback',
						)}
					</p>
				</div>
			)}
		</Row>
	);
};

const ImportExportSettings = () => (
	<div>
		<div className="border-border/50 flex items-center gap-3 border-b px-6 py-4">
			<div className="bg-primary/10 flex size-9 items-center justify-center rounded-xl">
				<ArrowLeftRight className="text-primary size-[18px]" />
			</div>
			<h3
				className="text-md text-foreground font-semibold"
				style={{ margin: 0 }}
			>
				{__('Import / Export', 'allfeedback')}
			</h3>
		</div>

		<div className="px-6 pt-4 pb-6">
			<SectionLabel>{__('Import', 'allfeedback')}</SectionLabel>
			<ImportSection />

			<div className="border-border/50 my-6 border-t" />

			<SectionLabel>{__('Export', 'allfeedback')}</SectionLabel>
			<ExportSection />
		</div>
	</div>
);

export default ImportExportSettings;
