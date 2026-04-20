import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import MySettings from './MySettings';

const seedSettingsState = () => {
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
    JSON.stringify([{ id: 'ov', category: 'home', summary: '혼자 정리한 뒤, 관계 속에서 힘을 발휘하는 편이에요.', savedAt: now }]),
  );
};

describe('MySettings', () => {
  beforeEach(() => {
    seedSettingsState();
  });

  it('shows current input summary and clears local-first data on reset', async () => {
    render(
      <MemoryRouter>
        <MySettings />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: '설정' })).toBeInTheDocument();
    expect(screen.getByText('출생일: 1995-08-17')).toBeInTheDocument();
    expect(screen.getByText('저장한 문장 수: 1개')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '전체 초기화' }));

    expect(window.localStorage.getItem('pons.self-understanding.core-input')).toBeNull();
    expect(window.localStorage.getItem('pons.self-understanding.result')).toBeNull();
    expect(window.localStorage.getItem('pons.self-understanding.saved-insights')).toBeNull();
  });
});
