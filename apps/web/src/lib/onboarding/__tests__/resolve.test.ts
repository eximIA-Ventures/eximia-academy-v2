import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * `resolveOnboarding()` — story `docs/stories/
 * feat-onboarding-novidades-lancamento.md`, "Sua peça", item 1, e a migration
 * `supabase/migrations/20260803000000_onboarding_novidades.sql`.
 *
 * QUEM FILTRA O QUÊ (e por que estes testes olham só um lado de cada regra):
 *
 *   - RLS `pa_select_eligible` filtra ATIVO, JANELA de data e PÚBLICO por
 *     papel. `resolveOnboarding()` consulta com o client AUTENTICADO da
 *     sessão, então essas três já chegam aplicadas antes de qualquer linha
 *     alcançar o código. O que se testa aqui é só que este arquivo NÃO
 *     reintroduz o que a RLS excluiu: query vazia devolve `null`, nunca um
 *     fallback.
 *
 *   - COORTE é regra DESTE arquivo, e não da RLS. O contrato previa um
 *     `auth_announcements_since()` dentro da policy; ele nunca foi escrito, e
 *     a migration criou em vez disso a COLUNA `users.announcements_since` (a
 *     âncora) e `product_announcements.cohort_gated` (o interruptor), deixando
 *     a comparação inteira para a aplicação (`../resolve.ts` §Coorte).
 *
 *     A REGRA MUDOU em 2026-08-04 e os testes abaixo são o registro dela: a
 *     coorte deixou de ser obrigatória e virou OPT-IN POR ANÚNCIO, default
 *     DESLIGADO. Dentro da janela, uma feature nova é novidade para todo
 *     mundo, inclusive para quem entrou ontem. Quem impede o acúmulo de avisos
 *     antigos é a JANELA (CHECK de 35 dias), não a coorte — por isso a janela
 *     permanece inegociável e a coorte pôde ser desligada sem perder a
 *     garantia que motivou as duas.
 *
 *     Os dois blocos de coorte abaixo (desligada e ligada) existem porque um
 *     interruptor só está coberto quando as DUAS posições dele têm teste: um
 *     default silenciosamente invertido passaria por qualquer suíte que só
 *     testasse a posição ligada.
 *
 * Os nomes de coluna aqui são os da MIGRATION (`feature_key`, `kind`,
 * `starts_at`, `state`, `version`, `last_step`) — NÃO os do rascunho de
 * contrato (`id`/`key`/`trigger_route`, `announcement_id`/`view_state`), que
 * nunca chegaram a existir em SQL. Ver a §RECONCILIAÇÃO DE SCHEMA no topo de
 * `../resolve.ts`.
 *
 * E o gatilho do tour é a SUPERFÍCIE (`surface`), não a rota: `/jornada`
 * devolve o hub em 100% das entradas pela faixa, então casar por pathname
 * dispararia o guia numa tela que não tem construtor nenhum (story §2.1).
 */

const isTenantFeatureEnabledMock = vi.fn()
vi.mock("@/lib/tenant-features", () => ({
  isTenantFeatureEnabled: (...args: unknown[]) => isTenantFeatureEnabledMock(...args),
}))

import { type ResolveOnboardingContext, resolveOnboarding } from "../resolve"

type Row = Record<string, unknown>

/** Início da janela do anúncio — o `starts_at` que a RLS já usou para filtrar. */
const JANELA_INICIO = "2026-08-01T00:00:00.000Z"
/** Âncora de quem já estava aqui ANTES da janela. */
const ANCORA_VETERANO = "2026-06-01T00:00:00.000Z"
/** Âncora cunhada DEPOIS do início da janela: chegou com a janela já aberta. */
const ANCORA_RECEM_CHEGADO = "2026-08-02T00:00:00.000Z"

