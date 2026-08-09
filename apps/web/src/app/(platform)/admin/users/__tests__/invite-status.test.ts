import { INVITE_TTL_DAYS, INVITE_TTL_MS } from "@/lib/invites/ttl"
import { describe, expect, it } from "vitest"

// =============================================================================
// ESTADO DE CONVITE — a derivação (CFG-2.2, AC2).
//
// O que estes testes protegem não é a aparência da pílula, é a PROMESSA de que
// esses 4 estados existem só em memória. `users.status` continua com os dois
// valores que a `users_status_check` permite; "Convite pendente" e "Convite
// expirado" são leitura de `invited_at`/`confirmed_at` do Supabase Auth, nunca
// escrita.
//
// A fronteira de expiração é testada nos dois lados do segundo, porque é o único
// lugar onde um erro de sinal transformaria "convite recém-enviado" em "convite
// expirado" na cara do admin.
// =============================================================================

import { deriveUserDisplayStatus, isPendingInvite } from "@/lib/invites/status"

const NOW = new Date("2026-07-28T12:00:00Z").getTime()

/** `invited_at` a N dias atrás de NOW. */
function invitedDaysAgo(days: number) {
  return new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString()
}

describe("AC2 — os 4 estados derivados", () => {
  it("quem aceitou o convite é Ativo", () => {
    expect(
      deriveUserDisplayStatus(
        {
          status: "active",
          invited_at: invitedDaysAgo(30),
          confirmed_at: invitedDaysAgo(29),
        },
        NOW,
      ),
    ).toBe("active")
  })

  it("convidado que nunca aceitou, dentro do prazo, é Convite pendente", () => {
    expect(
      deriveUserDisplayStatus(
        { status: "active", invited_at: invitedDaysAgo(1), confirmed_at: null },
        NOW,
      ),
    ).toBe("invite_pending")
  })

  it("convidado que nunca aceitou, fora do prazo, é Convite expirado", () => {
    expect(
      deriveUserDisplayStatus(
        {
          status: "active",
          invited_at: invitedDaysAgo(INVITE_TTL_DAYS + 1),
          confirmed_at: null,
        },
        NOW,
      ),
    ).toBe("invite_expired")
  })

  it("quem nunca foi convidado (entrou por outro caminho) é Ativo", () => {
    expect(
      deriveUserDisplayStatus({ status: "active", invited_at: null, confirmed_at: null }, NOW),
    ).toBe("active")
  })
})

describe("AC2 — precedência: Desativado vence todos", () => {
  it("desativado com convite pendente continua Desativado", () => {
    expect(
      deriveUserDisplayStatus(
        { status: "inactive", invited_at: invitedDaysAgo(1), confirmed_at: null },
        NOW,
      ),
    ).toBe("inactive")
  })

  it("desativado com convite expirado continua Desativado", () => {
    expect(
      deriveUserDisplayStatus(
        {
          status: "inactive",
          invited_at: invitedDaysAgo(INVITE_TTL_DAYS + 10),
          confirmed_at: null,
        },
        NOW,
      ),
    ).toBe("inactive")
  })

  it("desativado que já tinha aceitado continua Desativado", () => {
    expect(
      deriveUserDisplayStatus(
        {
          status: "inactive",
          invited_at: invitedDaysAgo(30),
          confirmed_at: invitedDaysAgo(29),
        },
        NOW,
      ),
    ).toBe("inactive")
  })
})

describe("AC2 — a fronteira exata da expiração", () => {
  const invitedAt = new Date(NOW - INVITE_TTL_MS).toISOString()

  it("exatamente no limite ainda é pendente (não expira em cima da hora)", () => {
    expect(
      deriveUserDisplayStatus({ status: "active", invited_at: invitedAt, confirmed_at: null }, NOW),
    ).toBe("invite_pending")
  })

  it("um milissegundo depois do limite vira expirado", () => {
    expect(
      deriveUserDisplayStatus(
        { status: "active", invited_at: invitedAt, confirmed_at: null },
        NOW + 1,
      ),
    ).toBe("invite_expired")
  })

  it("um segundo antes do limite ainda é pendente", () => {
    expect(
      deriveUserDisplayStatus(
        { status: "active", invited_at: invitedAt, confirmed_at: null },
        NOW - 1000,
      ),
    ).toBe("invite_pending")
  })

  it("`invited_at` ilegível nunca é declarado expirado (não inventa vencimento)", () => {
    expect(
      deriveUserDisplayStatus(
        { status: "active", invited_at: "não é uma data", confirmed_at: null },
        NOW,
      ),
    ).toBe("active")
  })
})

describe("AC9 — sem os fatos do Auth, volta ao par binário de sempre", () => {
  it("campos ausentes (mapa vazio do accessor) devolvem Ativo/Inativo", () => {
    expect(deriveUserDisplayStatus({ status: "active" }, NOW)).toBe("active")
    expect(deriveUserDisplayStatus({ status: "inactive" }, NOW)).toBe("inactive")
  })

  it("nenhum usuário vira 'pendente' só porque o Auth não respondeu", () => {
    const roster = [{ status: "active" }, { status: "active" }, { status: "inactive" }]

    const derived = roster.map((u) => deriveUserDisplayStatus(u, NOW))

    expect(derived.filter(isPendingInvite)).toHaveLength(0)
  })
})

describe("isPendingInvite — quem pode receber reenvio/revogação", () => {
  it("só pendente e expirado", () => {
    expect(isPendingInvite("invite_pending")).toBe(true)
    expect(isPendingInvite("invite_expired")).toBe(true)
    expect(isPendingInvite("active")).toBe(false)
    expect(isPendingInvite("inactive")).toBe(false)
  })
})
