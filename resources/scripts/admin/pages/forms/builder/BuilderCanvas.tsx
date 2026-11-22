import { Button } from '@/components/ui/button';
import { __, sprintf } from '@wordpress/i18n';
import { Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import EmptyCanvasIllustration from './EmptyCanvasIllustration';
import SectionCard from './SectionCard';
import type { FormSection } from './types';

interface BuilderCanvasProps {
	sections: FormSection[];
	onSectionsChange: (sections: FormSection[]) => void;
	onScrollChange?: (scrolled: boolean, progress: number) => void;
	activeSectionIndex?: number;
	onActiveSectionChange?: (sectionIndex: number) => void;
}

interface FieldPos {
	sectionIdx: number;
	fieldIdx: number;
}

const BuilderCanvas = ({
	sections,
	onSectionsChange,
	onScrollChange,
	activeSectionIndex,
	onActiveSectionChange,
}: BuilderCanvasProps) => {
	const [sectionDragIdx, setSectionDragIdx] = useState<number | null>(null);
	const [sectionDropIdx, setSectionDropIdx] = useState<number | null>(null);
	// The active page lives in FormBuilder so the preview and builder share it.
	const currentIdx = Math.min(
		Math.max(activeSectionIndex ?? 0, 0),
		Math.max(sections.length - 1, 0),
	);

	const selectSection = useCallback(
		(idx: number) => onActiveSectionChange?.(idx),
		[onActiveSectionChange],
	);

	const [fieldDrag, setFieldDrag] = useState<FieldPos | null>(null);
	const [fieldDrop, setFieldDrop] = useState<FieldPos | null>(null);

	const addSection = useCallback(() => {
		const newSection: FormSection = {
			id: `section-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			title: `Page ${sections.length + 1}`,
			fields: [],
		};
		onSectionsChange([...sections, newSection]);
		selectSection(sections.length);
	}, [sections, onSectionsChange, selectSection]);

	const handleSectionChange = useCallback(
		(idx: number, section: FormSection) => {
			const next = [...sections];
			next[idx] = section;
			onSectionsChange(next);
		},
		[sections, onSectionsChange],
	);

	const deleteSection = useCallback(
		(idx: number) => {
			onSectionsChange(sections.filter((_, i) => i !== idx));
			selectSection(Math.max(0, idx - 1));
		},
		[sections, onSectionsChange, selectSection],
	);

	const duplicateSection = useCallback(
		(idx: number) => {
			const copy: FormSection = {
				...sections[idx],
				id: `section-${Date.now()}-${Math.random().toString(36).slice(2)}`,
				fields: sections[idx].fields.map((f) => ({
					...f,
					id: `field-${Date.now()}-${Math.random().toString(36).slice(2)}`,
				})),
			};
			const next = [...sections];
			next.splice(idx + 1, 0, copy);
			onSectionsChange(next);
			selectSection(idx + 1);
		},
		[sections, onSectionsChange, selectSection],
	);

	const handleSectionDragStart = (idx: number) => setSectionDragIdx(idx);

	const handleSectionDragOver = (e: React.DragEvent, idx: number) => {
		e.preventDefault();
		if (sectionDragIdx !== null) setSectionDropIdx(idx);
	};

	const handleSectionDragEnd = () => {
		setSectionDragIdx(null);
		setSectionDropIdx(null);
	};

	const handleSectionDrop = (e: React.DragEvent, targetIdx: number) => {
		e.preventDefault();
		if (sectionDragIdx === null || sectionDragIdx === targetIdx) {
			setSectionDragIdx(null);
			setSectionDropIdx(null);
			return;
		}
		const next = [...sections];
		const [removed] = next.splice(sectionDragIdx, 1);
		next.splice(targetIdx, 0, removed);
		onSectionsChange(next);
		selectSection(targetIdx);
		setSectionDragIdx(null);
		setSectionDropIdx(null);
	};

	const handleFieldDragStart = (sectionIdx: number, fieldIdx: number) => {
		setFieldDrag({ sectionIdx, fieldIdx });
	};

	const handleFieldDragOver = (sectionIdx: number, fieldIdx: number) => {
		if (fieldDrag !== null) setFieldDrop({ sectionIdx, fieldIdx });
	};

	const handleFieldDragLeave = () => setFieldDrop(null);

	const handleFieldDragEnd = () => {
		setFieldDrag(null);
		setFieldDrop(null);
	};

	const handleFieldDrop = (
		targetSectionIdx: number,
		targetFieldIdx: number,
	) => {
		if (!fieldDrag) {
			setFieldDrag(null);
			setFieldDrop(null);
			return;
		}
		const { sectionIdx: fromSec, fieldIdx: fromField } = fieldDrag;
		if (fromSec === targetSectionIdx && fromField === targetFieldIdx) {
			setFieldDrag(null);
			setFieldDrop(null);
			return;
		}
		const next = sections.map((s) => ({ ...s, fields: [...s.fields] }));
		const [removed] = next[fromSec].fields.splice(fromField, 1);
		next[targetSectionIdx].fields.splice(targetFieldIdx, 0, removed);
		onSectionsChange(next);
		setFieldDrag(null);
		setFieldDrop(null);
	};

	if (sections.length === 0) {
		return (
			<div className="bg-background flex flex-1 items-center justify-center">
				<div className="flex flex-col items-center">
					<EmptyCanvasIllustration />
					<Button onClick={addSection} className="-mt-1">
						<Plus className="size-4" />
						{__('Add a Page', 'allfeedback')}
					</Button>
				</div>
			</div>
		);
	}

	const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const el = e.currentTarget;
		const scrolled = el.scrollTop > 0;
		const progress =
			el.scrollHeight <= el.clientHeight
				? 0
				: el.scrollTop / (el.scrollHeight - el.clientHeight);
		onScrollChange?.(scrolled, progress);
	};

	const section = sections[currentIdx];

	return (
		<div className="flex-1 overflow-y-auto bg-background p-5" onScroll={handleScroll}>
			<div className="w-full space-y-5">
				<div
					className="flex flex-wrap items-center justify-center gap-3"
					onDragLeave={(e) => {
						if (!e.currentTarget.contains(e.relatedTarget as Node)) {
							setSectionDropIdx(null);
						}
					}}
				>
					{sections.map((s, idx) => (
						<button
							key={s.id}
							type="button"
							draggable
							onClick={() => selectSection(idx)}
							onDragStart={() => handleSectionDragStart(idx)}
							onDragOver={(e) => handleSectionDragOver(e, idx)}
							onDragEnd={handleSectionDragEnd}
							onDrop={(e) => handleSectionDrop(e, idx)}
							aria-current={idx === currentIdx ? 'page' : undefined}
							className={`rounded-full border-2 bg-white px-6 py-2 text-sm transition-colors ${
								idx === currentIdx
									? 'border-primary text-primary font-medium'
									: 'border-border text-muted-foreground hover:border-primary/50'
							} ${sectionDropIdx === idx && sectionDragIdx !== idx ? 'ring-primary/40 ring-2' : ''} ${
								sectionDragIdx === idx ? 'opacity-50' : ''
							}`}
						>
							{sprintf(
								/* translators: %d: page number */
								__('Page %d', 'allfeedback'),
								idx + 1,
							)}
						</button>
					))}

					<button
						type="button"
						onClick={addSection}
						className="border-border text-foreground hover:border-primary/50 flex items-center gap-1 rounded-full border-2 bg-white px-6 py-2 text-sm transition-colors"
					>
						<Plus className="size-3.5" />
						{__('Add page', 'allfeedback')}
					</button>
				</div>

				{section && (
					<SectionCard
						key={section.id}
						section={section}
						index={currentIdx}
						sectionCount={sections.length}
						precedingFields={sections
							.slice(0, currentIdx)
							.flatMap((s) => s.fields)}
						allFields={sections.flatMap((s) => s.fields)}
						isDragging={false}
						isDragOver={false}
						fieldDrag={fieldDrag}
						fieldDrop={fieldDrop}
						onSectionChange={(s) => handleSectionChange(currentIdx, s)}
						onSectionDelete={() => deleteSection(currentIdx)}
						onSectionDuplicate={() => duplicateSection(currentIdx)}
						onSectionFocus={() => onActiveSectionChange?.(currentIdx)}
						onDragStart={handleSectionDragStart}
						onDragOver={handleSectionDragOver}
						onDragEnd={handleSectionDragEnd}
						onDrop={handleSectionDrop}
						onFieldDragStart={handleFieldDragStart}
						onFieldDragOver={handleFieldDragOver}
						onFieldDragLeave={handleFieldDragLeave}
						onFieldDragEnd={handleFieldDragEnd}
						onFieldDrop={handleFieldDrop}
					/>
				)}
			</div>
		</div>
	);
};

export default BuilderCanvas;
