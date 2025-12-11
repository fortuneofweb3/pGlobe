'use client';

import { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { useNodes } from '@/lib/context/NodesContext';
import { BookOpen, ChevronRight, X, FileText, Settings, BarChart3, MapPin, Search, HelpCircle } from 'lucide-react';

export default function HelpPage() {
  const { nodes, loading, lastUpdate, availableNetworks, currentNetwork, refreshNodes } = useNodes();
  const [activeDoc, setActiveDoc] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
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

      <main className="flex-1 overflow-hidden flex">
        {/* Sidebar Navigation */}
        <aside className="w-64 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-y-auto flex-shrink-0">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Documentation</h2>
            <nav className="space-y-1">
              <button
                onClick={() => setActiveDoc(null)}
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                  activeDoc === null
                    ? 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Quick Start Guide
              </button>
              <button
                onClick={() => setActiveDoc('deployment')}
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center justify-between ${
                  activeDoc === 'deployment'
                    ? 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span>Deployment</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveDoc('analytics')}
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center justify-between ${
                  activeDoc === 'analytics'
                    ? 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span>Analytics & Metrics</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveDoc('architecture')}
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center justify-between ${
                  activeDoc === 'architecture'
                    ? 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span>Architecture</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          {activeDoc === null ? (
            <QuickStartGuide />
          ) : activeDoc === 'deployment' ? (
            <DeploymentDocs onClose={() => setActiveDoc(null)} />
          ) : activeDoc === 'analytics' ? (
            <AnalyticsDocs onClose={() => setActiveDoc(null)} />
          ) : activeDoc === 'architecture' ? (
            <ArchitectureDocs onClose={() => setActiveDoc(null)} />
          ) : null}
        </div>
      </main>
    </div>
  );
}

function QuickStartGuide() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">pGlobe Documentation</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Real-time analytics and monitoring platform for the Xandeum pNode network
        </p>
      </div>

      {/* What is pGlobe */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">What is pGlobe?</h2>
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
            pGlobe is a real-time analytics and monitoring platform for the <strong>Xandeum pNode network</strong>. 
            It provides comprehensive visibility into the decentralized storage layer that powers Solana dApps with scalable, 
            affordable data storage.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">What are pNodes?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Provider Nodes (pNodes) form a distributed storage network where each node contributes storage capacity 
                and earns rewards for serving data to applications. They're the backbone of Xandeum's decentralized storage infrastructure.
              </p>
            </div>
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Why Use pGlobe?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Monitor network health, track node performance, analyze storage distribution, and make informed decisions 
                about staking or operating nodes. All in real-time with historical data tracking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Getting Started */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Getting Started</h2>
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">Navigation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Overview</h4>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                The main dashboard with interactive globe, network statistics, health score, and node list. 
                Click any node on the globe or in the list to view detailed information.
              </p>
            </div>
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Analytics</h4>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Deep dive into network metrics with charts showing performance trends, resource utilization, 
                latency distribution, and geographic metrics.
              </p>
            </div>
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Search className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Scan</h4>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Find nodes nearest to your location or a particular IP address. Measure latency and view distance-based rankings.
              </p>
            </div>
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Help</h4>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Documentation, FAQs, and guides to help you get the most out of pGlobe.
              </p>
            </div>
          </div>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-8">Quick Actions</h3>
          <ul className="space-y-2 text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span><strong>Refresh Data:</strong> Click the refresh button (↻) in the header to manually update node data</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span><strong>Auto-refresh:</strong> Data automatically refreshes every 30 seconds by default</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span><strong>View Node Details:</strong> Click any node on the globe, in the list, or in rankings to see full details</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span><strong>Export Data:</strong> Use the export button in the Scan page to download node data as CSV or JSON</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Understanding Metrics */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Understanding Metrics</h2>
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">Node Status</h3>
          <dl className="space-y-3 mb-6">
            <div>
              <dt className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Online</dt>
              <dd className="text-sm text-gray-600 dark:text-gray-400">
                Node was seen in gossip within the last 5 minutes. These are actively participating nodes.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Syncing</dt>
              <dd className="text-sm text-gray-600 dark:text-gray-400">
                Node was seen within the last hour but not in the last 5 minutes. May be catching up on network state.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Offline</dt>
              <dd className="text-sm text-gray-600 dark:text-gray-400">
                Node hasn't been seen for over an hour. May be down, disconnected, or experiencing issues.
              </dd>
            </div>
          </dl>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">Performance Metrics</h3>
          <dl className="space-y-3 mb-6">
            <div>
              <dt className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Uptime (%)</dt>
              <dd className="text-sm text-gray-600 dark:text-gray-400">
                Percentage of time the node has been continuously running, calculated over a 30-day window. 
                Higher uptime (95%+) indicates a reliable, well-maintained node.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">CPU (%)</dt>
              <dd className="text-sm text-gray-600 dark:text-gray-400">
                Processor utilization. Shows how much of the node's CPU capacity is being used. 
                Lower values (under 50%) mean more headroom for growth and better performance.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">RAM (%)</dt>
              <dd className="text-sm text-gray-600 dark:text-gray-400">
                Memory usage as a percentage of total available RAM. Typical pNode setups use 2-8GB 
                depending on data volume. High RAM usage may indicate memory pressure.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Latency (ms)</dt>
              <dd className="text-sm text-gray-600 dark:text-gray-400">
                Response time measured directly from your browser to each node's pRPC endpoint. 
                This gives you accurate latency based on your location and internet connection. 
                Latency measurements are cached for 1 hour to improve performance. Lower is better (under 100ms is excellent).
              </dd>
            </div>
          </dl>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">Network Health Score</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-3">
            The health score (0-100) is a weighted composite metric that provides an overall assessment of network health:
          </p>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1 mb-4">
            <li><strong>40%</strong> - Availability (online nodes / total nodes)</li>
            <li><strong>35%</strong> - Version Health (% of nodes on the latest version)</li>
            <li><strong>25%</strong> - Geographic Distribution (diversity of node locations)</li>
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Why do some nodes show "N/A" for stats?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              pNode operators can choose to keep their pRPC endpoint private (localhost-only) for security. 
              This is the recommended security configuration. Only nodes with public pRPC expose detailed statistics. 
              We still track these nodes for network discovery and basic status, but detailed metrics aren't available.
            </p>
          </div>
          <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">How often is the data updated?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Data automatically refreshes every 30 seconds. You can also manually refresh using the refresh button 
              in the header. Historical data is stored hourly, so trend charts show data points at hourly intervals.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
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
    <div className="max-w-4xl mx-auto px-6 py-8 bg-white dark:bg-gray-950">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Deployment Documentation</h1>
          <p className="text-gray-600 dark:text-gray-400">How pGlobe is deployed in production</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="prose prose-gray dark:prose-invert max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Production Architecture</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            pGlobe is deployed using a two-server architecture:
          </p>
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 mb-4">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Frontend (Vercel)</h3>
                <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Next.js 14 application hosted on Vercel</li>
                  <li>API proxy routes that forward requests to Render backend</li>
                  <li>No direct database or pRPC access</li>
                  <li>Client-side latency measurement</li>
                  <li>Automatic deployments on git push</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Backend (Render)</h3>
                <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Express.js API server hosted on Render</li>
                  <li>Background refresh worker (runs every minute)</li>
                  <li>pRPC fetching and gossip network discovery</li>
                  <li>MongoDB read/write operations</li>
                  <li>Historical data storage</li>
                  <li>Automatic deployments on git push</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Database (MongoDB Atlas)</h3>
                <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
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
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Deployment Process</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Initial Setup</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            The platform was initially deployed as follows:
          </p>
          
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">1. Render API Server Setup</h4>
            <ol className="list-decimal list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
              <li>Created Render account and connected GitHub repository</li>
              <li>Created new Web Service named <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">pglobe-api-server</code></li>
              <li>Configured build command: <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">npm install --include=dev</code></li>
              <li>Configured start command: <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">npx tsx render-api-server.ts</code></li>
              <li>Service URL obtained: <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">https://pglobe-api-server.onrender.com</code></li>
            </ol>
          </div>

          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">2. Vercel Frontend Setup</h4>
            <ol className="list-decimal list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
              <li>Created Vercel account and imported GitHub repository</li>
              <li>Vercel auto-detected Next.js configuration</li>
              <li>Frontend URL: <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">https://pglobe.vercel.app</code></li>
            </ol>
          </div>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Continuous Deployment</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Both services are configured for automatic deployment:
          </p>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li><strong>Render:</strong> Automatically deploys when code is pushed to the main branch</li>
            <li><strong>Vercel:</strong> Automatically deploys when code is pushed to the main branch</li>
            <li>Both services pull from the same GitHub repository</li>
            <li>Deployments are independent - frontend and backend can be updated separately</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Deployment Workflow</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Standard Deployment Process</h3>
          <ol className="list-decimal list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li>Make changes locally and test with <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">npm run dev:api</code> and <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">npm run dev</code></li>
            <li>Commit changes: <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">git add .</code> → <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">git commit -m "..."</code></li>
            <li>Push to GitHub: <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">git push</code></li>
            <li>Render automatically detects push and starts deployment</li>
            <li>Vercel automatically detects push and starts deployment</li>
            <li>Both services deploy independently and update production</li>
          </ol>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Monitoring Deployments</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Deployment status can be monitored:
          </p>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li><strong>Render Dashboard:</strong> View build logs, deployment status, and service health</li>
            <li><strong>Vercel Dashboard:</strong> View build logs, deployment status, and function logs</li>
            <li><strong>GitHub Actions:</strong> Optional cron job configured to keep Render service alive (prevents free tier sleep)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Infrastructure Details</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Render Service</h3>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li><strong>Service Type:</strong> Web Service</li>
            <li><strong>Runtime:</strong> Node.js</li>
            <li><strong>Build:</strong> <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">npm install --include=dev</code></li>
            <li><strong>Start:</strong> <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">npx tsx render-api-server.ts</code></li>
            <li><strong>Background Tasks:</strong> Runs background refresh every minute</li>
            <li><strong>API Endpoints:</strong> <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">/api/pnodes</code>, <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">/api/refresh-nodes</code>, <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">/health</code></li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Vercel Service</h3>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li><strong>Framework:</strong> Next.js 14</li>
            <li><strong>Build:</strong> Automatic (detects Next.js)</li>
            <li><strong>API Routes:</strong> Proxy routes that forward to Render backend</li>
            <li><strong>Static Assets:</strong> Served from Vercel CDN</li>
            <li><strong>Edge Functions:</strong> Not used (all API calls proxy to Render)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Data Flow in Production</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Background Refresh (Render)</h3>
          <ol className="list-decimal list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li>Render API server runs background refresh task every minute</li>
            <li>Queries pRPC endpoints using <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">get-pods-with-stats</code> (v0.7.0+) or <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">get-pods</code> (all versions)</li>
            <li>Enriches nodes with detailed stats via <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">get-stats</code> when pRPC is public</li>
            <li>Fetches geographic location data for nodes</li>
            <li>Fetches on-chain Solana data (registration status, balances)</li>
            <li>Stores/updates nodes in MongoDB</li>
            <li>Creates historical snapshot for trend analysis</li>
          </ol>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">User Request Flow</h3>
          <ol className="list-decimal list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li>User visits pGlobe frontend (Vercel)</li>
            <li>Frontend makes API request to Next.js API route (e.g., <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">/api/pnodes</code>)</li>
            <li>API route proxies request to Render backend with <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">API_SECRET</code> authentication</li>
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
    <div className="max-w-4xl mx-auto px-6 py-8 bg-white dark:bg-gray-950">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Analytics & Metrics Guide</h1>
          <p className="text-gray-600 dark:text-gray-400">Understanding how analytics work in pGlobe</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="prose prose-gray dark:prose-invert max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Overview Page Analytics</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Network Statistics Cards</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            The top section displays key network metrics calculated in real-time:
          </p>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li><strong>Total Nodes:</strong> Count of all discovered pNodes in the network</li>
            <li><strong>Online/Syncing/Offline:</strong> Status breakdown based on last seen timestamps</li>
            <li><strong>Storage Capacity/Used:</strong> Aggregated storage metrics from all reporting nodes</li>
            <li><strong>Average Metrics:</strong> Calculated averages for uptime, CPU, RAM, and latency</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Network Health Score</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            The health score is a weighted composite metric (0-100) calculated from:
          </p>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li><strong>40% Availability:</strong> Percentage of nodes that are online</li>
            <li><strong>35% Version Health:</strong> Percentage of nodes running the latest version (using semantic version comparison)</li>
            <li><strong>25% Geographic Distribution:</strong> Diversity score based on node locations across different countries</li>
          </ul>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Click on the health score card to see a detailed breakdown of each component.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Interactive Globe</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            The 3D globe visualization shows all nodes with their geographic locations. Each node is represented as a dot, 
            colored by status (green = online, yellow = syncing, red = offline). The globe uses MapLibre GL for rendering 
            and supports:
          </p>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li>Drag to rotate</li>
            <li>Scroll/pinch to zoom</li>
            <li>Click nodes to view details</li>
            <li>Arrow keys for navigation</li>
            <li>Auto-rotation (pauses on user interaction)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Analytics Page</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Network Health Chart</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            A donut chart showing the distribution of node statuses (online, syncing, offline) with percentages. 
            Hover over segments to see exact counts. The chart uses visx library for rendering.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Performance Metrics</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Two bar charts displaying:
          </p>
          
          <div className="mb-4">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Latency Distribution</h4>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              Shows how many nodes fall into different latency ranges:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1 ml-4">
              <li>&lt;50ms</li>
              <li>50-100ms</li>
              <li>100-200ms</li>
              <li>200-500ms</li>
              <li>&gt;500ms</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mt-2 text-sm">
              Latency is measured client-side from your browser to each node's pRPC endpoint. Measurements are cached for 1 hour.
            </p>
          </div>

          <div className="mb-4">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Resource Utilization</h4>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              Shows CPU and RAM usage distribution across nodes, grouped into ranges:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1 ml-4">
              <li>0-25%</li>
              <li>25-50%</li>
              <li>50-75%</li>
              <li>75-100%</li>
            </ul>
          </div>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Geographic Distribution</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            A horizontal bar chart showing node count by country. Helps visualize where the network has the most presence 
            and geographic diversity. Countries are sorted by node count (highest first).
          </p>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Top Performing Nodes</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Leaderboards showing the top 10 nodes by:
          </p>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li><strong>Uptime:</strong> Nodes with the highest uptime percentage (calculated over 30-day window)</li>
            <li><strong>Storage:</strong> Nodes storing the most data</li>
          </ul>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Click any node in the rankings to view its detailed information.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Node Details Modal</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Historical Data Charts</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            When viewing a node's details, you can see historical trends for:
          </p>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li><strong>Uptime Over Time:</strong> Line chart showing uptime percentage trends</li>
            <li><strong>Storage Over Time:</strong> Line chart showing storage usage trends</li>
          </ul>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Historical data is stored hourly in MongoDB. Charts use visx library with smooth interpolation between data points. 
            X-axis labels are horizontal and automatically skip labels to prevent overlap.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Real-time Metrics</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            The modal displays current metrics including:
          </p>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li>CPU and RAM usage percentages</li>
            <li>Client-side latency measurement</li>
            <li>Storage capacity and usage</li>
            <li>Network activity (packets, streams)</li>
            <li>Node status and version</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Data Collection & Processing</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Gossip Network Discovery</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            pGlobe uses a pure gossip approach to discover nodes:
          </p>
          <ol className="list-decimal list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li>Query known pRPC endpoints with <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">get-pods-with-stats</code> (v0.7.0+) or <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">get-pods</code> (all versions) to discover nodes in the gossip network</li>
            <li>Deduplicate nodes by public key (each node has a unique identifier)</li>
            <li>Enrich with detailed stats via <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">get-stats</code> when pRPC is publicly accessible (adds CPU, RAM, packets data)</li>
            <li>Add geographic location via IP geolocation API</li>
            <li>Store historical snapshots for trend analysis</li>
          </ol>
          <p className="text-gray-700 dark:text-gray-300 mb-4 text-sm">
            <strong>Note:</strong> <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">get-pods-with-stats</code> (available in Pod v0.7.0+) provides basic stats (uptime, storage) directly, but we still query <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">get-stats</code> for detailed metrics (CPU, RAM, network packets) when nodes have public pRPC.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Background Refresh</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            The Render API server runs a background refresh task every minute that:
          </p>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li>Fetches fresh node data from the gossip network</li>
            <li>Updates MongoDB with latest node information</li>
            <li>Stores historical snapshots for trend analysis</li>
            <li>Runs independently of user requests</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Client-Side Latency Measurement</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Latency is measured directly from your browser to each node's pRPC endpoint:
          </p>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
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
    <div className="max-w-4xl mx-auto px-6 py-8 bg-white dark:bg-gray-950">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">System Architecture</h1>
          <p className="text-gray-600 dark:text-gray-400">Technical overview of pGlobe's architecture</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="prose prose-gray dark:prose-invert max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">High-Level Architecture</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            pGlobe follows a two-server architecture pattern:
          </p>
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 mb-4">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Frontend (Vercel)</h3>
                <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Next.js 14 application</li>
                  <li>API proxy routes that forward requests to Render backend</li>
                  <li>No direct database or pRPC access</li>
                  <li>Client-side latency measurement</li>
                  <li>Static asset hosting</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Backend (Render)</h3>
                <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Express.js API server</li>
                  <li>Background refresh worker (runs every minute)</li>
                  <li>pRPC fetching and gossip network discovery</li>
                  <li>MongoDB read/write operations</li>
                  <li>Historical data storage</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Database (MongoDB)</h3>
                <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
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
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Data Flow</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Background Refresh Flow</h3>
          <ol className="list-decimal list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li>Render API server runs background refresh every minute</li>
            <li>Queries pRPC endpoints to discover nodes via gossip</li>
            <li>Fetches detailed stats for nodes with public pRPC</li>
            <li>Enriches with geographic location data</li>
            <li>Stores/updates nodes in MongoDB</li>
            <li>Creates historical snapshot for trend analysis</li>
          </ol>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">User Request Flow</h3>
          <ol className="list-decimal list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li>User visits pGlobe frontend (Vercel)</li>
            <li>Frontend makes API request to Next.js API route</li>
            <li>API route proxies request to Render backend with authentication</li>
            <li>Render backend queries MongoDB and returns data</li>
            <li>Frontend receives data and renders UI</li>
            <li>Client-side latency measurement runs in background</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Technology Stack</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Frontend</h3>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li><strong>Next.js 14:</strong> React framework with App Router</li>
            <li><strong>TypeScript:</strong> Type-safe development</li>
            <li><strong>Tailwind CSS:</strong> Utility-first styling</li>
            <li><strong>visx:</strong> Data visualization library for charts</li>
            <li><strong>MapLibre GL:</strong> 3D globe rendering</li>
            <li><strong>React Context:</strong> Global state management</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Backend</h3>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li><strong>Express.js:</strong> Web server framework</li>
            <li><strong>TypeScript:</strong> Type-safe development</li>
            <li><strong>MongoDB:</strong> Document database</li>
            <li><strong>pRPC:</strong> Xandeum protocol for node communication</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Infrastructure</h3>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li><strong>Vercel:</strong> Frontend hosting and deployment</li>
            <li><strong>Render:</strong> Backend hosting and deployment</li>
            <li><strong>MongoDB Atlas:</strong> Database hosting</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Performance Optimizations</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Client-Side Optimizations</h3>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li><strong>Lazy Loading:</strong> MapLibreGlobe component loads only when needed</li>
            <li><strong>Deferred Measurements:</strong> Latency and geo enrichment use requestIdleCallback</li>
            <li><strong>Caching:</strong> 6-hour cache for latency measurements in localStorage</li>
            <li><strong>Memoization:</strong> Heavy computations use useMemo to prevent re-calculations</li>
            <li><strong>Code Splitting:</strong> Dynamic imports for heavy components</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">Server-Side Optimizations</h3>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
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
