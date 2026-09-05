// ---------------------------------------------------------------------------
// A ROTA DE CLASSIFICAÇÃO NÃO DIZ "ok" QUANDO NADA FOI GRAVADO — C-3, lado HTTP.
// ---------------------------------------------------------------------------
// DEFEITO QUE ESTE ARQUIVO TRANCA (LOOP-1 técnico C-3, LOOP-0c tabela E→SUCESSO):
// `classify/route.ts` devolvia `200 {"ok":true,"processed":N}` sem nunca olhar
// se alguma das N tentativas virou linha no banco. Com 100% dos `upsert`
// falhando, a resposta era indistinguível de um pipeline saudável — e um
// monitor, um dashboard ou uma pessoa lendo esse endpoint concluía "20
// processadas, está vivo".
//
// A rota tem que distinguir TRÊS desfechos, não um:
//   sucesso total  → 200, ok:true,  status "ok"
//   sucesso parcial→ 200, ok:false, status "parcial"  (grava, mas perde parte)
//   falha total    → 500, ok:false, status "falha"    (tentou e não gravou nada)
// e a falha de LEITURA (nunca conseguiu começar) também é 500, não um 200 que
// parece "nada a fazer".
//
// CONTROLES POSITIVOS [CP]: o caminho feliz e o "nada pendente" continuam 200
// ok:true. Sem eles, a correção degenerada "responde 500 sempre" passaria.
//
// NENHUMA REDE, NENHUM BANCO: auth, service client e o próprio pipeline são
// duplos; a rota é exercitada só pela decisão que ela toma sobre o resultado.
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest"

const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

interface ResultadoFalso {
  processadas: number
  tentativas: number
  falhasDeGravacao: number
  pendentesRestantes: number
  capacidadesReavaliadas: number
  falhaLeitura: { codigo: string; mensagem: string } | null
}

let resultado: ResultadoFalso = {
  processadas: 3,
  tentativas: 3,
  falhasDeGravacao: 0,
  pendentesRestantes: 0,
  capacidadesReavaliadas: 1,
  falhaLeitura: null,
}

vi.mock("@/lib/auth", () => ({
  getAuthProfile: async () => ({
    user: { id: "user-1" },
    profile: { tenant_id: TENANT },
    roles: ["manager"],
  }),
  resolveTenantId: async (t: string) => t,
}))

vi.mock("@/lib/role-helpers", () => ({ hasAnyRole: () => true }))

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }))

vi.mock("@/lib/analytics/aprendizagem-time/classificador", () => ({
  processarPendencias: async () => resultado,
}))

async function chamar() {
  const { POST } = await import("../classify/route")
  const resposta = await POST()
  return { status: resposta.status, corpo: await resposta.json() }
}

describe("POST /api/analytics/aprendizagem-time/classify", () => {
  beforeEach(() => {
    vi.resetModules()
    resultado = {
      processadas: 3,
      tentativas: 3,
      falhasDeGravacao: 0,
      pendentesRestantes: 0,
      capacidadesReavaliadas: 1,
      falhaLeitura: null,
    }
  })

  it("[CP] sucesso total — 200 e ok:true", async () => {
    const { status, corpo } = await chamar()
    expect(status).toBe(200)
    expect(corpo.ok).toBe(true)
    expect(corpo.status).toBe("ok")
    expect(corpo.processed).toBe(3)
  })

  it("[CP] nada pendente — 200 e ok:true, porque não há o que gravar", async () => {
    resultado = { ...resultado, processadas: 0, tentativas: 0, capacidadesReavaliadas: 0 }
    const { status, corpo } = await chamar()
    expect(status).toBe(200)
    expect(corpo.ok).toBe(true)
    expect(corpo.status).toBe("ok")
  })

  it("C-3 — tentou 20 e gravou 0: NUNCA ok:true, e o status é 500", async () => {
    resultado = { ...resultado, processadas: 0, tentativas: 20, falhasDeGravacao: 20 }
    const { status, corpo } = await chamar()
    expect(corpo.ok).toBe(false)
    expect(corpo.processed).toBe(0)
    expect(corpo.attempted).toBe(20)
    expect(corpo.errors).toBe(20)
    expect(corpo.status).toBe("falha")
    expect(status).toBe(500)
  })

  it("C-3 — sucesso parcial se declara como parcial, não como ok", async () => {
    resultado = { ...resultado, processadas: 12, tentativas: 20, falhasDeGravacao: 8 }
    const { status, corpo } = await chamar()
    expect(status).toBe(200)
    expect(corpo.ok).toBe(false)
    expect(corpo.status).toBe("parcial")
    expect(corpo.processed).toBe(12)
    expect(corpo.errors).toBe(8)
  })

  it("A-5 — falha de LEITURA não vira 200 'nada a fazer'", async () => {
    resultado = {
      ...resultado,
      processadas: 0,
      tentativas: 0,
      capacidadesReavaliadas: 0,
      falhaLeitura: { codigo: "57014", mensagem: "canceling statement due to statement timeout" },
    }
    const { status, corpo } = await chamar()
    expect(status).toBe(500)
    expect(corpo.ok).toBe(false)
    expect(corpo.status).toBe("falha")
  })
})
