import type { CurrentFocus, TimeRange } from '../types/selfUnderstanding';

export const focusOptions: Array<{ value: CurrentFocus; title: string; description: string }> = [
  {
    value: 'traits',
    title: '나의 기본 기질이 궁금해요',
    description: '내가 어떤 방식으로 힘을 쓰고 흔들리는지 먼저 알고 싶어요.',
  },
  {
    value: 'relationships',
    title: '관계에서의 내가 궁금해요',
    description: '사람과 부딪히는 지점과 편안한 리듬을 이해하고 싶어요.',
  },
  {
    value: 'growth',
    title: '요즘 선택이 흔들려서 기준이 필요해요',
    description: '지금의 나에게 맞는 선택 기준과 균형 포인트를 보고 싶어요.',
  },
  {
    value: 'strengths',
    title: '강점과 성장 포인트가 궁금해요',
    description: '내 강점이 잘 살아나는 환경과 확장 방향을 알고 싶어요.',
  },
];

export const timeRangeOptions: Array<{ value: TimeRange; label: string }> = [
  { value: 'dawn', label: '새벽' },
  { value: 'morning', label: '오전' },
  { value: 'afternoon', label: '오후' },
  { value: 'evening', label: '저녁' },
  { value: 'night', label: '밤' },
];

export const onboardingPreviewCards = [
  { label: '나의 핵심 요약', summary: '나를 설명하는 한 문장을 먼저 확인해요.' },
  { label: '강점이 살아나는 순간', summary: '어떤 환경에서 강점이 잘 드러나는지 읽어요.' },
  { label: '관계에서 기억할 점', summary: '관계의 리듬과 마찰 포인트를 정리해요.' },
  { label: '성장 체크포인트', summary: '흔들릴 때 다시 기준을 세우는 힌트를 얻어요.' },
];
