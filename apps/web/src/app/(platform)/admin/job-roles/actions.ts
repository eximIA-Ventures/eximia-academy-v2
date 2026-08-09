"use server"

import { getAuthProfile, getDbClient, resolveTenantId } from "@/lib/auth"
import { hasAnyRole } from "@/lib/role-helpers"
import { createClient } from "@/lib/supabase/server"
import { type Role, createJobRoleSchema, updateJobRoleSchema } from "@eximia/shared"
import { revalidatePath } from "next/cache"
import type { JobRolePerson, JobRoleReassignment, JobRoleWithStats, TenantTrail } from "./types"

/**
 * Chapéus que podem ESCREVER cargo. Conjunto anterior INALTERADO
 * (`manager`/`admin`/`instructor`), mais `super_admin` — a correção autorizada
 * pelo dono em 2026-07-28.
 *
 * É a MESMA lista que a rota já usava para LER (`ADMIN_ROUTE_ROLES
 * ["/admin/job-roles"]`, em `lib/admin-route-access.ts`). O defeito era
 * precisamente a assimetria: o dono do produto abria a tela, via os cargos da
 * empresa escolhida no seletor, e levava "Permissão negada" em toda escrita.
 */
const JOB_ROLE_WRITE_HATS: Role[] = ["manager", "admin", "instructor", "super_admin"]

interface JobRoleWriteContext {
  userId: string
  hats: string[]
  /** Empresa da escrita, SEMPRE resolvida — nunca `profile.tenant_id` cru. */
  tenantId: string
}

/**
 * Guard de escrita da seção Cargos — as DUAS metades da correção, juntas.
 *
 * **Metade 1, o eixo.** A checagem passa a ser sobre a UNIÃO DE CHAPÉUS
 * (`user_roles`, via `getAuthProfile().roles`) com `hasAnyRole`, e não mais
 * sobre a coluna singular `users.role`. É a regra dura 3 da doutrina de
 * workspaces, o mesmo eixo já adotado por `lib/admin-route-access.ts` (guard de
 * página) e `lib/api-auth/require-admin.ts` (guard de rota de API). O eixo
 * singular sobrevivia aqui porque a tela de cargos nunca passou por aquelas
 * rodadas; era o último ponto em que a MESMA tela abria por chapéu e gravava
 * por coluna.
 *
 * **Metade 2, a empresa.** O guard agora devolve a empresa RESOLVIDA
 * (`resolveTenantId`: tenant próprio -> cookie `x-sa-active-tenant` do seletor
 * -> primeira empresa pela ordem canônica), a mesma cascata que a LEITURA desta
 * tela já usa. Sem isso, alargar a metade 1 sozinha faria `createJobRole`
 * gravar `tenant_id: null` para o dono (perfil de tenant nulo) — um cargo órfão
 * de empresa, invisível em toda tela filtrada por empresa até doer. Quando não
 * há empresa resolvível, a operação é RECUSADA com erro claro; nunca grava nulo.
 *
 * Uma forma só de decidir, deliberadamente: NÃO existe mais nenhum caminho de
 * escrita nesta seção que consulte `profile.role` singular.
 *
 * **O que esta mudança NÃO faz:** não mexe em RLS. O banco continua decidindo
 * por `auth_user_role()` (`jr_content_role_all`) e pelo bypass de super_admin
 * (`jr_super_admin`, `20260229000000_trails_job_roles.sql:25-26`). Um perfil com
 * chapéu de escrita mas coluna singular divergente passa aqui e é recusado lá —
 * falha fechada, que é o lado certo de errar.
 */
async function requireJobRoleWriter(): Promise<JobRoleWriteContext | { error: string }> {
  const { user, profile, roles } = await getAuthProfile()

  if (!user) return { error: "Não autorizado" }
  if (!profile) return { error: "Perfil não encontrado" }
  if (!hasAnyRole({ roles }, JOB_ROLE_WRITE_HATS)) return { error: "Permissão negada" }

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) {
    return { error: "Nenhuma empresa ativa: selecione uma empresa antes de gravar" }
  }

  return { userId: user.id, hats: roles, tenantId }
}

