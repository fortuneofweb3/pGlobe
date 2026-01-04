'use client';

/**
 * Simple page skeleton components for loading states.
 * These are intentionally minimal and clean.
 */

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="w-full" style={{ height: `${height}px` }}>
      <div className="h-full bg-muted/20 rounded-lg" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="h-10 bg-muted/30 rounded" />
      {/* Rows */}
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="h-14 bg-muted/20 rounded" />
      ))}
    </div>
  );
}

export function PNodeTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="card flex flex-col h-full overflow-hidden" style={{ padding: 0 }}>
      {/* Info Banner Placeholder */}
      <div className="px-3 sm:px-4 py-2 bg-muted border-b border-border/60 flex-shrink-0">
        <div className="h-4 w-3/4 bg-muted/40 rounded" />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden min-h-0 -mt-px bg-card">
        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 bg-card">
          <table className="min-w-full border-collapse m-0 border-spacing-0">
            <thead className="sticky top-0 z-10 bg-muted border-b border-border/60">
              <tr>
                <th className="px-2 py-4"><div className="w-4 h-4 bg-muted/40 rounded-full mx-auto" /></th>
                <th className="px-3 sm:px-5 py-4 text-left"><div className="h-3 w-20 bg-muted/40 rounded" /></th>
                <th className="px-2 sm:px-3 py-4 text-center"><div className="h-3 w-12 bg-muted/40 rounded mx-auto" /></th>
                <th className="px-3 sm:px-5 py-4 text-left"><div className="h-3 w-24 bg-muted/40 rounded" /></th>
                <th className="px-3 sm:px-5 py-4 text-center"><div className="h-3 w-16 bg-muted/40 rounded mx-auto" /></th>
                <th className="px-3 sm:px-5 py-4 text-left"><div className="h-3 w-16 bg-muted/40 rounded" /></th>
                <th className="px-3 sm:px-5 py-4 text-center"><div className="h-3 w-16 bg-muted/40 rounded mx-auto" /></th>
                <th className="px-3 sm:px-5 py-4 text-left"><div className="h-3 w-16 bg-muted/40 rounded" /></th>
                <th className="px-3 sm:px-5 py-4 text-left"><div className="h-3 w-16 bg-muted/40 rounded" /></th>
                <th className="px-3 sm:px-5 py-4 text-left"><div className="h-3 w-16 bg-muted/40 rounded" /></th>
                <th className="px-2 sm:px-4 py-3 text-left"><div className="h-3 w-16 bg-muted/40 rounded" /></th>
                <th className="px-2 sm:px-4 py-3 text-right"><div className="h-3 w-16 bg-muted/40 rounded ml-auto" /></th>
                <th className="px-3 sm:px-5 py-4 text-left"><div className="h-3 w-16 bg-muted/40 rounded" /></th>
                <th className="px-3 sm:px-5 py-4 text-right"><div className="h-3 w-16 bg-muted/40 rounded ml-auto" /></th>
                <th className="px-3 sm:px-5 py-4 text-right"><div className="h-3 w-16 bg-muted/40 rounded ml-auto" /></th>
                <th className="px-3 sm:px-5 py-4 text-left"><div className="h-3 w-16 bg-muted/40 rounded" /></th>
                <th className="px-3 sm:px-5 py-4 text-left"><div className="h-3 w-16 bg-muted/40 rounded" /></th>
                <th className="px-3 sm:px-5 py-4 text-left"><div className="h-3 w-16 bg-muted/40 rounded" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {[...Array(rows)].map((_, i) => (
                <tr key={i} className="border-b border-white/[0.03] bg-white/[0.01]">
                  <td className="px-2 py-5 text-center"><div className="w-4 h-4 bg-muted/20 rounded-full mx-auto" /></td>
                  <td className="px-3 sm:px-5 py-5"><div className="h-4 w-24 bg-muted/30 rounded" /></td>
                  <td className="px-2 sm:px-3 py-5 text-center"><div className="w-3 h-3 bg-muted/20 rounded-full mx-auto" /></td>
                  <td className="px-3 sm:px-5 py-4"><div className="h-4 w-32 bg-muted/20 rounded" /></td>
                  <td className="px-3 sm:px-5 py-5 text-center"><div className="w-4 h-4 bg-muted/20 rounded mx-auto" /></td>
                  <td className="px-3 sm:px-5 py-5 text-center"><div className="h-4 w-16 bg-muted/20 rounded mx-auto" /></td>
                  <td className="px-3 sm:px-5 py-5 text-center"><div className="w-4 h-4 bg-muted/20 rounded mx-auto" /></td>
                  <td className="px-3 sm:px-5 py-5"><div className="h-4 w-16 bg-muted/20 rounded" /></td>
                  <td className="px-3 sm:px-5 py-5"><div className="h-4 w-16 bg-muted/20 rounded" /></td>
                  <td className="px-3 sm:px-5 py-5"><div className="h-4 w-12 bg-muted/20 rounded" /></td>
                  <td className="px-2 sm:px-4 py-3"><div className="h-4 w-20 bg-muted/20 rounded" /></td>
                  <td className="px-2 sm:px-4 py-3"><div className="h-4 w-12 bg-muted/20 rounded ml-auto" /></td>
                  <td className="px-3 sm:px-5 py-5"><div className="h-4 w-12 bg-muted/20 rounded" /></td>
                  <td className="px-3 sm:px-5 py-5"><div className="h-4 w-16 bg-muted/20 rounded ml-auto" /></td>
                  <td className="px-3 sm:px-5 py-5"><div className="h-4 w-16 bg-muted/20 rounded ml-auto" /></td>
                  <td className="px-3 sm:px-5 py-5"><div className="h-4 w-16 bg-muted/20 rounded" /></td>
                  <td className="px-3 sm:px-5 py-5"><div className="h-4 w-16 bg-muted/20 rounded" /></td>
                  <td className="px-2 sm:px-4 py-3"><div className="h-4 w-14 bg-muted/20 rounded" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function MapSkeleton({ height = 400 }: { height?: number }) {
  return (
    <div
      className="w-full bg-muted/20 rounded-lg"
      style={{ height: `${height}px` }}
    />
  );
}

export function GlobeSkeleton({ height = 600 }: { height?: number }) {
  return (
    <div
      className="w-full bg-muted/20 rounded-lg"
      style={{ height: `${height}px` }}
    />
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="card p-4">
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
    <div className="card-stat bg-[#0a0a0a] border-white/5 backdrop-blur-md overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <div className="h-3 w-20 bg-muted/20 rounded" />
        <div className="w-3.5 h-3.5 bg-muted/10 rounded-full" />
      </div>
      <div className="h-8 w-24 bg-muted/30 rounded mb-2" />
      <div className="h-3 w-32 bg-muted/10 rounded" />
      {/* Decorative blur circle placeholder */}
      <div className="absolute -right-6 -bottom-6 w-12 h-12 bg-white/5 rounded-full blur-xl" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
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
 * Matches strictly the 'flat' variant of MilestoneTracker
 */
export function EraCardSkeleton() {
  return (
    <div className="relative p-4 rounded-xl bg-[#050505] border border-[#F0A741]/10 overflow-hidden">
      {/* Header: Icon + Title */}
      <div className="flex items-center justify-between mb-4 mt-1">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#F0A741]/10">
            <div className="w-5 h-5 bg-[#F0A741]/20 rounded" />
          </div>
          <div>
            <div className="h-5 w-32 bg-muted/20 rounded mb-1" />
            <div className="h-2.5 w-24 bg-muted/10 rounded" />
          </div>
        </div>
      </div>

      {/* Milestone Info */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-16 bg-muted/10 rounded" />
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-[#F0A741]/20 rounded" />
            <div className="h-4 w-20 bg-muted/20 rounded" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="h-4 w-28 bg-muted/10 rounded" />
          <div className="h-4 w-14 bg-[#3F8277]/20 rounded" />
        </div>
      </div>

      {/* Feature badge */}
      <div className="p-2.5 rounded-lg bg-[#F0A741]/5 border border-[#F0A741]/20">
        <div className="flex items-start gap-2">
          <div className="w-4 h-4 mt-0.5 bg-[#F0A741]/20 rounded shrink-0" />
          <div className="w-full">
            <div className="h-2.5 w-24 bg-muted/10 rounded mb-1" />
            <div className="h-4 w-3/4 bg-muted/20 rounded" />
          </div>
        </div>
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
      <span className="h-4 w-12 bg-muted/20 rounded" />
    </div>
  );
}

/**
 * Sidebar stats section skeleton - matches loaded Overview sidebar exactly
 */
export function SidebarStatsSkeleton() {
  return (
    <>
      {/* Network Stats - matches pt-4 div with h2 mb-2 */}
      <div className="pt-4">
        <h2 className="text-xs font-semibold text-foreground/60 mb-2 uppercase tracking-wide hidden md:block">Network Stats</h2>
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-foreground/70">Total pNodes</span>
            <span className="h-4 w-8 bg-muted/20 rounded" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-foreground/70">Online</span>
            <span className="h-4 w-8 bg-[#3F8277]/20 rounded" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-foreground/70">Syncing</span>
            <span className="h-4 w-6 bg-[#F0A741]/20 rounded" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-foreground/70">Offline</span>
            <span className="h-4 w-6 bg-red-400/20 rounded" />
          </div>
        </div>
      </div>

      {/* Performance - matches pt-4 sm:pt-6 border-t border-border */}
      <div className="pt-4 sm:pt-6 border-t border-border">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">Performance</h2>
          <span className="h-3 w-24 bg-muted/10 rounded hidden sm:block" />
        </div>
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-foreground/70">Avg Uptime</span>
            <span className="h-4 w-14 bg-[#3F8277]/20 rounded" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-foreground/70">Avg CPU</span>
            <span className="h-4 w-10 bg-muted/20 rounded" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-foreground/70">Avg RAM</span>
            <span className="h-4 w-10 bg-muted/20 rounded" />
          </div>
        </div>
      </div>

      {/* Storage & Memory - matches pt-4 sm:pt-6 border-t border-border */}
      <div className="pt-4 sm:pt-6 border-t border-border">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">Storage & Memory</h2>
        </div>
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-foreground/70">Total Storage</span>
            <span className="h-4 w-16 bg-muted/20 rounded" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-foreground/70">Total RAM</span>
            <span className="h-4 w-14 bg-muted/20 rounded" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-foreground/70">Used RAM</span>
            <span className="h-4 w-14 bg-muted/20 rounded" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-foreground/70">Avg RAM Usage</span>
            <span className="h-4 w-10 bg-muted/20 rounded" />
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Manager card skeleton for grid display
 * Accurately matches ManagerCard layout
 */
export function ManagerCardSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="card p-4 flex flex-col h-full bg-[#0a0a0a] border-white/5">
          {/* Top Row: Info + Donut */}
          <div className="flex items-start gap-3 mb-4">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-lg bg-muted/20 shrink-0" />

            {/* Main Info */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 bg-muted/30 rounded" />
                {/* Donut Chart Placeholder */}
                <div className="w-8 h-8 rounded-full border-2 border-muted/10 shrink-0" />
              </div>

              <div className="flex gap-1.5">
                <div className="h-4 w-12 bg-muted/10 rounded text-[10px]" />
                <div className="h-4 w-8 bg-muted/10 rounded text-[10px]" />
              </div>
            </div>
          </div>

          {/* Stats Grid - 3 columns */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="bg-muted/5 rounded p-2 flex flex-col items-center justify-center gap-1 border border-white/5">
                <div className="h-4 w-8 bg-muted/20 rounded" />
                <div className="h-2 w-10 bg-muted/10 rounded" />
              </div>
            ))}
          </div>

          {/* Footer Actions */}
          <div className="mt-auto pt-3 border-t border-border/40 flex justify-between items-center">
            <div className="h-3 w-20 bg-muted/10 rounded" />
            <div className="w-4 h-4 bg-muted/10 rounded" />
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
    <div className="space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2 rounded bg-muted/5 border border-transparent">
          <div className="h-4 w-4 bg-muted/20 rounded" />
          <div className="h-8 w-8 bg-muted/20 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-24 bg-muted/30 rounded" />
            <div className="h-2 w-16 bg-muted/20 rounded" />
          </div>
          <div className="text-right space-y-1">
            <div className="h-3 w-12 bg-muted/20 rounded ml-auto" />
            <div className="h-2 w-8 bg-muted/10 rounded ml-auto" />
          </div>
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
    <div className="space-y-3">
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
        {[...Array(5)].map((_, i) => (
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
