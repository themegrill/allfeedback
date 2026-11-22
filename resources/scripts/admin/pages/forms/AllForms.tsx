import type { CreateSurveyData, SurveyStatus } from '@/admin/api/surveys';
import { surveysApi } from '@/admin/api/surveys';
import { TemplateIllustration } from '@/admin/components/TemplateIllustrations';
import { Tooltip } from '@/admin/components/Tooltip';
import type { TemplateId } from '@/admin/data/templates';
import { FORM_TEMPLATES } from '@/admin/data/templates';
import { surveysQuery } from '@/admin/queries/surveys';
import { Badge } from '@/components/ui/badge';
import { BulkActionBar } from '@/components/ui/bulk-action-bar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import ShortcodeChip from '@/components/ui/shortcode-chip';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/utils';
import * as Dialog from '@radix-ui/react-dialog';
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { __, sprintf } from '@wordpress/i18n';
import { format } from 'date-fns';
import {
	AlertCircle,
	AlertTriangle,
	Archive,
	ArrowDown,
	ArrowLeft,
	ArrowUp,
	ArrowUpDown,
	ArrowUpRight,
	BarChart2,
	ChevronRight,
	Copy,
	Edit2,
	Eye,
	EyeOff,
	FileText,
	Loader2,
	MoreVertical,
	Plus,
	RotateCcw,
	Trash2,
	X,
} from 'lucide-react';
import { Tooltip as RadixTooltip } from 'radix-ui';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { INACTIVE_FORM_MESSAGE } from './inactiveForm';

const STATUS_CONFIG: Record<
	SurveyStatus,
	{
		variant:
			| 'success'
			| 'secondary'
			| 'outline'
			| 'warning'
			| 'info'
			| 'danger';
		label: string;
		dot: string;
	}
> = {
	published: {
		variant: 'success',
		label: __('Published', 'allfeedback'),
		dot: 'bg-success',
	},
	draft: { variant: 'info', label: __('Draft', 'allfeedback'), dot: 'bg-info' },
	paused: {
		variant: 'warning',
		label: __('Paused', 'allfeedback'),
		dot: 'bg-warning',
	},
	archived: {
		variant: 'danger',
		label: __('Archived', 'allfeedback'),
		dot: 'bg-muted-foreground/30',
	},
	trashed: {
		variant: 'danger',
		label: __('Trash', 'allfeedback'),
		dot: 'bg-destructive',
	},
};
const PER_PAGE_OPTIONS = [10, 25, 50];

const cellCls = 'text-base font-normal leading-5 text-body-text';

