// @vitest-environment node
//
// AC2 + AC5 da story 28.2 (`docs/stories/epic-28/story-28.2-feature-gate-middleware.md`):
//   AC2: "Helper `requireFeature(featureKey)` para API routes — retorna 403 se bloqueado"
//   AC5: "Response 403 inclui: { error, feature, current_plan, required_plan }"
//
// Este arquivo nasce VERMELHO de propósito: `requireFeature` não existe entre os
// exports de `lib/feature-gate.ts` (só `requireFeatureAction`, que lança em vez de
// responder e serve a server actions, não a rotas). O 403 prometido pela AC2 nunca
// foi escrito, e o teste é a prova disso antes de haver correção.
//
// `@vitest-environment node` é obrigatório aqui: o default do projeto é jsdom, e
// `NextResponse` estende o `Response` da plataforma. O ambiente node é o que dá a
// mesma classe que a rota real usa em produção.
//
// PAR DISCRIMINANTE (o que impede o teste de ser tautológico): cada bloqueio tem
// ao lado o caso liberado do MESMO featureKey em outro plano, exigindo `null`. Uma
// implementação "responde 403 sempre" satisfaz metade dos casos e reprova na outra.

import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Fixture — cópia fiel do seed de `supabase/migrations/20260229100000_plan_features.sql`
// ---------------------------------------------------------------------------
interface PlanFeatureRow {
  plan: string
  feature_key: string
  is_enabled: boolean
  quota: number | null
}

const PLAN_FEATURES: PlanFeatureRow[] = [
  { plan: "essencial", feature_key: "courses", is_enabled: true, quota: 5 },
  { plan: "essencial", feature_key: "course_designer", is_enabled: false, quota: null },
  { plan: "essencial", feature_key: "quizzes", is_enabled: true, quota: 10 },
  { plan: "essencial", feature_key: "trails", is_enabled: false, quota: null },
  { plan: "essencial", feature_key: "assessments", is_enabled: false, quota: null },
  { plan: "essencial", feature_key: "webhooks", is_enabled: false, quota: null },
  { plan: "essencial", feature_key: "api_access", is_enabled: false, quota: null },
  { plan: "standard", feature_key: "courses", is_enabled: true, quota: 50 },
  { plan: "standard", feature_key: "course_designer", is_enabled: true, quota: null },
  { plan: "standard", feature_key: "quizzes", is_enabled: true, quota: null },
  { plan: "standard", feature_key: "trails", is_enabled: true, quota: 10 },
  { plan: "standard", feature_key: "assessments", is_enabled: true, quota: null },
  { plan: "standard", feature_key: "webhooks", is_enabled: true, quota: 5 },
  { plan: "standard", feature_key: "api_access", is_enabled: true, quota: null },
  { plan: "premium", feature_key: "courses", is_enabled: true, quota: null },
  { plan: "premium", feature_key: "course_designer", is_enabled: true, quota: null },
  { plan: "premium", feature_key: "quizzes", is_enabled: true, quota: null },
  { plan: "premium", feature_key: "trails", is_enabled: true, quota: null },
  { plan: "premium", feature_key: "assessments", is_enabled: true, quota: null },
  { plan: "premium", feature_key: "webhooks", is_enabled: true, quota: null },
  { plan: "premium", feature_key: "api_access", is_enabled: true, quota: null },
]

const TENANT_PLANS: Record<string, string> = {
  "tenant-essencial": "essencial",
  "tenant-standard": "standard",
  "tenant-premium": "premium",
}

/** Uso por tabela de contagem — dirige o caminho de quota de `countFeatureUsage`. */
let usageByTable: Record<string, number> = {}

/**
 * Erro de LEITURA injetável por tabela. Distinto de "não há linha": aqui o banco
 * respondeu falha, e o sistema não sabe qual é o plano — não é o mesmo que saber
 * que o tenant não tem direito.
 */
let readErrorByTable: Record<string, { code: string; message: string } | undefined> = {}

// ---------------------------------------------------------------------------
// Stub do service client — só a superfície que `checkFeature` realmente encadeia
// ---------------------------------------------------------------------------
type Filters = Record<string, unknown>

