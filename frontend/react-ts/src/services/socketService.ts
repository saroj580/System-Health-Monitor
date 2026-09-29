// services/socketService.ts
// Manages the WebSocket connection to /ws/stats.

import type { SystemStats } from '../models/systemStats';

const WS_URL = 'ws://127.0.0.1:8000/ws/stats';
const MAX_BACKOFF_MS = 30_000;

type StatsCallback = (stats: SystemStats) => void;
type StatusCallback = (status: SocketStatus) => void;

export type SocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

class StatsSocketService {
  private socket: WebSocket | null = null;
  private statsListeners = new Set<StatsCallback>();
  private statusListeners = new Set<StatusCallback>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attemptCount = 0;
  private shouldReconnect = false;

  /** Start the connection and begin auto-reconnect loop. */
  connect(): void {
    this.shouldReconnect = true;
    this._open();
  }

  /** Permanently close the socket (called on component unmount / app quit). */
  disconnect(): void {
    this.shouldReconnect = false;
    this._clearTimer();
    this.socket?.close();
    this.socket = null;
    this._emitStatus('disconnected');
  }

  onStats(cb: StatsCallback): () => void {
    this.statsListeners.add(cb);
    return () => this.statsListeners.delete(cb);
  }

  onStatus(cb: StatusCallback): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  private _open(): void {
    if (this.socket?.readyState === WebSocket.OPEN) return;

    this._emitStatus('connecting');
    const ws = new WebSocket(WS_URL);
    this.socket = ws;

    ws.onopen = () => {
      this.attemptCount = 0;
      this._emitStatus('connected');
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const stats = JSON.parse(event.data) as SystemStats;
        this.statsListeners.forEach((cb) => cb(stats));
      } catch {
        // Malformed frame — ignore
      }
    };

    ws.onerror = () => {
      this._emitStatus('error');
    };

    ws.onclose = () => {
      this._emitStatus('disconnected');
      if (this.shouldReconnect) this._scheduleReconnect();
    };
  }

  private _scheduleReconnect(): void {
    // Exponential backoff: 1s, 2s, 4s, 8s … capped at MAX_BACKOFF_MS
    const delay = Math.min(1000 * 2 ** this.attemptCount, MAX_BACKOFF_MS);
    this.attemptCount += 1;
    this.reconnectTimer = setTimeout(() => this._open(), delay);
  }

  private _clearTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private _emitStatus(status: SocketStatus): void {
    this.statusListeners.forEach((cb) => cb(status));
  }
}

// Singleton instance shared across the whole app
export const statsSocket = new StatsSocketService();
