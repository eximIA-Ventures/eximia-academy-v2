import { Skeleton } from "@eximia/ui"

export default function SessionLoading() {
  return (
    <div className="flex items-center justify-center py-20 animate-pulse">
      <div className="space-y-4 text-center">
        <Skeleton className="h-8 w-8 mx-auto rounded-full" />
        <Skeleton className="h-4 w-40 mx-auto" />
      </div>
    </div>
  )
}