const NewFormModal = ({
	open,
	onOpenChange,
	onSelect,
	isPending,
	pendingId,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelect: (id: TemplateId) => void;
	isPending: boolean;
	pendingId: TemplateId | null;
}) => {
	const [view, setView] = useState<'start' | 'templates'>('start');

	useEffect(() => {
		if (!open) {
			setView('start');
			return;
		}

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && view === 'templates' && !isPending) {
				e.preventDefault();
				e.stopPropagation();
				setView('start');
			}
		};

		window.addEventListener('keydown', handleKeyDown, true);
		return () => window.removeEventListener('keydown', handleKeyDown, true);
	}, [open, view, isPending]);

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(v) => {
				if (!isPending) onOpenChange(v);
			}}
		>
			<Dialog.Portal>
				<Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] duration-200" />
				<Dialog.Content
					className={cn(
						'group/modal fixed top-1/2 left-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2',
						'max-w-4xl',
						'border-border bg-card rounded-2xl border shadow-[var(--shadow-dropdown)] focus:outline-none',
						'data-[state=open]:animate-in data-[state=closed]:animate-out',
						'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
						'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
						'duration-200',
					)}
				>
					{view === 'start' ? (
						<div className="p-6">
							<Dialog.Close
								className="text-muted-foreground/50 hover:bg-muted hover:text-foreground absolute top-4 right-4 flex size-7 cursor-pointer items-center justify-center rounded-lg transition-colors"
								disabled={isPending}
							>
								<X className="size-4" />
							</Dialog.Close>

							<Dialog.Title
								className="text-md text-foreground font-semibold"
								style={{ margin: 0 }}
							>
								{__('Create a new form', 'allfeedback')}
							</Dialog.Title>
							<Dialog.Description
								className="text-muted-foreground/75 mt-1 text-base"
								style={{ margin: 0, marginTop: '4px' }}
							>
								{__('How would you like to get started?', 'allfeedback')}
							</Dialog.Description>

							<div className="mt-5 grid grid-cols-2 gap-3">
								<button
									type="button"
									onClick={() => onSelect('scratch')}
									disabled={isPending}
									className={cn(
										'group flex cursor-pointer flex-col overflow-hidden rounded-xl border p-0 text-left transition-all duration-150 outline-none',
										'focus-visible:ring-primary/25 focus-visible:ring-2',
										'border-border/60 hover:border-primary/40 hover:bg-muted/10 border',
										isPending &&
											pendingId === 'scratch' &&
											'border-primary/50 bg-primary/[0.03]',
										isPending &&
											pendingId !== 'scratch' &&
											'pointer-events-none opacity-40',
									)}
								>
									<div className="border-border/40 bg-muted/5 group-hover:bg-primary/[0.03] flex h-44 w-full items-center justify-center border-b transition-colors">
										{isPending && pendingId === 'scratch' ? (
											<Loader2 className="text-primary size-8 animate-spin" />
										) : (
											<TemplateIllustration
												type="scratch"
												className="h-full w-full max-w-[200px] opacity-70 transition-all group-hover:scale-105 group-hover:opacity-100"
											/>
										)}
									</div>
									<div className="p-6">
										<p className="text-foreground/80 !m-0 !text-[17px] leading-snug font-semibold">
											{__('Start from scratch', 'allfeedback')}
										</p>
										<p className="text-muted-foreground/80 !mt-1.5 text-[14px] leading-relaxed">
											{__(
												'Build your form field by field from a blank canvas.',
												'allfeedback',
											)}
										</p>
									</div>
								</button>

								<button
									type="button"
									onClick={() => setView('templates')}
									disabled={isPending}
									className={cn(
										'group flex cursor-pointer flex-col overflow-hidden rounded-xl border p-0 text-left transition-all duration-150 outline-none',
										'focus-visible:ring-primary/25 focus-visible:ring-2',
										'border-border/60 hover:border-primary/40 hover:bg-muted/10 border',
										isPending &&
											'pointer-events-none cursor-not-allowed opacity-40',
									)}
								>
									<div className="border-border/40 bg-muted/5 group-hover:bg-primary/[0.03] flex h-44 w-full items-center justify-center border-b transition-colors">
										<TemplateIllustration
											type="overview"
											className="h-full w-full max-w-[180px] opacity-80 transition-all group-hover:scale-105 group-hover:opacity-100"
										/>
									</div>
									<div className="p-6">
										<p className="text-foreground/80 !m-0 !text-[17px] leading-snug font-semibold">
											{__('Choose a template', 'allfeedback')}
										</p>
										<p className="text-muted-foreground/80 !mt-1.5 text-[14px] leading-relaxed">
											{__(
												'Pick a ready-made survey to get up and running fast.',
												'allfeedback',
											)}
										</p>
										<div className="text-primary/85 mt-2.5 flex items-center gap-0.5 text-[14px] font-semibold">
											<span>{__('Browse templates', 'allfeedback')}</span>
											<ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
										</div>
									</div>
								</button>
							</div>
						</div>
					) : (
						<div>
							<div className="border-border/50 flex items-center gap-2 border-b px-5 py-4">
								<Tooltip content={__('Back', 'allfeedback')}>
									<Button
										variant="ghost"
										size="icon-sm"
										onClick={() => setView('start')}
										disabled={isPending}
										className="shrink-0"
									>
										<ArrowLeft className="size-4" />
									</Button>
								</Tooltip>

								<span className="bg-border h-5 w-px" />

								<div className="flex min-w-0 flex-1 items-center gap-3">
									<Dialog.Title
										className="text-md text-foreground font-semibold"
										style={{ margin: 0 }}
									>
										{__('Choose a template', 'allfeedback')}
									</Dialog.Title>
									<div className="flex items-center gap-1.5 opacity-0 transition-opacity duration-300 group-hover/modal:opacity-100">
										<span className="text-muted-foreground/50 text-[11px]">
											{__('Press', 'allfeedback')}
										</span>
										<kbd className="border-border/40 bg-muted/50 text-muted-foreground/70 pointer-events-none inline-flex h-4 items-center gap-1 rounded border px-1 font-mono text-[9px] font-medium opacity-100 select-none">
											{__('Esc', 'allfeedback')}
										</kbd>
										<span className="text-muted-foreground/50 text-[11px]">
											{__('to go back', 'allfeedback')}
										</span>
									</div>
								</div>
								<Dialog.Close
									className="text-muted-foreground/50 hover:bg-muted hover:text-foreground flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors"
									disabled={isPending}
								>
									<X className="size-4" />
								</Dialog.Close>
							</div>

							<div className="grid grid-cols-3 gap-4 p-6">
								{FORM_TEMPLATES.map((tpl) => {
									const isActive = isPending && pendingId === tpl.id;
									const isFaded = isPending && pendingId !== tpl.id;
									return (
										<button
											key={tpl.id}
											type="button"
											onClick={() => onSelect(tpl.id)}
											disabled={isPending}
											className={cn(
												'group flex cursor-pointer flex-col overflow-hidden rounded-xl border p-0 text-left transition-all duration-150 outline-none',
												'focus-visible:ring-primary/30 focus-visible:ring-2',
												'border-border/60 bg-card hover:border-primary/40 hover:bg-muted/10',
												isActive && 'border-primary/40 bg-muted/10',
												isFaded &&
													'pointer-events-none cursor-not-allowed opacity-40',
											)}
										>
											<div className="border-border/40 bg-muted/5 group-hover:bg-primary/[0.03] flex h-36 w-full items-center justify-center border-b transition-colors">
												{isActive ? (
													<Loader2 className="text-primary size-6 animate-spin" />
												) : (
													<TemplateIllustration
														type={tpl.id}
														className="h-full w-full py-6 transition-all group-hover:scale-105"
													/>
												)}
											</div>
											<div className="p-4">
												<p className="text-foreground/90 !m-0 text-[14px] leading-tight font-semibold">
													{tpl.label}
												</p>
												<p className="text-muted-foreground/80 !mt-1 line-clamp-2 text-[12px] leading-relaxed">
													{tpl.description}
												</p>
											</div>
										</button>
									);
								})}
								{FORM_TEMPLATES.length % 2 !== 0 && <div aria-hidden="true" />}
							</div>
						</div>
					)}
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
};

