import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { beforeEach, describe, expect, it } from 'vitest';
import Marketing from './Marketing';

describe('Marketing room capabilities section', () => {
  beforeEach(() => {
    void i18n.changeLanguage('en');
    window.localStorage.clear();
  });

  it('shows the live room capability gallery with all promoted features', () => {
    render(
      <MemoryRouter>
        <Marketing />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /inside every session/i })).toBeInTheDocument();
    expect(screen.getByText(/voice mode/i)).toBeInTheDocument();
    expect(screen.getByText(/video rooms/i)).toBeInTheDocument();
    expect(screen.getByText(/collaborative whiteboard/i)).toBeInTheDocument();
    expect(screen.getByText(/live chat/i)).toBeInTheDocument();
    expect(screen.getByText(/ponscast/i)).toBeInTheDocument();
    expect(screen.getByText(/youtube cowatch/i)).toBeInTheDocument();
    expect(screen.getByText(/file transfer/i)).toBeInTheDocument();
  });

  it('links the free room CTA to the open room flow', () => {
    render(
      <MemoryRouter>
        <Marketing />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /open a free room/i })).toHaveAttribute('href', '/legacy-home');
  });

  it('switches the main page between Korean, English, and Japanese', async () => {
    render(
      <MemoryRouter>
        <Marketing />
      </MemoryRouter>,
    );

    const languageSelect = screen.getByRole('combobox', { name: /language/i });
    expect(languageSelect).toHaveValue('en');

    fireEvent.change(languageSelect, { target: { value: 'ko' } });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /요청, 일정 조율, 라이브 미팅을 하나의 링크로/i })).toBeInTheDocument();
    });
    expect(languageSelect).toHaveValue('ko');

    fireEvent.change(languageSelect, { target: { value: 'ja' } });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /リクエスト、日程調整、ライブミーティングをひとつのリンクで/i })).toBeInTheDocument();
    });
    expect(languageSelect).toHaveValue('ja');

    fireEvent.change(languageSelect, { target: { value: 'en' } });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /one link for requests/i })).toBeInTheDocument();
    });
    expect(languageSelect).toHaveValue('en');
  });
});
