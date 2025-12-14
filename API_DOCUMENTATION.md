# Xandeum Analytics Public API Documentation

## Base URL

```
https://your-domain.vercel.app/api/v1
```

## Authentication

All API endpoints require authentication via API key. You can provide the API key in two ways:

1. **Authorization Header** (Recommended):
   ```
   Authorization: Bearer YOUR_API_KEY
   ```

2. **Query Parameter**:
   ```
   ?api_key=YOUR_API_KEY
   ```

### Getting an API Key

Contact the administrator or use the default development key (if available).

## Rate Limits

- Default: **100 requests per minute**
- Rate limit headers are included in every response:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: Unix timestamp when rate limit resets

When rate limit is exceeded, you'll receive a `429 Too Many Requests` response.

## Endpoints

### 1. List Nodes

Get all nodes with filtering and pagination.

**GET** `/nodes`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `online`, `offline`, `syncing` |
| `version` | string | Filter by version |
| `country` | string | Filter by country code |
| `min_uptime` | number | Minimum uptime in seconds |
| `min_storage` | number | Minimum storage capacity in bytes |
| `sort_by` | string | Sort field (default: `uptime`) |
| `sort_order` | string | Sort order: `asc` or `desc` (default: `desc`) |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 100, max: 1000) |

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-domain.vercel.app/api/v1/nodes?status=online&sort_by=uptime&limit=50"
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "pubkey": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "address": "192.168.1.100:9001",
      "version": "0.7.0",
      "status": "online",
      "uptime": 86400,
      "cpuPercent": 45.2,
      "ramUsed": 8589934592,
      "ramTotal": 17179869184,
      "storageCapacity": 1000000000000,
      "storageUsed": 450000000000,
      "storageUsagePercent": 45,
      "latency": 12,
      "location": "New York, United States",
      "locationData": {
        "lat": 40.7128,
        "lon": -74.0060,
        "city": "New York",
        "country": "United States",
        "countryCode": "US"
      },
      "lastSeen": 1704067200000,
      "peerCount": 42,
      "balance": 1.5,
      "credits": 2880,
      "creditsResetMonth": "2025-01",
      "isPublic": true,
      "rpcPort": 6000
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 50,
    "totalPages": 3
  }
}
```

**Node Fields - Credits:**

The `credits` field represents reputation credits earned by a pNode. Credits are calculated as follows:

- **+1 credit** per heartbeat request responded to (~30 second intervals)
- **-100 credits** for failing to respond to a data request
- Credits **reset monthly** (tracked via `creditsResetMonth` field in YYYY-MM format)

Credits are fetched from the Xandeum pod credits API: `https://podcredits.xandeum.network/api/pods-credits`

The `creditsResetMonth` field indicates which month the current credits are for (e.g., "2025-01"). This helps track when credits reset each month.

---

### 2. Get Node by ID

Get detailed information about a specific node.

**GET** `/nodes/:id`

**Path Parameters:**
- `id`: Node pubkey or ID

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-domain.vercel.app/api/v1/nodes/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "pubkey": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "address": "192.168.1.100:9001",
    "version": "0.7.0",
    "status": "online",
    "uptime": 86400,
    "cpuPercent": 45.2,
    "ramUsed": 8589934592,
    "ramTotal": 17179869184,
    "storageCapacity": 1000000000000,
    "storageUsed": 450000000000,
    "storageUsagePercent": 45,
    "packetsReceived": 12345,
    "packetsSent": 12340,
    "activeStreams": 5,
    "latency": 12,
    "location": "New York, United States",
    "locationData": {
      "lat": 40.7128,
      "lon": -74.0060,
      "city": "New York",
      "country": "United States",
      "countryCode": "US"
    },
    "lastSeen": 1704067200000,
    "peerCount": 42,
    "balance": 1.5,
    "isPublic": true,
    "rpcPort": 6000,
    "dataOperationsHandled": 5000,
    "totalPages": 1000
  }
}
```

---

### 3. Network Health

Get network-wide health metrics.

**GET** `/network/health`

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-domain.vercel.app/api/v1/network/health"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "healthScore": 87,
    "totalNodes": 150,
    "onlineNodes": 142,
    "offlineNodes": 5,
    "syncingNodes": 3,
    "uptime": {
      "average": 7776000,
      "averageDays": 90
    },
    "latency": {
      "average": 45.2
    },
    "storage": {
      "total": 150000000000000,
      "used": 67500000000000,
      "usagePercent": 45
    },
    "cpu": {
      "average": 35.5
    },
    "versionDistribution": {
      "0.7.0": 120,
      "0.6.0": 25,
      "0.5.1": 5
    },
    "geographicDistribution": {
      "US": 50,
      "DE": 25,
      "GB": 20,
      "JP": 15,
      "CA": 10
    },
    "timestamp": 1704067200000
  }
}
```

