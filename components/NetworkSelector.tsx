'use client';

import { NetworkConfig } from '@/lib/server/network-config';
import { RefreshCw } from 'lucide-react';

interface NetworkSelectorProps {
  networks: NetworkConfig[];
  currentNetwork: NetworkConfig | null;
  switchingNetwork?: string | null;
  loading?: boolean;
  onNetworkChange: (networkId: string) => void;
  className?: string;
}

export default function NetworkSelector({
  networks,
  currentNetwork,
  switchingNetwork,
  loading = false,
  onNetworkChange,
  className = '',
}: NetworkSelectorProps) {
  // Only show enabled networks (mainnet is not yet active)
  const enabledNetworks = networks.filter(n => n.enabled !== false);
  const disabledNetworks = networks.filter(n => n.enabled === false);
  
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* Enabled networks */}
      {enabledNetworks.map((network) => {
        const isActive = currentNetwork?.id === network.id;
        const isSwitching = switchingNetwork === network.id;
        const isDisabled = loading && !isActive;
        
        return (
          <button
            key={network.id}
            onClick={() => !isDisabled && onNetworkChange(network.id)}
            disabled={isDisabled}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              isActive
                ? network.type === 'mainnet'
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {isSwitching && (
              <RefreshCw className="w-3 h-3 animate-spin" />
            )}
            <span
              className={`w-2 h-2 rounded-full ${
                network.type === 'mainnet' ? 'bg-green-400' : 'bg-blue-400'
              }`}
            />
            {network.name}
          </button>
        );
      })}
      
      {/* Disabled networks (Coming Soon) */}
      {disabledNetworks.map((network) => (
        <button
          key={network.id}
          disabled
          title={network.description}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-900 text-zinc-600 cursor-not-allowed flex items-center gap-2 border border-zinc-800"
        >
          <span className="w-2 h-2 rounded-full bg-zinc-600" />
          {network.name}
          <span className="text-xs text-zinc-500">(Soon)</span>
        </button>
      ))}
    </div>
  );
}

