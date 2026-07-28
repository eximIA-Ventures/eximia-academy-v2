"use client"

// ---------------------------------------------------------------------------
// Drawer do cargo (CFG-3.1, AC6 e AC7).
// ---------------------------------------------------------------------------
// Construído com o `Sheet` do design system do produto (`@eximia/ui`), não com
// HTML/CSS copiado do mockup: a story pede os BLOCOS observáveis, e a paridade
// visual/motion é gate humano do dono, não critério que o dev marque sozinho.
//
// Os blocos exigidos, cada um com seu `data-testid` para o gate mecânico:
//   cabeçalho (nome + pill de senioridade + área) · descrição completa
//   (editável no modo Editar) · Trilhas vinculadas (remover × e + Vincular) ·
//   Pessoas com este cargo (avatar + nome + área, com Mover pessoas de cargo…)
//   · Sugestões · ações no rodapé (Editar/Salvar, Duplicar, Excluir, Fechar).
//
// O MESMO drawer serve ao "Novo cargo" (AC7), em modo criação: sem trilhas, sem
// pessoas e sem sugestões, porque nada disso existe antes de o cargo existir.
// ---------------------------------------------------------------------------

import {
  Avatar,
  Badge,
  Button,
  Input,
  Select,
  Sheet,
  SheetContent,
  SheetOverlay,
  Textarea,
} from "@eximia/ui"
import { Link2Off, Plus, X } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import {
  createJobRole,
  duplicateJobRole,
  linkTrailToJobRole,
  reassignJobRolePeople,
  unlinkTrailFromJobRole,
  updateJobRole,
} from "../actions"
import { SENIORITY_LABELS, SENIORITY_ORDER, buildJobRoleSuggestions } from "../job-roles-view-model"
import type { JobRoleArea, JobRoleWithStats, TenantTrail } from "../types"
import {
  ReassignPeopleFields,
  initialsOf,
  toReassignments,
  undecidedPeople,
} from "./reassign-people-fields"

export interface JobRoleDrawerProps {
  /** `null` = modo criação (AC7: o mesmo drawer). */
  role: JobRoleWithStats | null
  allRoles: JobRoleWithStats[]
  areas: JobRoleArea[]
  trails: TenantTrail[]
  onClose: () => void
  onChanged: () => void
  onRequestDelete: (role: JobRoleWithStats) => void
}