const SkeletonRow = () => (
	<tr className="border-border border-b">
		<td className="w-12 px-4 py-5">
			<div className="bg-muted size-[16px] animate-pulse rounded-[4px]" />
		</td>
		<td className="w-16 px-4 py-5">
			<div className="bg-muted h-4 w-8 animate-pulse rounded" />
		</td>
		<td className="px-4 py-5">
			<div className="bg-muted h-4 w-48 animate-pulse rounded" />
		</td>
		<td className="w-20 px-4 py-5">
			<div className="bg-muted h-4 w-10 animate-pulse rounded" />
		</td>
		<td className="w-[200px] px-4 py-3">
			<div className="bg-muted h-6 w-36 animate-pulse rounded-md" />
		</td>
		<td className="w-24 px-4 py-5">
			<div className="bg-muted h-6 w-20 animate-pulse rounded-full" />
		</td>
		<td className="w-28 px-4 py-5">
			<div className="bg-muted h-4 w-24 animate-pulse rounded" />
		</td>
		<td className="w-24 px-4 py-5">
			<div className="flex items-center gap-1.5">
				<div className="bg-muted h-7 w-14 animate-pulse rounded-lg" />
				<div className="bg-muted size-7 animate-pulse rounded-lg" />
			</div>
		</td>
	</tr>
);

