import { Tooltip } from '@/admin/components/Tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { cn, htmlToText } from '@/lib/utils';
import PlaceholderExtension from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { __, sprintf } from '@wordpress/i18n';
import {
	Check,
	ChevronDown,
	Copy,
	GitBranch,
	GripVertical,
	Plus,
	Trash2,
	TriangleAlert,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FIELD_TYPES } from './fieldTypes';
import {
	isAnswerBroken,
	isConditionActive,
	isConditionBroken,
	NUMERIC_FIELD_TYPES,
	type ConditionOperator,
} from '@/shared/conditions';
import type { FieldCondition, FormField } from './types';

const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
	if (e.key === 'Enter' || e.key === 'Escape') {
		e.preventDefault();
		e.currentTarget.blur();
	}
};

const RequiredSwitch = ({
	value,
	onChange,
}: {
	value: boolean;
	onChange: (v: boolean) => void;
}) => (
	<button
		type="button"
		role="switch"
		aria-checked={value}
		onClick={() => onChange(!value)}
		className="flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-black/[0.04]"
	>
		<span className="text-base font-normal text-foreground/80 select-none">
			{__('Required', 'allfeedback')}
		</span>
		<span
			className={cn(
				'relative inline-flex h-[14px] w-6 shrink-0 items-center rounded-full transition-colors duration-200',
				value ? 'bg-primary' : 'bg-border',
			)}
		>
			<span
				className={cn(
					'inline-block size-[10px] rounded-full bg-white shadow-sm transition-transform duration-200',
					value ? 'translate-x-[11px]' : 'translate-x-[2px]',
				)}
			/>
		</span>
	</button>
);

interface OptionRowProps {
	fieldType: 'radio' | 'checkboxes';
	value: string;
	index: number;
	isDragging: boolean;
	isDragOver: boolean;
	onChange: (value: string) => void;
	onDelete: () => void;
	onAddAfter: () => void;
	onDragStart: (i: number) => void;
	onDragOver: (e: React.DragEvent, i: number) => void;
	onDragEnd: () => void;
	onDrop: (e: React.DragEvent, i: number) => void;
}

const OptionRow = ({
	fieldType,
	value,
	index,
	isDragging,
	isDragOver,
	onChange,
	onDelete,
	onAddAfter,
	onDragStart,
	onDragOver,
	onDragEnd,
	onDrop,
}: OptionRowProps) => (
	<div
		draggable
		onDragStart={(e) => {
			e.stopPropagation();
			onDragStart(index);
		}}
		onDragOver={(e) => {
			e.stopPropagation();
			e.preventDefault();
			onDragOver(e, index);
		}}
		onDragEnd={(e) => {
			e.stopPropagation();
			onDragEnd();
		}}
		onDrop={(e) => {
			e.stopPropagation();
			e.preventDefault();
			onDrop(e, index);
		}}
		className={cn(
			'flex items-center gap-2 transition-opacity',
			isDragging && 'opacity-40',
		)}
	>
		<span className="text-muted-foreground/25 hover:text-muted-foreground/60 cursor-grab transition-colors">
			<GripVertical className="size-3.5" />
		</span>

		<div
			className={cn(
				'flex flex-1 items-center gap-2 rounded-lg border px-2.5 py-2 transition-all duration-150',
				isDragOver && !isDragging
					? 'border-primary/40 shadow-[0_0_0_3px_hsl(var(--primary)/0.08)]'
					: 'border-border/50 hover:border-border/80 hover:bg-muted/20 focus-within:border-primary/50 focus-within:bg-primary/[0.015] border-dashed',
			)}
		>
			<span
				className={cn(
					'border-border/60 flex shrink-0 items-center justify-center border bg-white',
					fieldType === 'radio'
						? 'size-3.5 rounded-full'
						: 'size-3.5 rounded-[3px]',
				)}
			/>

			<input
				onKeyDown={blurOnEnter}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={`Option ${index + 1}`}
				className="option-row-input text-foreground/90 placeholder:text-muted-foreground/40 flex-1 text-base focus:outline-none"
			/>
		</div>

		<div className="flex items-center gap-0.5">
			<button
				type="button"
				onClick={onDelete}
				className="text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive flex size-6 items-center justify-center rounded transition-colors"
			>
				<Trash2 className="size-3" />
			</button>
			<button
				type="button"
				onClick={onAddAfter}
				className="text-muted-foreground/40 hover:bg-muted hover:text-foreground flex size-6 items-center justify-center rounded transition-colors"
			>
				<Plus className="size-3" />
			</button>
		</div>
	</div>
);