function planFeaturesBuilder(filters: Filters) {
  const rows = () =>
    PLAN_FEATURES.filter((r) =>
      Object.entries(filters).every(([col, value]) => (r as unknown as Filters)[col] === value),
    )

  const builder = {
    eq: (col: string, value: unknown) => planFeaturesBuilder({ ...filters, [col]: value }),
    order: () => builder,
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      const error = readErrorByTable.plan_features
      return Promise.resolve(
        error ? { data: null, error } : { data: rows(), error: null },
      ).then(resolve, reject)
    },
  }
  return builder
}

function tenantsBuilder(tenantId: string | null) {
  const result = () => {
    const error = readErrorByTable.tenants
    if (error) return { data: null, error }
    // Ausência de linha em `maybeSingle` é `data: null` SEM erro — é exatamente
    // esse caso que precisa continuar caindo em `essencial`.
    return {
      data: tenantId && TENANT_PLANS[tenantId] ? { plan: TENANT_PLANS[tenantId] } : null,
      error: null,
    }
  }

  const builder = {
    eq: (_col: string, value: string) => tenantsBuilder(value),
    single: () => Promise.resolve(result()),
    maybeSingle: () => Promise.resolve(result()),
  }
  return builder
}

function countBuilder(table: string) {
  const builder = {
    eq: () => builder,
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null, count: usageByTable[table] ?? 0 }).then(
        resolve,
        reject,
      ),
  }
  return builder
}

function createStubClient() {
  return {
    from: (table: string) => ({
      select: () => {
        if (table === "tenants") return tenantsBuilder(null)
        if (table === "plan_features") return planFeaturesBuilder({})
        return countBuilder(table)
      },
    }),
  }
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => createStubClient(),
}))

// ---------------------------------------------------------------------------
// SUT — namespace import de propósito: o vermelho de hoje é a AUSÊNCIA do export,
// e um named import quebraria o módulo inteiro em vez de reprovar a asserção.
// ---------------------------------------------------------------------------
import * as featureGate from "@/lib/feature-gate"

interface Failure403Body {
  error: string
  feature: string
  current_plan: string
  required_plan: string | null
}

