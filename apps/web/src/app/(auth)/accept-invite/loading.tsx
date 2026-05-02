import { Skeleton } from "@eximia/ui"

export default function AcceptInviteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center animate-pulse">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="space-y-2 text-center">
          <Skeleton className="h-8 w-40 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}