/**
 * Stub chainable mínimo do supabase-js, nas três consultas que
 * `resolveOnboarding()` faz de verdade:
 *
 *   1. `product_announcements`      `.select().order()` → thenable
 *   2. `product_announcement_views` `.select().eq()`    → thenable
 *   3. `users`                      `.select().eq().maybeSingle()` (a coorte)
 *
 * A terceira é a que faltava na primeira versão deste arquivo, e o modo de
 * falha merece registro porque é traiçoeiro: sem `maybeSingle`, a chamada
 * lançava `TypeError`, o `catch` de fail-open de `resolveOnboarding()`
 * engolia, e o gate devolvia `null` — indistinguível de uma supressão
 * legítima. Oito testes ficaram vermelhos e dois ficaram VERDES pelo motivo
 * errado. Por isso os ramos não modelados abaixo rejeitam em vez de devolver
 * `{ data: [], error: null }`: um stub que responde plausivelmente a uma
 * consulta que ele não entende é pior que um que falha.
 */
function stubSupabase(opts: {
  announcements?: Row[]
  announcementsError?: Row
  views?: Row[]
  viewsError?: Row
  /** `users.announcements_since`. `null` = conta sem evidência de atividade. */
  announcementsSince?: string | null
  cohortError?: Row
}) {
  const fromCalls: string[] = []
  const since = opts.announcementsSince === undefined ? ANCORA_VETERANO : opts.announcementsSince
  return {
    fromCalls,
    // biome-ignore lint/suspicious/noExplicitAny: stub mínimo de teste
    from: (table: string): any => {
      fromCalls.push(table)
      // biome-ignore lint/suspicious/noExplicitAny: chainable thenable de teste
      const builder: any = {
        select: () => builder,
        order: () => builder,
        eq: () => builder,
        maybeSingle: () => {
          if (table !== "users") {
            return Promise.reject(new Error(`stub: .maybeSingle() inesperado em "${table}"`))
          }
          return Promise.resolve({
            data: opts.cohortError ? null : { announcements_since: since },
            error: opts.cohortError ?? null,
          })
        },
        // biome-ignore lint/suspicious/noThenProperty: thenable de teste intencional (mesmo padrão de engine.test.ts)
        then: (onFulfilled: (v: { data: unknown; error: unknown }) => unknown) => {
          if (table === "product_announcements") {
            return Promise.resolve({
              data: opts.announcementsError ? null : (opts.announcements ?? []),
              error: opts.announcementsError ?? null,
            }).then(onFulfilled)
          }
          if (table === "product_announcement_views") {
            return Promise.resolve({
              data: opts.viewsError ? null : (opts.views ?? []),
              error: opts.viewsError ?? null,
            }).then(onFulfilled)
          }
          return Promise.reject(new Error(`stub: consulta não modelada em "${table}"`))
        },
      }
      return builder
    },
  }
}

const BASE_CTX: ResolveOnboardingContext = {
  userId: "user-1",
  tenantId: "tenant-1",
  // O papel entra no contexto por UM motivo: qualificar o gate de
  // `onboardingCompleted` (ver o par de testes "gate do onboarding inicial").
  // NÃO é filtro de público — quem filtra público é a RLS.
  role: "student",
  onboardingCompleted: true,
  // A superfície é o que separa anúncio de tour: "home" resolve announcement,
  // "builder" resolve product_onboarding. Sem ela, um caso de teste de modal
  // poderia passar consultando a fila do tour, e vice-versa.
  surface: "home",
  pathname: "/dashboard",
  viewAsStudent: false,
  isPreview: false,
  modalShownThisSession: false,
}

/** Contexto do construtor — o ÚNICO lugar de onde o tour pode sair. */
const BUILDER_CTX: ResolveOnboardingContext = {
  ...BASE_CTX,
  surface: "builder",
  pathname: "/jornada",
}

function modalRow(over: Row = {}): Row {
  return {
    feature_key: "percorrido-vs-conclusao",
    kind: "announcement",
    version: 1,
    priority: 10,
    help_url: "/help#percorrido-vs-conclusao",
    starts_at: JANELA_INICIO,
    // Mesmo default do banco e das 3 linhas semeadas pela migration.
    cohort_gated: false,
    ...over,
  }
}

/** Anúncio que OPTOU pela coorte — o caso "mudamos como X funciona". */
function gatedModalRow(over: Row = {}): Row {
  return modalRow({ cohort_gated: true, ...over })
}