describe("requireFeature — guard de rota (AC2 + AC5 da story 28.2)", () => {
  beforeEach(() => {
    usageByTable = {}
    readErrorByTable = {}
    for (const id of Object.keys(TENANT_PLANS)) featureGate.invalidateFeatureCache(id)
  })

  it("existe entre os exports de lib/feature-gate.ts", () => {
    // Detector do defeito: hoje o módulo só exporta `requireFeatureAction`.
    expect(typeof (featureGate as Record<string, unknown>).requireFeature).toBe("function")
  })

  it("responde 403 quando a feature está desligada no plano do tenant", async () => {
    const response = await featureGate.requireFeature("tenant-essencial", "course_designer")

    expect(response).not.toBeNull()
    expect(response?.status).toBe(403)
  })

  it("o corpo do 403 traz error, feature, current_plan e required_plan (AC5)", async () => {
    const response = await featureGate.requireFeature("tenant-essencial", "course_designer")
    const body = (await response?.json()) as Failure403Body

    expect(body.error).toBe("feature_not_available")
    expect(body.feature).toBe("course_designer")
    expect(body.current_plan).toBe("essencial")
    expect(body.required_plan).toBe("standard")
  })

  it("devolve null (deixa a rota seguir) quando a MESMA feature está liberada", async () => {
    // Controle positivo ancorado no defeito: sem este caso, um `requireFeature`
    // que respondesse 403 incondicionalmente passaria nos dois testes acima.
    const response = await featureGate.requireFeature("tenant-standard", "course_designer")

    expect(response).toBeNull()
  })

  it("responde 403 quando a quota do plano já está estourada", async () => {
    usageByTable = { courses: 5 } // teto de `courses` no plano essencial

    const response = await featureGate.requireFeature("tenant-essencial", "courses")
    const body = (await response?.json()) as Failure403Body

    expect(response?.status).toBe(403)
    expect(body.feature).toBe("courses")
    expect(body.required_plan).toBe("standard")
  })

  it("devolve null quando há quota mas ainda há folga", async () => {
    // Segundo par discriminante: mesma feature, mesmo plano, só o uso muda.
    usageByTable = { courses: 4 }

    const response = await featureGate.requireFeature("tenant-essencial", "courses")

    expect(response).toBeNull()
  })

  it("responde 403 para feature-chave inexistente, com required_plan nulo", async () => {
    const response = await featureGate.requireFeature("tenant-premium", "feature_inexistente")
    const body = (await response?.json()) as Failure403Body

    expect(response?.status).toBe(403)
    expect(body.current_plan).toBe("premium")
    expect(body.required_plan).toBeNull()
  })

  // =========================================================================
  // Erro de leitura NÃO é ausência de direito
  //
  // `checkFeature` colapsava os dois casos no mesmo desfecho: o `?? "essencial"`
  // atendia tanto "não há linha para este tenant" (ausência de direito, correto)
  // quanto "a query falhou" (ausência de RESPOSTA, e aí o sistema não sabe qual
  // é o plano). Com o gate desligado isso era inócuo. Ligado, um soluço
  // transitório no banco vira negação de serviço a um cliente pagante, entregue
  // com a mensagem "seu plano não permite" — que é falsa.
  //
  // O par que discrimina está aqui dentro: os dois primeiros casos exigem 5xx, e
  // o terceiro exige que a AUSÊNCIA continue produzindo o 403 de sempre. Uma
  // correção grosseira que transformasse todo `data: null` em erro passaria nos
  // dois primeiros e reprovaria no terceiro.
  // =========================================================================
  describe("erro de leitura x ausência de linha", () => {
    const DB_DOWN = { code: "57P01", message: "terminating connection due to administrator command" }

    it("erro ao ler tenants NÃO vira 403 de plano", async () => {
      readErrorByTable = { tenants: DB_DOWN }

      const response = await featureGate.requireFeature("tenant-standard", "course_designer")
      const body = (await response?.json()) as Failure403Body

      expect(response?.status).not.toBe(403)
      expect(body.error).not.toBe("feature_not_available")
    })

    it("erro ao ler tenants responde 5xx (o sistema não sabe, e diz isso)", async () => {
      readErrorByTable = { tenants: DB_DOWN }

      const response = await featureGate.requireFeature("tenant-standard", "course_designer")

      expect(response?.status).toBeGreaterThanOrEqual(500)
    })

    it("erro ao ler plan_features também não vira 403 de plano", async () => {
      // Mesma mentira pelo outro caminho: com `plan_features` ilegível o mapa de
      // features nasce vazio e TODA feature lê como desligada.
      readErrorByTable = { plan_features: DB_DOWN }

      const response = await featureGate.requireFeature("tenant-premium", "course_designer")

      expect(response?.status).not.toBe(403)
      expect(response?.status).toBeGreaterThanOrEqual(500)
    })

    it("tenant SEM linha (sem erro) continua caindo em essencial e recebendo 403", async () => {
      // O controle que impede a correção de virar "todo null é erro".
      featureGate.invalidateFeatureCache("tenant-que-nao-existe")

      const response = await featureGate.requireFeature("tenant-que-nao-existe", "course_designer")
      const body = (await response?.json()) as Failure403Body

      expect(response?.status).toBe(403)
      expect(body.error).toBe("feature_not_available")
      expect(body.current_plan).toBe("essencial")
    })

    it("checkFeature propaga o erro de leitura em vez de devolver allowed:false", async () => {
      readErrorByTable = { tenants: DB_DOWN }

      await expect(featureGate.checkFeature("tenant-standard", "course_designer")).rejects.toThrow(
        featureGate.FeatureCheckUnavailableError,
      )
    })

    it("a falha não envenena o cache: a chamada seguinte, com o banco são, acerta", async () => {
      // O cache tem TTL de 5 minutos. Se o mapa vazio de uma leitura falha fosse
      // gravado, um único soluço produziria 5 minutos de 403 falso — o defeito
      // deixaria de ser transitório e viraria incidente.
      readErrorByTable = { plan_features: DB_DOWN }
      await featureGate.requireFeature("tenant-standard", "course_designer").catch(() => null)

      readErrorByTable = {}
      const response = await featureGate.requireFeature("tenant-standard", "course_designer")

      expect(response).toBeNull()
    })
  })
})