const AllForms = () => {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const [search, setSearch] = useState('');
	const debouncedSearch = useDebouncedValue(search, 300);
	const [status, setStatus] = useState('all');
	const [perPage, setPerPage] = useState(10);
	const [page, setPage] = useState(1);
	const [orderby, setOrderby] = useState('created_at');
	const [order, setOrder] = useState<'ASC' | 'DESC'>('DESC');

	const [checked, setChecked] = useState<number[]>([]);
	const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
	const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
	const [confirmBulkTrash, setConfirmBulkTrash] = useState(false);
	const [newFormOpen, setNewFormOpen] = useState(false);
	const [pendingTemplateId, setPendingTemplateId] = useState<TemplateId | null>(
		null,
	);

	const queryParams = {
		page,
		per_page: perPage,
		orderby,
		order,
		...(debouncedSearch && { search: debouncedSearch }),
		...(status !== 'all' && { status }),
	};

	const { data, isLoading, isError, isFetching } = useQuery({
		...surveysQuery(queryParams),
		placeholderData: keepPreviousData,
	});

	const surveys = data?.surveys ?? [];
	const total = data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / perPage));

	useEffect(() => {
		setPage(1);
	}, [debouncedSearch]);

	const handleSort = (column: string) => {
		if (orderby === column) {
			setOrder((prev) => (prev === 'DESC' ? 'ASC' : 'DESC'));
		} else {
			setOrderby(column);
			setOrder('DESC');
		}
		setPage(1);
	};

	const colHeadCls =
		'flex items-center gap-1 text-sm font-semibold uppercase tracking-wide leading-4 select-none text-body-text';

	const ColHead = ({
		column,
		label,
		sortable = false,
	}: {
		column?: string;
		label: string;
		sortable?: boolean;
	}) => {
		const isActive = sortable && column !== undefined && orderby === column;
		const Icon = isActive
			? order === 'DESC'
				? ArrowDown
				: ArrowUp
			: ArrowUpDown;
		return (
			<span
				role={sortable && column ? 'button' : undefined}
				tabIndex={sortable && column ? 0 : undefined}
				onClick={sortable && column ? () => handleSort(column) : undefined}
				onKeyDown={
					sortable && column
						? (e) => {
								if (e.key === 'Enter' || e.key === ' ') handleSort(column);
							}
						: undefined
				}
				className={cn(
					colHeadCls,
					sortable && column ? 'cursor-pointer transition-colors' : '',
					isActive ? 'text-foreground' : '',
					sortable && column && !isActive ? 'hover:text-foreground' : '',
				)}
			>
				{label}
				{sortable && <Icon className="size-3 shrink-0" />}
			</span>
		);
	};

	const allChecked =
		surveys.length > 0 && surveys.every((s) => checked.includes(s.id));
	const someChecked = checked.length > 0 && !allChecked;
	const toggleAll = () =>
		setChecked(allChecked ? [] : surveys.map((s) => s.id));
	const toggleOne = (id: number) =>
		setChecked((prev) =>
			prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
		);

	const checkedSurveys = surveys.filter((s) => checked.includes(s.id));
	const allSelectedTrashed =
		checkedSurveys.length > 0 &&
		checkedSurveys.every((s) => s.status === 'trashed');
	const anySelectedNotTrashed = checkedSurveys.some(
		(s) => s.status !== 'trashed',
	);

	const createMutation = useMutation({
		mutationFn: (data: CreateSurveyData) => surveysApi.create(data),
		onSuccess: (survey) => {
			void queryClient.invalidateQueries({ queryKey: ['surveys'] });
			setNewFormOpen(false);
			setPendingTemplateId(null);
			void navigate({ to: '/builder/', search: { new: true, id: survey.id } });
		},
		onError: () => {
			setPendingTemplateId(null);
			toast.error(
				__('Failed to create form. Please try again.', 'allfeedback'),
			);
		},
	});

	const handleSelectTemplate = (templateId: TemplateId) => {
		setPendingTemplateId(templateId);
		if (templateId === 'scratch') {
			createMutation.mutate({ title: __('Untitled Form', 'allfeedback') });
			return;
		}
		const tpl = FORM_TEMPLATES.find((t) => t.id === templateId);
		if (!tpl) return;
		createMutation.mutate({ title: tpl.createTitle, form_schema: tpl.schema });
	};

	const deleteMutation = useMutation({
		mutationFn: (id: number) => surveysApi.delete(id),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ['surveys'] });
			setConfirmDeleteId(null);
			setChecked((prev) => prev.filter((id) => id !== confirmDeleteId));
			toast.success(__('Form permanently deleted.', 'allfeedback'));
		},
		onError: () => {
			setConfirmDeleteId(null);
			toast.error(
				__('Failed to delete form. Please try again.', 'allfeedback'),
			);
		},
	});

	const trashMutation = useMutation({
		mutationFn: (id: number) => surveysApi.trash(id),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ['surveys'] });
			toast.success(__('Form moved to trash.', 'allfeedback'));
		},
		onError: () => {
			toast.error(__('Failed to trash form. Please try again.', 'allfeedback'));
		},
	});

	const statusMutation = useMutation({
		mutationFn: ({ id, status }: { id: number; status: SurveyStatus }) =>
			surveysApi.update(id, { status }),
		onSuccess: (survey, variables) => {
			void queryClient.invalidateQueries({ queryKey: ['surveys'] });
			if (survey.conflict_reason) {
				toast.warning(survey.conflict_reason);
			} else {
				const label =
					variables.status === 'published'
						? __('published', 'allfeedback')
						: __('draft', 'allfeedback');
				toast.success(sprintf(__('Form marked as %s.', 'allfeedback'), label));
			}
		},
		onError: () => {
			toast.error(
				__('Failed to update form status. Please try again.', 'allfeedback'),
			);
		},
	});

	const restoreMutation = useMutation({
		mutationFn: (id: number) => surveysApi.update(id, { status: 'draft' }),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ['surveys'] });
			toast.success(__('Form restored to draft.', 'allfeedback'));
		},
		onError: () => {
			toast.error(
				__('Failed to restore form. Please try again.', 'allfeedback'),
			);
		},
	});

	const bulkRestoreMutation = useMutation({
		mutationFn: (ids: number[]) =>
			Promise.all(ids.map((id) => surveysApi.update(id, { status: 'draft' }))),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ['surveys'] });
			setChecked([]);
			toast.success(__('Selected forms restored to draft.', 'allfeedback'));
		},
		onError: () => {
			toast.error(
				__('Failed to restore some forms. Please try again.', 'allfeedback'),
			);
		},
	});

	const cloneMutation = useMutation({
		mutationFn: (id: number) => surveysApi.duplicate(id),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ['surveys'] });
			toast.success(__('Form cloned successfully.', 'allfeedback'));
		},
		onError: () => {
			toast.error(__('Failed to clone form. Please try again.', 'allfeedback'));
		},
	});

	const bulkDeleteMutation = useMutation({
		mutationFn: (ids: number[]) => surveysApi.bulkDelete(ids),
		onSuccess: (result) => {
			void queryClient.invalidateQueries({ queryKey: ['surveys'] });
			setChecked([]);
			setConfirmBulkDelete(false);
			if (result.failed.length > 0) {
				toast.warning(__('Some forms could not be deleted.', 'allfeedback'));
			} else {
				toast.success(__('Selected forms permanently deleted.', 'allfeedback'));
			}
		},
		onError: () => {
			setConfirmBulkDelete(false);
			toast.error(
				__('Failed to delete forms. Please try again.', 'allfeedback'),
			);
		},
	});

	const bulkTrashMutation = useMutation({
		mutationFn: (ids: number[]) => surveysApi.bulkTrash(ids),
		onSuccess: (result) => {
			void queryClient.invalidateQueries({ queryKey: ['surveys'] });
			setChecked([]);
			setConfirmBulkTrash(false);
			if (result.failed.length > 0) {
				toast.warning(
					__('Some forms could not be moved to trash.', 'allfeedback'),
				);
			} else {
				toast.success(__('Selected forms moved to trash.', 'allfeedback'));
			}
		},
		onError: () => {
			setConfirmBulkTrash(false);
			toast.error(
				__('Failed to trash forms. Please try again.', 'allfeedback'),
			);
		},
	});

	return (
		<RadixTooltip.Provider delayDuration={200}>
			<div className="p-5 md:p-6">
				<ConfirmDialog
					open={confirmDeleteId !== null}
					onOpenChange={(open) => {
						if (!open && !deleteMutation.isPending) setConfirmDeleteId(null);
					}}
					onConfirm={() => {
						if (confirmDeleteId) deleteMutation.mutate(confirmDeleteId);
					}}
					title={__('Permanently delete form?', 'allfeedback')}
					description={__(
						'This action cannot be undone. All responses collected for this form will also be permanently deleted.',
						'allfeedback',
					)}
					confirmLabel={__('Delete', 'allfeedback')}
					cancelLabel={__('Cancel', 'allfeedback')}
					isPending={deleteMutation.isPending}
				/>

				<ConfirmDialog
					open={confirmBulkDelete}
					onOpenChange={(open) => {
						if (!open && !bulkDeleteMutation.isPending)
							setConfirmBulkDelete(false);
					}}
					onConfirm={() => bulkDeleteMutation.mutate(checked)}
					title={__('Permanently delete selected forms?', 'allfeedback')}
					description={__(
						'This action cannot be undone. All responses for the selected forms will also be permanently deleted.',
						'allfeedback',
					)}
					confirmLabel={__('Delete all', 'allfeedback')}
					cancelLabel={__('Cancel', 'allfeedback')}
					isPending={bulkDeleteMutation.isPending}
				/>

				<ConfirmDialog
					open={confirmBulkTrash}
					onOpenChange={(open) => {
						if (!open && !bulkTrashMutation.isPending)
							setConfirmBulkTrash(false);
					}}
					onConfirm={() => bulkTrashMutation.mutate(checked)}
					title={__('Move selected forms to trash?', 'allfeedback')}
					description={__(
						'The selected forms will be moved to trash and hidden from this list.',
						'allfeedback',
					)}
					confirmLabel={__('Move to trash', 'allfeedback')}
					cancelLabel={__('Cancel', 'allfeedback')}
					isPending={bulkTrashMutation.isPending}
				/>

				<NewFormModal
					open={newFormOpen}
					onOpenChange={setNewFormOpen}
					onSelect={handleSelectTemplate}
					isPending={createMutation.isPending}
					pendingId={pendingTemplateId}
				/>

				<div className="mb-4 flex flex-wrap items-center gap-3 py-1">
					<div className="relative w-full sm:w-[260px]">
						<svg
							className="text-muted-foreground absolute top-1/2 left-3 size-3.5 -translate-y-1/2"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							viewBox="0 0 24 24"
						>
							<circle cx="11" cy="11" r="8" />
							<path d="m21 21-4.35-4.35" />
						</svg>
						<Input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={__('Search forms…', 'allfeedback')}
							className="pl-9"
						/>
					</div>

					<Select
						value={status}
						onValueChange={(v) => {
							setStatus(v);
							setPage(1);
						}}
					>
						<SelectTrigger className="w-full sm:w-[150px]">
							<SelectValue placeholder={__('All Status', 'allfeedback')} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">
								{__('All Status', 'allfeedback')}
							</SelectItem>
							<SelectItem value="published">
								{__('Published', 'allfeedback')}
							</SelectItem>
							<SelectItem value="draft">
								{__('Draft', 'allfeedback')}
							</SelectItem>
							<SelectItem value="trashed">
								{__('Trash', 'allfeedback')}
							</SelectItem>
						</SelectContent>
					</Select>

					<div className="w-full sm:ml-auto sm:w-auto">
						<Button
							className="w-full sm:w-auto"
							onClick={() => setNewFormOpen(true)}
						>
							<Plus className="size-4" />
							{__('Add New Form', 'allfeedback')}
						</Button>
					</div>
				</div>

				<div
					className={cn(
						'border-border bg-card rounded-xl border transition-opacity',
						isFetching && !isLoading && 'pointer-events-none opacity-50',
					)}
				>
					<div className="overflow-x-auto">
						<table className="w-full table-fixed">
							<thead>
								<tr className="border-border bg-muted/30 border-b">
									<th className="w-12 px-4 py-4 text-left">
										<Checkbox
											checked={someChecked ? 'indeterminate' : allChecked}
											onCheckedChange={toggleAll}
											disabled={isLoading || surveys.length === 0}
										/>
									</th>
									<th className="w-16 px-4 py-4 text-left">
										<ColHead
											column="id"
											label={__('ID', 'allfeedback')}
											sortable
										/>
									</th>
									<th className="w-[220px] px-4 py-4 text-left">
										<ColHead column="title" label={__('Form Name', 'allfeedback')} sortable />
									</th>
									<th className="w-20 px-4 py-4 text-left">
										<ColHead
											column="response_count"
											label={__('Responses', 'allfeedback')}
											sortable
										/>
									</th>
									<th className="w-[200px] px-4 py-4 text-left">
										<ColHead label={__('Shortcode', 'allfeedback')} />
									</th>
									<th className="w-24 px-4 py-4 text-left">
										<ColHead label={__('Status', 'allfeedback')} />
									</th>
									<th className="w-28 px-4 py-4 text-left">
										<ColHead
											column="created_at"
											label={__('Created', 'allfeedback')}
											sortable
										/>
									</th>
									<th className="w-24 px-4 py-4 text-left">
										<ColHead label={__('Actions', 'allfeedback')} />
									</th>
								</tr>
							</thead>

							<tbody>
								{isLoading &&
									Array.from({ length: 5 }, (_, i) => <SkeletonRow key={i} />)}

								{isError && !isLoading && (
									<tr>
										<td colSpan={8}>
											<EmptyState
												icon={AlertCircle}
												title={__('Failed to load forms', 'allfeedback')}
												description={__(
													'There was a problem fetching your forms. Please try refreshing the page.',
													'allfeedback',
												)}
											/>
										</td>
									</tr>
								)}

								{!isLoading && !isError && surveys.length === 0 && (
									<tr>
										<td colSpan={8}>
											<EmptyState
												icon={FileText}
												title={
													search || status !== 'all'
														? __('No forms match your filters.', 'allfeedback')
														: __('No forms yet', 'allfeedback')
												}
												description={
													search || status !== 'all'
														? __(
																'Try adjusting your search or status filter.',
																'allfeedback',
															)
														: __(
																'Create your first feedback form to start collecting responses.',
																'allfeedback',
															)
												}
											/>
										</td>
									</tr>
								)}

								{!isLoading &&
									!isError &&
									surveys.map((survey) => {
										const statusCfg =
											STATUS_CONFIG[survey.status] ?? STATUS_CONFIG.draft;
										const isSelected = checked.includes(survey.id);

										return (
											<tr
												key={survey.id}
												className={cn(
													'border-border border-b transition-colors last:border-0',
													isSelected
														? 'bg-primary/[0.03]'
														: 'hover:bg-muted/20',
												)}
											>
												<td className="w-12 px-4 py-5">
													<Checkbox
														checked={isSelected}
														onCheckedChange={() => toggleOne(survey.id)}
													/>
												</td>

												<td className="w-16 px-4 py-5">
													<span className={cn(cellCls, 'tabular-nums')}>
														#{survey.id}
													</span>
												</td>

												<td className="w-[220px] px-4 py-5">
													<button
														type="button"
														className="group/name flex min-w-0 items-start gap-1.5 text-left"
														onClick={() =>
															void navigate({
																to: '/builder/',
																search: { new: false, id: survey.id },
															})
														}
													>
														<span
															className={cn(
																cellCls,
																'group-hover/name:text-primary line-clamp-2 font-semibold break-words underline-offset-2 transition-all group-hover/name:underline',
															)}
														>
															{survey.title}
														</span>
														<Edit2 className="group-hover/name:text-primary mt-0.5 size-3 shrink-0 opacity-0 transition-all group-hover/name:opacity-60" />
													</button>
												</td>

												<td className="w-20 px-4 py-5">
													<button
														type="button"
														className={cn(
															'group/resp hover:bg-primary/[0.06] hover:text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-medium tabular-nums transition-colors',
															survey.response_count > 0
																? 'text-primary'
																: 'text-foreground/60 hover:text-primary',
														)}
														onClick={() =>
															void navigate({
																to: '/responses/',
																search: { surveyId: survey.id },
															})
														}
													>
														{survey.response_count.toLocaleString()}
														{survey.response_count > 0 && (
															<ArrowUpRight className="size-3 opacity-50 transition-opacity group-hover/resp:opacity-100" />
														)}
													</button>
												</td>

												<td className="w-[200px] px-4 py-3">
													<ShortcodeChip
														shortcode={`[allfeedback_survey id="${survey.id}"]`}
														size="sm"
													/>
												</td>

												<td className="w-24 px-4 py-5">
													{survey.missing_features?.length ? (
														<Tooltip content={INACTIVE_FORM_MESSAGE}>
															<span className="border-warning/20 bg-warning-subtle text-warning-foreground inline-flex cursor-default items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium">
																<span className="bg-warning size-1.5 rounded-full" />
																{__('Inactive', 'allfeedback')}
																<AlertTriangle className="size-3 shrink-0" />
															</span>
														</Tooltip>
													) : survey.status === 'draft' &&
													survey.conflict_reason ? (
														<Tooltip
															content={__(
																'Saved as draft — its target pages are already used by other forms. Open the form to see details.',
																'allfeedback',
															)}
														>
															<span className="border-destructive/20 bg-destructive/10 text-destructive inline-flex cursor-default items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium">
																<span className="bg-destructive size-1.5 rounded-full" />
																{statusCfg.label}
																<AlertTriangle className="size-3 shrink-0" />
															</span>
														</Tooltip>
													) : (
														<Badge variant={statusCfg.variant}>
															<span
																className={cn(
																	'size-1.5 rounded-full',
																	statusCfg.dot,
																)}
															/>
															{statusCfg.label}
														</Badge>
													)}
												</td>

												<td className="w-28 px-4 py-5">
													<span className={cellCls}>
														{format(new Date(survey.created_at), 'MMM d, yyyy')}
													</span>
												</td>

												<td className="w-24 px-4 py-5">
													<div className="flex items-center gap-1">
														<button
															type="button"
															onClick={() =>
																void navigate({
																	to: '/builder/',
																	search: { new: false, id: survey.id },
																})
															}
															style={{ border: '1.5px solid #E2E2E8' }}
															className="bg-primary/[0.04] text-primary/80 hover:bg-primary/[0.08] hover:text-primary flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors max-sm:hidden"
														>
															<Edit2 className="size-3" />
															{__('Edit', 'allfeedback')}
														</button>
														<Tooltip
															content={__('View analytics', 'allfeedback')}
														>
															<button
																type="button"
																onClick={() =>
																	void navigate({
																		to: '/analytics/',
																		search: { formId: survey.id },
																	})
																}
																style={{ border: '1.5px solid #E2E2E8' }}
																className="text-foreground/50 hover:bg-muted/50 hover:text-foreground flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors"
															>
																<BarChart2 className="size-3.5" />
															</button>
														</Tooltip>

														<DropdownMenu>
															<DropdownMenuTrigger asChild>
																<button
																	type="button"
																	style={{ border: '1.5px solid #E2E2E8' }}
																	className="text-foreground/50 hover:bg-muted/50 hover:text-foreground flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors"
																>
																	<MoreVertical className="size-3.5" />
																</button>
															</DropdownMenuTrigger>
															<DropdownMenuContent>
																<DropdownMenuItem
																	className="max-sm:flex sm:hidden"
																	onSelect={() =>
																		void navigate({
																			to: '/builder/',
																			search: { new: false, id: survey.id },
																		})
																	}
																>
																	<Edit2 className="size-3.5" />
																	{__('Edit', 'allfeedback')}
																</DropdownMenuItem>

																{survey.status === 'trashed' && (
																	<DropdownMenuItem
																		onSelect={() =>
																			restoreMutation.mutate(survey.id)
																		}
																		disabled={restoreMutation.isPending}
																	>
																		{restoreMutation.isPending ? (
																			<Loader2 className="size-3.5 animate-spin" />
																		) : (
																			<RotateCcw className="size-3.5" />
																		)}
																		{__('Restore', 'allfeedback')}
																	</DropdownMenuItem>
																)}

																{survey.status === 'published' && (
																	<DropdownMenuItem
																		onSelect={() =>
																			statusMutation.mutate({
																				id: survey.id,
																				status: 'draft',
																			})
																		}
																		disabled={statusMutation.isPending}
																	>
																		{statusMutation.isPending ? (
																			<Loader2 className="size-3.5 animate-spin" />
																		) : (
																			<EyeOff className="size-3.5" />
																		)}
																		{__('Save as Draft', 'allfeedback')}
																	</DropdownMenuItem>
																)}

																{survey.status === 'draft' && (
																	<DropdownMenuItem
																		onSelect={() =>
																			statusMutation.mutate({
																				id: survey.id,
																				status: 'published',
																			})
																		}
																		disabled={statusMutation.isPending}
																	>
																		{statusMutation.isPending ? (
																			<Loader2 className="size-3.5 animate-spin" />
																		) : (
																			<Eye className="size-3.5" />
																		)}
																		{__('Save as Published', 'allfeedback')}
																	</DropdownMenuItem>
																)}

																<DropdownMenuItem
																	onSelect={() =>
																		cloneMutation.mutate(survey.id)
																	}
																	disabled={cloneMutation.isPending}
																>
																	{cloneMutation.isPending ? (
																		<Loader2 className="size-3.5 animate-spin" />
																	) : (
																		<Copy className="size-3.5" />
																	)}
																	{__('Clone', 'allfeedback')}
																</DropdownMenuItem>

																{survey.status !== 'trashed' && (
																	<DropdownMenuItem
																		onSelect={() =>
																			trashMutation.mutate(survey.id)
																		}
																		disabled={trashMutation.isPending}
																	>
																		{trashMutation.isPending ? (
																			<Loader2 className="size-3.5 animate-spin" />
																		) : (
																			<Archive className="size-3.5" />
																		)}
																		{__('Move to Trash', 'allfeedback')}
																	</DropdownMenuItem>
																)}

																{survey.status === 'trashed' && (
																	<DropdownMenuItem
																		destructive
																		onSelect={() =>
																			setConfirmDeleteId(survey.id)
																		}
																	>
																		<Trash2 className="size-3.5" />
																		{__('Delete', 'allfeedback')}
																	</DropdownMenuItem>
																)}
															</DropdownMenuContent>
														</DropdownMenu>
													</div>
												</td>
											</tr>
										);
									})}
							</tbody>
						</table>
					</div>
				</div>

				<Pagination
					className="mt-6"
					page={page}
					totalPages={totalPages}
					total={total}
					perPage={perPage}
					perPageOptions={PER_PAGE_OPTIONS}
					isLoading={isFetching}
					onPageChange={setPage}
					onPerPageChange={(n) => {
						setPerPage(n);
						setPage(1);
					}}
				/>

				<BulkActionBar
					count={checked.length}
					showTrash={anySelectedNotTrashed}
					showDelete={allSelectedTrashed}
					showRestore={allSelectedTrashed}
					isDeleting={bulkDeleteMutation.isPending}
					isTrashing={bulkTrashMutation.isPending}
					isRestoring={bulkRestoreMutation.isPending}
					onDelete={() => setConfirmBulkDelete(true)}
					onTrash={() => setConfirmBulkTrash(true)}
					onRestore={() => bulkRestoreMutation.mutate(checked)}
					onClone={() => {}}
					onClear={() => setChecked([])}
				/>
			</div>
		</RadixTooltip.Provider>
	);
};

export default AllForms;
