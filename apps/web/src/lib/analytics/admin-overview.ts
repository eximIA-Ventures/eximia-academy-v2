// ---------------------------------------------------------------------------
// admin-overview — o contrato ÚNICO da tela `/admin/visao-geral` (ADM-1/2/3)
// ---------------------------------------------------------------------------
// As três seções da tela (Visão Geral, Adoção, Saúde de Engajamento) leem UM
// agregado só, montado aqui. O núcleo org-wide (população, sessões, reflexões,
// matrículas, `last_seen_at`) NÃO é relido: ele já existe em `OrgReference` e
// chega por `getOrgReference` (memoizado por tenant, TTL 60s). Chamar
// `loadOrgReference` direto daqui derrubaria o cache e faria a tela pagar as
// varreduras org a cada request — por isso a dependência é sempre o cache.
//
// O que este módulo acrescenta ao que já existe:
//   - status de convite AGREGADO por eixo (a derivação em si é de
//     `@/lib/invites/status`, reusada, nunca recalculada aqui);
//   - `certificates` (existe no schema e nenhuma tela admin lia) como o
//     estágio "concluintes" do funil;
//   - o eixo organizacional escolhido pelo admin (unidade `areas` OU área
//     funcional `departments`) — `manager_groups` é outro eixo e fica fora.
//
// REGRA DE HONESTIDADE DO NÚMERO: nenhuma métrica composta é inventada. Não há
// "score de saúde". Todo número carrega o período em que foi medido e, no caso
// da seção 3, a comparação contra o período anterior, com a fórmula literal
// exposta no próprio dado (`formula`) para a tela poder mostrá-la.
// ---------------------------------------------------------------------------

import type { OrgReference, ServiceClient } from "@/lib/analytics/area-gestor"
import { getOrgReference } from "@/lib/analytics/org-reference-cache"
import { type UserDisplayStatus, deriveUserDisplayStatus } from "@/lib/invites/status"

const DAY_MS = 86_400_000
const PAGE_SIZE = 1000

/** Janela padrão da tela, definida em UM lugar só (critério da seção 1). */
export const ADMIN_OVERVIEW_WINDOW_DAYS = 30
/** Janela curta da seção 3 ("ativos na semana"). */
export const ADMIN_OVERVIEW_RECENT_DAYS = 7
/** Quantas semanas de retenção desde a matrícula a curva mostra. */
export const ADMIN_OVERVIEW_RETENTION_WEEKS = 8
/** Id sintético da linha "quem não está em nenhum grupo do eixo". */
export const UNASSIGNED_GROUP_ID = "__sem_atribuicao__"

export type AdoptionAxis = "area" | "department"

export const ADOPTION_AXIS_LABEL: Record<AdoptionAxis, string> = {
  area: "Unidade",
  department: "Área",
}

/* ============================== Tipos do contrato ========================== */

export interface AdminOverviewTotals {
  /** Janela usada em todo número desta seção que é "no período". */
  windowDays: number
  /** Todas as pessoas da empresa (denominador do funil da seção 2). */
  people: number
  /** População ativa de alunos — mesma definição de `OrgReference.orgStudentIds`. */
  activeStudents: number
  /** Pessoas com algum sinal de atividade dentro da janela. */
  activePeopleInWindow: number
  sessionsInWindow: number
  reflectionsInWindow: number
  activeEnrollments: number
  completedEnrollments: number
  publishedCourses: number
  chapters: number
  /** `null` quando `certificates` não pôde ser lida — "não sei" nunca vira 0. */
  certificatesInWindow: number | null
  certificatesTotal: number | null
}

export interface AdoptionRow {
  id: string
  name: string
  /** Pessoas atribuídas ao grupo (topo do funil). */
  invited: number
  /** Convite aceito / conta ativa (`deriveUserDisplayStatus === "active"`). */
  activated: number
  /** Ativadas COM atividade dentro da janela. */
  active: number
  /** Com pelo menos um certificado. `null` = `certificates` indisponível. */
  completers: number | null
  /** concluintes ÷ pessoas. `null` quando não há denominador ou não há dado. */
  conversionRate: number | null
  activationRate: number | null
  activeRate: number | null
}

export interface AdminOverviewAdoption {
  axis: AdoptionAxis
  axisLabel: string
  windowDays: number
  /** `false` quando o tenant não tem nenhum grupo cadastrado nesse eixo. */
  available: boolean
  /** Ordenadas por PIOR conversão primeiro (ver `compareAdoptionRows`). */
  rows: AdoptionRow[]
  totals: {
    invited: number
    activated: number
    active: number
    completers: number | null
  }
}

