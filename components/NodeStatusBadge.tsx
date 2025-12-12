'use client';

import { PNode } from '@/lib/types/pnode';
import { useState, useRef, useEffect } from 'react';

interface NodeStatusBadgeProps {
  node: PNode;
  latestVersion?: string;
  showLabel?: boolean;
}

export default function NodeStatusBadge({ node, latestVersion, showLabel = true }: NodeStatusBadgeProps) {
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

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
      color: 'bg-[#3F8277]/20 text-[#3F8277] border-[#3F8277]/30',
      dotColor: 'bg-[#3F8277]',
    };
  };

  const status = getNodeStatus();

  const handleMouseEnter = () => {
    if (!triggerRef.current) return;
    
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const padding = 8;
    const tooltipWidth = 288; // w-72 = 288px
    const estimatedHeight = 100; // Rough estimate
    
    // Calculate center position
    let left = triggerRect.left + (triggerRect.width / 2);
    let top = triggerRect.top;
    let placement: 'top' | 'bottom' = 'top';
    
    // Adjust horizontal position to prevent overflow
    if (left - tooltipWidth / 2 < padding) {
      left = tooltipWidth / 2 + padding;
    } else if (left + tooltipWidth / 2 > window.innerWidth - padding) {
      left = window.innerWidth - tooltipWidth / 2 - padding;
    }
    
    // Check if tooltip would go above viewport
    if (top - estimatedHeight - padding < 0) {
      // Show below instead
      top = triggerRect.bottom + padding;
      placement = 'bottom';
    } else {
      top = top - estimatedHeight - padding;
    }
    
    setTooltipPosition({ top, left, placement });
    
    // After tooltip renders, adjust position based on actual size
    setTimeout(() => {
      if (!tooltipRef.current || !triggerRef.current) return;
      
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const newTriggerRect = triggerRef.current.getBoundingClientRect();
      
      let adjustedLeft = newTriggerRect.left + (newTriggerRect.width / 2);
      let adjustedTop = tooltipPosition?.top || top;
      let adjustedPlacement = placement;
      
      // Recalculate with actual tooltip size
      if (adjustedLeft - tooltipRect.width / 2 < padding) {
        adjustedLeft = tooltipRect.width / 2 + padding;
      } else if (adjustedLeft + tooltipRect.width / 2 > window.innerWidth - padding) {
        adjustedLeft = window.innerWidth - tooltipRect.width / 2 - padding;
      }
      
      if (adjustedPlacement === 'top' && adjustedTop - tooltipRect.height < 0) {
        adjustedTop = newTriggerRect.bottom + padding;
        adjustedPlacement = 'bottom';
      } else if (adjustedPlacement === 'top') {
        adjustedTop = newTriggerRect.top - tooltipRect.height - padding;
      }
      
      if (adjustedLeft !== left || adjustedTop !== top || adjustedPlacement !== placement) {
        setTooltipPosition({ top: adjustedTop, left: adjustedLeft, placement: adjustedPlacement });
      }
    }, 0);
  };

  const handleMouseLeave = () => {
    setTooltipPosition(null);
  };

  return (
    <div 
      ref={triggerRef}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium ${status.color} cursor-help group relative`}
      title={status.tooltip}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`} />
      {showLabel && <span>{status.label}</span>}
      {!showLabel && node.version && (
        <span className="font-mono text-[10px]">{node.version}</span>
      )}
      {/* Tooltip on hover */}
      {tooltipPosition && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl pointer-events-none border border-gray-700"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="font-semibold mb-1.5 text-white">{status.label}</div>
          <div className="text-gray-300 leading-relaxed">{status.tooltip}</div>
          <div 
            className={`absolute left-1/2 transform -translate-x-1/2 ${
              tooltipPosition.placement === 'top' 
                ? 'top-full -mt-1' 
                : 'bottom-full -mb-1'
            }`}
          >
            <div 
              className={`border-4 border-transparent ${
                tooltipPosition.placement === 'top'
                  ? 'border-t-gray-900'
                  : 'border-b-gray-900'
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

