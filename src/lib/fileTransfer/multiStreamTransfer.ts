// src/lib/multiStreamTransfer.ts

export class MultiStreamTransfer {
  private streams: Map<number, ReadableStream> = new Map();
  private readonly MAX_STREAMS = 4; // CPU 코어 수 기반

  async splitFileIntoStreams(file: File): Promise<ReadableStream[]> {
    const streamSize = Math.ceil(file.size / this.MAX_STREAMS);
    const streams: ReadableStream[] = [];

    for (let i = 0; i < this.MAX_STREAMS; i++) {
      const start = i * streamSize;
      const end = Math.min(start + streamSize, file.size);
      const slice = file.slice(start, end);

      const stream = slice.stream();
      streams.push(stream);
    }

    return streams;
  }

  async transferInParallel(
    streams: ReadableStream[],
    onChunk: (streamId: number, chunk: Uint8Array) => void
  ): Promise<void> {
    const promises = streams.map(async (stream, streamId) => {
      const reader = stream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          onChunk(streamId, value);
        }
      } finally {
        reader.releaseLock();
      }
    });

    await Promise.all(promises);
  }
}