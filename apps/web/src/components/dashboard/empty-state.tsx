import { Button } from "@eximia/ui"
import { BookOpen } from "lucide-react"
import Link from "next/link"

interface EmptyStateProps {
  title: string
  description: string
  action: { label: string; href: string }
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl shadow-card bg-bg-card px-6 py-16 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-cerrado-600/15">
        <BookOpen size={28} className="text-cerrado-400" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-text-secondary">{description}</p>
      <Link href={action.href} className="mt-6">
        <Button>{action.label}</Button>
      </Link>
    </div>
  )
}
