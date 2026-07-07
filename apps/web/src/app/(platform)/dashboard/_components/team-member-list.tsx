"use client"

import type { EngagementStudent, TeamEngagementBuckets } from "@/lib/engagement-helpers"
import { ChevronRight, Users } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

interface TeamMemberListProps {
  buckets: TeamEngagementBuckets
  /** memberId -> number of students in that member's whole subteam. Present only
   * for members who lead a team (drill targets); absent for leaf members. */
  subteamCounts?: Map<string, number>
}

interface TeamMember {
  id: string
  name: string
}

const SORT_BY_NAME = new Intl.Collator("pt-BR", {
  numeric: true,
  sensitivity: "base",
})

function addMembers(membersById: Map<string, TeamMember>, students: EngagementStudent[]) {
  for (const student of students) {
    membersById.set(student.id, { id: student.id, name: student.name })
  }
}

export function TeamMemberList({ buckets, subteamCounts }: TeamMemberListProps) {
  const searchParams = useSearchParams()
  const currentSearch = searchParams.toString()

  const membersById = new Map<string, TeamMember>()
  addMembers(membersById, buckets.accessed)
  addMembers(membersById, buckets.devendo)
  addMembers(membersById, buckets.inativos)

  const members = Array.from(membersById.values()).sort((a, b) =>
    SORT_BY_NAME.compare(a.name, b.name),
  )

  const drilldownHref = (memberId: string) => {
    const params = new URLSearchParams(currentSearch)
    params.set("focus", memberId)
    return `?${params.toString()}`
  }

  if (members.length === 0) {
    return (
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">Membros do time</h3>
        <div className="rounded-2xl bg-bg-card p-4 shadow-card">
          <p className="text-sm text-text-muted">Nenhum membro direto neste recorte.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Membros do time</h3>
        <span className="text-xs text-text-muted">
          {members.length} {members.length === 1 ? "membro" : "membros"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => {
          const count = subteamCounts?.get(member.id)
          const canDrillDown = count != null
          const baseCard =
            "flex items-center justify-between rounded-2xl bg-bg-card p-4 shadow-card"

          const cardInner = (
            <>
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-varzea/15">
                  <Users size={18} className="text-varzea" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">{member.name}</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {count != null
                      ? `${count} ${count === 1 ? "aluno" : "alunos"} no time`
                      : "Sem equipe abaixo"}
                  </p>
                </div>
              </div>
              {canDrillDown && (
                <ChevronRight
                  size={18}
                  className="shrink-0 text-text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-cerrado-600"
                />
              )}
            </>
          )

          return canDrillDown ? (
            <Link
              key={member.id}
              href={drilldownHref(member.id)}
              scroll={false}
              aria-label={`Entrar no time de ${member.name}`}
              className={`group ${baseCard} text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated hover:ring-1 hover:ring-cerrado-600/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cerrado-600`}
            >
              {cardInner}
            </Link>
          ) : (
            <div key={member.id} className={baseCard}>
              {cardInner}
            </div>
          )
        })}
      </div>
    </section>
  )
}