/** Rotas que renderizam a MESMA lista (D3/D5): a antiga e a seção do hub. */
const JOB_ROLE_ROUTES = ["/admin/job-roles", "/admin/configuracoes/cargos"] as const

function revalidateJobRoleRoutes() {
  for (const route of JOB_ROLE_ROUTES) revalidatePath(route)
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

/**
 * NÃO TOCADA de propósito (auditoria, rodada 4): tem o mesmo escopo implícito
 * por RLS de `listJobRolesWithStats`, mas NENHUM consumidor — nenhuma tela do
 * hub nem a rota antiga a chamam. Confira com:
 *   grep -rn "listJobRoles\b" apps/web/src packages   -> só a própria definição.
 * Corrigir código morto na mesma rodada de uma correção de produção só alarga o
 * diff sem provar nada; quando ganhar um consumidor, ele segue o padrão acima.
 */
export async function listJobRoles() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado", data: [] }

  const { data, error } = await supabase
    .from("job_roles")
    .select("id, name, slug, description, seniority_level, area_id, created_at")
    .order("name", { ascending: true })

  if (error) return { error: "Erro ao carregar cargos", data: [] }
  return { data: data ?? [] }
}

/**
 * Cargos do tenant ATIVO, com contagem de trilhas e nome da área.
 *
 * Correção de auditoria (rodada 4), MESMO PADRÃO do beco morto já corrigido em
 * `admin/settings/loader.ts`. A leitura anterior não filtrava `tenant_id` em
 * lugar nenhum: delegava 100% do escopo ao RLS. Para quem tem tenant próprio
 * isso funciona; para o DONO DO PRODUTO (o único `super_admin` de produção, com
 * `tenant_id = NULL`) dava dois resultados errados AO MESMO TEMPO:
 *
 *   - `job_roles` tem a política de bypass `jr_super_admin`
 *     (`USING (is_super_admin())`, migration `20260229000000_trails_job_roles.sql:25-26`),
 *     então a lista vinha com os cargos de TODAS as empresas misturados,
 *     ignorando a empresa escolhida no seletor;
 *   - `areas` NÃO tem bypass de super_admin (`areas_select` é só
 *     `tenant_id = auth_tenant_id()`, `20260210000000_areas_role_unification.sql:70-71`),
 *     e `auth_tenant_id()` é NULL para ele, então o nome da área saía sempre
 *     nulo e o seletor de área do formulário vinha VAZIO.
 *
 * Agora o tenant vem de `resolveTenantId` (tenant próprio -> cookie
 * `x-sa-active-tenant` do seletor -> primeiro tenant do banco), o MESMO caminho
 * de `settings/loader.ts:82` e `areas/loader.ts:41`, e o filtro é EXPLÍCITO em
 * vez de implícito. O client vem de `getDbClient()` (service client só para
 * perfil sem tenant próprio): sob RLS puro, o filtro explícito por uma empresa
 * que o ator não "possui" volta vazio sem erro.
 *
 * Para quem tem `tenant_id` próprio — admin, manager e instructor, a esmagadora
 * maioria — o resultado é IDÊNTICO: `resolveTenantId` devolve o próprio tenant
 * sem tocar em cookie, `getDbClient()` devolve o mesmo client autenticado, e
 * `.eq("tenant_id", <próprio tenant>)` é exatamente o recorte que o RLS já
 * fazia sozinho.
 */
