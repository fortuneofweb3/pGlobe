'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import { NETWORK_CONFIGS } from '@/lib/server/network-config';

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-black text-foreground">
      <Header
        activePage="help"
        nodeCount={0}
        lastUpdate={null}
        loading={false}
        onRefresh={() => {}}
        networks={NETWORK_CONFIGS}
        currentNetwork={null}
        switchingNetwork={null}
        onNetworkChange={() => {}}
        showNetworkSelector={false}
      />

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-[#FFD700] mb-8">pGlobe Help & Documentation</h1>

        {/* What is pGlobe */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-[#00FF88]">●</span> What is pGlobe?
          </h2>
          <div className="bg-muted/30 rounded-lg p-6 space-y-4">
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
        <section className="mb-12">
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
        <section className="mb-12">
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
        <section className="mb-12">
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
        <section className="mb-12">
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
        <section className="mb-12">
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

        {/* Links */}
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-[#FFD700]">●</span> Resources
          </h2>
          <div className="bg-muted/30 rounded-lg p-6">
            <ul className="space-y-2">
              <li>
                <a 
                  href="https://xandeum.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#FFD700] hover:underline"
                >
                  Xandeum Official Website →
                </a>
              </li>
              <li>
                <a 
                  href="https://docs.xandeum.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#FFD700] hover:underline"
                >
                  Xandeum Documentation →
                </a>
              </li>
              <li>
                <a 
                  href="https://github.com/xandeum" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#FFD700] hover:underline"
                >
                  GitHub Repository →
                </a>
              </li>
            </ul>
          </div>
        </section>

        <div className="mt-12 pt-8 border-t border-border">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-[#FFD700] hover:underline"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}





