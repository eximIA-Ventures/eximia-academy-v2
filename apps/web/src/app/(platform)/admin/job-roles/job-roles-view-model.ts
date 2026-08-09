/**
 * Modelo de visão da seção Cargos (CFG-3.1) — funções PURAS.
 *
 * Busca, filtros, stats e agrupamento moram aqui, fora do componente, por um
 * motivo prático: são exatamente os comportamentos que os ACs 1 a 5 descrevem,
 * e assim o gate mecânico os prova por assert direto, sem depender de render.
 * O componente só chama estas funções e desenha o resultado.
 */

import type { JobRoleWithStats } from "./types"

export const SENIORITY_LABELS: Record<string, string> = {
  junior: "Junior",
  mid: "Pleno",
  senior: "Senior",
  lead: "Lead",
  manager: "Gestor",
}

/** Ordem dos chips segmentados (AC3). */
export const SENIORITY_ORDER = ["junior", "mid", "senior", "lead", "manager"] as const

/** Chave do grupo "Sem área" — sempre o último da lista (AC1). */
export const NO_AREA_KEY = "__no_area__"
export const NO_AREA_LABEL = "Sem área"

/** Recorte rápido aplicado ao clicar num stat (AC4). */
export type QuickFilter = "none" | "no-trail" | "no-people"

export interface JobRoleFilters {
  search: string
  areaId: string
  /** `""` = todas as senioridades. */
  seniority: string
  quick: QuickFilter
}

export const EMPTY_FILTERS: JobRoleFilters = {
  search: "",
  areaId: "",
  seniority: "",
  quick: "none",
}

export function hasActiveFilters(filters: JobRoleFilters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.areaId !== "" ||
    filters.seniority !== "" ||
    filters.quick !== "none"
  )
}

