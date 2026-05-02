import { Card, CardContent } from "@eximia/ui"

export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Welcome banner skeleton */}
      <div className="h-48 rounded-xl bg-bg-card" />

      {/* Summary cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="h-10 w-10 rounded-md bg-bg-surface" />
              <div className="space-y-2">
                <div className="h-3 w-20 rounded bg-bg-surface" />
                <div className="h-6 w-12 rounded bg-bg-surface" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="h-64 rounded-xl bg-bg-card" />
    </div>
  )
}