interface QuestionEditorProps {
	value: string;
	onChange: (html: string) => void;
	autoFocus?: boolean;
}

const QuestionEditor = ({
	value,
	onChange,
	autoFocus,
}: QuestionEditorProps) => {
	const [isOpen, setIsOpen] = useState(false);
	const onChangeRef = useRef(onChange);
	const didFocusRef = useRef(false);
	onChangeRef.current = onChange;

	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				blockquote: false,
				bold: false,
				bulletList: false,
				code: false,
				codeBlock: false,
				hardBreak: false,
				heading: false,
				horizontalRule: false,
				italic: false,
				link: false,
				listItem: false,
				listKeymap: false,
				orderedList: false,
				strike: false,
				underline: false,
			}),
			PlaceholderExtension.configure({
				placeholder: __('Write a question…', 'allfeedback'),
			}),
		],
		editorProps: {
			handleKeyDown: (view, event) => {
				if (event.key === 'Enter' || event.key === 'Escape') {
					event.preventDefault();
					(view.dom as HTMLElement).blur();
					return true;
				}
				return false;
			},
		},
		content: value || '',
		onUpdate: ({ editor }) => onChangeRef.current(editor.getHTML()),
		onFocus: () => setIsOpen(true),
		onBlur: () => setIsOpen(false),
	});

	useEffect(() => {
		if (editor && !editor.isFocused && value !== editor.getHTML()) {
			editor.commands.setContent(value || '', { emitUpdate: false });
		}
	}, [value, editor]);

	useEffect(() => {
		if (autoFocus && editor && !didFocusRef.current) {
			didFocusRef.current = true;
			editor.commands.focus('end');
		}
	}, [autoFocus, editor]);

	return (
		<div>
			<div
				data-focused={isOpen}
				className={cn(
					'question-editor-field rounded-md border transition-colors',
					isOpen
						? 'border-border bg-muted/40'
						: 'hover:bg-muted/20 border-transparent',
				)}
			>
				<EditorContent editor={editor} />
			</div>
		</div>
	);
};

const TextFieldConfig = ({
	field,
	onChange,
}: {
	field: FormField;
	onChange: (f: FormField) => void;
}) => (
	<div className="space-y-4">

		<div className="space-y-1.5">
			<label className="text-foreground/90 block text-base font-normal">
				{__('Placeholder', 'allfeedback')}
			</label>
			<Input
				onKeyDown={blurOnEnter}
				value={field.placeholder ?? ''}
				onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
				placeholder="e.g. Enter your answer…"
			/>
		</div>
	</div>
);