function normalize(value: string): string {
  // `\p{Diacritic}` em vez da faixa `\u0300-\u036f`: mesma inten\u00e7\u00e3o, sem a
  // classe de caracteres enganosa que o linter (com raz\u00e3o) reprova.
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

/**
 * AC2 — a busca casa nome, descrição E **nome de trilha vinculada**. O caso que
 * a versão anterior não atendia: digitar "venda" e achar o cargo cuja trilha
 * chama "Técnicas de Venda", sem que a palavra apareça no cargo.
 */
export function matchesSearch(role: JobRoleWithStats, rawTerm: string): boolean {
  const term = normalize(rawTerm.trim())
  if (!term) return true

  const haystack = [role.name, role.description ?? "", ...role.trails.map((t) => t.title)]
  return haystack.some((value) => normalize(value).includes(term))
}

/** Dot de governança: sem trilha ATIVA **ou** sem ninguém no cargo (AC5). */
export function governanceWarning(role: JobRoleWithStats): string | null {
  const noTrail = role.active_trails_count === 0
  const noPeople = role.people.length === 0

  if (noTrail && noPeople) return "Sem trilha ativa e sem pessoas vinculadas"
  if (noTrail) return "Sem trilha ativa vinculada"
  if (noPeople) return "Sem pessoas com este cargo"
  return null
}

export function matchesFilters(role: JobRoleWithStats, filters: JobRoleFilters): boolean {
  if (!matchesSearch(role, filters.search)) return false

  if (filters.areaId) {
    const roleAreaKey = role.area_id ?? NO_AREA_KEY
    if (roleAreaKey !== filters.areaId) return false
  }

  if (filters.seniority && role.seniority_level !== filters.seniority) return false

  if (filters.quick === "no-trail" && role.active_trails_count > 0) return false
  if (filters.quick === "no-people" && role.people.length > 0) return false

  return true
}

export function filterRoles(
  roles: JobRoleWithStats[],
  filters: JobRoleFilters,
): JobRoleWithStats[] {
  return roles.filter((role) => matchesFilters(role, filters))
}

export interface JobRoleGroup {
  key: string
  label: string
  roles: JobRoleWithStats[]
  roleCount: number
  /** Pessoas DISTINTAS no grupo (a mesma pessoa tem um cargo só, mas a soma
   *  ingênua mentiria se isso mudasse). */
  peopleCount: number
}

/**
 * AC1 — agrupamento por área, "Sem área" SEMPRE por último, e **grupo sem
 * nenhum cargo correspondente ao filtro some da lista** (não aparece vazio).
 * Isto último é consequência de agrupar DEPOIS de filtrar: um grupo só existe
 * se tiver ao menos uma linha.
 */
export function groupRolesByArea(roles: JobRoleWithStats[]): JobRoleGroup[] {
  const groups = new Map<string, JobRoleGroup>()

  for (const role of roles) {
    const key = role.area_id ?? NO_AREA_KEY
    const label = role.area_name ?? NO_AREA_LABEL
    const group = groups.get(key) ?? { key, label, roles: [], roleCount: 0, peopleCount: 0 }
    group.roles.push(role)
    groups.set(key, group)
  }

  const list = [...groups.values()].map((group) => ({
    ...group,
    roleCount: group.roles.length,
    peopleCount: new Set(group.roles.flatMap((r) => r.people.map((p) => p.id))).size,
  }))

  return list.sort((a, b) => {
    if (a.key === NO_AREA_KEY) return 1
    if (b.key === NO_AREA_KEY) return -1
    return a.label.localeCompare(b.label)
  })
}

/** "N cargos · N pessoas" do cabeçalho do grupo (AC1). */
export function groupSummary(group: JobRoleGroup): string {
  const roles = `${group.roleCount} ${group.roleCount === 1 ? "cargo" : "cargos"}`
  const people = `${group.peopleCount} ${group.peopleCount === 1 ? "pessoa" : "pessoas"}`
  return `${roles} · ${people}`
}

export interface JobRoleStats {
  total: number
  trails: number
  withoutTrail: number
  withoutPeople: number
}

/**
 * Os números do topo, derivados da lista COMPLETA (não da filtrada) — um stat
 * que encolhesse junto com o filtro não serviria de ponto de partida para
 * filtrar.
 */
export function computeStats(roles: JobRoleWithStats[]): JobRoleStats {
  return {
    total: roles.length,
    trails: new Set(roles.flatMap((r) => r.trails.map((t) => t.id))).size,
    withoutTrail: roles.filter((r) => r.active_trails_count === 0).length,
    withoutPeople: roles.filter((r) => r.people.length === 0).length,
  }
}

/** Rótulo do chip de filtro ativo removível (AC4). */
export function activeFilterLabel(filters: JobRoleFilters, areaName?: string): string | null {
  if (filters.quick === "no-trail") return "Cargos sem trilha"
  if (filters.quick === "no-people") return "Cargos sem pessoas"
  if (filters.seniority) return `Senioridade: ${SENIORITY_LABELS[filters.seniority]}`
  if (filters.areaId) return `Área: ${areaName ?? NO_AREA_LABEL}`
  if (filters.search.trim()) return `Busca: ${filters.search.trim()}`
  return null
}

/**
 * Sugestões do drawer (AC6), derivadas do ESTADO — nada de texto genérico.
 * Tom socrático de propósito: o bloco é advisory, quem decide é quem lê.
 */
export function buildJobRoleSuggestions(
  role: JobRoleWithStats,
  allRoles: JobRoleWithStats[],
): string[] {
  const suggestions: string[] = []

  if (role.active_trails_count === 0) {
    const sameAreaTrail = allRoles
      .filter((r) => r.id !== role.id && r.area_id === role.area_id)
      .flatMap((r) => r.trails)
      .find((t) => t.status === "active")

    suggestions.push(
      sameAreaTrail
        ? `Este cargo não tem trilha ativa. "${sameAreaTrail.title}", da mesma área, faria sentido aqui?`
        : "Este cargo não tem trilha ativa. Quem assume esta função aprende o quê, e por onde?",
    )
  }

  if (role.people.length === 0) {
    suggestions.push(
      "Nenhuma pessoa tem este cargo hoje. Ele descreve uma função real ou é herança de uma estrutura antiga?",
    )
  } else if (role.active_trails_count === 0) {
    suggestions.push(
      `${role.people.length} pessoa(s) com este cargo seguem sem trilha vinculada. Vale vincular antes de cobrar progresso?`,
    )
  }

  if (!role.description?.trim()) {
    suggestions.push(
      "A descrição está vazia. Sem ela, quem chega novo depende de alguém explicar o cargo de viva voz.",
    )
  }

  return suggestions
}

/* --------------------------- Colapso persistente -------------------------- */

/**
 * AC1 — o estado de colapso persiste ENTRE NAVEGAÇÕES. `localStorage` (e não
 * `useState`, nem a URL) porque a exigência é sobreviver a sair da tela e
 * voltar, inclusive por link do menu do hub, sem sujar a query string.
 *
 * A chave é por rota-lógica, não por rota física: as duas rotas que renderizam
 * esta lista (a antiga e a do hub) compartilham a mesma preferência de leitura.
 */
export const COLLAPSE_STORAGE_KEY = "eximia:admin:job-roles:collapsed-groups"

export function readCollapsedGroups(storage?: Storage): string[] {
  const store = storage ?? (typeof window === "undefined" ? undefined : window.localStorage)
  if (!store) return []

  try {
    const raw = store.getItem(COLLAPSE_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((k): k is string => typeof k === "string")
  } catch {
    // Preferência de UI corrompida não pode derrubar a tela de cargos.
    return []
  }
}

export function writeCollapsedGroups(keys: string[], storage?: Storage): void {
  const store = storage ?? (typeof window === "undefined" ? undefined : window.localStorage)
  if (!store) return

  try {
    store.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(keys))
  } catch {
    // Modo privativo / quota estourada: a tela segue funcionando sem memória.
  }
}
