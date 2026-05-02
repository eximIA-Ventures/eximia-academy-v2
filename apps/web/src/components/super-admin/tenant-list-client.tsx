"use client"

import { Button, Input, Select, useToast } from "@eximia/ui"
import { ArrowRight, Check, Copy, Crown, ExternalLink, Plus, Search, Shield, Star, Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

interface TenantRow {
  id: string
  name: string
  slug: string
  plan: string
  status: string
  whitelabel_enabled: boolean
  created_at: string
  user_count: number
}

interface TenantListClientProps {
  initialTenants: TenantRow[]
  initialNextCursor: string | null
}

const PLAN_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Star }> = {
  premium: { label: "Premium", color: "text-amber-400", bg: "bg-amber-500/10 ring-amber-500/20", icon: Crown },
  standard: { label: "Standard", color: "text-accent-blue-light", bg: "bg-accent-blue-mid/10 ring-accent-blue-mid/20", icon: Star },
  essencial: { label: "Essencial", color: "text-text-muted", bg: "bg-white/[0.04] ring-white/[0.06]", icon: Shield },
}

export function TenantListClient({ initialTenants, initialNextCursor }: TenantListClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [tenants, setTenants] = useState<TenantRow[]>(initialTenants)
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor)
  const [search, setSearch] = useState("")
  const [planFilter, setPlanFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function copyTenantUrl(slug: string) {
    const url = `${window.location.origin}/${slug}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedSlug(slug)
      toast({ title: "URL copiada", description: url, variant: "success" })
      setTimeout(() => setCopiedSlug(null), 2000)
    } catch {
      toast({ title: "Erro", description: "Falha ao copiar URL.", variant: "error" })
    }
  }

  function handleManage(tenant: TenantRow) {
    // Set cookie for backward compat, then navigate to path-based route
    document.cookie = `x-sa-active-tenant=${tenant.id};path=/;max-age=86400`
    router.push(`/${tenant.slug}/dashboard`)
  }

  const fetchTenants = useCallback(
    async (cursor?: string | null) => {
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setLoading(true)
      setFetchError(null)
      try {
        const params = new URLSearchParams()
        if (cursor) params.set("cursor", cursor)
        if (search) params.set("search", search)
        if (planFilter) params.set("plan", planFilter)
        if (statusFilter) params.set("status", statusFilter)
        params.set("limit", "20")

        const res = await fetch(`/api/super-admin/tenants?${params.toString()}`, { signal: controller.signal })
        if (!res.ok) { setFetchError(`Erro ao buscar empresas (${res.status})`); return }

        const json = await res.json()
        if (cursor) { setTenants((prev) => [...prev, ...json.data]) }
        else { setTenants(json.data) }
        setNextCursor(json.nextCursor)
      } catch (err) {
        if ((err as Error).name !== "AbortError") setFetchError("Erro ao buscar empresas")
      } finally {
        setLoading(false)
      }
    },
    [search, planFilter, statusFilter],
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchTenants(), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); abortRef.current?.abort() }
  }, [fetchTenants])

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
  }

  function getInitials(name: string) {
    return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/50" />
            <Input
              placeholder="Buscar empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-white/[0.03] border-white/[0.06]"
            />
          </div>
          <Select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="w-28 sm:w-36 h-10 rounded-xl bg-white/[0.03] border-white/[0.06]">
            <option value="">Plano</option>
            <option value="essencial">Essencial</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-28 sm:w-36 h-10 rounded-xl bg-white/[0.03] border-white/[0.06]">
            <option value="">Status</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </Select>
        </div>
        <Link href="/super-admin/tenants/new">
          <Button className="rounded-xl">
            <Plus size={16} className="mr-1.5" />
            Nova Empresa
          </Button>
        </Link>
      </div>

      {/* Error */}
      {fetchError && (
        <div className="rounded-xl bg-semantic-error/10 p-4 text-sm text-semantic-error ring-1 ring-semantic-error/20">
          {fetchError}
        </div>
      )}

      {/* Tenant Cards */}
      {tenants.length === 0 && !loading ? (
        <div className="py-16 text-center text-text-muted">Nenhuma empresa encontrada.</div>
      ) : (
        <div className="grid gap-3">
          {tenants.map((tenant) => {
            const plan = PLAN_CONFIG[tenant.plan] ?? PLAN_CONFIG.essencial
            const PlanIcon = plan.icon
            return (
              <div
                key={tenant.id}
                className="group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-2xl bg-bg-card/60 p-4 sm:p-5 ring-1 ring-white/[0.06] transition-all hover:ring-white/[0.12] hover:shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
              >
                {/* Avatar */}
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-blue-mid/20 to-accent-blue-deep/30 text-sm font-bold text-accent-blue-light">
                  {getInitials(tenant.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Link
                      href={`/super-admin/tenants/${tenant.id}`}
                      className="text-[15px] font-semibold text-text-primary hover:text-accent-blue-light transition-colors truncate"
                    >
                      {tenant.name}
                    </Link>
                    <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 font-mono text-2xs text-text-muted ring-1 ring-white/[0.06]">
                      /{tenant.slug}
                    </span>
                    <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold ring-1 ${plan.bg} ${plan.color}`}>
                      <PlanIcon size={10} />
                      {plan.label}
                    </div>
                    <span className="flex items-center gap-1">
                      <div className={`h-1.5 w-1.5 rounded-full ${tenant.status === "active" ? "bg-semantic-success" : "bg-text-muted/30"}`} />
                      <span className="text-2xs text-text-muted">{tenant.status === "active" ? "Ativo" : "Inativo"}</span>
                    </span>
                    {tenant.whitelabel_enabled && (
                      <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-2xs font-medium text-purple-400 ring-1 ring-purple-500/20">
                        Whitelabel
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <Users size={11} />
                      {tenant.user_count} usuário{tenant.user_count !== 1 ? "s" : ""}
                    </span>
                    <span>Criado {formatDate(tenant.created_at)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
                  <button
                    type="button"
                    onClick={() => copyTenantUrl(tenant.slug)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
                    title="Copiar URL"
                  >
                    {copiedSlug === tenant.slug ? <Check size={14} className="text-semantic-success" /> : <Copy size={14} />}
                  </button>
                  <a
                    href={`/${tenant.slug}/login`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
                    title="Abrir login em nova aba"
                  >
                    <ExternalLink size={14} />
                  </a>
                  <Link href={`/super-admin/tenants/${tenant.id}`}>
                    <Button variant="ghost" size="sm" className="text-text-muted hover:text-text-primary">
                      Detalhes
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => handleManage(tenant)}
                  >
                    Gerenciar
                    <ArrowRight size={14} className="ml-1" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Load more */}
      {nextCursor && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => fetchTenants(nextCursor)} disabled={loading} className="rounded-xl">
            {loading ? "Carregando..." : "Carregar mais"}
          </Button>
        </div>
      )}
    </div>
  )
}
