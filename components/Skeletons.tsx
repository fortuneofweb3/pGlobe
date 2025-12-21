'use client';

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="w-full" style={{ height: `${height}px` }}>
      <div className="h-full bg-muted/20 rounded-lg animate-pulse relative overflow-hidden">
        {/* Axes */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-muted/40" />
        <div className="absolute bottom-0 left-0 top-0 w-px bg-muted/40" />
        
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-20">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 h-px bg-muted/30"
              style={{ bottom: `${(i + 1) * 20}%` }}
            />
          ))}
        </div>
        
        {/* Chart line skeleton */}
        <svg className="absolute inset-0 w-full h-full">
          <path
            d={`M 0 ${height * 0.8} Q ${height * 0.25} ${height * 0.4}, ${height * 0.5} ${height * 0.5} T ${height} ${height * 0.3}`}
            stroke="rgb(var(--muted))"
            strokeWidth="2"
            fill="none"
            opacity="0.3"
          />
        </svg>
        
        {/* Dots */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-muted/40"
            style={{
              left: `${(i + 1) * 15}%`,
              bottom: `${30 + Math.random() * 40}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="w-full animate-pulse">
      {/* Header */}
      <div className="flex gap-2 mb-4">
        {[...Array(columns)].map((_, i) => (
          <div
            key={i}
            className="flex-1 h-8 bg-muted/30 rounded"
          />
        ))}
      </div>
      {/* Rows */}
      <div className="space-y-2">
        {[...Array(rows)].map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-2">
            {[...Array(columns)].map((_, colIndex) => (
              <div
                key={colIndex}
                className="flex-1 h-12 bg-muted/20 rounded"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MapSkeleton({ height = 400 }: { height?: number }) {
  return (
    <div 
      className="w-full bg-muted/20 rounded-lg animate-pulse relative overflow-hidden"
      style={{ height: `${height}px` }}
    >
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-10">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute border border-muted/20"
            style={{
              left: `${i * 12.5}%`,
              top: 0,
              bottom: 0,
              width: '1px',
            }}
          />
        ))}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute border border-muted/20"
            style={{
              top: `${i * 16.66}%`,
              left: 0,
              right: 0,
              height: '1px',
            }}
          />
        ))}
      </div>
      
      {/* Random markers */}
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="absolute w-3 h-3 rounded-full bg-muted/40"
          style={{
            left: `${15 + Math.random() * 70}%`,
            top: `${15 + Math.random() * 70}%`,
          }}
        />
      ))}
    </div>
  );
}

export function GlobeSkeleton({ height = 600 }: { height?: number }) {
  return (
    <div 
      className="w-full bg-muted/20 rounded-lg animate-pulse relative overflow-hidden"
      style={{ height: `${height}px` }}
    >
      {/* Circle outline */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-3/4 h-3/4 rounded-full border-2 border-muted/30" />
      </div>
      
      {/* Random dots */}
      {[...Array(10)].map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-muted/40"
          style={{
            left: `${20 + Math.random() * 60}%`,
            top: `${20 + Math.random() * 60}%`,
          }}
        />
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="card-stat animate-pulse">
          <div className="h-4 w-20 bg-muted/30 rounded mb-3" />
          <div className="h-8 w-24 bg-muted/40 rounded mb-2" />
          <div className="h-3 w-32 bg-muted/20 rounded" />
        </div>
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card-stat animate-pulse">
      <div className="h-4 w-24 bg-muted/30 rounded mb-3" />
      <div className="h-8 w-20 bg-muted/40 rounded mb-2" />
      <div className="h-3 w-28 bg-muted/20 rounded" />
    </div>
  );
}


