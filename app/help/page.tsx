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
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 space-y-3 sm:space-y-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#FFD700] mb-6">pGlobe Help & Documentation</h1>

        {/* What is pGlobe */}
        <section className="mb-8">
          <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2">
            <span className="text-[#00FF88]">●</span> What is pGlobe?
          </h2>
          <div className="bg-muted/30 rounded-lg p-4 sm:p-6 space-y-3 sm:space-y-4">
            <p className="text-foreground/80">
              pGlobe is a real-time analytics dashboard for the <strong className="text-[#FFD700]">Xandeum pNode network</strong>. 
              It provides visibility into the decentralized storage layer that powers Solana dApps with scalable, 
              affordable data storage.
            </p>
            <p className="text-foreground/80">
              pNodes (Provider Nodes) form a distributed storage network where each node contributes storage capacity 
              and earns rewards for serving data to applications.
            </p>
          </div>
        </section>

        {/* Understanding the Metrics */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-[#FFD700]">●</span> Understanding the Metrics
          </h2>
          
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-6">
              <h3 className="font-semibold text-foreground mb-3">Network Stats</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-[#00FF88]">Total Nodes</dt>
                  <dd className="text-sm text-foreground/70">Total number of pNodes discovered in the gossip network.</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-[#00FF88]">Online / Syncing / Offline</dt>
                  <dd className="text-sm text-foreground/70">
                    <strong>Online:</strong> Seen in gossip within last 5 minutes. 
                    <strong className="ml-2">Syncing:</strong> Seen within last hour. 
                    <strong className="ml-2">Offline:</strong> Not seen for over an hour.
                  </dd>
                </div>
              </dl>
            </div>

            <div className="bg-muted/30 rounded-lg p-6">
              <h3 className="font-semibold text-foreground mb-3">Performance Metrics</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-[#FFD700]">Avg Uptime (%)</dt>
                  <dd className="text-sm text-foreground/70">
                    Percentage of time nodes have been continuously running, calculated over a 30-day window. 
                    Higher uptime indicates more reliable nodes.
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-[#FFD700]">Avg CPU (%)</dt>
                  <dd className="text-sm text-foreground/70">
                    Average processor utilization across reporting nodes. This shows how much of each node's 
                    CPU capacity is being used by the pNode software. Lower values mean more headroom for growth.
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-[#FFD700]">Avg RAM (%)</dt>
                  <dd className="text-sm text-foreground/70">
                    Average memory usage as a percentage of total available RAM on each node. 
                    Typical pNode setups use 2-8GB depending on data volume.
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-[#FFD700]">Avg Latency (ms)</dt>
                  <dd className="text-sm text-foreground/70">
                    Average response time when querying node statistics via pRPC. Measured server-side 
                    (not affected by your internet connection). Lower is better.
                  </dd>
                </div>
              </dl>
            </div>

            <div className="bg-muted/30 rounded-lg p-6">
              <h3 className="font-semibold text-foreground mb-3">Storage Metrics</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-[#00FF88]">Capacity</dt>
                  <dd className="text-sm text-foreground/70">
                    Estimated total storage capacity across all reporting nodes. Calculated based on 
                    actual data stored (nodes typically provision 1.5x current usage).
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-[#00FF88]">Used</dt>
                  <dd className="text-sm text-foreground/70">
                    Total data currently stored by the network. This is real dApp data being served 
                    to applications using Xandeum storage.
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* Network Health Score */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-red-400">●</span> Network Health Score
          </h2>
          <div className="bg-muted/30 rounded-lg p-6 space-y-4">
            <p className="text-foreground/80">
              The health score (0-100) is a weighted composite metric:
            </p>
            <ul className="list-disc list-inside text-foreground/70 space-y-2 ml-4">
              <li><strong>40%</strong> - Online node percentage (online nodes / total nodes)</li>
              <li><strong>30%</strong> - Average uptime of reporting nodes</li>
              <li><strong>20%</strong> - Version consistency (nodes on latest version)</li>
              <li><strong>10%</strong> - Recent activity (nodes seen in last 10 minutes)</li>
            </ul>
            <div className="flex gap-4 mt-4">
              <span className="text-[#00FF88]">● 80-100: Excellent</span>
              <span className="text-[#FFD700]">● 60-79: Good</span>
              <span className="text-orange-400">● 40-59: Fair</span>
              <span className="text-red-400">● 0-39: Poor</span>
            </div>
          </div>
        </section>

        {/* Data Sources */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-blue-400">●</span> Data Sources
          </h2>
          <div className="bg-muted/30 rounded-lg p-6 space-y-4">
            <p className="text-foreground/80">
              pGlobe uses a <strong>pure gossip approach</strong> to discover nodes:
            </p>
            <ol className="list-decimal list-inside text-foreground/70 space-y-2 ml-4">
              <li>Query known pRPC endpoints with <code className="bg-muted px-1 rounded">get-pods</code> to discover nodes in gossip</li>
              <li>Deduplicate nodes by public key</li>
              <li>Enrich with detailed stats via <code className="bg-muted px-1 rounded">get-stats</code> (when pRPC is public)</li>
              <li>Add geographic location via IP geolocation API</li>
            </ol>
            <p className="text-sm text-muted-foreground mt-4">
              <strong>Note:</strong> Most nodes keep pRPC private (localhost-only) for security. 
              Only ~10-15 nodes expose public pRPC, which is why detailed performance metrics 
              are marked "Limited data" in some cases.
            </p>
          </div>
        </section>

        {/* Globe Interaction */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-purple-400">●</span> Globe Interaction
          </h2>
          <div className="bg-muted/30 rounded-lg p-6">
            <ul className="text-foreground/70 space-y-2">
              <li><strong>Click a node</strong> - View node details page</li>
              <li><strong>Drag</strong> - Rotate the globe (stops auto-rotation)</li>
              <li><strong>Scroll</strong> - Zoom in/out</li>
              <li><strong>Arrow keys</strong> - Navigate between nodes</li>
              <li><strong>&lt; / &gt; buttons</strong> - Previous/next node</li>
              <li><strong>Reset button</strong> - Return to default view</li>
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-cyan-400">●</span> FAQ
          </h2>
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-6">
              <h3 className="font-semibold text-foreground mb-2">Why do some nodes show "N/A" for stats?</h3>
              <p className="text-sm text-foreground/70">
                pNode operators can choose to keep their pRPC endpoint private (localhost-only). 
                This is the recommended security configuration. Only nodes with public pRPC 
                (configured with <code className="bg-muted px-1 rounded">--rpc-ip 0.0.0.0</code>) 
                expose detailed statistics.
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-6">
              <h3 className="font-semibold text-foreground mb-2">Why are multiple nodes at the same location?</h3>
              <p className="text-sm text-foreground/70">
                Many nodes run in the same datacenter (e.g., Hetzner, Contabo). 
                While they appear at the same geographic location, each is a separate, 
                unique node with its own public key and contributes independently to the network.
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-6">
              <h3 className="font-semibold text-foreground mb-2">What's the difference between DevNet and MainNet?</h3>
              <p className="text-sm text-foreground/70">
                DevNet is the active test network with real nodes. MainNet is not yet launched 
                and will be the production network when Xandeum goes live.
              </p>
            </div>
          </div>
        </section>

        {/* Deployment & Usage Documentation */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-[#00FF88]">●</span> Deployment & Usage Documentation
          </h2>
              <div className="bg-gradient-to-br from-muted/40 to-muted/20 rounded-lg p-6 sm:p-8 border border-[#FFD700]/20">
            <div className="space-y-6">
              <p className="text-foreground/90 leading-relaxed">
                The <strong className="text-[#FFD700]">Xandeum pNode Analytics Platform</strong> is a production-ready, 
                enterprise-grade monitoring solution designed for seamless deployment and integration. Built with 
                Next.js 14 and modern web technologies, the platform offers comprehensive real-time analytics, 
                historical data tracking, and powerful visualization capabilities for monitoring the Xandeum 
                decentralized storage network.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-black/20 rounded-lg p-5 border border-[#FFD700]/10">
                  <h4 className="font-semibold text-[#FFD700] mb-3 text-base flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Quick Start
                  </h4>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    Get up and running quickly with our streamlined installation process. 
                    Configure environment variables, connect to MongoDB, and start monitoring 
                    your network in minutes.
                  </p>
                </div>
                <div className="bg-black/20 rounded-lg p-5 border border-[#FFD700]/10">
                  <h4 className="font-semibold text-[#FFD700] mb-3 text-base flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Production Deployment
                  </h4>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    Deploy to Vercel, AWS, Google Cloud, or any Node.js hosting platform. 
                    Includes Docker configuration, environment setup, and production 
                    optimization strategies.
                  </p>
                </div>
                <div className="bg-black/20 rounded-lg p-5 border border-[#FFD700]/10">
                  <h4 className="font-semibold text-[#FFD700] mb-3 text-base flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    API Integration
                  </h4>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    Comprehensive RESTful API with full documentation. Access node data, 
                    network statistics, and analytics through standardized endpoints with 
                    authentication and rate limiting support.
                  </p>
                </div>
                <div className="bg-black/20 rounded-lg p-5 border border-[#FFD700]/10">
                  <h4 className="font-semibold text-[#FFD700] mb-3 text-base flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Configuration
                  </h4>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    Customize pRPC endpoints, MongoDB connection strings, refresh intervals, 
                    caching strategies, and network configurations to match your infrastructure 
                    and monitoring requirements.
                  </p>
                </div>
              </div>

              <div className="bg-black/30 rounded-lg p-6 mt-6 border-l-4 border-[#00FF88]">
                <h3 className="font-semibold text-foreground mb-4 text-lg flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#00FF88]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Key Features
                </h3>
                <ul className="space-y-2 text-sm text-foreground/80">
                  <li className="flex items-start gap-2">
                    <span className="text-[#00FF88] mt-1">•</span>
                    <span><strong>Real-time Monitoring:</strong> Live updates of node status, performance metrics, and network health</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#00FF88] mt-1">•</span>
                    <span><strong>Geographic Visualization:</strong> Interactive globe and maps showing node distribution worldwide</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#00FF88] mt-1">•</span>
                    <span><strong>Comprehensive Analytics:</strong> Detailed metrics on uptime, CPU, RAM, storage, latency, and network activity</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#00FF88] mt-1">•</span>
                    <span><strong>Public API:</strong> RESTful API with authentication for programmatic access to all network data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#00FF88] mt-1">•</span>
                    <span><strong>Data Export:</strong> Export node data in CSV or JSON format for further analysis</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#00FF88] mt-1">•</span>
                    <span><strong>Network Health Scoring:</strong> Automated calculation of network health based on availability, uptime, version consistency, and activity</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Additional Resources */}
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-[#FFD700]">●</span> Additional Resources
          </h2>
          <div className="bg-muted/30 rounded-lg p-6">
            <ul className="space-y-3">
              <li>
                <a 
                  href="https://xandeum.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#FFD700] hover:text-[#FFD700]/80 hover:underline flex items-center gap-2 transition-colors"
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
                  className="text-[#FFD700] hover:text-[#FFD700]/80 hover:underline flex items-center gap-2 transition-colors"
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
            className="inline-flex items-center gap-2 text-[#FFD700] hover:underline"
          >
            ← Back to Dashboard
          </Link>
        </div>
        </div>
      </main>
    </div>
  );
}





