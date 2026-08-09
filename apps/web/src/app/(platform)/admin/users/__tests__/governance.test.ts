import { INVITE_TTL_DAYS } from "@/lib/invites/ttl"
import { describe, expect, it } from "vitest"
import { governanceReasons, governanceTitle } from "../governance"

// =============================================================================
// SINAL ÂMBAR DE ATENÇÃO — o único aviso proativo da tela de Usuários.
//
// O valor dele está em dizer POR QUE, e em não acender à toa: um sinal que
// aponta para coisas que ninguém vai agir perde a credibilidade e vira ruído
// visual que o admin aprende a ignorar.
// =============================================================================

const DIA = 24 * 60 * 60 * 1000
const completo = {
  status: "active",
  job_role_id: "jr-1",
  area_ids: ["area-1"],
  invited_at: null,
  confirmed_at: "2026-01-01",
}

describe("quando NÃO acende", () => {
  it("pessoa com área, cargo e convite aceito", () => {
    expect(governanceReasons(completo)).toEqual([])
    expect(governanceTitle(completo)).toBeNull()
  })

  it("pessoa DESATIVADA, mesmo sem área e sem cargo", () => {
    const desligado = { ...completo, status: "inactive", job_role_id: null, area_ids: [] }

    expect(governanceReasons(desligado)).toEqual([])
  })

  it("convite recém-enviado, ainda dentro do prazo", () => {
    const recente = {
      ...completo,
      invited_at: new Date(Date.now() - 1 * DIA).toISOString(),
      confirmed_at: null,
    }

    expect(governanceReasons(recente)).toEqual([])
  })
})

describe("quando acende, e com qual motivo", () => {
  it("sem área", () => {
    expect(governanceReasons({ ...completo, area_ids: [] })).toEqual(["sem área"])
  })

  it("sem cargo", () => {
    expect(governanceReasons({ ...completo, job_role_id: null })).toEqual(["sem cargo"])
  })

  it("convite parado além do prazo", () => {
    const parado = {
      ...completo,
      invited_at: new Date(Date.now() - (INVITE_TTL_DAYS + 1) * DIA).toISOString(),
      confirmed_at: null,
    }

    expect(governanceReasons(parado)).toEqual(["convite parado há mais de 7 dias"])
  })

  it("acumula os motivos, na ordem de leitura", () => {
    const tudo = {
      status: "active",
      job_role_id: null,
      area_ids: [],
      invited_at: new Date(Date.now() - 90 * DIA).toISOString(),
      confirmed_at: null,
    }

    expect(governanceReasons(tudo)).toEqual([
      "sem área",
      "sem cargo",
      "convite parado há mais de 7 dias",
    ])
  })

  it("o título entrega os motivos numa frase pronta para o `title`", () => {
    expect(governanceTitle({ ...completo, area_ids: [] })).toBe("Precisa de atenção: sem área.")
  })
})

describe("o prazo NÃO é um 7 escrito à mão", () => {
  it("segue `INVITE_TTL_DAYS`: um dia antes não acende, um dia depois acende", () => {
    const antes = {
      ...completo,
      invited_at: new Date(Date.now() - (INVITE_TTL_DAYS - 1) * DIA).toISOString(),
      confirmed_at: null,
    }
    const depois = {
      ...completo,
      invited_at: new Date(Date.now() - (INVITE_TTL_DAYS + 1) * DIA).toISOString(),
      confirmed_at: null,
    }

    expect(governanceReasons(antes)).toEqual([])
    expect(governanceReasons(depois)).toHaveLength(1)
  })

  it("sem os fatos do Auth, não inventa 'convite parado'", () => {
    const semAuth = { status: "active", job_role_id: "jr-1", area_ids: ["a"] }

    expect(governanceReasons(semAuth)).toEqual([])
  })
})
