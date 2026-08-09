"use client"

import { Badge, Button } from "@eximia/ui"
import { Building2, Layers, Plus, Users } from "lucide-react"
import type { DepartmentView, UnidadeRef } from "../departments-model"
import { corporateDepartmentsOf, localDepartmentsOf } from "../departments-model"

// =============================================================================
// VISTA MAPA (AC5) — colunas = UNIDADES, pilhas = DEPARTAMENTOS.
// =============================================================================
// O departamento CORPORATIVO (presente em 2+ unidades) é uma barra INLINE que
// atravessa as colunas que ele cobre, dentro do próprio quadro — nunca uma faixa
// separada embaixo do mapa (desenho já rejeitado pelo dono no v2 do mockup).
//
// Como a barra atravessa, na prática: as colunas são um CSS grid e a barra é um
// item que ocupa `gridColumn: primeira-coberta / última-coberta+1`. É a tradução
// honesta do mockup para a stack real do produto (o mockup mede pixels e anima
// com GSAP; aqui o grid faz o mesmo trabalho sem medir nada). Quando a cobertura
// tem buraco (cobre a 1ª e a 3ª, não a 2ª), o VÃO da barra ainda vai de ponta a
// ponta, mas os chips por unidade dizem a verdade — e é por eles que se clica.
// =============================================================================

interface DepartmentsMapProps {
  unidades: UnidadeRef[]
  departments: DepartmentView[]
  onOpenUnit: (unidade: UnidadeRef) => void
  onOpenDepartment: (department: DepartmentView) => void
  onAddDepartment: (unidade: UnidadeRef) => void
  onCreateUnit: () => void
}

export function DepartmentsMap({
  unidades,
  departments,
  onOpenUnit,
  onOpenDepartment,
  onAddDepartment,
  onCreateUnit,
}: DepartmentsMapProps) {
  // Estado vazio de primeiro nível: sem unidade não existe coluna, e sem coluna
  // não existe mapa. É o único caso em que o Mapa não tem o que desenhar.
  if (unidades.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-card p-10 text-center">
        <Building2 className="mx-auto mb-3 text-text-muted" size={28} />
        <h3 className="text-base font-medium text-text-primary">Nenhuma unidade ainda</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-text-secondary">
          A unidade é o lugar (Ribeirão Preto, Minas Gerais). Ela é a coluna deste mapa — as áreas
          vivem dentro dela.
        </p>
        <Button className="mt-4" size="sm" onClick={onCreateUnit}>
          <Plus size={16} />
          Criar a primeira unidade
        </Button>
      </div>
    )
  }

  const index = new Map(unidades.map((u, i) => [u.id, i]))
  const corporates = departments.filter((d) => d.placement === "corporate")

  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="grid min-w-full gap-3"
        style={{ gridTemplateColumns: `repeat(${unidades.length}, minmax(240px, 1fr))` }}
      >
        {/* Cabeçalho de cada unidade (o "pilar" da coluna). */}
        {unidades.map((u) => {
          const locals = localDepartmentsOf(departments, u.id)
          const corps = corporateDepartmentsOf(departments, u.id)
          const people = new Set([...locals, ...corps].flatMap((d) => d.memberIds)).size

          return (
            <button
              key={`head-${u.id}`}
              type="button"
              aria-label={`Unidade ${u.name}`}
              onClick={() => onOpenUnit(u)}
              className="rounded-xl border border-border-subtle bg-bg-surface px-4 py-3 text-left transition-shadow hover:shadow-card"
            >
              <div className="flex items-center gap-2">
                <Building2 size={15} className="text-cerrado-600" />
                <span className="truncate text-sm font-semibold text-text-primary">{u.name}</span>
              </div>
              <p className="mt-1 text-xs text-text-muted">
                {people} {people === 1 ? "pessoa" : "pessoas"} · {locals.length + corps.length}{" "}
                {locals.length + corps.length === 1 ? "área" : "áreas"}
              </p>
              {u.description && (
                <p className="mt-1 truncate text-xs text-text-secondary">{u.description}</p>
              )}
            </button>
          )
        })}

        {/* Pilha densa de departamentos LOCAIS, uma por coluna. */}
        {unidades.map((u) => {
          const locals = localDepartmentsOf(departments, u.id)
          return (
            <div key={`stack-${u.id}`} className="flex flex-col gap-2">
              {locals.map((d) => (
                <DepartmentCard key={d.id} department={d} onOpen={() => onOpenDepartment(d)} />
              ))}

              {locals.length === 0 && (
                <div className="rounded-lg border border-dashed border-border-subtle px-3 py-4 text-center">
                  <p className="text-xs text-text-muted">Nenhuma área ainda</p>
                </div>
              )}

              <button
                type="button"
                onClick={() => onAddDepartment(u)}
                className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-border-subtle px-3 py-2 text-xs text-text-secondary transition-colors hover:bg-bg-hover"
              >
                <Plus size={13} />
                Adicionar área
              </button>
            </div>
          )
        })}

        {/* Barras corporativas: cada uma atravessa as colunas que cobre. */}
        {corporates.map((d) => {
          const covered = d.areaIds.map((id) => index.get(id) ?? 0)
          const start = Math.min(...covered) + 1
          const end = Math.max(...covered) + 2

          return (
            <button
              key={`corp-${d.id}`}
              type="button"
              onClick={() => onOpenDepartment(d)}
              style={{ gridColumn: `${start} / ${end}` }}
              className="rounded-lg border border-cerrado-600/40 bg-cerrado-600/5 px-4 py-3 text-left transition-shadow hover:shadow-card"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Layers size={14} className="text-cerrado-600" />
                <span className="text-sm font-medium text-text-primary">{d.name}</span>
                <Badge variant="draft" badgeSize="sm">
                  Corporativa
                </Badge>
                <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                  <Users size={12} />
                  {d.memberCount}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {d.areaIds.map((areaId) => (
                  <span
                    key={areaId}
                    className="rounded-md bg-bg-surface px-2 py-0.5 text-[11px] text-text-secondary"
                  >
                    {unidades.find((u) => u.id === areaId)?.name ?? "—"}
                  </span>
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DepartmentCard({
  department,
  onOpen,
}: {
  department: DepartmentView
  onOpen: () => void
}) {
  const gestor = department.managers[0]

  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-lg border border-border-subtle bg-bg-card px-3 py-2.5 text-left transition-shadow hover:shadow-card"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-text-primary">{department.name}</span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-text-muted">
          <Users size={12} />
          {department.memberCount}
        </span>
      </div>
      <p className="mt-0.5 truncate text-xs text-text-muted">
        {gestor ? `gestor: ${gestor.name}` : "sem gestor"}
      </p>
    </button>
  )
}
