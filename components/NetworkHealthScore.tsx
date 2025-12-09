'use client';

import { PNode } from '@/lib/types/pnode';
import { useMemo } from 'react';
import { calculateNetworkHealth } from '@/lib/utils/network-health';

interface NetworkHealthScoreProps {
  nodes: PNode[];
}

export default function NetworkHealthScore({ nodes }: NetworkHealthScoreProps) {
  const healthMetrics = useMemo(() => calculateNetworkHealth(nodes), [nodes]);
  const healthScore = healthMetrics.overall;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  return (
    <div className="space-y-4">
      {/* Score Circle - Centered */}
      <div className="flex justify-center">
        <div className="relative w-24 h-24">
          <svg className="transform -rotate-90 w-24 h-24">
            <circle
              cx="48"
              cy="48"
              r="42"
              stroke="rgb(var(--color_38))"
              strokeWidth="6"
              fill="none"
            />
            <circle
              cx="48"
              cy="48"
              r="42"
              stroke={healthScore >= 80 ? '#3F8277' : healthScore >= 60 ? '#F0A741' : '#E31C24'}
              strokeWidth="6"
              fill="none"
              strokeDasharray={`${(healthScore / 100) * 263.9} 263.9`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className={`text-xl font-bold ${getScoreColor(healthScore)}`}>
                {healthScore}
              </div>
              <div className="text-[10px] text-muted-foreground">/ 100</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Status Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Status</span>
          <span className={`text-xs font-medium ${getScoreColor(healthScore)}`}>
            {getScoreLabel(healthScore)}
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${
              healthScore >= 80 ? 'bg-green-500' : healthScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${healthScore}%` }}
          />
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div>
          <div className="text-[10px] text-muted-foreground mb-0.5">Online Nodes</div>
          <div className="text-xs font-medium text-foreground">
            {nodes.filter(n => n.status === 'online').length} / {nodes.length}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground mb-0.5">Latest Version</div>
          <div className="text-xs font-medium text-foreground">
            {nodes.filter(n => {
              const latest = nodes.map(n => n.version).filter(v => v).sort().reverse()[0];
              return n.version === latest;
            }).length} nodes
          </div>
        </div>
      </div>
    </div>
  );
}

