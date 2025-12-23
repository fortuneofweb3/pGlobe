'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface InfoTooltipProps {
  content: string;
  children?: React.ReactNode;
}

/**
 * Info icon with tooltip on hover
 * Use for explaining metrics and technical terms
 * Renders tooltip in a portal to avoid parent container overflow clipping
 */
export default function InfoTooltip({ content, children }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: -9999, left: -9999, arrowLeft: 0, ready: false });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Use useLayoutEffect to prevent visual flash of unpositioned tooltip
  const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

  useIsomorphicLayoutEffect(() => {
    if (isVisible && triggerRef.current) {
      const updatePosition = () => {
        if (!triggerRef.current) return;

        // Measure immediately
        const triggerRect = triggerRef.current.getBoundingClientRect();

        // If tooltip ref is available, measure and position immediately
        if (tooltipRef.current) {
          const tooltip = tooltipRef.current;
          const tooltipRect = tooltip.getBoundingClientRect();
          const tooltipWidth = tooltipRect.width || tooltip.offsetWidth || 320;

          const triggerCenterX = triggerRect.left + triggerRect.width / 2;
          let left = triggerCenterX - tooltipWidth / 2;
          const top = triggerRect.top - 8; // 8px above trigger

          // Prevent overflow on left edge
          const margin = 12;
          if (left < margin) {
            left = margin;
          }

          // Prevent overflow on right edge
          const maxLeft = window.innerWidth - tooltipWidth - margin;
          if (left > maxLeft) {
            left = Math.max(margin, maxLeft);
          }

          // Calculate arrow position relative to trigger center
          const arrowLeft = triggerCenterX - left;

          setTooltipPosition({
            top,
            left,
            arrowLeft: Math.max(16, Math.min(arrowLeft, tooltipWidth - 16)),
            ready: true,
          });
        } else {
          // If ref not ready yet (first render), schedule update
          requestAnimationFrame(updatePosition);
        }
      };

      // Update immediately
      updatePosition();

      // Update on scroll/resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    } else {
      setTooltipPosition((prev) => prev.ready ? { ...prev, ready: false } : prev);
    }
  }, [isVisible]);

  const tooltipContent = isVisible && typeof document !== 'undefined' ? (
    createPortal(
      <div
        ref={tooltipRef}
        className="fixed px-3 py-2 text-xs text-foreground bg-black/95 border border-border rounded-lg shadow-xl w-max max-w-[320px] whitespace-normal pointer-events-none z-[1001]"
        style={{
          top: tooltipPosition.ready ? `${tooltipPosition.top}px` : '-9999px',
          left: tooltipPosition.ready ? `${tooltipPosition.left}px` : '-9999px',
          transform: tooltipPosition.ready ? 'translateY(-100%)' : 'none',
          visibility: tooltipPosition.ready ? 'visible' : 'hidden',
        }}
      >
        {content}
        {/* Arrow pointing down */}
        <div
          className="absolute top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-black/95"
          style={{
            left: `${tooltipPosition.arrowLeft}px`,
            transform: 'translateX(-50%)',
          }}
        />
      </div>,
      document.body
    )
  ) : null;

  return (
    <>
      <span
        ref={triggerRef}
        className="relative inline-flex items-center cursor-help"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children || (
          <svg
            className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )}
      </span>
      {tooltipContent}
    </>
  );
}

/**
 * Metric row with label, value, and optional tooltip
 */
interface MetricRowProps {
  label: string;
  value: string | number;
  tooltip?: string;
  valueColor?: string;
  animateValue?: boolean;
  valueFormatter?: (value: number) => string;
}

export function MetricRow({ label, value, tooltip, valueColor = 'text-foreground', animateValue = false, valueFormatter }: MetricRowProps) {
  const AnimatedNumber = animateValue && typeof value === 'number' ? require('@/components/AnimatedNumber').default : null;

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-foreground/70 flex items-center gap-1.5">
        {label}
        {tooltip && <InfoTooltip content={tooltip} />}
      </span>
      <span className={`text-sm font-semibold ${valueColor}`}>
        {animateValue && typeof value === 'number' && AnimatedNumber ? (
          <AnimatedNumber value={value} formatter={valueFormatter} />
        ) : (
          value
        )}
      </span>
    </div>
  );
}

