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
 *     `auth_announcements_since()` dentro da policy; a migration não o criou —
 *     criou a COLUNA `users.announcements_since` e deixou a comparação para a
 *     aplicação (`../resolve.ts` §Coorte). Por isso ela tem testes próprios
 *     abaixo: sem eles, a regra que organiza a feature inteira ("um anúncio só
 *     aparece para quem já estava aqui antes de ele começar") não teria
 *     cobertura em lugar nenhum.
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
/** Âncora de quem já estava aqui ANTES da janela: vê o anúncio. */
const ANCORA_VETERANO = "2026-06-01T00:00:00.000Z"
/** Âncora cunhada DEPOIS do início da janela: recém-chegado, não vê. */
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
    ...over,
  }
}

function tourRow(over: Row = {}): Row {
  return {
    feature_key: "jornada-builder-tour",
    kind: "product_onboarding",
    version: 1,
    priority: 50,
    help_url: "/help#jornada-construtor",
    // O CHECK `pa_window_by_kind` da migration PROÍBE janela em tour — ele
    // dispara por lugar e nunca expira.
    starts_at: null,
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
  it("onboarding inicial incompleto: null, sem consultar nada", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({ announcements: [modalRow()] })
    const result = await resolveOnboarding(db as never, {
      ...BASE_CTX,
      onboardingCompleted: false,
    })
    expect(result).toBeNull()
    expect(db.fromCalls).toEqual([])
  })

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

describe("resolveOnboarding — janela e público (delegados à RLS, ver cabeçalho)", () => {
  it("RLS já excluiu tudo (fora da janela, ou papel errado): candidatos vazios → null", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({ announcements: [] })
    const result = await resolveOnboarding(db as never, BASE_CTX)
    expect(result).toBeNull()
  })
})

describe("resolveOnboarding — coorte (regra DESTE arquivo, não da RLS)", () => {
  it("veterano (âncora anterior ao início da janela): vê o anúncio", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({
      announcements: [modalRow()],
      views: [],
      announcementsSince: ANCORA_VETERANO,
    })
    const result = await resolveOnboarding(db as never, BASE_CTX)
    expect(result?.featureKey).toBe("percorrido-vs-conclusao")
    // A coorte é lida do banco, não inferida — se a consulta sumir, os dois
    // casos abaixo deixam de suprimir e o veredito vira "todo mundo vê".
    expect(db.fromCalls).toContain("users")
  })

  it("recém-chegado (âncora posterior ao início): não vê o que nunca foi novidade para ele", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({
      announcements: [modalRow()],
      views: [],
      announcementsSince: ANCORA_RECEM_CHEGADO,
    })
    const result = await resolveOnboarding(db as never, BASE_CTX)
    expect(result).toBeNull()
  })

  it("sem âncora (conta sem evidência de atividade): tratada como recém-chegada", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({
      announcements: [modalRow()],
      views: [],
      announcementsSince: null,
    })
    const result = await resolveOnboarding(db as never, BASE_CTX)
    expect(result).toBeNull()
  })

  it("o tour ignora a coorte: sem janela, não há 'antes da janela' a comparar", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({
      announcements: [tourRow()],
      views: [],
      announcementsSince: null,
    })
    const result = await resolveOnboarding(db as never, BUILDER_CTX)
    expect(result?.featureKey).toBe("jornada-builder-tour")
    // E nem consulta a âncora — o guia do construtor não depende de coorte.
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

  it("coluna de coorte ainda inexistente: null, e na direção segura (menos exposição)", async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true)
    const db = stubSupabase({
      announcements: [modalRow()],
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
