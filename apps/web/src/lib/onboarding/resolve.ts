// ---------------------------------------------------------------------------
// Onboarding de novidades — gate server-side (story
// `docs/stories/feat-onboarding-novidades-lancamento.md`, Fase 3).
//
// `resolveOnboarding()` é o ÚNICO lugar que decide "existe algo pendente
// para esta pessoa, agora, aqui?" — devolve no máximo UM `PendingArtifact`
// (ou `null`). Toda regra aqui é aditiva: uma regra a mais só pode SUPRIMIR,
// nunca fazer aparecer algo que outra regra já vetou.
//
// -------------------------------------------------------------------------
// RECONCILIAÇÃO DE SCHEMA (integração, 2026-08-03)
// -------------------------------------------------------------------------
// Este arquivo nasceu contra o DDL rascunhado no contrato de arquitetura
// (`product_announcements.id/key/trigger_route`, views chaveadas por
// `announcement_id + announcement_version + view_state`). A migration que de
// fato foi escrita — `supabase/migrations/20260803000000_onboarding_novidades.sql`,
// a ÚNICA SQL concreta que existe — modela outra coisa, e por motivos
// documentados linha a linha lá (§1.3 da story):
//
//   product_announcements       PK `feature_key`, sem `id`, sem `trigger_route`
//   product_announcement_views  PK `(user_id, feature_key)`, coluna `state`,
//                               `version` FORA da chave, sem `tenant_id`
//
// A migration vence, porque é o schema que vai existir. As consultas abaixo
// falam com ELE.
//
// O QUE A RLS DA MIGRATION JÁ FILTRA (policy `pa_select_eligible`) e por isso
// NÃO é reimplementado aqui:
//   - ativo (`is_active = true`)
//   - JANELA de data (`announcement` → `starts_at <= now() < ends_at`;
//     `product_onboarding` é sempre elegível por data, o CHECK
//     `pa_window_by_kind` proíbe janela nele)
//   - PÚBLICO por papel (`auth_user_role() = ANY (audience_roles)`)
//
// O QUE A RLS **NÃO** FILTRA, e por isso é regra deste arquivo:
//   - COORTE. O contrato previa um `auth_announcements_since()` dentro da
//     policy; a migration não o criou — ela criou a COLUNA
//     `users.announcements_since` e deixou a comparação para a aplicação.
//     Sem o filtro aqui, a regra que organiza a feature inteira ("um anúncio
//     só aparece para quem já estava na plataforma antes de ele começar")
//     simplesmente não existiria em lugar nenhum. Ver §Coorte abaixo.
//   - LUGAR do tour. `trigger_route` não existe na migration, e ainda bem:
//     amarrar o tour a uma rota seria amarrá-lo a `/jornada`, que devolve o
//     HUB em 100% das entradas pela faixa (story §0.2, medido). O gatilho é o
//     MOUNT do construtor, expresso aqui pelo campo `surface`.
//
// FAIL-OPEN é requisito duro: as tabelas ainda NÃO existem neste banco — a
// migration sobe depois, isolada, com GO do Hugo. Qualquer erro de leitura
// aqui degrada para `null`, nunca lança. Mesmo padrão de
// `lib/journey/journey-plan-data.ts` (`fetchJourneyState`): a home não pode
// quebrar por causa de uma feature opcional que ainda nem foi ligada.
// ---------------------------------------------------------------------------

import type { createClient } from "@/lib/supabase/server"
import { isTenantFeatureEnabled } from "@/lib/tenant-features"
import {
  type AnnouncementKind,
  FEATURE_KEYS,
  type FeatureKey,
  KILL_SWITCH_KEY,
  type PendingArtifact,
  isSilentRoute,
} from "./types"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Estados terminais de `product_announcement_views` (contrato `ViewState`
 * em `./types.ts`). `armed` é o ÚNICO estado NÃO terminal — é o que faz o
 * tour esperar o mount do construtor em vez de se dar por resolvido no
 * instante em que a novidade 2 o arma (story §2.1).
 */
const TERMINAL_VIEW_STATES = new Set<string>(["seen", "skipped", "completed"])

interface AnnouncementRow {
  feature_key: string
  kind: AnnouncementKind
  version: number
  priority: number
  help_url: string
  starts_at: string | null
}

interface ViewRow {
  feature_key: string
  state: string | null
  version: number | null
  last_step: number | null
}

