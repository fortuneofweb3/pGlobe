/**
 * In-memory cache for IP geolocation data
 * Avoids hitting ip-api.com rate limits (45 requests/minute)
 */

interface LocationData {
  lat: number;
  lon: number;
  city?: string;
  country?: string;
  countryCode?: string;
}

interface CacheEntry {
  data: LocationData;
  timestamp: number;
}

// In-memory cache (will reset on server restart, but that's fine)
const locationCache = new Map<string, CacheEntry>();

// Cache TTL: 24 hours (location data doesn't change)
const CACHE_TTL = 24 * 60 * 60 * 1000;

// Rate limiting: Track requests per minute
let requestCount = 0;
let requestWindowStart = Date.now();
const MAX_REQUESTS_PER_MINUTE = 40; // Stay under 45 limit

/**
 * Fetch geo data from ip-api.com with caching and rate limiting
 */
export async function fetchLocationForIP(ip: string): Promise<LocationData | null> {
  // Skip private/invalid IPs
  if (!ip || !ip.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return null;
  }
  
  // Skip private IP ranges
  const parts = ip.split('.').map(Number);
  if (
    parts[0] === 10 || // 10.x.x.x
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16-31.x.x
    (parts[0] === 192 && parts[1] === 168) || // 192.168.x.x
    parts[0] === 127 // 127.x.x.x (localhost)
  ) {
    return null;
  }
  
  // Check cache first
  const cached = locationCache.get(ip);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Rate limiting check
  const now = Date.now();
  if (now - requestWindowStart > 60000) {
    // Reset window
    requestWindowStart = now;
    requestCount = 0;
  }

  if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
    console.warn(`[Location Cache] Rate limit reached, skipping ${ip}`);
    return null;
  }

  try {
    requestCount++;
    
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,city,lat,lon`,
      { signal: AbortSignal.timeout(3000) }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.status === 'success') {
      const locationData: LocationData = {
        lat: data.lat,
        lon: data.lon,
        city: data.city,
        country: data.country,
        countryCode: data.countryCode,
      };

      // Cache the result
      locationCache.set(ip, {
        data: locationData,
        timestamp: now,
      });

      console.log(`[Location Cache] ✅ ${ip}: ${data.city}, ${data.country}`);
      return locationData;
    } else {
      console.warn(`[Location Cache] ❌ ${ip}: ${data.message || 'failed'}`);
    }

    return null;
  } catch (error: any) {
    console.error(`[Location Cache] Error fetching ${ip}:`, error.message);
    return null;
  }
}

/**
 * Batch fetch locations for multiple IPs using ip-api.com batch endpoint
 * Batch endpoint: Can fetch up to 100 IPs in a single POST request
 * Much faster than individual requests!
 */
export async function batchFetchLocations(
  ips: string[]
): Promise<Map<string, LocationData>> {
  const results = new Map<string, LocationData>();
  
  console.log(`[Location Cache] Fetching locations for ${ips.length} IPs using batch API...`);
  
  // Filter out invalid/private IPs
  const validIPs = ips.filter(ip => {
    if (!ip || !ip.match(/^\d+\.\d+\.\d+\.\d+$/)) return false;
    
    const parts = ip.split('.').map(Number);
    // Skip private IP ranges
    if (
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] === 127
    ) {
      return false;
    }
    
    return true;
  });
  
  console.log(`[Location Cache] ${validIPs.length}/${ips.length} IPs are valid for lookup`);
  
  // Check cache first, only fetch uncached IPs
  const uncachedIPs: string[] = [];
  for (const ip of validIPs) {
    const cached = locationCache.get(ip);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      results.set(ip, cached.data);
    } else {
      uncachedIPs.push(ip);
    }
  }
  
  console.log(`[Location Cache] ${results.size} from cache, ${uncachedIPs.length} need fetching`);
  
  if (uncachedIPs.length === 0) {
    return results;
  }
  
  // Batch API: Can query up to 100 IPs per request
  const BATCH_SIZE = 100;
  const batches = [];
  
  for (let i = 0; i < uncachedIPs.length; i += BATCH_SIZE) {
    batches.push(uncachedIPs.slice(i, i + BATCH_SIZE));
  }
  
  console.log(`[Location Cache] Processing ${batches.length} batch(es) of up to ${BATCH_SIZE} IPs...`);
  
  // Process batches sequentially (respect rate limits)
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNumber = i + 1;
    
    console.log(`[Location Cache] Batch ${batchNumber}/${batches.length}: Fetching ${batch.length} IPs...`);
    
    try {
      const response = await fetch('http://ip-api.com/batch?fields=status,message,query,country,countryCode,city,lat,lon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(10000), // 10 second timeout for batch
      });
      
      if (!response.ok) {
        console.error(`[Location Cache] Batch ${batchNumber} HTTP error: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        console.error(`[Location Cache] Batch ${batchNumber} invalid response format`);
        continue;
      }
      
      let successCount = 0;
      data.forEach((result: any) => {
        if (result.status === 'success') {
          const locationData: LocationData = {
            lat: result.lat,
            lon: result.lon,
            city: result.city,
            country: result.country,
            countryCode: result.countryCode,
          };
          
          // Cache the result
          locationCache.set(result.query, {
            data: locationData,
            timestamp: Date.now(),
          });
          
          results.set(result.query, locationData);
          successCount++;
        } else {
          console.warn(`[Location Cache] ❌ ${result.query}: ${result.message || 'failed'}`);
        }
      });
      
      console.log(`[Location Cache] Batch ${batchNumber}/${batches.length}: ${successCount}/${batch.length} succeeded, total: ${results.size}/${validIPs.length}`);
    } catch (error: any) {
      console.error(`[Location Cache] Batch ${batchNumber} error:`, error.message);
    }
    
    // Wait 2 seconds between batches (rate limit safety)
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`[Location Cache] Completed: ${results.size}/${ips.length} locations fetched`);
  return results;
}

/**
 * Check cache only (no API calls) - for synchronous cache lookups
 */
export function getCachedLocation(ip: string): LocationData | null {
  if (!ip || !ip.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return null;
  }
  
  // Skip private IP ranges
  const parts = ip.split('.').map(Number);
  if (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 127
  ) {
    return null;
  }
  
  const cached = locationCache.get(ip);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  return null;
}

/**
 * Get cache stats for monitoring
 */
export function getCacheStats() {
  return {
    size: locationCache.size,
    requestCount,
    requestWindowStart,
    maxRequestsPerMinute: MAX_REQUESTS_PER_MINUTE,
  };
}

/**
 * Clear old cache entries
 */
export function cleanCache() {
  const now = Date.now();
  let removed = 0;
  
  for (const [ip, entry] of locationCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      locationCache.delete(ip);
      removed++;
    }
  }
  
  console.log(`[Location Cache] Cleaned ${removed} expired entries`);
  return removed;
}

