import { NextResponse } from 'next/server';
import { calculateNetworkHealth } from '@/lib/utils/network-health';
import { PNode } from '@/lib/types/pnode';

export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

if (!DEEPSEEK_API_KEY) {
  console.warn('[AI Chat] DEEPSEEK_API_KEY not found in environment variables');
} else {
  console.log(`[AI Chat] DeepSeek API key loaded (${DEEPSEEK_API_KEY.slice(0, 8)}...${DEEPSEEK_API_KEY.slice(-4)})`);
}

// Define tools/functions the AI can call (OpenAI format)
export const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'filter_nodes',
      description: 'Filter and find pNodes. USE THIS for storage, uptime, credits, status, country queries. Specify ONLY the fields you need to reduce payload.',
      parameters: {
        type: 'object',
        properties: {
          country: { type: 'string', description: 'Country code(s). Single: "NG" or comma-separated: "NG,FR,DE"' },
          status: { type: 'string', enum: ['online', 'offline', 'syncing'], description: 'Filter by status' },
          minRamPercent: { type: 'number', description: 'Min RAM % (0-100)' },
          maxRamPercent: { type: 'number', description: 'Max RAM % (0-100)' },
          minCpuPercent: { type: 'number', description: 'Min CPU % (0-100)' },
          maxCpuPercent: { type: 'number', description: 'Max CPU % (0-100)' },
          minCredits: { type: 'number', description: 'Min credits' },
          minStorageBytes: { type: 'number', description: 'Min storage BYTES. 1GB=1073741824' },
          minUptimeSeconds: { type: 'number', description: 'Min uptime SECONDS. 1h=3600, 2h=7200' },
          maxUptimeSeconds: { type: 'number', description: 'Max uptime SECONDS. For "less than" queries' },
          continent: { type: 'string', enum: ['africa', 'europe', 'asia', 'north_america', 'south_america', 'oceania'] },
          fields: {
            type: 'array',
            items: { type: 'string' },
            description: 'Fields to return. Options: pubkey, status, uptimeSeconds, credits, storageBytes, cpuPercent, ramPercent, country. Only request what you NEED!'
          },
          countOnly: { type: 'boolean', description: 'Set true to return ONLY the count, no node data. Best for percentage calculations.' }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_node_details',
      description: 'Get ALL details about ONE specific pNode. Use when user asks about a SPECIFIC node by its pubkey or IP address. Returns: status, credits, storage, uptime, location, CPU, RAM, etc.',
      parameters: {
        type: 'object',
        properties: {
          pubkey: { type: 'string', description: 'The public key of the pNode (base58 string)' },
          address: { type: 'string', description: 'The IP:port address (e.g., "192.168.1.1:9001")' }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_credits_change',
      description: 'Find nodes by HOW MUCH credits they EARNED over time (delta/change). Use ONLY for: "which nodes earned credits", "active earning nodes", "nodes that earned X credits in last hour". NOT for: storage, current credits, node counts.',
      parameters: {
        type: 'object',
        properties: {
          minCreditsEarned: { type: 'number', description: 'Minimum credits EARNED (the change amount)' },
          maxCreditsEarned: { type: 'number', description: 'Maximum credits EARNED (the change amount)' },
          timeRange: {
            type: 'string',
            enum: ['1h', '24h', '7d'],
            description: 'Time period to measure credit earning'
          }
        },
        required: ['timeRange']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_network_stats',
      description: 'Get NETWORK-WIDE aggregate statistics. Use for: "how many total nodes", "total network storage", "overall health score", "country distribution". Returns: totalNodes, onlineNodes, totalStorage, countryBreakdown, healthScore.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_user_location',
      description: 'Get the CURRENT USER\'s location from their IP. Use for: "where am I", "my location", "nodes near me" (combine with find_closest_nodes).',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_location_for_ip',
      description: 'Look up location for ANY IP address. Use for: "where is IP X located", "location of this address".',
      parameters: {
        type: 'object',
        properties: {
          ip: { type: 'string', description: 'IP address to look up' }
        },
        required: ['ip']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'find_closest_nodes',
      description: 'Find pNodes NEAREST to a location. Use for: "closest nodes to me", "nodes near IP X", "nodes near these coordinates". Returns nodes sorted by distance.',
      parameters: {
        type: 'object',
        properties: {
          ip: { type: 'string', description: 'IP address to find closest nodes to' },
          lat: { type: 'number', description: 'Latitude (-90 to 90)' },
          lon: { type: 'number', description: 'Longitude (-180 to 180)' },
          limit: { type: 'number', description: 'Max nodes to return (default: 20)' }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'compare_nodes',
      description: 'Compare 2+ SPECIFIC pNodes side-by-side. Use for: "compare node A vs B", "which of these nodes is better". Provide pubkeys OR addresses.',
      parameters: {
        type: 'object',
        properties: {
          pubkeys: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of pubkeys to compare'
          },
          addresses: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of IP:port addresses to compare'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'compare_countries',
      description: 'Compare 2+ COUNTRIES by their aggregate stats. Use for: "compare Nigeria vs France", "which country has more nodes". Provide country codes.',
      parameters: {
        type: 'object',
        properties: {
          countries: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of country codes (e.g., ["NG", "FR", "DE"])'
          }
        },
        required: ['countries']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_node_history',
      description: 'Get HISTORICAL data over TIME for a node or network. Use for: "how has node X performed", "network trends over 24h", "status changes". Returns time-series snapshots.',
      parameters: {
        type: 'object',
        properties: {
          pubkey: { type: 'string', description: 'Pubkey for specific node history (omit for network-wide)' },
          address: { type: 'string', description: 'IP:port for specific node history' },
          hours: { type: 'number', description: 'Hours to look back (default: 24)' },
          days: { type: 'number', description: 'Days to look back (use instead of hours)' }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_country_data',
      description: 'Get CURRENT stats for ONE country. Use for: "Nigeria stats", "how many nodes in US", "France health score". Returns: nodeCount, onlineCount, storage, credits, avgCPU, avgRAM, cities, healthScore.',
      parameters: {
        type: 'object',
        properties: {
          country: { type: 'string', description: 'Country name or code (e.g., "Nigeria" or "NG")' },
          countryCode: { type: 'string', description: 'Optional: ISO code for better matching' }
        },
        required: ['country']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_country_history',
      description: 'Get HISTORICAL trends for a country over time. Use for: "Nigeria performance last week", "US node count trend", "how has France health changed".',
      parameters: {
        type: 'object',
        properties: {
          country: { type: 'string', description: 'Country name or code' },
          countryCode: { type: 'string', description: 'Optional: ISO code' },
          hours: { type: 'number', description: 'Hours to look back (default: 24)' },
          days: { type: 'number', description: 'Days to look back' }
        },
        required: ['country']
      }
    }
  }
];

// Continent to country code mapping
export const continentCountries: Record<string, string[]> = {
  africa: ['DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CM', 'CV', 'CF', 'TD', 'KM', 'CG', 'CD', 'CI', 'DJ', 'EG', 'GQ', 'ER', 'ET', 'GA', 'GM', 'GH', 'GN', 'GW', 'KE', 'LS', 'LR', 'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG', 'RW', 'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'SZ', 'TZ', 'TG', 'TN', 'UG', 'ZM', 'ZW'],
  europe: ['AL', 'AD', 'AT', 'BY', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'XK', 'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'RU', 'SM', 'RS', 'SK', 'SI', 'ES', 'SE', 'CH', 'UA', 'GB', 'VA'],
  asia: ['AF', 'AM', 'AZ', 'BH', 'BD', 'BT', 'BN', 'KH', 'CN', 'GE', 'IN', 'ID', 'IR', 'IQ', 'IL', 'JP', 'JO', 'KZ', 'KW', 'KG', 'LA', 'LB', 'MY', 'MV', 'MN', 'MM', 'NP', 'KP', 'OM', 'PK', 'PS', 'PH', 'QA', 'SA', 'SG', 'KR', 'LK', 'SY', 'TW', 'TJ', 'TH', 'TL', 'TR', 'TM', 'AE', 'UZ', 'VN', 'YE'],
  north_america: ['AG', 'BS', 'BB', 'BZ', 'CA', 'CR', 'CU', 'DM', 'DO', 'SV', 'GD', 'GT', 'HT', 'HN', 'JM', 'MX', 'NI', 'PA', 'KN', 'LC', 'VC', 'TT', 'US'],
  south_america: ['AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'GY', 'PY', 'PE', 'SR', 'UY', 'VE'],
  oceania: ['AU', 'FJ', 'KI', 'MH', 'FM', 'NR', 'NZ', 'PW', 'PG', 'WS', 'SB', 'TO', 'TV', 'VU']
};

// Execute a function call
export async function executeFunction(
  name: string,
  args: any,
  baseUrl: string,
  clientIp?: string,
  onStatusUpdate?: (status: string) => void
): Promise<any> {
  const functionStatusMap: Record<string, string> = {
    'get_user_location': 'Getting your location...',
    'get_location_for_ip': 'Looking up IP location...',
    'find_closest_nodes': 'Finding nearest nodes...',
    'filter_nodes': 'Filtering nodes...',
    'get_node_details': 'Fetching node details...',
    'get_network_stats': 'Calculating network statistics...',
    'get_credits_change': 'Checking credit changes...',
    'get_node_history': 'Fetching historical data...',
    'compare_nodes': 'Comparing nodes...',
    'compare_countries': 'Comparing countries...',
    'get_country_data': 'Fetching country statistics...',
    'get_country_history': 'Fetching country historical data...',
  };

  const statusMessage = functionStatusMap[name] || `Executing ${name}...`;
  if (onStatusUpdate) {
    onStatusUpdate(statusMessage);
  }
  console.log(`[AI Chat] Executing function: ${name}`, args);

  try {
    switch (name) {
      case 'filter_nodes': {
        const filters: any = {};

        if (args.continent) {
          const countries = continentCountries[args.continent.toLowerCase()];
          if (countries) {
            filters.country = countries;
          }
        } else if (args.country) {
          filters.country = args.country.includes(',')
            ? args.country.split(',').map((c: string) => c.trim().toUpperCase())
            : args.country.toUpperCase();
        }

        if (args.status) filters.status = args.status;
        if (args.minRamPercent !== undefined) filters.minRamPercent = args.minRamPercent;
        if (args.maxRamPercent !== undefined) filters.maxRamPercent = args.maxRamPercent;
        if (args.minCpuPercent !== undefined) filters.minCpuPercent = args.minCpuPercent;
        if (args.maxCpuPercent !== undefined) filters.maxCpuPercent = args.maxCpuPercent;
        if (args.minCredits !== undefined) filters.minCredits = args.minCredits;
        if (args.minStorageBytes !== undefined) filters.minStorageBytes = args.minStorageBytes;
        if (args.minUptimeSeconds !== undefined) filters.minUptimeSeconds = args.minUptimeSeconds;
        if (args.maxUptimeSeconds !== undefined) filters.maxUptimeSeconds = args.maxUptimeSeconds;

        const response = await fetch(`${baseUrl}/api/ai/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queryType: 'nodes',
            filters,
            fields: args.fields, // Pass selective fields
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const data = await response.json();
          // If countOnly, just return the count for efficient calculations
          if (args.countOnly) {
            return { totalCount: data.count || (data.nodes?.length ?? 0) };
          }
          return formatNodesResult(data.nodes || [], name, args.fields);
        }
        return { error: 'Failed to fetch nodes' };
      }

      case 'get_node_details': {
        const response = await fetch(`${baseUrl}/api/ai/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queryType: 'node',
            pubkey: args.pubkey,
            address: args.address
          }),
          signal: AbortSignal.timeout(3000), // Fast timeout since cached
        });

        if (response.ok) {
          const data = await response.json();
          return data.node ? formatNodeDetails(data.node) : { error: 'Node not found' };
        }
        return { error: 'Failed to fetch node details' };
      }

      case 'get_credits_change': {
        const response = await fetch(`${baseUrl}/api/ai/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queryType: 'credits-change',
            filters: {
              minCreditsEarned: args.minCreditsEarned ?? 0,
              maxCreditsEarned: args.maxCreditsEarned,
              timeRange: args.timeRange || '1h'
            }
          }),
        });

        if (response.ok) {
          const data = await response.json();
          let nodes = data.nodes || [];

          if (args.maxCreditsEarned !== undefined) {
            nodes = nodes.filter((n: any) => n.creditsEarned < args.maxCreditsEarned);
          }

          return {
            totalCount: nodes.length,
            timeRange: args.timeRange || '1h',
            nodes: nodes.map((n: any) => ({
              pubkey: n.pubkey,
              address: n.address,
              creditsEarned: n.creditsEarned,
            }))
          };
        }
        return { error: 'Failed to fetch credit changes' };
      }

      case 'get_network_stats': {
        const response = await fetch(`${baseUrl}/api/ai/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queryType: 'nodes', filters: {} }),
          signal: AbortSignal.timeout(5000), // Cached response should be fast
        });

        if (response.ok) {
          const data = await response.json();
          const nodes = data.nodes || [];

          const stats = {
            totalNodes: nodes.length,
            onlineNodes: nodes.filter((n: any) => n.s === 'online').length,
            syncingNodes: nodes.filter((n: any) => n.s === 'syncing').length,
            offlineNodes: nodes.filter((n: any) => n.s === 'offline').length,
            totalStorageBytes: nodes.reduce((sum: number, n: any) => sum + (n.sc || 0), 0),
            totalCredits: nodes.reduce((sum: number, n: any) => sum + (n.cr || 0), 0),
            avgUptimeSeconds: nodes.length > 0
              ? nodes.reduce((sum: number, n: any) => sum + (n.us || 0), 0) / nodes.length
              : 0,
            healthScore: calculateNetworkHealth(nodes.map((n: any) => ({
              id: n.p || n.pubkey,
              status: n.s || n.status,
              version: n.v || n.version,
              locationData: {
                country: n.c || n.country,
                city: n.cy || n.city
              }
            } as PNode))).overall,
            countryDistribution: {} as Record<string, number>
          };

          nodes.forEach((n: any) => {
            const country = n.c || 'Unknown';
            stats.countryDistribution[country] = (stats.countryDistribution[country] || 0) + 1;
          });

          return stats;
        }
        return { error: 'Failed to fetch network stats' };
      }

      case 'get_user_location': {
        // Use client-provided IP if available (more accurate), otherwise fall back to server-side detection
        if (clientIp) {
          // Use the same method as scan page - get location for the client IP
          const geoResponse = await fetch(`${baseUrl}/api/geo?ip=${encodeURIComponent(clientIp)}`);
          if (geoResponse.ok) {
            const geoData = await geoResponse.json();
            if (geoData.error || !geoData.lat || !geoData.lon) {
              // Fall back to server-side detection
              const response = await fetch(`${baseUrl}/api/client-location`);
              if (response.ok) {
                const data = await response.json();
                return {
                  ip: data.ip,
                  location: data.location
                };
              }
              return { error: 'Failed to get user location' };
            }
            return {
              ip: clientIp,
              location: {
                lat: geoData.lat,
                lon: geoData.lon,
                city: geoData.city,
                country: geoData.country,
                countryCode: geoData.countryCode
              }
            };
          }
        }

        // Fall back to server-side detection
        const response = await fetch(`${baseUrl}/api/client-location`);
        if (response.ok) {
          const data = await response.json();
          return {
            ip: data.ip,
            location: data.location
          };
        }
        return { error: 'Failed to get user location' };
      }

      case 'get_location_for_ip': {
        const response = await fetch(`${baseUrl}/api/geo?ip=${encodeURIComponent(args.ip)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.error) {
            return { error: data.error };
          }
          return {
            ip: args.ip,
            lat: data.lat,
            lon: data.lon,
            city: data.city,
            country: data.country,
            countryCode: data.countryCode
          };
        }
        return { error: 'Failed to get location for IP' };
      }

      case 'find_closest_nodes': {
        let lat: number, lon: number;
        let userCountryCode: string | null = null;

        // Get location from IP or use provided coordinates
        if (args.ip) {
          const geoResponse = await fetch(`${baseUrl}/api/geo?ip=${encodeURIComponent(args.ip)}`);
          if (!geoResponse.ok) {
            return { error: 'Failed to get location for IP' };
          }
          const geoData = await geoResponse.json();
          if (geoData.error || !geoData.lat || !geoData.lon) {
            return { error: geoData.error || 'Invalid location data' };
          }
          lat = geoData.lat;
          lon = geoData.lon;
          userCountryCode = geoData.countryCode || null;
        } else if (args.lat !== undefined && args.lon !== undefined) {
          lat = args.lat;
          lon = args.lon;
          // If clientIp is provided, try to get country from it
          if (clientIp) {
            try {
              const geoResponse = await fetch(`${baseUrl}/api/geo?ip=${encodeURIComponent(clientIp)}`);
              if (geoResponse.ok) {
                const geoData = await geoResponse.json();
                userCountryCode = geoData.countryCode || null;
              }
            } catch (e) {
              // Ignore errors, just continue without country code
            }
          }
        } else {
          return { error: 'Either ip or lat/lon must be provided' };
        }

        // Get all nodes - use the same fast endpoint as the frontend (/api/pnodes)
        // This is faster than /api/ai/query because it's cached and optimized (same as scan page uses)
        let nodesResponse: Response;
        try {
          nodesResponse = await fetch(`${baseUrl}/api/pnodes`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000), // 10 second timeout (should be fast with cache)
          });
        } catch (fetchError: any) {
          console.error('[AI Chat] Failed to fetch nodes from /api/pnodes:', fetchError?.message);
          return { error: `Failed to fetch nodes: ${fetchError?.message || 'Network error'}` };
        }

        if (!nodesResponse.ok) {
          const errorText = await nodesResponse.text().catch(() => 'Unknown error');
          console.error('[AI Chat] /api/pnodes returned error:', nodesResponse.status, errorText);
          return { error: `Failed to fetch nodes: ${nodesResponse.status} ${errorText}` };
        }

        let nodesData: any;
        try {
          nodesData = await nodesResponse.json();
        } catch (parseError: any) {
          console.error('[AI Chat] Failed to parse nodes response:', parseError?.message);
          return { error: 'Failed to parse nodes response' };
        }

        const nodes = nodesData.nodes || [];
        if (!Array.isArray(nodes)) {
          console.error('[AI Chat] Invalid nodes data structure:', typeof nodes);
          return { error: 'Invalid nodes data structure' };
        }

        // Calculate distance for each node (Haversine formula - matches scan page exactly)
        // Use the same structure as scan page: node.locationData.lat/lon
        const nodesWithDistance = nodes
          .filter((node: any) => {
            // Same filter as scan page
            const hasLocation = node.locationData?.lat != null &&
              node.locationData?.lon != null &&
              !isNaN(node.locationData.lat) &&
              !isNaN(node.locationData.lon);
            return hasLocation;
          })
          .map((node: any) => {
            // Same calculation as scan page
            const R = 6371; // Radius of the Earth in kilometers
            const dLat = (node.locationData.lat - lat) * Math.PI / 180;
            const dLon = (node.locationData.lon - lon) * Math.PI / 180;
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat * Math.PI / 180) * Math.cos(node.locationData.lat * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distanceKm = R * c;

            const nodeCountry = (node.locationData?.countryCode || node.locationData?.country || 'Unknown').toUpperCase();
            const isSameCountry = userCountryCode && nodeCountry === userCountryCode.toUpperCase();

            // Format node details for AI response
            return {
              pubkey: node.pubkey || node.publicKey || node.id,
              address: node.address,
              status: node.status,
              version: node.version,
              uptimeSeconds: node.uptime || 0,
              uptimeDays: node.uptime ? Math.floor(node.uptime / 86400) : 0,
              credits: node.credits || 0,
              storageBytes: node.storageCapacity || 0,
              cpuPercent: node.cpuPercent,
              ramPercent: node.ramTotal ? ((node.ramUsed || 0) / node.ramTotal * 100) : null,
              country: nodeCountry,
              city: node.locationData?.city || '',
              distanceKm, // No rounding to match scan page exactly
              distanceMi: distanceKm * 0.621371, // Convert to miles (same as scan page)
              isSameCountry // Flag to help AI prioritize
            };
          })
          .sort((a: any, b: any) => {
            // Prioritize same-country nodes, then sort by distance
            if (a.isSameCountry && !b.isSameCountry) return -1;
            if (!a.isSameCountry && b.isSameCountry) return 1;
            return (a.distanceKm || Infinity) - (b.distanceKm || Infinity);
          })
          .slice(0, args.limit || 20);

        return {
          location: { lat, lon, countryCode: userCountryCode },
          count: nodesWithDistance.length,
          nodes: nodesWithDistance,
          sameCountryNodes: nodesWithDistance.filter((n: any) => n.isSameCountry).length
        };
      }

      case 'compare_nodes': {
        const pubkeys = args.pubkeys || [];
        const addresses = args.addresses || [];

        if (pubkeys.length === 0 && addresses.length === 0) {
          return { error: 'At least one pubkey or address must be provided' };
        }

        // Fetch all nodes
        const nodesResponse = await fetch(`${baseUrl}/api/ai/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queryType: 'nodes', filters: {} }),
        });

        if (!nodesResponse.ok) {
          return { error: 'Failed to fetch nodes' };
        }

        const nodesData = await nodesResponse.json();
        const allNodes = nodesData.nodes || [];

        // Find matching nodes (case-insensitive comparison)
        const matchedNodes = allNodes.filter((n: any) => {
          const nodePubkey = (n.p || n.pubkey || '').toString().toLowerCase();
          const nodeAddress = (n.a || n.address || '').toString().toLowerCase();

          return pubkeys.some((pk: string) => nodePubkey === pk.toLowerCase()) ||
            addresses.some((addr: string) => nodeAddress === addr.toLowerCase());
        });

        if (matchedNodes.length === 0) {
          return { error: 'No matching nodes found' };
        }

        return {
          count: matchedNodes.length,
          nodes: matchedNodes.map((n: any) => formatNodeDetails(n))
        };
      }

      case 'compare_countries': {
        const countries = (args.countries || []).map((c: string) => c.toUpperCase());

        if (countries.length === 0) {
          return { error: 'At least one country code must be provided' };
        }

        // Fetch all nodes
        const nodesResponse = await fetch(`${baseUrl}/api/ai/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queryType: 'nodes', filters: {} }),
        });

        if (!nodesResponse.ok) {
          return { error: 'Failed to fetch nodes' };
        }

        const nodesData = await nodesResponse.json();
        const allNodes = nodesData.nodes || [];

        // Group by country and calculate stats
        const countryStats = countries.map((country: string) => {
          const countryNodes = allNodes.filter((n: any) => (n.c || 'Unknown').toUpperCase() === country);

          if (countryNodes.length === 0) {
            return {
              country,
              totalNodes: 0,
              onlineNodes: 0,
              syncingNodes: 0,
              offlineNodes: 0,
              totalStorageBytes: 0,
              totalCredits: 0,
              avgUptimeSeconds: 0,
              avgUptimeDays: 0,
              avgRamPercent: 0,
              avgCpuPercent: 0
            };
          }

          const online = countryNodes.filter((n: any) => n.s === 'online').length;
          const syncing = countryNodes.filter((n: any) => n.s === 'syncing').length;
          const offline = countryNodes.filter((n: any) => n.s === 'offline').length;
          const totalStorage = countryNodes.reduce((sum: number, n: any) => sum + (n.sc || 0), 0);
          const totalCredits = countryNodes.reduce((sum: number, n: any) => sum + (n.cr || 0), 0);
          const totalUptime = countryNodes.reduce((sum: number, n: any) => sum + (n.us || 0), 0);
          const totalRam = countryNodes.filter((n: any) => n.rp != null).reduce((sum: number, n: any) => sum + (n.rp || 0), 0);
          const ramCount = countryNodes.filter((n: any) => n.rp != null).length;
          const totalCpu = countryNodes.filter((n: any) => n.cpu != null).reduce((sum: number, n: any) => sum + (n.cpu || 0), 0);
          const cpuCount = countryNodes.filter((n: any) => n.cpu != null).length;

          return {
            country,
            totalNodes: countryNodes.length,
            onlineNodes: online,
            syncingNodes: syncing,
            offlineNodes: offline,
            totalStorageBytes: totalStorage,
            totalCredits: totalCredits,
            avgUptimeSeconds: countryNodes.length > 0 ? totalUptime / countryNodes.length : 0,
            avgUptimeDays: countryNodes.length > 0 ? Math.floor(totalUptime / countryNodes.length / 86400) : 0,
            avgRamPercent: ramCount > 0 ? totalRam / ramCount : 0,
            avgCpuPercent: cpuCount > 0 ? totalCpu / cpuCount : 0
          };
        });

        return {
          countries: countryStats
        };
      }

      case 'get_node_history': {
        // Calculate time range
        const endTime = Date.now();
        let startTime = endTime;
        if (args.days) {
          startTime = endTime - (args.days * 24 * 60 * 60 * 1000);
        } else {
          const hours = args.hours || 24;
          startTime = endTime - (hours * 60 * 60 * 1000);
        }

        let nodePubkey: string | null = null;

        // If pubkey or address provided, get that specific node's history
        if (args.pubkey || args.address) {
          const nodeResponse = await fetch(`${baseUrl}/api/ai/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              queryType: 'node',
              pubkey: args.pubkey,
              address: args.address
            }),
          });

          if (nodeResponse.ok) {
            const nodeData = await nodeResponse.json();
            nodePubkey = nodeData.node?.p || args.pubkey;
          }
        }

        // Get historical data
        const historyUrl = new URL('/api/history', baseUrl);
        if (nodePubkey) {
          historyUrl.searchParams.set('nodeId', nodePubkey);
        }
        historyUrl.searchParams.set('startTime', startTime.toString());
        historyUrl.searchParams.set('endTime', endTime.toString());

        const historyResponse = await fetch(historyUrl.toString(), {
          signal: AbortSignal.timeout(15000),
        });

        if (!historyResponse.ok) {
          return { error: 'Failed to fetch history' };
        }

        const historyData = await historyResponse.json();
        const snapshots = historyData.data || [];

        return {
          nodePubkey: nodePubkey || null,
          timeRange: {
            startTime,
            endTime,
            hours: (endTime - startTime) / (60 * 60 * 1000)
          },
          snapshotsCount: snapshots.length,
          snapshots: snapshots // Return raw data - AI can analyze it
        };
      }

      default:
      case 'get_country_data': {
        const response = await fetch(`${baseUrl}/api/ai/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queryType: 'country',
            country: args.country,
            countryCode: args.countryCode,
          }),
        });
        const data = await response.json();
        if (data.error) {
          return { error: data.error };
        }
        return data;
      }

      case 'get_country_history': {
        // Calculate time range
        const endTime = Date.now();
        let startTime = endTime;
        if (args.days) {
          startTime = endTime - (args.days * 24 * 60 * 60 * 1000);
        } else if (args.hours) {
          startTime = endTime - (args.hours * 60 * 60 * 1000);
        } else {
          // Default to 24 hours (changed from 7 days for faster queries)
          startTime = endTime - (24 * 60 * 60 * 1000);
        }

        const response = await fetch(`${baseUrl}/api/ai/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queryType: 'country-history',
            country: args.country,
            countryCode: args.countryCode,
            startTime,
            endTime,
          }),
        });
        const data = await response.json();
        if (data.error) {
          return { error: data.error };
        }
        return data;
      }

        return { error: `Unknown function: ${name}` };
    }
  } catch (error: any) {
    console.error(`[AI Chat] Function execution error:`, error);
    return { error: error?.message || 'Function execution failed' };
  }
}

