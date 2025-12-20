'use client';

import { PNode } from '@/lib/types/pnode';
import { useMemo, useEffect, useRef } from 'react';
import { Package } from 'lucide-react';

interface VersionDistributionProps {
  nodes: PNode[];
}

export default function VersionDistribution({ nodes }: VersionDistributionProps) {
  const progressBarRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const hasAnimatedRef = useRef(false);

  const versionStats = useMemo(() => {
    const versionMap = new Map<string, number>();
    
    nodes.forEach(node => {
      const version = node.version || 'Unknown';
      versionMap.set(version, (versionMap.get(version) || 0) + 1);
    });

    // Sort by count descending
    const sorted = Array.from(versionMap.entries())
      .map(([version, count]) => ({
        version,
        count,
        percentage: (count / nodes.length) * 100,
      }))
      .sort((a, b) => b.count - a.count);

    // Latest version is the one with highest semantic version (excluding trynet versions)
    // Filter out trynet versions when determining "current"
    const nonTrynetVersions = sorted.filter(v => 
      v.version !== 'Unknown' && !v.version.includes('-trynet')
    );
    
    const latestVersion = nonTrynetVersions.length > 0
      ? nonTrynetVersions.sort((a, b) => {
          // Try semantic version comparison
          // Extract base version (before any dashes)
          const aBase = a.version.replace('v', '').split('-')[0];
          const bBase = b.version.replace('v', '').split('-')[0];
          const aParts = aBase.split('.').map(Number);
          const bParts = bBase.split('.').map(Number);
          for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aVal = aParts[i] || 0;
            const bVal = bParts[i] || 0;
            if (aVal !== bVal) return bVal - aVal;
          }
          return 0;
        })[0]?.version
      : null;

    return { versions: sorted, latestVersion };
  }, [nodes]);

  // Animate progress bars on mount and when data changes
  useEffect(() => {
    if (versionStats.versions.length === 0) return;
    
    hasAnimatedRef.current = false;
    
    const timer = setTimeout(() => {
      if (hasAnimatedRef.current) return;
      
      versionStats.versions.forEach(({ version, percentage }, index) => {
        const bar = progressBarRefs.current.get(version);
        if (bar) {
          // Start from 0 width
          bar.style.width = '0%';
          bar.style.transition = `width 1s ease-out ${index * 0.1}s`;
          
          requestAnimationFrame(() => {
            bar.style.width = `${percentage}%`;
          });
        }
      });
      
      hasAnimatedRef.current = true;
    }, 50);

    return () => clearTimeout(timer);
  }, [versionStats.versions.length]);

  const getVersionLabel = (version: string, isLatest: boolean) => {
    if (version === 'Unknown') return null;
    if (isLatest) return 'current';
    return null;
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-foreground/40" />
          <h2 className="text-base font-semibold text-foreground">Version Distribution</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {versionStats.versions.length} {versionStats.versions.length === 1 ? 'version' : 'versions'}
        </span>
      </div>

      {/* Version List */}
      <div className="space-y-2 flex-1 overflow-y-auto pr-2 min-h-0 max-h-[360px]">
        {versionStats.versions.map(({ version, count, percentage }) => {
          const isLatest = version === versionStats.latestVersion;
          const label = getVersionLabel(version, isLatest);

          return (
            <div key={version} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-foreground">
                    {version}
                  </span>
                  {label && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[#3F8277]/20 text-[#3F8277] font-medium">
                      {label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {count} ({percentage.toFixed(0)}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-muted/30 rounded-full h-1.5">
                <div
                  ref={(el) => {
                    if (el) progressBarRefs.current.set(version, el);
                  }}
                  className={`h-1.5 rounded-full ${
                    isLatest ? 'bg-[#3F8277]' : 'bg-[#F0A741]/50'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


