import { Card, CardContent, Skeleton } from "@eximia/ui"

export default function ManagerGroupsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="rounded-2xl bg-bg-card shadow-card overflow-hidden">
        <div className="p-4 border-b border-border-subtle">
          <Skeleton className="h-4 w-48" />
        </div>
        {["sk1", "sk2", "sk3", "sk4", "sk5"].map((k) => (
          <Card
            key={k}
            className="rounded-none border-0 border-b border-border-subtle last:border-0"
          >
            <CardContent className="p-4 flex items-center gap-4">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
