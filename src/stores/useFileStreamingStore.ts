import { create } from 'zustand';
import { produce } from 'immer';
import { detectPonsCastFileType } from '@/lib/fileStreaming/fileType';

type FileType = 'video' | 'pdf' | 'image' | 'other';
type StreamQuality = 'low' | 'medium' | 'high';
type RepeatMode = 'none' | 'one' | 'all';
export type { RepeatMode };
type PlaylistItem = { 
  id: string; 
  file: File; 
  type: FileType; 
  name: string; 
  duration?: number;
  path?: string; // 폴더 업로드 시 경로 표시용
};
export type PlaylistSnapshot = {
  version: 1;
  exportedAt: string;
  repeatMode: RepeatMode;
  shuffleEnabled: boolean;
  imageAdvanceSeconds: number;
  items: Array<{
    name: string;
    type: FileType;
    size: number;
    mimeType: string;
    duration?: number;
    path?: string;
  }>;
};
type Chapter = { label: string; time: number };

interface FileStreamingState {
  selectedFile: File | null;
  fileType: FileType;
  isStreaming: boolean;
  streamQuality: StreamQuality;
  pdfDoc: unknown | null;
  currentPage: number;
  totalPages: number;
  streamStartTime: number | null;
  bytesStreamed: number;
  fps: number;
  originalStreamSnapshot: unknown | null;
  isMinimized: boolean;
  lastPosition: { x: number; y: number } | null;
  playlist: PlaylistItem[];
  currentIndex: number;
  repeatMode: RepeatMode;
  shuffleEnabled: boolean;
  imageAdvanceSeconds: number;
  pdfSlideshowSeconds: number;
  chapters: Chapter[];
  presentationVideoEl: HTMLVideoElement | null;
}

interface FileStreamingActions {
  setSelectedFile: (file: File | null) => void;
  setFileType: (type: FileType) => void;
  setIsStreaming: (streaming: boolean) => void;
  setStreamQuality: (quality: StreamQuality) => void;
  setPdfDoc: (doc: unknown) => void;
  setCurrentPage: (page: number) => void;
  setTotalPages: (pages: number) => void;
  updateStreamMetrics: (bytes: number, fps: number) => void;
  setOriginalStreamSnapshot: (snapshot: unknown) => void;
  setMinimized: (minimized: boolean) => void;
  setLastPosition: (position: { x: number; y: number }) => void;
  toggleMinimized: () => void;
  reset: () => void;
  setPlaylist: (files: File[]) => void;
  addToPlaylist: (files: File[]) => void;
  addAndSelectFile: (file: File) => void;
  removeFromPlaylist: (index: number) => void;
  clearPlaylist: () => void;
  movePlaylistItem: (fromIndex: number, toIndex: number) => void;
  nextItem: () => void;
  prevItem: () => void;
  setCurrentIndex: (index: number) => void;
  getNextIndex: () => number;
  getPreviousIndex: () => number;
  setRepeatMode: (mode: RepeatMode) => void;
  toggleShuffle: () => void;
  setImageAdvanceSeconds: (seconds: number) => void;
  setPdfSlideshowSeconds: (seconds: number) => void;
  setPlaylistItemDuration: (id: string, duration: number) => void;
  exportPlaylistSnapshot: () => PlaylistSnapshot;
  importPlaylistSnapshot: (snapshot: PlaylistSnapshot, files: File[]) => { matched: number; unmatched: PlaylistSnapshot['items'] };
  setChapters: (chapters: Chapter[]) => void;
  addFolderToPlaylist: (files: File[], folderPath: string) => void;
  setPresentationVideoEl: (el: HTMLVideoElement | null) => void;
}

const getFileType = (file: File): FileType => detectPonsCastFileType(file).kind;

const createPlaylistItem = (file: File, path?: string): PlaylistItem => ({
  id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
  file,
  type: getFileType(file),
  name: file.name,
  path
});

