'use client';

/**
 * Simple page skeleton components for loading states.
 * These are intentionally minimal and clean.
 */

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="w-full animate-pulse" style={{ height: `${height}px` }}>
      <div className="h-full bg-muted/20 rounded-lg" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full animate-pulse space-y-3">
      {/* Header */}
      <div className="h-10 bg-muted/30 rounded" />
      {/* Rows */}
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="h-14 bg-muted/20 rounded" />
      ))}
    </div>
  );
}

export function MapSkeleton({ height = 400 }: { height?: number }) {
  return (
    <div
      className="w-full bg-muted/20 rounded-lg animate-pulse"
      style={{ height: `${height}px` }}
    />
  );
}

export function GlobeSkeleton({ height = 600 }: { height?: number }) {
  return (
    <div
      className="w-full bg-muted/20 rounded-lg animate-pulse"
      style={{ height: `${height}px` }}
    />
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="card animate-pulse p-4">
          <div className="h-5 w-24 bg-muted/30 rounded mb-3" />
          <div className="h-8 w-16 bg-muted/40 rounded mb-2" />
          <div className="h-4 w-32 bg-muted/20 rounded" />
        </div>
      ))}
    </>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card-stat animate-pulse">
      <div className="h-4 w-20 bg-muted/30 rounded mb-3" />
      <div className="h-8 w-16 bg-muted/40 rounded mb-2" />
      <div className="h-3 w-24 bg-muted/20 rounded" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      {/* Title */}
      <div className="h-8 w-48 bg-muted/30 rounded" />
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-muted/20 rounded-lg" />
        ))}
      </div>
      {/* Content area */}
      <div className="h-64 bg-muted/20 rounded-lg" />
    </div>
  );
}

/**
 * Era/Milestone card skeleton for Overview sidebar
 */
export function EraCardSkeleton() {
  return (
    <div className="relative p-4 rounded-xl bg-[#050505] border border-[#F0A741]/10 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-[#F0A741]/10" />
        <div className="space-y-2">
          <div className="h-5 w-24 bg-muted/20 rounded" />
          <div className="h-3 w-20 bg-muted/10 rounded" />
        </div>
      </div>
      <div className="space-y-3 mb-4">
        <div className="flex justify-between">
          <div className="h-4 w-16 bg-muted/10 rounded" />
          <div className="h-4 w-12 bg-muted/20 rounded" />
        </div>
        <div className="flex justify-between">
          <div className="h-4 w-24 bg-muted/10 rounded" />
          <div className="h-4 w-16 bg-muted/20 rounded" />
        </div>
      </div>
      <div className="p-2.5 rounded-lg bg-[#F0A741]/5 border border-[#F0A741]/20">
        <div className="h-3 w-20 bg-muted/10 rounded mb-2" />
        <div className="h-4 w-32 bg-muted/20 rounded" />
      </div>
    </div>
  );
}

/**
 * Metric row skeleton for sidebar stats
 */
export function MetricRowSkeleton({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-foreground/70">{label}</span>
      <span className="h-4 w-12 bg-muted/20 rounded animate-pulse" />
    </div>
  );
}

/**
 * Sidebar stats section skeleton
 */
export function SidebarStatsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Network Stats */}
      <div>
        <h2 className="text-xs font-semibold text-foreground/60 mb-3 uppercase tracking-wide">Network Stats</h2>
        <div className="space-y-2">
          <MetricRowSkeleton label="Total pNodes" />
          <MetricRowSkeleton label="Online" />
          <MetricRowSkeleton label="Syncing" />
          <MetricRowSkeleton label="Offline" />
        </div>
      </div>

      {/* Performance */}
      <div className="pt-4 border-t border-border">
        <h2 className="text-xs font-semibold text-foreground/60 mb-3 uppercase tracking-wide">Performance</h2>
        <div className="space-y-2">
          <MetricRowSkeleton label="Avg Uptime" />
          <MetricRowSkeleton label="Avg CPU" />
          <MetricRowSkeleton label="Avg RAM" />
        </div>
      </div>

      {/* Storage & Memory */}
      <div className="pt-4 border-t border-border">
        <h2 className="text-xs font-semibold text-foreground/60 mb-3 uppercase tracking-wide">Storage & Memory</h2>
        <div className="space-y-2">
          <MetricRowSkeleton label="Total Storage" />
          <MetricRowSkeleton label="Total RAM" />
          <MetricRowSkeleton label="Used RAM" />
          <MetricRowSkeleton label="Avg RAM Usage" />
        </div>
      </div>
    </div>
  );
}

/**
 * Manager card skeleton for grid display
 */
export function ManagerCardSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="card p-4 animate-pulse">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-muted/20" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-muted/30 rounded" />
              <div className="h-3 w-16 bg-muted/20 rounded" />
            </div>
          </div>
          <div className="space-y-3 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-muted/20 rounded" />
              <div className="h-3 w-full bg-muted/20 rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-muted/20 rounded" />
              <div className="h-3 w-3/4 bg-muted/20 rounded" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * Leaderboard skeleton for ranking lists
 */
export function LeaderboardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-4 w-4 bg-muted/20 rounded" />
          <div className="h-4 w-32 bg-muted/30 rounded" />
          <div className="ml-auto h-4 w-16 bg-muted/20 rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * Scan page sidebar skeleton
 */
export function ScanSidebarSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {/* Location placeholder */}
      <div className="p-3 bg-muted/30 rounded-lg border border-border">
        <div className="flex items-start gap-2">
          <div className="w-4 h-4 bg-muted/40 rounded mt-0.5" />
          <div className="flex-1">
            <div className="h-4 w-32 bg-muted/40 rounded mb-1.5" />
            <div className="h-3 w-48 bg-muted/30 rounded" />
          </div>
        </div>
      </div>

      {/* Results list */}
      <div className="space-y-1.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-2 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-start justify-between mb-1">
              <div className="h-3 w-32 bg-muted/40 rounded" />
              <div className="h-3 w-12 bg-muted/40 rounded" />
            </div>
            <div className="h-3 w-24 bg-muted/30 rounded mb-1.5" />
            <div className="flex items-center gap-2">
              <div className="h-4 w-14 bg-muted/30 rounded" />
              <div className="h-4 w-10 bg-muted/30 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