export async function listJobRolesWithStats() {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return { error: "Não autorizado", data: [] }

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) return { data: [] }

  const supabase = await getDbClient()

  const { data: roles, error } = await supabase
    .from("job_roles")
    .select("id, name, slug, description, seniority_level, area_id, created_at")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true })

  if (error || !roles) return { error: "Erro ao carregar cargos", data: [] }

  const roleIds = roles.map((r) => r.id)

  // Trilhas vinculadas ao cargo, POR NOME (CFG-3.1 AC2/AC5). Antes desta story a
  // tela só tinha a CONTAGEM de trilhas ativas: o nome nunca era resolvido, e a
  // busca não tinha como casar "venda" com o cargo cuja trilha é "Técnicas de
  // Venda". O filtro de `status` saiu da QUERY e virou derivação em memória
  // porque as duas coisas são precisas ao mesmo tempo: os CHIPS mostram toda
  // trilha vinculada (inclusive rascunho/arquivada, senão o vínculo some da
  // tela sem explicação) e o DOT de governança continua olhando só as ATIVAS.
  const { data: linkedTrails, error: trailsError } = await supabase
    .from("learning_trails")
    .select("id, title, status, target_job_role_id")
    .in("target_job_role_id", roleIds)

  if (trailsError) return { error: "Erro ao carregar trilhas dos cargos", data: [] }

  const trailsByRole = new Map<string, { id: string; title: string; status: string }[]>()
  for (const t of linkedTrails ?? []) {
    if (!t.target_job_role_id) continue
    const list = trailsByRole.get(t.target_job_role_id) ?? []
    list.push({ id: t.id, title: t.title, status: t.status })
    trailsByRole.set(t.target_job_role_id, list)
  }

  // Pessoas com o cargo (`users.job_role_id`, entregue em CFG-0.1). Mesmo
  // recorte de tenant da lista de cargos — o join é por id de cargo, mas o
  // filtro por empresa é EXPLÍCITO pelo mesmo motivo documentado acima.
  //
  // NÃO peça `avatar_url` aqui. A coluna é DECLARADA em
  // `packages/database/src/schema/users.ts` mas NENHUMA migration jamais a criou
  // no banco: pedi-la faz o PostgREST recusar a consulta INTEIRA com
  // `42703 column users.avatar_url does not exist`. Como o erro vinha em `error`
  // e este código só desestruturava `data`, o efeito em produção era uma lista
  // de pessoas VAZIA — indistinguível de "este cargo não tem ninguém". Decisão
  // do dono (2026-07-28): remover do código, não criar a coluna (zero fotos
  // armazenadas; a interface já cai na inicial do nome).
  const { data: people, error: peopleError } = roleIds.length
    ? await supabase
        .from("users")
        .select("id, full_name, email, job_role_id")
        .eq("tenant_id", tenantId)
        .in("job_role_id", roleIds)
    : { data: [], error: null }

  if (peopleError) return { error: "Erro ao carregar pessoas dos cargos", data: [] }

  // Área da PESSOA vem de `user_areas` (o vínculo é N:N), não de uma coluna em
  // `users` — ver `admin/users/loader.ts`, que filtra por área do mesmo jeito.
  const peopleIds = (people ?? []).map((p) => p.id)
  const { data: userAreas, error: userAreasError } = peopleIds.length
    ? await supabase.from("user_areas").select("user_id, area_id").in("user_id", peopleIds)
    : { data: [], error: null }

  if (userAreasError) return { error: "Erro ao carregar áreas das pessoas", data: [] }

  // Uma leitura só de áreas do tenant serve aos DOIS usos (nome da área do
  // cargo e área da pessoa), em vez de duas queries por lista de ids.
  const { data: areas, error: areasError } = await supabase
    .from("areas")
    .select("id, name")
    .eq("tenant_id", tenantId)

  if (areasError) return { error: "Erro ao carregar áreas", data: [] }

  const areaMap = new Map((areas ?? []).map((a) => [a.id, a.name]))

  const areaNamesByUser = new Map<string, string[]>()
  for (const ua of userAreas ?? []) {
    const name = areaMap.get(ua.area_id)
    if (!name) continue
    const list = areaNamesByUser.get(ua.user_id) ?? []
    list.push(name)
    areaNamesByUser.set(ua.user_id, list)
  }

  const peopleByRole = new Map<string, JobRolePerson[]>()
  for (const p of people ?? []) {
    if (!p.job_role_id) continue
    const list = peopleByRole.get(p.job_role_id) ?? []
    list.push({
      id: p.id,
      full_name: p.full_name ?? null,
      email: p.email,
      area_names: areaNamesByUser.get(p.id) ?? [],
    })
    peopleByRole.set(p.job_role_id, list)
  }

  const enriched: JobRoleWithStats[] = roles.map((role) => {
    const trails = (trailsByRole.get(role.id) ?? []).sort((a, b) => a.title.localeCompare(b.title))
    const rolePeople = (peopleByRole.get(role.id) ?? []).sort((a, b) =>
      (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email),
    )
    return {
      ...role,
      area_name: role.area_id ? (areaMap.get(role.area_id) ?? null) : null,
      active_trails_count: trails.filter((t) => t.status === "active").length,
      trails,
      people: rolePeople,
    }
  })

  return { data: enriched }
}