const OptionsConfig = ({
	field,
	onChange,
}: {
	field: FormField;
	onChange: (f: FormField) => void;
}) => {
	const options = field.options ?? ['Option 1', 'Option 2', 'Option 3'];
	const [optDragIdx, setOptDragIdx] = useState<number | null>(null);
	const [optDropIdx, setOptDropIdx] = useState<number | null>(null);

	const updateOptions = (next: string[]) =>
		onChange({ ...field, options: next });

	const updateOption = (i: number, val: string) => {
		const next = [...options];
		next[i] = val;
		updateOptions(next);
	};

	const addOptionAfter = (i: number) => {
		const next = [...options];
		next.splice(i + 1, 0, '');
		updateOptions(next);
	};

	const removeOption = (i: number) => {
		if (options.length <= 1) return;
		updateOptions(options.filter((_, idx) => idx !== i));
	};

	const handleOptDrop = (_e: React.DragEvent, targetIdx: number) => {
		if (optDragIdx === null || optDragIdx === targetIdx) {
			setOptDragIdx(null);
			setOptDropIdx(null);
			return;
		}
		const next = [...options];
		const [removed] = next.splice(optDragIdx, 1);
		next.splice(targetIdx, 0, removed);
		updateOptions(next);
		setOptDragIdx(null);
		setOptDropIdx(null);
	};

	const fieldType = field.type as 'radio' | 'checkboxes';

	return (
		<div className="space-y-4">
			<div className="space-y-1.5">
				{options.map((opt, i) => (
					<OptionRow
						key={i}
						fieldType={fieldType}
						value={opt}
						index={i}
						isDragging={optDragIdx === i}
						isDragOver={optDropIdx === i && optDragIdx !== i}
						onChange={(v) => updateOption(i, v)}
						onDelete={() => removeOption(i)}
						onAddAfter={() => addOptionAfter(i)}
						onDragStart={(idx) => setOptDragIdx(idx)}
						onDragOver={(e, idx) => { e.preventDefault(); setOptDropIdx(idx); }}
						onDragEnd={() => { setOptDragIdx(null); setOptDropIdx(null); }}
						onDrop={handleOptDrop}
					/>
				))}
			</div>
		</div>
	);
};

const StarRatingConfig = ({
	field,
	onChange,
}: {
	field: FormField;
	onChange: (f: FormField) => void;
}) => {
	const range = field.starRange ?? 5;
	const labelCls = 'block text-base font-normal text-foreground/90';
	const chipCls = (active: boolean) =>
		cn(
			'flex h-8 w-10 items-center justify-center rounded-lg border text-sm font-semibold transition-colors',
			active
				? 'border-primary bg-primary/10 text-primary'
				: 'border-border/60 text-muted-foreground/60 hover:border-primary/40 hover:text-primary/70',
		);

	return (
		<div className="space-y-4">

			<div className="flex items-center gap-3">
				<span className={labelCls}>{__('Range', 'allfeedback')}</span>
				<div className="flex gap-1">
					<button type="button" onClick={() => onChange({ ...field, starRange: 5 })} className={chipCls(range === 5)}>5</button>
					<button type="button" onClick={() => onChange({ ...field, starRange: 10 })} className={chipCls(range === 10)}>10</button>
				</div>
			</div>
		</div>
	);
};

const ScaleConfig = ({
	field,
	onChange,
}: {
	field: FormField;
	onChange: (f: FormField) => void;
}) => {
	const min = field.scaleMin ?? 0;
	const max = field.scaleMax ?? 10;

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<label className="block text-base font-normal text-foreground/90">{__('Scale endpoints', 'allfeedback')}</label>
				<div className="flex items-center gap-2">
					<Input onKeyDown={blurOnEnter} type="number" value={min} onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v < max) onChange({ ...field, scaleMin: v }); }} className="!w-16 text-center" />
					<Input onKeyDown={blurOnEnter} value={field.scaleLowLabel ?? ''} onChange={(e) => onChange({ ...field, scaleLowLabel: e.target.value })} placeholder={__('e.g. Not likely', 'allfeedback')} />
					<span className="text-muted-foreground/40 shrink-0">—</span>
					<Input onKeyDown={blurOnEnter} value={field.scaleHighLabel ?? ''} onChange={(e) => onChange({ ...field, scaleHighLabel: e.target.value })} placeholder={__('e.g. Very likely', 'allfeedback')} />
					<Input onKeyDown={blurOnEnter} type="number" value={max} onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v > min) onChange({ ...field, scaleMax: v }); }} className="!w-16 text-center" />
				</div>
			</div>
		</div>
	);
};