function tourRow(over: Row = {}): Row {
  return {
    feature_key: "jornada-builder-tour",
    kind: "product_onboarding",
    version: 1,
    priority: 50,
    help_url: "/help#jornada-construtor",
    // O CHECK `pa_window_by_kind` da migration PROÍBE janela em tour — ele
    // dispara por lugar e nunca expira. E `pa_cohort_only_announcement`
    // PROÍBE coorte em tour, justamente porque sem janela não há o que
    // comparar: ligada, a comparação contra NULL não daria erro, daria um
    // tour invisível para todos.
    starts_at: null,
    cohort_gated: false,
    ...over,
  }
}

function viewRow(over: Row = {}): Row {
  return {
    feature_key: "percorrido-vs-conclusao",
    state: "seen",
    version: 1,
    last_step: null,
    ...over,
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe("resolveOnboarding — supressões que nunca tocam o banco", () => {
  it("ALUNO com onboarding inicial incompleto: null, sem consultar nada", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({ announcements: [modalRow()] })
    const result = await resolveOnboarding(db as never, {
      ...BASE_CTX,
      role: "student",
      onboardingCompleted: false,
    })
    expect(result).toBeNull()
    expect(db.fromCalls).toEqual([])
  })

  // O gate de `onboardingCompleted` espelha o redirect de
  // `(platform)/layout.tsx:266`, e AQUELE redirect é `role === "student"` e só.
  // Admin e gestor nunca são mandados ao `/onboarding`, logo `onboarding_
  // completed` nunca vira `true` para eles: um gate incondicional os suprimiria
  // PARA SEMPRE, em todo page load, sem sintoma. Medido em produção em
  // 2026-08-04: 3 contas não-aluno em 184 estão exatamente nesse estado, uma
  // delas de teste do próprio Hugo (`hugocapitelli+admin@gmail.com`).
  it.each(["admin", "manager", "super_admin"])(
    "%s com onboarding_completed=false NÃO é suprimido (ele nunca é mandado ao /onboarding)",
    async (role) => {
      isTenantFeatureEnabledMock.mockResolvedValue(true)
      const db = stubSupabase({ announcements: [modalRow()] })
      const result = await resolveOnboarding(db as never, {
        ...BASE_CTX,
        role,
        onboardingCompleted: false,
      })
      expect(result?.featureKey).toBe("percorrido-vs-conclusao")
    },
  )

  it('chapéu "ver como aluno": null, sem consultar nada (nem o kill switch)', async () => {
    const db = stubSupabase({ announcements: [modalRow()] })
    const result = await resolveOnboarding(db as never, { ...BASE_CTX, viewAsStudent: true })
    expect(result).toBeNull()
    expect(db.fromCalls).toEqual([])
    expect(isTenantFeatureEnabledMock).not.toHaveBeenCalled()
  })

  it("modo demonstração (preview): null, sem consultar nada", async () => {
    const db = stubSupabase({ announcements: [modalRow()] })
    const result = await resolveOnboarding(db as never, { ...BASE_CTX, isPreview: true })
    expect(result).toBeNull()
    expect(db.fromCalls).toEqual([])
  })

  it("sem tenantId: null, sem consultar nada", async () => {
    const db = stubSupabase({ announcements: [modalRow()] })
    const result = await resolveOnboarding(db as never, { ...BASE_CTX, tenantId: null })
    expect(result).toBeNull()
    expect(db.fromCalls).toEqual([])
  })
})

describe("resolveOnboarding — kill switch (default OFF por tenant)", () => {
  it("desligado: null, mesmo com candidato elegível no catálogo", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(false)
    const db = stubSupabase({ announcements: [modalRow()] })
    const result = await resolveOnboarding(db as never, BASE_CTX)
    expect(result).toBeNull()
    // O kill switch corta ANTES da query de candidatos — nem chega a olhar o catálogo.
    expect(db.fromCalls).not.toContain("product_announcements")
  })

  it("ligado: segue para a resolução normal", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({ announcements: [modalRow()], views: [] })
    const result = await resolveOnboarding(db as never, BASE_CTX)
    expect(result?.featureKey).toBe("percorrido-vs-conclusao")
  })
})

