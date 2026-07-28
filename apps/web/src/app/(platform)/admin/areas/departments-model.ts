// =============================================================================
// MODELO PURO — UNIDADE x DEPARTAMENTO (CFG-7.1)
// =============================================================================
// Este módulo NÃO toca banco, rede nem React. Ele existe porque a operação de
// maior risco do épico (MOVER x EXPANDIR) não pode viver dentro de um handler de
// clique: confundir as duas corrompe o dado EM SILÊNCIO — sem erro na tela, sem
// exceção no log, só um departamento que deixou de estar onde estava. Isolado
// aqui, o comportamento é provável por teste antes de existir uma única pixel.
//
// VOCABULÁRIO (errar isto corrompe o produto inteiro):
//   • UNIDADE     = tabela `areas` (site físico: "Ribeirão Preto", "Minas
//                   Gerais"). NÃO muda de significado. É a COLUNA do kanban.
//   • DEPARTAMENTO= tabela `departments` ("Área" no vocabulário de produto, ex.:
//                   "Finanças"). É o CARTÃO dentro da coluna.
//   • PRESENÇA    = linha de `department_areas` (departamento presente numa
//                   unidade). A CARDINALIDADE é a semântica, não existe flag:
//                     0 presenças → ARQUIVADO   (existe, não está em lugar nenhum)
//                     1 presença  → LOCAL       (vive numa unidade só)
//                     2+ presenças→ CORPORATIVO (atravessa unidades)
//
// DECISÃO REGISTRADA — "arquivado" é 0 presenças, não uma coluna nova.
// `departments` NÃO tem `archived_at` (ver migration 20260728120000), e esta
// story está proibida de emitir migration. Em vez de fingir que arquivar não
// existe, ele é modelado pela mesma régua que a própria migration escolheu para
// "corporativo": a cardinalidade da junção. Encolher a ÚLTIMA presença não apaga
// o departamento — ele sobrevive sem unidade, que é exatamente "arquivado", e
// restaurar é devolvê-lo a uma unidade. Se um dia o produto precisar distinguir
// "arquivado de propósito" de "ficou sem unidade por acidente", aí sim é coluna
// nova e migration própria (follow-up para @data-engineer, fora desta story).
// =============================================================================

/* ------------------------------- Entradas -------------------------------- */

/** UNIDADE (linha de `areas`). Coluna do kanban. */
export interface UnidadeRef {
  id: string
  name: string
  slug: string
  description: string | null
}

/** DEPARTAMENTO (linha de `departments`). Cartão dentro da coluna. */
export interface DepartmentRecord {
  id: string
  name: string
  slug: string
  description: string | null
}

/** Presença: linha de `department_areas`. */
export interface PresenceRef {
  departmentId: string
  /** Aponta para `areas.id` — a UNIDADE, sempre. */
  areaId: string
}

/** Vínculo pessoa x departamento: linha de `user_departments`. */
export interface MembershipRef {
  userId: string
  departmentId: string
}

/**
 * Pessoa do tenant. `areaId` é a UNIDADE atual dela (`user_areas.area_id`) —
 * é ele que MOVER reatribui, nunca o vínculo com o departamento.
 */
export interface PersonRef {
  id: string
  name: string
  email: string | null
  /** Gestor no sentido de chapéu real (`manager`), usado no rótulo "gestor". */
  isManager: boolean
  areaId: string | null
}

/** Estado completo lido pelo loader e consumido pelo Mapa e pela Lista. */
export interface DepartmentsSnapshot {
  unidades: UnidadeRef[]
  departments: DepartmentRecord[]
  presences: PresenceRef[]
  memberships: MembershipRef[]
  people: PersonRef[]
}

/* -------------------------------- Saídas --------------------------------- */

export type DepartmentPlacement = "local" | "corporate" | "archived"

export interface DepartmentView {
  id: string
  name: string
  slug: string
  description: string | null
  /** Unidades cobertas, na ordem em que as unidades aparecem no Mapa. */
  areaIds: string[]
  placement: DepartmentPlacement
  memberIds: string[]
  memberCount: number
  /** Pessoas com chapéu de gestor dentro do departamento. */
  managers: PersonRef[]
}

export const EMPTY_SNAPSHOT: DepartmentsSnapshot = {
  unidades: [],
  departments: [],
  presences: [],
  memberships: [],
  people: [],
}