const NpsConfig = () => (
	<div className="space-y-4">
		<p className="text-muted-foreground/60 text-sm">
			{__('0–6 detractors · 7–8 passives · 9–10 promoters', 'allfeedback')}
		</p>
	</div>
);

const getConditionValues = (
	source: FormField,
): { value: string; label: string }[] | null => {
	const range = (min: number, max: number) =>
		Array.from({ length: max - min + 1 }, (_, i) => String(min + i));
	switch (source.type) {
		case 'star_rating':
			return range(1, source.starRange ?? 5).map((v) => ({
				value: v,
				label:
					(source.starScale ?? 'star') === 'star'
						? `${'★'.repeat(Number(v))} (${v})`
						: v,
			}));
		case 'radio':
		case 'checkboxes':
			return (source.options ?? [])
				.filter((o) => o.trim() !== '')
				.map((o) => ({ value: o, label: o }));
		case 'scale':
			return range(source.scaleMin ?? 0, source.scaleMax ?? 10).map((v) => ({
				value: v,
				label: v,
			}));
		case 'nps':
			return range(0, 10).map((v) => ({ value: v, label: v }));
		default:
			return null;
	}
};

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
	is: __('is', 'allfeedback'),
	is_not: __('is not', 'allfeedback'),
	greater_than: __('is greater than', 'allfeedback'),
	less_than: __('is less than', 'allfeedback'),
};

const getOperators = (source: FormField | undefined): ConditionOperator[] =>
	source && NUMERIC_FIELD_TYPES.includes(source.type)
		? ['is', 'is_not', 'greater_than', 'less_than']
		: ['is', 'is_not'];

