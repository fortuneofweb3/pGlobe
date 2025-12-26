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
