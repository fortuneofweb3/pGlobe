/**
 * Public API Authentication & Rate Limiting
 */

interface APIKey {
  key: string;
  name: string;
  userId?: string;
  createdAt: Date;
  lastUsed?: Date;
  rateLimit: number; // requests per minute
  enabled: boolean;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory API key store (in production, use database)
const API_KEYS: Map<string, APIKey> = new Map();

// In-memory rate limit tracking (in production, use Redis)
const rateLimitStore: Map<string, RateLimitEntry> = new Map();

// Initialize with a default API key if provided via env
const DEFAULT_API_KEY = process.env.DEFAULT_API_KEY || 'dev-key-default';
if (DEFAULT_API_KEY && DEFAULT_API_KEY !== 'dev-key-default') {
  API_KEYS.set(DEFAULT_API_KEY, {
    key: DEFAULT_API_KEY,
    name: 'Default API Key',
    createdAt: new Date(),
    rateLimit: 100, // 100 requests per minute
    enabled: true,
  });
}

/**
 * Validate API key from request
 */
export function validateAPIKey(request: Request): { valid: boolean; key?: string; error?: string } {
  // Check Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const apiKey = authHeader.substring(7);
    const keyData = API_KEYS.get(apiKey);
    if (keyData && keyData.enabled) {
      // Update last used
      keyData.lastUsed = new Date();
      return { valid: true, key: apiKey };
    }
    return { valid: false, error: 'Invalid API key' };
  }

  // Check query parameter (less secure, but convenient)
  const url = new URL(request.url);
  const apiKeyParam = url.searchParams.get('api_key');
  if (apiKeyParam) {
    const keyData = API_KEYS.get(apiKeyParam);
    if (keyData && keyData.enabled) {
      keyData.lastUsed = new Date();
      return { valid: true, key: apiKeyParam };
    }
    return { valid: false, error: 'Invalid API key' };
  }

  return { valid: false, error: 'API key required' };
}

/**
 * Check rate limit for API key
 */
export function checkRateLimit(apiKey: string, limit: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(apiKey);

  if (!entry || entry.resetAt < now) {
    // Reset or create new entry
    rateLimitStore.set(apiKey, {
      count: 1,
      resetAt: now + 60000, // 1 minute window
    });
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: now + 60000,
    };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  entry.count++;
  rateLimitStore.set(apiKey, entry);

  return {
    allowed: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Create a new API key (for admin use)
 */
export function createAPIKey(name: string, rateLimit: number = 100): string {
  const key = `xk_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  API_KEYS.set(key, {
    key,
    name,
    createdAt: new Date(),
    rateLimit,
    enabled: true,
  });
  return key;
}

/**
 * Get API key info
 */
export function getAPIKeyInfo(apiKey: string): APIKey | undefined {
  return API_KEYS.get(apiKey);
}

/**
 * Middleware wrapper for API routes
 */
export function withAPIAuth(
  handler: (request: Request, context: { apiKey: string; rateLimit: number }) => Promise<Response>
) {
  return async (request: Request): Promise<Response> => {
    const { NextResponse } = await import('next/server');
    
    // Validate API key
    const auth = validateAPIKey(request);
    if (!auth.valid) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
      );
    }

    const apiKey = auth.key!;
    const keyInfo = getAPIKeyInfo(apiKey);

    // Check rate limit
    const rateLimit = keyInfo?.rateLimit || 100;
    const rateLimitCheck = checkRateLimit(apiKey, rateLimit);

    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          limit: rateLimit,
          resetAt: new Date(rateLimitCheck.resetAt).toISOString(),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitCheck.resetAt.toString(),
            'Retry-After': Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Add rate limit headers to response
    const response = await handler(request, { apiKey, rateLimit });
    response.headers.set('X-RateLimit-Limit', rateLimit.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimitCheck.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimitCheck.resetAt.toString());

    return response;
  };
}