/** 0 → arquivado · 1 → local · 2+ → corporativo. A cardinalidade É a semântica. */
export function placementOf(areaIdCount: number): DepartmentPlacement {
  if (areaIdCount === 0) return "archived"
  if (areaIdCount === 1) return "local"
  return "corporate"
}

/**
 * Deriva a visão de cada departamento a partir do snapshot cru.
 *
 * A ordem de `areaIds` acompanha a ordem das unidades (não a ordem de inserção
 * na junção), porque é ela que decide de onde até onde a barra corporativa
 * atravessa no Mapa.
 */
export function deriveDepartments(snapshot: DepartmentsSnapshot): DepartmentView[] {
  const unidadeOrder = new Map(snapshot.unidades.map((u, i) => [u.id, i]))
  const peopleById = new Map(snapshot.people.map((p) => [p.id, p]))

  const areasByDept = new Map<string, string[]>()
  for (const p of snapshot.presences) {
    // Presença para uma unidade que não está no snapshot (outra empresa, ou
    // unidade recém-excluída) é ignorada de propósito: o Mapa nunca inventa
    // coluna que não existe.
    if (!unidadeOrder.has(p.areaId)) continue
    const list = areasByDept.get(p.departmentId) ?? []
    if (!list.includes(p.areaId)) list.push(p.areaId)
    areasByDept.set(p.departmentId, list)
  }

  const membersByDept = new Map<string, string[]>()
  for (const m of snapshot.memberships) {
    const list = membersByDept.get(m.departmentId) ?? []
    if (!list.includes(m.userId)) list.push(m.userId)
    membersByDept.set(m.departmentId, list)
  }

  return snapshot.departments.map((d) => {
    const areaIds = (areasByDept.get(d.id) ?? []).sort(
      (a, b) => (unidadeOrder.get(a) ?? 0) - (unidadeOrder.get(b) ?? 0),
    )
    const memberIds = membersByDept.get(d.id) ?? []
    const managers = memberIds
      .map((id) => peopleById.get(id))
      .filter((p): p is PersonRef => !!p && p.isManager)

    return {
      id: d.id,
      name: d.name,
      slug: d.slug,
      description: d.description,
      areaIds,
      placement: placementOf(areaIds.length),
      memberIds,
      memberCount: memberIds.length,
      managers,
    }
  })
}

/** Departamentos LOCAIS de uma unidade (cartões densos da coluna). */
export function localDepartmentsOf(views: DepartmentView[], areaId: string): DepartmentView[] {
  return views.filter((d) => d.placement === "local" && d.areaIds[0] === areaId)
}

/** Departamentos CORPORATIVOS que cobrem a unidade (barra inline atravessando). */
export function corporateDepartmentsOf(views: DepartmentView[], areaId: string): DepartmentView[] {
  return views.filter((d) => d.placement === "corporate" && d.areaIds.includes(areaId))
}

export function archivedDepartments(views: DepartmentView[]): DepartmentView[] {
  return views.filter((d) => d.placement === "archived")
}

/* ---------------------------- Operações (plano) --------------------------- */

/**
 * A operação é DECLARADA pelo chamador, nunca inferida da forma do payload.
 * Este é o coração do AC6: se "mover" e "expandir" fossem o mesmo endpoint
 * decidindo sozinho pelo shape dos dados, a diferença entre os dois viraria
 * julgamento implícito — e o erro seria invisível.
 */
export type PresenceOp =
  | { kind: "move"; departmentId: string; fromAreaId: string; toAreaId: string }
  | { kind: "expand"; departmentId: string; toAreaId: string }
  | { kind: "shrink"; departmentId: string; fromAreaId: string }
  | { kind: "archive"; departmentId: string }
  | { kind: "restore"; departmentId: string; toAreaId: string }

export interface PresenceMutation {
  departmentId: string
  areaId: string
}

export interface PresencePlan {
  op: PresenceOp
  /** Linhas a REMOVER de `department_areas`. */
  removePresences: PresenceMutation[]
  /** Linhas a INSERIR em `department_areas`. */
  addPresences: PresenceMutation[]
  /**
   * `user_areas.area_id` a reatribuir (SÓ acontece em `move`). `fromAreaId` vem
   * junto de propósito: a escrita vira `where user_id = X AND area_id = origem`,
   * então uma pessoa vinculada a outra unidade nunca é atingida por engano.
   */
  reassignUsers: { userId: string; fromAreaId: string; toAreaId: string }[]
  /**
   * Pessoas do departamento que NÃO acompanham a mudança de unidade porque
   * também pertencem a outro departamento que continua na unidade de origem.
   * Arrastá-las junto seria mover alguém para longe do trabalho que ela ainda
   * tem lá — corrupção silenciosa clássica.
   */
  heldBackUserIds: string[]
  placementBefore: DepartmentPlacement
  placementAfter: DepartmentPlacement
  /** `true` quando a operação deixa o departamento sem nenhuma unidade. */
  archivesDepartment: boolean
  warnings: string[]
}