export function JobRoleDrawer({
  role,
  allRoles,
  areas,
  trails,
  onClose,
  onChanged,
  onRequestDelete,
}: JobRoleDrawerProps) {
  const isCreate = role === null

  const [editing, setEditing] = useState(isCreate)
  const [name, setName] = useState(role?.name ?? "")
  const [areaId, setAreaId] = useState(role?.area_id ?? "")
  const [seniority, setSeniority] = useState(role?.seniority_level ?? "mid")
  const [description, setDescription] = useState(role?.description ?? "")
  const [error, setError] = useState("")
  const [trailToLink, setTrailToLink] = useState("")
  const [movingPeople, setMovingPeople] = useState(false)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  // Trocar de cargo sem fechar o drawer (clicar noutra linha) precisa recarregar
  // o formulário — senão o painel mostra um cargo e edita outro.
  useEffect(() => {
    setEditing(role === null)
    setName(role?.name ?? "")
    setAreaId(role?.area_id ?? "")
    setSeniority(role?.seniority_level ?? "mid")
    setDescription(role?.description ?? "")
    setError("")
    setTrailToLink("")
    setMovingPeople(false)
    setAssignments({})
  }, [role])

  const areaName = role?.area_name ?? areas.find((a) => a.id === areaId)?.name ?? null
  const suggestions = role ? buildJobRoleSuggestions(role, allRoles) : []
  const linkableTrails = trails.filter((t) => t.target_job_role_id !== role?.id)
  const destinations = allRoles
    .filter((r) => r.id !== role?.id)
    .map((r) => ({ id: r.id, name: r.name }))

  function run(action: () => Promise<{ error?: string } | { success?: boolean } | unknown>) {
    setError("")
    startTransition(async () => {
      const result = (await action()) as { error?: string } | null
      if (result && "error" in result && result.error) {
        setError(result.error)
        return
      }
      onChanged()
    })
  }

  function save() {
    const payload = {
      name,
      area_id: areaId || null,
      seniority_level: seniority,
      description: description || null,
    }

    setError("")
    startTransition(async () => {
      const result = role ? await updateJobRole(role.id, payload) : await createJobRole(payload)

      if ("error" in result && result.error) {
        setError(result.error)
        return
      }

      setEditing(false)
      onChanged()
      if (!role) onClose()
    })
  }

  function confirmMovePeople() {
    if (!role) return
    run(async () => {
      const result = await reassignJobRolePeople(toReassignments(assignments, role.people))
      setMovingPeople(false)
      setAssignments({})
      return result
    })
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetOverlay />
      <SheetContent
        side="right"
        className="flex w-full max-w-xl flex-col gap-5 overflow-y-auto sm:w-[32rem]"
        aria-label={isCreate ? "Novo cargo" : `Cargo ${role?.name}`}
        data-testid="job-role-drawer"
      >
        {/* -------------------------------- Cabeçalho ------------------------------- */}
        <header className="flex items-start justify-between gap-3" data-testid="drawer-header">
          <div className="min-w-0 space-y-2">
            {editing ? (
              <Input
                aria-label="Nome do cargo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Analista de Dados"
              />
            ) : (
              <h2 className="truncate text-lg font-semibold text-text-primary">{role?.name}</h2>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {editing ? (
                <>
                  <Select
                    aria-label="Senioridade"
                    selectSize="sm"
                    value={seniority}
                    onChange={(e) => setSeniority(e.target.value)}
                  >
                    {SENIORITY_ORDER.map((value) => (
                      <option key={value} value={value}>
                        {SENIORITY_LABELS[value]}
                      </option>
                    ))}
                  </Select>
                  <Select
                    aria-label="Área"
                    selectSize="sm"
                    value={areaId}
                    onChange={(e) => setAreaId(e.target.value)}
                  >
                    <option value="">Sem área</option>
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </Select>
                </>
              ) : (
                <>
                  <Badge badgeSize="sm">
                    {SENIORITY_LABELS[role?.seniority_level ?? ""] ?? role?.seniority_level}
                  </Badge>
                  <span className="text-xs text-text-secondary">{areaName ?? "Sem área"}</span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            aria-label="Fechar"
            className="text-text-muted transition-colors hover:text-text-primary"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* ------------------------------- Descrição -------------------------------- */}
        <section className="space-y-1" data-testid="drawer-description">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Descrição
          </h3>
          {editing ? (
            <Textarea
              aria-label="Descrição do cargo"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="O que quem tem este cargo faz no dia a dia"
            />
          ) : (
            <p className="whitespace-pre-line text-sm text-text-secondary">
              {role?.description?.trim() || "Sem descrição."}
            </p>
          )}
        </section>

        {!isCreate && role && (
          <>
            {/* --------------------------- Trilhas vinculadas -------------------------- */}
            <section className="space-y-2" data-testid="drawer-trails">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Trilhas vinculadas
              </h3>

              {role.trails.length === 0 ? (
                <p className="text-sm text-text-secondary">Nenhuma trilha vinculada.</p>
              ) : (
                <ul className="space-y-1">
                  {role.trails.map((trail) => (
                    <li
                      key={trail.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border-subtle px-3 py-2"
                    >
                      <span className="min-w-0 truncate text-sm text-text-primary">
                        {trail.title}
                        {trail.status !== "active" && (
                          <span className="ml-2 text-xs text-text-muted">({trail.status})</span>
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Desvincular trilha ${trail.title}`}
                        disabled={isPending}
                        onClick={() => run(() => unlinkTrailFromJobRole(trail.id))}
                      >
                        <Link2Off className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-2">
                <Select
                  aria-label="Vincular trilha"
                  selectSize="sm"
                  value={trailToLink}
                  disabled={isPending}
                  onChange={(e) => setTrailToLink(e.target.value)}
                >
                  <option value="">+ Vincular trilha…</option>
                  {linkableTrails.map((trail) => (
                    <option key={trail.id} value={trail.id}>
                      {trail.title}
                      {trail.target_job_role_id ? " (move de outro cargo)" : ""}
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending || !trailToLink}
                  onClick={() => run(() => linkTrailToJobRole(trailToLink, role.id))}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Vincular
                </Button>
              </div>
              <p className="text-xs text-text-muted">
                Uma trilha pertence a um cargo por vez: vincular uma trilha de outro cargo move o
                vínculo.
              </p>
            </section>

            {/* ---------------------------- Pessoas do cargo --------------------------- */}
            <section className="space-y-2" data-testid="drawer-people">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Pessoas com este cargo ({role.people.length})
              </h3>

              {role.people.length === 0 ? (
                <p className="text-sm text-text-secondary">Ninguém tem este cargo hoje.</p>
              ) : movingPeople ? (
                <div className="space-y-3">
                  <ReassignPeopleFields
                    people={role.people}
                    destinations={destinations}
                    value={assignments}
                    onChange={setAssignments}
                    disabled={isPending}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => {
                        setMovingPeople(false)
                        setAssignments({})
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      disabled={
                        isPending ||
                        undecidedPeople(assignments, role.people).length === role.people.length
                      }
                      onClick={confirmMovePeople}
                    >
                      Confirmar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <ul className="space-y-1">
                    {role.people.map((person) => (
                      <li key={person.id} className="flex items-center gap-2">
                        <Avatar
                          size="sm"
                          src={person.avatar_url ?? undefined}
                          fallback={initialsOf(person)}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-text-primary">
                            {person.full_name ?? person.email}
                          </p>
                          <p className="truncate text-xs text-text-secondary">
                            {person.area_names.join(" · ") || "Sem área"}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Button variant="outline" size="sm" onClick={() => setMovingPeople(true)}>
                    Mover pessoas de cargo…
                  </Button>
                </>
              )}
            </section>

            {/* -------------------------------- Sugestões ------------------------------ */}
            <section className="space-y-2" data-testid="drawer-suggestions">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Sugestões
              </h3>
              {suggestions.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  Nada a apontar: o cargo tem trilha ativa, pessoas e descrição.
                </p>
              ) : (
                <ul className="list-disc space-y-1 pl-4">
                  {suggestions.map((suggestion) => (
                    <li key={suggestion} className="text-sm text-text-secondary">
                      {suggestion}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {error && (
          <p className="rounded-md bg-semantic-error/10 p-2 text-sm text-semantic-error">{error}</p>
        )}

        {/* --------------------------------- Ações --------------------------------- */}
        <footer className="mt-auto flex flex-wrap justify-end gap-2" data-testid="drawer-actions">
          {editing ? (
            <Button onClick={save} disabled={isPending || !name.trim()}>
              {isPending ? "Salvando..." : isCreate ? "Criar cargo" : "Salvar"}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)}>
              Editar
            </Button>
          )}

          {!isCreate && role && (
            <>
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => run(() => duplicateJobRole(role.id))}
              >
                Duplicar
              </Button>
              <Button variant="destructive" onClick={() => onRequestDelete(role)}>
                Excluir
              </Button>
            </>
          )}

          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  )
}
