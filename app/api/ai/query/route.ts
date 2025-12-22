/**
 * AI Query Endpoint - Returns filtered node data, individual nodes, or historical data
 * Used by AI to get specific data without overwhelming the context
 * 
 * Query types:
 * - "nodes": Filter nodes by various criteria
 * - "node": Get a single node by pubkey/address
 * - "history": Get historical data for a node or network
 * - "country": Get aggregated country/region data (stats, node counts, etc.)
 * - "country-history": Get historical data for a country/region
 */

import { NextResponse } from 'next/server';

const RENDER_API_URL = process.env.RENDER_API_URL || process.env.NEXT_PUBLIC_RENDER_API_URL;
const API_SECRET = process.env.API_SECRET;

export async function POST(request: Request) {
  try {
    const { queryType, filters, nodeId, pubkey, address, startTime, endTime, country, countryCode } = await request.json();

    if (!RENDER_API_URL) {
      return NextResponse.json(
        { error: 'Render API URL not configured', nodes: [] },
        { status: 500 }
      );
    }

    // Handle different query types
    if (queryType === 'node' || nodeId || pubkey || address) {
      // Get single node by pubkey or address
      const identifier = nodeId || pubkey || address;
      if (!identifier) {
        return NextResponse.json(
          { error: 'nodeId, pubkey, or address required for node query', node: null },
          { status: 400 }
        );
      }

      const nodesResponse = await fetch(`${RENDER_API_URL}/api/pnodes`, {
        headers: {
          'Content-Type': 'application/json',
          ...(API_SECRET ? { 'Authorization': `Bearer ${API_SECRET}` } : {}),
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });

      if (!nodesResponse.ok) {
        return NextResponse.json(
          { error: 'Failed to fetch nodes', node: null },
          { status: 500 }
        );
      }

      const nodesData = await nodesResponse.json();
      const nodes = nodesData.nodes || [];
      
      // Find node by pubkey or address
      const node = nodes.find((n: any) => 
        (n.pubkey || n.publicKey || n.id || '').toString().toLowerCase() === identifier.toLowerCase() ||
        (n.address || '').toLowerCase() === identifier.toLowerCase()
      );

      if (!node) {
        return NextResponse.json({
          error: 'Node not found',
          node: null,
        }, { status: 404 });
      }

      // Format node for AI
      const ramUsedBytes = node.ramUsed || 0;
      const ramTotalBytes = node.ramTotal || 0;
      const ramPercent = ramTotalBytes > 0 ? ((ramUsedBytes / ramTotalBytes) * 100) : null;

      const formattedNode = {
        a: node.address || '',
        p: (node.pubkey || node.publicKey || node.id || '').toString(),
        v: node.version || 'unknown',
        s: node.status || 'offline',
        u: node.uptime ? Math.floor(node.uptime / 86400) : 0,
        us: node.uptime || 0,
        cpu: node.cpuPercent ?? null,
        rp: ramPercent,
        ru: ramUsedBytes,
        rt: ramTotalBytes,
        sc: node.storageCapacity || 0,
        cr: node.credits || 0,
        bal: node.balance || 0,
        pc: node.peerCount || 0,
        c: (node.locationData?.countryCode || node.locationData?.country || 'UN').toUpperCase(),
        cy: node.locationData?.city || '',
        lat: node.locationData?.lat ?? null,
        lon: node.locationData?.lon ?? null,
        pub: node.isPublic || false,
        rpc: node.rpcPort ?? null,
        ls: node.lastSeen ?? null,
        pr: node.packetsReceived || 0,
        ps: node.packetsSent || 0,
        as: node.activeStreams || 0,
        do: node.dataOperationsHandled || 0,
        tp: node.totalPages ?? null,
        ver: node.version || 'unknown',
      };

      // If history requested, fetch it
      if (startTime || endTime) {
        try {
          const historyUrl = new URL('/api/history', request.url.split('/api/ai/query')[0]);
          if (formattedNode.p) historyUrl.searchParams.set('nodeId', formattedNode.p);
          if (startTime) historyUrl.searchParams.set('startTime', startTime.toString());
          if (endTime) historyUrl.searchParams.set('endTime', endTime.toString());

          const historyResponse = await fetch(historyUrl.toString(), {
            signal: AbortSignal.timeout(10000),
          });

          if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            return NextResponse.json({
              node: formattedNode,
              history: historyData.data || [],
            });
          }
        } catch (error) {
          console.warn('[AI Query] Failed to fetch history:', error);
        }
      }

      return NextResponse.json({
        node: formattedNode,
      });
    }

    if (queryType === 'history') {
      // Get historical data
      try {
        const historyUrl = new URL('/api/history', request.url.split('/api/ai/query')[0]);
        if (nodeId || pubkey) historyUrl.searchParams.set('nodeId', (nodeId || pubkey).toString());
        if (startTime) historyUrl.searchParams.set('startTime', startTime.toString());
        if (endTime) historyUrl.searchParams.set('endTime', endTime.toString());

        const historyResponse = await fetch(historyUrl.toString(), {
          signal: AbortSignal.timeout(10000),
        });

        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          return NextResponse.json({
            history: historyData.data || [],
            count: historyData.data?.length || 0,
          });
        } else {
          return NextResponse.json(
            { error: 'Failed to fetch history', history: [] },
            { status: 500 }
          );
        }
      } catch (error: any) {
        return NextResponse.json(
          { error: 'Failed to fetch history', message: error?.message, history: [] },
          { status: 500 }
        );
      }
    }

    if (queryType === 'country') {
      // Get aggregated country/region data
      const targetCountry = country || filters?.country;
      const targetCountryCode = countryCode || filters?.countryCode;
      
      if (!targetCountry) {
        return NextResponse.json(
          { error: 'country parameter required for country query', data: null },
          { status: 400 }
        );
      }

      try {
        // Fetch all nodes
        const nodesResponse = await fetch(`${RENDER_API_URL}/api/pnodes`, {
          headers: {
            'Content-Type': 'application/json',
            ...(API_SECRET ? { 'Authorization': `Bearer ${API_SECRET}` } : {}),
          },
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        });

        if (!nodesResponse.ok) {
          return NextResponse.json(
            { error: 'Failed to fetch nodes', data: null },
            { status: 500 }
          );
        }

        const nodesData = await nodesResponse.json();
        const allNodes = nodesData.nodes || [];
        
        // Filter nodes by country
        const countryNodes = allNodes.filter((n: any) => {
          const nodeCountry = (n.locationData?.country || '').toLowerCase();
          const nodeCountryCode = (n.locationData?.countryCode || '').toUpperCase();
          const target = targetCountry.toLowerCase();
          const targetCode = targetCountryCode?.toUpperCase();
          
          return nodeCountry === target || 
                 (targetCode && nodeCountryCode === targetCode) ||
                 nodeCountryCode === target.toUpperCase();
        });

        // Calculate aggregated stats
        const totalNodes = countryNodes.length;
        const onlineNodes = countryNodes.filter((n: any) => n.status === 'online').length;
        const offlineNodes = countryNodes.filter((n: any) => n.status === 'offline' || !n.status).length;
        const syncingNodes = countryNodes.filter((n: any) => n.status === 'syncing').length;
        
        const totalStorage = countryNodes.reduce((sum: number, n: any) => sum + (n.storageCapacity || 0), 0);
        const usedStorage = countryNodes.reduce((sum: number, n: any) => sum + (n.storageUsed || 0), 0);
        
        const totalCredits = countryNodes.reduce((sum: number, n: any) => sum + (n.credits || 0), 0);
        
        const cpuValues = countryNodes
          .map((n: any) => n.cpuPercent)
          .filter((val: any): val is number => val !== undefined && val !== null && val >= 0);
        const avgCPU = cpuValues.length > 0
          ? cpuValues.reduce((sum: number, val: number) => sum + val, 0) / cpuValues.length
          : 0;

        const ramValues = countryNodes
          .map((n: any) => {
            if (!n.ramTotal || n.ramTotal === 0) return null;
            return ((n.ramUsed || 0) / n.ramTotal) * 100;
          })
          .filter((val: any): val is number => val !== null && val !== undefined);
        const avgRAM = ramValues.length > 0
          ? ramValues.reduce((sum: number, val: number) => sum + val, 0) / ramValues.length
          : 0;

        const totalPacketsReceived = countryNodes.reduce((sum: number, n: any) => sum + (n.packetsReceived || 0), 0);
        const totalPacketsSent = countryNodes.reduce((sum: number, n: any) => sum + (n.packetsSent || 0), 0);
        const totalActiveStreams = countryNodes.reduce((sum: number, n: any) => sum + (n.activeStreams || 0), 0);

        // Version distribution
        const versionDistribution: Record<string, number> = {};
        countryNodes.forEach((n: any) => {
          const version = n.version || 'unknown';
          versionDistribution[version] = (versionDistribution[version] || 0) + 1;
        });

        // City distribution
        const cities = new Set<string>();
        countryNodes.forEach((n: any) => {
          if (n.locationData?.city) {
            cities.add(n.locationData.city);
          }
        });

        return NextResponse.json({
          country: targetCountry,
          countryCode: targetCountryCode || countryNodes[0]?.locationData?.countryCode || null,
          stats: {
            totalNodes,
            onlineNodes,
            offlineNodes,
            syncingNodes,
            totalStorage,
            usedStorage,
            storageUsagePercent: totalStorage > 0 ? (usedStorage / totalStorage) * 100 : 0,
            totalCredits,
            avgCPU: Math.round(avgCPU * 10) / 10,
            avgRAM: Math.round(avgRAM * 10) / 10,
            totalPacketsReceived,
            totalPacketsSent,
            totalActiveStreams,
            versionDistribution,
            cityCount: cities.size,
            cities: Array.from(cities).slice(0, 10), // Top 10 cities
          },
        });
      } catch (error: any) {
        return NextResponse.json(
          { error: 'Failed to fetch country data', message: error?.message, data: null },
          { status: 500 }
        );
      }
    }

    if (queryType === 'country-history') {
      // Get historical data for a country/region
      const targetCountry = country || filters?.country;
      const targetCountryCode = countryCode || filters?.countryCode;
      
      if (!targetCountry) {
        return NextResponse.json(
          { error: 'country parameter required for country-history query', history: [] },
          { status: 400 }
        );
      }

      // Calculate time range
      const endTimeValue = endTime || Date.now();
      const startTimeValue = startTime || (endTimeValue - (7 * 24 * 60 * 60 * 1000)); // Default 7 days

      try {
        const baseUrl = request.url.split('/api/ai/query')[0];
        const historyUrl = new URL('/api/history/region', baseUrl);
        historyUrl.searchParams.set('country', targetCountry);
        if (targetCountryCode) {
          historyUrl.searchParams.set('countryCode', targetCountryCode);
        }
        historyUrl.searchParams.set('startTime', startTimeValue.toString());
        historyUrl.searchParams.set('endTime', endTimeValue.toString());

        const historyResponse = await fetch(historyUrl.toString(), {
          signal: AbortSignal.timeout(15000),
        });

        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          return NextResponse.json({
            country: targetCountry,
            countryCode: targetCountryCode || null,
            history: historyData.data || [],
            count: historyData.count || 0,
            startTime: startTimeValue,
            endTime: endTimeValue,
          });
        } else {
          return NextResponse.json(
            { error: 'Failed to fetch country history', history: [] },
            { status: 500 }
          );
        }
      } catch (error: any) {
        return NextResponse.json(
          { error: 'Failed to fetch country history', message: error?.message, history: [] },
          { status: 500 }
        );
      }
    }

    if (queryType === 'credits-change' || (filters && (filters.minCreditsEarned !== undefined || filters.timeRange))) {
      // Query for credit changes over time
      try {
        const timeRange = filters?.timeRange || '1h'; // default to 1 hour
        const minCreditsEarned = filters?.minCreditsEarned || 0;
        
        // Calculate time range
        const endTime = Date.now();
        let startTime = endTime;
        if (timeRange === '1h') startTime = endTime - (60 * 60 * 1000);
        else if (timeRange === '24h' || timeRange === '1d') startTime = endTime - (24 * 60 * 60 * 1000);
        else if (timeRange === '7d' || timeRange === '1w') startTime = endTime - (7 * 24 * 60 * 60 * 1000);
        else if (timeRange === '30d' || timeRange === '1m') startTime = endTime - (30 * 24 * 60 * 60 * 1000);

        const historyUrl = new URL('/api/history', request.url.split('/api/ai/query')[0]);
        historyUrl.searchParams.set('startTime', startTime.toString());
        historyUrl.searchParams.set('endTime', endTime.toString());

        const historyResponse = await fetch(historyUrl.toString(), {
          signal: AbortSignal.timeout(15000),
        });

        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          const snapshots = historyData.data || [];
          
          // Calculate credit changes for each node
          const creditChanges: Record<string, { 
            pubkey: string; 
            address: string; 
            creditsEarned: number; 
            startCredits: number; 
            endCredits: number;
            nodeSnapshots: any[];
          }> = {};

          // Group snapshots by node
          snapshots.forEach((snapshot: any) => {
            if (snapshot.nodeSnapshots && Array.isArray(snapshot.nodeSnapshots)) {
              snapshot.nodeSnapshots.forEach((nodeSnap: any) => {
                const pubkey = nodeSnap.pubkey || nodeSnap.id || '';
                if (!pubkey) return;

                if (!creditChanges[pubkey]) {
                  creditChanges[pubkey] = {
                    pubkey,
                    address: nodeSnap.address || '',
                    creditsEarned: 0,
                    startCredits: nodeSnap.credits || 0,
                    endCredits: nodeSnap.credits || 0,
                    nodeSnapshots: [],
                  };
                }

                creditChanges[pubkey].nodeSnapshots.push({
                  timestamp: snapshot.timestamp,
                  credits: nodeSnap.credits || 0,
                });
              });
            }
          });

          // Calculate credit changes
          Object.values(creditChanges).forEach((nodeData) => {
            if (nodeData.nodeSnapshots.length >= 2) {
              // Sort by timestamp
              nodeData.nodeSnapshots.sort((a, b) => a.timestamp - b.timestamp);
              const firstCredits = nodeData.nodeSnapshots[0].credits || 0;
              const lastCredits = nodeData.nodeSnapshots[nodeData.nodeSnapshots.length - 1].credits || 0;
              nodeData.startCredits = firstCredits;
              nodeData.endCredits = lastCredits;
              nodeData.creditsEarned = Math.max(0, lastCredits - firstCredits);
            } else if (nodeData.nodeSnapshots.length === 1) {
              // Only one snapshot, can't calculate change
              nodeData.creditsEarned = 0;
            }
          });

          // Filter by minimum credits earned
          const filtered = Object.values(creditChanges)
            .filter((nodeData) => nodeData.creditsEarned >= minCreditsEarned)
            .map((nodeData) => ({
              pubkey: nodeData.pubkey,
              address: nodeData.address,
              creditsEarned: nodeData.creditsEarned,
              startCredits: nodeData.startCredits,
              endCredits: nodeData.endCredits,
            }));

          return NextResponse.json({
            nodes: filtered,
            count: filtered.length,
            timeRange,
            startTime,
            endTime,
          });
        } else {
          return NextResponse.json(
            { error: 'Failed to fetch history for credit changes', nodes: [] },
            { status: 500 }
          );
        }
      } catch (error: any) {
        return NextResponse.json(
          { error: 'Failed to process credit change query', message: error?.message, nodes: [] },
          { status: 500 }
        );
      }
    }

    // Default: filter nodes query
    // Fetch all nodes
    const nodesResponse = await fetch(`${RENDER_API_URL}/api/pnodes`, {
      headers: {
        'Content-Type': 'application/json',
        ...(API_SECRET ? { 'Authorization': `Bearer ${API_SECRET}` } : {}),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!nodesResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch nodes', nodes: [] },
        { status: 500 }
      );
    }

    const nodesData = await nodesResponse.json();
    let nodes = nodesData.nodes || [];

    // Apply filters
    if (filters) {
      if (filters.country) {
        // Support both single country code and array of country codes
        const targetCountries = Array.isArray(filters.country) 
          ? filters.country.map((c: string) => c.toUpperCase())
          : [filters.country.toUpperCase()];
        
        nodes = nodes.filter((n: any) => {
          const nodeCountry = (n.locationData?.countryCode || n.locationData?.country || '').toUpperCase();
          return targetCountries.includes(nodeCountry);
        });
      }

      if (filters.status) {
        nodes = nodes.filter((n: any) => n.status === filters.status);
      }

      if (filters.minRamPercent !== undefined) {
        nodes = nodes.filter((n: any) => {
          if (!n.ramTotal || n.ramTotal === 0) return false;
          const ramPercent = (n.ramUsed || 0) / n.ramTotal * 100;
          return ramPercent >= filters.minRamPercent;
        });
      }

      if (filters.maxRamPercent !== undefined) {
        nodes = nodes.filter((n: any) => {
          if (!n.ramTotal || n.ramTotal === 0) return false;
          const ramPercent = (n.ramUsed || 0) / n.ramTotal * 100;
          return ramPercent <= filters.maxRamPercent;
        });
      }

      if (filters.minCredits !== undefined) {
        nodes = nodes.filter((n: any) => (n.credits || 0) >= filters.minCredits);
      }

      if (filters.minStorage !== undefined) {
        nodes = nodes.filter((n: any) => (n.storageCapacity || 0) >= filters.minStorage);
      }

      if (filters.maxCpuPercent !== undefined) {
        nodes = nodes.filter((n: any) => (n.cpuPercent ?? 0) <= filters.maxCpuPercent);
      }

      if (filters.minCpuPercent !== undefined) {
        nodes = nodes.filter((n: any) => (n.cpuPercent ?? 0) >= filters.minCpuPercent);
      }

      if (filters.version) {
        nodes = nodes.filter((n: any) => (n.version || 'unknown') === filters.version);
      }

      if (filters.isPublic !== undefined) {
        nodes = nodes.filter((n: any) => (n.isPublic || false) === filters.isPublic);
      }

      if (filters.minUptime !== undefined) {
        nodes = nodes.filter((n: any) => (n.uptime || 0) >= filters.minUptime);
      }

      if (filters.minPeerCount !== undefined) {
        nodes = nodes.filter((n: any) => (n.peerCount || 0) >= filters.minPeerCount);
      }

      // Sorting
      if (filters.sortBy) {
        const sortField = filters.sortBy;
        const sortOrder = filters.sortOrder || 'desc';
        nodes.sort((a: any, b: any) => {
          let aVal: any = a[sortField];
          let bVal: any = b[sortField];
          
          // Handle calculated fields
          if (sortField === 'ramPercent') {
            const aRamTotal = a.ramTotal || 0;
            const bRamTotal = b.ramTotal || 0;
            aVal = aRamTotal > 0 ? ((a.ramUsed || 0) / aRamTotal * 100) : 0;
            bVal = bRamTotal > 0 ? ((b.ramUsed || 0) / bRamTotal * 100) : 0;
          }
          
          if (aVal === null || aVal === undefined) aVal = 0;
          if (bVal === null || bVal === undefined) bVal = 0;
          
          if (sortOrder === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
          } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
          }
        });
      }

      if (filters.limit) {
        nodes = nodes.slice(0, filters.limit);
      }
    }

    // Format nodes for AI (compact format)
    const formattedNodes = nodes.map((n: any) => {
      const ramUsedBytes = n.ramUsed || 0;
      const ramTotalBytes = n.ramTotal || 0;
      const ramPercent = ramTotalBytes > 0 ? ((ramUsedBytes / ramTotalBytes) * 100) : null;

      return {
        a: n.address || '',
        p: (n.pubkey || n.publicKey || n.id || '').toString(), // full pubkey
        v: n.version || 'unknown',
        s: n.status || 'offline',
        u: n.uptime ? Math.floor(n.uptime / 86400) : 0,
        us: n.uptime || 0,
        cpu: n.cpuPercent ?? null,
        rp: ramPercent,
        ru: ramUsedBytes,
        rt: ramTotalBytes,
        sc: n.storageCapacity || 0,
        cr: n.credits || 0,
        bal: n.balance || 0,
        pc: n.peerCount || 0,
        c: (n.locationData?.countryCode || n.locationData?.country || 'UN').toUpperCase(),
        cy: n.locationData?.city || '',
        lat: n.locationData?.lat ?? null,
        lon: n.locationData?.lon ?? null,
        pub: n.isPublic || false,
        rpc: n.rpcPort ?? null,
        ls: n.lastSeen ?? null,
        pr: n.packetsReceived || 0,
        ps: n.packetsSent || 0,
        as: n.activeStreams || 0,
        do: n.dataOperationsHandled || 0,
      };
    });

    return NextResponse.json({
      count: formattedNodes.length,
      nodes: formattedNodes,
    });
  } catch (error: any) {
    console.error('[AI Query] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process query', message: error?.message || 'Unknown error', nodes: [] },
      { status: 500 }
    );
  }
}

