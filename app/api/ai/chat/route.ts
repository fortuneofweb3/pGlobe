import { NextResponse } from 'next/server';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

if (!DEEPSEEK_API_KEY) {
  console.warn('[AI Chat] DEEPSEEK_API_KEY not found in environment variables');
} else {
  console.log(`[AI Chat] DeepSeek API key loaded (${DEEPSEEK_API_KEY.slice(0, 8)}...${DEEPSEEK_API_KEY.slice(-4)})`);
}

// Define tools/functions the AI can call (OpenAI format)
const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'filter_nodes',
      description: 'Filter pNodes based on various criteria like country, status, RAM usage, CPU usage, credits, storage, uptime, etc.',
      parameters: {
        type: 'object',
        properties: {
          country: {
            type: 'string',
            description: 'Country code(s) to filter by. Can be single code like "NG" or comma-separated like "NG,FR,DE"'
          },
          status: {
            type: 'string',
            enum: ['online', 'offline', 'syncing'],
            description: 'Filter by node status'
          },
          minRamPercent: { type: 'number', description: 'Minimum RAM usage percentage (0-100)' },
          maxRamPercent: { type: 'number', description: 'Maximum RAM usage percentage (0-100)' },
          minCpuPercent: { type: 'number', description: 'Minimum CPU usage percentage (0-100)' },
          maxCpuPercent: { type: 'number', description: 'Maximum CPU usage percentage (0-100)' },
          minCredits: { type: 'number', description: 'Minimum credits threshold' },
          minStorageBytes: { type: 'number', description: 'Minimum storage capacity in bytes' },
          minUptimeDays: { type: 'number', description: 'Minimum uptime in days' },
          continent: {
            type: 'string',
            enum: ['africa', 'europe', 'asia', 'north_america', 'south_america', 'oceania'],
            description: 'Filter by continent'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_node_details',
      description: 'Get detailed information about a specific pNode by its public key or address',
      parameters: {
        type: 'object',
        properties: {
          pubkey: { type: 'string', description: 'The public key of the pNode' },
          address: { type: 'string', description: 'The IP address and port of the pNode (e.g., "192.168.1.1:9001")' }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_credits_change',
      description: 'Get pNodes that earned credits over a specified time period',
      parameters: {
        type: 'object',
        properties: {
          minCreditsEarned: { type: 'number', description: 'Minimum credits earned threshold' },
          maxCreditsEarned: { type: 'number', description: 'Maximum credits earned threshold (for "less than" queries)' },
          timeRange: {
            type: 'string',
            enum: ['1h', '24h', '7d'],
            description: 'Time range to check credit changes'
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
      description: 'Get overall network statistics including total nodes, online count, storage, and country distribution',
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
      description: 'Get the user\'s IP address and geographic location (city, country, coordinates)',
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
      description: 'Get geographic location (city, country, coordinates) for a specific IP address',
      parameters: {
        type: 'object',
        properties: {
          ip: {
            type: 'string',
            description: 'IP address to look up (e.g., "192.168.1.1")'
          }
        },
        required: ['ip']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'find_closest_nodes',
      description: 'Find the closest pNodes to a specific location (by IP address or coordinates). Returns nodes sorted by distance.',
      parameters: {
        type: 'object',
        properties: {
          ip: {
            type: 'string',
            description: 'IP address to find closest nodes to (e.g., "192.168.1.1")'
          },
          lat: {
            type: 'number',
            description: 'Latitude coordinate (-90 to 90)'
          },
          lon: {
            type: 'number',
            description: 'Longitude coordinate (-180 to 180)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of closest nodes to return (default: 20)'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'compare_nodes',
      description: 'Compare specific pNodes by their metrics (uptime, credits, storage, RAM, CPU, etc.). Provide pubkeys or addresses.',
      parameters: {
        type: 'object',
        properties: {
          pubkeys: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of pNode public keys to compare'
          },
          addresses: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of pNode addresses (IP:port) to compare'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'compare_countries',
      description: 'Compare countries by aggregate pNode statistics (total nodes, online count, average uptime, total storage, total credits, etc.)',
      parameters: {
        type: 'object',
        properties: {
          countries: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of country codes to compare (e.g., ["US", "FR", "DE"])'
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
      description: 'Get historical data for a specific node or the entire network over a time period. Returns snapshots with status, CPU, RAM, uptime, credits, etc. Use this to analyze performance over time.',
      parameters: {
        type: 'object',
        properties: {
          pubkey: { type: 'string', description: 'Optional: The public key of a specific pNode to get history for' },
          address: { type: 'string', description: 'Optional: The IP address and port of a specific pNode' },
          hours: { type: 'number', description: 'Number of hours to look back (default: 24)' },
          days: { type: 'number', description: 'Number of days to look back (alternative to hours)' }
        }
      }
    }
  }
];

// Continent to country code mapping
const continentCountries: Record<string, string[]> = {
  africa: ['DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CM', 'CV', 'CF', 'TD', 'KM', 'CG', 'CD', 'CI', 'DJ', 'EG', 'GQ', 'ER', 'ET', 'GA', 'GM', 'GH', 'GN', 'GW', 'KE', 'LS', 'LR', 'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG', 'RW', 'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'SZ', 'TZ', 'TG', 'TN', 'UG', 'ZM', 'ZW'],
  europe: ['AL', 'AD', 'AT', 'BY', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'XK', 'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'RU', 'SM', 'RS', 'SK', 'SI', 'ES', 'SE', 'CH', 'UA', 'GB', 'VA'],
  asia: ['AF', 'AM', 'AZ', 'BH', 'BD', 'BT', 'BN', 'KH', 'CN', 'GE', 'IN', 'ID', 'IR', 'IQ', 'IL', 'JP', 'JO', 'KZ', 'KW', 'KG', 'LA', 'LB', 'MY', 'MV', 'MN', 'MM', 'NP', 'KP', 'OM', 'PK', 'PS', 'PH', 'QA', 'SA', 'SG', 'KR', 'LK', 'SY', 'TW', 'TJ', 'TH', 'TL', 'TR', 'TM', 'AE', 'UZ', 'VN', 'YE'],
  north_america: ['AG', 'BS', 'BB', 'BZ', 'CA', 'CR', 'CU', 'DM', 'DO', 'SV', 'GD', 'GT', 'HT', 'HN', 'JM', 'MX', 'NI', 'PA', 'KN', 'LC', 'VC', 'TT', 'US'],
  south_america: ['AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'GY', 'PY', 'PE', 'SR', 'UY', 'VE'],
  oceania: ['AU', 'FJ', 'KI', 'MH', 'FM', 'NR', 'NZ', 'PW', 'PG', 'WS', 'SB', 'TO', 'TV', 'VU']
};

// Execute a function call
async function executeFunction(name: string, args: any, baseUrl: string, clientIp?: string): Promise<any> {
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
        if (args.minUptimeDays !== undefined) filters.minUptimeDays = args.minUptimeDays;
        
        const response = await fetch(`${baseUrl}/api/ai/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queryType: 'nodes', filters }),
        });
        
        if (response.ok) {
          const data = await response.json();
          return formatNodesResult(data.nodes || [], name);
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
            count: nodes.length,
            timeRange: args.timeRange || '1h',
            nodes: nodes.slice(0, 50).map((n: any) => ({
              pubkey: n.pubkey,
              address: n.address,
              creditsEarned: n.creditsEarned,
              startCredits: n.startCredits,
              endCredits: n.endCredits
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
        } else if (args.lat !== undefined && args.lon !== undefined) {
          lat = args.lat;
          lon = args.lon;
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
              country: node.locationData?.countryCode || node.locationData?.country || 'Unknown',
              city: node.locationData?.city || '',
              distanceKm, // No rounding to match scan page exactly
              distanceMi: distanceKm * 0.621371 // Convert to miles (same as scan page)
            };
          })
          .sort((a: any, b: any) => (a.distanceKm || Infinity) - (b.distanceKm || Infinity))
          .slice(0, args.limit || 20);
        
        return {
          location: { lat, lon },
          count: nodesWithDistance.length,
          nodes: nodesWithDistance
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
        
        // Find matching nodes
        const matchedNodes = allNodes.filter((n: any) => {
          const nodePubkey = n.p || n.pubkey;
          const nodeAddress = n.a || n.address;
          
          return pubkeys.some((pk: string) => nodePubkey === pk) ||
                 addresses.some((addr: string) => nodeAddress === addr);
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
        return { error: `Unknown function: ${name}` };
    }
  } catch (error: any) {
    console.error(`[AI Chat] Function execution error:`, error);
    return { error: error?.message || 'Function execution failed' };
  }
}

function formatNodesResult(nodes: any[], functionName: string): any {
  const formatted = nodes.slice(0, 100).map((n: any) => ({
    pubkey: n.p || n.pubkey,
    address: n.a || n.address,
    status: n.s || n.status,
    uptimeSeconds: n.us || 0,
    uptimeDays: n.u || Math.floor((n.us || 0) / 86400),
    credits: n.cr || n.credits || 0,
    storageBytes: n.sc || n.storageCapacity || 0,
    cpuPercent: n.cpu,
    ramPercent: n.rp,
    country: n.c || 'Unknown',
    city: n.cy || ''
  }));
  
  return {
    count: nodes.length,
    nodes: formatted,
    hasMore: nodes.length > 100
  };
}

function formatNodeDetails(node: any): any {
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
    city: node.cy || ''
  };
}

// System prompt
const systemPrompt = `You are an AI assistant for pGlobe, a real-time visualization platform for Xandeum's decentralized pNode network.

KNOWLEDGE BASE:

WHAT IS pGLOBE?
pGlobe is a real-time analytics and monitoring platform for the Xandeum pNode network. It provides comprehensive visibility into the decentralized storage layer that powers Solana dApps with scalable, affordable data storage. Users can monitor network health, track node performance, analyze storage distribution, and make informed decisions about staking or operating nodes.

WHAT ARE pNODES?
Provider Nodes (pNodes) form a distributed storage network where each node contributes storage capacity and earns rewards (credits) for serving data to applications. They're the backbone of Xandeum's decentralized storage infrastructure. Each pNode:
- Runs Xandeum Pod software (various versions like 0.6.0, 0.7.0, 0.7.3, etc.)
- Provides storage capacity to the network
- Earns credits based on performance and uptime
- Can be online, offline, or syncing
- Has a unique public key (pubkey) and network address (IP:port)
- Tracks metrics like CPU usage, RAM usage, uptime, storage capacity, peer count, etc.

XANDEUM NETWORK ARCHITECTURE:
- Built on Solana blockchain (devnet and mainnet)
- Uses pRPC (pNode RPC) protocol for communication
- Nodes communicate via gossip protocol
- Network snapshots are taken every 10 minutes for historical tracking
- Nodes are registered on-chain via Solana program

WEBSITE PAGES & FEATURES:
1. Overview (/): Main dashboard with interactive 3D globe, network statistics, health score, top rankings, and node list
2. Nodes (/nodes): Detailed table view of all pNodes with filtering, sorting, and search
3. Analytics (/analytics): Deep dive into network metrics with charts (performance trends, resource utilization, latency distribution, geographic metrics)
4. Scan (/scan): Find nodes nearest to your location or a specific IP address, measure latency, view distance-based rankings
5. Help (/help): Documentation, FAQs, and guides

KEY METRICS & DATA FIELDS:
- Status: online (fully operational), offline (not responding), syncing (catching up)
- Uptime: Time node has been online (in seconds, also shown as days)
- Credits: Rewards earned by the node (resets monthly)
- Storage Capacity (sc): Total storage allocated in bytes (convert to TB/GB/MB)
- RAM Usage (rp): RAM usage percentage (0-100)
- CPU Usage (cpu): CPU usage percentage (0-100)
- Peer Count (pc): Number of other nodes this node knows about
- Active Streams (as): Current active network connections
- Location: Geographic location (city, country, country code, lat/lon coordinates)
- Version: Pod software version (e.g., 0.7.3)
- Address: Network address in format IP:port (e.g., 192.168.1.1:9001)
- Pubkey: Unique public key identifier (full base58 string)

IMPORTANT: 
- You MUST use the provided functions to get CURRENT data. You do NOT have real-time pNode data in your context - you MUST call functions to retrieve it.
- However, you CAN answer general questions about what pGlobe is, what pNodes are, how the system works, etc. using the knowledge above WITHOUT calling functions.
- For simple questions that don't require real-time data, you can think for yourself and provide direct answers. Only call functions when you need CURRENT, REAL-TIME data about specific pNodes, network statistics, or user location.

TERMINOLOGY:
- Always refer to nodes as "pNode" or "pNodes" (not just "node" or "nodes")

WHEN TO USE FUNCTIONS:
- Questions about pNodes in a country/continent → call filter_nodes with country or continent parameter
- Questions about specific pNode → call get_node_details  
- Questions about network stats/totals → call get_network_stats
- Questions about credit earnings over time → call get_credits_change
- Questions about user's location/IP → call get_user_location
- Questions about location for an IP address → call get_location_for_ip
- Questions about closest nodes to a location → call find_closest_nodes (can use IP or coordinates)
- Questions comparing specific pNodes → call compare_nodes (provide pubkeys or addresses)
- Questions comparing countries → call compare_countries (provide country codes)
- Questions about historical data/performance over time → call get_node_history (for a specific node or network-wide)
- Country codes: IN=India, US=United States, NG=Nigeria, FR=France, DE=Germany, etc.

COMBINING FUNCTIONS FOR COMPLEX QUESTIONS:
You can combine multiple functions to answer complex questions. Examples:
- "Rank countries by performance" → Use compare_countries with all countries, then sort/rank the results yourself
- "Top 10 nodes by credits" → Use filter_nodes (with optional country/status filters), then sort by credits (cr field) and take top 10
- "How well has this node performed in past 5 hours" → Use get_node_history with hours=5, then analyze the snapshots (calculate averages, status changes, etc.)
- "Find nodes with high CPU usage" → Use filter_nodes with minCpuPercent=80, then analyze results
- "Network trends in last 24 hours" → Use get_node_history (without pubkey) to get network-wide history, then analyze trends
- "Node health score" → Use get_node_details, then calculate score yourself based on status, uptime, resources, credits
- "Rank countries by uptime" → Use compare_countries with multiple countries, then sort by avgUptime yourself

IMPORTANT: Don't ask for separate ranking/performance functions - combine the basic functions and do the analysis yourself!

QUERY INTERPRETATION:
- "using up to X%", "using X% or more", "at least X%", "above X%" → use minRamPercent or minCpuPercent (>=)
- "using less than X%", "below X%", "under X%" → use maxRamPercent or maxCpuPercent (<)
- When user asks about high usage (50%+), they usually mean "at least" that amount, use min filters
- When ambiguous, interpret in the way that gives the most useful/interesting answer

RESPONSE GUIDELINES:
- Be direct and concise - answer questions immediately
- Use plain text only - NO markdown formatting (no **, no *, no #, no bullet points with -)
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
async function callOpenAICompatible(
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
async function processResponse(
  data: any,
  messages: any[],
  baseUrl: string,
  provider: string,
  clientIp?: string
): Promise<{ hasToolCalls: boolean; finalResponse?: string; updatedMessages: any[] }> {
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
        
        const result = await executeFunction(name, parsedArgs, baseUrl, clientIp);
        
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
    
    return { hasToolCalls: true, updatedMessages };
  }
  
  // No tool calls - we have a text response
  if (message.content) {
    console.log(`[${provider}] Text response received (no tool calls). Length: ${message.content.length}`);
    return { hasToolCalls: false, finalResponse: message.content, updatedMessages: messages };
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

    const { message, conversationHistory, clientIp } = await request.json();

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
      
      const result = await processResponse(data, messages, baseUrl, 'DeepSeek', clientIp);
      
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

    return NextResponse.json({ message: finalResponse });

  } catch (error: any) {
    console.error('[DeepSeek] Exception:', error);
    return NextResponse.json(
      { error: 'Failed to process request', message: error?.message },
      { status: 500 }
    );
  }
}
