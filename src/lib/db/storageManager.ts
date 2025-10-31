type ChunkMap = Map<number, ArrayBuffer>;

class InMemoryStorageManager {
  private store: Map<string, ChunkMap> = new Map();

  async set(transferId: string, chunkIndex: number, data: ArrayBuffer): Promise<void> {
    let cmap = this.store.get(transferId);
    if (!cmap) {
      cmap = new Map();
      this.store.set(transferId, cmap);
    }
    cmap.set(chunkIndex, data);
  }

  async getAll(transferId: string): Promise<ChunkMap> {
    const cmap = this.store.get(transferId);
    if (!cmap) return new Map();
    return new Map(cmap);
  }

  async deleteAll(transferId: string): Promise<void> {
    this.store.delete(transferId);
  }
}

export const storageManager = new InMemoryStorageManager();
