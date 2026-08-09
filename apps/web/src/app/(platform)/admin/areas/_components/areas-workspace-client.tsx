"use client"

import {
  Badge,
  Button,
  FormField,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Select,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetOverlay,
  SheetTitle,
  useToast,
} from "@eximia/ui"
import { Building2, Layers, LayoutGrid, List, Table2, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import type { DepartmentView, DepartmentsSnapshot, UnidadeRef } from "../departments-model"
import {
  type LocalDepartmentDestination,
  corporateDepartmentsOf,
  deriveDepartments,
  localDepartmentsOf,
  planDeleteUnit,
} from "../departments-model"
import type { AreaWithCounts } from "../loader"
import { AreaManagementClient } from "./area-management-client"
import { DepartmentsList } from "./departments-list"
import { DepartmentsMap } from "./departments-map"

// =============================================================================
// UNIDADES & ÁREAS — a casca que segura as duas vistas e as operações.
// =============================================================================
// Mapa e Lista NÃO têm estado próprio de dados: as duas recebem a MESMA
// derivação (`deriveDepartments`) e chamam as MESMAS operações daqui. É isso, e
// só isso, que garante a paridade exigida pelo AC8 — não há um segundo caminho
// pelo qual as vistas possam discordar.
//
// A aba "Unidades" preserva `AreaManagementClient` INTACTO (ACs 1-3: a tabela
// atual com Nome/Slug/Descrição/contagens e o CRUD dela não podem regredir).
// Ele não foi tocado nem embrulhado: continua sendo o mesmo componente, agora
// alcançável por uma aba.
// =============================================================================

type ViewMode = "mapa" | "lista" | "unidades"

type Operation =
  | { kind: "create-department"; areaId: string | null }
  | { kind: "rename"; department: DepartmentView }
  | { kind: "move"; department: DepartmentView; fromAreaId: string }
  | { kind: "expand"; department: DepartmentView }
  | { kind: "shrink"; department: DepartmentView }
  | { kind: "archive"; department: DepartmentView }
  | { kind: "restore"; department: DepartmentView }
  | { kind: "delete-unit"; unidade: UnidadeRef }

interface AreasWorkspaceClientProps {
  areas: AreaWithCounts[]
  snapshot: DepartmentsSnapshot
}

export function AreasWorkspaceClient({ areas, snapshot }: AreasWorkspaceClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [view, setView] = useState<ViewMode>("mapa")
  const [unitDrawer, setUnitDrawer] = useState<UnidadeRef | null>(null)
  const [departmentDrawer, setDepartmentDrawer] = useState<DepartmentView | null>(null)
  const [operation, setOperation] = useState<Operation | null>(null)

  const departments = useMemo(() => deriveDepartments(snapshot), [snapshot])
  const unidades = snapshot.unidades

  /* ------------------------------ Escritas ------------------------------- */

  function post(url: string, body: unknown, successMessage: string) {
    startTransition(async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast({ variant: "error", title: json.error ?? "Não foi possível concluir a operação" })
        return
      }

      // Aviso do plano (pessoa que ficou, corporativa que virou local, arquivamento)
      // aparece SEMPRE que existir: uma consequência silenciosa é o defeito.
      const warnings: string[] = json?.data?.warnings ?? []
      toast({
        variant: "success",
        title: successMessage,
        description: warnings.length > 0 ? warnings.join(" ") : undefined,
      })
      setOperation(null)
      setDepartmentDrawer(null)
      setUnitDrawer(null)
      router.refresh()
    })
  }

  function runPresence(departmentId: string, body: Record<string, unknown>, message: string) {
    post(`/api/admin/departments/${departmentId}/presence`, body, message)
  }

  function patch(url: string, body: unknown, successMessage: string) {
    startTransition(async () => {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ variant: "error", title: json.error ?? "Não foi possível salvar" })
        return
      }
      toast({ variant: "success", title: successMessage })
      setOperation(null)
      setDepartmentDrawer(null)
      setUnitDrawer(null)
      router.refresh()
    })
  }

  /* -------------------------------- Render -------------------------------- */

  const views: { id: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
    { id: "mapa", label: "Mapa", icon: LayoutGrid },
    { id: "lista", label: "Lista", icon: List },
    { id: "unidades", label: "Unidades", icon: Table2 },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-bg-surface p-1">
          {views.map((v) => {
            const Icon = v.icon
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                aria-pressed={view === v.id}
                className={
                  view === v.id
                    ? "inline-flex items-center gap-1.5 rounded-md bg-bg-card px-3 py-1.5 text-xs font-medium text-text-primary shadow-card"
                    : "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-text-secondary transition-colors hover:text-text-primary"
                }
              >
                <Icon size={14} />
                {v.label}
              </button>
            )
          })}
        </div>

        {view !== "unidades" && (
          <Button
            size="sm"
            onClick={() =>
              setOperation({ kind: "create-department", areaId: unidades[0]?.id ?? null })
            }
            disabled={unidades.length === 0}
          >
            Nova área
          </Button>
        )}
      </div>

      {/* Estado que o dono vai encontrar HOJE: unidades existem, nenhuma área
          cadastrada. A tela explica a diferença entre as duas coisas em vez de
          mostrar um quadro vazio sem sentido. */}
      {departments.length === 0 && unidades.length > 0 && view !== "unidades" && (
        <div className="rounded-xl border border-border-subtle bg-bg-surface px-4 py-3">
          <p className="text-sm text-text-primary">
            Nenhuma área cadastrada ainda — as {unidades.length} unidades abaixo estão prontas para
            receber a primeira.
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            <strong>Unidade</strong> é o lugar (Ribeirão Preto, Minas Gerais). <strong>Área</strong>{" "}
            é o time funcional (Finanças, Logística) que vive dentro dele. Uma área presente em mais
            de uma unidade é <strong>corporativa</strong>.
          </p>
        </div>
      )}

      {view === "mapa" && (
        <DepartmentsMap
          unidades={unidades}
          departments={departments}
          onOpenUnit={setUnitDrawer}
          onOpenDepartment={setDepartmentDrawer}
          onAddDepartment={(u) => setOperation({ kind: "create-department", areaId: u.id })}
          onCreateUnit={() => setView("unidades")}
        />
      )}

      {view === "lista" && (
        <DepartmentsList
          unidades={unidades}
          departments={departments}
          onOpenUnit={setUnitDrawer}
          onOpenDepartment={setDepartmentDrawer}
          onAddDepartment={(u) => setOperation({ kind: "create-department", areaId: u.id })}
          onMove={(department, fromAreaId) =>
            setOperation({ kind: "move", department, fromAreaId })
          }
          onManagePresence={(department) => setOperation({ kind: "expand", department })}
          onRename={(department) => setOperation({ kind: "rename", department })}
          onArchive={(department) => setOperation({ kind: "archive", department })}
          onRestore={(department) => setOperation({ kind: "restore", department })}
        />
      )}

      {view === "unidades" && <AreaManagementClient initialAreas={areas} />}

      {/* ----------------------------- Drawers ----------------------------- */}

      <UnitDrawer
        unidade={unitDrawer}
        unidades={unidades}
        departments={departments}
        onClose={() => setUnitDrawer(null)}
        onOpenDepartment={(d) => {
          setUnitDrawer(null)
          setDepartmentDrawer(d)
        }}
        onAddDepartment={(u) => setOperation({ kind: "create-department", areaId: u.id })}
        onRename={(u, name) => patch(`/api/admin/areas/${u.id}`, { name }, "Unidade renomeada")}
        onDelete={(u) => setOperation({ kind: "delete-unit", unidade: u })}
        isPending={isPending}
      />

      <DepartmentDrawer
        department={departmentDrawer}
        unidades={unidades}
        people={snapshot.people}
        onClose={() => setDepartmentDrawer(null)}
        onOperation={setOperation}
      />

      {/* ---------------------------- Operações ---------------------------- */}

      <OperationModal
        operation={operation}
        unidades={unidades}
        departments={departments}
        snapshot={snapshot}
        isPending={isPending}
        onClose={() => setOperation(null)}
        onCreateDepartment={(payload) => post("/api/admin/departments", payload, "Área criada")}
        onRename={(department, name) =>
          patch(`/api/admin/departments/${department.id}`, { name }, "Área renomeada")
        }
        onPresence={runPresence}
        onDeleteUnit={async (unidade, destinations) => {
          await handleDeleteUnit(unidade, destinations)
        }}
      />
    </div>
  )

  /* --------------------- Excluir unidade (composto, AC7) ------------------ */

  async function handleDeleteUnit(unidade: UnidadeRef, destinations: LocalDepartmentDestination[]) {
    const planned = planDeleteUnit(snapshot, unidade.id, destinations)
    if (!planned.ok) {
      toast({ variant: "error", title: planned.error })
      return
    }

    startTransition(async () => {
      // As áreas saem PRIMEIRO; a unidade só é excluída depois que todas
      // encontraram destino. Se um passo falhar, a unidade continua de pé com o
      // que restou — nada some sem ter para onde ir.
      for (const p of [...planned.plan.localPlans, ...planned.plan.corporatePlans]) {
        const body =
          p.op.kind === "move"
            ? { op: "move", fromAreaId: unidade.id, toAreaId: p.addPresences[0]?.areaId }
            : p.op.kind === "archive"
              ? { op: "archive" }
              : { op: "shrink", fromAreaId: unidade.id }

        const res = await fetch(`/api/admin/departments/${p.op.departmentId}/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          toast({
            variant: "error",
            title: json.error ?? "Falha ao reposicionar uma área",
            description: "A unidade NÃO foi excluída. Nada foi perdido.",
          })
          return
        }
      }

      const res = await fetch(`/api/admin/areas/${unidade.id}`, { method: "DELETE" })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast({ variant: "error", title: json.error ?? "Erro ao excluir unidade" })
        return
      }

      toast({ variant: "success", title: "Unidade excluída" })
      setOperation(null)
      setUnitDrawer(null)
      router.refresh()
    })
  }
}

/* ------------------------------ Drawer: unidade --------------------------- */

function UnitDrawer({
  unidade,
  unidades,
  departments,
  onClose,
  onOpenDepartment,
  onAddDepartment,
  onRename,
  onDelete,
  isPending,
}: {
  unidade: UnidadeRef | null
  unidades: UnidadeRef[]
  departments: DepartmentView[]
  onClose: () => void
  onOpenDepartment: (department: DepartmentView) => void
  onAddDepartment: (unidade: UnidadeRef) => void
  onRename: (unidade: UnidadeRef, name: string) => void
  onDelete: (unidade: UnidadeRef) => void
  isPending: boolean
}) {
  const [name, setName] = useState("")

  if (!unidade) return null

  const locals = localDepartmentsOf(departments, unidade.id)
  const corps = corporateDepartmentsOf(departments, unidade.id)
  const people = new Set([...locals, ...corps].flatMap((d) => d.memberIds)).size

  return (
    <Sheet open={!!unidade} onOpenChange={(open) => !open && onClose()}>
      <SheetOverlay />
      <SheetContent className="w-full max-w-md space-y-5 overflow-y-auto p-6">
        <SheetHeader>
          <p className="text-xs uppercase tracking-wide text-text-muted">Unidade</p>
          <SheetTitle>{unidade.name}</SheetTitle>
          <p className="text-sm text-text-secondary">
            {people} {people === 1 ? "pessoa" : "pessoas"} · {locals.length + corps.length}{" "}
            {locals.length + corps.length === 1 ? "área" : "áreas"}
          </p>
        </SheetHeader>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Áreas nesta unidade
          </p>
          {locals.length + corps.length === 0 && (
            <p className="text-sm text-text-muted">Nenhuma área ainda.</p>
          )}
          {[...locals, ...corps].map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onOpenDepartment(d)}
              className="flex w-full items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-left transition-colors hover:bg-bg-hover"
            >
              <span className="flex-1 truncate text-sm text-text-primary">{d.name}</span>
              {d.placement === "corporate" && (
                <Badge variant="draft" badgeSize="sm">
                  Corporativa
                </Badge>
              )}
              <span className="text-xs text-text-muted">{d.memberCount}</span>
            </button>
          ))}
          <Button variant="outline" size="sm" onClick={() => onAddDepartment(unidade)}>
            Adicionar área
          </Button>
        </div>

        <div className="space-y-2 border-t border-border-subtle pt-4">
          <FormField label="Renomear unidade">
            <Input
              value={name || unidade.name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Nome da unidade"
            />
          </FormField>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending || !name || name === unidade.name}
            onClick={() => onRename(unidade, name)}
          >
            Salvar nome
          </Button>
        </div>

        <div className="border-t border-border-subtle pt-4">
          <Button variant="destructive" size="sm" onClick={() => onDelete(unidade)}>
            Excluir unidade
          </Button>
          <p className="mt-2 text-xs text-text-muted">
            {locals.length > 0 || corps.length > 0
              ? "As áreas desta unidade precisam de destino antes: cada local vai para outra unidade ou é arquivada, e as corporativas apenas perdem a presença aqui."
              : "Unidade sem áreas — a exclusão é direta."}
          </p>
          {unidades.length === 1 && (
            <p className="mt-1 text-xs text-text-muted">Esta é a última unidade da empresa.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/* ---------------------------- Drawer: departamento ------------------------ */

function DepartmentDrawer({
  department,
  unidades,
  people,
  onClose,
  onOperation,
}: {
  department: DepartmentView | null
  unidades: UnidadeRef[]
  people: DepartmentsSnapshot["people"]
  onClose: () => void
  onOperation: (operation: Operation) => void
}) {
  if (!department) return null

  const members = people.filter((p) => department.memberIds.includes(p.id))
  const placementLabel =
    department.placement === "corporate"
      ? "Corporativa"
      : department.placement === "archived"
        ? "Arquivada"
        : "Local"

  return (
    <Sheet open={!!department} onOpenChange={(open) => !open && onClose()}>
      <SheetOverlay />
      <SheetContent className="w-full max-w-md space-y-5 overflow-y-auto p-6">
        <SheetHeader>
          <p className="text-xs uppercase tracking-wide text-text-muted">Área</p>
          <SheetTitle>{department.name}</SheetTitle>
          <div className="flex items-center gap-2">
            <Badge variant="draft" badgeSize="sm">
              {placementLabel}
            </Badge>
            <span className="inline-flex items-center gap-1 text-xs text-text-muted">
              <Users size={12} />
              {department.memberCount}
            </span>
          </div>
          {department.description && (
            <p className="text-sm text-text-secondary">{department.description}</p>
          )}
        </SheetHeader>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Presente em</p>
          {department.areaIds.length === 0 ? (
            <p className="text-sm text-text-muted">
              Nenhuma unidade — a área está arquivada e pode ser restaurada.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {department.areaIds.map((areaId) => (
                <span
                  key={areaId}
                  className="inline-flex items-center gap-1 rounded-md bg-bg-surface px-2 py-1 text-xs text-text-secondary"
                >
                  <Building2 size={11} />
                  {unidades.find((u) => u.id === areaId)?.name ?? "—"}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Gestor da área
          </p>
          {department.managers.length === 0 ? (
            <p className="text-sm text-text-muted">
              Nenhuma pessoa com chapéu de gestor nesta área.
            </p>
          ) : (
            department.managers.map((m) => (
              <p key={m.id} className="text-sm text-text-primary">
                {m.name} <span className="text-xs text-text-muted">{m.email}</span>
              </p>
            ))
          )}
        </div>

        {members.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Pessoas</p>
            {members.map((m) => (
              <p key={m.id} className="text-sm text-text-secondary">
                {m.name}
              </p>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOperation({ kind: "rename", department })}
          >
            Renomear
          </Button>

          {department.placement !== "archived" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onOperation({
                    kind: "move",
                    department,
                    fromAreaId: department.areaIds[0] ?? "",
                  })
                }
              >
                Mover
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOperation({ kind: "expand", department })}
              >
                Expandir
              </Button>
            </>
          )}

          {department.placement === "corporate" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOperation({ kind: "shrink", department })}
            >
              Encolher
            </Button>
          )}

          {department.placement === "archived" ? (
            <Button size="sm" onClick={() => onOperation({ kind: "restore", department })}>
              Restaurar
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOperation({ kind: "archive", department })}
            >
              Arquivar
            </Button>
          )}
        </div>

        <p className="text-xs text-text-muted">
          <strong>Mover</strong> troca a área de unidade. <strong>Expandir</strong> mantém onde está
          e acrescenta outra unidade, tornando a área corporativa. São operações diferentes.
        </p>
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------ Modal de operação ------------------------- */

function OperationModal({
  operation,
  unidades,
  departments,
  snapshot,
  isPending,
  onClose,
  onCreateDepartment,
  onRename,
  onPresence,
  onDeleteUnit,
}: {
  operation: Operation | null
  unidades: UnidadeRef[]
  departments: DepartmentView[]
  snapshot: DepartmentsSnapshot
  isPending: boolean
  onClose: () => void
  onCreateDepartment: (payload: {
    name: string
    slug: string
    description?: string
    /** Obrigatória: toda área nasce em uma unidade (decisão do dono, 2026-07-28). */
    areaId: string
  }) => void
  onRename: (department: DepartmentView, name: string) => void
  onPresence: (departmentId: string, body: Record<string, unknown>, message: string) => void
  onDeleteUnit: (unidade: UnidadeRef, destinations: LocalDepartmentDestination[]) => void
}) {
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [targetAreaId, setTargetAreaId] = useState("")
  const [destinations, setDestinations] = useState<Record<string, string>>({})

  if (!operation) return null

  const close = () => {
    setName("")
    setSlug("")
    setDescription("")
    setTargetAreaId("")
    setDestinations({})
    onClose()
  }

  if (operation.kind === "create-department") {
    // "Toda área nasce em uma unidade" (decisão do dono, 2026-07-28). A rota
    // recusa sem unidade; aqui o botão nem chega a disparar uma requisição que
    // já se sabe que vai falhar.
    const unidadeEscolhida = targetAreaId || operation.areaId || ""

    return (
      <Modal open onOpenChange={close}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Nova área</ModalTitle>
            <ModalDescription>
              A área é o time funcional (Finanças, Logística). Ela nasce dentro de uma unidade e
              pode virar corporativa depois.
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-4 py-4">
            <FormField label="Nome">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Finanças"
              />
            </FormField>
            <FormField label="Slug">
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="Ex: financas"
              />
            </FormField>
            <FormField label="Descrição (opcional)">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </FormField>
            <FormField label="Unidade">
              <Select value={unidadeEscolhida} onChange={(e) => setTargetAreaId(e.target.value)}>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button
              disabled={isPending || !name || !slug || !unidadeEscolhida}
              onClick={() =>
                onCreateDepartment({
                  name,
                  slug,
                  description: description || undefined,
                  areaId: unidadeEscolhida,
                })
              }
            >
              {isPending ? "Criando…" : "Criar"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    )
  }

  if (operation.kind === "rename") {
    return (
      <Modal open onOpenChange={close}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Renomear área</ModalTitle>
          </ModalHeader>
          <div className="py-4">
            <FormField label="Nome">
              <Input
                value={name || operation.department.name}
                onChange={(e) => setName(e.target.value)}
              />
            </FormField>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button
              disabled={isPending || !name || name === operation.department.name}
              onClick={() => onRename(operation.department, name)}
            >
              Salvar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    )
  }

  if (operation.kind === "move" || operation.kind === "expand" || operation.kind === "restore") {
    const d = operation.department
    const disponiveis = unidades.filter((u) =>
      operation.kind === "move" ? !d.areaIds.includes(u.id) : !d.areaIds.includes(u.id),
    )
    const origem =
      operation.kind === "move"
        ? unidades.find((u) => u.id === operation.fromAreaId)?.name
        : undefined

    const titles: Record<string, string> = {
      move: "Mover área para outra unidade",
      expand: "Expandir área para mais uma unidade",
      restore: "Restaurar área",
    }
    const descriptions: Record<string, string> = {
      move: `"${d.name}" deixa de estar em ${origem ?? "a unidade atual"} e passa a estar na unidade escolhida. As pessoas da área acompanham.`,
      expand: `"${d.name}" continua onde está E passa a existir também na unidade escolhida — ou seja, vira corporativa. Ninguém muda de unidade.`,
      restore: `"${d.name}" está arquivada. Escolha a unidade onde ela volta a existir.`,
    }

    return (
      <Modal open onOpenChange={close}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>{titles[operation.kind]}</ModalTitle>
            <ModalDescription>{descriptions[operation.kind]}</ModalDescription>
          </ModalHeader>
          <div className="py-4">
            {disponiveis.length === 0 ? (
              <p className="text-sm text-text-muted">
                Não há outra unidade disponível para esta operação.
              </p>
            ) : (
              <FormField label="Unidade de destino">
                <Select value={targetAreaId} onChange={(e) => setTargetAreaId(e.target.value)}>
                  <option value="">Selecione…</option>
                  {disponiveis.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button
              disabled={isPending || !targetAreaId}
              onClick={() =>
                onPresence(
                  d.id,
                  operation.kind === "move"
                    ? { op: "move", fromAreaId: operation.fromAreaId, toAreaId: targetAreaId }
                    : operation.kind === "expand"
                      ? { op: "expand", toAreaId: targetAreaId }
                      : { op: "restore", toAreaId: targetAreaId },
                  operation.kind === "move"
                    ? "Área movida"
                    : operation.kind === "expand"
                      ? "Área expandida"
                      : "Área restaurada",
                )
              }
            >
              Confirmar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    )
  }

  if (operation.kind === "shrink") {
    const d = operation.department
    return (
      <Modal open onOpenChange={close}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Encolher presença</ModalTitle>
            <ModalDescription>
              "{d.name}" deixa de existir na unidade escolhida, mas continua nas demais. A área não
              é excluída.
            </ModalDescription>
          </ModalHeader>
          <div className="py-4">
            <FormField label="Deixar de estar em">
              <Select value={targetAreaId} onChange={(e) => setTargetAreaId(e.target.value)}>
                <option value="">Selecione…</option>
                {d.areaIds.map((areaId) => (
                  <option key={areaId} value={areaId}>
                    {unidades.find((u) => u.id === areaId)?.name ?? areaId}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button
              disabled={isPending || !targetAreaId}
              onClick={() =>
                onPresence(d.id, { op: "shrink", fromAreaId: targetAreaId }, "Presença removida")
              }
            >
              Confirmar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    )
  }

  if (operation.kind === "archive") {
    const d = operation.department
    return (
      <Modal open onOpenChange={close}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Arquivar área</ModalTitle>
            <ModalDescription>
              "{d.name}" sai de {d.areaIds.length} {d.areaIds.length === 1 ? "unidade" : "unidades"}{" "}
              e vai para Arquivadas. As {d.memberCount} pessoas vinculadas são preservadas, e a área
              pode ser restaurada a qualquer momento.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button
              disabled={isPending}
              onClick={() => onPresence(d.id, { op: "archive" }, "Área arquivada")}
            >
              Arquivar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    )
  }

  // delete-unit
  const unidade = operation.unidade
  const locals = localDepartmentsOf(departments, unidade.id)
  const corps = corporateDepartmentsOf(departments, unidade.id)
  const outras = unidades.filter((u) => u.id !== unidade.id)
  const chosen: LocalDepartmentDestination[] = locals
    .map((d) => {
      const value = destinations[d.id]
      if (!value) return null
      if (value === "__archive__") return { departmentId: d.id, action: "archive" as const }
      return { departmentId: d.id, action: "move" as const, toAreaId: value }
    })
    .filter((d): d is LocalDepartmentDestination => d !== null)
  const preview = planDeleteUnit(snapshot, unidade.id, chosen)

  return (
    <Modal open onOpenChange={close}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Excluir unidade</ModalTitle>
          <ModalDescription>
            A unidade <strong>{unidade.name}</strong> será excluída. Antes disso, cada área precisa
            de destino.
          </ModalDescription>
        </ModalHeader>

        <div className="max-h-[50vh] space-y-4 overflow-y-auto py-4">
          {locals.length === 0 && corps.length === 0 && (
            <p className="text-sm text-text-secondary">
              Esta unidade não tem nenhuma área. A exclusão é direta.
            </p>
          )}

          {locals.map((d) => (
            <FormField key={d.id} label={`${d.name} (${d.memberCount} pessoa(s))`}>
              <Select
                value={destinations[d.id] ?? ""}
                onChange={(e) => setDestinations((s) => ({ ...s, [d.id]: e.target.value }))}
              >
                <option value="">Escolha o destino…</option>
                {outras.map((u) => (
                  <option key={u.id} value={u.id}>
                    Mover para {u.name}
                  </option>
                ))}
                <option value="__archive__">Arquivar</option>
              </Select>
            </FormField>
          ))}

          {corps.length > 0 && (
            <div className="rounded-lg bg-bg-surface px-3 py-2">
              <p className="text-xs font-medium text-text-primary">
                <Layers size={12} className="mr-1 inline" />
                Áreas corporativas
              </p>
              {corps.map((d) => (
                <p key={d.id} className="mt-1 text-xs text-text-secondary">
                  <strong>{d.name}</strong> perde a presença aqui
                  {d.areaIds.length === 2 ? " e volta a ser local." : " e segue corporativa."}
                </p>
              ))}
            </div>
          )}

          {preview.ok && preview.plan.reassignUsers.length > 0 && (
            <p className="text-xs text-text-secondary">
              {preview.plan.reassignUsers.length} pessoa(s) mudam de unidade junto com a área delas.
            </p>
          )}
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={isPending || !preview.ok}
            onClick={() => onDeleteUnit(unidade, chosen)}
          >
            {isPending ? "Excluindo…" : "Excluir unidade"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
