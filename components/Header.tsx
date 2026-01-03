'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, Activity, HelpCircle, Star, ChevronDown, Check, Globe, Zap, Code } from 'lucide-react';
import { useNodes } from '@/lib/context/NodesContext';
import { useWatchlist } from '@/lib/context/WatchlistContext';

interface HeaderProps {
  activePage?: 'overview' | 'nodes' | 'analytics' | 'stoinc' | 'help' | 'scan' | 'regions' | 'activity' | 'managers' | 'watchlist';
  nodeCount?: number;
  managerCount?: number;
  lastUpdate?: Date | null;
  loading?: boolean;
  onRefresh?: () => void;
}

export default function Header({
  activePage = 'overview',
  nodeCount: propNodeCount,
  managerCount: propManagerCount,
  lastUpdate: propLastUpdate,
  loading: propLoading = false,
  onRefresh,
}: HeaderProps) {
  // Get values from context as fallback to prevent header from clearing on page transitions
  const context = useNodes();
  const { watchlist } = useWatchlist();
  // Always use context values for counts in the header to ensure consistency
  // pNodes = active only, managers = total (active + dead)
  const nodeCount = context?.activeNodes.length ?? 0;
  const managerCount = context?.managerCount ?? 0;
  const lastUpdate = propLastUpdate ?? context?.lastUpdate ?? null;
  const loading = propLoading || context?.loading || false;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setNetworkDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getNetworkColor = (network: string) => {
    switch (network) {
      case 'all': return 'text-green-500';
      case 'mainnet': return 'text-[#F0A741]';
      case 'devnet': return 'text-blue-400';
      default: return 'text-foreground/60';
    }
  };

  const getNetworkBg = (network: string) => {
    switch (network) {
      case 'all': return 'bg-green-500/10 border-green-500/20';
      case 'mainnet': return 'bg-[#F0A741]/10 border-[#F0A741]/20';
      case 'devnet': return 'bg-blue-500/10 border-blue-500/20';
      default: return 'bg-white/5 border-white/10';
    }
  };

  const getNetworkLabel = (network: string) => {
    switch (network) {
      case 'mainnet': return 'Mainnet';
      case 'devnet': return 'Devnet';
      case 'all': return 'All';
      default: return 'Select Network';
    }
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
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 active:scale-100 relative ${activePage === 'nodes'
                  ? 'text-[#F0A741] bg-[#F0A741]/10 shadow-sm'
                  : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                  }`}
              >
                <span className="relative">
                  pNodes {nodeCount > 0 && `(${nodeCount})`}
                  {nodeCount > 0 && (
                    <span className="absolute -top-1 -right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse border border-black shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                  )}
                </span>
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
                href="/stoinc"
                prefetch={true}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 active:scale-100 ${activePage === 'stoinc'
                  ? 'bg-[#F0A741]/10 shadow-sm'
                  : 'hover:bg-[#F0A741]/5'
                  }`}
              >
                <span className={`bg-gradient-to-r from-green-400 via-[#F0A741] to-purple-500 bg-clip-text text-transparent font-bold animate-gradient-x ${activePage === 'stoinc'
                  ? 'opacity-100'
                  : 'opacity-60 hover:opacity-100'
                  }`}
                  style={{ WebkitBackgroundClip: 'text', backgroundSize: '200% auto' }}
                >
                  STOINC
                </span>
              </Link>
              <Link
                href="/managers"
                prefetch={true}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 active:scale-100 ${activePage === 'managers'
                  ? 'text-[#F0A741] bg-[#F0A741]/10 shadow-sm'
                  : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                  }`}
              >
                Managers {managerCount > 0 && `(${managerCount})`}
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
                href="/watchlist"
                prefetch={true}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 active:scale-100 ${activePage === 'watchlist'
                  ? 'text-yellow-500 bg-yellow-500/10 shadow-sm'
                  : 'text-yellow-500/60 hover:text-yellow-500 hover:bg-yellow-500/5'
                  }`}
              >
                Watchlist {watchlist.length > 0 && `(${watchlist.length})`}
              </Link>

            </nav>
          </div>

          {/* Right side - Controls */}
          <div className="flex items-center gap-2 sm:gap-3 bg-black">


            {lastUpdate && (
              <div className="hidden sm:block px-3 py-1.5 bg-muted/20">
                <span className="text-xs text-foreground/60 font-mono">
                  {formatTimeAgo(lastUpdate)}
                </span>
              </div>
            )}


            {/* Activity Button */}
            <Link
              href="/activity-logs"
              className={`p-2 relative rounded-xl transition-all duration-300 hover:scale-110 active:scale-100 group ${activePage === 'activity'
                ? 'text-[#F0A741] bg-[#F0A741]/10'
                : 'text-foreground/80 hover:text-[#F0A741] hover:bg-[#F0A741]/10'
                }`}
              aria-label="View Activity"
            >
              <Activity className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-green-500 rounded-full animate-pulse border border-black shadow-[0_0_8px_rgba(34,197,94,0.6)]" />

              {/* Tooltip */}
              <div className="absolute top-full mt-2 right-0 px-2 py-1 bg-black/90 border border-[#F0A741]/20 rounded text-[10px] text-[#F0A741] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300 z-[60]">
                Live Activity
              </div>
            </Link>

            {/* Help Button */}
            <Link
              href="/help"
              className={`p-2 relative rounded-xl transition-all duration-300 hover:scale-110 active:scale-100 group ${activePage === 'help'
                ? 'text-[#F0A741] bg-[#F0A741]/10'
                : 'text-foreground/80 hover:text-[#F0A741] hover:bg-[#F0A741]/10'
                }`}
              aria-label="Get Help"
            >
              <HelpCircle className="w-5 h-5" />

              {/* Tooltip */}
              <div className="absolute top-full mt-2 right-0 px-2 py-1 bg-black/90 border border-[#F0A741]/20 rounded text-[10px] text-[#F0A741] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300 z-[60]">
                Help & Documentation
              </div>
            </Link>

            {/* Network Dropdown */}
            {/* Network Dropdown */}
            <div className="hidden sm:block relative" ref={dropdownRef}>
              <button
                onClick={() => setNetworkDropdownOpen(!networkDropdownOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all duration-300 justify-between ${context.selectedNetwork === 'all'
                  ? 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20'
                  : context.selectedNetwork === 'mainnet'
                    ? 'bg-[#F0A741]/10 border-[#F0A741]/20 text-[#F0A741] hover:bg-[#F0A741]/20'
                    : 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                  }`}
              >
                <div className="flex items-center gap-2">
                  {context.selectedNetwork === 'mainnet' ? (
                    <Zap className="w-3.5 h-3.5" />
                  ) : context.selectedNetwork === 'devnet' ? (
                    <Code className="w-3.5 h-3.5" />
                  ) : (
                    <Globe className="w-3.5 h-3.5" />
                  )}
                  <span>{getNetworkLabel(context.selectedNetwork)}</span>
                </div>
                <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${networkDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {networkDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-44 bg-black border border-[#F0A741]/30 rounded-xl shadow-2xl shadow-black/80 overflow-hidden z-[70] animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="p-1.5 space-y-0.5">
                    {[
                      { id: 'all', label: 'All Networks', icon: Globe, color: 'text-green-400', hover: 'hover:bg-green-500/10' },
                      { id: 'devnet', label: 'Devnet', icon: Code, color: 'text-blue-400', hover: 'hover:bg-blue-500/10' },
                      { id: 'mainnet', label: 'Mainnet', icon: Zap, color: 'text-[#F0A741]', hover: 'hover:bg-[#F0A741]/10' }
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => {
                          context.setSelectedNetwork(option.id);
                          setNetworkDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${option.hover} ${context.selectedNetwork === option.id ? 'bg-white/5' : ''
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <option.icon className={`w-4 h-4 ${option.color}`} />
                          <span className={`${option.color}`}>{option.label}</span>
                        </div>
                        {context.selectedNetwork === option.id && (
                          <Check className={`w-3 h-3 ${option.color}`} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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

            {/* Mobile Network Dropdown */}
            <div className="px-4 py-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">Network Selection</span>
              <div className="relative">
                <select
                  value={context.selectedNetwork}
                  onChange={(e) => context.setSelectedNetwork(e.target.value)}
                  className={`w-full appearance-none px-4 py-3 pr-10 rounded-xl border text-sm font-semibold transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#F0A741]/50 ${context.selectedNetwork === 'all'
                      ? 'bg-green-500/10 border-green-500/40 text-green-400'
                      : context.selectedNetwork === 'mainnet'
                        ? 'bg-[#F0A741]/10 border-[#F0A741]/40 text-[#F0A741]'
                        : 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                    }`}
                >
                  <option value="all" className="bg-black text-green-400">All Networks</option>
                  <option value="devnet" className="bg-black text-blue-400">Devnet</option>
                  <option value="mainnet" className="bg-black text-[#F0A741]">Mainnet</option>
                </select>
                <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${context.selectedNetwork === 'all'
                    ? 'text-green-400'
                    : context.selectedNetwork === 'mainnet'
                      ? 'text-[#F0A741]'
                      : 'text-blue-400'
                  }`} />
              </div>
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
              <span className="relative">
                pNodes {nodeCount > 0 && `(${nodeCount})`}
                {nodeCount > 0 && (
                  <span className="absolute -top-1 -right-2 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse border border-black shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                )}
              </span>
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
              href="/stoinc"
              prefetch={true}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 active:scale-100 ${activePage === 'stoinc'
                ? 'bg-[#F0A741]/10 shadow-sm'
                : 'hover:bg-[#F0A741]/5'
                }`}
            >
              <span className={`bg-gradient-to-r from-green-400 via-[#F0A741] to-purple-500 bg-clip-text text-transparent font-bold animate-gradient-x ${activePage === 'stoinc'
                ? 'opacity-100'
                : 'opacity-60 hover:opacity-100'
                }`}
                style={{ WebkitBackgroundClip: 'text', backgroundSize: '200% auto' }}
              >
                STOINC
              </span>
            </Link>
            <Link
              href="/managers"
              prefetch={true}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 active:scale-100 ${activePage === 'managers'
                ? 'text-[#F0A741] bg-[#F0A741]/10 shadow-sm'
                : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                }`}
            >
              Managers {managerCount > 0 && `(${managerCount})`}
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
              href="/watchlist"
              prefetch={true}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 active:scale-100 ${activePage === 'watchlist'
                ? 'text-yellow-500 bg-yellow-500/10 shadow-sm'
                : 'text-yellow-500/60 hover:text-yellow-500 hover:bg-yellow-500/5'
                }`}
            >
              Watchlist {watchlist.length > 0 && `(${watchlist.length})`}
            </Link>
            <Link
              href="/help"
              prefetch={true}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 active:scale-100 ${activePage === 'help'
                ? 'text-[#F0A741] bg-[#F0A741]/10 shadow-sm'
                : 'text-[#F0A741]/60 hover:text-[#F0A741] hover:bg-[#F0A741]/5'
                }`}
            >
              <HelpCircle className="w-4 h-4" />
              Help & FAQ
            </Link>

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

