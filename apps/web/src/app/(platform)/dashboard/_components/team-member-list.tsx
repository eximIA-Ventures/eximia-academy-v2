"use client"

import type { EngagementStudent, TeamEngagementBuckets } from "@/lib/engagement-helpers"
import { ChevronDown, ChevronRight, Users } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Fragment, useState } from "react"

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
  // D-1 (S12, feedback do Hugo 2026-07-07): seção colapsável, FECHADA por
  // padrão — o mockup R3 não mostra "Membros do time" na tela inicial. O
  // drill (Link com ?focus=) continua funcionando normalmente ao expandir,
  // nenhuma funcionalidade foi removida.
  const [open, setOpen] = useState(false)

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

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-left transition-colors hover:bg-bg-hover"
      >
        <h3 className="text-sm font-semibold text-text-primary">
          Membros do time ({members.length})
        </h3>
        <ChevronDown
          size={16}
          className={`text-text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        (members.length === 0 ? (
          <div className="rounded-2xl bg-bg-card p-4 shadow-card">
            <p className="text-sm text-text-muted">Nenhum membro direto neste recorte.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => {
              const count = subteamCounts?.get(member.id)
              const canDrillDown = count != null
              const baseCard =
                "flex items-center justify-between rounded-2xl bg-bg-card p-4 shadow-card"

              const cardInner = (
                <Fragment key={member.id}>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-varzea/15">
                      <Users size={18} className="text-varzea" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {member.name}
                      </p>
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
                </Fragment>
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
        ))}
    </section>
  )
}
