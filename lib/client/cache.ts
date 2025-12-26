'use client';

// Simple in-memory cache for client-side data sharing between pages
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  networkId?: string;
}

class ClientCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly DEFAULT_TTL = 2 * 60 * 1000; // 2 minutes - longer TTL for faster navigation

  get<T>(key: string, networkId?: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    // Check if cache is for the same network
    if (networkId && entry.networkId !== networkId) {
      return null;
    }

    // Check if cache is still valid
    const age = Date.now() - entry.timestamp;
    if (age > this.DEFAULT_TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set<T>(key: string, data: T, networkId?: string): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      networkId,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  clearForNetwork(networkId: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.networkId === networkId) {
        this.cache.delete(key);
      }
    }
  }
}

export const clientCache = new ClientCache();