describe("resolveOnboarding — a JANELA é a trava inegociável (delegada à RLS)", () => {
  it("janela fechada (ou papel errado): a RLS não devolve a linha → null", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    // Janela fechada não chega aqui como linha a descartar: ela some na
    // policy `pa_select_eligible` (`starts_at <= now() AND ends_at > now()`).
    // O que este teste garante é que o código NÃO reintroduz por fallback o
    // que o banco já cortou — é a trava que sobrou depois de a coorte virar
    // opcional, e é ela que impede o acúmulo de avisos velhos.
    const db = stubSupabase({ announcements: [] })
    const result = await resolveOnboarding(db as never, BASE_CTX)
    expect(result).toBeNull()
  })

  it("janela fechada continua invisível mesmo para um veterano", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({ announcements: [], announcementsSince: ANCORA_VETERANO })
    const result = await resolveOnboarding(db as never, BASE_CTX)
    expect(result).toBeNull()
  })
})

describe("resolveOnboarding — coorte DESLIGADA (o default): quem chegou agora VÊ", () => {
  it("conta SEM âncora (nunca teve atividade registrada) vê o anúncio", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({
      announcements: [modalRow()],
      views: [],
      announcementsSince: null,
    })
    const result = await resolveOnboarding(db as never, BASE_CTX)
    // Este é o caso que motivou a mudança de regra: âncora nula era o
    // descarte mais amplo dos dois, e pegava justamente quem tem menos
    // repertório para descobrir a feature sozinho.
    expect(result?.featureKey).toBe("percorrido-vs-conclusao")
  })

  it("conta que chegou DEPOIS do starts_at vê o anúncio", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({
      announcements: [modalRow()],
      views: [],
      announcementsSince: ANCORA_RECEM_CHEGADO,
    })
    const result = await resolveOnboarding(db as never, BASE_CTX)
    expect(result?.featureKey).toBe("percorrido-vs-conclusao")
  })

  it("veterano também continua vendo (a mudança não inverteu o público)", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({
      announcements: [modalRow()],
      views: [],
      announcementsSince: ANCORA_VETERANO,
    })
    const result = await resolveOnboarding(db as never, BASE_CTX)
    expect(result?.featureKey).toBe("percorrido-vs-conclusao")
  })

  it("não gasta consulta com a âncora quando nenhum candidato pediu coorte", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({
      announcements: [modalRow(), modalRow({ feature_key: "jornada-intro", priority: 20 })],
      views: [],
    })
    await resolveOnboarding(db as never, BASE_CTX)
    // Uma ida ao banco por page load cujo resultado ninguém lê não dá
    // sintoma nenhum — some no ruído e nunca é encontrada depois.
    expect(db.fromCalls).not.toContain("users")
  })
})

describe("resolveOnboarding — coorte LIGADA (cohort_gated = true, opt-in por anúncio)", () => {
  it("veterano vê, e a âncora é de fato lida do banco", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({
      announcements: [gatedModalRow()],
      views: [],
      announcementsSince: ANCORA_VETERANO,
    })
    const result = await resolveOnboarding(db as never, BASE_CTX)
    expect(result?.featureKey).toBe("percorrido-vs-conclusao")
    // Se a consulta sumir, os dois casos abaixo deixam de suprimir e o
    // interruptor vira decoração.
    expect(db.fromCalls).toContain("users")
  })

  it("conta que chegou DEPOIS do starts_at volta a NÃO ver", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({
      announcements: [gatedModalRow()],
      views: [],
      announcementsSince: ANCORA_RECEM_CHEGADO,
    })
    const result = await resolveOnboarding(db as never, BASE_CTX)
    expect(result).toBeNull()
  })

  it("conta SEM âncora volta a NÃO ver", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({
      announcements: [gatedModalRow()],
      views: [],
      announcementsSince: null,
    })
    const result = await resolveOnboarding(db as never, BASE_CTX)
    expect(result).toBeNull()
  })

  it("um anúncio com coorte ligada não contamina o seguinte, que a deixou desligada", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({
      announcements: [
        gatedModalRow({ feature_key: "jornada-intro", priority: 5 }),
        modalRow({ priority: 10 }),
      ],
      views: [],
      announcementsSince: null,
    })
    const result = await resolveOnboarding(db as never, BASE_CTX)
    // A coorte descarta só o candidato que a pediu; a fila continua.
    expect(result?.featureKey).toBe("percorrido-vs-conclusao")
  })
})