/**
 * Catálogo de trilhas da empresa ativa, para o select "+ Vincular trilha" do
 * drawer (AC6). Traz `target_job_role_id` porque o vínculo hoje é 1:1
 * (`learning_trails.target_job_role_id`): vincular uma trilha que já é de outro
 * cargo MOVE o vínculo, e a tela precisa avisar isso antes de a pessoa clicar
 * (vínculo N:N está explicitamente fora de escopo nesta story).
 */
export async function listTenantTrails() {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return { data: [] }

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) return { data: [] }

  const supabase = await getDbClient()

  const { data, error } = await supabase
    .from("learning_trails")
    .select("id, title, status, target_job_role_id")
    .eq("tenant_id", tenantId)
    .order("title", { ascending: true })

  // Erro de banco NÃO pode virar "a empresa não tem trilha nenhuma": o select
  // "+ Vincular trilha" ficaria vazio, com cara de catálogo vazio em vez de
  // leitura falha. Mesma classe de defeito que `avatar_url` produziu acima.
  if (error) return { error: "Erro ao carregar trilhas", data: [] as TenantTrail[] }

  return { data: (data ?? []) as TenantTrail[] }
}

export async function createJobRole(raw: unknown) {
  const supabase = await createClient()

  const ctx = await requireJobRoleWriter()
  if ("error" in ctx) return { error: ctx.error }

  const result = createJobRoleSchema.safeParse(raw)
  if (!result.success) return { error: result.error.errors[0].message }

  const slug = toSlug(result.data.name)

  const { data, error } = await supabase
    .from("job_roles")
    .insert({
      // Metade 2 da correção: a empresa vem do resolvedor, não de
      // `profile.tenant_id` cru. Para o dono do produto (tenant nulo) a linha
      // anterior gravava `null` — cargo órfão de empresa. `requireJobRoleWriter`
      // já recusou a operação se nenhuma empresa fosse resolvível, então aqui
      // `tenantId` é sempre uma empresa real.
      tenant_id: ctx.tenantId,
      name: result.data.name,
      slug,
      description: result.data.description ?? null,
      area_id: result.data.area_id ?? null,
      seniority_level: result.data.seniority_level,
      created_by: ctx.userId,
    })
    .select("id")
    .single()

  if (error) return { error: "Erro ao criar cargo" }

  revalidateJobRoleRoutes()
  return { data }
}

export async function updateJobRole(id: string, raw: unknown) {
  const supabase = await createClient()

  const ctx = await requireJobRoleWriter()
  if ("error" in ctx) return { error: ctx.error }

  const result = updateJobRoleSchema.safeParse(raw)
  if (!result.success) return { error: result.error.errors[0].message }

  const updateData: Record<string, unknown> = {
    ...result.data,
    updated_at: new Date().toISOString(),
  }
  if (result.data.name) {
    updateData.slug = toSlug(result.data.name)
  }

  // O `.eq("tenant_id", ...)` não é redundante com o RLS: `jr_super_admin` é um
  // bypass FOR ALL, então sem este filtro um id de OUTRA empresa seria alcançável
  // pelo dono do produto. Alargar o guard sem escopar a escrita abriria
  // exatamente esse buraco.
  const { error } = await supabase
    .from("job_roles")
    .update(updateData)
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)

  if (error) return { error: "Erro ao atualizar cargo" }

  revalidateJobRoleRoutes()
  return { success: true }
}

