"use client"

function SkeletonPulse({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-bg-elevated ${className || ""}`}
      style={style}
      aria-hidden="true"
    />
  )
}

export function BlueprintSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando blueprint...">
      <span className="sr-only">Carregando blueprint...</span>

      {/* Header skeleton */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <SkeletonPulse className="h-4 w-32" />
          <SkeletonPulse className="h-6 w-64" />
          <div className="flex gap-2">
            <SkeletonPulse className="h-5 w-20 rounded-full" />
            <SkeletonPulse className="h-5 w-12" />
            <SkeletonPulse className="h-5 w-32" />
          </div>
        </div>
        <SkeletonPulse className="h-9 w-24" />
      </div>

      {/* Metrics row skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border-subtle bg-bg-card p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <SkeletonPulse className="h-4 w-4" />
              <SkeletonPulse className="h-3 w-16" />
            </div>
            <SkeletonPulse className="h-7 w-12" />
          </div>
        ))}
      </div>

      {/* Quality + Bloom row skeleton */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border-subtle bg-bg-card p-4 space-y-4">
          <div className="flex justify-between">
            <SkeletonPulse className="h-4 w-32" />
            <SkeletonPulse className="h-5 w-20 rounded-full" />
          </div>
          <div className="flex items-center justify-around">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <SkeletonPulse className="h-16 w-16 rounded-full" />
                <SkeletonPulse className="h-5 w-8" />
                <SkeletonPulse className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border-subtle bg-bg-card p-4 space-y-3">
          <SkeletonPulse className="h-4 w-40" />
          <div className="flex items-end gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <SkeletonPulse className="h-3 w-4" />
                <SkeletonPulse
                  className="w-full rounded-t-sm"
                  style={{ height: `${20 + Math.random() * 60}px` }}
                />
                <SkeletonPulse className="h-3 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modules skeleton */}
      <div className="space-y-3">
        <SkeletonPulse className="h-5 w-28" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border-subtle bg-bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <SkeletonPulse className="h-8 w-8 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <SkeletonPulse className="h-4 w-48" />
                <div className="flex gap-2">
                  <SkeletonPulse className="h-3 w-16" />
                  <SkeletonPulse className="h-4 w-24 rounded-full" />
                </div>
              </div>
              <SkeletonPulse className="h-4 w-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
