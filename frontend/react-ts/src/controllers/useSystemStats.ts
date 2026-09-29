// controllers/useSystemStats.ts
// Custom hook that connects to the WebSocket stream and exposes live SystemStats.
// Also seeds the initial snapshot via REST so the UI isn't blank on first render.

import { useState, useEffect, useRef } from 'react';
import type { SystemStats } from '../models/systemStats';
import type { SocketStatus } from '../services/socketService';
import { statsSocket } from '../services/socketService';
import { fetchStats } from '../services/apiService';

// Number of historical data points kept in memory for sparkline charts
const HISTORY_SIZE = 60;

export interface UseSystemStatsResult {
  stats: SystemStats | null;
  /** Rolling 60-point history arrays for trend charts */
  history: {
    cpu: number[];
    ram: number[];
  };
  status: SocketStatus;
  isConnected: boolean;
}

export function useSystemStats(): UseSystemStatsResult {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const [history, setHistory] = useState<{ cpu: number[]; ram: number[] }>({
    cpu: [],
    ram: [],
  });

  // Stable ref so the callback closure never goes stale
  const historyRef = useRef(history);
  historyRef.current = history;

  useEffect(() => {
    // Seed initial data immediately via REST (before first WS frame arrives)
    fetchStats()
      .then(setStats)
      .catch(() => {/* backend not ready yet — WS will fill in shortly */});

    // Subscribe to live stream
    const unsubStats = statsSocket.onStats((incoming) => {
      setStats(incoming);

      // Append to rolling history
      setHistory((prev) => {
        const cpu = [...prev.cpu, incoming.cpu_percent].slice(-HISTORY_SIZE);
        const ram = [...prev.ram, incoming.ram_percent].slice(-HISTORY_SIZE);
        return { cpu, ram };
      });
    });

    const unsubStatus = statsSocket.onStatus(setStatus);

    // Open (or reuse) the socket connection
    statsSocket.connect();

    return () => {
      unsubStats();
      unsubStatus();
      statsSocket.disconnect();
    };
  }, []);

  return {
    stats,
    history,
    status,
    isConnected: status === 'connected',
  };
}