export function formatNodesResult(nodes: any[], functionName: string, requestedFields?: string[]): any {
  // Build field mapping (data field -> output field)
  const allFields: Record<string, (n: any) => any> = {
    pubkey: (n) => n.p || n.pubkey,
    address: (n) => n.a || n.address,
    status: (n) => n.s || n.status,
    uptimeSeconds: (n) => n.us || n.uptime || 0,
    credits: (n) => n.cr || n.credits || 0,
    storageBytes: (n) => n.sc || n.storageCapacity || 0,
    cpuPercent: (n) => n.cpu ?? null,
    ramPercent: (n) => n.rp ?? null,
    country: (n) => n.c || 'Unknown',
  };

  // Select which fields to include
  const fieldsToUse = requestedFields && requestedFields.length > 0
    ? requestedFields.filter(f => f in allFields)
    : Object.keys(allFields); // All fields if none specified

  // Map nodes with only requested fields
  const formatted = nodes.map((n: any) => {
    const obj: any = {};
    for (const field of fieldsToUse) {
      obj[field] = allFields[field](n);
    }
    return obj;
  });

  return {
    totalCount: nodes.length,
    nodes: formatted,
  };
}

export function formatNodeDetails(node: any): any {
  return {
    pubkey: node.p || node.pubkey,
    address: node.a || node.address,
    status: node.s || node.status,
    version: node.v || node.version,
    uptimeSeconds: node.us || 0,
    uptimeDays: node.u || Math.floor((node.us || 0) / 86400),
    credits: node.cr || node.credits || 0,
    storageBytes: node.sc || node.storageCapacity || 0,
    cpuPercent: node.cpu,
    ramPercent: node.rp,
    country: node.c || 'Unknown',
    city: node.cy || '',
    createdAt: node.ca || node.createdAt || null
  };
}

