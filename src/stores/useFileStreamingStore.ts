import { create } from 'zustand';
import { produce } from 'immer';

type FileType = 'video' | 'pdf' | 'image' | 'other';
type StreamQuality = 'low' | 'medium' | 'high';
type PlaylistItem = { 
  id: string; 
  file: File; 
  type: FileType; 
  name: string; 
  duration?: number;
  path?: string; // 폴더 업로드 시 경로 표시용
};
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
  presentationVideoEl: HTMLVideoElement | null;
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
  addFolderToPlaylist: (files: File[], folderPath: string) => void;
  setPresentationVideoEl: (el: HTMLVideoElement | null) => void;
}

const getFileType = (file: File): FileType => {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.startsWith('image/')) return 'image';
  return 'other';
};

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

  nextItem: () => set(produce(state => {
    if (state.playlist.length === 0) return;
    const next = state.currentIndex + 1;
    if (next < state.playlist.length) {
      state.currentIndex = next;
      state.selectedFile = state.playlist[next].file;
      state.fileType = state.playlist[next].type;
    }
  })),

  prevItem: () => set(produce(state => {
    if (state.playlist.length === 0) return;
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
