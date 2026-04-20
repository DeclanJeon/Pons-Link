export type BirthTimeMode = 'exact' | 'approximate' | 'unknown';
export type TimeRange = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';
export type CurrentFocus = 'traits' | 'relationships' | 'growth' | 'strengths';
export type InsightCategory = 'home' | 'traits' | 'relationships' | 'growth';

export interface SelfUnderstandingCoreInput {
  birthDate: string;
  birthTimeMode: BirthTimeMode;
  birthTimeValue?: string;
  timeRange?: TimeRange;
  timezoneOrBirthplace: string;
  currentFocus: CurrentFocus;
}

export interface InsightCardData {
  id: string;
  label: string;
  summary: string;
  interpretation?: string;
  example?: string;
  meaning?: string;
  action?: string;
  tags?: string[];
}

export interface SelfUnderstandingResult {
  generatedAt: string;
  overview: InsightCardData;
  strengths: InsightCardData[];
  traits: InsightCardData[];
  relationships: InsightCardData[];
  growth: InsightCardData[];
}

export interface SavedInsight {
  id: string;
  category: InsightCategory;
  summary: string;
  savedAt: string;
}

export const DEFAULT_CORE_INPUT: SelfUnderstandingCoreInput = {
  birthDate: '',
  birthTimeMode: 'unknown',
  timezoneOrBirthplace: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul',
  currentFocus: 'traits',
};
