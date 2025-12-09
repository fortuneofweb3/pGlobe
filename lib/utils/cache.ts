/**
 * Persistent client-side cache for pNode data
 * Features:
 * - LocalStorage persistence with TTL
 * - Passive loading (keep old data until new arrives)
 * - Network-aware caching
 * - Lazy loading support
 */

import { PNode } from '../types/pnode';

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

const CACHE_PREFIX = 'pglobe-';
const NODES_CACHE_KEY = `${CACHE_PREFIX}nodes`;
const STATS_CACHE_KEY = `${CACHE_PREFIX}stats`;
const CACHE_VERSION = 2;

// TTL values
const NODES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes for node discovery
const STATS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes for enriched stats
const STALE_WHILE_REVALIDATE = 60 * 60 * 1000; // Serve stale for 1 hour while fetching

// ============================================================================
// CACHE TYPES
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  network: string;
  version: number;
}

interface NetworkStats {
  totalNodes: number;
  onlineNodes: number;
  avgUptime: number;
  avgCPU: number;
  avgLatency: number;
  totalStorage: number;
  usedStorage: number;
  timestamp: number;
}

// ============================================================================
// CORE CACHE CLASS
// ============================================================================

class PersistentCache {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private isClient: boolean;

  constructor() {
    this.isClient = typeof window !== 'undefined';
    if (this.isClient) {
      this.loadFromStorage();
    }
  }

  /**
   * Load cache from localStorage on init
   */
  private loadFromStorage(): void {
    if (!this.isClient) return;

    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
      for (const key of keys) {
        const value = localStorage.getItem(key);
        if (value) {
          try {
            const entry = JSON.parse(value) as CacheEntry<any>;
            if (entry.version === CACHE_VERSION) {
              this.memoryCache.set(key, entry);
            }
          } catch (e) {
            // Invalid entry, remove it
            localStorage.removeItem(key);
          }
        }
      }
      console.debug(`[Cache] Loaded ${this.memoryCache.size} entries from storage`);
    } catch (e) {
      console.warn('[Cache] Failed to load from storage:', e);
    }
  }

  /**
   * Save entry to both memory and localStorage
   */
  private saveToStorage(key: string, entry: CacheEntry<any>): void {
    this.memoryCache.set(key, entry);
    
    if (!this.isClient) return;

    try {
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (e) {
      // localStorage might be full
      console.warn('[Cache] Failed to save to storage:', e);
      this.pruneOldEntries();
    }
  }

  /**
   * Remove oldest entries when storage is full
   */
  private pruneOldEntries(): void {
    if (!this.isClient) return;

    const entries: Array<{ key: string; timestamp: number }> = [];
    
    for (const [key, entry] of this.memoryCache.entries()) {
      entries.push({ key, timestamp: entry.timestamp });
    }

    // Sort by oldest first
    entries.sort((a, b) => a.timestamp - b.timestamp);

    // Remove oldest 20%
    const toRemove = Math.ceil(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      const key = entries[i].key;
      this.memoryCache.delete(key);
      localStorage.removeItem(key);
    }

    console.debug(`[Cache] Pruned ${toRemove} old entries`);
  }

  /**
   * Get cache entry with freshness check
   * Returns { data, isStale, isFresh } or null if not found
   */
  get<T>(key: string, network: string): { data: T; isStale: boolean; isFresh: boolean } | null {
    const fullKey = `${CACHE_PREFIX}${key}-${network}`;
    const entry = this.memoryCache.get(fullKey);

    if (!entry || entry.version !== CACHE_VERSION) {
      return null;
    }

    const age = Date.now() - entry.timestamp;
    const ttl = key.includes('stats') ? STATS_CACHE_TTL : NODES_CACHE_TTL;
    
    const isFresh = age < ttl;
    const isStale = age >= ttl && age < STALE_WHILE_REVALIDATE;

    // If too old, don't return
    if (!isFresh && !isStale) {
      return null;
    }

    return {
      data: entry.data as T,
      isStale,
      isFresh,
    };
  }

  /**
   * Set cache entry
   */
  set<T>(key: string, data: T, network: string): void {
    const fullKey = `${CACHE_PREFIX}${key}-${network}`;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      network,
      version: CACHE_VERSION,
    };
    this.saveToStorage(fullKey, entry);
  }

  /**
   * Get nodes from cache (passive loading)
   * Always returns data if available (even stale), along with freshness status
   */
  getNodes(network: string): { nodes: PNode[]; isFresh: boolean; isStale: boolean } | null {
    return this.get<PNode[]>('nodes', network);
  }

  /**
   * Set nodes in cache
   */
  setNodes(nodes: PNode[], network: string): void {
    this.set('nodes', nodes, network);
  }

  /**
   * Get network stats from cache
   */
  getStats(network: string): { data: NetworkStats; isFresh: boolean; isStale: boolean } | null {
    return this.get<NetworkStats>('stats', network);
  }

  /**
   * Set network stats in cache
   */
  setStats(stats: NetworkStats, network: string): void {
    this.set('stats', stats, network);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    if (!this.isClient) return;

    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    for (const key of keys) {
      localStorage.removeItem(key);
    }
    this.memoryCache.clear();
    console.log('[Cache] All entries cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): { entries: number; networks: string[]; oldestMinutes: number } {
    const networks = new Set<string>();
    let oldest = Date.now();

    for (const [_, entry] of this.memoryCache.entries()) {
      networks.add(entry.network);
      if (entry.timestamp < oldest) {
        oldest = entry.timestamp;
      }
    }

    return {
      entries: this.memoryCache.size,
      networks: Array.from(networks),
      oldestMinutes: Math.floor((Date.now() - oldest) / 60000),
    };
  }
}