/**
 * Excluir cargo COM reatribuição das pessoas (CFG-3.1, AC8).
 *
 * O que muda em relação ao comportamento anterior, e o que NÃO muda:
 *
 *   - **Não muda:** trilha ATIVA vinculada continua impedindo a exclusão, com a
 *     mesma mensagem. A regra de trilha não é objeto desta story.
 *   - **Muda:** pessoas com o cargo deixam de ser um efeito colateral mudo. O
 *     `ON DELETE SET NULL` do FK (`20260229000000_trails_job_roles.sql:137`)
 *     zerava `users.job_role_id` de N pessoas sem ninguém decidir isso. Agora
 *     cada pessoa vinculada exige um destino EXPLÍCITO — outro cargo ou o
 *     "fica sem cargo" escolhido a dedo.
 *
 * A ordem dos passos é deliberada e é o que impede meio-estado destrutivo: a
 * trilha é checada ANTES de mover uma única pessoa. Um delete que vai ser
 * recusado não pode deixar gente reatribuída pelo caminho.
 */
export async function deleteJobRoleWithReassignment(
  id: string,
  reassignments: JobRoleReassignment[] = [],
) {
  const supabase = await createClient()

  const ctx = await requireJobRoleWriter()
  if ("error" in ctx) return { error: ctx.error }

  // O cargo é buscado JÁ ESCOPADO na empresa ativa: um id de outra empresa
  // simplesmente não existe daqui, e a operação para em "Cargo não encontrado"
  // antes de ler trilha ou pessoa.
  const { data: role } = await supabase
    .from("job_roles")
    .select("id, tenant_id, name")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .single()

  if (!role) return { error: "Cargo não encontrado" }

  // 1) Trilha ativa: bloqueia ANTES de tocar em qualquer pessoa.
  //
  // O `error` aqui NÃO é decoração. Sem checá-lo, uma falha de banco devolveria
  // `data: null`, a contagem cairia para 0 e o bloqueio seria PULADO — a leitura
  // quebrada autorizaria a exclusão. Erro engolido em caminho destrutivo falha
  // ABERTO, que é o pior lado para errar.
  const { data: activeTrails, error: trailsError } = await supabase
    .from("learning_trails")
    .select("id")
    .eq("target_job_role_id", id)
    .eq("status", "active")

  if (trailsError) {
    return { error: "Não foi possível verificar as trilhas do cargo. Exclusão cancelada." }
  }

  const activeTrailCount = (activeTrails ?? []).length
  if (activeTrailCount > 0) {
    return {
      error: `Nao e possivel excluir: ${activeTrailCount} trilha(s) ativa(s) vinculada(s)`,
    }
  }

  // 2) Pessoas vinculadas exigem destino explícito, uma a uma.
  //
  // Mesma armadilha do passo 1, e ainda mais grave: com `data: null` a lista de
  // pendentes viraria vazia, ninguém precisaria de destino, e o `ON DELETE SET
  // NULL` do FK deixaria N pessoas sem cargo em silêncio — exatamente o defeito
  // que o AC8 existe para matar.
  const { data: linkedPeople, error: peopleError } = await supabase
    .from("users")
    .select("id, full_name, email")
    .eq("job_role_id", id)
    .eq("tenant_id", ctx.tenantId)

  if (peopleError) {
    return { error: "Não foi possível verificar as pessoas do cargo. Exclusão cancelada." }
  }

  const pending = linkedPeople ?? []
  const chosen = new Map(reassignments.map((r) => [r.userId, r.targetJobRoleId]))
  const undecided = pending.filter((p) => !chosen.has(p.id))

  if (undecided.length > 0) {
    return {
      error: `Escolha o destino de ${undecided.length} pessoa(s) antes de excluir o cargo`,
      undecided: undecided.map((p) => p.id),
    }
  }

  // 3) Destino precisa ser um cargo REAL da mesma empresa (e não o que morre).
  const targetIds = [...new Set([...chosen.values()].filter((t): t is string => Boolean(t)))]
  if (targetIds.length > 0) {
    if (targetIds.includes(id)) return { error: "O cargo de destino não pode ser o próprio cargo" }

    const { data: targets } = await supabase
      .from("job_roles")
      .select("id, tenant_id")
      .in("id", targetIds)
      .eq("tenant_id", ctx.tenantId)

    const valid = new Set(
      (targets ?? []).filter((t) => t.tenant_id === role.tenant_id).map((t) => t.id),
    )
    if (targetIds.some((t) => !valid.has(t))) {
      return { error: "Cargo de destino inválido" }
    }
  }

  // 4) Aplica a reatribuição agrupada por destino (inclusive o "sem cargo").
  const byTarget = new Map<string | null, string[]>()
  for (const person of pending) {
    const target = chosen.get(person.id) ?? null
    const list = byTarget.get(target) ?? []
    list.push(person.id)
    byTarget.set(target, list)
  }

  for (const [target, userIds] of byTarget) {
    const { error: moveError } = await supabase
      .from("users")
      .update({ job_role_id: target, updated_at: new Date().toISOString() })
      .in("id", userIds)
      .eq("tenant_id", ctx.tenantId)

    if (moveError) return { error: "Erro ao reatribuir pessoas" }
  }

  // 5) Invariante: ninguém pode sobrar apontando para o cargo que vai sumir.
  //
  // Este é O passo que garante "ninguém fica órfão". Uma leitura falha aqui,
  // engolida, faria a checagem passar por vazio e o delete seguir — o invariante
  // viraria enfeite justamente quando mais importa. Não saber é motivo para
  // cancelar, nunca para prosseguir.
  const { data: leftovers, error: leftoversError } = await supabase
    .from("users")
    .select("id")
    .eq("job_role_id", id)
    .eq("tenant_id", ctx.tenantId)

  if (leftoversError) {
    return { error: "Não foi possível confirmar que ninguém ficou sem cargo. Exclusão cancelada." }
  }

  if ((leftovers ?? []).length > 0) {
    return {
      error: `Ainda há ${(leftovers ?? []).length} pessoa(s) com este cargo. Exclusão cancelada.`,
    }
  }

  const { error } = await supabase
    .from("job_roles")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)

  if (error) return { error: "Erro ao excluir cargo" }

  revalidateJobRoleRoutes()
  return { success: true, reassigned: pending.length }
}