// System prompt
export const systemPrompt = `You are an AI assistant for pGlobe, a real-time visualization platform for Xandeum's decentralized pNode network.

KNOWLEDGE BASE:

WHAT IS pGLOBE?
pGlobe is a real-time analytics and monitoring platform for the Xandeum pNode network. It provides comprehensive visibility into the decentralized storage layer that powers Solana dApps with scalable, affordable data storage. Users can monitor network health, track node performance, analyze storage distribution, and make informed decisions about staking or operating nodes.

WHAT IS XANDEUM?
Xandeum is a decentralized storage network built on Solana that provides scalable, cost-effective data storage for blockchain applications. It enables developers to store and retrieve large amounts of data off-chain while maintaining cryptographic proof and data availability guarantees. Xandeum uses a network of pNodes (Provider Nodes) to distribute data across the globe, ensuring redundancy, low latency access, and censorship resistance.

WHAT ARE pNODES?
Provider Nodes (pNodes) form a distributed storage network where each node contributes storage capacity and earns rewards (credits) for serving data to applications. They're the backbone of Xandeum's decentralized storage infrastructure. Each pNode:
- Runs Xandeum Pod software (various versions like 0.6.0, 0.7.0, 0.7.3, 0.7.4, etc.)
- Provides storage capacity to the network
- Earns credits based on performance, uptime, and data served
- Can be online, offline, or syncing
- Has a unique public key (pubkey) and network address (IP:port)
- Tracks metrics like CPU usage, RAM usage, uptime, storage capacity, peer count, etc.
- Stores data shards with erasure coding for redundancy
- Participates in proof-of-storage challenges to verify data availability

HOW DO pNODES EARN CREDITS?
- Credits are the reward mechanism for pNode operators
- Earned by storing data, serving data to applications, and maintaining high uptime
- Credits accumulate over time based on node performance
- Better performance (low latency, high uptime, more storage) = more credits
- Credits reset monthly (this is the reward cycle)
- Top performing nodes earn the most credits
- Credit earnings are also aggregated and tracked at the country and regional level, allowing for cross-region performance comparisons.

XANDEUM NETWORK ARCHITECTURE:
- Built on Solana blockchain (devnet and mainnet)
- Uses pRPC (pNode RPC) protocol for communication between nodes
- Nodes communicate via gossip protocol to discover peers and sync state
- Network snapshots are taken every 10 minutes for historical tracking and analytics
- Nodes are registered on-chain via Solana program (stores pubkey, stake, metadata)
- Data is distributed using erasure coding (similar to RAID) for redundancy
- Clients can retrieve data from any available node holding the shard
- Network uses DHT (Distributed Hash Table) for content routing
- Historical Data: The network tracks snapshots for individual pNodes, entire countries, and the total network, enabling deep trend analysis.
- Resource Reporting Warning: Most pNode operators keep their pRPC (pNode RPC) interface private for security. Detailed metrics like CPU, RAM, and internal Uptime are only available for a small subset of nodes (~10-15 out of 135+) that have public pRPC. Absence of these metrics is normal and expected for security-conscious operators.

WEBSITE PAGES & FEATURES:
1. Overview (/): Main dashboard with interactive 3D globe, network statistics, health score, top rankings, and node list
2. Nodes (/nodes): Detailed table view of all pNodes with filtering, sorting, and search
3. Analytics (/analytics): Deep dive into network metrics with charts (performance trends, resource utilization, latency distribution, geographic metrics)
4. Scan (/scan): Find nodes nearest to your location or a specific IP address, measure latency, view distance-based rankings
5. Regions (/regions/[country]): Country-specific analytics showing all nodes in a country with aggregate statistics
6. Node Details (/nodes/[id]): Individual node page with detailed metrics, historical performance charts, location map
7. Help (/help): Documentation, FAQs, and guides

KEY METRICS & DATA FIELDS:
- Status: online (fully operational), offline (not responding), syncing (catching up with blockchain state)
- Uptime: Time node has been online continuously (in seconds, also shown as days)
- Credits: Rewards earned by the node (resets monthly at start of new reward cycle)
- Storage Capacity (sc): Total storage allocated in bytes (convert to TB/GB/MB for readability)
- RAM Usage (rp): RAM usage percentage (0-100, helps identify resource bottlenecks)
- CPU Usage (cpu): CPU usage percentage (0-100, high CPU may indicate heavy processing)
- Peer Count (pc): Number of other nodes this node knows about (indicates network connectivity)
- Active Streams (as): Current active network connections (data transfer activity)
- Packets Sent/Received: Network traffic metrics showing data activity
- Location: Geographic location (city, country, country code, lat/lon coordinates)
- Version: Pod software version (e.g., 0.7.3, newer versions may have bug fixes or features)
- Address: Network address in format IP:port (e.g., 192.168.1.1:9001)
- Pubkey: Unique public key identifier (full base58 string, used for on-chain registration)
- Latency: Round-trip time to reach the node (measured from user's location, in milliseconds)
- Created At: The timestamp when the pNode was first indexed by the pGlobe database. IMPORTANT: This reflects database discovery time, not necessarily the official network join time, and should be treated as an estimate.

NETWORK HEALTH & PERFORMANCE INSIGHTS:
- Network Health Score: Calculated from uptime percentage, online node ratio, and version distribution
- High health (>80%): Most nodes online, good uptime, recent software versions
- Medium health (50-80%): Some offline nodes, mixed performance
- Low health (<50%): Many offline nodes, poor uptime, outdated software
- Version distribution matters: Nodes on latest versions typically perform better
- Geographic distribution: Well-distributed network = better redundancy and latency
- Storage distribution: Total network capacity indicates growth and adoption
- Regional Health: Every country and region has its own specific Health Score calculated from its local node performance and version distribution.

INTERPRETING METRICS:
- High RAM/CPU usage (>80%): Node may be under heavy load or need more resources
- Low peer count (<10): Connectivity issues or isolated node
- Zero active streams: Node may not be serving data actively
- Syncing status: Node is catching up with network state (temporary)
- Offline status: Node is unreachable (may be down or network issues)
- Long uptime (>30 days): Reliable, stable node operation
- Short uptime (<1 day): Recently restarted or new node

GEOGRAPHIC & LATENCY CONSIDERATIONS:
- Lower latency = faster data access (aim for <100ms for good performance)
- Nodes in same country/region = lower latency for local users
- Data centers often have better uptime but may be more centralized
- Residential nodes provide better geographic distribution
- Distance affects latency: ~1ms per 100km as rough estimate
- Same-country nodes typically have <50ms latency

CREDIT ECONOMICS & NODE PERFORMANCE:
- Credits are a measure of node contribution to the network
- High credit nodes are typically high-performing (good uptime, fast, reliable)
- Credit changes over time show node activity trends
- Comparing credit earnings helps identify best-performing nodes
- Regional competition: Nodes in less-served regions may earn more
- Storage capacity affects earning potential: more storage = more opportunities

COMMON ANALYSIS PATTERNS:
- Top performers: Filter by high credits + high uptime + online status
- Regional coverage: Compare countries by total nodes and online percentage
- Version adoption: Check version distribution to see network upgrades
- Network growth: Use historical data to track node count over time
- Performance trends: Historical charts show CPU, RAM, uptime patterns
- Stability analysis: Look for nodes with consistent uptime and low resource usage

IMPORTANT:
- You MUST use the provided functions to get CURRENT data. You do NOT have real-time pNode data in your context - you MUST call functions to retrieve it.
- However, you CAN answer general questions about what pGlobe is, what pNodes are, how the system works, etc. using the knowledge above WITHOUT calling functions.
- For simple questions that don't require real-time data, you can think for yourself and provide direct answers. Only call functions when you need CURRENT, REAL-TIME data about specific pNodes, network statistics, or user location.
- When analyzing data, provide INSIGHTS and CONTEXT, not just raw numbers. Explain what the data means.
- Be helpful and educational: help users understand the network, not just query it.

TERMINOLOGY:
- Always refer to nodes as "pNode" or "pNodes" (not just "node" or "nodes")

WHEN TO USE FUNCTIONS:

DECISION TABLE - Pick the RIGHT function:

┌─────────────────────────────────────┬──────────────────────────────┐
│ QUESTION TYPE                       │ USE THIS FUNCTION            │
├─────────────────────────────────────┼──────────────────────────────┤
│ "How many nodes have X storage?"    │ filter_nodes (minStorageBytes) │
│ "Nodes with more than 500GB"        │ filter_nodes (500*1073741824)│
│ "Nodes in Nigeria/US/France"        │ filter_nodes (country="NG")  │
│ "Online/offline/syncing nodes"      │ filter_nodes (status)        │
│ "Nodes with high CPU/RAM"           │ filter_nodes (min/maxCpu/Ram)│
│ "Nodes with X credits (current)"    │ filter_nodes (minCredits)    │
│ "Nodes with long uptime"            │ filter_nodes (minUptimeSeconds) │
│ "Nodes with >2h uptime"             │ filter_nodes (minUptimeSeconds=7200) │
│ "Nodes with <2h uptime"             │ filter_nodes (maxUptimeSeconds=7200) │
│ "% of nodes with X uptime"          │ filter_nodes TWICE (with/without threshold), then calculate │
├─────────────────────────────────────┼──────────────────────────────┤
│ "Nodes that EARNED credits"         │ get_credits_change (timeRange)│
│ "Active earning nodes last hour"    │ get_credits_change (1h)      │
├─────────────────────────────────────┼──────────────────────────────┤
│ "Total nodes in network"            │ get_network_stats            │
│ "Network health score"              │ get_network_stats            │
│ "Total network storage"             │ get_network_stats            │
│ "Country distribution"              │ get_network_stats            │
├─────────────────────────────────────┼──────────────────────────────┤
│ "Info about node X (pubkey/IP)"     │ get_node_details             │
│ "What is node ABC123's status?"     │ get_node_details (pubkey)    │
├─────────────────────────────────────┼──────────────────────────────┤
│ "Node X performance over time"      │ get_node_history (pubkey)    │
│ "Network trends last 24h"           │ get_node_history (no pubkey) │
├─────────────────────────────────────┼──────────────────────────────┤
│ "Nigeria/US/France stats"           │ get_country_data (country)   │
│ "How many nodes in [country]?"      │ get_country_data             │
│ "Country health score"              │ get_country_data             │
├─────────────────────────────────────┼──────────────────────────────┤
│ "Country performance over time"     │ get_country_history          │
│ "[Country] trends last week"        │ get_country_history (days=7) │
├─────────────────────────────────────┼──────────────────────────────┤
│ "Compare Nigeria vs France"         │ compare_countries            │
│ "Which country has more nodes?"     │ compare_countries            │
├─────────────────────────────────────┼──────────────────────────────┤
│ "Compare node A vs node B"          │ compare_nodes                │
├─────────────────────────────────────┼──────────────────────────────┤
│ "Nodes near me/my location"         │ get_user_location + find_closest_nodes │
│ "Closest nodes to IP X"             │ find_closest_nodes (ip)      │
│ "Where am I?"                       │ get_user_location            │
│ "Where is IP X?"                    │ get_location_for_ip          │
└─────────────────────────────────────┴──────────────────────────────┘

CRITICAL RULES:
1. Storage questions → filter_nodes (minStorageBytes in BYTES: GB * 1073741824)
2. Credit EARNING questions → get_credits_change (requires timeRange)
3. Current credit BALANCE → filter_nodes (minCredits)
4. NEVER use get_credits_change for storage, counts, or current balances
5. Uptime in SECONDS: 1min=60, 1h=3600, 2h=7200, 1d=86400, 7d=604800
6. For "% with X uptime": get total count, then filter with threshold, calculate ratio

COUNTRY CODES: IN=India, US=United States, NG=Nigeria, FR=France, DE=Germany, GB=United Kingdom, CA=Canada, AU=Australia, BR=Brazil, JP=Japan, KR=Korea, CN=China, RU=Russia, ZA=South Africa, EG=Egypt, KE=Kenya, GH=Ghana

COMBINING FUNCTIONS FOR COMPLEX QUESTIONS:
You can combine multiple functions to answer complex questions. Examples:

Filtering & Finding:
- "Top 10 nodes by credits" → Use filter_nodes (with optional country/status filters), then sort by credits (cr field) and take top 10
- "Find nodes with high CPU usage" → Use filter_nodes with minCpuPercent=80, then analyze results
- "Nodes in Africa with low RAM usage" → Use filter_nodes with continent="africa" and maxRamPercent=50
- "Online nodes in Nigeria" → Use filter_nodes with country="NG" and status="online"
- "Nodes with more than 500GB storage" → Use filter_nodes with minStorageBytes=536870912000 (500*1073741824). DO NOT use get_credits_change for storage questions!
- "Nodes with at least 1TB storage" → Use filter_nodes with minStorageBytes=1099511627776 (1024*1073741824)

Node Details & History:
- "How well has this node performed in past 5 hours" → Use get_node_history with hours=5, then analyze the snapshots (calculate averages, status changes, etc.)
- "Node health score" → Use get_node_details, then calculate score yourself based on status, uptime, resources, credits
- "Compare these two nodes" → Use compare_nodes with pubkeys or addresses

Network & Trends:
- "Network trends in last 24 hours" → Use get_node_history (without pubkey) to get network-wide history, then analyze trends
- "Overall network statistics" → Use get_network_stats
- "Nodes that earned credits today" → Use get_credits_change with timeRange="24h"

Country & Regional:
- "What are the statistics for Nigeria?" → Use get_country_data with country="Nigeria" or country="NG"
- "What's the health score of Nigeria?" → Use get_country_data with country="Nigeria". It returns a specific healthScore.
- "Show me Nigeria's network performance over the past week" → Use get_country_history with country="Nigeria" and days=7, then analyze trends
- "How has France's network activity changed?" → Use get_country_history with country="France", then analyze the historical data points
- "Rank countries by performance" → Use compare_countries with all countries, then sort/rank the results yourself
- "Rank countries by uptime" → Use compare_countries with multiple countries, then sort by avgUptime yourself

Location & Proximity:
- "Find nodes near me" → Use get_user_location, then find_closest_nodes with the coordinates
- "Nodes closest to this IP" → Use find_closest_nodes with ip parameter
- "Where is this IP located?" → Use get_location_for_ip
- "Which nodes joined the database today?" → Use filter_nodes (with optional status filters), then check the createdAt (ca) field in the result to find the most recent entries.

Credit Analysis:
- "Nodes that earned more than 100 credits in the last 7 days" → Use get_credits_change with timeRange="7d" and minCreditsEarned=100

IMPORTANT: Don't ask for separate ranking/performance functions - combine the basic functions and do the analysis yourself!

QUERY INTERPRETATION:
- "using up to X%", "using X% or more", "at least X%", "above X%" → use minRamPercent or minCpuPercent (>=)
- "using less than X%", "below X%", "under X%" → use maxRamPercent or maxCpuPercent (<)
- When user asks about high usage (50%+), they usually mean "at least" that amount, use min filters
- When ambiguous, interpret in the way that gives the most useful/interesting answer

RESPONSE GUIDELINES:
- Be direct and concise - answer questions immediately
- Use plain text only - ABSOLUTELY NO markdown formatting whatsoever
- NEVER use ** for bold, * for italic, # for headers, - for bullets, or any other markdown syntax
- Write in plain, natural language without any formatting symbols
- If listing items, use simple numbered lists like "1. Item" or just separate with line breaks
- When listing pNodes, format them readably:
  "Address: 192.168.1.1:9001
   Pubkey: [full pubkey]
   Status: online
   Uptime: 5 days
   Credits: 10,000
   Storage: 1.2 TB
   Location: Port Harcourt, Nigeria"
- Convert storage bytes to TB/GB/MB
- Convert uptime seconds to days/hours
- Show country names instead of codes when possible
- Calculate averages, totals, and other metrics from function results
- For "less than X credits" queries, use get_credits_change with maxCreditsEarned parameter
- If asked about something not related to pGlobe, politely redirect`;