---

### 4. Network Statistics

Get aggregated network statistics.

**GET** `/network/stats`

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-domain.vercel.app/api/v1/network/stats"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "totalNodes": 150,
    "totalStorage": 150000000000000,
    "totalRAM": 2576980377600,
    "totalPacketsReceived": 1851750,
    "totalPacketsSent": 1851000,
    "totalDataOperations": 750000,
    "totalPeers": 6300,
    "publicNodes": 80,
    "uniqueCountries": 25,
    "uniqueVersions": 3
  },
  "timestamp": 1704067200000
}
```

---

### 5. Trend Analytics

Get trend analytics grouped by version, country, or status.

**GET** `/analytics/trends`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `metric` | string | Metric to analyze: `uptime`, `storage`, `latency`, `cpu` |
| `group_by` | string | Group by: `version`, `country`, `status` |

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-domain.vercel.app/api/v1/analytics/trends?metric=uptime&group_by=version"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "metric": "uptime",
    "group_by": "version",
    "trends": {
      "0.7.0": {
        "count": 120,
        "average": 8640000,
        "averageDays": 100,
        "min": 3600000,
        "max": 15552000
      },
      "0.6.0": {
        "count": 25,
        "average": 6912000,
        "averageDays": 80,
        "min": 1800000,
        "max": 12096000
      }
    },
    "timestamp": 1704067200000
  }
}
```

---

### 6. Webhook Subscriptions

Create webhook subscriptions for real-time events.

**POST** `/webhooks`

**Request Body:**
```json
{
  "url": "https://your-server.com/webhooks/xandeum",
  "events": ["node.online", "node.offline", "network.health_change"]
}
```

**Example Request:**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-server.com/webhooks", "events": ["node.online"]}' \
  "https://your-domain.vercel.app/api/v1/webhooks"
```

**Available Events:**
- `node.online` - Node comes online
- `node.offline` - Node goes offline
- `node.status_change` - Node status changes
- `network.health_change` - Network health score changes significantly
- `network.version_update` - New version detected in network

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "wh_abc123",
    "url": "https://your-server.com/webhooks/xandeum",
    "events": ["node.online", "node.offline"],
    "enabled": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**GET** `/webhooks` - List all webhooks for your API key

**DELETE** `/webhooks/:id` - Delete a webhook

---

### 7. API Documentation

Get interactive API documentation.

**GET** `/docs`

**Example Request:**
```bash
curl "https://your-domain.vercel.app/api/v1/docs"
```

Returns full API documentation in JSON format.

---

## Response Format

All responses follow this format:

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "meta": { ... }  // Optional, for pagination
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message"
}
```

## Error Codes

| Code | Description |
|------|-------------|
| 401 | Unauthorized - Invalid or missing API key |
| 404 | Not Found - Resource does not exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Examples

### JavaScript/TypeScript

```typescript
const API_KEY = 'your-api-key';
const BASE_URL = 'https://your-domain.vercel.app/api/v1';

async function getNodes() {
  const response = await fetch(`${BASE_URL}/nodes`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`
    }
  });
  
  const data = await response.json();
  return data;
}
```

### Python

```python
import requests

API_KEY = 'your-api-key'
BASE_URL = 'https://your-domain.vercel.app/api/v1'

headers = {
    'Authorization': f'Bearer {API_KEY}'
}

response = requests.get(f'{BASE_URL}/nodes', headers=headers)
data = response.json()
```

### cURL

```bash
# List nodes
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-domain.vercel.app/api/v1/nodes"

# Get network health
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-domain.vercel.app/api/v1/network/health"
```

## Support

For questions or issues, please contact the API administrator or check the main documentation.

