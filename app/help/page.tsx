'use client';

import { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { useNodes } from '@/lib/context/NodesContext';
import { BookOpen, ChevronRight, X, FileText, Settings, BarChart3, MapPin, Search, HelpCircle, Bot, Server } from 'lucide-react';

export default function HelpPage() {
  const { nodes, loading, lastUpdate, availableNetworks, currentNetwork, refreshNodes } = useNodes();
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col bg-[#0a0a0a] text-foreground">
      <Header
        activePage="help"
        nodeCount={nodes.length}
        lastUpdate={lastUpdate}
        loading={loading}
        onRefresh={() => refreshNodes()}
        networks={availableNetworks}
        currentNetwork={currentNetwork}
        onNetworkChange={() => { }}
        showNetworkSelector={false}
      />

      <main className="flex-1 overflow-hidden flex relative">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/80 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar Navigation */}
        <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } md:translate-x-0 fixed md:relative w-80 border-r border-[#F0A741]/20 bg-card overflow-y-auto flex-shrink-0 z-50 md:z-40 h-full transition-transform duration-300`}>
          <div className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="text-xs sm:text-sm font-semibold text-foreground/60 uppercase tracking-wide">Documentation</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden p-1 text-foreground/60 hover:text-foreground"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="space-y-1 sm:space-y-2">
              <button
                onClick={() => {
                  setActiveDoc(null);
                  setSidebarOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${activeDoc === null
                  ? 'bg-[#1a1a1a] text-foreground font-medium'
                  : 'text-foreground hover:hover:bg-[#1a1a1a]'
                  }`}
              >
                Quick Start Guide
              </button>
              <button
                onClick={() => {
                  setActiveDoc('deployment');
                  setSidebarOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center justify-between ${activeDoc === 'deployment'
                  ? 'bg-[#1a1a1a] text-foreground font-medium'
                  : 'text-foreground hover:hover:bg-[#1a1a1a]'
                  }`}
              >
                <span>Deployment</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setActiveDoc('analytics');
                  setSidebarOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center justify-between ${activeDoc === 'analytics'
                  ? 'bg-[#1a1a1a] text-foreground font-medium'
                  : 'text-foreground hover:hover:bg-[#1a1a1a]'
                  }`}
              >
                <span>Analytics & Metrics</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setActiveDoc('architecture');
                  setSidebarOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center justify-between ${activeDoc === 'architecture'
                  ? 'bg-[#1a1a1a] text-foreground font-medium'
                  : 'text-foreground hover:hover:bg-[#1a1a1a]'
                  }`}
              >
                <span>Architecture</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setActiveDoc('ai');
                  setSidebarOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center justify-between ${activeDoc === 'ai'
                  ? 'bg-[#1a1a1a] text-foreground font-medium'
                  : 'text-foreground hover:hover:bg-[#1a1a1a]'
                  }`}
              >
                <span>AI Assistant</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          {/* Mobile Menu Button */}
          <div className="md:hidden p-4 border-b border-border">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground hover:hover:bg-[#1a1a1a] rounded-md transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              <span>Menu</span>
            </button>
          </div>

          {activeDoc === null ? (
            <QuickStartGuide />
          ) : activeDoc === 'deployment' ? (
            <DeploymentDocs onClose={() => setActiveDoc(null)} />
          ) : activeDoc === 'analytics' ? (
            <AnalyticsDocs onClose={() => setActiveDoc(null)} />
          ) : activeDoc === 'architecture' ? (
            <ArchitectureDocs onClose={() => setActiveDoc(null)} />
          ) : activeDoc === 'ai' ? (
            <AIFeaturesDocs onClose={() => setActiveDoc(null)} />
          ) : null}
        </div>
      </main>
    </div>
  );
}

function QuickStartGuide() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-8 animate-fade-in" style={{ animationDelay: '0.05s', opacity: 0, animationFillMode: 'forwards' }}>
        <h1 className="text-3xl font-bold text-foreground mb-2">pGlobe Documentation</h1>
        <p className="text-muted-foreground">
          Real-time analytics and monitoring platform for the Xandeum pNode network
        </p>
      </div>

      {/* What is pGlobe */}
      <section className="mb-12 animate-slide-in-right" style={{ animationDelay: '0.1s', opacity: 0, animationFillMode: 'forwards' }}>
        <h2 className="text-2xl font-semibold text-foreground mb-4">What is pGlobe?</h2>
        <div className="prose prose-gray prose-invert max-w-none">
          <p className="text-foreground leading-relaxed mb-4">
            pGlobe is a real-time analytics and monitoring platform for the <strong>Xandeum pNode network</strong>.
            It provides comprehensive visibility into the decentralized storage layer that powers Solana dApps with scalable,
            affordable data storage.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="border border-border rounded-lg p-4">
              <h3 className="font-semibold text-foreground mb-2">What are pNodes?</h3>
              <p className="text-sm text-muted-foreground">
                Provider Nodes (pNodes) form a distributed storage network where each node contributes storage capacity
                and earns rewards for serving data to applications. They're the backbone of Xandeum's decentralized storage infrastructure.
              </p>
            </div>
            <div className="border border-border rounded-lg p-4">
              <h3 className="font-semibold text-foreground mb-2">Why Use pGlobe?</h3>
              <p className="text-sm text-muted-foreground">
                Monitor network health, track node performance, analyze storage distribution, and make informed decisions
                about staking or operating nodes. All in real-time with historical data tracking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Getting Started */}
      <section className="mb-12 animate-slide-in-left" style={{ animationDelay: '0.15s', opacity: 0, animationFillMode: 'forwards' }}>
        <h2 className="text-2xl font-semibold text-foreground mb-4">Getting Started</h2>
        <div className="prose prose-gray prose-invert max-w-none">
          <h3 className="text-xl font-semibold text-foreground mb-3">Navigation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-5 h-5 text-muted-foreground" />
                <h4 className="font-medium text-foreground">Overview</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                The main dashboard with interactive globe, network statistics, health score, and node list.
                Click any node on the globe or in the list to view detailed information.
              </p>
            </div>
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-5 h-5 text-muted-foreground" />
                <h4 className="font-medium text-foreground">Analytics</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Deep dive into network metrics with charts showing performance trends, resource utilization,
                latency distribution, and geographic metrics.
              </p>
            </div>
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Server className="w-5 h-5 text-muted-foreground" />
                <h4 className="font-medium text-foreground">Nodes</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Comprehensive node list with advanced search, filters, sorting, and export capabilities.
                View all nodes in a detailed table format.
              </p>
            </div>
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-5 h-5 text-muted-foreground" />
                <h4 className="font-medium text-foreground">Regions</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Browse nodes by geographic location. View statistics by country and continent with
                detailed breakdowns of node distribution.
              </p>
            </div>
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Search className="w-5 h-5 text-muted-foreground" />
                <h4 className="font-medium text-foreground">Scan</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Find nodes nearest to your location or a particular IP address. Measure latency and view distance-based rankings.
              </p>
            </div>
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="w-5 h-5 text-muted-foreground" />
                <h4 className="font-medium text-foreground">Help</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Documentation, FAQs, and guides to help you get the most out of pGlobe.
              </p>
            </div>
          </div>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-8">Quick Actions</h3>
          <ul className="space-y-2 text-foreground">
            <li className="flex items-start gap-2">
              <span className="text-muted-foreground mt-1">•</span>
              <span><strong>Refresh Data:</strong> Click the refresh button (↻) in the header to manually update node data</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-muted-foreground mt-1">•</span>
              <span><strong>Auto-refresh:</strong> Data automatically refreshes every 60 seconds (1 minute) by default</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-muted-foreground mt-1">•</span>
              <span><strong>View Node Details:</strong> Click any node on the globe, in the list, or in rankings to see full details</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-muted-foreground mt-1">•</span>
              <span><strong>Export Data:</strong> Use the export button in the Nodes page to download all node data as CSV or JSON</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-muted-foreground mt-1">•</span>
              <span><strong>Search Nodes:</strong> Use the search bar on the Nodes page to find nodes by IP, public key, location, or version</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-muted-foreground mt-1">•</span>
              <span><strong>Filter Nodes:</strong> Apply filters by status, version, credits, or packets to narrow down the node list</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Using Filters and Search */}
      <section className="mb-12 animate-scale-in" style={{ animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}>
        <h2 className="text-2xl font-semibold text-foreground mb-4">Using Filters & Search</h2>
        <div className="prose prose-gray prose-invert max-w-none">
          <p className="text-foreground mb-4">
            The Nodes page provides powerful filtering and search capabilities to help you find specific nodes or analyze subsets of the network.
          </p>

          <h3 className="text-xl font-semibold text-foreground mb-3">Search Bar</h3>
          <p className="text-foreground mb-3">
            The search bar lets you quickly find nodes by entering any of the following:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-1 mb-4">
            <li>IP address (e.g., "173.212.207.32")</li>
            <li>Public key or Node ID (full or partial)</li>
            <li>Location (city, country, or continent)</li>
            <li>Version number (e.g., "0.7.0")</li>
          </ul>

          <h3 className="text-xl font-semibold text-foreground mb-3">Available Filters</h3>
          <dl className="space-y-3 mb-6">
            <div>
              <dt className="text-sm font-medium text-foreground mb-1">Status Filter</dt>
              <dd className="text-sm text-muted-foreground">
                Show only Online, Syncing, or Offline nodes. Useful for monitoring network health or troubleshooting.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-foreground mb-1">Version Filter</dt>
              <dd className="text-sm text-muted-foreground">
                Filter nodes by software version. Helps identify nodes that need updates or track version adoption.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-foreground mb-1">Credits Filter</dt>
              <dd className="text-sm text-muted-foreground">
                Show nodes with or without credits. Credits indicate active participation in the network.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-foreground mb-1">Packets Filter</dt>
              <dd className="text-sm text-muted-foreground">
                Filter by nodes that have packet activity. Useful for finding actively serving nodes.
              </dd>
            </div>
          </dl>

          <h3 className="text-xl font-semibold text-foreground mb-3">Sorting</h3>
          <p className="text-foreground mb-3">
            Click any column header in the nodes table to sort by that metric:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-1 mb-4">
            <li>Status (online first)</li>
            <li>Uptime (highest first)</li>
            <li>CPU usage (lowest first)</li>
            <li>RAM usage (lowest first)</li>
            <li>Storage capacity (highest first)</li>
            <li>Credits (highest first)</li>
            <li>Latency (lowest first)</li>
            <li>Location (alphabetically)</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Click the same column again to reverse the sort order (ascending ↔ descending).
          </p>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Filter Badges</h3>
          <p className="text-foreground mb-3">
            Active filters appear as badges at the top of the page. Click the "×" on any badge to remove that filter,
            or use "Clear all" to reset all filters at once.
          </p>
        </div>
      </section>

      {/* Understanding Metrics */}
      <section className="mb-12 animate-fade-in" style={{ animationDelay: '0.25s', opacity: 0, animationFillMode: 'forwards' }}>
        <h2 className="text-2xl font-semibold text-foreground mb-4">Understanding Metrics</h2>
        <div className="prose prose-gray prose-invert max-w-none">
          <h3 className="text-xl font-semibold text-foreground mb-3">Node Status</h3>
          <dl className="space-y-3 mb-6">
            <div>
              <dt className="text-sm font-medium text-foreground mb-1">Online</dt>
              <dd className="text-sm text-muted-foreground">
                Node was seen in gossip within the last 5 minutes. These are actively participating nodes.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-foreground mb-1">Syncing</dt>
              <dd className="text-sm text-muted-foreground">
                Node was seen within the last hour but not in the last 5 minutes. May be catching up on network state.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-foreground mb-1">Offline</dt>
              <dd className="text-sm text-muted-foreground">
                Node hasn't been seen for over an hour. May be down, disconnected, or experiencing issues.
              </dd>
            </div>
          </dl>

          <h3 className="text-xl font-semibold text-foreground mb-3">Performance Metrics</h3>
          <dl className="space-y-3 mb-6">
            <div>
              <dt className="text-sm font-medium text-foreground mb-1">Uptime (%)</dt>
              <dd className="text-sm text-muted-foreground">
                Percentage of time the node has been continuously running, calculated over a 30-day window.
                Higher uptime (95%+) indicates a reliable, well-maintained node.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-foreground mb-1">CPU (%)</dt>
              <dd className="text-sm text-muted-foreground">
                Processor utilization. Shows how much of the node's CPU capacity is being used.
                Lower values (under 50%) mean more headroom for growth and better performance.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-foreground mb-1">RAM (Used / Total)</dt>
              <dd className="text-sm text-muted-foreground">
                Memory usage displayed as "Used / Total" (e.g., "4.2 GB / 8 GB"). Shows both the amount of RAM currently in use
                and the total available RAM. Typical pNode setups use 2-8GB depending on data volume. High RAM usage may indicate memory pressure.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-foreground mb-1">Storage Capacity</dt>
              <dd className="text-sm text-muted-foreground">
                Total storage capacity allocated by the node (in bytes, displayed as TB/GB/MB). This represents the total space
                the node has committed for storage, not the amount of data currently stored. Nodes can allocate storage capacity
                without necessarily using all of it.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-foreground mb-1">Latency (ms)</dt>
              <dd className="text-sm text-muted-foreground">
                Response time measured directly from your browser to each node's pRPC endpoint.
                This gives you accurate latency based on your location and internet connection.
                Latency measurements are cached for 1 hour to improve performance. Lower is better (under 100ms is excellent).
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-foreground mb-1">Credits</dt>
              <dd className="text-sm text-muted-foreground">
                Reputation credits earned by the node. Credits are calculated as follows:
              </dd>
              <ul className="list-disc list-inside text-sm text-muted-foreground ml-4 mt-2 space-y-1">
                <li><strong>+1 credit</strong> per heartbeat request responded to (~30 second intervals)</li>
                <li><strong>-100 credits</strong> for failing to respond to a data request</li>
                <li>Credits <strong>reset monthly</strong> (tracked via creditsResetMonth field)</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">
                Credits are fetched from the Xandeum pod credits API and represent the node's reputation and reliability.
                Higher credits indicate a more reliable node that consistently responds to network requests.
              </p>
            </div>
          </dl>

          <h3 className="text-xl font-semibold text-foreground mb-3">Network Health Score</h3>
          <p className="text-foreground mb-3">
            The health score (0-100) is a weighted composite metric that provides an overall assessment of network health:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-1 mb-4">
            <li><strong>40%</strong> - Availability (online nodes / total nodes)</li>
            <li><strong>35%</strong> - Version Health (% of nodes on the latest version)</li>
            <li><strong>25%</strong> - Geographic Distribution (diversity of node locations)</li>
            <li><strong>Regional Scores</strong> - Health is also calculated individually for every country and region based on local node performance.</li>
          </ul>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Node Identification</h3>
          <dl className="space-y-3 mb-6">
            <div>
              <dt className="text-sm font-medium text-foreground mb-1">TRYNET Badge</dt>
              <dd className="text-sm text-muted-foreground">
                Nodes running trynet versions (development/test network) are marked with an orange "TRYNET" badge in the node details modal.
                In the nodes table, trynet nodes have a subtle orange background to distinguish them from mainnet nodes.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-foreground mb-1">Country Flags</dt>
              <dd className="text-sm text-muted-foreground">
                Country flags are displayed next to node locations throughout the interface - in the nodes table, node details modal,
                globe popups, and geographic charts. This provides quick visual identification of node locations.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-12 animate-slide-in-bottom" style={{ animationDelay: '0.3s', opacity: 0, animationFillMode: 'forwards' }}>
        <h2 className="text-2xl font-semibold text-foreground mb-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <div className="border border-border rounded-lg p-4">
            <h3 className="font-semibold text-foreground mb-2">Why do some nodes show "N/A" for stats?</h3>
            <p className="text-sm text-muted-foreground">
              pNode operators can choose to keep their pRPC endpoint private (localhost-only) for security.
              This is the recommended security configuration and the network-wide standard. Only nodes with public pRPC expose detailed statistics.
              Typically, only ~10-15 nodes per hundred report full hardware metrics. We still track all nodes via gossip for discovery and basic status, but resource metrics are absent by design for security-conscious operators.
            </p>
          </div>
          <div className="border border-border rounded-lg p-4">
            <h3 className="font-semibold text-foreground mb-2">How often is the data updated?</h3>
            <p className="text-sm text-muted-foreground">
              Data automatically refreshes every 60 seconds (1 minute). You can also manually refresh using the refresh button
              in the header. Historical data is stored at ~10-minute intervals, so trend charts show data points at 10-minute intervals.
            </p>
          </div>
          <div className="border border-border rounded-lg p-4">
            <h3 className="font-semibold text-foreground mb-2">How do I export node data?</h3>
            <p className="text-sm text-muted-foreground">
              Go to the Nodes page and look for the "Export" button in the top right. You can download all node data
              in CSV format (for Excel/spreadsheets) or JSON format (for developers/scripts). Exports include all current
              node metrics and status information.
            </p>
          </div>
          <div className="border border-border rounded-lg p-4">
            <h3 className="font-semibold text-foreground mb-2">How does the Scan feature work?</h3>
            <p className="text-sm text-muted-foreground">
              The Scan page uses your IP address (or any IP you enter) to calculate the geographic distance to each node.
              It then ranks nodes by proximity, showing you the 20 closest nodes. This is useful for finding low-latency
              nodes near your location or testing network coverage in specific regions.
            </p>
          </div>
        </div>
      </section>

      {/* Regions & Geographic Browsing */}
      <section className="mb-12 animate-slide-in-right" style={{ animationDelay: '0.35s', opacity: 0, animationFillMode: 'forwards' }}>
        <h2 className="text-2xl font-semibold text-foreground mb-4">Regions & Geographic Browsing</h2>
        <div className="prose prose-gray prose-invert max-w-none">
          <p className="text-foreground mb-4">
            The Regions page lets you explore the network's geographic distribution and browse nodes by location.
          </p>

          <h3 className="text-xl font-semibold text-foreground mb-3">Country View</h3>
          <p className="text-foreground mb-3">
            Each country card displays:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-1 mb-4">
            <li><strong>Country flag</strong> for quick visual identification</li>
            <li><strong>Total nodes</strong> in that country</li>
            <li><strong>Status breakdown</strong> (online, syncing, offline counts)</li>
            <li><strong>Total storage capacity</strong> contributed by nodes in that country</li>
            <li><strong>Total credits</strong> earned by nodes in that country</li>
            <li><strong>Average latency</strong> to nodes in that country (from your location)</li>
          </ul>

          <h3 className="text-xl font-semibold text-foreground mb-3">Continent Overview</h3>
          <p className="text-foreground mb-3">
            The page header shows how many continents have active nodes, giving you a quick sense of global distribution.
          </p>

          <h3 className="text-xl font-semibold text-foreground mb-3">Drilling Down</h3>
          <p className="text-foreground mb-3">
            Click any country card to view all nodes in that country. You can then apply additional filters or sort by
            specific metrics to analyze regional node performance.
          </p>
        </div>
      </section>

      {/* Scan Feature */}
      <section className="mb-12 animate-slide-in-left" style={{ animationDelay: '0.4s', opacity: 0, animationFillMode: 'forwards' }}>
        <h2 className="text-2xl font-semibold text-foreground mb-4">Using the Scan Feature</h2>
        <div className="prose prose-gray prose-invert max-w-none">
          <p className="text-foreground mb-4">
            The Scan feature helps you find the closest nodes to any location by calculating geographic distances and ranking nodes by proximity.
          </p>

          <h3 className="text-xl font-semibold text-foreground mb-3">How to Scan</h3>
          <ol className="list-decimal list-inside text-foreground space-y-2 mb-4">
            <li>Navigate to the Scan page</li>
            <li>Either click "Use My IP Address" for auto-detection, or manually enter any IP address</li>
            <li>Click "Scan" to start the proximity search</li>
            <li>View the top 20 closest nodes ranked by distance</li>
          </ol>

          <h3 className="text-xl font-semibold text-foreground mb-3">Understanding Results</h3>
          <p className="text-foreground mb-3">
            Each result shows:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-1 mb-4">
            <li><strong>Distance</strong> in kilometers (km) or meters (m) from the scan location</li>
            <li><strong>Ranking badge</strong> (1st, 2nd, 3rd for top 3 nodes)</li>
            <li><strong>Status indicator</strong> (color-coded: green = online, yellow = syncing, red = offline)</li>
            <li><strong>City and country</strong> location of the node</li>
            <li><strong>Node details</strong> (click any node to view full information)</li>
          </ul>

          <h3 className="text-xl font-semibold text-foreground mb-3">Globe Integration</h3>
          <p className="text-foreground mb-3">
            After scanning, the 3D globe automatically navigates to the scanned location and highlights nearby nodes,
            giving you a visual representation of node proximity.
          </p>

          <h3 className="text-xl font-semibold text-foreground mb-3">Use Cases</h3>
          <ul className="list-disc list-inside text-foreground space-y-1 mb-4">
            <li>Find low-latency nodes for optimal data access</li>
            <li>Test network coverage in specific geographic regions</li>
            <li>Identify redundancy and failover options near your location</li>
            <li>Analyze regional node distribution patterns</li>
          </ul>
        </div>
      </section>

      <div className="mt-8 pt-6 border-t border-border">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-foreground hover:text-[#F0A741] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

function DeploymentDocs({ onClose }: { onClose: () => void }) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Deployment Documentation</h1>
          <p className="text-muted-foreground">How pGlobe is deployed in production</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:hover:bg-[#1a1a1a] rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="prose prose-gray prose-invert max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Production Architecture</h2>
          <p className="text-foreground mb-4">
            pGlobe is deployed using a two-server architecture:
          </p>
          <div className="bg-[#0f0f0f] border border-border rounded-lg p-6 mb-4">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Frontend (Vercel)</h3>
                <ul className="list-disc list-inside text-sm text-foreground space-y-1">
                  <li>Next.js 14 application hosted on Vercel</li>
                  <li>API proxy routes that forward requests to Render backend</li>
                  <li>No direct database or pRPC access</li>
                  <li>Client-side latency measurement</li>
                  <li>Automatic deployments on git push</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Backend (Render)</h3>
                <ul className="list-disc list-inside text-sm text-foreground space-y-1">
                  <li>Express.js API server hosted on Render</li>
                  <li>Background refresh worker (runs every minute)</li>
                  <li>pRPC fetching and gossip network discovery</li>
                  <li>MongoDB read/write operations</li>
                  <li>Historical data storage</li>
                  <li>Automatic deployments on git push</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Database (MongoDB Atlas)</h3>
                <ul className="list-disc list-inside text-sm text-foreground space-y-1">
                  <li>Node data storage</li>
                  <li>Historical snapshots</li>
                  <li>Geographic location cache</li>
                  <li>Only accessible from Render backend</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Deployment Process</h2>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Initial Setup</h3>
          <p className="text-foreground mb-4">
            The platform was initially deployed as follows:
          </p>

          <div className="mb-6">
            <h4 className="font-semibold text-foreground mb-2">1. Render API Server Setup</h4>
            <ol className="list-decimal list-inside text-foreground space-y-2 mb-4">
              <li>Created Render account and connected GitHub repository</li>
              <li>Created new Web Service named <code className="bg-[#1a1a1a] px-1 rounded">pglobe-api-server</code></li>
              <li>Configured build command: <code className="bg-[#1a1a1a] px-1 rounded">npm install --include=dev</code></li>
              <li>Configured start command: <code className="bg-[#1a1a1a] px-1 rounded">npx tsx render-api-server.ts</code></li>
              <li>Service URL obtained: <code className="bg-[#1a1a1a] px-1 rounded">https://pglobe-api-server.onrender.com</code></li>
            </ol>
          </div>

          <div className="mb-6">
            <h4 className="font-semibold text-foreground mb-2">2. Vercel Frontend Setup</h4>
            <ol className="list-decimal list-inside text-foreground space-y-2 mb-4">
              <li>Created Vercel account and imported GitHub repository</li>
              <li>Vercel auto-detected Next.js configuration</li>
              <li>Frontend URL: <code className="bg-[#1a1a1a] px-1 rounded">https://pglobe.vercel.app</code></li>
            </ol>
          </div>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Continuous Deployment</h3>
          <p className="text-foreground mb-4">
            Both services are configured for automatic deployment:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li><strong>Render:</strong> Automatically deploys when code is pushed to the main branch</li>
            <li><strong>Vercel:</strong> Automatically deploys when code is pushed to the main branch</li>
            <li>Both services pull from the same GitHub repository</li>
            <li>Deployments are independent - frontend and backend can be updated separately</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Deployment Workflow</h2>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Standard Deployment Process</h3>
          <ol className="list-decimal list-inside text-foreground space-y-2 mb-4">
            <li>Make changes locally and test with <code className="bg-[#1a1a1a] px-1 rounded">npm run dev:api</code> and <code className="bg-[#1a1a1a] px-1 rounded">npm run dev</code></li>
            <li>Commit changes: <code className="bg-[#1a1a1a] px-1 rounded">git add .</code> → <code className="bg-[#1a1a1a] px-1 rounded">git commit -m "..."</code></li>
            <li>Push to GitHub: <code className="bg-[#1a1a1a] px-1 rounded">git push</code></li>
            <li>Render automatically detects push and starts deployment</li>
            <li>Vercel automatically detects push and starts deployment</li>
            <li>Both services deploy independently and update production</li>
          </ol>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Monitoring Deployments</h3>
          <p className="text-foreground mb-4">
            Deployment status can be monitored:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li><strong>Render Dashboard:</strong> View build logs, deployment status, and service health</li>
            <li><strong>Vercel Dashboard:</strong> View build logs, deployment status, and function logs</li>
            <li><strong>GitHub Actions:</strong> Optional cron job configured to keep Render service alive (prevents free tier sleep)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Infrastructure Details</h2>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Render Service</h3>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li><strong>Service Type:</strong> Web Service</li>
            <li><strong>Runtime:</strong> Node.js</li>
            <li><strong>Build:</strong> <code className="bg-[#1a1a1a] px-1 rounded">npm install --include=dev</code></li>
            <li><strong>Start:</strong> <code className="bg-[#1a1a1a] px-1 rounded">npx tsx render-api-server.ts</code></li>
            <li><strong>Background Tasks:</strong> Runs background refresh every minute</li>
            <li><strong>API Endpoints:</strong> <code className="bg-[#1a1a1a] px-1 rounded">/api/pnodes</code>, <code className="bg-[#1a1a1a] px-1 rounded">/api/refresh-nodes</code>, <code className="bg-[#1a1a1a] px-1 rounded">/health</code></li>
          </ul>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Vercel Service</h3>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li><strong>Framework:</strong> Next.js 14</li>
            <li><strong>Build:</strong> Automatic (detects Next.js)</li>
            <li><strong>API Routes:</strong> Proxy routes that forward to Render backend</li>
            <li><strong>Static Assets:</strong> Served from Vercel CDN</li>
            <li><strong>Edge Functions:</strong> Not used (all API calls proxy to Render)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Data Flow in Production</h2>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Background Refresh (Render)</h3>
          <ol className="list-decimal list-inside text-foreground space-y-2 mb-4">
            <li>Render API server runs background refresh task every minute</li>
            <li>Queries pRPC endpoints using <code className="bg-[#1a1a1a] px-1 rounded">get-pods-with-stats</code> (v0.7.0+) or <code className="bg-[#1a1a1a] px-1 rounded">get-pods</code> (all versions)</li>
            <li>Enriches nodes with detailed stats via <code className="bg-[#1a1a1a] px-1 rounded">get-stats</code> when pRPC is public</li>
            <li>Fetches geographic location data for nodes</li>
            <li>Fetches on-chain Solana data (registration status, balances)</li>
            <li>Stores/updates nodes in MongoDB</li>
            <li>Creates historical snapshot for trend analysis</li>
          </ol>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">User Request Flow</h3>
          <ol className="list-decimal list-inside text-foreground space-y-2 mb-4">
            <li>User visits pGlobe frontend (Vercel)</li>
            <li>Frontend makes API request to Next.js API route (e.g., <code className="bg-[#1a1a1a] px-1 rounded">/api/pnodes</code>)</li>
            <li>API route proxies request to Render backend with <code className="bg-[#1a1a1a] px-1 rounded">API_SECRET</code> authentication</li>
            <li>Render backend queries MongoDB and returns data</li>
            <li>Frontend receives data and renders UI</li>
            <li>Client-side latency measurement runs in background (deferred using requestIdleCallback)</li>
          </ol>
        </section>
      </div>
    </div>
  );
}

function AnalyticsDocs({ onClose }: { onClose: () => void }) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Analytics & Metrics Guide</h1>
          <p className="text-muted-foreground">Understanding how analytics work in pGlobe</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:hover:bg-[#1a1a1a] rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="prose prose-gray prose-invert max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Overview Page Analytics</h2>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Network Statistics Cards</h3>
          <p className="text-foreground mb-4">
            The top section displays key network metrics calculated in real-time:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li><strong>Total Nodes:</strong> Count of all discovered pNodes in the network</li>
            <li><strong>Online/Syncing/Offline:</strong> Status breakdown based on last seen timestamps</li>
            <li><strong>Storage Capacity:</strong> Total storage capacity allocated by all nodes (in TB)</li>
            <li><strong>Total RAM / Used RAM:</strong> Aggregated RAM metrics showing total capacity and current usage</li>
            <li><strong>Average Metrics:</strong> Calculated averages for uptime, CPU, RAM, and latency</li>
          </ul>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Network Health Score</h3>
          <p className="text-foreground mb-4">
            The health score is a weighted composite metric (0-100) calculated from:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li><strong>40% Availability:</strong> Percentage of nodes that are online</li>
            <li><strong>35% Version Health:</strong> Percentage of nodes running the latest version (using semantic version comparison)</li>
            <li><strong>25% Geographic Distribution:</strong> Diversity score based on node locations across different countries</li>
          </ul>
          <p className="text-foreground mb-4">
            Click on the health score card to see a detailed breakdown of each component.
          </p>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Interactive Globe</h3>
          <p className="text-foreground mb-4">
            The 3D globe visualization shows all nodes with their geographic locations. Each node is represented as a dot,
            colored by status (green = online, yellow = syncing, red = offline). The globe uses MapLibre GL for rendering
            and supports:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li>Drag to rotate</li>
            <li>Scroll/pinch to zoom</li>
            <li>Click nodes to view details</li>
            <li>Arrow keys for navigation</li>
            <li>Auto-rotation (pauses on user interaction)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Analytics Page</h2>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Network Health Chart</h3>
          <p className="text-foreground mb-4">
            A donut chart showing the distribution of node statuses (online, syncing, offline) with percentages.
            Hover over segments to see exact counts. The chart uses visx library for rendering.
          </p>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Performance Metrics</h3>
          <p className="text-foreground mb-4">
            Two side-by-side bar charts displaying:
          </p>

          <div className="mb-4">
            <h4 className="font-semibold text-foreground mb-2">Latency Distribution</h4>
            <p className="text-foreground mb-2">
              Shows how many nodes fall into different latency ranges:
            </p>
            <ul className="list-disc list-inside text-foreground space-y-1 ml-4">
              <li>&lt;50ms</li>
              <li>50-100ms</li>
              <li>100-200ms</li>
              <li>200-500ms</li>
              <li>&gt;500ms</li>
            </ul>
            <p className="text-foreground mt-2 text-sm">
              Latency is measured client-side from your browser to each node's pRPC endpoint. Measurements are cached for 1 hour.
            </p>
          </div>

          <div className="mb-4">
            <h4 className="font-semibold text-foreground mb-2">Resource Utilization</h4>
            <p className="text-foreground mb-2">
              Shows CPU and RAM usage distribution across nodes, grouped into ranges. The chart displays both metrics side-by-side:
            </p>
            <ul className="list-disc list-inside text-foreground space-y-1 ml-4">
              <li>0-25%</li>
              <li>25-50%</li>
              <li>50-75%</li>
              <li>75-100%</li>
            </ul>
            <p className="text-foreground mt-2 text-sm">
              CPU and RAM percentages are shown as separate bars for each range, making it easy to compare resource usage patterns.
            </p>
          </div>

          <div className="mb-4">
            <h4 className="font-semibold text-foreground mb-2">Analytics Cards</h4>
            <p className="text-foreground mb-2">
              The analytics page includes metric cards showing:
            </p>
            <ul className="list-disc list-inside text-foreground space-y-1 ml-4">
              <li>Total Credits: Sum of all credits across the network</li>
              <li>Active Streams: Total number of active network streams</li>
              <li>Avg CPU: Average CPU usage percentage</li>
              <li>Avg RAM: Average RAM usage percentage</li>
            </ul>
          </div>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Geographic Distribution</h3>
          <p className="text-foreground mb-4">
            A horizontal bar chart showing node count by country with country flags. Helps visualize where the network has the most presence
            and geographic diversity. Countries are sorted by node count (highest first). You can switch between different metrics:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-1 ml-4 mb-4">
            <li>Node Count</li>
            <li>Average Latency</li>
            <li>Total Storage</li>
            <li>Online Rate</li>
            <li>Average Uptime</li>
          </ul>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Top Performing Nodes</h3>
          <p className="text-foreground mb-4">
            Leaderboards showing the top 10 nodes by:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li><strong>Uptime:</strong> Nodes with the highest uptime percentage (calculated over 30-day window)</li>
            <li><strong>Storage:</strong> Nodes with the highest storage capacity</li>
            <li><strong>Packets:</strong> Nodes with the highest packet transfer rates</li>
            <li><strong>Credits:</strong> Nodes with the highest reputation credits</li>
            <li><strong>Regional Earnings:</strong> Top earning countries and regions based on aggregate credit accumulation.</li>
          </ul>
          <p className="text-foreground mb-4">
            Click any node in the rankings to view its detailed information.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Node Details Modal</h2>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Historical Data Charts</h3>
          <p className="text-foreground mb-4">
            When viewing a node's details, you can see historical trends for:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li><strong>Uptime Over Time:</strong> Line chart showing uptime percentage trends</li>
            <li><strong>Storage Over Time:</strong> Line chart showing storage capacity trends</li>
            <li><strong>Packets Earned Over Time:</strong> Line chart showing packets earned per time interval (difference between consecutive snapshots)</li>
            <li><strong>Credits Earned Over Time:</strong> Line chart showing credits earned per time interval (difference between consecutive snapshots)</li>
          </ul>
          <p className="text-foreground mb-4">
            Historical data is stored in MongoDB at ~10-minute intervals. Charts use visx library with smooth interpolation between data points.
            X-axis labels are horizontal and automatically skip labels to prevent overlap.
          </p>

          <div className="bg-[#0f0f0f] border border-border rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-foreground mb-2">Understanding Earned Charts</h4>
            <p className="text-sm text-foreground mb-2">
              The <strong>Packets Earned</strong> and <strong>Credits Earned</strong> charts show the amount earned in each time interval,
              not cumulative totals. This means:
            </p>
            <ul className="list-disc list-inside text-sm text-foreground space-y-1 ml-4">
              <li>Each data point shows the <strong>difference</strong> between two consecutive snapshots</li>
              <li>If nothing is earned in an interval, the chart line drops to 0</li>
              <li>The time period label (per minute/hour/day/week) depends on the selected time range</li>
              <li>Tooltips show both "Earned in this interval" and "Cumulative" values for context</li>
            </ul>
            <p className="text-sm text-foreground mt-2">
              This approach gives you a clear view of earning activity patterns over time, showing when nodes are actively
              processing requests versus idle periods.
            </p>
          </div>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Real-time Metrics</h3>
          <p className="text-foreground mb-4">
            The modal displays current metrics including:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li>CPU and RAM usage percentages (with used/total for RAM)</li>
            <li>Client-side latency measurement</li>
            <li>Storage capacity (total allocated space)</li>
            <li>Network activity (packets, streams)</li>
            <li>Node status and version (with TRYNET badge for trynet versions)</li>
            <li>Geographic location with country flag</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Data Collection & Processing</h2>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">How We Build the Nodes List</h3>
          <p className="text-foreground mb-4">
            pGlobe discovers and maintains the network's node list through a multi-stage process that ensures accuracy and completeness:
          </p>

          <div className="bg-[#0f0f0f] border border-border rounded-lg p-6 mb-6">
            <h4 className="font-semibold text-foreground mb-3">Stage 1: Gossip Network Discovery</h4>
            <ol className="list-decimal list-inside text-foreground space-y-2 mb-4">
              <li><strong>Direct Discovery:</strong> Query known pRPC endpoints with <code className="bg-[#1a1a1a] px-1 rounded">get-pods-with-stats</code> to get all nodes they know about</li>
              <li><strong>Network Crawl (optional):</strong> If we find fewer than 150 nodes, query discovered nodes for their peers (recursive gossip)</li>
              <li><strong>Raw Data:</strong> Each response contains node address, public key (pubkey), version, and basic stats</li>
            </ol>
            <p className="text-sm text-foreground mt-2">
              <strong>Why gossip?</strong> The gossip protocol is how pNodes naturally discover each other. By tapping into this,
              we get a complete, decentralized view of the network without any central registry.
            </p>
          </div>

          <div className="bg-[#0f0f0f] border border-border rounded-lg p-6 mb-6">
            <h4 className="font-semibold text-foreground mb-3">Stage 2: Validation & Filtering</h4>
            <p className="text-foreground mb-3">
              Not all discovered nodes make it into our database. We apply strict validation:
            </p>
            <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
              <li><strong>Valid Public Key:</strong> Must be a valid Solana base58-encoded public key (32-44 characters)</li>
              <li><strong>Required Fields:</strong> Must have both an IP address and a public key</li>
              <li><strong>Test Nodes Excluded:</strong> Filters out test/placeholder pubkeys like "TestPubkey14"</li>
            </ul>
            <p className="text-sm text-foreground mt-2">
              <strong>Why filter?</strong> Invalid or test nodes would skew network statistics and provide no useful information.
              We only track real, operational nodes.
            </p>
          </div>

          <div className="bg-[#0f0f0f] border border-border rounded-lg p-6 mb-6">
            <h4 className="font-semibold text-foreground mb-3">Stage 3: Deduplication & Node Identity</h4>
            <p className="text-foreground mb-3">
              <strong>Core principle:</strong> A node's <code className="bg-[#1a1a1a] px-1 rounded">pubkey</code> is its unique identity.
              The same pubkey always represents the same node, even if other properties change.
            </p>
            <p className="text-foreground mb-3">
              <strong>The Challenge:</strong> Nodes can change IP addresses (e.g., server relocation, network changes).
              During discovery, we might see the same pubkey at different IPs, or the same IP with different pubkeys over time.
            </p>
            <p className="text-foreground mb-3">
              <strong>Our Solution - Smart Merging:</strong>
            </p>
            <ol className="list-decimal list-inside text-foreground space-y-2 mb-4">
              <li><strong>Group by pubkey:</strong> All entries with the same pubkey are identified as the same node</li>
              <li><strong>Track IP history:</strong> When a node appears at a new IP, we:
                <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                  <li>Update the <code className="bg-[#1a1a1a] px-1 rounded">address</code> field to the latest IP from gossip</li>
                  <li>Add the old IP to <code className="bg-[#1a1a1a] px-1 rounded">previousAddresses</code> array</li>
                  <li>Preserve all other node data (stats, uptime, balance, etc.)</li>
                </ul>
              </li>
              <li><strong>Version priority:</strong> If multiple entries exist for the same pubkey during discovery, we keep the one with the latest version number</li>
            </ol>

            <div className="bg-blue-950/30 border border-blue-800 rounded-lg p-4 mt-4">
              <h5 className="font-semibold text-foreground mb-2">Example: Node IP Change</h5>
              <div className="text-sm text-foreground space-y-2">
                <p><strong>Discovery 1:</strong> Node <code className="bg-[#1a1a1a] px-1 rounded">EcTqXgB6...</code> at <code className="bg-[#1a1a1a] px-1 rounded">173.212.207.32:9001</code></p>
                <p><strong>Discovery 2 (later):</strong> Same node <code className="bg-[#1a1a1a] px-1 rounded">EcTqXgB6...</code> now at <code className="bg-[#1a1a1a] px-1 rounded">192.168.1.100:9001</code></p>
                <p><strong>Result in database:</strong></p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li><code className="bg-[#1a1a1a] px-1 rounded">address: "192.168.1.100:9001"</code> (latest from gossip)</li>
                  <li><code className="bg-[#1a1a1a] px-1 rounded">previousAddresses: ["173.212.207.32:9001"]</code></li>
                  <li>All historical data (uptime, stats, balance) preserved</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-[#0f0f0f] border border-border rounded-lg p-6 mb-6">
            <h4 className="font-semibold text-foreground mb-3">Stage 4: Enrichment</h4>
            <p className="text-foreground mb-3">
              After deduplication, we enrich each unique node with additional data:
            </p>
            <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
              <li><strong>Geographic Location:</strong> IP geolocation API provides city, country, coordinates</li>
              <li><strong>Solana On-Chain Data:</strong>
                <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                  <li>SOL balance (fetched once, then cached)</li>
                  <li>Account creation date (blockchain history)</li>
                  <li>Registration status (balance &gt; 0)</li>
                </ul>
              </li>
              <li><strong>Pod Credits:</strong> Reputation score from Xandeum credits API</li>
              <li><strong>Status Determination:</strong> Online/syncing/offline based on last seen timestamp</li>
            </ul>
          </div>

          <div className="bg-[#0f0f0f] border border-border rounded-lg p-6 mb-6">
            <h4 className="font-semibold text-foreground mb-3">Stage 5: Storage & Updates</h4>
            <p className="text-foreground mb-3">
              Final step: persist to MongoDB with smart upsert logic:
            </p>
            <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
              <li><strong>New nodes:</strong> Insert with all enriched data</li>
              <li><strong>Existing nodes:</strong> Update with latest data from gossip, preserving historical fields</li>
              <li><strong>Offline nodes:</strong> Mark as offline if not seen in latest gossip, but keep in database</li>
              <li><strong>Historical snapshots:</strong> Every 10 minutes, store network-wide metrics for trend analysis</li>
            </ul>
          </div>

          <div className="bg-yellow-950/30 border border-yellow-800 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-foreground mb-2">💡 Key Insight: Why Deduplication Matters</h4>
            <p className="text-sm text-foreground mb-2">
              During our testing, we discovered that without proper deduplication, we would see discrepancies like:
            </p>
            <ul className="list-disc list-inside text-sm text-foreground space-y-1 ml-4">
              <li><strong>198 entries from gossip → 189 unique nodes in database</strong></li>
              <li>The difference? Duplicate pubkeys at different IPs (e.g., 4 nodes with IP changes = 8 entries)</li>
            </ul>
            <p className="text-sm text-foreground mt-2">
              Our merge strategy ensures we never lose data when nodes change IPs, while maintaining accurate node counts.
            </p>
          </div>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Background Refresh</h3>
          <p className="text-foreground mb-4">
            The Render API server runs a background refresh task every minute that:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li>Fetches fresh node data from the gossip network</li>
            <li>Updates MongoDB with latest node information</li>
            <li>Stores historical snapshots for trend analysis</li>
            <li>Runs independently of user requests</li>
          </ul>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Client-Side Latency Measurement</h3>
          <p className="text-foreground mb-4">
            Latency is measured directly from your browser to each node's pRPC endpoint:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li>Provides accurate latency based on your location and internet connection</li>
            <li>Measurements are cached for 1 hour to improve performance</li>
            <li>Only measures nodes that aren't cached or have expired cache</li>
            <li>Uses deferred measurement (requestIdleCallback) to avoid blocking UI</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function ArchitectureDocs({ onClose }: { onClose: () => void }) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">System Architecture</h1>
          <p className="text-muted-foreground">Technical overview of pGlobe's architecture</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:hover:bg-[#1a1a1a] rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="prose prose-gray prose-invert max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">High-Level Architecture</h2>
          <p className="text-foreground mb-4">
            pGlobe follows a two-server architecture pattern:
          </p>
          <div className="bg-[#0f0f0f] border border-border rounded-lg p-6 mb-4">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Frontend (Vercel)</h3>
                <ul className="list-disc list-inside text-sm text-foreground space-y-1">
                  <li>Next.js 14 application</li>
                  <li>API proxy routes that forward requests to Render backend</li>
                  <li>No direct database or pRPC access</li>
                  <li>Client-side latency measurement</li>
                  <li>Static asset hosting</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Backend (Render)</h3>
                <ul className="list-disc list-inside text-sm text-foreground space-y-1">
                  <li>Express.js API server</li>
                  <li>Background refresh worker (runs every minute)</li>
                  <li>pRPC fetching and gossip network discovery</li>
                  <li>MongoDB read/write operations</li>
                  <li>Historical data storage</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Database (MongoDB)</h3>
                <ul className="list-disc list-inside text-sm text-foreground space-y-1">
                  <li>Node data storage</li>
                  <li>Historical snapshots</li>
                  <li>Geographic location cache</li>
                  <li>Only accessible from Render backend</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Data Flow</h2>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Background Refresh Flow</h3>
          <ol className="list-decimal list-inside text-foreground space-y-2 mb-4">
            <li>Render API server runs background refresh every minute</li>
            <li>Queries pRPC endpoints to discover nodes via gossip</li>
            <li>Fetches detailed stats for nodes with public pRPC</li>
            <li>Enriches with geographic location data</li>
            <li>Stores/updates nodes in MongoDB</li>
            <li>Creates historical snapshot for trend analysis</li>
          </ol>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">User Request Flow</h3>
          <ol className="list-decimal list-inside text-foreground space-y-2 mb-4">
            <li>User visits pGlobe frontend (Vercel)</li>
            <li>Frontend makes API request to Next.js API route</li>
            <li>API route proxies request to Render backend with authentication</li>
            <li>Render backend queries MongoDB and returns data</li>
            <li>Frontend receives data and renders UI</li>
            <li>Client-side latency measurement runs in background</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Technology Stack</h2>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Frontend</h3>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li><strong>Next.js 14:</strong> React framework with App Router</li>
            <li><strong>TypeScript:</strong> Type-safe development</li>
            <li><strong>Tailwind CSS:</strong> Utility-first styling</li>
            <li><strong>visx:</strong> Data visualization library for charts</li>
            <li><strong>MapLibre GL:</strong> 3D globe rendering</li>
            <li><strong>React Context:</strong> Global state management</li>
          </ul>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Backend</h3>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li><strong>Express.js:</strong> Web server framework</li>
            <li><strong>TypeScript:</strong> Type-safe development</li>
            <li><strong>MongoDB:</strong> Document database</li>
            <li><strong>pRPC:</strong> Xandeum protocol for node communication</li>
          </ul>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Infrastructure</h3>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li><strong>Vercel:</strong> Frontend hosting and deployment</li>
            <li><strong>Render:</strong> Backend hosting and deployment</li>
            <li><strong>MongoDB Atlas:</strong> Database hosting</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Performance Optimizations</h2>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Client-Side Optimizations</h3>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li><strong>Lazy Loading:</strong> MapLibreGlobe component loads only when needed</li>
            <li><strong>Deferred Measurements:</strong> Latency and geo enrichment use requestIdleCallback</li>
            <li><strong>Caching:</strong> 6-hour cache for latency measurements in localStorage</li>
            <li><strong>Memoization:</strong> Heavy computations use useMemo to prevent re-calculations</li>
            <li><strong>Code Splitting:</strong> Dynamic imports for heavy components</li>
          </ul>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Server-Side Optimizations</h3>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li><strong>Background Refresh:</strong> Data updates independently of user requests</li>
            <li><strong>MongoDB Indexes:</strong> Optimized queries for fast data retrieval</li>
            <li><strong>Request Deduplication:</strong> Prevents duplicate API calls</li>
            <li><strong>Connection Pooling:</strong> Efficient database connections</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function AIFeaturesDocs({ onClose }: { onClose: () => void }) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">AI Assistant</h1>
          <p className="text-muted-foreground">Your intelligent guide to the pGlobe network</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:hover:bg-[#1a1a1a] rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="prose prose-gray prose-invert max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">What is the AI Assistant?</h2>
          <p className="text-foreground mb-4">
            The AI Assistant is an intelligent chat widget powered by DeepSeek's reasoning model that helps you explore and understand
            the pGlobe network. It can answer questions about nodes, countries, performance metrics, historical trends, and more -
            all in natural language.
          </p>
          <div className="bg-[#0f0f0f] border border-border rounded-lg p-6 mb-4">
            <div className="flex items-start gap-3">
              <Bot className="w-6 h-6 text-[#F0A741] flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-foreground mb-2">Key Features</h3>
                <ul className="list-disc list-inside text-sm text-foreground space-y-1">
                  <li>Natural language queries - ask questions in plain English</li>
                  <li>Real-time data access - queries live network data</li>
                  <li>Smart analysis - combines multiple data sources to answer complex questions</li>
                  <li>Performance insights - analyzes historical trends and patterns</li>
                  <li>Geographic intelligence - finds closest nodes, compares countries</li>
                  <li>Regional Analytics - understands regional health scores and credit earnings</li>
                  <li>Metadata Insights - explains database discovery vs network join times</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">How to Use</h2>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Accessing the AI</h3>
          <p className="text-foreground mb-4">
            Look for the floating chat button in the bottom-right corner of any page. Click it to open the AI Assistant widget.
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li><strong>Desktop:</strong> Bottom-right corner</li>
            <li><strong>Mobile:</strong> Bottom-right corner (optimized for mobile screens)</li>
            <li><strong>Minimize:</strong> Click the minimize button to collapse the widget</li>
            <li><strong>Close:</strong> Click the X button to close completely</li>
          </ul>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Asking Questions</h3>
          <p className="text-foreground mb-4">
            Simply type your question in natural language. The AI understands questions about:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="border border-border rounded-lg p-4">
              <h4 className="font-semibold text-foreground mb-2">Node Queries</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>"How many nodes are in India?"</li>
                <li>"Show me nodes with high CPU usage"</li>
                <li>"What's the health score of node [pubkey]?"</li>
                <li>"Compare these two nodes: [pubkey1] and [pubkey2]"</li>
                <li>"Which nodes joined the database this week?"</li>
              </ul>
            </div>
            <div className="border border-border rounded-lg p-4">
              <h4 className="font-semibold text-foreground mb-2">Regional Analytics</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>"What's the health score of Nigeria?"</li>
                <li>"Which region earns the most credits?"</li>
                <li>"Compare credit trends between US and Germany"</li>
                <li>"How has the online rate changed in Europe?"</li>
              </ul>
            </div>
            <div className="border border-border rounded-lg p-4">
              <h4 className="font-semibold text-foreground mb-2">Performance Analysis</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>"How well has this node performed in the past 5 hours?"</li>
                <li>"Rank countries by node performance"</li>
                <li>"Top 10 nodes by credits"</li>
                <li>"Network trends in the last 24 hours"</li>
              </ul>
            </div>
            <div className="border border-border rounded-lg p-4">
              <h4 className="font-semibold text-foreground mb-2">Geographic Queries</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>"What's my IP address?"</li>
                <li>"Find the closest nodes to me"</li>
                <li>"Compare nodes in US and France"</li>
                <li>"Show me nodes near [IP address]"</li>
              </ul>
            </div>
            <div className="border border-border rounded-lg p-4">
              <h4 className="font-semibold text-foreground mb-2">General Questions</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>"What is pGlobe?"</li>
                <li>"What are pNodes?"</li>
                <li>"How does the Xandeum network work?"</li>
                <li>"What does the status field mean?"</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Understanding Status Updates</h2>
          <p className="text-foreground mb-4">
            When you ask a question, the AI shows real-time status updates as it processes your request:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li><strong>"Thinking..."</strong> - The AI is analyzing your question and deciding what data it needs</li>
            <li><strong>"Querying nodes..."</strong> - Fetching node data from the network</li>
            <li><strong>"Analyzing data..."</strong> - Processing and calculating metrics</li>
            <li><strong>"Generating response..."</strong> - Creating the final answer</li>
          </ul>
          <p className="text-foreground mb-4">
            The animated dots (., .., ...) show that the AI is actively working on your request.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">What the AI Can Do</h2>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Data Queries</h3>
          <p className="text-foreground mb-4">
            The AI can query and filter nodes based on:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li>Country or continent</li>
            <li>Status (online, offline, syncing)</li>
            <li>Resource usage (CPU, RAM percentages)</li>
            <li>Performance metrics (uptime, credits, storage)</li>
            <li>Geographic location</li>
          </ul>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Comparisons & Rankings</h3>
          <p className="text-foreground mb-4">
            Ask the AI to compare or rank:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li>Specific nodes side-by-side</li>
            <li>Countries by various metrics</li>
            <li>Top/bottom performers</li>
            <li>Performance over time</li>
          </ul>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Historical Analysis</h3>
          <p className="text-foreground mb-4">
            The AI can analyze historical data to answer questions about:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li>Node performance over time</li>
            <li>Credit earnings in specific time periods</li>
            <li>Network trends and changes</li>
            <li>Status change patterns</li>
          </ul>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Geographic Intelligence</h3>
          <p className="text-foreground mb-4">
            Location-based queries:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li>Find your IP address and location</li>
            <li>Locate nodes nearest to you or any IP</li>
            <li>Calculate distances between locations and nodes</li>
            <li>Compare geographic distributions</li>
            <li>Analyze historical patterns for specific regions or the whole network</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Tips for Best Results</h2>

          <div className="bg-blue-950/30 border border-blue-800 rounded-lg p-6 mb-4">
            <h3 className="font-semibold text-foreground mb-3">Be Specific</h3>
            <p className="text-foreground mb-2">
              More specific questions get better answers:
            </p>
            <ul className="list-disc list-inside text-sm text-foreground space-y-1 ml-4">
              <li>✅ "How many nodes are using 50% or more RAM?"</li>
              <li>❌ "What about RAM?"</li>
            </ul>
          </div>

          <div className="bg-green-950/30 border border-green-800 rounded-lg p-6 mb-4">
            <h3 className="font-semibold text-foreground mb-3">Use Natural Language</h3>
            <p className="text-foreground mb-2">
              The AI understands conversational queries:
            </p>
            <ul className="list-disc list-inside text-sm text-foreground space-y-1 ml-4">
              <li>✅ "Show me the best performing nodes in France"</li>
              <li>✅ "What's happening with nodes in Africa?"</li>
              <li>✅ "Compare US and Germany"</li>
            </ul>
          </div>

          <div className="bg-yellow-950/30 border border-yellow-800 rounded-lg p-6 mb-4">
            <h3 className="font-semibold text-foreground mb-3">Time Ranges</h3>
            <p className="text-foreground mb-2">
              Specify time ranges for historical queries:
            </p>
            <ul className="list-disc list-inside text-sm text-foreground space-y-1 ml-4">
              <li>"in the past 5 hours"</li>
              <li>"over the last 24 hours"</li>
              <li>"in the past week"</li>
            </ul>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Technical Details & Accuracy</h2>

          <div className="bg-orange-950/30 border border-orange-800 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-foreground mb-2">⚠️ Important Note on Metadata</h4>
            <p className="text-sm text-foreground mb-2">
              <strong>Created At Fields:</strong> The timestamps for when a pNode "joined" the network reflect when pGlobe first discovered the node in our database. It does not necessarily reflect the official Solana on-chain registration time.
            </p>
            <p className="text-sm text-foreground">
              <strong>Snapshot Frequency:</strong> Network-wide snapshots are recorded every <strong>10 minutes</strong>. Historical charts and AI-driven performance trends reflect these 10-minute intervals.
            </p>
          </div>

          <h2 className="text-2xl font-semibold text-foreground mb-4">Technical Details</h2>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">AI Model</h3>
          <p className="text-foreground mb-4">
            The AI Assistant uses DeepSeek's reasoning model (R1), which provides:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li>Advanced reasoning capabilities for complex queries</li>
            <li>Function calling to query real-time network data</li>
            <li>Smart combination of multiple data sources</li>
            <li>Natural language understanding and generation</li>
          </ul>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Data Access</h3>
          <p className="text-foreground mb-4">
            The AI has access to:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li>Current node data (status, metrics, location)</li>
            <li>Historical snapshots (10-minute intervals)</li>
            <li>Network statistics and aggregates</li>
            <li>Geographic location data</li>
            <li>Credit change history</li>
          </ul>

          <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">Privacy & Security</h3>
          <p className="text-foreground mb-4">
            Your conversations are:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
            <li>Processed securely via server-side API routes</li>
            <li>Not stored permanently (conversation history is session-based)</li>
            <li>Only used to provide context for follow-up questions</li>
            <li>Never shared with third parties</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