describe("resolveOnboarding — o tour nunca foi afetado por coorte, e continua assim", () => {
  it("tour resolve para conta sem âncora nenhuma, sem consultar a âncora", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({
      announcements: [tourRow()],
      views: [],
      announcementsSince: null,
    })
    const result = await resolveOnboarding(db as never, BUILDER_CTX)
    expect(result?.featureKey).toBe("jornada-builder-tour")
    // Sem janela não há "antes da janela" a comparar — e o CHECK
    // `pa_cohort_only_announcement` impede que alguém ligue coorte num tour.
    expect(db.fromCalls).not.toContain("users")
  })
})

describe("resolveOnboarding — já viu (ausência de linha terminal)", () => {
  it('linha "seen" existente: não reaparece', async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({
      announcements: [modalRow()],
      views: [viewRow({ state: "seen" })],
    })
    const result = await resolveOnboarding(db as never, BASE_CTX)
    expect(result).toBeNull()
  })

  it('linha "completed" existente: não reaparece', async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({
      announcements: [tourRow()],
      views: [viewRow({ feature_key: "jornada-builder-tour", state: "completed" })],
    })
    const result = await resolveOnboarding(db as never, BUILDER_CTX)
    expect(result).toBeNull()
  })

  it('linha "armed" (tour não resolvido) NÃO é terminal: continua elegível', async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({
      announcements: [tourRow()],
      views: [viewRow({ feature_key: "jornada-builder-tour", state: "armed", last_step: 2 })],
    })
    const result = await resolveOnboarding(db as never, BUILDER_CTX)
    expect(result?.featureKey).toBe("jornada-builder-tour")
    // last_step retomado — quem abandonou no passo 3 não recomeça do zero.
    expect(result?.lastStep).toBe(2)
  })

  it("bump de version: view antiga não bloqueia, e o last_step dela é descartado", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({
      announcements: [modalRow({ version: 2 })],
      views: [viewRow({ state: "seen", version: 1, last_step: 4 })],
    })
    const result = await resolveOnboarding(db as never, BASE_CTX)
    expect(result?.version).toBe(2)
    // O passo 4 da v1 pode não ser o passo 4 da v2 — retomar cruzando versões
    // colocaria a pessoa no meio de um guia que ela nunca começou.
    expect(result?.lastStep).toBeNull()
  })
})

describe("resolveOnboarding — rotas silenciosas (só suprimem modal)", () => {
  it("modal suprimido em /assessments/*", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({ announcements: [modalRow()], views: [] })
    const result = await resolveOnboarding(db as never, {
      ...BASE_CTX,
      pathname: "/assessments/abc123",
    })
    expect(result).toBeNull()
  })

  it("modal suprimido em .../chapters/x/present", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({ announcements: [modalRow()], views: [] })
    const result = await resolveOnboarding(db as never, {
      ...BASE_CTX,
      pathname: "/courses/c1/chapters/ch1/present",
    })
    expect(result).toBeNull()
  })

  it("modal aparece normalmente fora de rota silenciosa", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({ announcements: [modalRow()], views: [] })
    const result = await resolveOnboarding(db as never, { ...BASE_CTX, pathname: "/dashboard" })
    expect(result?.featureKey).toBe("percorrido-vs-conclusao")
  })
})

describe("resolveOnboarding — um modal por sessão (tour não é afetado)", () => {
  it("modal suprimido quando já houve um nesta sessão", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({ announcements: [modalRow()], views: [] })
    const result = await resolveOnboarding(db as never, {
      ...BASE_CTX,
      modalShownThisSession: true,
    })
    expect(result).toBeNull()
  })

  it("tour continua elegível mesmo com modal já mostrado nesta sessão", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({ announcements: [tourRow()], views: [] })
    const result = await resolveOnboarding(db as never, {
      ...BUILDER_CTX,
      modalShownThisSession: true,
    })
    expect(result?.featureKey).toBe("jornada-builder-tour")
  })
})

describe("resolveOnboarding — a superfície é o gatilho, nunca a rota", () => {
  it("tour não resolve na home, mesmo estando em /jornada (que devolve o hub)", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({ announcements: [tourRow()], views: [] })
    const result = await resolveOnboarding(db as never, { ...BASE_CTX, pathname: "/jornada" })
    expect(result).toBeNull()
  })

  it("modal não resolve no construtor — é o que faz 'modal vence tour' sem desempate", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({ announcements: [modalRow()], views: [] })
    const result = await resolveOnboarding(db as never, BUILDER_CTX)
    expect(result).toBeNull()
  })
})

