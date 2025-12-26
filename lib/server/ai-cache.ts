/**
 * AI Query Cache
 * 
 * In-memory cache for AI query responses to reduce redundant API calls
 * and improve response times for frequently requested data.
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

class AICache {
    private cache: Map<string, CacheEntry<unknown>> = new Map();
    private aggregateCache: Map<string, CacheEntry<unknown>> = new Map();

    /**
     * Get cached data if valid
     */
    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const age = Date.now() - entry.timestamp;
        if (age > entry.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.data as T;
    }

    /**
     * Set cache with TTL
     */
    set<T>(key: string, data: T, ttlMs: number = 60000): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttlMs,
        });
    }

    /**
     * Get aggregate cache (longer TTL)
     */
    getAggregate<T>(key: string): T | null {
        const entry = this.aggregateCache.get(key);
        if (!entry) return null;

        const age = Date.now() - entry.timestamp;
        if (age > entry.ttl) {
            this.aggregateCache.delete(key);
            return null;
        }

        return entry.data as T;
    }

    /**
     * Set aggregate cache with longer TTL
     */
    setAggregate<T>(key: string, data: T, ttlMs: number = 300000): void {
        this.aggregateCache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttlMs,
        });
    }

    /**
     * Clear all caches
     */
    clear(): void {
        this.cache.clear();
        this.aggregateCache.clear();
    }

    /**
     * Clear expired entries (garbage collection)
     */
    cleanup(): void {
        const now = Date.now();

        // Cleanup main cache
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                this.cache.delete(key);
            }
        }

        // Cleanup aggregate cache
        for (const [key, entry] of this.aggregateCache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                this.aggregateCache.delete(key);
            }
        }
    }

    /**
     * Get cache stats
     */
    getStats() {
        return {
            cacheSize: this.cache.size,
            aggregateCacheSize: this.aggregateCache.size,
            totalEntries: this.cache.size + this.aggregateCache.size,
        };
    }
}

// Singleton instance
export const aiCache = new AICache();

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        aiCache.cleanup();
    }, 5 * 60 * 1000);
}