/**
 * Onde a resolução está sendo pedida. É o gatilho por LUGAR da story §2.1,
 * não uma rota: `/jornada` devolve o hub em 100% das entradas pela faixa, e
 * o construtor pode montar sem a URL mudar (transição local do
 * `JourneyShell`). Só o mount do componente sabe a verdade.
 */
export type OnboardingSurface = "home" | "builder"

export interface ResolveOnboardingContext {
  userId: string
  /** Sem tenant não há kill switch coerente para ler nem RLS de tenant
   *  aplicável — trata como "nada pendente", nunca como erro. */
  tenantId: string | null
  /** `(platform)/layout.tsx:266` redireciona quem não completou para
   *  `/onboarding`. Sem este gate aqui, a pessoa tomaria dois onboardings em
   *  sequência assim que completasse o primeiro (story §Fase 3). */
  onboardingCompleted: boolean
  /** `"home"` só resolve modal; `"builder"` só resolve tour. É também o que
   *  implementa "modal vence tour" sem precisar de desempate: os dois nunca
   *  disputam a mesma tela. */
  surface: OnboardingSurface
  /** Rota atual, usada SOMENTE pelas rotas silenciosas (story §Fase 3). O
   *  tour não a consulta — ver §RECONCILIAÇÃO acima. */
  pathname: string
  /** Chapéu "ver como aluno" (cookie `x-view-as-student`, ver
   *  `(platform)/layout.tsx`). Suprime por completo — nem consulta o banco.
   *  Gravar em nome de outra pessoa queimaria o artefato dela sem que ela
   *  tenha visto nada (story §Fase 3, "cinco tabelas com bugs de chapéu"). */
  viewAsStudent: boolean
  /** Modo demonstração (`PREVIEW_PARAM` em `./types.ts`). Mesma supressão
   *  total do chapéu de gestor — quem revisa não pode queimar a própria
   *  exibição real nem poluir a métrica de cobertura. E, crucialmente, é o
   *  que faz o modo demonstração funcionar com as tabelas inexistentes: ele
   *  sai daqui antes de qualquer query. */
  isPreview: boolean
  /**
   * Já houve um modal (`kind='announcement'`) exibido nesta sessão de
   * navegador? Resolvido pelo CHAMADOR a partir de um sinal de sessão (cookie
   * sem `maxAge`) — este módulo permanece puro e testável sem `next/headers`.
   * Quando `true`, candidatos de anúncio são suprimidos; o tour (disparado
   * por LUGAR, nunca por sessão, story §2.1) não é afetado.
   */
  modalShownThisSession: boolean
}

function toFeatureKey(rawKey: string): FeatureKey | null {
  return (Object.values(FEATURE_KEYS) as string[]).includes(rawKey) ? (rawKey as FeatureKey) : null
}

function logGateError(scope: string, error: unknown): void {
  const e = (error ?? {}) as { code?: unknown; message?: unknown }
  const code = typeof e.code === "string" ? e.code : undefined
  const message = typeof e.message === "string" ? e.message : String(error)
  console.error(`[onboarding:${scope}] infra error${code ? ` (${code})` : ""}: ${message}`)
}

/**
 * §Coorte — a âncora de quem "já estava aqui".
 *
 * `null` significa recém-chegado (nenhuma evidência de atividade anterior ao
 * lançamento) e SUPRIME todo anúncio: quem chegou depois não recebe o aviso
 * de uma novidade que, para ele, nunca foi novidade. Erro de leitura cai no
 * mesmo `null` — a direção segura aqui é menos exposição, nunca mais.
 */
