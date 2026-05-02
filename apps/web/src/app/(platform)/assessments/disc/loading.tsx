import { Skeleton } from "@eximia/ui"

export default function DiscLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
      <div className="space-y-2 text-center">
        <Skeleton className="h-7 w-48 mx-auto" />
        <Skeleton className="h-4 w-72 mx-auto" />
      </div>

      <Skeleton className="h-2 w-full rounded-full" />

      <div className="space-y-4">
        <Skeleton className="h-5 w-3/4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}
