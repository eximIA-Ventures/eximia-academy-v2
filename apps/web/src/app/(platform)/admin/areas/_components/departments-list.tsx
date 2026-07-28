"use client"

import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from "@eximia/ui"
import {
  ArchiveRestore,
  Building2,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react"
import { useState } from "react"
import type { DepartmentView, ListFilter, UnidadeRef } from "../departments-model"
import {
  alsoInLabel,
  archivedDepartments,
  corporateDepartmentsOf,
  localDepartmentsOf,
  matchesFilter,
  matchesSearch,
} from "../departments-model"

// =============================================================================
// VISTA LISTA v2 (AC8) — mesma verdade do Mapa, outra forma de olhar.
// =============================================================================
// Paridade total significa uma coisa concreta: as duas vistas leem o MESMO
// estado e disparam as MESMAS operações (as do `departments-model`). Nada aqui
// tem lógica de negócio própria; se tivesse, Mapa e Lista poderiam divergir e
// ninguém saberia qual das duas está certa.
//
// A corporativa aparece DENTRO de cada unidade que cobre, com o sufixo
// "também em {outras}" — repetida de propósito, porque é assim que ela existe
// para quem trabalha naquela unidade.
// =============================================================================

const FILTERS: { id: ListFilter; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "locais", label: "Locais" },
  { id: "corporativas", label: "Corporativas" },
  { id: "arquivadas", label: "Arquivadas" },
]

export interface DepartmentsListProps {
  unidades: UnidadeRef[]
  departments: DepartmentView[]
  onOpenUnit: (unidade: UnidadeRef) => void
  onOpenDepartment: (department: DepartmentView) => void
  onAddDepartment: (unidade: UnidadeRef) => void
  onMove: (department: DepartmentView, fromAreaId: string) => void
  onManagePresence: (department: DepartmentView) => void
  onRename: (department: DepartmentView) => void
  onArchive: (department: DepartmentView) => void
  onRestore: (department: DepartmentView) => void
}