export const useFileStreamingStore = create<FileStreamingState & FileStreamingActions>((set, get) => ({
  selectedFile: null,
  fileType: 'other',
  isStreaming: false,
  streamQuality: 'medium',
  pdfDoc: null,
  currentPage: 1,
  totalPages: 0,
  streamStartTime: null,
  bytesStreamed: 0,
  fps: 0,
  originalStreamSnapshot: null,
  isMinimized: false,
  lastPosition: null,
  playlist: [],
  currentIndex: -1,
  repeatMode: 'none',
  shuffleEnabled: false,
  imageAdvanceSeconds: 0,
  pdfSlideshowSeconds: 0,
  chapters: [],
  presentationVideoEl: null,

  setSelectedFile: (file) => set({ selectedFile: file }),
  setFileType: (type) => set({ fileType: type }),
  setIsStreaming: (streaming) => set(produce(state => {
    state.isStreaming = streaming;
    state.streamStartTime = streaming ? Date.now() : null;
    if (!streaming) state.isMinimized = false;
  })),
  setStreamQuality: (quality) => set({ streamQuality: quality }),
  setPdfDoc: (doc) => set({ pdfDoc: doc }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setTotalPages: (pages) => set({ totalPages: pages }),
  updateStreamMetrics: (bytes, fps) => set(produce(state => {
    state.bytesStreamed += bytes;
    state.fps = fps;
  })),
  setOriginalStreamSnapshot: (snapshot) => set({ originalStreamSnapshot: snapshot }),
  setMinimized: (minimized) => set({ isMinimized: minimized }),
  setLastPosition: (position) => set({ lastPosition: position }),
  toggleMinimized: () => set(state => ({ isMinimized: !state.isMinimized })),
  
  reset: () => set({
    selectedFile: null,
    fileType: 'other',
    isStreaming: false,
    streamQuality: 'medium',
    pdfDoc: null,
    currentPage: 1,
    totalPages: 0,
    streamStartTime: null,
    bytesStreamed: 0,
    fps: 0,
    originalStreamSnapshot: null,
    isMinimized: false,
    lastPosition: null,
    playlist: [],
    currentIndex: -1,
    repeatMode: 'none',
    shuffleEnabled: false,
    imageAdvanceSeconds: 0,
    pdfSlideshowSeconds: 0,
    chapters: [],
    presentationVideoEl: null
  }),

  setPresentationVideoEl: (el) => set({ presentationVideoEl: el }),

  setPlaylist: (files) => set(produce(state => {
    state.playlist = files.map(f => createPlaylistItem(f));
    state.currentIndex = state.playlist.length > 0 ? 0 : -1;
    if (state.currentIndex >= 0) {
      state.selectedFile = state.playlist[0].file;
      state.fileType = state.playlist[0].type;
    }
  })),

  addToPlaylist: (files) => set(produce(state => {
    const items = files.map(f => createPlaylistItem(f));
    state.playlist.push(...items);
    if (state.currentIndex < 0 && state.playlist.length > 0) {
      state.currentIndex = 0;
      state.selectedFile = state.playlist[0].file;
      state.fileType = state.playlist[0].type;
    }
  })),

  addAndSelectFile: (file) => set(produce(state => {
    const item = createPlaylistItem(file);
    state.playlist.push(item);
    state.currentIndex = state.playlist.length - 1;
    state.selectedFile = item.file;
    state.fileType = item.type;
  })),

  clearPlaylist: () => set({
    selectedFile: null,
    fileType: 'other',
    playlist: [],
    currentIndex: -1,
  }),

  movePlaylistItem: (fromIndex, toIndex) => set(produce(state => {
    const length = state.playlist.length;
    if (fromIndex < 0 || fromIndex >= length || toIndex < 0 || toIndex >= length || fromIndex === toIndex) return;
    const [item] = state.playlist.splice(fromIndex, 1);
    state.playlist.splice(toIndex, 0, item);

    if (state.currentIndex === fromIndex) {
      state.currentIndex = toIndex;
    } else if (fromIndex < state.currentIndex && toIndex >= state.currentIndex) {
      state.currentIndex--;
    } else if (fromIndex > state.currentIndex && toIndex <= state.currentIndex) {
      state.currentIndex++;
    }

    if (state.currentIndex >= 0) {
      state.selectedFile = state.playlist[state.currentIndex].file;
      state.fileType = state.playlist[state.currentIndex].type;
    }
  })),

  addFolderToPlaylist: (files, folderPath) => set(produce(state => {
    const items = files.map(f => createPlaylistItem(f, folderPath));
    state.playlist.push(...items);
    if (state.currentIndex < 0 && state.playlist.length > 0) {
      state.currentIndex = 0;
      state.selectedFile = state.playlist[0].file;
      state.fileType = state.playlist[0].type;
    }
  })),

  removeFromPlaylist: (index) => set(produce(state => {
    if (index < 0 || index >= state.playlist.length) return;
    
    const wasCurrentItem = index === state.currentIndex;
    state.playlist.splice(index, 1);
    
    if (wasCurrentItem) {
      if (state.currentIndex >= state.playlist.length) {
        state.currentIndex = state.playlist.length - 1;
      }
      
      if (state.currentIndex >= 0) {
        state.selectedFile = state.playlist[state.currentIndex].file;
        state.fileType = state.playlist[state.currentIndex].type;
      } else {
        state.selectedFile = null;
        state.fileType = 'other';
      }
    } else if (index < state.currentIndex) {
      state.currentIndex--;
    }
  })),

  getNextIndex: () => {
    const { playlist, currentIndex, repeatMode, shuffleEnabled } = get();
    if (playlist.length === 0 || currentIndex < 0) return -1;
    if (repeatMode === 'one') return currentIndex;
    if (shuffleEnabled && playlist.length > 1) {
      let next = currentIndex;
      while (next === currentIndex) {
        next = Math.floor(Math.random() * playlist.length);
      }
      return next;
    }
    const next = currentIndex + 1;
    if (next < playlist.length) return next;
    return repeatMode === 'all' ? 0 : -1;
  },

  getPreviousIndex: () => {
    const { playlist, currentIndex, repeatMode, shuffleEnabled } = get();
    if (playlist.length === 0 || currentIndex < 0) return -1;
    if (repeatMode === 'one') return currentIndex;
    if (shuffleEnabled && playlist.length > 1) {
      let previous = currentIndex;
      while (previous === currentIndex) {
        previous = Math.floor(Math.random() * playlist.length);
      }
      return previous;
    }
    const previous = currentIndex - 1;
    if (previous >= 0) return previous;
    return repeatMode === 'all' ? playlist.length - 1 : -1;
  },

  nextItem: () => {
    const next = get().getNextIndex();
    if (next >= 0) get().setCurrentIndex(next);
  },

  prevItem: () => {
    const previous = get().getPreviousIndex();
    if (previous >= 0) get().setCurrentIndex(previous);
  },

  setRepeatMode: (mode) => set({ repeatMode: mode }),
  toggleShuffle: () => set(state => ({ shuffleEnabled: !state.shuffleEnabled })),
  setImageAdvanceSeconds: (seconds) => set({ imageAdvanceSeconds: Math.max(0, Math.floor(seconds)) }),
  setPdfSlideshowSeconds: (seconds) => set({ pdfSlideshowSeconds: Math.max(0, Math.floor(seconds)) }),
  setPlaylistItemDuration: (id, duration) => set(produce(state => {
    const item = state.playlist.find(entry => entry.id === id);
    if (item) item.duration = duration;
  })),
  exportPlaylistSnapshot: () => {
    const { playlist, repeatMode, shuffleEnabled, imageAdvanceSeconds } = get();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      repeatMode,
      shuffleEnabled,
      imageAdvanceSeconds,
      items: playlist.map(item => ({
        name: item.name,
        type: item.type,
        size: item.file.size,
        mimeType: item.file.type,
        duration: item.duration,
        path: item.path,
      })),
    };
  },
  importPlaylistSnapshot: (snapshot, files) => {
    const availableFiles = [...files];
    const unmatched: PlaylistSnapshot['items'] = [];
    const matchedItems: PlaylistItem[] = [];

    snapshot.items.forEach(item => {
      const matchIndex = availableFiles.findIndex(file => file.name === item.name && file.size === item.size);
      if (matchIndex < 0) {
        unmatched.push(item);
        return;
      }
      const [file] = availableFiles.splice(matchIndex, 1);
      matchedItems.push({ ...createPlaylistItem(file, item.path), duration: item.duration });
    });

    set(produce(state => {
      state.playlist = matchedItems;
      state.repeatMode = snapshot.repeatMode;
      state.shuffleEnabled = snapshot.shuffleEnabled;
      state.imageAdvanceSeconds = snapshot.imageAdvanceSeconds;
      state.currentIndex = matchedItems.length > 0 ? 0 : -1;
      state.selectedFile = matchedItems[0]?.file ?? null;
      state.fileType = matchedItems[0]?.type ?? 'other';
    }));

    return { matched: matchedItems.length, unmatched };
  },

  setCurrentIndex: (index) => set(produce(state => {
    if (index < 0 || index >= state.playlist.length) return;
    state.currentIndex = index;
    state.selectedFile = state.playlist[index].file;
    state.fileType = state.playlist[index].type;
  })),

  setChapters: (chapters) => set({ chapters })
}));
