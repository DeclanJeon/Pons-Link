import type { CurrentFocus, TimeRange } from '../types/selfUnderstanding';

export const focusOptions: Array<{ value: CurrentFocus; title: string; description: string }> = [
  {
    value: 'traits',
    title: 'I want to understand my core traits',
    description: 'Start with how I use energy, recover, and react under pressure.',
  },
  {
    value: 'relationships',
    title: 'I want to understand myself in relationships',
    description: 'Clarify where friction appears and what kind of rhythm feels natural.',
  },
  {
    value: 'growth',
    title: 'I need a clearer standard for recent decisions',
    description: 'Find decision criteria and balance points that fit my current stage.',
  },
  {
    value: 'strengths',
    title: 'I want to understand my strengths and growth points',
    description: 'See the environments where my strengths come alive and how to expand them.',
  },
];

export const timeRangeOptions: Array<{ value: TimeRange; label: string }> = [
  { value: 'dawn', label: 'Dawn' },
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'night', label: 'Night' },
];

export const onboardingPreviewCards = [
  { label: 'Core summary', summary: 'Start with one clear sentence that explains you.' },
  { label: 'When your strengths show up', summary: 'See the environments where your strengths become visible.' },
  { label: 'Relationship notes', summary: 'Understand your rhythm and likely friction points.' },
  { label: 'Growth checkpoint', summary: 'Get a hint for rebuilding your standard when things feel unstable.' },
];