// Helper function to call any OpenAI-compatible API
export async function callOpenAICompatible(
  apiUrl: string,
  apiKey: string,
  model: string,
  messages: any[],
  provider: string,
  useTools: boolean = true
): Promise<{ success: boolean; response?: Response; error?: any }> {
  try {
    const body: any = {
      model,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    };

    // Only include tools if useTools is true (some providers may not support it)
    if (useTools) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    // Use longer timeout for reasoning models (they can take much longer)
    const timeoutMs = model.includes('reasoner') || model.includes('reasoning') ? 120000 : 60000; // 120s for reasoning, 60s for regular

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.ok) {
        return { success: true, response };
      } else {
        const errorData = await response.text().catch(() => 'Unable to read error');
        console.error(`[${provider}] API Error (${response.status}):`, errorData);
        return { success: false, error: { status: response.status, data: errorData } };
      }
    } catch (fetchError: any) {
      // Check for timeout errors specifically
      if (fetchError?.name === 'TimeoutError' || fetchError?.name === 'AbortError' || fetchError?.message?.includes('timeout')) {
        console.error(`[${provider}] Request timeout for model ${model} (${timeoutMs}ms)`);
        return {
          success: false,
          error: {
            type: 'timeout',
            message: `Request timed out after ${timeoutMs}ms. The ${model} model may need more time to process.`,
            timeout: timeoutMs
          }
        };
      }
      throw fetchError; // Re-throw if not a timeout
    }
  } catch (error: any) {
    return { success: false, error: error };
  }
}