/**
 * Assinatura antiga preservada (havia chamador na tela antiga). Delega para o
 * fluxo novo com zero reatribuições: sem pessoas vinculadas o resultado é
 * idêntico ao de antes; COM pessoas, deixa de apagar o vínculo por omissão e
 * passa a exigir a decisão — que é justamente o ponto do AC8.
 */
export async function deleteJobRole(id: string) {
  return deleteJobRoleWithReassignment(id, [])
}

/**
 * Mover pessoas de cargo SEM excluir nada (o "Mover pessoas de cargo…" do
 * drawer, AC6). É a mesma decisão da exclusão — destino explícito por pessoa,
 * incluindo o "fica sem cargo" — só que sem o passo destrutivo no fim.
 */
export async function reassignJobRolePeople(reassignments: JobRoleReassignment[]) {
  const supabase = await createClient()

  const ctx = await requireJobRoleWriter()
  if ("error" in ctx) return { error: ctx.error }

  if (reassignments.length === 0) return { success: true, reassigned: 0 }

  const targetIds = [...new Set(reassignments.map((r) => r.targetJobRoleId).filter(Boolean))]
  if (targetIds.length > 0) {
    const { data: targets } = await supabase
      .from("job_roles")
      .select("id")
      .in("id", targetIds as string[])
      .eq("tenant_id", ctx.tenantId)

    const valid = new Set((targets ?? []).map((t) => t.id))
    if ((targetIds as string[]).some((t) => !valid.has(t))) {
      return { error: "Cargo de destino inválido" }
    }
  }

  const byTarget = new Map<string | null, string[]>()
  for (const item of reassignments) {
    const list = byTarget.get(item.targetJobRoleId) ?? []
    list.push(item.userId)
    byTarget.set(item.targetJobRoleId, list)
  }

  for (const [target, userIds] of byTarget) {
    const { error } = await supabase
      .from("users")
      .update({ job_role_id: target, updated_at: new Date().toISOString() })
      .in("id", userIds)
      .eq("tenant_id", ctx.tenantId)

    if (error) return { error: "Erro ao reatribuir pessoas" }
  }

  revalidateJobRoleRoutes()
  return { success: true, reassigned: reassignments.length }
}

