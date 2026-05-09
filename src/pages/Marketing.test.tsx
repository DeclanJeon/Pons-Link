import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Marketing from './Marketing';

describe('Marketing main page redesign', () => {
  it('renders the global meeting workspace story from hero to final CTA', () => {
    render(
      <MemoryRouter>
        <Marketing />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /외국 고객과의 미팅/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /해외 미팅은 시작하기 전부터 복잡합니다/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /PonsLink는 회의 전후 맥락까지 담는 개인 미팅 데스크입니다/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /상황별 해결책/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /이런 분들께 PonsLink가 필요합니다/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /기존 방식과 PonsLink의 차이/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /첫 해외 미팅 링크를 만들기 전에 필요한 신뢰/i })).toBeInTheDocument();
  });

  it('keeps the primary and demo CTAs routed to the intended flows', () => {
    render(
      <MemoryRouter>
        <Marketing />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('link', { name: /내 PonsLink 만들기/i })[0]).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /데모 룸 보기/i })).toHaveAttribute('href', '/lobby/ponslink-demo?type=video-group');
    expect(screen.getByRole('link', { name: /데모 룸 체험하기/i })).toHaveAttribute('href', '/lobby/ponslink-demo?type=video-group');
  });

  it('uses the generated use-case image asset with accessible descriptions', () => {
    render(
      <MemoryRouter>
        <Marketing />
      </MemoryRouter>,
    );

    expect(screen.getByAltText(/글로벌 프리랜서/i)).toHaveAttribute('src', '/img/marketing/use-cases-collage.png');
    expect(screen.getByAltText(/컨설턴트/i)).toHaveAttribute('src', '/img/marketing/use-cases-collage.png');
    expect(screen.getByAltText(/한국과 일본 협업자/i)).toHaveAttribute('src', '/img/marketing/use-cases-collage.png');
    expect(screen.getByAltText(/원격 제품팀/i)).toHaveAttribute('src', '/img/marketing/use-cases-collage.png');
  });

  it('keeps the language selector available in the sticky header', () => {
    render(
      <MemoryRouter>
        <Marketing />
      </MemoryRouter>,
    );

    expect(screen.getByRole('combobox', { name: /language/i })).toBeInTheDocument();
  });
});