// ============================================================================
// SIMPLE CLIENT CACHE (for backward compatibility)
// ============================================================================

interface SimpleCache {
  get: <T>(key: string, network?: string) => T | null;
  set: <T>(key: string, data: T, network?: string) => void;
}

/**
 * Simple in-memory + localStorage cache for nodes
 * Keeps data persistent across page reloads
 */
class ClientCache implements SimpleCache {
  private memory: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Load from localStorage on init
    if (typeof window !== 'undefined') {
      this.loadFromStorage();
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('pglobe-client-cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        const now = Date.now();
        
        // Only load non-expired entries
        for (const [key, value] of Object.entries(parsed)) {
          const entry = value as { data: any; timestamp: number };
          // Use longer TTL for storage (1 hour) - will serve stale while revalidating
          if (now - entry.timestamp < 60 * 60 * 1000) {
            this.memory.set(key, entry);
          }
        }
        console.debug(`[ClientCache] Loaded ${this.memory.size} entries from storage`);
      }
    } catch (e) {
      console.warn('[ClientCache] Failed to load from storage');
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const obj: Record<string, any> = {};
      for (const [key, value] of this.memory.entries()) {
        obj[key] = value;
      }
      localStorage.setItem('pglobe-client-cache', JSON.stringify(obj));
    } catch (e) {
      console.warn('[ClientCache] Failed to save to storage');
    }
  }

  get<T>(key: string, network: string = 'default'): T | null {
    const fullKey = `${key}-${network}`;
    const entry = this.memory.get(fullKey);
    
    if (!entry) return null;
    
    // Always return data if exists (stale-while-revalidate pattern)
    // The caller should check freshness if needed
    return entry.data as T;
  }

  /**
   * Check if cache entry is fresh (within TTL)
   */
  isFresh(key: string, network: string = 'default'): boolean {
    const fullKey = `${key}-${network}`;
    const entry = this.memory.get(fullKey);
    
    if (!entry) return false;
    
    return Date.now() - entry.timestamp < this.TTL;
  }

  set<T>(key: string, data: T, network: string = 'default'): void {
    const fullKey = `${key}-${network}`;
    this.memory.set(fullKey, {
      data,
      timestamp: Date.now(),
    });
    this.saveToStorage();
  }

  clear(): void {
    this.memory.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pglobe-client-cache');
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Export persistent cache instance
export const persistentCache = new PersistentCache();

// Export simple client cache (for backward compat)
export const clientCache = new ClientCache();

// Export types
export type { NetworkStats, CacheEntry };





