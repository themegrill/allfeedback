import { Tooltip } from '@/admin/components/Tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { __, sprintf } from '@wordpress/i18n';
import { Copy, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import FieldEditor from './FieldEditor';
import FieldTypeMenu from './FieldTypeMenu';
import { FIELD_TYPES } from './fieldTypes';
import type { FieldType, FormField, FormSection } from './types';

interface FieldPos {
	sectionIdx: number;
	fieldIdx: number;
}

interface SectionCardProps {
	section: FormSection;
	index: number;
	sectionCount: number;
	precedingFields: FormField[];
	allFields: FormField[];
	isDragging: boolean;
	isDragOver: boolean;
	fieldDrag: FieldPos | null;
	fieldDrop: FieldPos | null;
	onSectionChange: (section: FormSection) => void;
	onSectionDelete: () => void;
	onSectionDuplicate: () => void;
	onSectionFocus?: () => void;
	onDragStart: (index: number) => void;
	onDragOver: (e: React.DragEvent, index: number) => void;
	onDragEnd: () => void;
	onDrop: (e: React.DragEvent, index: number) => void;
	onFieldDragStart: (sectionIdx: number, fieldIdx: number) => void;
	onFieldDragOver: (sectionIdx: number, fieldIdx: number) => void;
	onFieldDragLeave: () => void;
	onFieldDragEnd: () => void;
	onFieldDrop: (sectionIdx: number, fieldIdx: number) => void;
}

const SectionCard = ({
	section,
	index,
	precedingFields,
	allFields,
	isDragging,
	isDragOver,
	fieldDrag,
	fieldDrop,
	onSectionChange,
	onSectionDelete,
	onSectionDuplicate,
	onSectionFocus,
	onDragOver,
	onDrop,
	onFieldDragStart,
	onFieldDragOver,
	onFieldDragLeave,
	onFieldDragEnd,
	onFieldDrop,
}: SectionCardProps) => {
	const [menuOpen, setMenuOpen] = useState(false);
	const [newFieldId, setNewFieldId] = useState<string | null>(null);
	const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);
	const addFieldBtnRef = useRef<HTMLButtonElement>(null);
	const cardRef = useRef<HTMLDivElement>(null);

	const toggleMenu = () => setMenuOpen((v) => !v);
	const closeMenu = () => setMenuOpen(false);

	const addField = useCallback(
		(type: FieldType) => {
			const typeConfig = FIELD_TYPES.find((t) => t.type === type)!;
			const id = `field-${Date.now()}-${Math.random().toString(36).slice(2)}`;
			const newField: FormField = {
				id,
				type,
				label: typeConfig.defaultLabel,
				required: false,
				...(type === 'radio' || type === 'checkboxes'
					? { options: ['Option 1', 'Option 2', 'Option 3'] }
					: {}),
				...(type === 'short_text' || type === 'long_text' || type === 'email'
					? { placeholder: '' }
					: {}),
			};
			onSectionChange({ ...section, fields: [...section.fields, newField] });
			setNewFieldId(id);
			setExpandedFieldId(id);
		},
		[section, onSectionChange],
	);

	const handleFieldChange = useCallback(
		(fieldIdx: number, field: FormField) => {
			const next = [...section.fields];
			next[fieldIdx] = field;
			onSectionChange({ ...section, fields: next });
		},
		[section, onSectionChange],
	);

	const deleteField = useCallback(
		(fieldIdx: number) => {
			onSectionChange({
				...section,
				fields: section.fields.filter((_, i) => i !== fieldIdx),
			});
		},
		[section, onSectionChange],
	);

	const duplicateField = useCallback(
		(fieldIdx: number) => {
			const copy: FormField = {
				...section.fields[fieldIdx],
				id: `field-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			};
			const next = [...section.fields];
			next.splice(fieldIdx + 1, 0, copy);
			onSectionChange({ ...section, fields: next });
		},
		[section, onSectionChange],
	);

	return (
		<div
			ref={cardRef}
			onPointerDown={() => onSectionFocus?.()}
			onDragOver={(e) => {
				e.preventDefault();
				onDragOver(e, index);
			}}
			onDrop={(e) => {
				e.preventDefault();
				onDrop(e, index);
			}}
			className={cn(
				'overflow-hidden rounded-2xl border bg-white transition-all duration-150',
				isDragging && 'scale-[0.98] opacity-40',
				isDragOver && !isDragging
					? 'border-primary/40 shadow-[0_0_0_3px_hsl(var(--primary)/0.08)]'
					: 'border-border/60',
			)}
		>
			<div className="border-border/50 flex items-center border-b bg-white px-5 py-3.5">
				<div className="text-foreground/90 flex-1 px-2 py-[5.5px] text-base font-semibold">
					{sprintf(
						/* translators: %d: page number */
						__('Page %d', 'allfeedback'),
						index + 1,
					)}
				</div>

				<div className="flex items-center gap-0.5">
					<Tooltip content={__('Duplicate page', 'allfeedback')}>
						<Button
							variant="ghost"
							size="icon-xs"
							onClick={onSectionDuplicate}
							aria-label={__('Duplicate page', 'allfeedback')}
						>
							<Copy className="size-3.5" />
						</Button>
					</Tooltip>
					<Tooltip content={__('Delete page', 'allfeedback')}>
						<Button
							variant="ghost"
							size="icon-xs"
							onClick={onSectionDelete}
							className="hover:bg-destructive/10 hover:text-destructive active:bg-destructive/15 shrink-0"
							aria-label={__('Delete page', 'allfeedback')}
						>
							<Trash2 className="size-3.5" />
						</Button>
					</Tooltip>
				</div>
			</div>

			<div
				className="grid grid-rows-[1fr]"
			>
				<div className="overflow-hidden">
					<div className="bg-white p-5">
						{section.fields.length > 0 && (
							<div
								className="mb-3 space-y-4"
								onDragOver={(e) => e.stopPropagation()}
								onDragLeave={(e) => {
									if (!e.currentTarget.contains(e.relatedTarget as Node)) {
										onFieldDragLeave();
									}
								}}
							>
								{section.fields.map((field, fieldIdx) => (
									<FieldEditor
										key={field.id}
										field={field}
										index={fieldIdx}
										isDragging={
											fieldDrag?.sectionIdx === index &&
											fieldDrag?.fieldIdx === fieldIdx
										}
										isDragOver={
											fieldDrop?.sectionIdx === index &&
											fieldDrop?.fieldIdx === fieldIdx &&
											!(
												fieldDrag?.sectionIdx === index &&
												fieldDrag?.fieldIdx === fieldIdx
											)
										}
										precedingFields={[
											...precedingFields,
											...section.fields.slice(0, fieldIdx),
										]}
										allFields={allFields}
										autoFocus={newFieldId === field.id}
										isExpanded={expandedFieldId === field.id}
										onExpand={() => setExpandedFieldId(field.id)}
										onCollapse={() => setExpandedFieldId(null)}
										onChange={(f) => handleFieldChange(fieldIdx, f)}
										onDelete={() => deleteField(fieldIdx)}
										onDuplicate={() => duplicateField(fieldIdx)}
										onDragStart={() => onFieldDragStart(index, fieldIdx)}
										onDragOver={(_e, _i) => onFieldDragOver(index, fieldIdx)}
										onDragEnd={onFieldDragEnd}
										onDrop={(_e, _i) => onFieldDrop(index, fieldIdx)}
									/>
								))}
							</div>
						)}

						<div className="flex">
							<Button
								ref={addFieldBtnRef}
								size="sm"
								variant="ghost"
								onMouseDown={(e) => e.preventDefault()}
								onClick={toggleMenu}
								className={cn(menuOpen && 'bg-muted/60 text-foreground')}
							>
								{menuOpen ? (
									<>
										<X className="size-3.5" />
										{__('Close', 'allfeedback')}
									</>
								) : (
									<>
										<Plus className="size-3.5" />
										{__('Add Field', 'allfeedback')}
									</>
								)}
							</Button>
						</div>
					</div>
				</div>
			</div>

			{menuOpen && (
				<FieldTypeMenu
					triggerRef={addFieldBtnRef}
					onSelect={addField}
					onClose={closeMenu}
				/>
			)}
		</div>
	);
};

export default SectionCard;
