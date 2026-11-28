import { ContentPicker } from '@/admin/components/ContentPicker';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { __ } from '@wordpress/i18n';
import { useRef } from 'react';
import type {
	DelayUnit,
	DismissUnit,
	DisplayFrequency,
	FormSettings,
	TargetPages,
	TriggerType,
	UserState,
} from './types';

interface SettingsPanelProps {
	settings: FormSettings;
	onChange: (settings: FormSettings) => void;
	onScrollChange?: (scrolled: boolean) => void;
}

const labelCls = 'text-base font-normal text-foreground/90';

const Row = ({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) => (
	<div className="flex items-center gap-4">
		<label className={cn(labelCls, 'w-[32%] shrink-0')}>{label}</label>
		<div className="min-w-0 flex-1">{children}</div>
	</div>
);

const Card = ({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) => (
	<div className="border-border/60 overflow-hidden rounded-2xl border bg-white">
		<div className="border-border/50 border-b p-5">
			<div className="text-base font-semibold text-foreground/90">{title}</div>
		</div>
		<div className="space-y-4 p-5">{children}</div>
	</div>
);

const Chips = <T extends string>({
	options,
	value,
	onChange,
}: {
	options: { value: T; label: string }[];
	value: T;
	onChange: (v: T) => void;
}) => (
	<div className="flex flex-wrap gap-1.5">
		{options.map((opt) => (
			<button
				key={opt.value}
				type="button"
				onClick={() => onChange(opt.value)}
				className={cn(
					'rounded-lg border px-3 py-2 text-base transition-colors',
					value === opt.value
						? 'border-primary/30 bg-primary/10 text-primary font-medium'
						: 'border-border/60 bg-muted/30 text-foreground/70 hover:border-border hover:bg-muted/60',
				)}
			>
				{opt.label}
			</button>
		))}
	</div>
);

const Collapse = ({
	open,
	children,
}: {
	open: boolean;
	children: React.ReactNode;
}) => (
	<div
		className={cn(
			'grid transition-[grid-template-rows] duration-200 ease-in-out',
			open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
		)}
	>
		<div className="overflow-hidden">
			<div className="border-primary/20 ml-1 border-l-2 pt-4 pl-4">
				{children}
			</div>
		</div>
	</div>
);

const NumberWithUnit = <U extends string>({
	numberValue,
	unit,
	unitOptions,
	onNumberChange,
	onUnitChange,
	min = 0,
}: {
	numberValue: number;
	unit: U;
	unitOptions: { value: U; label: string }[];
	onNumberChange: (v: number) => void;
	onUnitChange: (v: U) => void;
	min?: number;
}) => (
	<div className="flex items-center gap-2">
		<Input
			type="number"
			min={min}
			value={numberValue}
			onChange={(e) => onNumberChange(Math.max(min, Number(e.target.value)))}
			className="w-24"
		/>
		<Select value={unit} onValueChange={(v) => onUnitChange(v as U)}>
			<SelectTrigger className="flex-1">
				<SelectValue />
			</SelectTrigger>
			<SelectContent className="z-[100000]">
				{unitOptions.map((o) => (
					<SelectItem key={o.value} value={o.value}>
						{o.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	</div>
);

const PAGE_OPTIONS: { value: Exclude<TargetPages, 'none'>; label: string }[] = [
	{ value: 'all', label: __('All', 'allfeedback') },
	{ value: 'specific_pages', label: __('Specific Pages', 'allfeedback') },
	{ value: 'specific_posts', label: __('Specific Posts', 'allfeedback') },
];

const DISMISS_UNIT_OPTIONS: { value: DismissUnit; label: string }[] = [
	{ value: 'hours', label: __('Hours', 'allfeedback') },
	{ value: 'days', label: __('Days', 'allfeedback') },
	{ value: 'weeks', label: __('Weeks', 'allfeedback') },
];

const DELAY_UNIT_OPTIONS: { value: DelayUnit; label: string }[] = [
	{ value: 'seconds', label: __('Seconds', 'allfeedback') },
	{ value: 'minutes', label: __('Minutes', 'allfeedback') },
	{ value: 'hours', label: __('Hours', 'allfeedback') },
];

const SettingsPanel = ({
	settings,
	onChange,
	onScrollChange,
}: SettingsPanelProps) => {
	const update = (patch: Partial<FormSettings>) =>
		onChange({ ...settings, ...patch });

	const showAutomatically = settings.targetPages !== 'none';
	// Restores the last "Show on" choice when auto-show is turned back on.
	const lastTargetPages = useRef<Exclude<TargetPages, 'none'>>('all');
	if (settings.targetPages !== 'none') {
		lastTargetPages.current = settings.targetPages;
	}

	const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
		onScrollChange?.(e.currentTarget.scrollTop > 0);
	};

	return (
		<div
			className="bg-background flex-1 overflow-y-auto p-5"
			onScroll={handleScroll}
		>
			<div className="w-full space-y-4">
				<Card title={__('Widget Label', 'allfeedback')}>
					<Row label={__('Widget label', 'allfeedback')}>
						<Input
							type="text"
							value={settings.widgetLabel}
							placeholder={__('Feedback', 'allfeedback')}
							onChange={(e) => update({ widgetLabel: e.target.value })}
						/>
					</Row>
				</Card>

				<Card title={__('Targeting', 'allfeedback')}>
					<Row label={__('Show to', 'allfeedback')}>
						<Select
							value={settings.userState}
							onValueChange={(v) => update({ userState: v as UserState })}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="z-[100000]">
								<SelectItem value="all">
									{__('Everyone', 'allfeedback')}
								</SelectItem>
								<SelectItem value="logged_in">
									{__('Logged in users', 'allfeedback')}
								</SelectItem>
								<SelectItem value="logged_out">
									{__('Logged out visitors', 'allfeedback')}
								</SelectItem>
							</SelectContent>
						</Select>
					</Row>
					<Row label={__('Show automatically', 'allfeedback')}>
						<Switch
							checked={showAutomatically}
							onCheckedChange={(on) =>
								update({
									targetPages: on ? lastTargetPages.current : 'none',
								})
							}
						/>
					</Row>
					{!showAutomatically && (
						<p className="text-muted-foreground text-sm">
							{__(
								'This survey only appears where you embed it with its shortcode or block.',
								'allfeedback',
							)}
						</p>
					)}
					{showAutomatically && (
						<Row label={__('Show on', 'allfeedback')}>
							<Chips
								options={PAGE_OPTIONS}
								value={lastTargetPages.current}
								onChange={(v) => update({ targetPages: v })}
							/>
						</Row>
					)}
					<div>
						<Collapse open={settings.targetPages === 'specific_pages'}>
							<Row label={__('Select pages', 'allfeedback')}>
								<ContentPicker
									postType="page"
									selected={settings.targetPageIds}
									onChange={(items) => update({ targetPageIds: items })}
									placeholder={__('Search pages…', 'allfeedback')}
								/>
							</Row>
						</Collapse>
						<Collapse open={settings.targetPages === 'specific_posts'}>
							<Row label={__('Select posts', 'allfeedback')}>
								<ContentPicker
									postType="post"
									selected={settings.targetPostIds}
									onChange={(items) => update({ targetPostIds: items })}
									placeholder={__('Search posts…', 'allfeedback')}
								/>
							</Row>
						</Collapse>
					</div>
				</Card>

				{showAutomatically && (
					<>
						<Card title={__('Trigger', 'allfeedback')}>
							<Row label={__('When to appear', 'allfeedback')}>
								<Select
									value={settings.triggerType}
									onValueChange={(v) => update({ triggerType: v as TriggerType })}
								>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="z-[100000]">
										<SelectItem value="immediate">
											{__('Page load — Immediately', 'allfeedback')}
										</SelectItem>
										<SelectItem value="time_delay">
											{__('Page load — After a delay', 'allfeedback')}
										</SelectItem>
									</SelectContent>
								</Select>
							</Row>
							<Collapse open={settings.triggerType === 'time_delay'}>
								<Row label={__('Delay', 'allfeedback')}>
									<NumberWithUnit
										numberValue={settings.delayValue}
										unit={settings.delayUnit}
										unitOptions={DELAY_UNIT_OPTIONS}
										onNumberChange={(v) => update({ delayValue: v })}
										onUnitChange={(v) => update({ delayUnit: v })}
										min={1}
									/>
								</Row>
							</Collapse>
						</Card>

						<Card title={__('Frequency & Limits', 'allfeedback')}>
							<Row label={__('Display frequency', 'allfeedback')}>
								<Select
									value={settings.displayFrequency}
									onValueChange={(v) =>
										update({ displayFrequency: v as DisplayFrequency })
									}
								>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="z-[100000]">
										<SelectItem value="until_submit">
											{__('Until submitted', 'allfeedback')}
										</SelectItem>
										<SelectItem value="once">
											{__('Once only', 'allfeedback')}
										</SelectItem>
									</SelectContent>
								</Select>
							</Row>
							<Collapse open={settings.displayFrequency === 'until_submit'}>
								<div className="space-y-4">
									<Row label={__('Max impressions', 'allfeedback')}>
										<Input
											type="number"
											min={0}
											value={settings.maxImpressions}
											onChange={(e) =>
												update({
													maxImpressions: Math.max(0, Number(e.target.value)),
												})
											}
											className="w-24"
										/>
									</Row>
									<Row label={__('Re-show after dismissal', 'allfeedback')}>
										<NumberWithUnit
											numberValue={settings.dismissWaitValue}
											unit={settings.dismissWaitUnit}
											unitOptions={DISMISS_UNIT_OPTIONS}
											onNumberChange={(v) => update({ dismissWaitValue: v })}
											onUnitChange={(v) => update({ dismissWaitUnit: v })}
										/>
									</Row>
								</div>
							</Collapse>
						</Card>
					</>
				)}

				<Card title={__('Thank You Page', 'allfeedback')}>
					<Row label={__('Enable', 'allfeedback')}>
						<Switch
							checked={settings.thankYouEnabled}
							onCheckedChange={(v) => update({ thankYouEnabled: v })}
						/>
					</Row>
					<Collapse open={settings.thankYouEnabled}>
						<div className="space-y-4">
							<Row label={__('Title', 'allfeedback')}>
								<Input
									value={settings.thankYouTitle}
									onChange={(e) => update({ thankYouTitle: e.target.value })}
									placeholder={__('Thank you!', 'allfeedback')}
								/>
							</Row>
							<Row label={__('Description', 'allfeedback')}>
								<Textarea
									value={settings.thankYouDescription}
									onChange={(e) =>
										update({ thankYouDescription: e.target.value })
									}
									placeholder={__(
										'Your response has been recorded.',
										'allfeedback',
									)}
									rows={3}
								/>
							</Row>
						</div>
					</Collapse>
				</Card>

				<Card title={__('Submit Buttons', 'allfeedback')}>
					<Row label={__('Submit label', 'allfeedback')}>
						<Input
							value={settings.submitLabel}
							onChange={(e) => update({ submitLabel: e.target.value })}
							placeholder="Submit"
						/>
					</Row>
					<Row label={__('Next label', 'allfeedback')}>
						<Input
							value={settings.nextLabel}
							onChange={(e) => update({ nextLabel: e.target.value })}
							placeholder="Next"
						/>
					</Row>
					<Row label={__('Back label', 'allfeedback')}>
						<Input
							value={settings.backLabel}
							onChange={(e) => update({ backLabel: e.target.value })}
							placeholder="Back"
						/>
					</Row>
				</Card>
			</div>
		</div>
	);
};

export default SettingsPanel;