export function DepartmentsList({
  unidades,
  departments,
  onOpenUnit,
  onOpenDepartment,
  onAddDepartment,
  onMove,
  onManagePresence,
  onRename,
  onArchive,
  onRestore,
}: DepartmentsListProps) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<ListFilter>("todas")
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const visible = departments.filter((d) => matchesFilter(d, filter) && matchesSearch(d, search))
  const archived = archivedDepartments(visible)
  const showUnitGroups = filter !== "arquivadas"

  const totalVisibleInUnits = unidades.reduce(
    (acc, u) =>
      acc + localDepartmentsOf(visible, u.id).length + corporateDepartmentsOf(visible, u.id).length,
    0,
  )
  const nothingFound = totalVisibleInUnits === 0 && archived.length === 0

  return (
    <div className="space-y-4">
      {/* Toolbar: busca por área ou gestor + filtro segmentado. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar área ou gestor…"
            className="pl-9"
            aria-label="Buscar área ou gestor"
          />
        </div>

        <div className="flex flex-wrap gap-1 rounded-lg bg-bg-surface p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={
                filter === f.id
                  ? "rounded-md bg-bg-card px-3 py-1.5 text-xs font-medium text-text-primary shadow-card"
                  : "rounded-md px-3 py-1.5 text-xs text-text-secondary transition-colors hover:text-text-primary"
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {nothingFound && (
        <div className="rounded-xl border border-border-subtle bg-bg-card px-6 py-10 text-center">
          <p className="text-sm text-text-secondary">
            {search
              ? "Nenhuma área encontrada para essa busca."
              : filter === "arquivadas"
                ? "Nenhuma área arquivada."
                : "Nenhuma área cadastrada ainda."}
          </p>
          {search && (
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setSearch("")}>
              Limpar busca
            </Button>
          )}
        </div>
      )}

      {showUnitGroups &&
        unidades.map((u) => {
          const locals = localDepartmentsOf(visible, u.id)
          const corps = corporateDepartmentsOf(visible, u.id)
          const rows = [...locals, ...corps]
          const isCollapsed = collapsed[u.id] ?? false
          // Busca ativa força os grupos abertos: esconder resultado atrás de um
          // grupo fechado é o jeito mais rápido de fazer o dono achar que a
          // busca não funciona.
          const open = search ? true : !isCollapsed

          if (rows.length === 0 && (search || filter !== "todas")) return null

          return (
            <div
              key={u.id}
              className="overflow-hidden rounded-xl border border-border-subtle bg-bg-card"
            >
              <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
                <button
                  type="button"
                  aria-label={open ? `Recolher ${u.name}` : `Expandir ${u.name}`}
                  aria-expanded={open}
                  onClick={() => setCollapsed((c) => ({ ...c, [u.id]: !isCollapsed }))}
                  className="text-text-muted transition-colors hover:text-text-primary"
                >
                  {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <Building2 size={15} className="text-cerrado-600" />
                <button
                  type="button"
                  onClick={() => onOpenUnit(u)}
                  className="text-sm font-semibold text-text-primary hover:underline"
                >
                  {u.name}
                </button>
                <span className="text-xs text-text-muted">
                  {rows.length} {rows.length === 1 ? "área" : "áreas"}
                </span>
                <div className="ml-auto">
                  <Button variant="ghost" size="sm" onClick={() => onAddDepartment(u)}>
                    <Plus size={14} />
                    Adicionar área
                  </Button>
                </div>
              </div>

              {open && (
                <div className="divide-y divide-border-subtle">
                  {rows.length === 0 && (
                    <p className="px-4 py-6 text-center text-xs text-text-muted">
                      Nenhuma área nesta unidade ainda.
                    </p>
                  )}

                  {rows.map((d) => (
                    <DepartmentRow
                      key={`${u.id}-${d.id}`}
                      department={d}
                      unidades={unidades}
                      currentAreaId={u.id}
                      onOpen={() => onOpenDepartment(d)}
                      onMove={() => onMove(d, u.id)}
                      onManagePresence={() => onManagePresence(d)}
                      onRename={() => onRename(d)}
                      onArchive={() => onArchive(d)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}

      {/* Arquivadas: rodapé próprio, com Restaurar. Elas existem — só não estão
          em nenhuma unidade. */}
      {archived.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-card">
          <div className="border-b border-border-subtle px-4 py-3">
            <span className="text-sm font-semibold text-text-primary">
              Arquivadas ({archived.length})
            </span>
            <p className="mt-0.5 text-xs text-text-muted">
              Áreas sem nenhuma unidade. Nada foi excluído: pessoas e vínculos seguem preservados.
            </p>
          </div>
          <div className="divide-y divide-border-subtle">
            {archived.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => onOpenDepartment(d)}
                  className="text-sm font-medium text-text-primary hover:underline"
                >
                  {d.name}
                </button>
                <span className="text-xs text-text-muted">{d.memberCount} pessoa(s)</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => onRestore(d)}
                  disabled={unidades.length === 0}
                >
                  <ArchiveRestore size={14} />
                  Restaurar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-text-muted">
        Unidade é o lugar (a coluna). Área é o time funcional que vive nela — e pode ser
        corporativa, atravessando mais de uma unidade.
      </p>
    </div>
  )
}

function DepartmentRow({
  department,
  unidades,
  currentAreaId,
  onOpen,
  onMove,
  onManagePresence,
  onRename,
  onArchive,
}: {
  department: DepartmentView
  unidades: UnidadeRef[]
  currentAreaId: string
  onOpen: () => void
  onMove: () => void
  onManagePresence: () => void
  onRename: () => void
  onArchive: () => void
}) {
  const tambem = alsoInLabel(department, currentAreaId, unidades)
  const gestor = department.managers[0]

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-text-primary">{department.name}</span>
          {department.placement === "corporate" && (
            <Badge variant="draft" badgeSize="sm">
              Corporativa
            </Badge>
          )}
          {tambem && <span className="text-xs text-text-muted">{tambem}</span>}
        </div>
        <p className="mt-0.5 text-xs text-text-muted">
          {department.memberCount} {department.memberCount === 1 ? "pessoa" : "pessoas"} ·{" "}
          {gestor ? `gestor: ${gestor.name}` : "sem gestor"}
        </p>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Ações de ${department.name}`}
          className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <MoreHorizontal size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="right-0">
          <DropdownMenuItem onClick={onMove}>Mover para unidade…</DropdownMenuItem>
          <DropdownMenuItem onClick={onManagePresence}>Gerir unidades…</DropdownMenuItem>
          <DropdownMenuItem onClick={onRename}>Renomear</DropdownMenuItem>
          <DropdownMenuItem onClick={onArchive}>Arquivar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
