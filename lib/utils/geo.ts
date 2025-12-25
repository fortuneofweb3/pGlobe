/**
 * Geo-location utilities for enriching pNode data with location information
 * Features persistent caching to avoid redundant API calls
 */

import { PNode } from '../types/pnode';

// ============================================================================
// GEO CACHE - Persistent localStorage cache for geo data
// ============================================================================

const GEO_CACHE_KEY = 'pglobe-geo-cache';
const GEO_CACHE_VERSION = 1;
const GEO_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

interface GeoCacheEntry {
  data: PNode['locationData'];
  timestamp: number;
}

interface GeoCache {
  version: number;
  entries: Record<string, GeoCacheEntry>;
}

/**
 * Load geo cache from localStorage
 */
function loadGeoCache(): GeoCache {
  if (typeof window === 'undefined') {
    return { version: GEO_CACHE_VERSION, entries: {} };
  }
  
  try {
    const cached = localStorage.getItem(GEO_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as GeoCache;
      if (parsed.version === GEO_CACHE_VERSION) {
        // Clean expired entries
        const now = Date.now();
        const cleanedEntries: Record<string, GeoCacheEntry> = {};
        let cleaned = 0;
        
        for (const [ip, entry] of Object.entries(parsed.entries)) {
          if (now - entry.timestamp < GEO_CACHE_TTL) {
            cleanedEntries[ip] = entry;
          } else {
            cleaned++;
          }
        }
        
        if (cleaned > 0) {
          console.debug(`[GeoCache] Cleaned ${cleaned} expired entries`);
        }
        
        return { version: GEO_CACHE_VERSION, entries: cleanedEntries };
      }
    }
  } catch (e) {
    console.warn('[GeoCache] Failed to load cache:', e);
  }
  
  return { version: GEO_CACHE_VERSION, entries: {} };
}

/**
 * Save geo cache to localStorage
 */
function saveGeoCache(cache: GeoCache): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('[GeoCache] Failed to save cache:', e);
  }
}

/**
 * Get cached geo data for an IP
 */
function getCachedGeo(ip: string): PNode['locationData'] | null {
  const cache = loadGeoCache();
  const entry = cache.entries[ip];
  
  if (entry && Date.now() - entry.timestamp < GEO_CACHE_TTL) {
    return entry.data;
  }
  
  return null;
}

/**
 * Set cached geo data for an IP
 */
function setCachedGeo(ip: string, data: PNode['locationData']): void {
  const cache = loadGeoCache();
  cache.entries[ip] = {
    data,
    timestamp: Date.now(),
  };
  saveGeoCache(cache);
}

/**
 * Batch set cached geo data (more efficient)
 */
function batchSetCachedGeo(entries: Array<{ ip: string; data: PNode['locationData'] }>): void {
  const cache = loadGeoCache();
  const now = Date.now();
  
  for (const { ip, data } of entries) {
    cache.entries[ip] = { data, timestamp: now };
  }
  
  saveGeoCache(cache);
  console.debug(`[GeoCache] Cached ${entries.length} new entries. Total: ${Object.keys(cache.entries).length}`);
}

// ============================================================================
// GEO UTILITIES
// ============================================================================

/**
 * Extract IP address from node address (format: "IP:PORT")
 */
export function extractIP(address: string): string | null {
  if (!address) return null;
  const parts = address.split(':');
  const ip = parts[0] || null;
  
  // Validate it's an IP, not a hostname
  if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    return ip;
  }
  
  return null;
}

/**
 * Fetch geo-location data for an IP address
 * @returns Location data or null if failed. Throws error if rate limited (429).
 */
export async function fetchGeoLocation(ip: string): Promise<PNode['locationData'] | null> {
  if (!ip) return null;

  // Check cache first
  const cached = getCachedGeo(ip);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(`/api/geo?ip=${encodeURIComponent(ip)}`);
    
    // Handle rate limiting - throw error so caller can handle it
    if (response.status === 429) {
      throw new Error('RATE_LIMIT_429');
    }
    
    if (!response.ok) {
      console.warn(`Geo API returned ${response.status} for ${ip}`);
      return null;
    }
    
    const data = await response.json();
    if (data.error) {
      console.warn(`Geo API error for ${ip}:`, data.error);
      return null;
    }

    const locationData: PNode['locationData'] = {
      lat: data.lat,
      lon: data.lon,
      city: data.city,
      country: data.country,
      countryCode: data.countryCode,
    };

    // Cache the result
    setCachedGeo(ip, locationData);

    return locationData;
  } catch (error: any) {
    // Re-throw rate limit errors
    if (error?.message === 'RATE_LIMIT_429') {
      throw error;
    }
    console.error(`Failed to fetch geo data for ${ip}:`, error);
    return null;
  }
}

