import { create } from 'zustand';
import { produce } from 'immer';

type FileType = 'video' | 'pdf' | 'image' | 'other';
type StreamQuality = 'low' | 'medium' | 'high';
type PlaylistItem = { id: string; file: File; type: FileType; name: string; duration?: number };
type Chapter = { label: string; time: number };

interface FileStreamingState {
  selectedFile: File | null;
  fileType: FileType;
  isStreaming: boolean;
  streamQuality: StreamQuality;
  pdfDoc: any | null;
  currentPage: number;
  totalPages: number;
  streamStartTime: number | null;
  bytesStreamed: number;
  fps: number;
  originalStreamSnapshot: any | null;
  isMinimized: boolean;
  lastPosition: { x: number; y: number } | null;
  playlist: PlaylistItem[];
  currentIndex: number;
  chapters: Chapter[];
}

interface FileStreamingActions {
  setSelectedFile: (file: File | null) => void;
  setFileType: (type: FileType) => void;
  setIsStreaming: (streaming: boolean) => void;
  setStreamQuality: (quality: StreamQuality) => void;
  setPdfDoc: (doc: any) => void;
  setCurrentPage: (page: number) => void;
  setTotalPages: (pages: number) => void;
  updateStreamMetrics: (bytes: number, fps: number) => void;
  setOriginalStreamSnapshot: (snapshot: any) => void;
  setMinimized: (minimized: boolean) => void;
  setLastPosition: (position: { x: number; y: number }) => void;
  toggleMinimized: () => void;
  reset: () => void;
  setPlaylist: (files: File[]) => void;
  addToPlaylist: (files: File[]) => void;
  removeFromPlaylist: (index: number) => void;
  nextItem: () => void;
  prevItem: () => void;
  setCurrentIndex: (index: number) => void;
  setChapters: (chapters: Chapter[]) => void;
}

export const useFileStreamingStore = create<FileStreamingState & FileStreamingActions>((set) => ({
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
  chapters: [],
  setSelectedFile: (file) => set({ selectedFile: file }),
  setFileType: (type) => set({ fileType: type }),
  setIsStreaming: (streaming) => set(produce(state => { state.isStreaming = streaming; state.streamStartTime = streaming ? Date.now() : null; if (!streaming) state.isMinimized = false })),
  setStreamQuality: (quality) => set({ streamQuality: quality }),
  setPdfDoc: (doc) => set({ pdfDoc: doc }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setTotalPages: (pages) => set({ totalPages: pages }),
  updateStreamMetrics: (bytes, fps) => set(produce(state => { state.bytesStreamed += bytes; state.fps = fps })),
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
    chapters: []
  }),
  setPlaylist: (files) => set(produce(state => {
    state.playlist = files.map((f, i) => ({ id: `${f.name}-${f.size}-${i}-${Date.now()}`, file: f, type: f.type.startsWith('video/') ? 'video' : f.type === 'application/pdf' ? 'pdf' : f.type.startsWith('image/') ? 'image' : 'other', name: f.name }));
    state.currentIndex = state.playlist.length ? 0 : -1;
    state.selectedFile = state.currentIndex >= 0 ? state.playlist[state.currentIndex].file : null;
    state.fileType = state.currentIndex >= 0 ? state.playlist[state.currentIndex].type : 'other';
  })),
  addToPlaylist: (files) => set(produce(state => {
    const items = files.map((f) => ({ id: `${f.name}-${f.size}-${Date.now()}`, file: f, type: f.type.startsWith('video/') ? 'video' : f.type === 'application/pdf' ? 'pdf' : f.type.startsWith('image/') ? 'image' : 'other', name: f.name }));
    state.playlist.push(...items);
    if (state.currentIndex < 0 && state.playlist.length) {
      state.currentIndex = 0;
      state.selectedFile = state.playlist[0].file;
      state.fileType = state.playlist[0].type;
    }
  })),
  removeFromPlaylist: (index) => set(produce(state => {
    if (index < 0 || index >= state.playlist.length) return;
    state.playlist.splice(index, 1);
    if (state.currentIndex >= state.playlist.length) state.currentIndex = state.playlist.length - 1;
    if (state.currentIndex >= 0) {
      state.selectedFile = state.playlist[state.currentIndex].file;
      state.fileType = state.playlist[state.currentIndex].type;
    } else {
      state.selectedFile = null;
      state.fileType = 'other';
    }
  })),
  nextItem: () => set(produce(state => {
    if (!state.playlist.length) return;
    const next = state.currentIndex + 1;
    if (next < state.playlist.length) {
      state.currentIndex = next;
      state.selectedFile = state.playlist[next].file;
      state.fileType = state.playlist[next].type;
    }
  })),
  prevItem: () => set(produce(state => {
    if (!state.playlist.length) return;
    const prev = state.currentIndex - 1;
    if (prev >= 0) {
      state.currentIndex = prev;
      state.selectedFile = state.playlist[prev].file;
      state.fileType = state.playlist[prev].type;
    }
  })),
  setCurrentIndex: (index) => set(produce(state => {
    if (index < 0 || index >= state.playlist.length) return;
    state.currentIndex = index;
    state.selectedFile = state.playlist[index].file;
    state.fileType = state.playlist[index].type;
  })),
  setChapters: (chapters) => set({ chapters })
}));
