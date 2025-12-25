'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Menu, X } from 'lucide-react';
import NetworkSelector from './NetworkSelector';
import NetToggle from './NetToggle';
import { NetworkConfig } from '@/lib/server/network-config';
import { useNodes } from '@/lib/context/NodesContext';

interface HeaderProps {
  activePage?: 'overview' | 'nodes' | 'analytics' | 'help' | 'scan' | 'regions' | 'activity';
  nodeCount?: number;
  lastUpdate?: Date | null;
  loading?: boolean;
  onRefresh?: () => void;
  networks?: NetworkConfig[];
  currentNetwork?: NetworkConfig | null;
  switchingNetwork?: string | null;
  onNetworkChange?: (networkId: string) => void;
  showNetworkSelector?: boolean;
}

export default function Header({
  activePage = 'overview',
  nodeCount: propNodeCount,
  lastUpdate: propLastUpdate,
  loading: propLoading = false,
  onRefresh,
  networks: propNetworks = [],
  currentNetwork: propCurrentNetwork,
  switchingNetwork,
  onNetworkChange,
  showNetworkSelector = false,
}: HeaderProps) {
  // Get values from context as fallback to prevent header from clearing on page transitions
  const context = useNodes();
  const nodeCount = propNodeCount ?? context?.nodes.length ?? 0;
  const lastUpdate = propLastUpdate ?? context?.lastUpdate ?? null;
  const loading = propLoading || context?.loading || false;
  const networks = propNetworks.length > 0 ? propNetworks : (context?.availableNetworks ?? []);
  const currentNetwork = propCurrentNetwork ?? context?.currentNetwork ?? null;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedNet, setSelectedNet] = useState<'devnet' | 'mainnet'>('devnet');

  const handleNetChange = (net: 'devnet' | 'mainnet') => {
    setSelectedNet(net);
    // TODO: Implement actual network switching logic
    console.log('Network changed to:', net);
  };

  const formatTimeAgo = (date: Date | null) => {
    if (!date) return 'Never';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <header className="flex-shrink-0 z-50 bg-black border-b border-[#F0A741]/20">
      <div className="w-full px-4 py-3 bg-black">
        <div className="flex items-center justify-between bg-black">
          {/* Left side - Title and Navigation */}
          <div className="flex items-center gap-4 bg-black">
            <Link
              href="/"
              className="text-xl sm:text-2xl font-bold text-[#F0A741] hover:text-[#F0A741]/80 transition-all duration-300 hover:scale-105 active:scale-100"
              style={{ fontFamily: "'Exo 2', sans-serif", letterSpacing: '-0.02em' }}
            >
              pGlobe
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/"
                prefetch={true}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 active:scale-100 ${activePage === 'overview'
                    ? 'text-[#F0A741] bg-[#F0A741]/10 shadow-sm'
                    : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                  }`}
              >
                Overview
              </Link>
              <Link
                href="/nodes"
                prefetch={true}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 active:scale-100 ${activePage === 'nodes'
                    ? 'text-[#F0A741] bg-[#F0A741]/10 shadow-sm'
                    : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                  }`}
              >
                Nodes {nodeCount > 0 && `(${nodeCount})`}
              </Link>
              <Link
                href="/analytics"
                prefetch={true}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 active:scale-100 ${activePage === 'analytics'
                    ? 'text-[#F0A741] bg-[#F0A741]/10 shadow-sm'
                    : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                  }`}
              >
                Analytics
              </Link>
              <Link
                href="/regions"
                prefetch={true}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 active:scale-100 ${activePage === 'regions'
                    ? 'text-[#F0A741] bg-[#F0A741]/10 shadow-sm'
                    : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                  }`}
              >
                Regions
              </Link>
              <Link
                href="/scan"
                prefetch={true}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 active:scale-100 ${activePage === 'scan'
                    ? 'text-[#F0A741] bg-[#F0A741]/10 shadow-sm'
                    : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                  }`}
              >
                Scan
              </Link>
              <Link
                href="/activity-logs"
                prefetch={true}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 active:scale-100 ${activePage === 'activity'
                    ? 'text-[#F0A741] bg-[#F0A741]/10 shadow-sm'
                    : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                  }`}
              >
                Activity
              </Link>
              <Link
                href="/help"
                prefetch={true}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 active:scale-100 ${activePage === 'help'
                    ? 'text-[#F0A741] bg-[#F0A741]/10 shadow-sm'
                    : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                  }`}
              >
                Help
              </Link>
            </nav>
          </div>

          {/* Right side - Controls */}
          <div className="flex items-center gap-2 sm:gap-3 bg-black">
            {showNetworkSelector && networks.length > 0 && (
              <div className="hidden sm:block px-3 py-1.5 bg-muted">
                <NetworkSelector
                  networks={networks}
                  currentNetwork={currentNetwork ?? null}
                  switchingNetwork={switchingNetwork}
                  loading={loading}
                  onNetworkChange={onNetworkChange || (() => { })}
                />
              </div>
            )}
            {lastUpdate && (
              <div className="hidden sm:block px-3 py-1.5 bg-muted/20">
                <span className="text-xs text-foreground/60 font-mono">
                  {formatTimeAgo(lastUpdate)}
                </span>
              </div>
            )}
            {(onRefresh !== undefined || context?.refreshNodes !== undefined) && (
              <button
                onClick={onRefresh || context?.refreshNodes || (() => { })}
                disabled={loading}
                className="px-2 sm:px-4 py-2 rounded-xl text-sm flex items-center gap-2 text-foreground/80 hover:text-foreground hover:bg-foreground/10 transition-all duration-300 hover:scale-105 active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <RefreshCw className={`w-4 h-4 transition-transform duration-300 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}

            {/* Network Toggle (DevNet/MainNet) - Extreme Right */}
            <div className="hidden sm:block bg-black/90">
              <NetToggle currentNet={selectedNet} onNetChange={handleNetChange} />
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-foreground/80 hover:text-foreground hover:bg-foreground/10 rounded-lg transition-all duration-300 hover:scale-110 active:scale-100"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 transition-transform duration-300 rotate-90" />
              ) : (
                <Menu className="w-5 h-5 transition-transform duration-300" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#F0A741]/20 bg-black">
          <nav className="px-4 py-3 space-y-2 bg-black">
            {/* Network Toggle for Mobile */}
            <div className="px-4 py-2 bg-muted">
              <NetToggle currentNet={selectedNet} onNetChange={handleNetChange} />
            </div>

            <Link
              href="/"
              prefetch={true}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 active:scale-100 ${activePage === 'overview'
                  ? 'text-[#F0A741] bg-[#F0A741]/10 shadow-sm'
                  : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                }`}
            >
              Overview
            </Link>
            <Link
              href="/nodes"
              prefetch={true}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 active:scale-100 ${activePage === 'nodes'
                  ? 'text-[#F0A741] bg-[#F0A741]/10 shadow-sm'
                  : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                }`}
            >
              Nodes {nodeCount > 0 && `(${nodeCount})`}
            </Link>
            <Link
              href="/analytics"
              prefetch={true}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 active:scale-100 ${activePage === 'analytics'
                  ? 'text-[#F0A741] bg-[#F0A741]/10 shadow-sm'
                  : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                }`}
            >
              Analytics
            </Link>
            <Link
              href="/regions"
              prefetch={true}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 active:scale-100 ${activePage === 'regions'
                  ? 'text-[#F0A741] bg-[#F0A741]/10 shadow-sm'
                  : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                }`}
            >
              Regions
            </Link>
            <Link
              href="/scan"
              prefetch={true}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 active:scale-100 ${activePage === 'scan'
                  ? 'text-[#F0A741] bg-[#F0A741]/10 shadow-sm'
                  : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                }`}
            >
              Scan
            </Link>
            <Link
              href="/activity-logs"
              prefetch={true}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 active:scale-100 ${activePage === 'activity'
                  ? 'text-[#F0A741] bg-[#F0A741]/10 shadow-sm'
                  : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                }`}
            >
              Activity
            </Link>
            <Link
              href="/help"
              prefetch={true}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 active:scale-100 ${activePage === 'help'
                  ? 'text-[#F0A741] bg-[#F0A741]/10 shadow-sm'
                  : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                }`}
            >
              Help
            </Link>
            {showNetworkSelector && networks.length > 0 && (
              <div className="px-4 py-2 bg-muted">
                <NetworkSelector
                  networks={networks}
                  currentNetwork={currentNetwork ?? null}
                  switchingNetwork={switchingNetwork}
                  loading={loading}
                  onNetworkChange={onNetworkChange || context?.setSelectedNetwork || (() => { })}
                />
              </div>
            )}
            {lastUpdate && (
              <div className="px-4 py-2 bg-muted">
                <span className="text-xs text-foreground/60 font-mono">
                  {formatTimeAgo(lastUpdate)}
                </span>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

