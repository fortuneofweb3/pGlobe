'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import { useNodes } from '@/lib/context/NodesContext';

export default function HelpPage() {
  const { nodes, loading, lastUpdate, availableNetworks, currentNetwork, refreshNodes } = useNodes();

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
      <Header
        activePage="help"
        nodeCount={nodes.length}
        lastUpdate={lastUpdate}
        loading={loading}
        onRefresh={() => refreshNodes()}
        networks={availableNetworks}
        currentNetwork={currentNetwork}
        onNetworkChange={() => {}}
        showNetworkSelector={false}
      />

      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 space-y-6">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F0A741] mb-2">pGlobe Help & Documentation</h1>
            <p className="text-foreground/70 text-sm sm:text-base">
              Your complete guide to using the Xandeum pNode Analytics Platform
            </p>
          </div>

          {/* What is pGlobe */}
          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-[#3F8277]">●</span> What is pGlobe?
            </h2>
            <div className="bg-muted/30 rounded-lg p-4 sm:p-6 space-y-4">
              <p className="text-foreground/80 leading-relaxed">
                <strong className="text-[#F0A741]">pGlobe</strong> is a real-time analytics and monitoring platform for the <strong className="text-[#F0A741]">Xandeum pNode network</strong>. 
                It provides comprehensive visibility into the decentralized storage layer that powers Solana dApps with scalable, 
                affordable data storage.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="bg-black/20 rounded-lg p-4 border border-[#F0A741]/10">
                  <h3 className="font-semibold text-[#F0A741] mb-2">What are pNodes?</h3>
                  <p className="text-sm text-foreground/70">
                    Provider Nodes (pNodes) form a distributed storage network where each node contributes storage capacity 
                    and earns rewards for serving data to applications. They're the backbone of Xandeum's decentralized storage infrastructure.
                  </p>
                </div>
                <div className="bg-black/20 rounded-lg p-4 border border-[#F0A741]/10">
                  <h3 className="font-semibold text-[#F0A741] mb-2">Why Use pGlobe?</h3>
                  <p className="text-sm text-foreground/70">
                    Monitor network health, track node performance, analyze storage distribution, and make informed decisions 
                    about staking or operating nodes. All in real-time with historical data tracking.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Getting Started */}
          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-[#F0A741]">●</span> Getting Started
            </h2>
            <div className="bg-muted/30 rounded-lg p-4 sm:p-6 space-y-4">
              <h3 className="font-semibold text-foreground mb-3">Navigation</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black/20 rounded-lg p-4 border border-[#3F8277]/20">
                  <h4 className="font-medium text-[#3F8277] mb-2">Overview</h4>
                  <p className="text-sm text-foreground/70">
                    The main dashboard with interactive globe, network statistics, health score, and node list. 
                    Click any node on the globe or in the list to view detailed information.
                  </p>
                </div>
                <div className="bg-black/20 rounded-lg p-4 border border-[#3F8277]/20">
                  <h4 className="font-medium text-[#3F8277] mb-2">Analytics</h4>
                  <p className="text-sm text-foreground/70">
                    Deep dive into network metrics with charts showing performance trends, resource utilization, 
                    latency distribution, and geographic metrics.
                  </p>
                </div>
                <div className="bg-black/20 rounded-lg p-4 border border-[#3F8277]/20">
                  <h4 className="font-medium text-[#3F8277] mb-2">Scan</h4>
                  <p className="text-sm text-foreground/70">
                    Search and filter nodes by various criteria. Export data, view rankings, and compare node performance.
                  </p>
                </div>
                <div className="bg-black/20 rounded-lg p-4 border border-[#3F8277]/20">
                  <h4 className="font-medium text-[#3F8277] mb-2">Help</h4>
                  <p className="text-sm text-foreground/70">
                    This page! Documentation, FAQs, and guides to help you get the most out of pGlobe.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="font-semibold text-foreground mb-3">Quick Actions</h3>
                <ul className="space-y-2 text-sm text-foreground/70">
                  <li className="flex items-start gap-2">
                    <span className="text-[#F0A741] mt-1">•</span>
                    <span><strong>Refresh Data:</strong> Click the refresh button (↻) in the header to manually update node data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#F0A741] mt-1">•</span>
                    <span><strong>Auto-refresh:</strong> Data automatically refreshes every 30 seconds by default</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#F0A741] mt-1">•</span>
                    <span><strong>View Node Details:</strong> Click any node on the globe, in the list, or in rankings to see full details</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#F0A741] mt-1">•</span>
                    <span><strong>Export Data:</strong> Use the export button in the Scan page to download node data as CSV or JSON</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Using the Overview Page */}
          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-purple-400">●</span> Using the Overview Page
            </h2>
            <div className="bg-muted/30 rounded-lg p-4 sm:p-6 space-y-4">
              <h3 className="font-semibold text-foreground mb-3">Interactive Globe</h3>
              <div className="bg-black/20 rounded-lg p-4 space-y-2">
                <p className="text-sm text-foreground/70 mb-3">
                  The 3D globe visualization shows all nodes in the network with their geographic locations. 
                  Each dot represents a pNode, and colors indicate status (green = online, yellow = syncing, red = offline).
                </p>
                <ul className="space-y-2 text-sm text-foreground/70">
                  <li className="flex items-start gap-2">
                    <span className="text-[#F0A741] mt-1">•</span>
                    <span><strong>Click a node</strong> - Opens detailed node information modal</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#F0A741] mt-1">•</span>
                    <span><strong>Drag</strong> - Rotate the globe (stops auto-rotation)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#F0A741] mt-1">•</span>
                    <span><strong>Scroll / Pinch</strong> - Zoom in/out</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#F0A741] mt-1">•</span>
                    <span><strong>Arrow keys</strong> - Navigate between nodes (when a node is selected)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#F0A741] mt-1">•</span>
                    <span><strong>&lt; / &gt; buttons</strong> - Previous/next node navigation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#F0A741] mt-1">•</span>
                    <span><strong>Reset button</strong> - Return to default view and resume auto-rotation</span>
                  </li>
                </ul>
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="font-semibold text-foreground mb-3">Network Statistics Cards</h3>
                <p className="text-sm text-foreground/70 mb-3">
                  The top section displays key network metrics at a glance:
                </p>
                <ul className="space-y-2 text-sm text-foreground/70">
                  <li className="flex items-start gap-2">
                    <span className="text-[#3F8277] mt-1">•</span>
                    <span><strong>Total Nodes:</strong> Total number of pNodes discovered in the network</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#3F8277] mt-1">•</span>
                    <span><strong>Online/Syncing/Offline:</strong> Current status breakdown of all nodes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#3F8277] mt-1">•</span>
                    <span><strong>Storage Capacity/Used:</strong> Total network storage metrics</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#3F8277] mt-1">•</span>
                    <span><strong>Average Metrics:</strong> Uptime, CPU, RAM, and latency averages</span>
                  </li>
                </ul>
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="font-semibold text-foreground mb-3">Network Health Score</h3>
                <p className="text-sm text-foreground/70">
                  The health score (0-100) is displayed prominently and calculated from multiple factors. 
                  Click on it to see a detailed breakdown of how the score is calculated.
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="font-semibold text-foreground mb-3">Node List</h3>
                <p className="text-sm text-foreground/70">
                  Below the globe, you'll find a sortable table of all nodes. Click any row to view detailed information 
                  including historical data, performance metrics, and network activity.
                </p>
              </div>
            </div>
          </section>

          {/* Using the Analytics Page */}
          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-blue-400">●</span> Using the Analytics Page
            </h2>
            <div className="bg-muted/30 rounded-lg p-4 sm:p-6 space-y-4">
              <p className="text-foreground/80">
                The Analytics page provides detailed visualizations and insights into network performance and distribution.
              </p>
              
              <div className="space-y-4">
                <div className="bg-black/20 rounded-lg p-4 border border-[#F0A741]/10">
                  <h4 className="font-semibold text-[#F0A741] mb-2">Network Health Chart</h4>
                  <p className="text-sm text-foreground/70">
                    Visual breakdown of node status distribution (online, syncing, offline) with percentages. 
                    Hover over segments to see exact counts.
                  </p>
                </div>

                <div className="bg-black/20 rounded-lg p-4 border border-[#F0A741]/10">
                  <h4 className="font-semibold text-[#F0A741] mb-2">Performance Metrics</h4>
                  <p className="text-sm text-foreground/70 mb-2">
                    Two bar charts showing:
                  </p>
                  <ul className="text-sm text-foreground/70 space-y-1 ml-4">
                    <li>• <strong>Latency Distribution:</strong> How many nodes fall into different latency ranges</li>
                    <li>• <strong>Resource Utilization:</strong> CPU and RAM usage distribution across nodes</li>
                  </ul>
                  <p className="text-sm text-foreground/70 mt-2">
                    Hover over bars to see exact values and node counts.
                  </p>
                </div>

                <div className="bg-black/20 rounded-lg p-4 border border-[#F0A741]/10">
                  <h4 className="font-semibold text-[#F0A741] mb-2">Geographic Distribution</h4>
                  <p className="text-sm text-foreground/70">
                    Horizontal bar chart showing node count by country. Helps visualize where the network 
                    has the most presence and geographic diversity.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Using the Scan Page */}
          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-cyan-400">●</span> Using the Scan Page
            </h2>
            <div className="bg-muted/30 rounded-lg p-4 sm:p-6 space-y-4">
              <h3 className="font-semibold text-foreground mb-3">Search & Filter</h3>
              <ul className="space-y-2 text-sm text-foreground/70">
                <li className="flex items-start gap-2">
                  <span className="text-[#F0A741] mt-1">•</span>
                  <span><strong>Search Bar:</strong> Search by node ID, public key, IP address, or location (city/country)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#F0A741] mt-1">•</span>
                  <span><strong>Status Filter:</strong> Filter by Online, Syncing, or Offline status</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#F0A741] mt-1">•</span>
                  <span><strong>Version Filter:</strong> Filter nodes by their Pod version (e.g., 0.7.3, 0.7.2)</span>
                </li>
              </ul>

              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="font-semibold text-foreground mb-3">Sorting</h3>
                <p className="text-sm text-foreground/70 mb-2">
                  Click column headers to sort by:
                </p>
                <ul className="space-y-1 text-sm text-foreground/70 ml-4">
                  <li>• Reputation score</li>
                  <li>• Uptime percentage</li>
                  <li>• Latency (response time)</li>
                  <li>• Storage usage</li>
                  <li>• Node ID</li>
                </ul>
                <p className="text-sm text-foreground/70 mt-2">
                  Click again to reverse the sort order.
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="font-semibold text-foreground mb-3">Node Rankings</h3>
                <p className="text-sm text-foreground/70">
                  View top-performing nodes by uptime or storage. These leaderboards help identify the most 
                  reliable and active nodes in the network.
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="font-semibold text-foreground mb-3">Export Data</h3>
                <p className="text-sm text-foreground/70">
                  Use the export button to download the current filtered/sorted node data as CSV or JSON. 
                  Perfect for further analysis in spreadsheets or custom tools.
                </p>
              </div>
            </div>
          </section>

          {/* Understanding Metrics */}
          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-[#F0A741]">●</span> Understanding the Metrics
            </h2>
            
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-3">Node Status</h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-[#3F8277]">Online</dt>
                    <dd className="text-sm text-foreground/70">
                      Node was seen in gossip within the last 5 minutes. These are actively participating nodes.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-[#F0A741]">Syncing</dt>
                    <dd className="text-sm text-foreground/70">
                      Node was seen within the last hour but not in the last 5 minutes. May be catching up on network state.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-red-400">Offline</dt>
                    <dd className="text-sm text-foreground/70">
                      Node hasn't been seen for over an hour. May be down, disconnected, or experiencing issues.
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="bg-muted/30 rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-3">Performance Metrics</h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-[#F0A741]">Uptime (%)</dt>
                    <dd className="text-sm text-foreground/70">
                      Percentage of time the node has been continuously running, calculated over a 30-day window. 
                      Higher uptime (95%+) indicates a reliable, well-maintained node.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-[#F0A741]">CPU (%)</dt>
                    <dd className="text-sm text-foreground/70">
                      Processor utilization. Shows how much of the node's CPU capacity is being used. 
                      Lower values (under 50%) mean more headroom for growth and better performance.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-[#F0A741]">RAM (%)</dt>
                    <dd className="text-sm text-foreground/70">
                      Memory usage as a percentage of total available RAM. Typical pNode setups use 2-8GB 
                      depending on data volume. High RAM usage may indicate memory pressure.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-[#F0A741]">Latency (ms)</dt>
                    <dd className="text-sm text-foreground/70">
                      Response time when querying node statistics via pRPC. Measured server-side, 
                      so it's not affected by your internet connection. Lower is better (under 100ms is excellent).
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="bg-muted/30 rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-3">Storage Metrics</h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-[#3F8277]">Capacity</dt>
                    <dd className="text-sm text-foreground/70">
                      Estimated total storage capacity across all reporting nodes. Calculated based on 
                      actual data stored (nodes typically provision 1.5x current usage for headroom).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-[#3F8277]">Used</dt>
                    <dd className="text-sm text-foreground/70">
                      Total data currently stored by the network. This is real dApp data being served 
                      to applications using Xandeum storage. Shows actual network utilization.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-[#3F8277]">Usage %</dt>
                    <dd className="text-sm text-foreground/70">
                      Percentage of capacity currently in use. Higher values indicate more active storage usage.
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="bg-muted/30 rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-3">Network Activity</h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-[#3F8277]">Packets Received/Sent</dt>
                    <dd className="text-sm text-foreground/70">
                      Network traffic metrics showing data packets. Higher values indicate more network activity.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-[#3F8277]">Active Streams</dt>
                    <dd className="text-sm text-foreground/70">
                      Number of active data streams. Shows how many concurrent data transfers the node is handling.
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          {/* Network Health Score */}
          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-red-400">●</span> Network Health Score
            </h2>
            <div className="bg-muted/30 rounded-lg p-6 space-y-4">
              <p className="text-foreground/80">
                The health score (0-100) is a weighted composite metric that provides an overall assessment of network health:
              </p>
              <ul className="list-disc list-inside text-foreground/70 space-y-2 ml-4">
                <li><strong>40%</strong> - Availability (online nodes / total nodes)</li>
                <li><strong>35%</strong> - Version Health (% of nodes on the latest version)</li>
                <li><strong>25%</strong> - Geographic Distribution (diversity of node locations)</li>
              </ul>
              <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#3F8277]"></span>
                  <span className="text-sm text-foreground/70">80-100: Excellent</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#F0A741]"></span>
                  <span className="text-sm text-foreground/70">60-79: Good</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-orange-400"></span>
                  <span className="text-sm text-foreground/70">40-59: Fair</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-400"></span>
                  <span className="text-sm text-foreground/70">0-39: Poor</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Click on the health score card to see a detailed breakdown of each component.
              </p>
            </div>
          </section>

          {/* Node Details Modal */}
          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-green-400">●</span> Node Details & Historical Data
            </h2>
            <div className="bg-muted/30 rounded-lg p-4 sm:p-6 space-y-4">
              <p className="text-foreground/80">
                Clicking any node opens a detailed modal with comprehensive information:
              </p>
              <ul className="space-y-2 text-sm text-foreground/70">
                <li className="flex items-start gap-2">
                  <span className="text-[#F0A741] mt-1">•</span>
                  <span><strong>Basic Info:</strong> Public key, version, status, registration status, and location</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#F0A741] mt-1">•</span>
                  <span><strong>Performance Metrics:</strong> Current CPU, RAM, latency, and uptime</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#F0A741] mt-1">•</span>
                  <span><strong>Storage Info:</strong> Capacity, used space, and usage percentage</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#F0A741] mt-1">•</span>
                  <span><strong>Network Activity:</strong> Packets, streams, and network statistics</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#F0A741] mt-1">•</span>
                  <span><strong>Historical Data:</strong> Charts showing uptime and storage trends over time (if available)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#F0A741] mt-1">•</span>
                  <span><strong>Raw Data:</strong> Complete JSON response from the pRPC API</span>
                </li>
              </ul>
              <div className="bg-black/20 rounded-lg p-4 mt-4 border border-[#F0A741]/10">
                <p className="text-sm text-foreground/70">
                  <strong className="text-[#F0A741]">Note:</strong> Historical data is only available for nodes that have been 
                  tracked over time. The data may take a few seconds to load.
                </p>
              </div>
            </div>
          </section>

          {/* Data Sources */}
          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-blue-400">●</span> How Data is Collected
            </h2>
            <div className="bg-muted/30 rounded-lg p-4 sm:p-6 space-y-4">
              <p className="text-foreground/80">
                pGlobe uses a <strong>pure gossip approach</strong> to discover and monitor nodes:
              </p>
              <ol className="list-decimal list-inside text-foreground/70 space-y-2 ml-4">
                <li>Query known pRPC endpoints with <code className="bg-muted px-1.5 py-0.5 rounded text-xs">get-pods</code> to discover nodes in the gossip network</li>
                <li>Deduplicate nodes by public key (each node has a unique identifier)</li>
                <li>Enrich with detailed stats via <code className="bg-muted px-1.5 py-0.5 rounded text-xs">get-stats</code> when pRPC is publicly accessible</li>
                <li>Add geographic location via IP geolocation API</li>
                <li>Store historical snapshots for trend analysis</li>
              </ol>
              <div className="bg-black/20 rounded-lg p-4 mt-4 border border-[#F0A741]/10">
                <p className="text-sm text-foreground/70">
                  <strong className="text-[#F0A741]">Security Note:</strong> Most nodes keep pRPC private (localhost-only) for security, 
                  which is the recommended configuration. Only nodes with public pRPC (configured with <code className="bg-muted px-1 rounded">--rpc-ip 0.0.0.0</code>) 
                  expose detailed statistics. This is why some metrics show "N/A" or "Limited data".
                </p>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-cyan-400">●</span> Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-2">Why do some nodes show "N/A" for stats?</h3>
                <p className="text-sm text-foreground/70">
                  pNode operators can choose to keep their pRPC endpoint private (localhost-only) for security. 
                  This is the recommended security configuration. Only nodes with public pRPC expose detailed statistics. 
                  We still track these nodes for network discovery and basic status, but detailed metrics aren't available.
                </p>
              </div>
              <div className="bg-muted/30 rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-2">Why are multiple nodes at the same location?</h3>
                <p className="text-sm text-foreground/70">
                  Many nodes run in the same datacenter or cloud provider (e.g., Hetzner, Contabo, AWS). 
                  While they appear at the same geographic location, each is a separate, unique node with its own 
                  public key and contributes independently to the network. Geographic diversity is still important 
                  for network resilience.
                </p>
              </div>
              <div className="bg-muted/30 rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-2">What's the difference between DevNet and MainNet?</h3>
                <p className="text-sm text-foreground/70">
                  <strong>DevNet</strong> is the active test network with real nodes running test software. 
                  <strong>MainNet</strong> is the production network that will launch when Xandeum goes fully live. 
                  Currently, only DevNet is active. You can switch between networks using the network selector in the header.
                </p>
              </div>
              <div className="bg-muted/30 rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-2">How often is the data updated?</h3>
                <p className="text-sm text-foreground/70">
                  Data automatically refreshes every 30 seconds. You can also manually refresh using the refresh button 
                  in the header. Historical data is stored hourly, so trend charts show data points at hourly intervals.
                </p>
              </div>
              <div className="bg-muted/30 rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-2">Can I use this data for staking decisions?</h3>
                <p className="text-sm text-foreground/70">
                  Yes! The platform provides comprehensive metrics to help you make informed decisions. Look for nodes with 
                  high uptime (95%+), latest version, good performance metrics, and active network participation. 
                  The rankings and filters are particularly useful for identifying reliable nodes.
                </p>
              </div>
              <div className="bg-muted/30 rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-2">Is there an API I can use?</h3>
                <p className="text-sm text-foreground/70">
                  Yes! The platform exposes a RESTful API for programmatic access. Check the API documentation 
                  for endpoints, authentication, and usage examples. The API provides access to all the same data 
                  you see in the dashboard.
                </p>
              </div>
            </div>
          </section>

          {/* Additional Resources */}
          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-[#F0A741]">●</span> Additional Resources
            </h2>
            <div className="bg-muted/30 rounded-lg p-6">
              <ul className="space-y-3">
                <li>
                  <a 
                    href="https://xandeum.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#F0A741] hover:text-[#F0A741]/80 hover:underline flex items-center gap-2 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <span className="font-medium">Xandeum Official Website</span>
                    <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </li>
                <li>
                  <a 
                    href="https://docs.xandeum.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#F0A741] hover:text-[#F0A741]/80 hover:underline flex items-center gap-2 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span className="font-medium">Xandeum Documentation</span>
                    <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </li>
              </ul>
            </div>
          </section>

          <div className="mt-8 pt-6 border-t border-border">
            <Link 
              href="/"
              className="inline-flex items-center gap-2 text-[#F0A741] hover:text-[#F0A741]/80 hover:underline transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
