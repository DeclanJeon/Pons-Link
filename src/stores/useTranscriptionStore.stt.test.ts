import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTranscriptionStore } from './useTranscriptionStore';

const sendToAllPeersMock = vi.fn();
const setPeerConnectionStateMock = vi.fn();

vi.mock('./usePeerConnectionStore', () => ({
  usePeerConnectionStore: {
    getState: () => ({ sendToAllPeers: sendToAllPeersMock }),
    setState: (...args: unknown[]) => setPeerConnectionStateMock(...args),
  },
}));

describe('useTranscriptionStore STT integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTranscriptionStore.setState({
      isTranscriptionEnabled: false,
      transcriptionProvider: 'azure',
      transcriptionLanguage: 'ko-KR',
      translationTargetLanguage: 'none',
      localTranscript: { text: '', isFinal: false },
      detectedLanguage: null,
    });
  });

  it('sends transcription data with the selected provider and language', () => {
    useTranscriptionStore.getState().setTranscriptionProvider('azure');
    useTranscriptionStore.getState().setTranscriptionLanguage('ko-KR');

    useTranscriptionStore.getState().sendTranscription('안녕하세요', true);

    expect(sendToAllPeersMock).toHaveBeenCalledWith(JSON.stringify({
      type: 'transcription',
      payload: {
        text: '안녕하세요',
        isFinal: true,
        lang: 'ko-KR',
        provider: 'azure',
      },
    }));
  });

  it('routes incoming transcription through the peer transcript state path', () => {
    useTranscriptionStore.getState().handleIncomingTranscription('peer-1', {
      text: 'remote hello',
      isFinal: false,
      lang: 'en-US',
    });

    expect(setPeerConnectionStateMock).toHaveBeenCalledTimes(1);
    const updater = setPeerConnectionStateMock.mock.calls[0][0] as (state: { peers: Map<string, { transcript?: unknown }> }) => { peers: Map<string, { transcript?: unknown }> };
    const state = { peers: new Map([['peer-1', { transcript: undefined }]]) };

    const nextState = updater(state);

    expect(nextState.peers.get('peer-1')?.transcript).toEqual({ text: 'remote hello', isFinal: false, lang: 'en-US' });
  });
});
