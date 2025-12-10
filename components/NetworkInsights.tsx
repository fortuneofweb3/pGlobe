'use client';

import { PNode } from '@/lib/types/pnode';
import { useMemo } from 'react';
import { AlertCircle, CheckCircle, TrendingUp, AlertTriangle, Info } from 'lucide-react';

interface NetworkInsightsProps {
  nodes: PNode[];
}

interface Insight {
  id: string;
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  description: string;
  icon: React.ReactNode;
}

export default function NetworkInsights({ nodes }: NetworkInsightsProps) {
  const insights = useMemo(() => {
    const insights: Insight[] = [];

    if (nodes.length === 0) {
      return [{
        id: 'no-data',
        type: 'info' as const,
        title: 'No data available',
        description: 'Waiting for node data...',
        icon: <Info className="w-4 h-4" />,
      }];
    }

    // 1. Network Availability
    const onlineNodes = nodes.filter(n => n.status === 'online').length;
    const availabilityPercent = (onlineNodes / nodes.length) * 100;
    
    if (availabilityPercent === 100) {
      insights.push({
        id: 'full-availability',
        type: 'success',
        title: 'Full network availability',
        description: 'All nodes are online and responsive',
        icon: <CheckCircle className="w-4 h-4" />,
      });
    } else if (availabilityPercent < 80) {
      insights.push({
        id: 'low-availability',
        type: 'warning',
        title: 'Reduced network availability',
        description: `Only ${onlineNodes} of ${nodes.length} nodes online (${availabilityPercent.toFixed(0)}%)`,
        icon: <AlertTriangle className="w-4 h-4" />,
      });
    }

    // 2. Version Health
    const versions = nodes.map(n => n.version).filter(v => v);
    const latestVersion = versions.sort().reverse()[0];
    const latestVersionNodes = nodes.filter(n => n.version === latestVersion).length;
    const versionHealthPercent = (latestVersionNodes / nodes.length) * 100;

    if (versionHealthPercent === 100) {
      insights.push({
        id: 'version-health',
        type: 'success',
        title: 'Excellent version health',
        description: '100% of nodes on latest version',
        icon: <CheckCircle className="w-4 h-4" />,
      });
    } else if (versionHealthPercent < 80) {
      const outdatedCount = nodes.length - latestVersionNodes;
      insights.push({
        id: 'version-warning',
        type: 'warning',
        title: 'Version fragmentation detected',
        description: `${outdatedCount} node${outdatedCount === 1 ? '' : 's'} running outdated version${outdatedCount === 1 ? '' : 's'}`,
        icon: <AlertTriangle className="w-4 h-4" />,
      });
    }

    // 3. At Risk Nodes (offline or old version)
    const atRiskNodes = nodes.filter(n => n.status === 'offline' || n.version !== latestVersion);
    if (atRiskNodes.length === 0) {
      insights.push({
        id: 'no-risk',
        type: 'success',
        title: 'No nodes at risk',
        description: 'All nodes are healthy and up to date',
        icon: <CheckCircle className="w-4 h-4" />,
      });
    } else if (atRiskNodes.length > 0) {
      insights.push({
        id: 'at-risk',
        type: atRiskNodes.length > nodes.length * 0.2 ? 'error' : 'info',
        title: `${atRiskNodes.length} node${atRiskNodes.length === 1 ? '' : 's'} at risk`,
        description: atRiskNodes.length > nodes.length * 0.2
          ? 'Significant number of nodes offline or outdated'
          : 'Some nodes need attention',
        icon: atRiskNodes.length > nodes.length * 0.2 
          ? <AlertCircle className="w-4 h-4" />
          : <Info className="w-4 h-4" />,
      });
    }

    // 4. Geographic Distribution
    const countries = new Set(nodes.map(n => n.locationData?.country).filter(c => c));
    if (countries.size >= 5) {
      insights.push({
        id: 'good-distribution',
        type: 'success',
        title: 'Strong geographic distribution',
        description: `Network spans ${countries.size} countries`,
        icon: <TrendingUp className="w-4 h-4" />,
      });
    } else if (countries.size <= 2) {
      insights.push({
        id: 'poor-distribution',
        type: 'warning',
        title: 'Limited geographic diversity',
        description: `Network concentrated in ${countries.size} ${countries.size === 1 ? 'country' : 'countries'}`,
        icon: <AlertTriangle className="w-4 h-4" />,
      });
    }

    // 5. Overall Health Assessment
    const healthScore = Math.round(
      availabilityPercent * 0.40 +
      versionHealthPercent * 0.35 +
      Math.min(100, (countries.size / 10) * 100) * 0.25
    );

    if (healthScore >= 80 && insights.filter(i => i.type === 'warning' || i.type === 'error').length === 0) {
      insights.push({
        id: 'healthy',
        type: 'success',
        title: 'Network is healthy',
        description: `Health score: ${healthScore}. No issues detected.`,
        icon: <CheckCircle className="w-4 h-4" />,
      });
    }

    return insights;
  }, [nodes]);

  const getTypeStyles = (type: Insight['type']) => {
    switch (type) {
      case 'success':
        return 'bg-[#3F8277]/10 border-[#3F8277]/30 text-[#3F8277]';
      case 'warning':
        return 'bg-[#F0A741]/10 border-[#F0A741]/30 text-[#F0A741]';
      case 'error':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      case 'info':
      default:
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Insights</h3>
        <span className="text-xs text-muted-foreground">
          {insights.length} {insights.length === 1 ? 'insight' : 'insights'}
        </span>
      </div>

      {/* Insights List */}
      <div className="space-y-2">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={`p-3 rounded-lg border ${getTypeStyles(insight.type)}`}
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5">{insight.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground mb-0.5">
                  {insight.title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {insight.description}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}