export type PlanResult = { ok: true; plan: PresencePlan } | { ok: false; error: string }

function presencesOf(snapshot: DepartmentsSnapshot, departmentId: string): string[] {
  const known = new Set(snapshot.unidades.map((u) => u.id))
  return snapshot.presences
    .filter((p) => p.departmentId === departmentId && known.has(p.areaId))
    .map((p) => p.areaId)
}

function unidadeExists(snapshot: DepartmentsSnapshot, areaId: string): boolean {
  return snapshot.unidades.some((u) => u.id === areaId)
}

function departmentExists(snapshot: DepartmentsSnapshot, departmentId: string): boolean {
  return snapshot.departments.some((d) => d.id === departmentId)
}

/**
 * Quem acompanha o departamento na mudança de unidade, e quem fica.
 *
 * Acompanha: membro do departamento cuja unidade atual é a ORIGEM e que não
 * tem outro departamento ainda presente na origem.
 */
function planUserReassignment(
  snapshot: DepartmentsSnapshot,
  departmentId: string,
  fromAreaId: string,
  toAreaId: string,
): {
  reassignUsers: { userId: string; fromAreaId: string; toAreaId: string }[]
  heldBackUserIds: string[]
} {
  const memberIds = snapshot.memberships
    .filter((m) => m.departmentId === departmentId)
    .map((m) => m.userId)

  // Departamentos (outros) que continuam presentes na origem depois da operação.
  const stayingInOrigin = new Set(
    snapshot.presences
      .filter((p) => p.areaId === fromAreaId && p.departmentId !== departmentId)
      .map((p) => p.departmentId),
  )

  const reassignUsers: { userId: string; fromAreaId: string; toAreaId: string }[] = []
  const heldBackUserIds: string[] = []

  for (const userId of memberIds) {
    const person = snapshot.people.find((p) => p.id === userId)
    // Pessoa que não está na unidade de origem não é afetada por esta mudança.
    if (!person || person.areaId !== fromAreaId) continue

    const alsoElsewhere = snapshot.memberships.some(
      (m) =>
        m.userId === userId &&
        m.departmentId !== departmentId &&
        stayingInOrigin.has(m.departmentId),
    )
    if (alsoElsewhere) heldBackUserIds.push(userId)
    else reassignUsers.push({ userId, fromAreaId, toAreaId })
  }

  return { reassignUsers, heldBackUserIds }
}

/**
 * Traduz uma operação declarada em mutações concretas — sem executá-las.
 *
 * INVARIANTE PROVADA EM TESTE (AC6):
 *   • `move`   remove a presença de origem E cria a de destino (a contagem de
 *              presenças NÃO muda; o departamento troca de lugar).
 *   • `expand` SÓ cria (a origem permanece; o departamento vira corporativo).
 *   • `shrink` SÓ remove (a entidade sobrevive; a última remoção arquiva).
 * `expand` nunca produz `removePresences`. É essa assimetria que separa "trocar
 * de lugar" de "passar a estar também em outro lugar".
 */
