import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Percorrido x Progressão §2.1 — interação alimenta a marca d'água.
 *
 * O caso que mais importa aqui NÃO é o caminho feliz: é a garantia de que a
 * telemetria é SUBORDINADA. Se o registro de presença falhar de qualquer jeito,
 * a reflexão do aluno tem de ser salva mesmo assim. Um aluno perder a própria
 * reflexão por causa de uma métrica seria muito pior do que a métrica faltar.
 */

const upsertSpy = vi.fn()
const state = {
  user: { id: "aluno-1" } as { id: string } | null,
  tenantRows: [{ tenant_id: "tenant-A" }] as unknown[],
  slideRows: [{ chapter_id: "cap-1", order: 6, tenant_id: "tenant-A" }] as unknown[],
  siblingRows: [{ order: 0 }, { order: 1 }, { order: 6 }] as unknown[],
  throwOn: null as string | null,
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from(table: string) {
      if (state.throwOn === table) throw new Error("boom")
      const builder = {
        select: () => builder,
        eq: () => builder,
        limit: async () => {
          if (table === "users") return { data: state.tenantRows }
          if (table === "chapter_slides") return { data: state.slideRows }
          return { data: [] }
        },
        // O query builder do Supabase É um thenable por design (await direto, sem
        // .limit()); o duplo precisa imitar isso para exercitar o caminho real.
        // biome-ignore lint/suspicious/noThenProperty: duplo de teste de um thenable real
        then: (resolve: (v: { data: unknown[] }) => unknown) =>
          resolve({ data: table === "chapter_slides" ? state.siblingRows : [] }),
        upsert: async (payload: unknown, opts: unknown) => {
          upsertSpy(table, payload, opts)
          if (state.throwOn === "upsert") throw new Error("write failed")
          return { error: null }
        },
      }
      return builder
    },
  }),
}))

const { recordSlidePresence } = await import("../record-slide-presence")

describe("recordSlidePresence — telemetria subordinada", () => {
  beforeEach(() => {
    upsertSpy.mockClear()
    state.user = { id: "aluno-1" }
    state.tenantRows = [{ tenant_id: "tenant-A" }]
    state.slideRows = [{ chapter_id: "cap-1", order: 6, tenant_id: "tenant-A" }]
    state.throwOn = null
  })

  it("NUNCA lança quando a escrita falha — a reflexão do aluno tem de sobreviver", async () => {
    state.throwOn = "upsert"
    await expect(recordSlidePresence("slide-x")).resolves.toBeUndefined()
  })

  it("NUNCA lança quando a consulta falha", async () => {
    state.throwOn = "users"
    await expect(recordSlidePresence("slide-x")).resolves.toBeUndefined()
  })

  it("não escreve nada para usuário não autenticado", async () => {
    state.user = null
    await recordSlidePresence("slide-x")
    expect(upsertSpy).not.toHaveBeenCalled()
  })

  it("não escreve nada quando o usuário não tem tenant", async () => {
    state.tenantRows = [{ tenant_id: null }]
    await recordSlidePresence("slide-x")
    expect(upsertSpy).not.toHaveBeenCalled()
  })

  it("NÃO escreve quando o slide é de OUTRO tenant — isolamento cross-tenant", async () => {
    state.slideRows = [{ chapter_id: "cap-1", order: 6, tenant_id: "tenant-OUTRO" }]
    await recordSlidePresence("slide-x")
    expect(upsertSpy).not.toHaveBeenCalled()
  })

  it("não escreve quando o slide não existe", async () => {
    state.slideRows = []
    await recordSlidePresence("slide-inexistente")
    expect(upsertSpy).not.toHaveBeenCalled()
  })
})
