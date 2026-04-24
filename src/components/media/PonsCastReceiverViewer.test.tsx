import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PONSCAST_BINARY_EVENT,
  PONSCAST_METADATA_EVENT,
  PONSCAST_STREAM_END_EVENT,
} from '@/lib/ponscast/protocol';
import { PonsCastReceiverViewer } from './PonsCastReceiverViewer';

const hookState = {
  handleData: vi.fn(),
  reset: vi.fn(),
  props: [] as Array<{ mimeType?: string }>,
};

vi.mock('@/hooks/usePonsCastReceiver', () => ({
  usePonsCastReceiver: (props: { mimeType?: string }) => {
    hookState.props.push(props);
    return {
      handleData: hookState.handleData,
      reset: hookState.reset,
      isReady: true,
      error: null,
    };
  },
}));

describe('PonsCastReceiverViewer metadata routing', () => {
  beforeEach(() => {
    hookState.handleData.mockClear();
    hookState.reset.mockClear();
    hookState.props = [];
  });

  it('uses matching stream metadata to label the receiver and configure MIME playback', async () => {
    render(<PonsCastReceiverViewer nickname="Nova" userId="remote-a" />);

    act(() => {
      window.dispatchEvent(new CustomEvent(PONSCAST_METADATA_EVENT, {
        detail: {
          senderId: 'other-user',
          streamId: 'stream-ignored',
          mimeType: 'video/webm',
          fileType: 'video',
          fileName: 'ignored.webm',
          startedAt: 1,
        },
      }));
    });

    expect(screen.queryByText(/ignored\.webm/)).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent(PONSCAST_METADATA_EVENT, {
        detail: {
          senderId: 'remote-a',
          streamId: 'stream-1',
          mimeType: 'video/webm;codecs=vp8,opus',
          fileType: 'video',
          fileName: 'deck-demo.webm',
          startedAt: 2,
        },
      }));
    });

    expect(await screen.findByText('deck-demo.webm · Nova (PonsCast)')).toBeInTheDocument();
    await waitFor(() => expect(hookState.props.at(-1)?.mimeType).toBe('video/webm;codecs=vp8,opus'));
  });

  it('routes only matching binary frames and resets on the matching stream end', async () => {
    render(<PonsCastReceiverViewer nickname="Nova" userId="remote-a" />);
    const frame = new Uint8Array([1, 2, 3]).buffer;

    act(() => {
      window.dispatchEvent(new CustomEvent(PONSCAST_BINARY_EVENT, { detail: { senderId: 'other-user', data: frame } }));
    });
    expect(hookState.handleData).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new CustomEvent(PONSCAST_BINARY_EVENT, { detail: { senderId: 'remote-a', data: frame } }));
    });
    expect(hookState.handleData).toHaveBeenCalledWith(frame);

    act(() => {
      window.dispatchEvent(new CustomEvent(PONSCAST_METADATA_EVENT, {
        detail: {
          senderId: 'remote-a',
          streamId: 'stream-1',
          mimeType: 'video/webm',
          fileType: 'video',
          fileName: 'active.webm',
          startedAt: 2,
        },
      }));
    });
    expect(await screen.findByText('active.webm · Nova (PonsCast)')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent(PONSCAST_STREAM_END_EVENT, { detail: { senderId: 'other-user', streamId: 'stream-1' } }));
    });
    expect(hookState.reset).not.toHaveBeenCalled();
    expect(screen.getByText('active.webm · Nova (PonsCast)')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent(PONSCAST_STREAM_END_EVENT, { detail: { senderId: 'remote-a', streamId: 'stream-1' } }));
    });
    expect(hookState.reset).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText('Nova (PonsCast)')).toBeInTheDocument());
  });
});
