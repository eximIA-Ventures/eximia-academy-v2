import { Card, CardContent, Skeleton } from "@eximia/ui"

export default function TeamProfilesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <Skeleton className="h-48 w-full rounded-xl" />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-5 w-40 mb-4" />
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-5 w-40 mb-4" />
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