// Process response and handle tool calls
export async function processResponse(
  data: any,
  messages: any[],
  baseUrl: string,
  provider: string,
  clientIp?: string,
  onStatusUpdate?: (status: string) => void,
  executedFunctions?: string[] // Track executed function names
): Promise<{ hasToolCalls: boolean; finalResponse?: string; updatedMessages: any[]; executedFunctions?: string[] }> {
  if (!data.choices || !data.choices[0]) {
    throw new Error(`Invalid response from ${provider}`);
  }

  const choice = data.choices[0];
  const message = choice.message;

  // Check for tool calls
  if (message.tool_calls && message.tool_calls.length > 0) {
    console.log(`[${provider}] Executing ${message.tool_calls.length} function call(s)`);

    const updatedMessages = [...messages, message];

    // Execute all tool calls
    const toolResults: any[] = [];

    for (const toolCall of message.tool_calls) {
      try {
        const { name, arguments: args } = toolCall.function;
        let parsedArgs: any;
        try {
          parsedArgs = JSON.parse(args);
        } catch (parseError: any) {
          console.error(`[${provider}] Failed to parse function arguments for ${name}:`, parseError?.message);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: name,
            content: JSON.stringify({ error: `Invalid function arguments: ${parseError?.message}` })
          });
          continue;
        }

        if (onStatusUpdate) {
          onStatusUpdate(`Executing ${name}...`);
        }
        // Track executed function
        if (executedFunctions) {
          executedFunctions.push(name);
        }
        const result = await executeFunction(name, parsedArgs, baseUrl, clientIp, onStatusUpdate);

        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: name,
          content: JSON.stringify(result)
        });
      } catch (error: any) {
        const functionName = toolCall?.function?.name || 'unknown';
        const toolCallId = toolCall?.id || 'unknown';
        console.error(`[${provider}] Error executing function ${functionName}:`, error?.message, error?.stack);
        toolResults.push({
          tool_call_id: toolCallId,
          role: 'tool',
          name: functionName,
          content: JSON.stringify({ error: `Function execution failed: ${error?.message || 'Unknown error'}` })
        });
      }
    }

    updatedMessages.push(...toolResults);

    return { hasToolCalls: true, updatedMessages, executedFunctions };
  }

  // No tool calls - we have a text response
  if (message.content) {
    console.log(`[${provider}] Text response received (no tool calls). Length: ${message.content.length}`);
    return { hasToolCalls: false, finalResponse: message.content, updatedMessages: messages, executedFunctions };
  }

  console.error(`[${provider}] No content and no tool calls in response:`, JSON.stringify(message));
  throw new Error(`No content in response from ${provider}`);
}

