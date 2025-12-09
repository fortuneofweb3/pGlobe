'use client';

import { PNode } from '@/lib/types/pnode';
import { useMemo } from 'react';
import { Package } from 'lucide-react';

interface VersionDistributionProps {
  nodes: PNode[];
}

export default function VersionDistribution({ nodes }: VersionDistributionProps) {
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

    // Latest version is the one with highest semantic version
    const latestVersion = sorted
      .filter(v => v.version !== 'Unknown')
      .sort((a, b) => {
        // Try semantic version comparison
        const aParts = a.version.replace('v', '').split('.').map(Number);
        const bParts = b.version.replace('v', '').split('.').map(Number);
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aVal = aParts[i] || 0;
          const bVal = bParts[i] || 0;
          if (aVal !== bVal) return bVal - aVal;
        }
        return 0;
      })[0]?.version;

    return { versions: sorted, latestVersion };
  }, [nodes]);

  const getVersionLabel = (version: string, isLatest: boolean) => {
    if (version === 'Unknown') return null;
    if (isLatest) return 'current';
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Package className="w-4 h-4 text-foreground/40" />
          Version Distribution
        </h3>
        <span className="text-xs text-muted-foreground">
          {versionStats.versions.length} {versionStats.versions.length === 1 ? 'version' : 'versions'}
        </span>
      </div>

      {/* Version List */}
      <div className="space-y-2">
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
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[#00FF88]/20 text-[#00FF88] font-medium">
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
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    isLatest ? 'bg-[#00FF88]' : 'bg-[#FFD700]/50'
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


