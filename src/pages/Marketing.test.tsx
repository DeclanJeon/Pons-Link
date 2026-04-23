import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Marketing from './Marketing';

describe('Marketing room capabilities section', () => {
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
});