async function fetchAnnouncementsSince(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<Date | null> {
  const { data, error } = await supabase
    .from("users")
    .select("announcements_since")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    logGateError("cohort", error)
    return null
  }
  const raw = (data as { announcements_since?: string | null } | null)?.announcements_since
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Resolve o artefato pendente para esta pessoa, agora. Devolve `null` em
 * qualquer situação de supressão (regra de produto) OU de infraestrutura
 * ausente/com erro (fail-open) — os dois casos são indistinguíveis de
 * propósito para quem chama: "nada a mostrar" é sempre um resultado seguro,
 * nunca uma exceção que derruba a página.
 */
export async function resolveOnboarding(
  supabase: SupabaseServerClient,
  ctx: ResolveOnboardingContext,
): Promise<PendingArtifact | null> {
  if (!ctx.onboardingCompleted) return null
  if (ctx.viewAsStudent) return null
  if (ctx.isPreview) return null
  if (!ctx.tenantId) return null
  // Rota silenciosa suprime MODAL, e a superfície "home" só resolve modal —
  // logo, aqui a checagem corta a superfície inteira, sem tocar o banco.
  if (ctx.surface === "home" && isSilentRoute(ctx.pathname)) return null
  if (ctx.surface === "home" && ctx.modalShownThisSession) return null

  try {
    const enabled = await isTenantFeatureEnabled(supabase, ctx.tenantId, KILL_SWITCH_KEY)
    if (!enabled) return null

    // Busca TODOS os candidatos elegíveis (a RLS já aplicou ativo, janela e
    // público) — de propósito SEM `.limit()` aqui: o "já viu", a coorte e a
    // superfície ainda vão descartar candidatos, e um LIMIT prematuro poderia
    // trazer só uma linha já terminal enquanto a próxima elegível de verdade
    // fica de fora.
    const { data: candidates, error: candidatesError } = await supabase
      .from("product_announcements")
      .select("feature_key, kind, version, priority, help_url, starts_at")
      .order("priority", { ascending: true })

    if (candidatesError) {
      logGateError("candidates", candidatesError)
      return null
    }
    const wantedKind: AnnouncementKind =
      ctx.surface === "home" ? "announcement" : "product_onboarding"
    const rows = ((candidates ?? []) as AnnouncementRow[]).filter((r) => r.kind === wantedKind)
    if (rows.length === 0) return null

    const { data: views, error: viewsError } = await supabase
      .from("product_announcement_views")
      .select("feature_key, state, version, last_step")
      .eq("user_id", ctx.userId)

    if (viewsError) {
      // Sem saber o que já foi visto, a direção segura é NÃO exibir — nunca
      // reexibir algo que talvez já tenha sido resolvido. Dado ruim resulta
      // em MENOS exposição, nunca em mais.
      logGateError("views", viewsError)
      return null
    }
    const viewByKey = new Map(((views ?? []) as ViewRow[]).map((v) => [v.feature_key, v]))

    // Coorte só é lida quando existe candidato de anúncio — o tour não tem
    // janela, então não tem "antes da janela" a comparar (story §2.1).
    const announcementsSince =
      wantedKind === "announcement" ? await fetchAnnouncementsSince(supabase, ctx.userId) : null

    for (const row of rows) {
      const view = viewByKey.get(row.feature_key)
      // `version` está FORA da chave da view (migration §1.3): a MESMA linha
      // acompanha a pessoa entre versões. Uma view de versão anterior não
      // bloqueia a atual — é assim que "reabre com bump de versão" funciona
      // sem deixar linha órfã para trás.
      const viewIsCurrent = (view?.version ?? 0) >= row.version
      if (viewIsCurrent && view?.state != null && TERMINAL_VIEW_STATES.has(view.state)) continue

      if (row.kind === "announcement") {
        // §Coorte: só quem estava aqui ANTES do início da janela.
        if (!announcementsSince) continue
        if (!row.starts_at) continue
        const startsAt = new Date(row.starts_at)
        if (Number.isNaN(startsAt.getTime())) continue
        if (announcementsSince >= startsAt) continue
      }

      const featureKey = toFeatureKey(row.feature_key)
      // Chave fora do catálogo conhecido (ex.: novidade cadastrada antes do
      // deploy do código que a entende) — nunca quebra, só ignora essa linha
      // e segue para a próxima candidata.
      if (!featureKey) continue

      // "Ordena por priority, LIMIT 1": a ordenação veio da query, e o
      // primeiro candidato que sobrevive a todas as regras acima é o único
      // devolvido — o equivalente em JS de um `LIMIT 1` pós-filtro.
      return {
        featureKey,
        kind: row.kind,
        version: row.version,
        priority: row.priority,
        helpUrl: row.help_url,
        // `last_step` de uma versão antiga é lixo: o passo 4 do tour v1 pode
        // não ser o passo 4 do v2. Retoma só dentro da mesma versão.
        lastStep: viewIsCurrent ? (view?.last_step ?? null) : null,
      }
    }

    return null
  } catch (e) {
    logGateError("throw", e)
    return null
  }
}
