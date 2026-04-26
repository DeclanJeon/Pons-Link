import { beforeEach, describe, expect, it } from 'vitest';
import { useFileStreamingStore } from './useFileStreamingStore';

const makeFile = (name: string, type = 'video/mp4') =>
  new File(['content'], name, { type });

const resetStore = () => {
  useFileStreamingStore.setState(useFileStreamingStore.getInitialState());
};

describe('useFileStreamingStore playlist behavior', () => {
  beforeEach(() => {
    resetStore();
  });

  it('adds a single chosen file to the playlist and selects it like a media player queue', () => {
    const file = makeFile('intro.mp4');

    useFileStreamingStore.getState().addAndSelectFile(file);

    const state = useFileStreamingStore.getState();
    expect(state.playlist).toHaveLength(1);
    expect(state.playlist[0].file).toBe(file);
    expect(state.selectedFile).toBe(file);
    expect(state.currentIndex).toBe(0);
  });

  it('supports repeat-all next navigation and repeat-one staying on the same item', () => {
    useFileStreamingStore.getState().setPlaylist([
      makeFile('a.mp4'),
      makeFile('b.mp4'),
    ]);
    useFileStreamingStore.getState().setCurrentIndex(1);

    expect(useFileStreamingStore.getState().getNextIndex()).toBe(-1);

    useFileStreamingStore.getState().setRepeatMode('all');
    expect(useFileStreamingStore.getState().getNextIndex()).toBe(0);

    useFileStreamingStore.getState().setRepeatMode('one');
    expect(useFileStreamingStore.getState().getNextIndex()).toBe(1);
  });

  it('keeps the selected item stable when playlist items are reordered or removed', () => {
    const first = makeFile('first.mp4');
    const second = makeFile('second.mp4');
    const third = makeFile('third.mp4');
    useFileStreamingStore.getState().setPlaylist([first, second, third]);
    useFileStreamingStore.getState().setCurrentIndex(1);

    useFileStreamingStore.getState().movePlaylistItem(1, 0);
    let state = useFileStreamingStore.getState();
    expect(state.playlist.map(item => item.name)).toEqual(['second.mp4', 'first.mp4', 'third.mp4']);
    expect(state.selectedFile).toBe(second);
    expect(state.currentIndex).toBe(0);

    useFileStreamingStore.getState().removeFromPlaylist(1);
    state = useFileStreamingStore.getState();
    expect(state.selectedFile).toBe(second);
    expect(state.currentIndex).toBe(0);

    useFileStreamingStore.getState().clearPlaylist();
    state = useFileStreamingStore.getState();
    expect(state.playlist).toEqual([]);
    expect(state.selectedFile).toBeNull();
    expect(state.currentIndex).toBe(-1);
  });

  it('stores per-item duration and exports a metadata snapshot for saving the list outside playback', () => {
    const first = makeFile('first.mp4');
    const image = makeFile('slide.png', 'image/png');
    useFileStreamingStore.getState().setPlaylist([first, image]);
    const firstId = useFileStreamingStore.getState().playlist[0].id;

    useFileStreamingStore.getState().setPlaylistItemDuration(firstId, 125.4);
    useFileStreamingStore.getState().setImageAdvanceSeconds(8);

    const state = useFileStreamingStore.getState();
    expect(state.playlist[0].duration).toBe(125.4);
    expect(state.imageAdvanceSeconds).toBe(8);
    expect(state.exportPlaylistSnapshot()).toMatchObject({
      version: 1,
      imageAdvanceSeconds: 8,
      items: [
        { name: 'first.mp4', type: 'video', duration: 125.4 },
        { name: 'slide.png', type: 'image' },
      ],
    });
  });

  it('imports exported metadata by matching user-selected files by name and size', () => {
    const original = makeFile('lesson.mp4');
    const missing = makeFile('missing.mp4');
    useFileStreamingStore.getState().setPlaylist([original, missing]);
    const snapshot = useFileStreamingStore.getState().exportPlaylistSnapshot();
    resetStore();

    const rematched = makeFile('lesson.mp4');
    const result = useFileStreamingStore.getState().importPlaylistSnapshot(snapshot, [rematched]);

    expect(result.matched).toBe(1);
    expect(result.unmatched.map(item => item.name)).toEqual(['missing.mp4']);
    expect(useFileStreamingStore.getState().playlist).toHaveLength(1);
    expect(useFileStreamingStore.getState().selectedFile).toBe(rematched);
  });
});