export function planPresence(snapshot: DepartmentsSnapshot, op: PresenceOp): PlanResult {
  if (!departmentExists(snapshot, op.departmentId)) {
    return { ok: false, error: "Departamento não encontrado nesta empresa." }
  }

  const current = presencesOf(snapshot, op.departmentId)
  const placementBefore = placementOf(current.length)

  const base = {
    op,
    removePresences: [] as PresenceMutation[],
    addPresences: [] as PresenceMutation[],
    reassignUsers: [] as { userId: string; fromAreaId: string; toAreaId: string }[],
    heldBackUserIds: [] as string[],
    placementBefore,
    warnings: [] as string[],
  }

  switch (op.kind) {
    case "move": {
      if (op.fromAreaId === op.toAreaId) {
        return { ok: false, error: "A unidade de origem e a de destino são a mesma." }
      }
      if (!current.includes(op.fromAreaId)) {
        return { ok: false, error: "O departamento não está presente na unidade de origem." }
      }
      if (!unidadeExists(snapshot, op.toAreaId)) {
        return { ok: false, error: "Unidade de destino não encontrada nesta empresa." }
      }
      if (current.includes(op.toAreaId)) {
        // Mover para uma unidade onde já está seria, na prática, ENCOLHER a
        // origem. Recusamos em vez de adivinhar: o gesto errado tem de doer.
        return {
          ok: false,
          error:
            "O departamento já está presente na unidade de destino. Para deixar de estar na origem, use Encolher.",
        }
      }

      const { reassignUsers, heldBackUserIds } = planUserReassignment(
        snapshot,
        op.departmentId,
        op.fromAreaId,
        op.toAreaId,
      )
      const after = current.filter((a) => a !== op.fromAreaId).concat(op.toAreaId)
      const warnings: string[] = []
      if (heldBackUserIds.length > 0) {
        warnings.push(
          `${heldBackUserIds.length} pessoa(s) continuam na unidade de origem por pertencerem a outro departamento que fica lá.`,
        )
      }

      return {
        ok: true,
        plan: {
          ...base,
          removePresences: [{ departmentId: op.departmentId, areaId: op.fromAreaId }],
          addPresences: [{ departmentId: op.departmentId, areaId: op.toAreaId }],
          reassignUsers,
          heldBackUserIds,
          placementAfter: placementOf(after.length),
          archivesDepartment: false,
          warnings,
        },
      }
    }

    case "expand": {
      if (!unidadeExists(snapshot, op.toAreaId)) {
        return { ok: false, error: "Unidade de destino não encontrada nesta empresa." }
      }
      if (current.includes(op.toAreaId)) {
        return { ok: false, error: "O departamento já está presente nesta unidade." }
      }
      if (current.length === 0) {
        return {
          ok: false,
          error: "Departamento arquivado não expande. Restaure-o para uma unidade primeiro.",
        }
      }

      const after = current.concat(op.toAreaId)
      const warnings: string[] = []
      if (placementBefore === "local") {
        warnings.push("O departamento passa a ser corporativo (presente em mais de uma unidade).")
      }

      return {
        ok: true,
        plan: {
          ...base,
          // NENHUMA remoção. É isto que separa expandir de mover.
          addPresences: [{ departmentId: op.departmentId, areaId: op.toAreaId }],
          placementAfter: placementOf(after.length),
          archivesDepartment: false,
          warnings,
        },
      }
    }

    case "shrink": {
      if (!current.includes(op.fromAreaId)) {
        return { ok: false, error: "O departamento não está presente nesta unidade." }
      }

      const after = current.filter((a) => a !== op.fromAreaId)
      const warnings: string[] = []
      if (after.length === 1) warnings.push("O departamento deixa de ser corporativo e vira local.")
      if (after.length === 0) {
        warnings.push(
          "Era a última unidade do departamento. Ele NÃO é excluído — fica arquivado e pode ser restaurado.",
        )
      }

      return {
        ok: true,
        plan: {
          ...base,
          removePresences: [{ departmentId: op.departmentId, areaId: op.fromAreaId }],
          placementAfter: placementOf(after.length),
          archivesDepartment: after.length === 0,
          warnings,
        },
      }
    }

    case "archive": {
      if (current.length === 0) return { ok: false, error: "O departamento já está arquivado." }

      return {
        ok: true,
        plan: {
          ...base,
          removePresences: current.map((areaId) => ({ departmentId: op.departmentId, areaId })),
          placementAfter: "archived",
          archivesDepartment: true,
          warnings: [
            "O departamento sai de todas as unidades e fica arquivado. Nada é excluído: pessoas e vínculos são preservados.",
          ],
        },
      }
    }

    case "restore": {
      if (!unidadeExists(snapshot, op.toAreaId)) {
        return { ok: false, error: "Unidade de destino não encontrada nesta empresa." }
      }
      if (current.length > 0) {
        return { ok: false, error: "O departamento não está arquivado." }
      }

      return {
        ok: true,
        plan: {
          ...base,
          addPresences: [{ departmentId: op.departmentId, areaId: op.toAreaId }],
          placementAfter: "local",
          archivesDepartment: false,
          warnings: [],
        },
      }
    }
  }
}

/* --------------------- Exclusão de UNIDADE (AC7) -------------------------- */

/** Destino escolhido para cada departamento LOCAL da unidade que será excluída. */
export type LocalDepartmentDestination =
  | { departmentId: string; action: "move"; toAreaId: string }
  | { departmentId: string; action: "archive" }

