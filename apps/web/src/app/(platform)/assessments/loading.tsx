import { Card, CardContent } from "@eximia/ui"

export default function AssessmentsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="h-40 rounded-xl bg-bg-card" />

      {/* Cards skeleton */}
      <div className="grid gap-6 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-4 p-6">
              <div className="h-12 w-12 rounded-lg bg-bg-surface" />
              <div className="space-y-2">
                <div className="h-5 w-32 rounded bg-bg-surface" />
                <div className="h-4 w-full rounded bg-bg-surface" />
                <div className="h-4 w-3/4 rounded bg-bg-surface" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