/**
 * Duplicar cargo (AC7): mesmos atributos, nome "(cópia)", SEM pessoas e SEM
 * trilhas — o vínculo de trilha é 1:1, então copiá-lo roubaria a trilha do
 * original.
 *
 * O `tenant_id` do novo cargo vem do cargo de ORIGEM, que só é alcançável
 * DENTRO da empresa ativa: a cópia nasce, por definição, na mesma empresa do
 * original, e nunca com empresa nula.
 */
export async function duplicateJobRole(id: string) {
  const supabase = await createClient()

  const ctx = await requireJobRoleWriter()
  if ("error" in ctx) return { error: ctx.error }

  const { data: source } = await supabase
    .from("job_roles")
    .select("tenant_id, name, description, area_id, seniority_level")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .single()

  if (!source) return { error: "Cargo não encontrado" }

  const name = `${source.name} (cópia)`

  const { data, error } = await supabase
    .from("job_roles")
    .insert({
      tenant_id: source.tenant_id,
      name,
      slug: toSlug(name),
      description: source.description ?? null,
      area_id: source.area_id ?? null,
      seniority_level: source.seniority_level,
      created_by: ctx.userId,
    })
    .select("id")
    .single()

  if (error) return { error: "Erro ao duplicar cargo" }

  revalidateJobRoleRoutes()
  return { data }
}

/**
 * Vincular trilha ao cargo (AC6).
 *
 * ATENÇÃO ao modelo de dados: `learning_trails.target_job_role_id` é 1:1, então
 * vincular uma trilha que já pertence a outro cargo MOVE o vínculo — não
 * adiciona. A tela avisa isso antes; aqui a operação é honesta sobre o que faz.
 */
export async function linkTrailToJobRole(trailId: string, roleId: string) {
  const supabase = await createClient()

  const ctx = await requireJobRoleWriter()
  if ("error" in ctx) return { error: ctx.error }

  // Cargo de destino precisa ser da empresa ativa — senão o vínculo cruzaria
  // empresas, que é pior do que não vincular.
  const { data: role } = await supabase
    .from("job_roles")
    .select("id")
    .eq("id", roleId)
    .eq("tenant_id", ctx.tenantId)
    .single()

  if (!role) return { error: "Cargo não encontrado" }

  const { error } = await supabase
    .from("learning_trails")
    .update({ target_job_role_id: roleId, updated_at: new Date().toISOString() })
    .eq("id", trailId)
    .eq("tenant_id", ctx.tenantId)

  if (error) return { error: "Erro ao vincular trilha" }

  revalidateJobRoleRoutes()
  return { success: true }
}

/** Desvincular trilha do cargo (o × da lista "Trilhas vinculadas", AC6). */
export async function unlinkTrailFromJobRole(trailId: string) {
  const supabase = await createClient()

  const ctx = await requireJobRoleWriter()
  if ("error" in ctx) return { error: ctx.error }

  const { error } = await supabase
    .from("learning_trails")
    .update({ target_job_role_id: null, updated_at: new Date().toISOString() })
    .eq("id", trailId)
    .eq("tenant_id", ctx.tenantId)

  if (error) return { error: "Erro ao desvincular trilha" }

  revalidateJobRoleRoutes()
  return { success: true }
}

/**
 * Áreas do tenant ATIVO, para o `select` de área do formulário de cargo.
 *
 * Mesmo defeito e mesma correção de `listJobRolesWithStats` acima: o escopo era
 * 100% implícito no RLS, e `areas_select` não tem bypass de super_admin, então
 * o dono do produto (tenant nulo) recebia SEMPRE lista vazia — o campo "Área"
 * do formulário de cargos era um `select` sem uma única opção.
 */
export async function listAreas() {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return { data: [] }

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) return { data: [] }

  const supabase = await getDbClient()

  const { data, error } = await supabase
    .from("areas")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true })

  // Sem esta checagem, uma falha de leitura devolveria um `select` de área SEM
  // NENHUMA opção, com cara de "esta empresa não tem área" — que é justamente o
  // sintoma que a correção de escopo acima foi feita para eliminar. Um erro
  // precisa parecer erro.
  if (error) return { error: "Erro ao carregar áreas", data: [] }

  return { data: data ?? [] }
}
