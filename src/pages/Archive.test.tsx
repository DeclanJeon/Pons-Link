import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import Archive from './Archive';

const seedArchiveState = () => {
  const now = '2026-04-20T12:00:00.000Z';

  window.localStorage.clear();
  window.localStorage.setItem(
    'pons.self-understanding.core-input',
    JSON.stringify({
      birthDate: '1995-08-17',
      birthTimeMode: 'unknown',
      timezoneOrBirthplace: 'Asia/Seoul',
      currentFocus: 'traits',
    }),
  );
  window.localStorage.setItem(
    'pons.self-understanding.result',
    JSON.stringify({
      generatedAt: now,
      overview: { id: 'ov', label: '나의 핵심 요약', summary: '혼자 정리한 뒤, 관계 속에서 힘을 발휘하는 편이에요.' },
      strengths: [],
      traits: [],
      relationships: [],
      growth: [],
    }),
  );
  window.localStorage.setItem(
    'pons.self-understanding.saved-insights',
    JSON.stringify([
      { id: 'g1', category: 'growth', summary: '충분히 이해된 선택에서 더 오래 힘을 낼 수 있는 편이에요.', savedAt: now },
      { id: 'r1', category: 'relationships', summary: '관계에서는 빠른 친밀감보다 천천히 쌓이는 신뢰가 더 중요할 수 있어요.', savedAt: now },
    ]),
  );
};

describe('Archive', () => {
  beforeEach(() => {
    seedArchiveState();
  });

  it('renders saved insights with category labels and return links', async () => {
    render(
      <MemoryRouter>
        <Archive />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: '보관함' })).toBeInTheDocument();
    expect(screen.getByText('성장에서 저장함')).toBeInTheDocument();
    expect(screen.getByText('관계에서 저장함')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '성장 화면으로 이동' })).toHaveAttribute('href', '/me/growth');
    expect(screen.getByRole('link', { name: '관계 화면으로 이동' })).toHaveAttribute('href', '/me/relationships');
  });
});
