export default function NotificacoesLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-36 rounded-lg bg-bg-card" />
          <div className="h-4 w-24 rounded bg-bg-card" />
        </div>
        <div className="h-8 w-44 rounded-xl bg-bg-card" />
      </div>

      {/* Filter skeleton */}
      <div className="h-10 rounded-xl bg-bg-card" />

      {/* List skeleton */}
      <div className="rounded-2xl bg-bg-card shadow-card overflow-hidden divide-y divide-border-subtle">
        {["sk1", "sk2", "sk3", "sk4", "sk5"].map((sk) => (
          <div key={sk} className="flex gap-4 px-5 py-4">
            <div className="mt-0.5 h-8 w-8 shrink-0 rounded-xl bg-bg-elevated" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between gap-2">
                <div className="h-3.5 w-2/3 rounded bg-bg-elevated" />
                <div className="h-3 w-20 rounded bg-bg-elevated" />
              </div>
              <div className="h-3 w-full rounded bg-bg-elevated" />
              <div className="h-3 w-1/2 rounded bg-bg-elevated" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
