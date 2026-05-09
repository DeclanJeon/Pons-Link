import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Marketing from './Marketing';

describe('Marketing comic storytelling page', () => {
  it('renders the comic storytelling IA from hero through bottom trust row', () => {
    render(
      <MemoryRouter>
        <Marketing />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /외국 고객과의 미팅/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /해외 미팅은 시작하기 전부터 복잡합니다/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /해외 미팅 데스크입니다/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /상황별 해결책/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /이런 분들께 PonsLink가 필요합니다/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /기존 방식과 PonsLink의 차이/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /안심하고 사용할 수 있는 설계/i })).toBeInTheDocument();
    expect(screen.getByText(/Trusted by global professionals/i)).toBeInTheDocument();
  });

  it('routes the main and demo CTAs to the intended flows', () => {
    render(
      <MemoryRouter>
        <Marketing />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('link', { name: /내 PonsLink 열기/i })[0]).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /데모로 보기/i })).toHaveAttribute('href', '/lobby/ponslink-demo?type=video-group');
    expect(screen.getByRole('link', { name: /데모로 체험하기/i })).toHaveAttribute('href', '/lobby/ponslink-demo?type=video-group');
  });

  it('uses the generated comic use-case image asset with accessible descriptions', () => {
    render(
      <MemoryRouter>
        <Marketing />
      </MemoryRouter>,
    );

    expect(screen.getByAltText(/PonsLink 코믹 히어로/i)).toHaveAttribute('src', '/img/marketing/comic-hero-story.png');
    expect(screen.getByAltText(/맥락 부족 문제/i)).toHaveAttribute('src', '/img/marketing/comic-problem-context.png');
    expect(screen.getByAltText(/회의 전 준비 .* 단계를 보여주는/i)).toHaveAttribute('src', '/img/marketing/comic-workflow-before.png');
    expect(screen.getByAltText(/Live Caption & Translation 기능/i)).toHaveAttribute('src', '/img/marketing/comic-feature-caption.png');
    expect(screen.getByAltText(/글로벌 세일즈/i)).toHaveAttribute('src', '/img/marketing/comic-use-cases-collage.png');
    expect(screen.getByAltText(/컨설턴트/i)).toHaveAttribute('src', '/img/marketing/comic-use-cases-collage.png');
    expect(screen.getByAltText(/외국인 파트너/i)).toHaveAttribute('src', '/img/marketing/comic-use-cases-collage.png');
    expect(screen.getByAltText(/원격 제품팀/i)).toHaveAttribute('src', '/img/marketing/comic-use-cases-collage.png');
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
