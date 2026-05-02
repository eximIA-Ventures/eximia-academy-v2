"use client"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@eximia/ui"
import { ChevronDown, ChevronRight, Filter, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

/* --------------------------------- Types --------------------------------- */

interface AuditEntry {
  id: string
  actor_id: string
  actor_name: string
  action: string
  target_type: string
  target_id: string
  target_name: string
  details: Record<string, unknown>
  created_at: string
}

interface AuditResponse {
  data: AuditEntry[]
  nextCursor: string | null
}

/* ------------------------------- Constants ------------------------------- */

const PAGE_SIZE = 50

const ACTION_OPTIONS = [
  { value: "created", label: "Criado" },
  { value: "updated", label: "Atualizado" },
  { value: "deactivated", label: "Desativado" },
  { value: "toggled", label: "Alternado" },
  { value: "switched", label: "Trocado" },
]

const TARGET_TYPE_OPTIONS = [
  { value: "", label: "Todos os Tipos" },
  { value: "tenant", label: "Empresa" },
  { value: "user", label: "Usuário" },
  { value: "course", label: "Curso" },
  { value: "session", label: "Sessão" },
  { value: "settings", label: "Configurações" },
]

type ActionBadgeVariant = "success" | "info" | "error" | "warning" | "default"

const ACTION_BADGE_MAP: Record<string, { variant: ActionBadgeVariant; label: string }> = {
  created: { variant: "success", label: "Criado" },
  updated: { variant: "info", label: "Atualizado" },
  deactivated: { variant: "error", label: "Desativado" },
  toggled: { variant: "warning", label: "Alternado" },
  switched: { variant: "default", label: "Trocado" },
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  tenant: "Empresa",
  user: "Usuário",
  course: "Curso",
  session: "Sessão",
  settings: "Configurações",
}

/* ------------------------------- Component ------------------------------- */

export function AuditLogClient() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // Filters
  const [selectedActions, setSelectedActions] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [targetType, setTargetType] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const buildUrl = useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams()
      if (cursor) params.set("cursor", cursor)
      if (selectedActions.length > 0) params.set("action", selectedActions.join(","))
      if (dateFrom) params.set("from", dateFrom)
      if (dateTo) params.set("to", dateTo)
      if (targetType) params.set("target_type", targetType)
      return `/api/super-admin/audit?${params.toString()}`
    },
    [selectedActions, dateFrom, dateTo, targetType],
  )

  const fetchEntries = useCallback(async () => {
    // Cancel previous in-flight request
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(buildUrl(), { signal: controller.signal })
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
      const json: AuditResponse = await res.json()
      setEntries(json.data)
      setNextCursor(json.nextCursor)
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Failed to fetch audit log:", error)
        setFetchError((error as Error).message || "Erro ao carregar log de auditoria")
      }
    } finally {
      setLoading(false)
    }
  }, [buildUrl])

  const fetchMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const res = await fetch(buildUrl(nextCursor))
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
      const json: AuditResponse = await res.json()
      setEntries((prev) => [...prev, ...json.data])
      setNextCursor(json.nextCursor)
    } catch (error) {
      console.error("Failed to fetch more audit entries:", error)
    } finally {
      setLoadingMore(false)
    }
  }, [nextCursor, loadingMore, buildUrl])

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchEntries()
    return () => { abortRef.current?.abort() }
  }, [fetchEntries])

  const toggleAction = (action: string) => {
    setSelectedActions((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action],
    )
  }

  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  const toggleExpand = (id: string) => {
    setExpandedRow((prev) => (prev === id ? null : id))
  }

  const renderDetails = (details: Record<string, unknown>) => {
    const detailEntries = Object.entries(details)
    if (detailEntries.length === 0) {
      return <span className="text-text-muted">Sem detalhes</span>
    }
    return (
      <div className="space-y-1">
        {detailEntries.map(([key, value]) => (
          <div key={key} className="flex gap-2 text-sm">
            <span className="font-medium text-text-secondary">{key}:</span>
            <span className="text-text-primary">
              {typeof value === "object" ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Log de Auditoria</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowFilters((prev) => !prev)}>
              <Filter size={16} />
              Filtros
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchEntries} disabled={loading} aria-label="Atualizar">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mt-4 space-y-4 rounded-lg border border-border-medium bg-bg-surface p-4">
            {/* Action multi-select */}
            <div>
              <label htmlFor="audit-action-filter" className="mb-2 block text-sm font-medium text-text-secondary">Acao</label>
              <div className="flex flex-wrap gap-2">
                {ACTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleAction(opt.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      selectedActions.includes(opt.value)
                        ? "bg-accent-blue-mid text-white"
                        : "bg-white/10 text-text-secondary hover:bg-white/20"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date range */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label htmlFor="audit-date-from" className="mb-1 block text-sm font-medium text-text-secondary">
                  Data Inicio
                </label>
                <Input
                  id="audit-date-from"
                  type="date"
                  inputSize="sm"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label htmlFor="audit-date-to" className="mb-1 block text-sm font-medium text-text-secondary">
                  Data Fim
                </label>
                <Input
                  id="audit-date-to"
                  type="date"
                  inputSize="sm"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            {/* Target type */}
            <div>
              <label htmlFor="audit-target-type" className="mb-1 block text-sm font-medium text-text-secondary">
                Tipo de Alvo
              </label>
              <div className="w-48">
                <Select
                  id="audit-target-type"
                  selectSize="sm"
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value)}
                  aria-label="Filtrar por tipo de alvo"
                >
                  {TARGET_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {/* Error state */}
        {fetchError && !loading && (
          <div className="py-8 text-center">
            <p className="text-sm text-semantic-error">{fetchError}</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={fetchEntries}>
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={`skeleton-${i}`} className="flex gap-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center text-text-muted">Nenhum registro encontrado.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Data</TableHead>
                    <TableHead>Acao</TableHead>
                    <TableHead>Tipo Alvo</TableHead>
                    <TableHead>Nome Alvo</TableHead>
                    <TableHead>Ator</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const isExpanded = expandedRow === entry.id
                    const badge = ACTION_BADGE_MAP[entry.action] ?? {
                      variant: "default" as ActionBadgeVariant,
                      label: entry.action,
                    }

                    return (
                      <RowGroup key={entry.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-white/5 transition-colors"
                          onClick={() => toggleExpand(entry.id)}
                          tabIndex={0}
                          role="button"
                          aria-expanded={isExpanded}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              toggleExpand(entry.id)
                            }
                          }}
                        >
                          <TableCell className="w-8">
                            {isExpanded ? (
                              <ChevronDown size={14} className="text-text-muted" />
                            ) : (
                              <ChevronRight size={14} className="text-text-muted" />
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-text-secondary">
                            {formatDate(entry.created_at)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={badge.variant} badgeSize="sm">
                              {badge.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-text-secondary">
                            {TARGET_TYPE_LABELS[entry.target_type] ?? entry.target_type}
                          </TableCell>
                          <TableCell className="text-sm text-text-primary font-medium">
                            {entry.target_name}
                          </TableCell>
                          <TableCell className="text-sm text-text-secondary">
                            {entry.actor_name}
                          </TableCell>
                        </TableRow>

                        {/* Expandable details row */}
                        {isExpanded && (
                          <TableRow>
                            <TableCell />
                            <TableCell colSpan={5}>
                              <div className="rounded-md border border-border-medium bg-bg-surface p-4">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                                  Detalhes
                                </p>
                                {renderDetails(entry.details as Record<string, unknown>)}
                                <div className="mt-3 flex gap-4 border-t border-border-medium pt-3 text-xs text-text-muted">
                                  <span>ID: {entry.id}</span>
                                  <span>Ator ID: {entry.actor_id}</span>
                                  <span>Alvo ID: {entry.target_id}</span>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </RowGroup>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {nextCursor && (
              <div className="mt-4 flex justify-center">
                <Button variant="outline" size="sm" onClick={fetchMore} disabled={loadingMore}>
                  {loadingMore ? "Carregando..." : "Carregar Mais"}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/* Helper wrapper for grouping table rows (expand/collapse) */
function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
