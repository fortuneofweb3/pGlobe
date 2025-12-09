'use client';

import { PNode } from '@/lib/types/pnode';

interface NodeStatusBadgeProps {
  node: PNode;
  latestVersion?: string;
  showLabel?: boolean;
}

export default function NodeStatusBadge({ node, latestVersion, showLabel = true }: NodeStatusBadgeProps) {
  // Determine node health status based on multiple factors
  const getNodeStatus = () => {
    const isOnline = node.status === 'online';
    const isCurrentVersion = latestVersion ? node.version === latestVersion : true;
    const hasLowUptime = node.uptimePercent !== undefined ? node.uptimePercent < 80 : false;

    // Critical: offline
    if (!isOnline || node.status === 'offline') {
      return {
        type: 'critical' as const,
        label: 'Critical',
        tooltip: 'Node is offline or unreachable. This node is not responding to network requests.',
        color: 'bg-red-500/20 text-red-400 border-red-500/30',
        dotColor: 'bg-red-500',
      };
    }

    // Old Version: online but outdated
    if (isOnline && !isCurrentVersion) {
      return {
        type: 'old-ver' as const,
        label: 'Old Ver',
        tooltip: `Node is online but running an outdated version (${node.version || 'unknown'}). Latest version is ${latestVersion || 'unknown'}. Consider updating for security and compatibility.`,
        color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        dotColor: 'bg-orange-500',
      };
    }

    // Warning: online and current version but low uptime
    if (isOnline && isCurrentVersion && hasLowUptime) {
      return {
        type: 'warning' as const,
        label: 'Warning',
        tooltip: `Node is online and up-to-date, but has low uptime (${node.uptimePercent?.toFixed(1) || 'unknown'}%). This may indicate instability or frequent restarts.`,
        color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        dotColor: 'bg-yellow-500',
      };
    }

    // Syncing
    if (node.status === 'syncing') {
      return {
        type: 'syncing' as const,
        label: 'Syncing',
        tooltip: 'Node is currently syncing with the network. This is normal for nodes that just started or are catching up after downtime.',
        color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        dotColor: 'bg-blue-500',
      };
    }

    // Healthy: online, current version, good uptime
    return {
      type: 'healthy' as const,
      label: 'Healthy',
      tooltip: 'Node is online, running the latest version, and has good uptime. This node is operating normally.',
      color: 'bg-[#00FF88]/20 text-[#00FF88] border-[#00FF88]/30',
      dotColor: 'bg-[#00FF88]',
    };
  };

  const status = getNodeStatus();

  return (
    <div 
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium ${status.color} cursor-help group relative`}
      title={status.tooltip}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`} />
      {showLabel && <span>{status.label}</span>}
      {!showLabel && node.version && (
        <span className="font-mono text-[10px]">{node.version}</span>
      )}
      {/* Tooltip on hover */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl pointer-events-none border border-gray-700">
        <div className="font-semibold mb-1.5 text-white">{status.label}</div>
        <div className="text-gray-300 leading-relaxed">{status.tooltip}</div>
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
          <div className="border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
    </div>
  );
}

