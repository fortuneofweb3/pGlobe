'use client';

import { useMemo } from 'react';
import { PNode } from '@/lib/types/pnode';
import { ParentSize } from '@visx/responsive';
import { Bar } from '@visx/shape';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';

interface CreditsDistributionChartProps {
    nodes: PNode[];
    height?: number;
}

interface BucketData {
    range: string;
    count: number;
    min: number;
    max: number;
}

const tooltipStyles = {
    ...defaultStyles,
    backgroundColor: 'rgba(10,10,10,0.95)',
    border: '1px solid rgba(240,167,65,0.2)',
    borderRadius: '8px',
    color: 'white',
    padding: '8px 12px',
};

export default function CreditsDistributionChart({ nodes, height = 300 }: CreditsDistributionChartProps) {
    const {
        tooltipOpen,
        tooltipLeft,
        tooltipTop,
        tooltipData,
        hideTooltip,
        showTooltip,
    } = useTooltip<BucketData>();

    const chartData = useMemo(() => {
        const nodesWithCredits = nodes.filter(n => (n as any).derivedBoostedCredits !== undefined && (n as any).derivedBoostedCredits > 0);

        if (nodesWithCredits.length === 0) return [];

        const maxCredits = Math.max(...nodesWithCredits.map(n => (n as any).derivedBoostedCredits || 0));
        const bucketCount = Math.min(10, Math.max(5, Math.ceil(maxCredits / 100)));
        const bucketSize = Math.ceil(maxCredits / bucketCount);

        const buckets: BucketData[] = [];

        for (let i = 0; i < bucketCount; i++) {
            const min = i * bucketSize;
            const max = (i + 1) * bucketSize;
            buckets.push({
                range: `${min}-${max}`,
                count: 0,
                min,
                max,
            });
        }

        for (const node of nodesWithCredits) {
            const credits = (node as any).derivedBoostedCredits || 0;
            const bucketIndex = Math.min(Math.floor(credits / bucketSize), bucketCount - 1);
            buckets[bucketIndex].count++;
        }

        return buckets;
    }, [nodes]);

    if (chartData.length === 0) {
        return (
            <div className="flex items-center justify-center" style={{ height }}>
                <p className="text-sm text-foreground/40">No credits data to display</p>
            </div>
        );
    }

    const margin = { top: 20, right: 20, bottom: 60, left: 50 };

    return (
        <div style={{ position: 'relative', height }}>
            <ParentSize>
                {({ width, height: parentHeight }) => {
                    const innerWidth = width - margin.left - margin.right;
                    const innerHeight = parentHeight - margin.top - margin.bottom;

                    if (innerWidth <= 0 || innerHeight <= 0) return null;

                    const xScale = scaleBand<string>({
                        range: [0, innerWidth],
                        domain: chartData.map(d => d.range),
                        padding: 0.3,
                    });

                    const yScale = scaleLinear<number>({
                        range: [innerHeight, 0],
                        domain: [0, Math.max(...chartData.map(d => d.count)) * 1.1],
                        nice: true,
                    });

                    return (
                        <svg width={width} height={parentHeight}>
                            <Group left={margin.left} top={margin.top}>
                                {chartData.map((d, i) => {
                                    const barWidth = xScale.bandwidth();
                                    const barHeight = innerHeight - (yScale(d.count) ?? 0);
                                    const barX = xScale(d.range) ?? 0;
                                    const barY = innerHeight - barHeight;
                                    const opacity = 0.4 + (i / chartData.length) * 0.6;

                                    return (
                                        <Bar
                                            key={`bar-${i}`}
                                            x={barX}
                                            y={barY}
                                            width={barWidth}
                                            height={barHeight}
                                            fill={`rgba(240, 167, 65, ${opacity})`}
                                            rx={4}
                                            onMouseMove={(event) => {
                                                const coords = localPoint(event);
                                                showTooltip({
                                                    tooltipData: d,
                                                    tooltipLeft: (coords?.x ?? 0) + margin.left,
                                                    tooltipTop: (coords?.y ?? 0) + margin.top,
                                                });
                                            }}
                                            onMouseLeave={() => hideTooltip()}
                                        />
                                    );
                                })}

                                <AxisBottom
                                    top={innerHeight}
                                    scale={xScale}
                                    tickLabelProps={() => ({
                                        fill: 'rgba(255,255,255,0.4)',
                                        fontSize: 10,
                                        textAnchor: 'end',
                                        angle: -45,
                                        dy: '0.25em',
                                        dx: '-0.5em',
                                    })}
                                    tickLineProps={{ stroke: 'rgba(255,255,255,0.1)' }}
                                    stroke="rgba(255,255,255,0.1)"
                                />

                                <AxisLeft
                                    scale={yScale}
                                    tickLabelProps={() => ({
                                        fill: 'rgba(255,255,255,0.4)',
                                        fontSize: 10,
                                        textAnchor: 'end',
                                        dx: '-0.25em',
                                    })}
                                    tickLineProps={{ stroke: 'rgba(255,255,255,0.1)' }}
                                    stroke="rgba(255,255,255,0.1)"
                                    numTicks={5}
                                />
                            </Group>
                        </svg>
                    );
                }}
            </ParentSize>

            {tooltipOpen && tooltipData && (
                <TooltipWithBounds
                    top={tooltipTop}
                    left={tooltipLeft}
                    style={tooltipStyles}
                >
                    <div className="text-xs">
                        <div className="text-foreground/60 mb-1">Boosted Weight: {tooltipData.range}</div>
                        <div className="text-[#F0A741] font-bold">{tooltipData.count} nodes</div>
                    </div>
                </TooltipWithBounds>
            )}
        </div>
    );
}
