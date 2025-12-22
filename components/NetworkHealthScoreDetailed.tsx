'use client';

import { PNode } from '@/lib/types/pnode';
import { useMemo } from 'react';
import { Info, Activity } from 'lucide-react';
import { calculateNetworkHealth, getLatestVersion } from '@/lib/utils/network-health';
import AnimatedNumber from './AnimatedNumber';

interface NetworkHealthScoreDetailedProps {
  nodes: PNode[];
}

export default function NetworkHealthScoreDetailed({ nodes }: NetworkHealthScoreDetailedProps) {
  const healthMetrics = useMemo(() => calculateNetworkHealth(nodes), [nodes]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-[#3F8277]';
    if (score >= 60) return 'text-[#F0A741]';
    return 'text-red-400';
  };

  const getBarColor = (score: number) => {
    if (score >= 80) return 'bg-[#3F8277]';
    if (score >= 60) return 'bg-[#F0A741]';
    return 'bg-red-400';
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-foreground/40" />
        <h2 className="text-base font-semibold text-foreground">Network Health Score</h2>
      </div>
      
      {/* Overall Score - Large Display */}
      <div className="text-center py-3 border-b border-border">
        <div className="text-4xl font-bold mb-1">
          <span className={getScoreColor(healthMetrics.overall)}>
            <AnimatedNumber value={healthMetrics.overall} decimals={0} />
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          Overall Score
        </div>
      </div>

      {/* Score Breakdown Bars */}
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">Availability</span>
              <button className="text-muted-foreground hover:text-foreground transition-colors" title="Percentage of nodes currently online">
                <Info className="w-3 h-3" />
              </button>
            </div>
            <span className={`text-sm font-bold ${getScoreColor(healthMetrics.availability)}`}>
              <AnimatedNumber value={healthMetrics.availability} decimals={0} suffix="%" />
            </span>
          </div>
          <div className="w-full bg-muted/30 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${getBarColor(healthMetrics.availability)}`}
              style={{ width: `${healthMetrics.availability}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            <AnimatedNumber value={nodes.filter(n => n.status === 'online').length} /> / <AnimatedNumber value={nodes.length} /> nodes online
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">Version Health</span>
              <button className="text-muted-foreground hover:text-foreground transition-colors" title="Percentage of nodes on the latest version">
                <Info className="w-3 h-3" />
              </button>
            </div>
            <span className={`text-sm font-bold ${getScoreColor(healthMetrics.versionHealth)}`}>
              <AnimatedNumber value={healthMetrics.versionHealth} decimals={0} suffix="%" />
            </span>
          </div>
          <div className="w-full bg-muted/30 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${getBarColor(healthMetrics.versionHealth)}`}
              style={{ width: `${healthMetrics.versionHealth}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            <AnimatedNumber value={(() => {
              const versions = nodes.map(n => n.version).filter((v): v is string => !!v);
              const latest = getLatestVersion(versions);
              return latest ? nodes.filter(n => n.version === latest).length : 0;
            })()} /> nodes on latest version
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">Distribution</span>
              <button className="text-muted-foreground hover:text-foreground transition-colors" title="Geographic diversity of the network">
                <Info className="w-3 h-3" />
              </button>
            </div>
            <span className={`text-sm font-bold ${getScoreColor(healthMetrics.distribution)}`}>
              <AnimatedNumber value={healthMetrics.distribution} decimals={0} suffix="%" />
            </span>
          </div>
          <div className="w-full bg-muted/30 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${getBarColor(healthMetrics.distribution)}`}
              style={{ width: `${healthMetrics.distribution}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            <AnimatedNumber value={healthMetrics.countries} /> countries, <AnimatedNumber value={healthMetrics.cities} /> cities
          </div>
        </div>
      </div>
    </div>
  );
}


