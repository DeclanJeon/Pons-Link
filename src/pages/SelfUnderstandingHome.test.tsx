import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import SelfUnderstandingHome from './SelfUnderstandingHome';

const coreInput = {
  birthDate: '1995-08-17',
  birthTimeMode: 'unknown' as const,
  timezoneOrBirthplace: 'Asia/Seoul',
  currentFocus: 'traits' as const,
};

const result = {
  generatedAt: '2026-04-20T12:00:00.000Z',
  overview: {
    id: 'overview',
    label: '나의 핵심 요약',
    summary: '혼자 정리한 뒤, 관계 속에서 힘을 발휘하는 편이에요.',
    interpretation: '충분히 이해된 연결에서 더 편안함을 느낄 수 있어요.',
    tags: ['깊이형', '신중한 연결', '기준 중심'],
  },
  strengths: [{ id: 's1', label: '강점이 살아나는 순간', summary: '의미가 분명할수록 집중력과 설득력이 살아날 수 있어요.' }],
  traits: [{ id: 't1', label: '핵심 기질', summary: '혼자 정리한 뒤, 관계 속에서 힘을 발휘하는 편이에요.' }],
  relationships: [{ id: 'r1', label: '관계 리듬', summary: '관계에서는 빠른 친밀감보다 천천히 쌓이는 신뢰가 더 중요할 수 있어요.' }],
  growth: [{ id: 'g1', label: '오늘의 선택 기준', summary: '지금의 선택은 남의 속도보다 내 납득을 기준으로 두는 편이 맞아요.' }],
};

describe('SelfUnderstandingHome', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('pons.self-understanding.core-input', JSON.stringify(coreInput));
    window.localStorage.setItem('pons.self-understanding.result', JSON.stringify(result));
    window.localStorage.setItem('pons.self-understanding.saved-insights', JSON.stringify([]));
  });

  it('renders the self-understanding summary instead of a fortune-style landing', async () => {
    render(
      <MemoryRouter>
        <SelfUnderstandingHome />
      </MemoryRouter>,
    );

    expect(await screen.findByText('지금의 나를 읽는 요약')).toBeInTheDocument();
    expect(screen.getByText('혼자 정리한 뒤, 관계 속에서 힘을 발휘하는 편이에요.')).toBeInTheDocument();
    expect(screen.getByText('관계')).toBeInTheDocument();
  });
});