const ConditionConfig = ({
	field,
	sources,
	allFieldIds,
	onChange,
}: {
	field: FormField;
	sources: FormField[];
	allFieldIds: string[];
	onChange: (f: FormField) => void;
}) => {
	const condition: FieldCondition = field.condition ?? {
		enabled: false,
		fieldId: '',
		operator: 'is',
		value: '',
	};
	const source = sources.find((f) => f.id === condition.fieldId);
	const isQuestionBroken =
		condition.enabled && condition.fieldId !== '' && !source;
	const isValueBroken = isAnswerBroken(condition, source);
	const isBroken = isQuestionBroken || isValueBroken;
	const disabled = sources.length === 0;
	const enabled = condition.enabled && (!disabled || isBroken);
	const operator = condition.operator ?? 'is';
	const operators = getOperators(source);
	const values = source ? getConditionValues(source) : null;
	const valueLabel =
		source?.type === 'star_rating' && (source.starScale ?? 'star') === 'star'
			? `${condition.value} ★`
			: (values?.find((v) => v.value === condition.value)?.label ??
				condition.value);

	const brokenMessage = sprintf(
		/* translators: %s: reason the condition stopped working */
		__(
			'Hidden: %s Select the condition again or turn off the show condition.',
			'allfeedback',
		),
		isValueBroken
			? __('the selected answer no longer exists.', 'allfeedback')
			: allFieldIds.includes(condition.fieldId)
			? __(
					'this question shows up before the targeted question.',
					'allfeedback',
				)
			: __('the targeted question was deleted.', 'allfeedback'),
	);

	const update = (next: Partial<FieldCondition>) =>
		onChange({ ...field, condition: { ...condition, ...next } });

	const selectSource = (id: string) => {
		const next = sources.find((f) => f.id === id);
		update({
			fieldId: id,
			value: '',
			operator: getOperators(next).includes(operator) ? operator : 'is',
		});
	};

	const capsule = (
		<button
			type="button"
			disabled={disabled && !isBroken}
			aria-pressed={enabled}
			onClick={() => update({ enabled: !condition.enabled })}
			className={cn(
				'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-base transition-colors',
				enabled && !isBroken
					? 'border-border bg-primary/[0.06] text-primary'
					: 'border-border text-foreground/80 hover:bg-muted/40',
				disabled &&
					!isBroken &&
					'cursor-not-allowed opacity-50 hover:bg-transparent',
			)}
		>
			<span
				className={cn(
					'flex size-4 items-center justify-center rounded-full border',
					enabled && !isBroken
						? 'border-primary bg-primary text-white'
						: enabled
							? 'border-muted-foreground/40 bg-muted-foreground/40 text-white'
							: 'border-border',
				)}
			>
				{enabled && <Check className="size-2.5" strokeWidth={3} />}
			</span>
			{__('Show Condition', 'allfeedback')}
		</button>
	);

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-3">
				{disabled && !isBroken ? (
					<Tooltip
						content={__(
							'Add a question before this one to use conditions.',
							'allfeedback',
						)}
					>
						<span className="inline-flex">{capsule}</span>
					</Tooltip>
				) : (
					capsule
				)}
				{isBroken && (
					<span className="inline-flex items-center gap-1.5 text-sm text-amber-700">
						<TriangleAlert className="size-3.5 shrink-0" />
						{brokenMessage}
					</span>
				)}
			</div>

			{enabled && (
				<div
					className={cn(
						'border-border/60 bg-muted/30 space-y-2 rounded-lg border p-3',
					)}
				>
					<div className="flex flex-wrap items-center gap-2">
						<span className="text-foreground/90 text-base font-medium">
							{__('Show if', 'allfeedback')}
						</span>
						<Select
							value={source ? condition.fieldId : ''}
							onValueChange={selectSource}
							disabled={disabled}
						>
							<SelectTrigger
								className={cn(
									'min-w-0 max-w-sm flex-1 bg-white',
									isQuestionBroken && 'border-amber-500',
								)}
							>
								<SelectValue
									placeholder={__('Select a question', 'allfeedback')}
								/>
							</SelectTrigger>
							<SelectContent className="z-[100000]">
								{sources.map((f) => (
									<SelectItem key={f.id} value={f.id}>
										{htmlToText(f.label) || __('Untitled', 'allfeedback')}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select
							value={operator}
							onValueChange={(v) => update({ operator: v as ConditionOperator })}
							disabled={!source}
						>
							<SelectTrigger className="w-40 bg-white">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="z-[100000]">
								{operators.map((op) => (
									<SelectItem key={op} value={op}>
										{OPERATOR_LABELS[op]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{values ? (
							<Select
								value={isValueBroken ? '' : condition.value}
								onValueChange={(v) => update({ value: v })}
								disabled={!source}
							>
								<SelectTrigger
									className={cn(
										'w-48 bg-white',
										isValueBroken && 'border-amber-500',
									)}
								>
									<SelectValue
										placeholder={__('Select a value', 'allfeedback')}
									/>
								</SelectTrigger>
								<SelectContent className="z-[100000]">
									{values.map((v) => (
										<SelectItem key={v.value} value={v.value}>
											{v.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : (
							<Input
								onKeyDown={blurOnEnter}
								value={condition.value}
								onChange={(e) => update({ value: e.target.value })}
								disabled={!source}
								placeholder={__('Enter a value', 'allfeedback')}
								className="!w-48 bg-white"
							/>
						)}
					</div>
					{source && condition.value !== '' && !isValueBroken && (
						<p className="text-muted-foreground text-sm">
							<span className="text-foreground/90 font-medium">
								{__('Shown', 'allfeedback')}
							</span>{' '}
							{sprintf(
								/* translators: 1: question label, 2: comparison such as "is" or "is greater than", 3: answer value */
								__('when “%1$s” %2$s %3$s.', 'allfeedback'),
								htmlToText(source.label),
								OPERATOR_LABELS[operator],
								valueLabel,
							)}
						</p>
					)}
				</div>
			)}
		</div>
	);
};

export interface FieldEditorProps {
	field: FormField;
	index: number;
	isDragging: boolean;
	isDragOver: boolean;
	autoFocus?: boolean;
	isExpanded: boolean;
	conditionSources: FormField[];
	allFieldIds: string[];
	onExpand: () => void;
	onCollapse: () => void;
	onChange: (field: FormField) => void;
	onDelete: () => void;
	onDuplicate: () => void;
	onDragStart: (index: number) => void;
	onDragOver: (e: React.DragEvent, index: number) => void;
	onDragEnd: () => void;
	onDrop: (e: React.DragEvent, index: number) => void;
}

const FieldEditor = ({
	field,
	index,
	isDragging,
	isDragOver,
	autoFocus,
	isExpanded,
	conditionSources,
	allFieldIds,
	onExpand,
	onCollapse,
	onChange,
	onDelete,
	onDuplicate,
	onDragStart,
	onDragOver,
	onDragEnd,
	onDrop,
}: FieldEditorProps) => {
	const typeConfig = FIELD_TYPES.find((t) => t.type === field.type);
	const isCollapsed = !isExpanded;
	const wasExpandedRef = useRef(isExpanded);
	const [dragArmed, setDragArmed] = useState(false);

	const renderConfig = () => {
		switch (field.type) {
			case 'short_text':
			case 'long_text':
				return (
					<TextFieldConfig
						field={field}
						onChange={onChange}
					/>
				);
			case 'radio':
			case 'checkboxes':
				return (
					<OptionsConfig
						field={field}
						onChange={onChange}
					/>
				);
			case 'star_rating':
				return (
					<StarRatingConfig
						field={field}
						onChange={onChange}
					/>
				);
			case 'scale':
				return (
					<ScaleConfig
						field={field}
						onChange={onChange}
					/>
				);
			case 'nps':
				return (
					<NpsConfig />
				);
			default:
				return null;
		}
	};

	const cardRef = useRef<HTMLDivElement>(null);
	const typeConfigEl = renderConfig();
	const config = (
		<>
			{typeConfigEl}
			<ConditionConfig
				field={field}
				sources={conditionSources}
				allFieldIds={allFieldIds}
				onChange={onChange}
			/>
		</>
	);
	const conditionSource = conditionSources.find(
		(f) => f.id === field.condition?.fieldId,
	);
	const hasCondition =
		isConditionActive(
			field.condition,
			conditionSources.map((f) => f.id),
		) && !isAnswerBroken(field.condition, conditionSource);
	const hasBrokenCondition = isConditionBroken(
		field.condition,
		conditionSources,
	);

	return (
		<div
			ref={cardRef}
			onPointerDownCapture={() => {
				wasExpandedRef.current = isExpanded;
				if (!isExpanded) onExpand();
			}}
			onFocusCapture={() => {
				if (!isExpanded) onExpand();
			}}
			onDragOver={(e) => {
				e.stopPropagation();
				e.preventDefault();
				onDragOver(e, index);
			}}
			onDrop={(e) => {
				e.stopPropagation();
				e.preventDefault();
				onDrop(e, index);
			}}
			className={cn(
				'relative rounded-xl border bg-white transition-all duration-150',
				isDragging && 'scale-[0.98] opacity-40',
				isDragOver && !isDragging
					? 'border-primary/40 shadow-[0_0_0_3px_hsl(var(--primary)/0.08)]'
					: hasBrokenCondition
						? 'border-amber-500'
						: 'border-border/60',
			)}
		>
			<div
				draggable={dragArmed}
				onDragStart={(e) => {
					e.stopPropagation();
					const el = cardRef.current ?? (e.currentTarget as HTMLElement);
					const clone = el.cloneNode(true) as HTMLElement;
					Object.assign(clone.style, {
						position: 'fixed',
						top: '-9999px',
						left: '-9999px',
						width: `${el.offsetWidth}px`,
						transform: 'rotate(1.5deg) scale(1.02)',
						boxShadow:
							'0 20px 40px rgba(0,0,0,0.15), 0 6px 12px rgba(0,0,0,0.08)',
						borderRadius: '12px',
						overflow: 'hidden',
						pointerEvents: 'none',
					});
					document.body.appendChild(clone);
					e.dataTransfer.setDragImage(clone, el.offsetWidth / 2, 32);
					requestAnimationFrame(() => document.body.removeChild(clone));
					onDragStart(index);
				}}
				onDragEnd={(e) => {
					e.stopPropagation();
					setDragArmed(false);
					onDragEnd();
				}}
				className={cn(
					'flex items-center gap-2 rounded-xl px-4 py-3',
					config && 'cursor-pointer',
				)}
				onClick={() => {
					if (config && wasExpandedRef.current) onCollapse();
				}}
			>
				<Tooltip content={__('Drag to reorder', 'allfeedback')}>
					<span
						className="text-muted-foreground/40 hover:text-foreground/80 cursor-grab transition-colors active:cursor-grabbing"
						onClick={(e) => e.stopPropagation()}
						onMouseDown={(e) => {
							e.stopPropagation();
							setDragArmed(true);
						}}
						onMouseUp={() => setDragArmed(false)}
					>
						<GripVertical className="size-4" />
					</span>
				</Tooltip>

				{typeConfig && (
					<Tooltip content={typeConfig.label}>
						<span
							className="flex shrink-0 items-center"
							onClick={(e) => e.stopPropagation()}
						>
							<typeConfig.Icon className="text-muted-foreground/60 size-4" />
						</span>
					</Tooltip>
				)}

				<div
					className="min-w-0 flex-1"
					onClick={(e) => e.stopPropagation()}
					onMouseDown={(e) => e.stopPropagation()}
				>
					<QuestionEditor
						value={field.label}
						onChange={(html) => onChange({ ...field, label: html })}
						autoFocus={autoFocus}
					/>
				</div>

				<div className="ml-auto flex items-center gap-1">
					{(hasCondition || hasBrokenCondition) && (
						<Tooltip
							content={
								hasBrokenCondition
									? __(
											'Show condition is invalid. This question is hidden.',
											'allfeedback',
										)
									: __('Has show condition', 'allfeedback')
							}
						>
							<span
								className={cn(
									'flex size-6 items-center justify-center',
									hasBrokenCondition ? 'text-amber-700' : 'text-primary',
								)}
								onClick={(e) => e.stopPropagation()}
							>
								<GitBranch className="size-3.5" />
							</span>
						</Tooltip>
					)}
					<div
						onClick={(e) => e.stopPropagation()}
						onMouseDown={(e) => e.stopPropagation()}
					>
						<RequiredSwitch
							value={field.required}
							onChange={(v) => onChange({ ...field, required: v })}
						/>
					</div>

					{config && (
						<span className="flex size-6 items-center justify-center rounded transition-colors hover:bg-black/[0.06]">
							<ChevronDown
								className={cn(
									'size-3.5 transition-transform duration-200',
									isCollapsed && '-rotate-90',
								)}
							/>
						</span>
					)}

					<div
						className="flex items-center gap-0.5"
						onClick={(e) => e.stopPropagation()}
					>
						<Tooltip content={__('Duplicate field', 'allfeedback')}>
							<Button
								variant="ghost"
								size="icon-xs"
								onClick={onDuplicate}
								aria-label={__('Duplicate field', 'allfeedback')}
							>
								<Copy className="size-3" />
							</Button>
						</Tooltip>
						<Tooltip content={__('Delete field', 'allfeedback')}>
							<Button
								variant="ghost"
								size="icon-xs"
								onClick={onDelete}
								className="hover:bg-destructive/10 hover:text-destructive active:bg-destructive/15"
								aria-label={__('Delete field', 'allfeedback')}
							>
								<Trash2 className="size-3" />
							</Button>
						</Tooltip>
					</div>
				</div>
			</div>

			{config && (
				<div
					className={cn(
						'grid transition-[grid-template-rows] duration-200 ease-in-out',
						isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
					)}
				>
					<div className="overflow-hidden">
						<div className="space-y-3 px-5 pt-1 pb-4">{config}</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default FieldEditor;
