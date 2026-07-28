"use client"

// ---------------------------------------------------------------------------
// Cargos — lista v2 (CFG-3.1, ACs 1 a 5).
// ---------------------------------------------------------------------------
// A versão anterior era uma tabela agrupada por área com Editar/Excluir sempre
// visíveis: nome, senioridade e a CONTAGEM de trilhas. Nada de busca, filtro,
// nome de trilha, pessoas ou drawer. O que muda aqui é comportamento, não
// enfeite — cada bloco abaixo aponta o AC que o exige.
//
// Toda a lógica de busca/filtro/agrupamento/stats vive em
// `job-roles-view-model.ts`, em funções puras, para que o gate mecânico prove
// os ACs sem depender de render. Este arquivo é a camada de desenho e de
// estado de UI.
// ---------------------------------------------------------------------------

import { Avatar, AvatarGroup, Badge, Button, Card, CardContent, Input, Select } from "@eximia/ui"
import { Briefcase, ChevronDown, ChevronRight, Plus, Search, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { DeleteJobRoleDialog } from "./_components/delete-job-role-dialog"
import { JobRoleDrawer } from "./_components/job-role-drawer"
import { initialsOf } from "./_components/reassign-people-fields"
import {
  EMPTY_FILTERS,
  type JobRoleFilters,
  NO_AREA_KEY,
  NO_AREA_LABEL,
  SENIORITY_LABELS,
  SENIORITY_ORDER,
  activeFilterLabel,
  computeStats,
  filterRoles,
  governanceWarning,
  groupRolesByArea,
  groupSummary,
  hasActiveFilters,
  readCollapsedGroups,
  writeCollapsedGroups,
} from "./job-roles-view-model"
import type { JobRoleArea, JobRoleWithStats, TenantTrail } from "./types"

interface JobRolesClientProps {
  roles: JobRoleWithStats[]
  areas: JobRoleArea[]
  trails: TenantTrail[]
}

export function JobRolesClient({ roles, areas, trails }: JobRolesClientProps) {
  const router = useRouter()

  const [filters, setFilters] = useState<JobRoleFilters>(EMPTY_FILTERS)
  const [collapsed, setCollapsed] = useState<string[]>([])
  const [drawerRole, setDrawerRole] = useState<JobRoleWithStats | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<JobRoleWithStats | null>(null)

  // AC1 — o colapso persiste entre navegações. A leitura acontece DEPOIS da
  // hidratação (o servidor não conhece o `localStorage` do navegador); render
  // inicial expandido e a preferência se aplica em seguida.
  useEffect(() => {
    setCollapsed(readCollapsedGroups())
  }, [])

  const stats = useMemo(() => computeStats(roles), [roles])
  const visible = useMemo(() => filterRoles(roles, filters), [roles, filters])
  const groups = useMemo(() => groupRolesByArea(visible), [visible])

  const chipLabel = activeFilterLabel(
    filters,
    filters.areaId === NO_AREA_KEY
      ? NO_AREA_LABEL
      : areas.find((a) => a.id === filters.areaId)?.name,
  )

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      writeCollapsedGroups(next)
      return next
    })
  }

  function openRole(role: JobRoleWithStats) {
    setDrawerRole(role)
    setDrawerOpen(true)
  }

  function openCreate() {
    setDrawerRole(null)
    setDrawerOpen(true)
  }

  function refresh() {
    router.refresh()
  }

  // O drawer recebe sempre a versão MAIS NOVA do cargo: depois de um refresh a
  // lista muda, e um painel preso à cópia antiga mostraria a trilha que acabou
  // de ser desvinculada.
  const activeRole = drawerRole ? (roles.find((r) => r.id === drawerRole.id) ?? null) : null

  return (
    <div className="space-y-6">
      {/* --------------------------------- Stats -------------------------------- */}
      {/* AC4 — stats clicáveis viram filtro rápido; "Cargos cadastrados" limpa. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatButton
          label="Cargos cadastrados"
          value={stats.total}
          active={!hasActiveFilters(filters)}
          onClick={() => setFilters(EMPTY_FILTERS)}
        />
        <StatButton
          label="Cargos sem trilha"
          value={stats.withoutTrail}
          active={filters.quick === "no-trail"}
          onClick={() =>
            setFilters((prev) => ({
              ...EMPTY_FILTERS,
              quick: prev.quick === "no-trail" ? "none" : "no-trail",
            }))
          }
        />
        <StatButton
          label="Cargos sem pessoas"
          value={stats.withoutPeople}
          active={filters.quick === "no-people"}
          onClick={() =>
            setFilters((prev) => ({
              ...EMPTY_FILTERS,
              quick: prev.quick === "no-people" ? "none" : "no-people",
            }))
          }
        />
        {/* Informativo: não há recorte honesto por trás de "trilhas vinculadas",
            então este cartão não finge ser um filtro. */}
        <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
          <div className="font-bold text-2xl text-text-primary">{stats.trails}</div>
          <div className="mt-1 text-text-secondary text-xs">Trilhas vinculadas</div>
        </div>
      </div>

      {/* -------------------------------- Toolbar ------------------------------- */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 h-4 w-4 text-text-muted" />
          <Input
            aria-label="Buscar cargo"
            className="pl-9"
            placeholder="Buscar cargo, função ou trilha…"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          />
        </div>

        {/* AC3 — filtro por área (inclui o recorte "Sem área"). */}
        <Select
          aria-label="Filtrar por área"
          selectSize="default"
          className="max-w-[14rem]"
          value={filters.areaId}
          onChange={(e) => setFilters((prev) => ({ ...prev, areaId: e.target.value }))}
        >
          <option value="">Todas as áreas</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
          <option value={NO_AREA_KEY}>{NO_AREA_LABEL}</option>
        </Select>

        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Novo cargo
        </Button>
      </div>

      {/* AC3 — chips segmentados de senioridade. */}
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Filtrar por senioridade</legend>
        <SeniorityChip
          label="Todas"
          active={filters.seniority === ""}
          onClick={() => setFilters((prev) => ({ ...prev, seniority: "" }))}
        />
        {SENIORITY_ORDER.map((value) => (
          <SeniorityChip
            key={value}
            label={SENIORITY_LABELS[value]}
            active={filters.seniority === value}
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                seniority: prev.seniority === value ? "" : value,
              }))
            }
          />
        ))}
      </fieldset>

      {/* AC4 — chip do filtro ativo, removível. */}
      {chipLabel && (
        <div className="flex items-center gap-2" data-testid="active-filter-chip">
          <Badge badgeSize="sm" variant="info">
            {chipLabel}
          </Badge>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-text-secondary text-xs hover:text-text-primary"
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            <X className="h-3 w-3" />
            Limpar filtros
          </button>
        </div>
      )}

      {/* --------------------------------- Lista -------------------------------- */}
      {roles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Briefcase className="mb-4 h-12 w-12 text-text-secondary" />
            <p className="text-text-secondary">Nenhum cargo cadastrado</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              Criar primeiro cargo
            </Button>
          </CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-text-secondary">Nenhum cargo corresponde aos filtros.</p>
            <Button variant="outline" className="mt-4" onClick={() => setFilters(EMPTY_FILTERS)}>
              Limpar filtros
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const isCollapsed = collapsed.includes(group.key)
            return (
              <section key={group.key} data-testid={`group-${group.key}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 border-border-subtle border-b py-2 text-left"
                  aria-expanded={!isCollapsed}
                  onClick={() => toggleGroup(group.key)}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-text-muted" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-text-muted" />
                  )}
                  <span className="font-semibold text-text-primary">{group.label}</span>
                  <span className="text-text-secondary text-xs">{groupSummary(group)}</span>
                </button>

                {!isCollapsed && (
                  <ul className="divide-y divide-border-subtle">
                    {group.roles.map((role) => (
                      <li key={role.id}>
                        <JobRoleRow role={role} onOpen={() => openRole(role)} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}

      {drawerOpen && (
        <JobRoleDrawer
          role={activeRole}
          allRoles={roles}
          areas={areas}
          trails={trails}
          onClose={() => setDrawerOpen(false)}
          onChanged={refresh}
          onRequestDelete={(role) => {
            setDrawerOpen(false)
            setDeleteTarget(role)
          }}
        />
      )}

      {deleteTarget && (
        <DeleteJobRoleDialog
          role={deleteTarget}
          allRoles={roles}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

/* --------------------------------- Peças --------------------------------- */

function StatButton({
  label,
  value,
  active,
  onClick,
}: { label: string; value: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl border p-4 text-left transition-colors ${
        active
          ? "border-cerrado-600/40 bg-cerrado-600/10"
          : "border-border-subtle bg-bg-card hover:border-cerrado-600/30"
      }`}
    >
      <div className="font-bold text-2xl text-text-primary">{value}</div>
      <div className="mt-1 text-text-secondary text-xs">{label}</div>
    </button>
  )
}