/**
 * Uma métrica de engajamento SEMPRE acompanhada do período que a produziu, do
 * período de comparação e da fórmula. É a estrutura que torna impossível pintar
 * na tela um índice agregado sem régua visível.
 */
export interface MetricWithComparison {
  key: string
  label: string
  periodLabel: string
  comparisonLabel: string
  formula: string
  current: number
  previous: number
  delta: number
  /** Variação relativa; `null` quando o período anterior é zero (sem base). */
  deltaPct: number | null
}

export interface RetentionPoint {
  /** 1 = primeira semana depois da matrícula. */
  week: number
  /** Quantas pessoas já viveram essa semana (denominador). */
  cohort: number
  retained: number
  /** `null` quando ninguém chegou nessa semana ainda. */
  rate: number | null
}

export interface CourseWithoutTraction {
  id: string
  title: string
  enrollments: number
  sessionsInWindow: number
  /** ISO do último sinal de atividade do curso, ou `null` se nunca houve. */
  lastActivityAt: string | null
}

export interface AdminOverviewEngagement {
  windowDays: number
  recentDays: number
  /** Ativos 7d e 30d, cada um contra o período imediatamente anterior. */
  activeMetrics: MetricWithComparison[]
  retention: RetentionPoint[]
  coursesWithoutTraction: CourseWithoutTraction[]
}

export interface AdminOverview {
  tenantId: string
  generatedAt: number
  totals: AdminOverviewTotals
  adoption: AdminOverviewAdoption
  engagement: AdminOverviewEngagement
}

/** Fatos de convite injetados pelo chamador (Supabase Auth). */
export type InviteFactsResolver = (
  userIds: string[],
) => Promise<Record<string, { invited_at?: string | null; confirmed_at?: string | null }>>

export interface AdminOverviewOptions {
  now?: number
  axis?: AdoptionAxis
  /**
   * Como ler `invited_at`/`confirmed_at`. Fica INJETADO porque o accessor
   * privilegiado mora na árvore da rota (`admin/users/auth-accounts.ts`) e este
   * módulo é a camada de baixo — inverter a dependência manteria o `lib` preso
   * a uma rota. Ausente ⇒ a derivação cai no par Ativo/Inativo, exatamente a
   * degradação já documentada em `invites/status.ts`.
   */
  inviteFacts?: InviteFactsResolver
}

/* ============================ Leituras tolerantes ========================== */

interface TolerantRead<T> {
  rows: T[]
  /** `false` quando a primeira página falhou (tabela ausente / RLS negando). */
  available: boolean
}

/**
 * Lê tudo paginando, mas — ao contrário do `fetchAllRows` de `area-gestor` —
 * PRESERVA a informação de que a leitura falhou. A diferença importa: para
 * `certificates`, "zero concluintes" e "não consegui ler" são afirmações
 * distintas, e a tela mostra "—" na segunda em vez de um zero mentiroso.
 */
