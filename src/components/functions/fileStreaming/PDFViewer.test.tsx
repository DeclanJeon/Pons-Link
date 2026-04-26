import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFViewer } from './PDFViewer';
import { useFileStreamingStore } from '@/stores/useFileStreamingStore';

const getDocumentMock = vi.hoisted(() => vi.fn());

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  version: '3.11.174',
  getDocument: getDocumentMock,
}));

vi.mock('@/stores/usePeerConnectionStore', () => ({
  usePeerConnectionStore: {
    getState: () => ({ sendToAllPeers: vi.fn(), peers: new Map() }),
  },
}));

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
};

const createDeferred = (): Deferred => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('PDFViewer PonsCast rendering', () => {
  let renderDeferred: Deferred;
  let renderMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    useFileStreamingStore.setState(useFileStreamingStore.getInitialState());
    renderDeferred = createDeferred();
    renderMock = vi.fn(() => ({
      promise: renderDeferred.promise,
      cancel: vi.fn(),
    }));

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      strokeRect: vi.fn(),
      clearRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    getDocumentMock.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        destroy: vi.fn(),
        getPage: vi.fn(() => Promise.resolve({
          getViewport: vi.fn(() => ({ width: 300, height: 200 })),
          render: renderMock,
        })),
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the currently shared canvas frame intact until the next PDF page render finishes', async () => {
    const sharedCanvas = document.createElement('canvas');
    sharedCanvas.width = 640;
    sharedCanvas.height = 480;
    const canvasRef = { current: sharedCanvas };
    const file = new File(['%PDF-1.4'], 'sample.pdf', { type: 'application/pdf' });
    const onStreamUpdate = vi.fn();

    render(
      <PDFViewer
        canvasRef={canvasRef}
        file={file}
        isStreaming
        onStreamUpdate={onStreamUpdate}
      />,
    );

    await waitFor(() => expect(renderMock).toHaveBeenCalled());

    expect(sharedCanvas.width).toBe(640);
    expect(sharedCanvas.height).toBe(480);
    expect(onStreamUpdate).not.toHaveBeenCalled();

    await act(async () => {
      renderDeferred.resolve();
      await renderDeferred.promise;
    });

    await waitFor(() => expect(onStreamUpdate).toHaveBeenCalledTimes(1));
    expect(sharedCanvas.width).toBe(300);
    expect(sharedCanvas.height).toBe(200);
  });
});
