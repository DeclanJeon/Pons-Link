import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomContextRail } from '@/components/room/RoomContextRail';

let activePanelState: 'none' | 'chat' | 'whiteboard' | 'settings' | 'fileStreaming' | 'relay' | 'cowatch' = 'chat';
let viewModeState: 'grid' | 'speaker' | 'viewer' = 'speaker';
let unreadCountState = 0;
let fileTransferCountState = 0;

vi.mock('@/stores/useChatStore', () => ({
  useChatStore: (selector: (state: { unreadCount: number; fileTransfers: Map<string, unknown> }) => unknown) =>
    selector({
      unreadCount: unreadCountState,
      fileTransfers: new Map(Array.from({ length: fileTransferCountState }, (_, index) => [`transfer-${index}`, {}])),
    }),
}));

describe('Room context rail redesign slice 4', () => {
  beforeEach(() => {
    activePanelState = 'chat';
    viewModeState = 'speaker';
    unreadCountState = 0;
    fileTransferCountState = 0;
  });

  it('renders the chat, people, shared, and collaborate rail tabs', () => {
    render(<RoomContextRail activePanel={activePanelState} viewMode={viewModeState} />);

    expect(screen.getByRole('tab', { name: 'Chat' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'People' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Shared' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Collaborate' })).toBeInTheDocument();
  });

  it('surfaces unread chat count when chat has pending unread messages', () => {
    unreadCountState = 3;

    render(<RoomContextRail activePanel={activePanelState} viewMode={viewModeState} />);

    expect(screen.getByRole('tab', { name: /Chat/ })).toHaveTextContent('3 unread');
  });

  it('maps active panel state into the shared and collaborate summaries', () => {
    activePanelState = 'fileStreaming';
    viewModeState = 'viewer';
    fileTransferCountState = 2;

    render(<RoomContextRail activePanel={activePanelState} viewMode={viewModeState} />);

    expect(screen.getByText('Content view')).toBeInTheDocument();
    expect(screen.getByTestId('active-surface-label')).toHaveTextContent('PonsCast');
    expect(screen.getByText('2 active transfers')).toBeInTheDocument();
  });
});
