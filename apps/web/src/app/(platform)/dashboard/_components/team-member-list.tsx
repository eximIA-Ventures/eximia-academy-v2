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

/** Iniciais para o avatar do preview (variante A): "Caio Pinheiro" vira "CP". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : (parts[0]?.[1] ?? "")
  return (first + last).toUpperCase()
}

/** Paleta suave dos avatares (hex inline, mesma família do organograma). */
// Tintura por opacidade + texto vivo: legível em light E dark (onda dark 2026-07-07).
const AVATAR_PALETTE = [
  { bg: "rgba(16,185,129,0.16)", text: "#10b981" },
  { bg: "rgba(59,130,246,0.16)", text: "#3b82f6" },
  { bg: "rgba(245,158,11,0.18)", text: "#d97706" },
  { bg: "rgba(168,85,247,0.16)", text: "#a855f7" },
  { bg: "rgba(239,68,68,0.16)", text: "#ef4444" },
  { bg: "rgba(6,182,212,0.16)", text: "#06b6d4" },
] as const

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

  // Gatilho cristalizado (escolha do Hugo, 2026-07-07): preview de avatares
  // com iniciais + botão explícito "Ver todos" (mix das opções 3+2 do parecer
  // Don Norman). A cor do avatar é POR MEMBRO (índice no array ordenado por
  // nome), a mesma no preview e no card expandido abaixo.
  const headerTrigger = (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <h3 className="shrink-0 text-sm font-semibold text-text-primary">Membros do time</h3>
        <div className="flex items-center">
          {members.slice(0, 3).map((m, i) => {
            const c = AVATAR_PALETTE[i % AVATAR_PALETTE.length]
            return (
              <span
                key={m.id}
                title={m.name}
                style={{ backgroundColor: c.bg, color: c.text, boxShadow: "0 0 0 2px var(--color-bg-card)" }}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${i > 0 ? "-ml-2" : ""}`}
              >
                {initials(m.name)}
              </span>
            )
          })}
          {members.length > 3 && (
            <span
                style={{
                  backgroundColor: "var(--color-bg-hover)",
                  boxShadow: "0 0 0 2px var(--color-bg-card)",
                }}
                className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-text-muted"
              >
              +{members.length - 3}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ borderColor: "rgba(234,106,32,0.55)", color: "#ea6a20" }}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-transparent px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-cerrado-600/10"
      >
        <Users size={13} />
        {open ? "Ocultar" : `Ver todos (${members.length})`}
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
    </div>
  )

  return (
    <section className="space-y-3">
      {headerTrigger}

      {open &&
        (members.length === 0 ? (
          <div className="rounded-2xl bg-bg-card p-4 shadow-card">
            <p className="text-sm text-text-muted">Nenhum membro direto neste recorte.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member, idx) => {
              const count = subteamCounts?.get(member.id)
              const canDrillDown = count != null
              const baseCard =
                "flex items-center justify-between rounded-2xl bg-bg-card p-4 shadow-card"
              // Mesma cor do avatar do preview no header (índice compartilhado,
              // sem foto o par iniciais+cor É a identidade visual da pessoa).
              const avatar = AVATAR_PALETTE[idx % AVATAR_PALETTE.length]

              const cardInner = (
                <Fragment key={member.id}>
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      style={{ backgroundColor: avatar.bg, color: avatar.text }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    >
                      {initials(member.name)}
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
