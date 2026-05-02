"use client"

import { Skeleton } from "@eximia/ui"

interface PlayerSkeletonProps {
  type: "video" | "audio"
}

export function PlayerSkeleton({ type }: PlayerSkeletonProps) {
  if (type === "video") {
    return (
      <div className="aspect-vídeo w-full overflow-hidden rounded-md bg-bg-card">
        <Skeleton className="h-full w-full" />
      </div>
    )
  }

  return (
    <div className="flex h-20 w-full items-center gap-4 rounded-md bg-bg-card p-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-2 w-1/3 rounded-full" />
      </div>
    </div>
  )
}