export async function POST(request: Request) {
  try {
    if (!DEEPSEEK_API_KEY) {
      return NextResponse.json(
        { error: 'DeepSeek API key not configured. Please add DEEPSEEK_API_KEY to .env.local' },
        { status: 500 }
      );
    }

    const { message, conversationHistory, clientIp, onStatusUpdate } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const baseUrl = request.url.split('/api/ai/chat')[0];

    // Build messages array
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.forEach((msg: { role: string; content: string }) => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
      });
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    // Use DeepSeek reasoning model (R1) as primary, fall back to chat
    const models = ['deepseek-reasoner', 'deepseek-chat'];
    let maxIterations = 5;
    let iteration = 0;
    let finalResponse = '';
    const allExecutedFunctions: string[] = []; // Track all functions executed across iterations

    while (iteration < maxIterations) {
      iteration++;
      console.log(`[DeepSeek] Iteration ${iteration}, messages: ${messages.length}`);

      let response: Response | null = null;
      let lastError: any = null;

      // Try each model with tools and system prompt
      for (const model of models) {
        try {
          console.log(`[DeepSeek] Trying model: ${model}`);

          const result = await callOpenAICompatible(
            'https://api.deepseek.com/v1/chat/completions',
            DEEPSEEK_API_KEY,
            model,
            messages, // Include system prompt - AI needs context
            'DeepSeek',
            true // with tools
          );

          if (result.success && result.response) {
            response = result.response;
            console.log(`[DeepSeek] Success with model: ${model}`);
            break;
          } else {
            lastError = result.error;
            console.error(`[DeepSeek] Model ${model} failed:`, JSON.stringify(result.error, null, 2));
          }
        } catch (error: any) {
          console.error(`[DeepSeek] Model ${model} exception:`, error?.message, error?.stack);
          lastError = error;
        }
      }

      if (!response) {
        const errorDetails = lastError?.data || lastError?.message || JSON.stringify(lastError);
        console.error('[DeepSeek] All models failed. Last error:', errorDetails);
        return NextResponse.json(
          {
            error: 'Failed to get AI response from DeepSeek',
            details: typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails),
            suggestion: 'Please check your DeepSeek API key and account status'
          },
          { status: 500 }
        );
      }

      const data = await response.json();

      // Status update callback - use provided callback or default to console log
      const statusCallback = onStatusUpdate || ((status: string) => {
        console.log(`[AI Chat] Status: ${status}`);
      });

      const result = await processResponse(data, messages, baseUrl, 'DeepSeek', clientIp, statusCallback, allExecutedFunctions);

      if (result.hasToolCalls) {
        messages.length = 0; // Clear array
        messages.push(...result.updatedMessages);
        continue; // Continue loop with updated messages
      }

      if (result.finalResponse) {
        finalResponse = result.finalResponse;
        break; // Success!
      }
    }

    if (!finalResponse) {
      return NextResponse.json(
        { error: 'AI did not produce a response' },
        { status: 500 }
      );
    }

    // Strip markdown formatting from the response
    const cleanResponse = finalResponse
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold **text**
      .replace(/\*(.*?)\*/g, '$1') // Remove italic *text*
      .replace(/#{1,6}\s+/g, '') // Remove headers # ## ###
      .replace(/^-\s+/gm, '') // Remove bullet points at start of lines
      .replace(/^\d+\.\s+/gm, '') // Remove numbered lists
      .trim();

    // Return the response with executed functions for streaming status updates
    return NextResponse.json({
      message: cleanResponse,
      executedFunctions: allExecutedFunctions,
      iterations: iteration
    });

  } catch (error: any) {
    console.error('[DeepSeek] Exception:', error);
    console.error('[DeepSeek] Exception stack:', error?.stack);
    console.error('[DeepSeek] Exception details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return NextResponse.json(
      {
        error: 'Failed to process request',
        message: error?.message || 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}