function SeniorityChip({
  label,
  active,
  onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-xs transition-colors ${
        active
          ? "bg-cerrado-600/15 text-cerrado-400 ring-1 ring-cerrado-600/30"
          : "bg-bg-elevated text-text-secondary hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  )
}

/**
 * AC5 — a linha do cargo. Os quatro dados que a versão anterior não mostrava:
 * NOME das trilhas (não a contagem), pessoas com mini-avatares, descrição
 * truncada com o texto cheio no `title`, e o dot de governança.
 */
function JobRoleRow({ role, onOpen }: { role: JobRoleWithStats; onOpen: () => void }) {
  const warning = governanceWarning(role)
  const visibleTrails = role.trails.slice(0, 2)
  const hiddenTrails = role.trails.slice(2)

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-bg-elevated/50"
      data-testid={`job-role-row-${role.id}`}
    >
      {warning ? (
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-semantic-warning"
          title={warning}
          aria-label={warning}
        />
      ) : (
        <span className="h-2 w-2 shrink-0" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-text-primary">{role.name}</span>
          <Badge badgeSize="sm">
            {SENIORITY_LABELS[role.seniority_level] ?? role.seniority_level}
          </Badge>
        </div>

        {role.description && (
          <p className="truncate text-text-secondary text-xs" title={role.description}>
            {role.description}
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-1">
          {visibleTrails.map((trail) => (
            <Badge key={trail.id} badgeSize="sm" variant="info">
              {trail.title}
            </Badge>
          ))}
          {hiddenTrails.length > 0 && (
            <Badge badgeSize="sm" title={hiddenTrails.map((t) => t.title).join(", ")}>
              +{hiddenTrails.length}
            </Badge>
          )}
          {role.trails.length === 0 && (
            <span className="text-text-muted text-xs">Sem trilha vinculada</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {role.people.length > 0 ? (
          <>
            <AvatarGroup max={3}>
              {role.people.map((person) => (
                <Avatar key={person.id} size="sm" fallback={initialsOf(person)} />
              ))}
            </AvatarGroup>
            <span className="text-text-secondary text-xs">{role.people.length}</span>
          </>
        ) : (
          <span className="text-text-muted text-xs">Sem pessoas</span>
        )}
      </div>
    </button>
  )
}