export interface DeleteUnitPlan {
  areaId: string
  /** Departamentos locais e o que acontece com cada um. */
  localPlans: PresencePlan[]
  /** Corporativos que só PERDEM a presença nesta unidade (viram locais se sobrar 1). */
  corporatePlans: PresencePlan[]
  /** Pessoas cuja unidade é reatribuída junto com o departamento delas. */
  reassignUsers: { userId: string; fromAreaId: string; toAreaId: string }[]
  warnings: string[]
}

export type DeleteUnitResult =
  | { ok: true; plan: DeleteUnitPlan }
  | { ok: false; error: string /** Locais sem destino escolhido. */; pending: string[] }

/**
 * Excluir unidade é a operação composta mais perigosa da tela: ela apaga uma
 * COLUNA inteira. Por isso o plano é explícito e recusa rodar enquanto houver
 * um departamento local sem destino declarado — nunca escolhe por conta própria.
 */
export function planDeleteUnit(
  snapshot: DepartmentsSnapshot,
  areaId: string,
  destinations: LocalDepartmentDestination[],
): DeleteUnitResult {
  if (!unidadeExists(snapshot, areaId)) {
    return { ok: false, error: "Unidade não encontrada nesta empresa.", pending: [] }
  }

  const views = deriveDepartments(snapshot)
  const locals = localDepartmentsOf(views, areaId)
  const corporates = corporateDepartmentsOf(views, areaId)

  const pending = locals
    .filter((d) => !destinations.some((dest) => dest.departmentId === d.id))
    .map((d) => d.id)
  if (pending.length > 0) {
    return {
      ok: false,
      error: "Escolha o destino de cada departamento local antes de excluir a unidade.",
      pending,
    }
  }

  const localPlans: PresencePlan[] = []
  const reassignUsers: { userId: string; fromAreaId: string; toAreaId: string }[] = []
  const warnings: string[] = []

  for (const dest of destinations) {
    if (!locals.some((d) => d.id === dest.departmentId)) continue
    const op: PresenceOp =
      dest.action === "move"
        ? {
            kind: "move",
            departmentId: dest.departmentId,
            fromAreaId: areaId,
            toAreaId: dest.toAreaId,
          }
        : { kind: "archive", departmentId: dest.departmentId }

    const result = planPresence(snapshot, op)
    if (!result.ok) return { ok: false, error: result.error, pending: [] }
    localPlans.push(result.plan)
    reassignUsers.push(...result.plan.reassignUsers)
    warnings.push(...result.plan.warnings)
  }

  const corporatePlans: PresencePlan[] = []
  for (const d of corporates) {
    const result = planPresence(snapshot, {
      kind: "shrink",
      departmentId: d.id,
      fromAreaId: areaId,
    })
    if (!result.ok) return { ok: false, error: result.error, pending: [] }
    corporatePlans.push(result.plan)
    warnings.push(...result.plan.warnings)
  }

  return {
    ok: true,
    plan: { areaId, localPlans, corporatePlans, reassignUsers, warnings },
  }
}

/* ------------------------------ Busca / filtro ---------------------------- */

export type ListFilter = "todas" | "locais" | "corporativas" | "arquivadas"

export function matchesFilter(department: DepartmentView, filter: ListFilter): boolean {
  switch (filter) {
    case "locais":
      return department.placement === "local"
    case "corporativas":
      return department.placement === "corporate"
    case "arquivadas":
      return department.placement === "archived"
    default:
      return true
  }
}

/** Busca por nome do departamento OU por nome/e-mail de um gestor dele (AC8). */
export function matchesSearch(department: DepartmentView, term: string): boolean {
  const q = term.trim().toLowerCase()
  if (!q) return true
  if (department.name.toLowerCase().includes(q)) return true
  if (department.slug.toLowerCase().includes(q)) return true
  return department.managers.some(
    (m) => m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q),
  )
}

/** Sufixo "também em {outras}" das linhas corporativas da Lista (AC8). */
export function alsoInLabel(
  department: DepartmentView,
  currentAreaId: string,
  unidades: UnidadeRef[],
): string | null {
  if (department.placement !== "corporate") return null
  const others = department.areaIds
    .filter((id) => id !== currentAreaId)
    .map((id) => unidades.find((u) => u.id === id)?.name)
    .filter((n): n is string => !!n)
  if (others.length === 0) return null
  if (others.length === 1) return `também em ${others[0]}`
  return `também em ${others.slice(0, -1).join(", ")} e ${others[others.length - 1]}`
}
