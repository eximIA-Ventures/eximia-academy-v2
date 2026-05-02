import { Skeleton } from "@eximia/ui"

export default function ChapterEditLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>

      <Skeleton className="h-10 w-full" />

      <Skeleton className="h-9 w-80" />

      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  )
}