describe("resolveOnboarding — ordena por priority, LIMIT 1", () => {
  it("modal e tour no mesmo catálogo: na home só o anúncio é candidato", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    // priority 10 (modal) < priority 50 (tour) — mesmos números do catálogo
    // real (docs/architecture/onboarding-novidades-contrato-janela.md §7).
    // Mas quem separa os dois aqui NÃO é a prioridade: é a superfície, que
    // filtra por `kind` antes de qualquer ordenação. O tour nem chega a
    // disputar, e é justamente por isso que não existe regra de desempate.
    const db = stubSupabase({
      announcements: [modalRow(), tourRow()],
      views: [],
    })
    const result = await resolveOnboarding(db as never, BASE_CTX)
    expect(result?.kind).toBe("announcement")
    expect(result?.featureKey).toBe("percorrido-vs-conclusao")
  })

  it("devolve só UM artefato mesmo com múltiplos candidatos elegíveis", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    // O stub NÃO reordena (`.order()` é um no-op de teste, como em
    // dispatch-channel.test.ts): a ordem de entrada já simula o que o
    // `ORDER BY priority ASC` do banco devolveria.
    const db = stubSupabase({
      announcements: [modalRow(), modalRow({ feature_key: "jornada-intro", priority: 20 })],
      views: [],
    })
    const result = await resolveOnboarding(db as never, BASE_CTX)
    expect(result?.featureKey).toBe("percorrido-vs-conclusao")
  })
})

describe("resolveOnboarding — chave desconhecida no catálogo", () => {
  it("ignora linha com feature_key fora de FEATURE_KEYS e segue para a próxima", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({
      announcements: [
        modalRow({ feature_key: "novidade-ainda-nao-suportada", priority: 5 }),
        modalRow(),
      ],
      views: [],
    })
    const result = await resolveOnboarding(db as never, BASE_CTX)
    expect(result?.featureKey).toBe("percorrido-vs-conclusao")
  })
})

describe("resolveOnboarding — FAIL-OPEN (tabelas ainda não existem)", () => {
  it("erro de relação inexistente em product_announcements: null, nunca lança", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({
      announcementsError: {
        code: "PGRST205",
        message: "Could not find the table 'public.product_announcements'",
      },
    })
    await expect(resolveOnboarding(db as never, BASE_CTX)).resolves.toBeNull()
  })

  it("erro de relação inexistente em product_announcement_views: null, nunca lança", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({
      announcements: [modalRow()],
      viewsError: {
        code: "42P01",
        message: 'relation "product_announcement_views" does not exist',
      },
    })
    await expect(resolveOnboarding(db as never, BASE_CTX)).resolves.toBeNull()
  })

  it("âncora ilegível num anúncio que PEDIU coorte: null, na direção segura", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({
      // `gatedModalRow` de propósito: com a coorte desligada a consulta da
      // âncora nem acontece, então este erro só é alcançável no anúncio que
      // optou por ela. Quem pediu coorte e não consegue avaliá-la falha
      // fechado — mostrar a quem talvez não devesse é o erro mais caro dos
      // dois, porque não tem desfazer.
      announcements: [gatedModalRow()],
      views: [],
      cohortError: {
        code: "42703",
        message: "column users.announcements_since does not exist",
      },
    })
    await expect(resolveOnboarding(db as never, BASE_CTX)).resolves.toBeNull()
  })

  it("client que lança síncrono/assíncrono: null, nunca propaga a exceção", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const throwingDb = {
      from: () => {
        throw new Error("boom")
      },
    }
    await expect(resolveOnboarding(throwingDb as never, BASE_CTX)).resolves.toBeNull()
  })

  it("kill switch em si falhando (isTenantFeatureEnabled rejeita) não derruba a home", async () => {
    isTenantFeatureEnabledMock.mockRejectedValue(new Error("boom"))
    const db = stubSupabase({ announcements: [modalRow()] })
    await expect(resolveOnboarding(db as never, BASE_CTX)).resolves.toBeNull()
  })
})
