'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Menu, X } from 'lucide-react';
import NetworkSelector from './NetworkSelector';
import NetToggle from './NetToggle';
import { NetworkConfig } from '@/lib/server/network-config';

interface HeaderProps {
  activePage?: 'overview' | 'nodes' | 'analytics' | 'help' | 'scan';
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
  nodeCount = 0,
  lastUpdate,
  loading = false,
  onRefresh,
  networks = [],
  currentNetwork,
  switchingNetwork,
  onNetworkChange,
  showNetworkSelector = false,
}: HeaderProps) {
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
    <header className="flex-shrink-0 z-50 bg-black/90 backdrop-blur-md border-b border-[#F0A741]/20">
      <div className="w-full px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side - Title and Navigation */}
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="text-xl sm:text-2xl font-bold text-[#F0A741] hover:text-[#F0A741]/80 transition-colors" 
              style={{ fontFamily: "'Exo 2', sans-serif", letterSpacing: '-0.02em' }}
            >
              pGlobe
            </Link>
            
            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/"
                prefetch={true}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                  activePage === 'overview'
                    ? 'text-[#F0A741] bg-[#F0A741]/10'
                    : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                }`}
              >
                Overview
              </Link>
              <Link
                href="/nodes"
                prefetch={true}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                  activePage === 'nodes'
                    ? 'text-[#F0A741] bg-[#F0A741]/10'
                    : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                }`}
              >
                Nodes {nodeCount > 0 && `(${nodeCount})`}
              </Link>
              <Link
                href="/analytics"
                prefetch={true}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                  activePage === 'analytics'
                    ? 'text-[#F0A741] bg-[#F0A741]/10'
                    : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                }`}
              >
                Analytics
              </Link>
              <Link
                href="/scan"
                prefetch={true}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                  activePage === 'scan'
                    ? 'text-[#F0A741] bg-[#F0A741]/10'
                    : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                }`}
              >
                Scan
              </Link>
              <Link
                href="/help"
                prefetch={true}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                  activePage === 'help'
                    ? 'text-[#F0A741] bg-[#F0A741]/10'
                    : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                }`}
              >
                Help
              </Link>
            </nav>
          </div>

          {/* Right side - Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Network Toggle (DevNet/MainNet) */}
            <div className="hidden sm:block">
              <NetToggle currentNet={selectedNet} onNetChange={handleNetChange} />
            </div>

            {showNetworkSelector && networks.length > 0 && (
              <div className="hidden sm:block px-3 py-1.5">
                <NetworkSelector
                  networks={networks}
                  currentNetwork={currentNetwork ?? null}
                  switchingNetwork={switchingNetwork}
                  loading={loading}
                  onNetworkChange={onNetworkChange || (() => {})}
                />
              </div>
            )}
            {lastUpdate && (
              <div className="hidden sm:block px-3 py-1.5">
                <span className="text-xs text-foreground/60 font-mono">
                  {formatTimeAgo(lastUpdate)}
                </span>
              </div>
            )}
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="px-2 sm:px-4 py-2 rounded-xl text-sm flex items-center gap-2 text-foreground/80 hover:text-foreground hover:bg-foreground/10 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-foreground/80 hover:text-foreground hover:bg-foreground/10 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#F0A741]/20 bg-black/95 backdrop-blur-md">
          <nav className="px-4 py-3 space-y-2">
            {/* Network Toggle for Mobile */}
            <div className="px-4 py-2">
              <NetToggle currentNet={selectedNet} onNetChange={handleNetChange} />
            </div>
            
            <Link
              href="/"
              prefetch={true}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                activePage === 'overview'
                  ? 'text-[#F0A741] bg-[#F0A741]/10'
                  : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
              }`}
            >
              Overview
            </Link>
            <Link
              href="/nodes"
              prefetch={true}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                activePage === 'nodes'
                  ? 'text-[#F0A741] bg-[#F0A741]/10'
                  : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
              }`}
            >
              Nodes {nodeCount > 0 && `(${nodeCount})`}
            </Link>
            <Link
              href="/analytics"
              prefetch={true}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                activePage === 'analytics'
                  ? 'text-[#F0A741] bg-[#F0A741]/10'
                  : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
              }`}
            >
              Analytics
            </Link>
            <Link
              href="/scan"
              prefetch={true}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                activePage === 'scan'
                  ? 'text-[#F0A741] bg-[#F0A741]/10'
                  : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
              }`}
            >
              Scan
            </Link>
            <Link
              href="/help"
              prefetch={true}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                activePage === 'help'
                  ? 'text-[#F0A741] bg-[#F0A741]/10'
                  : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
              }`}
            >
              Help
            </Link>
            {showNetworkSelector && networks.length > 0 && (
              <div className="px-4 py-2">
                <NetworkSelector
                  networks={networks}
                  currentNetwork={currentNetwork ?? null}
                  switchingNetwork={switchingNetwork}
                  loading={loading}
                  onNetworkChange={onNetworkChange || (() => {})}
                />
              </div>
            )}
            {lastUpdate && (
              <div className="px-4 py-2">
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