/**
 * Enrich nodes with geo-location data (client-side)
 * Uses persistent cache + batch API for efficiency
 * 
 * @param nodes - Array of nodes to enrich
 */
export async function enrichNodesWithGeo(nodes: PNode[]): Promise<PNode[]> {
  const nodeMap = new Map(nodes.map(node => [node.address, { ...node }]));
  const ipsToFetch: string[] = [];
  let cacheHits = 0;

  // First pass: check cache and identify what needs fetching
  for (const node of nodes) {
    if (node.locationData) continue; // Already has location data
    
    const ip = extractIP(node.address);
    if (!ip) continue;

    // Check cache
    const cached = getCachedGeo(ip);
    if (cached) {
      cacheHits++;
      const nodeData = nodeMap.get(node.address);
      if (nodeData) {
        nodeData.locationData = cached;
        nodeMap.set(node.address, nodeData);
      }
    } else {
      ipsToFetch.push(ip);
    }
  }

  if (cacheHits > 0) {
    console.debug(`[Geo] Cache hits: ${cacheHits}, need to fetch: ${ipsToFetch.length}`);
  }

  if (ipsToFetch.length === 0) {
    return Array.from(nodeMap.values());
  }

  // Deduplicate IPs
  const uniqueIps = [...new Set(ipsToFetch)];
  console.log(`[Geo] Fetching ${uniqueIps.length} unique IPs via batch API`);

  try {
    const BATCH_SIZE = 100;
    const newCacheEntries: Array<{ ip: string; data: PNode['locationData'] }> = [];

    for (let i = 0; i < uniqueIps.length; i += BATCH_SIZE) {
      const ipBatch = uniqueIps.slice(i, i + BATCH_SIZE);
      
      try {
        const response = await fetch('/api/geo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ipBatch),
        });

        if (response.status === 429) {
          console.warn('[Geo] Rate limit reached. Using cached data only.');
          break;
        }

        if (!response.ok) {
          console.warn(`[Geo] Batch API returned ${response.status}`);
          continue;
        }

        const results = await response.json();
        let successCount = 0;

        ipBatch.forEach((ip, idx) => {
          const result = Array.isArray(results) ? results[idx] : null;
          if (result && !result.error && result.lat !== undefined && result.lon !== undefined) {
            const locationData: PNode['locationData'] = {
              lat: result.lat,
              lon: result.lon,
              city: result.city,
              country: result.country,
              countryCode: result.countryCode,
            };

            // Update all nodes with this IP
            for (const node of nodes) {
              if (extractIP(node.address) === ip) {
                const nodeData = nodeMap.get(node.address);
                if (nodeData) {
                  nodeData.locationData = locationData;
                  nodeMap.set(node.address, nodeData);
                }
              }
            }

            // Queue for cache
            newCacheEntries.push({ ip, data: locationData });
            successCount++;
          }
        });

        console.debug(`[Geo] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${successCount}/${ipBatch.length} succeeded`);

        // Small delay between batches
        if (i + BATCH_SIZE < uniqueIps.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`[Geo] Batch error:`, error);
      }
    }

    // Batch save to cache
    if (newCacheEntries.length > 0) {
      batchSetCachedGeo(newCacheEntries);
    }

    return Array.from(nodeMap.values());
  } catch (error) {
    console.error('[Geo] Failed to enrich nodes:', error);
    return Array.from(nodeMap.values());
  }
}

/**
 * Get cache statistics
 */
export function getGeoCacheStats(): { count: number; oldestDays: number } {
  const cache = loadGeoCache();
  const entries = Object.values(cache.entries);
  
  if (entries.length === 0) {
    return { count: 0, oldestDays: 0 };
  }

  const oldest = Math.min(...entries.map(e => e.timestamp));
  const oldestDays = Math.floor((Date.now() - oldest) / (24 * 60 * 60 * 1000));

  return { count: entries.length, oldestDays };
}

/**
 * Clear geo cache
 */
export function clearGeoCache(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(GEO_CACHE_KEY);
    console.log('[GeoCache] Cache cleared');
  }
}













