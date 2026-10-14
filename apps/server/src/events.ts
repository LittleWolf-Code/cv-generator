// In-process bus between the data watcher and the SSE clients (§8.4).
import type { DataChange } from '@cv/store';

export class DataEvents {
  private readonly listeners = new Set<(change: DataChange) => void>();

  publish(change: DataChange): void {
    for (const listener of this.listeners) listener(change);
  }

  subscribe(listener: (change: DataChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
