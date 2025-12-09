import { useEffect, useState, useMemo } from 'react';
import { PNode, fetchPNodesFromGossip } from './lib/prpc';
import StatsCard from './components/StatsCard';
import PNodeTable from './components/PNodeTable';

function App() {
  const [nodes, setNodes] = useState<PNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'prpc' | 'mock' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('reputation');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [customEndpoint, setCustomEndpoint] = useState<string>('');

  useEffect(() => {
    fetchNodes();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchNodes, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNodes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const endpoint = customEndpoint || undefined;
      const fetchedNodes = await fetchPNodesFromGossip(endpoint);
      
      if (fetchedNodes && fetchedNodes.length > 0) {
        setNodes(fetchedNodes);
        setDataSource('prpc');
      } else {
        // If no nodes returned, use mock data for demonstration
        const { getMockPNodes } = await import('./lib/prpc');
        setNodes(getMockPNodes());
        setDataSource('mock');
      }
    } catch (err) {
      console.error('Error fetching nodes:', err);
      // On error, use mock data so the UI still works
      try {
        const { getMockPNodes } = await import('./lib/prpc');
        setNodes(getMockPNodes());
        setDataSource('mock');
        setError('Using mock data. ' + (err instanceof Error ? err.message : 'Unable to connect to pRPC endpoints.'));
      } catch (importErr) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setNodes([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedNodes = useMemo(() => {
    let filtered = [...nodes];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (node) =>
          node.id.toLowerCase().includes(query) ||
          node.publicKey.toLowerCase().includes(query) ||
          node.address?.toLowerCase().includes(query) ||
          node.location?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((node) => node.status === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortBy];
      let bValue: any = b[sortBy];

      // Handle numeric values
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle string values
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return 0;
    });

    return filtered;
  }, [nodes, searchQuery, statusFilter, sortBy, sortOrder]);

  const stats = useMemo(() => {
    const totalNodes = nodes.length;
    const onlineNodes = nodes.filter((n) => n.status === 'online').length;
    const totalStorage = nodes.reduce((sum, n) => sum + (n.storageCapacity || 0), 0);
    const usedStorage = nodes.reduce((sum, n) => sum + (n.storageUsed || 0), 0);
    const avgUptime =
      nodes.length > 0
        ? nodes.reduce((sum, n) => sum + (n.uptime || 0), 0) / nodes.length
        : 0;

    return {
      totalNodes,
      onlineNodes,
      totalStorage,
      usedStorage,
      avgUptime,
    };
  }, [nodes]);

  const handleNodeClick = (node: PNode) => {
    // Could open a modal or navigate to detail page
    console.log('Clicked node:', node);
  };

  return (
    <div className="min-h-screen bg-fill-background-primary" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
      {/* Header */}
      <header className="bg-fill-background-primary shadow-sm border-b border-line" style={{ backgroundColor: 'rgb(255, 255, 255)', borderBottom: '1px solid rgba(0, 0, 0, 0.1)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ fontSize: '56px', fontWeight: 'bold', color: 'rgb(0, 0, 0)', lineHeight: '1em', fontFamily: "'Exo 2', Arial, Helvetica, sans-serif" }}>
                Xandeum pNodes Analytics
              </h1>
              <p className="mt-2" style={{ fontSize: '14px', lineHeight: '1.7em', color: 'rgb(114, 114, 114)' }}>
                Real-time analytics and monitoring for Xandeum Provider Nodes
              </p>
            </div>
            <button
              onClick={fetchNodes}
              disabled={loading}
              className="px-6 py-3 rounded-lg transition-colors font-body-medium"
              style={{
                backgroundColor: loading ? 'rgb(64, 64, 64)' : 'rgb(0, 0, 0)',
                color: 'rgb(91, 42, 85)',
                border: '1px solid rgb(0, 0, 0)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = 'rgb(255, 255, 255)';
                  e.currentTarget.style.color = 'rgb(0, 0, 0)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = 'rgb(0, 0, 0)';
                  e.currentTarget.style.color = 'rgb(91, 42, 85)';
                }
              }}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Data Source Indicator */}
        {dataSource && (
          <div 
            className="mb-6 rounded-lg p-4 border"
            style={{
              backgroundColor: dataSource === 'mock' ? 'rgb(249, 197, 180)' : 'rgb(177, 211, 187)',
              borderColor: dataSource === 'mock' ? 'rgb(243, 167, 143)' : 'rgb(127, 168, 139)'
            }}
          >
            <p 
              className="font-medium"
              style={{
                fontSize: '14px',
                lineHeight: '1.7em',
                color: dataSource === 'mock' ? 'rgb(158, 59, 27)' : 'rgb(64, 124, 81)'
              }}
            >
              {dataSource === 'mock' 
                ? '⚠️ Using mock data for demonstration. Configure pRPC endpoint to fetch real data.'
                : '✅ Connected to pRPC endpoint'}
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div 
            className="mb-6 border rounded-lg p-4"
            style={{
              backgroundColor: 'rgb(249, 197, 180)',
              borderColor: 'rgb(243, 167, 143)'
            }}
          >
            <p className="font-medium mb-2" style={{ fontSize: '16px', lineHeight: '1.5em', color: 'rgb(158, 59, 27)' }}>Error: {error}</p>
            <p style={{ fontSize: '12px', lineHeight: '1.4em', color: 'rgb(79, 29, 14)' }}>
              Need help? Check Xandeum documentation or join their Discord: 
              <a href="https://discord.gg/uqRSmmM5m" target="_blank" rel="noopener noreferrer" className="underline ml-1" style={{ color: 'rgb(63, 130, 119)' }}>
                https://discord.gg/uqRSmmM5m
              </a>
            </p>
          </div>
        )}

        {/* Endpoint Configuration */}
        <div className="mb-6 rounded-lg shadow-md p-4 border" style={{ backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgba(0, 0, 0, 0.1)' }}>
          <details className="cursor-pointer">
            <summary className="font-medium" style={{ fontSize: '14px', lineHeight: '1.7em', color: 'rgb(0, 0, 0)' }}>
              Configure pRPC Endpoint
            </summary>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block font-medium mb-2" style={{ fontSize: '14px', lineHeight: '1.7em', color: 'rgb(0, 0, 0)' }}>
                  Custom pRPC Endpoint (optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customEndpoint}
                    onChange={(e) => setCustomEndpoint(e.target.value)}
                    placeholder="https://prpc.xandeum.network"
                    className="flex-1 px-4 py-2 border rounded-lg"
                    style={{
                      borderColor: 'rgba(0, 0, 0, 0.1)',
                      backgroundColor: 'rgb(255, 255, 255)',
                      color: 'rgb(0, 0, 0)',
                      fontSize: '16px',
                      lineHeight: '1.5em'
                    }}
                  />
                  <button
                    onClick={fetchNodes}
                    className="px-4 py-2 border rounded-lg transition-colors"
                    style={{
                      backgroundColor: 'rgb(0, 0, 0)',
                      color: 'rgb(91, 42, 85)',
                      borderColor: 'rgb(0, 0, 0)',
                      fontSize: '16px',
                      lineHeight: '1.5em',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgb(255, 255, 255)';
                      e.currentTarget.style.color = 'rgb(0, 0, 0)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgb(0, 0, 0)';
                      e.currentTarget.style.color = 'rgb(91, 42, 85)';
                    }}
                  >
                    Update
                  </button>
                </div>
                <p className="mt-2" style={{ fontSize: '12px', lineHeight: '1.4em', color: 'rgb(114, 114, 114)' }}>
                  Leave empty to try default endpoints. The platform will automatically try multiple endpoint patterns.
                </p>
              </div>
            </div>
          </details>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <StatsCard
            title="Total Nodes"
            value={stats.totalNodes}
            subtitle="Active pNodes"
          />
          <StatsCard
            title="Online Nodes"
            value={stats.onlineNodes}
            subtitle={`${stats.totalNodes > 0 ? ((stats.onlineNodes / stats.totalNodes) * 100).toFixed(1) : 0}% online`}
          />
          <StatsCard
            title="Total Storage"
            value={`${(stats.totalStorage / (1024 * 1024 * 1024)).toFixed(1)} GB`}
            subtitle="Network capacity"
          />
          <StatsCard
            title="Storage Used"
            value={`${(stats.usedStorage / (1024 * 1024 * 1024)).toFixed(1)} GB`}
            subtitle={`${stats.totalStorage > 0 ? ((stats.usedStorage / stats.totalStorage) * 100).toFixed(1) : 0}% utilized`}
          />
          <StatsCard
            title="Avg Uptime"
            value={`${stats.avgUptime.toFixed(2)}%`}
            subtitle="Network average"
          />
        </div>

        {/* Filters and Search */}
        <div className="rounded-lg shadow-md p-6 mb-6 border" style={{ backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgba(0, 0, 0, 0.1)' }}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block font-medium mb-2" style={{ fontSize: '14px', lineHeight: '1.7em', color: 'rgb(0, 0, 0)' }}>
                Search
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ID, key, address..."
                className="w-full px-4 py-2 border rounded-lg"
                style={{
                  borderColor: 'rgba(0, 0, 0, 0.1)',
                  backgroundColor: 'rgb(255, 255, 255)',
                  color: 'rgb(0, 0, 0)',
                  fontSize: '16px',
                  lineHeight: '1.5em'
                }}
              />
            </div>
            <div>
              <label className="block font-medium mb-2" style={{ fontSize: '14px', lineHeight: '1.7em', color: 'rgb(0, 0, 0)' }}>
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
                style={{
                  borderColor: 'rgba(0, 0, 0, 0.1)',
                  backgroundColor: 'rgb(255, 255, 255)',
                  color: 'rgb(0, 0, 0)',
                  fontSize: '16px',
                  lineHeight: '1.5em'
                }}
              >
                <option value="all">All Status</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="syncing">Syncing</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-2" style={{ fontSize: '14px', lineHeight: '1.7em', color: 'rgb(0, 0, 0)' }}>
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
                style={{
                  borderColor: 'rgba(0, 0, 0, 0.1)',
                  backgroundColor: 'rgb(255, 255, 255)',
                  color: 'rgb(0, 0, 0)',
                  fontSize: '16px',
                  lineHeight: '1.5em'
                }}
              >
                <option value="reputation">Reputation</option>
                <option value="uptime">Uptime</option>
                <option value="latency">Latency</option>
                <option value="storageUsed">Storage Used</option>
                <option value="id">Node ID</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-2" style={{ fontSize: '14px', lineHeight: '1.7em', color: 'rgb(0, 0, 0)' }}>
                Order
              </label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="w-full px-4 py-2 border rounded-lg"
                style={{
                  borderColor: 'rgba(0, 0, 0, 0.1)',
                  backgroundColor: 'rgb(255, 255, 255)',
                  color: 'rgb(0, 0, 0)',
                  fontSize: '16px',
                  lineHeight: '1.5em'
                }}
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Nodes Table */}
        <div className="rounded-lg shadow-md p-6 border" style={{ backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgba(0, 0, 0, 0.1)' }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: '1.2em', color: 'rgb(0, 0, 0)' }}>
              pNodes ({filteredAndSortedNodes.length})
            </h2>
            {loading && (
              <span style={{ fontSize: '14px', lineHeight: '1.7em', color: 'rgb(114, 114, 114)' }}>Loading...</span>
            )}
          </div>
          <PNodeTable nodes={filteredAndSortedNodes} onNodeClick={handleNodeClick} />
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t" style={{ borderTopColor: 'rgba(0, 0, 0, 0.1)', backgroundColor: 'rgb(255, 255, 255)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center" style={{ fontSize: '14px', lineHeight: '1.7em', color: 'rgb(114, 114, 114)' }}>
            Built for Xandeum Labs • Data from pRPC gossip
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;

