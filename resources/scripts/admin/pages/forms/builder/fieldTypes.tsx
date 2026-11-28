import { __ } from '@wordpress/i18n';
import type { LucideIcon } from 'lucide-react';
import {
	AlignLeft,
	BarChart3,
	CheckSquare,
	CircleDot,
	Gauge,
	Mail,
	Star,
	Type,
} from 'lucide-react';
import type { FieldType } from './types';

export interface FieldTypeConfig {
	type: FieldType;
	label: string;
	Icon: LucideIcon;
	iconBg: string;
	iconColor: string;
	defaultLabel: string;
}

export const FIELD_TYPES: FieldTypeConfig[] = [
	{
		type: 'short_text',
		label: __('Short Text', 'allfeedback'),
		Icon: Type,
		iconBg: '#fef2f2',
		iconColor: '#f43f5e',
		defaultLabel: 'What is your name?',
	},
	{
		type: 'long_text',
		label: __('Long Text', 'allfeedback'),
		Icon: AlignLeft,
		iconBg: '#eff6ff',
		iconColor: '#3b82f6',
		defaultLabel: 'Please describe your experience.',
	},
	{
		type: 'email',
		label: __('Email', 'allfeedback'),
		Icon: Mail,
		iconBg: '#eef2ff',
		iconColor: '#6366f1',
		defaultLabel: 'What is your email address?',
	},
	{
		type: 'radio',
		label: __('Radio', 'allfeedback'),
		Icon: CircleDot,
		iconBg: '#f5f3ff',
		iconColor: '#8b5cf6',
		defaultLabel: 'Which option best describes you?',
	},
	{
		type: 'checkboxes',
		label: __('Checkboxes', 'allfeedback'),
		Icon: CheckSquare,
		iconBg: '#f0fdf4',
		iconColor: '#22c55e',
		defaultLabel: 'Select all that apply.',
	},
	{
		type: 'star_rating',
		label: __('Star Rating', 'allfeedback'),
		Icon: Star,
		iconBg: '#fffbeb',
		iconColor: '#f59e0b',
		defaultLabel: 'How would you rate your overall experience?',
	},
	{
		type: 'scale',
		label: __('Scale', 'allfeedback'),
		Icon: BarChart3,
		iconBg: '#ecfdf5',
		iconColor: '#10b981',
		defaultLabel: 'How would you rate us on a scale?',
	},
	{
		type: 'nps',
		label: __('NPS', 'allfeedback'),
		Icon: Gauge,
		iconBg: '#fff1f2',
		iconColor: '#e11d48',
		defaultLabel:
			'How likely are you to recommend us to a friend or colleague?',
	},
];