async function readAll<T>(
  // biome-ignore lint/suspicious/noExplicitAny: query builder frouxo do supabase
  makeQuery: () => any,
): Promise<TolerantRead<T>> {
  const rows: T[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await makeQuery().range(offset, offset + PAGE_SIZE - 1)
    if (error) return { rows, available: offset > 0 }
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return { rows, available: true }
}

interface TenantUserRow {
  id: string
  status?: string | null
  role?: string | null
  last_seen_at?: string | null
}

/**
 * População da empresa. `last_seen_at` entra na MESMA projeção (mesma tolerância
 * pré-migration de `loadOrgReference`: se a coluna não existe, cai na projeção
 * enxuta e o sinal de navegação pura simplesmente não existe).
 */
async function readTenantUsers(db: ServiceClient, tenantId: string): Promise<TenantUserRow[]> {
  const enriched = await readAll<TenantUserRow>(() =>
    db.from("users").select("id, status, role, last_seen_at").eq("tenant_id", tenantId),
  )
  if (enriched.available) return enriched.rows
  const bare = await readAll<TenantUserRow>(() =>
    db.from("users").select("id, status, role").eq("tenant_id", tenantId),
  )
  return bare.rows
}

/* ============================== Índice de atividade ======================== */

function toEpoch(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Todos os carimbos de atividade por pessoa. Guardar a LISTA (e não só o
 * último) é o que permite perguntar "quem esteve ativo na janela ANTERIOR" —
 * com o último acesso apenas, quem esteve ativo nos dois períodos sumiria do
 * período antigo e a comparação ficaria sistematicamente enviesada.
 */
function buildActivityIndex(ref: OrgReference, users: TenantUserRow[]): Map<string, number[]> {
  const index = new Map<string, number[]>()
  const push = (userId: string | null | undefined, at: number | null) => {
    if (!userId || at === null) return
    const list = index.get(userId)
    if (list) list.push(at)
    else index.set(userId, [at])
  }

  for (const s of ref.orgSessionRows) {
    push(s.student_id, toEpoch(s.created_at))
    push(s.student_id, toEpoch(s.updated_at))
  }
  for (const r of ref.orgReflectionRows) {
    push(r.student_id, toEpoch(r.created_at))
    push(r.student_id, toEpoch(r.updated_at))
  }
  // Navegação pura: `last_seen_at` de QUALQUER papel (o mapa do OrgReference só
  // cobre `role='student'`, e a adoção conta a empresa inteira).
  for (const [userId, at] of ref.lastSeenByStudent) push(userId, at)
  for (const u of users) push(u.id, toEpoch(u.last_seen_at))

  return index
}

/** Pessoas com pelo menos um sinal no intervalo `[from, to)`. */
function activeBetween(index: Map<string, number[]>, from: number, to: number): Set<string> {
  const set = new Set<string>()
  for (const [userId, stamps] of index) {
    if (stamps.some((t) => t >= from && t < to)) set.add(userId)
  }
  return set
}

/* ================================ Seção 2 — eixo =========================== */

interface GroupRef {
  id: string
  name: string
}

interface MembershipRow {
  user_id: string
  group_id: string
  created_at?: string | null
}

async function readAxis(
  db: ServiceClient,
  tenantId: string,
  axis: AdoptionAxis,
): Promise<{ groups: GroupRef[]; memberships: MembershipRow[] }> {
  if (axis === "department") {
    const groups = await readAll<{ id: string; name: string }>(() =>
      db.from("departments").select("id, name").eq("tenant_id", tenantId).order("name"),
    )
    const links = await readAll<{ user_id: string; department_id: string; created_at?: string }>(
      () =>
        db
          .from("user_departments")
          .select("user_id, department_id, created_at")
          .eq("tenant_id", tenantId),
    )
    return {
      groups: groups.rows,
      memberships: links.rows.map((l) => ({
        user_id: l.user_id,
        group_id: l.department_id,
        created_at: l.created_at ?? null,
      })),
    }
  }

  const groups = await readAll<{ id: string; name: string }>(() =>
    db.from("areas").select("id, name").eq("tenant_id", tenantId).order("name"),
  )
  const groupIds = groups.rows.map((g) => g.id)
  if (groupIds.length === 0) return { groups: groups.rows, memberships: [] }
  // `user_areas` NÃO tem coluna `tenant_id` (ver schema): o recorte por empresa
  // vem do `in(...)` sobre as unidades já escopadas acima.
  const links = await readAll<{ user_id: string; area_id: string; created_at?: string }>(() =>
    db.from("user_areas").select("user_id, area_id, created_at").in("area_id", groupIds),
  )
  return {
    groups: groups.rows,
    memberships: links.rows.map((l) => ({
      user_id: l.user_id,
      group_id: l.area_id,
      created_at: l.created_at ?? null,
    })),
  }
}

/**
 * Cada pessoa entra em EXATAMENTE UMA linha do funil — senão a soma das linhas
 * não fecharia com o total da empresa (critério de saída 2) e quem pertence a
 * dois grupos inflaria o quadro. A atribuição principal é a filiação MAIS
 * ANTIGA; empate resolve pelo nome do grupo e depois pelo id, para a ordem
 * nunca depender do banco.
 */
function primaryGroupByUser(memberships: MembershipRow[], groups: GroupRef[]): Map<string, string> {
  const nameById = new Map(groups.map((g) => [g.id, g.name]))
  const best = new Map<string, MembershipRow>()
  for (const m of memberships) {
    if (!nameById.has(m.group_id)) continue
    const current = best.get(m.user_id)
    if (!current) {
      best.set(m.user_id, m)
      continue
    }
    const a = toEpoch(m.created_at) ?? Number.POSITIVE_INFINITY
    const b = toEpoch(current.created_at) ?? Number.POSITIVE_INFINITY
    if (a < b) {
      best.set(m.user_id, m)
      continue
    }
    if (a > b) continue
    const nameA = nameById.get(m.group_id) ?? ""
    const nameB = nameById.get(current.group_id) ?? ""
    const byName = nameA.localeCompare(nameB, "pt-BR")
    if (byName < 0 || (byName === 0 && m.group_id < current.group_id)) best.set(m.user_id, m)
  }
  const result = new Map<string, string>()
  for (const [userId, m] of best) result.set(userId, m.group_id)
  return result
}

/**
 * PIOR CONVERSÃO PRIMEIRO, nunca alfabético. A conversão do funil é
 * concluintes ÷ pessoas (fim sobre começo). Desempates existem para a ordem ser
 * total e determinística mesmo quando `certificates` não pôde ser lida (todas
 * as conversões `null`) — nesse caso manda a taxa de ativos.
 *
 * "Não sei" nunca é tratado como "pior": linha sem conversão apurável vai para
 * DEPOIS das que têm número, e grupo sem ninguém fica no fim de tudo.
 */
export function compareAdoptionRows(a: AdoptionRow, b: AdoptionRow): number {
  if ((a.invited === 0) !== (b.invited === 0)) return a.invited === 0 ? 1 : -1
  if (a.invited === 0) return a.name.localeCompare(b.name, "pt-BR")

  const ca = a.conversionRate
  const cb = b.conversionRate
  if (ca !== null && cb !== null && ca !== cb) return ca - cb
  if (ca !== null && cb === null) return -1
  if (ca === null && cb !== null) return 1

  const aa = a.activeRate ?? 0
  const ab = b.activeRate ?? 0
  if (aa !== ab) return aa - ab
  const ra = a.activationRate ?? 0
  const rb = b.activationRate ?? 0
  if (ra !== rb) return ra - rb
  if (a.invited !== b.invited) return b.invited - a.invited
  return a.name.localeCompare(b.name, "pt-BR")
}

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null
}

/* ================================== Carga ================================== */

export async function loadAdminOverview(
  db: ServiceClient,
  tenantId: string,
  options: AdminOverviewOptions = {},
): Promise<AdminOverview> {
  const now = options.now ?? Date.now()
  const axis: AdoptionAxis = options.axis ?? "area"

  const windowFrom = now - ADMIN_OVERVIEW_WINDOW_DAYS * DAY_MS
  const previousWindowFrom = now - 2 * ADMIN_OVERVIEW_WINDOW_DAYS * DAY_MS
  const recentFrom = now - ADMIN_OVERVIEW_RECENT_DAYS * DAY_MS
  const previousRecentFrom = now - 2 * ADMIN_OVERVIEW_RECENT_DAYS * DAY_MS

  const ref = await getOrgReference(db, tenantId, now)

  const [users, courses, certificates, axisData] = await Promise.all([
    readTenantUsers(db, tenantId),
    readAll<{ id: string; title: string | null; status: string | null }>(() =>
      db.from("courses").select("id, title, status").eq("tenant_id", tenantId),
    ),
    readAll<{ user_id: string; course_id: string; issued_at: string | null }>(() =>
      db.from("certificates").select("user_id, course_id, issued_at").eq("tenant_id", tenantId),
    ),
    readAxis(db, tenantId, axis),
  ])

  const activity = buildActivityIndex(ref, users)

  /* ------------------------------ Seção 1 -------------------------------- */

  const sessionsInWindow = ref.orgSessionRows.filter((s) => {
    const at = toEpoch(s.updated_at) ?? toEpoch(s.created_at)
    return at !== null && at >= windowFrom
  }).length
  const reflectionsInWindow = ref.orgReflectionRows.filter((r) => {
    const at = toEpoch(r.updated_at) ?? toEpoch(r.created_at)
    return at !== null && at >= windowFrom
  }).length

  const certificatesAvailable = certificates.available
  const certRows = certificates.rows
  const publishedCourses = courses.rows.filter((c) => c.status === "published")

  const activeWindowUsers = activeBetween(activity, windowFrom, now + 1)

  const totals: AdminOverviewTotals = {
    windowDays: ADMIN_OVERVIEW_WINDOW_DAYS,
    people: users.length,
    activeStudents: ref.orgStudentIds.length,
    activePeopleInWindow: activeWindowUsers.size,
    sessionsInWindow,
    reflectionsInWindow,
    activeEnrollments: ref.orgEnrollmentRows.filter((e) => e.status === "active").length,
    completedEnrollments: ref.orgEnrollmentRows.filter((e) => e.status === "completed").length,
    publishedCourses: publishedCourses.length,
    chapters: ref.tenantChapterCount,
    certificatesInWindow: certificatesAvailable
      ? certRows.filter((c) => {
          const at = toEpoch(c.issued_at)
          return at !== null && at >= windowFrom
        }).length
      : null,
    certificatesTotal: certificatesAvailable ? certRows.length : null,
  }

  /* ------------------------------ Seção 2 -------------------------------- */

  const inviteFacts = options.inviteFacts ? await options.inviteFacts(users.map((u) => u.id)) : {}

  const displayStatusByUser = new Map<string, UserDisplayStatus>()
  for (const u of users) {
    const facts = inviteFacts[u.id] ?? {}
    displayStatusByUser.set(
      u.id,
      deriveUserDisplayStatus(
        {
          status: u.status ?? "active",
          invited_at: facts.invited_at,
          confirmed_at: facts.confirmed_at,
        },
        now,
      ),
    )
  }

  const certifiedUsers = new Set(certRows.map((c) => c.user_id))
  const groupByUser = primaryGroupByUser(axisData.memberships, axisData.groups)

  const buckets = new Map<string, { name: string; users: string[] }>()
  for (const g of axisData.groups) buckets.set(g.id, { name: g.name, users: [] })
  const unassignedLabel = axis === "department" ? "Sem área" : "Sem unidade"
  buckets.set(UNASSIGNED_GROUP_ID, { name: unassignedLabel, users: [] })
  for (const u of users) {
    const groupId = groupByUser.get(u.id) ?? UNASSIGNED_GROUP_ID
    buckets.get(groupId)?.users.push(u.id)
  }

  const adoptionRows: AdoptionRow[] = []
  for (const [id, bucket] of buckets) {
    // A linha sintética só aparece quando há de fato gente fora do eixo.
    if (id === UNASSIGNED_GROUP_ID && bucket.users.length === 0) continue
    const invited = bucket.users.length
    const activatedIds = bucket.users.filter((u) => displayStatusByUser.get(u) === "active")
    const active = activatedIds.filter((u) => activeWindowUsers.has(u)).length
    const completers = certificatesAvailable
      ? bucket.users.filter((u) => certifiedUsers.has(u)).length
      : null
    adoptionRows.push({
      id,
      name: bucket.name,
      invited,
      activated: activatedIds.length,
      active,
      completers,
      conversionRate: completers === null ? null : rate(completers, invited),
      activationRate: rate(activatedIds.length, invited),
      activeRate: rate(active, invited),
    })
  }
  adoptionRows.sort(compareAdoptionRows)

  const adoption: AdminOverviewAdoption = {
    axis,
    axisLabel: ADOPTION_AXIS_LABEL[axis],
    windowDays: ADMIN_OVERVIEW_WINDOW_DAYS,
    available: axisData.groups.length > 0,
    rows: adoptionRows,
    totals: {
      invited: adoptionRows.reduce((acc, r) => acc + r.invited, 0),
      activated: adoptionRows.reduce((acc, r) => acc + r.activated, 0),
      active: adoptionRows.reduce((acc, r) => acc + r.active, 0),
      completers: certificatesAvailable
        ? adoptionRows.reduce((acc, r) => acc + (r.completers ?? 0), 0)
        : null,
    },
  }

  /* ------------------------------ Seção 3 -------------------------------- */

  const activeRecent = activeBetween(activity, recentFrom, now + 1).size
  const activeRecentPrevious = activeBetween(activity, previousRecentFrom, recentFrom).size
  const activeWindowPrevious = activeBetween(activity, previousWindowFrom, windowFrom).size

  const activeMetrics: MetricWithComparison[] = [
    makeMetric({
      key: "active-7d",
      label: `Pessoas ativas em ${ADMIN_OVERVIEW_RECENT_DAYS} dias`,
      periodLabel: `Últimos ${ADMIN_OVERVIEW_RECENT_DAYS} dias`,
      comparisonLabel: `${ADMIN_OVERVIEW_RECENT_DAYS} dias anteriores`,
      formula: "pessoas distintas com sessão, reflexão ou acesso registrado no período",
      current: activeRecent,
      previous: activeRecentPrevious,
    }),
    makeMetric({
      key: "active-30d",
      label: `Pessoas ativas em ${ADMIN_OVERVIEW_WINDOW_DAYS} dias`,
      periodLabel: `Últimos ${ADMIN_OVERVIEW_WINDOW_DAYS} dias`,
      comparisonLabel: `${ADMIN_OVERVIEW_WINDOW_DAYS} dias anteriores`,
      formula: "pessoas distintas com sessão, reflexão ou acesso registrado no período",
      current: activeWindowUsers.size,
      previous: activeWindowPrevious,
    }),
  ]

  const retention = computeRetention(ref, activity, now)

  const courseIdByChapter = new Map<string, string>()
  for (const ch of ref.chapterRows) {
    if (ch.course_id) courseIdByChapter.set(ch.id, ch.course_id)
  }
  const enrollmentsByCourse = new Map<string, number>()
  for (const e of ref.orgEnrollmentRows) {
    if (!e.course_id) continue
    enrollmentsByCourse.set(e.course_id, (enrollmentsByCourse.get(e.course_id) ?? 0) + 1)
  }
  const sessionsInWindowByCourse = new Map<string, number>()
  const lastActivityByCourse = new Map<string, number>()
  for (const s of ref.orgSessionRows) {
    const courseId = s.chapter_id ? courseIdByChapter.get(s.chapter_id) : undefined
    if (!courseId) continue
    const at = toEpoch(s.updated_at) ?? toEpoch(s.created_at)
    if (at === null) continue
    if (at >= windowFrom) {
      sessionsInWindowByCourse.set(courseId, (sessionsInWindowByCourse.get(courseId) ?? 0) + 1)
    }
    const previous = lastActivityByCourse.get(courseId)
    if (previous === undefined || at > previous) lastActivityByCourse.set(courseId, at)
  }

  const coursesWithoutTraction: CourseWithoutTraction[] = publishedCourses
    .map((c) => ({
      id: c.id,
      title: c.title ?? "(sem título)",
      enrollments: enrollmentsByCourse.get(c.id) ?? 0,
      sessionsInWindow: sessionsInWindowByCourse.get(c.id) ?? 0,
      lastActivityAt: lastActivityByCourse.has(c.id)
        ? new Date(lastActivityByCourse.get(c.id) as number).toISOString()
        : null,
    }))
    .filter((c) => c.enrollments === 0 || c.sessionsInWindow === 0)
    .sort(
      (a, b) =>
        a.enrollments - b.enrollments ||
        a.sessionsInWindow - b.sessionsInWindow ||
        a.title.localeCompare(b.title, "pt-BR"),
    )

  return {
    tenantId,
    generatedAt: now,
    totals,
    adoption,
    engagement: {
      windowDays: ADMIN_OVERVIEW_WINDOW_DAYS,
      recentDays: ADMIN_OVERVIEW_RECENT_DAYS,
      activeMetrics,
      retention,
      coursesWithoutTraction,
    },
  }
}

function makeMetric(input: {
  key: string
  label: string
  periodLabel: string
  comparisonLabel: string
  formula: string
  current: number
  previous: number
}): MetricWithComparison {
  const delta = input.current - input.previous
  return {
    ...input,
    delta,
    deltaPct: input.previous > 0 ? delta / input.previous : null,
  }
}

/**
 * Retenção por semana DESDE A MATRÍCULA (coorte relativa, não calendário): a
 * semana 1 de cada pessoa começa na primeira matrícula dela. Só entra no
 * denominador quem já viveu aquela semana inteira — senão a curva despencaria
 * artificialmente no fim só porque a coorte recente ainda não teve tempo.
 */
function computeRetention(
  ref: OrgReference,
  activity: Map<string, number[]>,
  now: number,
): RetentionPoint[] {
  const firstEnrollment = new Map<string, number>()
  for (const e of ref.orgEnrollmentRows) {
    const at = toEpoch(e.created_at)
    if (at === null) continue
    const previous = firstEnrollment.get(e.student_id)
    if (previous === undefined || at < previous) firstEnrollment.set(e.student_id, at)
  }

  const points: RetentionPoint[] = []
  for (let week = 1; week <= ADMIN_OVERVIEW_RETENTION_WEEKS; week++) {
    let cohort = 0
    let retained = 0
    for (const [studentId, start] of firstEnrollment) {
      const weekStart = start + (week - 1) * 7 * DAY_MS
      const weekEnd = start + week * 7 * DAY_MS
      if (weekEnd > now) continue
      cohort++
      const stamps = activity.get(studentId)
      if (stamps?.some((t) => t >= weekStart && t < weekEnd)) retained++
    }
    points.push({ week, cohort, retained, rate: rate(retained, cohort) })
  }
  return points
}
