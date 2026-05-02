import { Card, CardContent, Skeleton } from "@eximia/ui"

export default function QuizLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-56" />
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-5 w-3/4" />
          <div className="space-y-3 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
