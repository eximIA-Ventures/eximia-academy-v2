// ---------------------------------------------------------------------------
// Fuso horário do tenant — resolução com precedência (settings > Brasília).
// ---------------------------------------------------------------------------
// O DEFEITO QUE ISTO ARRANCA: `lerFonteAutogestao` devolvia
// `fusoHorarioMinutosOffset: null` incondicionalmente — todo carimbo lido em
// UTC. Uma sessão às 21h em Ribeirão Preto aparecia à meia-noite nos sinais
// de horário e no mapa de calor, sem nenhum teste acusando (hora deslocada
// continua sendo hora válida — ver a MUTAÇÃO ao final deste arquivo).
//
// Data usada no teste (c) verificada FORA do código sob teste (mesma
// disciplina de `mapa-de-calor.test.ts`, nunca com o `getUTCDay()` do próprio
// código): 2026-08-23 é domingo, 2026-08-24 é segunda-feira
// (`python3 -c "import datetime; print(datetime.date(2026,8,24).strftime('%A'))"`).
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest"
import type { ClienteLeitura } from "../fonte-supabase"
import { lerFonteAutogestao, resolverFusoHorarioMinutos } from "../fonte-supabase"
import { montarMapaDeCalorAtividade } from "../mapa-de-calor"
import { TENANT_FUSO_HORARIO_PADRAO_MINUTOS } from "../parametros"
import { temLastro } from "../tipos"

// ===========================================================================
// Duplo de Supabase mínimo, cobrindo TODAS as tabelas que `lerFonteAutogestao`
// lê (sessions, slide_reflections, chapter_view_progress, chapters,
// study_plans, tenants) — mesmo espírito de `bancoFalso()` em
// `trava-de-tenant.test.ts`: só o suficiente para o caminho sob teste, nunca
// um mock do supabase-js inteiro.
// ===========================================================================
interface BancoFalsoOpcoes {
  /** `undefined` = tenant sem linha/settings; objeto = `tenants.settings` presente. */
  tenantSettings?: unknown
}

function bancoFalso({ tenantSettings }: BancoFalsoOpcoes = {}): ClienteLeitura {
  function builder(tabela: string) {
    // biome-ignore lint/suspicious/noExplicitAny: duplo de teste — a cadeia real do supabase-js
    // (`.select().eq().order().range()`/`.maybeSingle()`) não é tipável sem o client concreto,
    // e não é isso que este teste está verificando.
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      is: () => chain,
      in: () => chain,
      limit: () => chain,
      range: async () => ({ data: [], error: null }),
      maybeSingle: async () => {
        if (tabela === "tenants") {
          return tenantSettings === undefined
            ? { data: null, error: null }
            : { data: { settings: tenantSettings }, error: null }
        }
        // study_plans (e qualquer outro `.maybeSingle()`): ausência é o
        // caminho MAJORITÁRIO (comentário do próprio `fonte-supabase.ts`).
        return { data: null, error: null }
      },
    }
    return chain
  }
  return { from: builder } as unknown as ClienteLeitura
}

const PARAMS_BASE = {
  tenantId: "tenant-1",
  studentId: "aluno-1",
  courseId: "curso-1",
  periodoDias: 30 as const,
}

// ===========================================================================
// A regra pura — `resolverFusoHorarioMinutos`
// ===========================================================================
describe("resolverFusoHorarioMinutos — regra pura de precedência", () => {
  it("sem configuração (ausente, null, ou objeto vazio) → default Brasília nomeado", () => {
    expect(resolverFusoHorarioMinutos(undefined)).toBe(TENANT_FUSO_HORARIO_PADRAO_MINUTOS)
    expect(resolverFusoHorarioMinutos(null)).toBe(TENANT_FUSO_HORARIO_PADRAO_MINUTOS)
    expect(resolverFusoHorarioMinutos({})).toBe(TENANT_FUSO_HORARIO_PADRAO_MINUTOS)
  })

  it("com configuração presente → ela VENCE o default, mesmo quando é UTC explícito (0)", () => {
    expect(resolverFusoHorarioMinutos({ timezone_offset_minutes: -240 })).toBe(-240)
    expect(resolverFusoHorarioMinutos({ timezone_offset_minutes: 0 })).toBe(0)
  })

  it("valor não numérico/NaN não é aceito silenciosamente — cai no default, nunca em NaN", () => {
    expect(resolverFusoHorarioMinutos({ timezone_offset_minutes: "-180" })).toBe(
      TENANT_FUSO_HORARIO_PADRAO_MINUTOS,
    )
    expect(resolverFusoHorarioMinutos({ timezone_offset_minutes: Number.NaN })).toBe(
      TENANT_FUSO_HORARIO_PADRAO_MINUTOS,
    )
  })

  it("trava de coerência: o default vigente ainda é Brasília (-180) — mudou? atualize a nota do cabeçalho", () => {
    expect(TENANT_FUSO_HORARIO_PADRAO_MINUTOS).toBe(-180)
  })
})

// ===========================================================================
// (a)/(b) — o offset chega até a `FonteAutogestao`, pelo caminho de leitura real
// ===========================================================================
describe("lerFonteAutogestao — o fuso chega até FonteAutogestao.fusoHorarioMinutosOffset", () => {
  it("(a) sem configuração no tenant, o offset resolvido é -180, NUNCA null", async () => {
    const db = bancoFalso({ tenantSettings: undefined })
    const fonte = await lerFonteAutogestao({ db, ...PARAMS_BASE })
    expect(fonte.fusoHorarioMinutosOffset).toBe(-180)
    expect(fonte.fusoHorarioMinutosOffset).not.toBeNull()
  })

  it("(b) com configuração presente no tenant, ela vence o default", async () => {
    const db = bancoFalso({ tenantSettings: { timezone_offset_minutes: -240 } })
    const fonte = await lerFonteAutogestao({ db, ...PARAMS_BASE })
    expect(fonte.fusoHorarioMinutosOffset).toBe(-240)
  })

  it("falha ao ler tenants.settings não derruba a leitura — cai no default Brasília", async () => {
    const db: ClienteLeitura = {
      from(tabela: string) {
        // biome-ignore lint/suspicious/noExplicitAny: duplo de teste, ver nota de `bancoFalso`.
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          order: () => chain,
          is: () => chain,
          in: () => chain,
          limit: () => chain,
          range: async () => ({ data: [], error: null }),
          maybeSingle: async () =>
            tabela === "tenants"
              ? { data: null, error: { message: "boom" } }
              : { data: null, error: null },
        }
        return chain
      },
      // biome-ignore lint/suspicious/noExplicitAny: mesmo duplo de teste do resto do arquivo.
    } as any
    const fonte = await lerFonteAutogestao({ db, ...PARAMS_BASE })
    expect(fonte.fusoHorarioMinutosOffset).toBe(-180)
  })
})

// ===========================================================================
// (c) — o deslocamento chega até a GRADE, não só até o campo numérico
// ===========================================================================
describe("o deslocamento chega até a grade do mapa de calor", () => {
  it("23h30 de domingo em Brasília NÃO vira segunda-feira (o dia UTC seguinte)", () => {
    // segunda-feira 02h30 UTC = domingo 23h30 em Brasília (UTC−3).
    const alvoUtcMs = Date.parse("2026-08-24T02:30:00.000Z")

    // Sanity do próprio cenário: garante que ele DE FATO cruza a fronteira do
    // dia — sem isto, um bug futuro na constante do fuso derrubaria o teste
    // para "sempre passa" em vez de "sempre falha alto".
    const diaSemanaUtcIngenuo = new Date(alvoUtcMs).getUTCDay()
    const diaSemanaLocalEsperado = new Date(
      alvoUtcMs + TENANT_FUSO_HORARIO_PADRAO_MINUTOS * 60_000,
    ).getUTCDay()
    expect(diaSemanaLocalEsperado).not.toBe(diaSemanaUtcIngenuo)
    expect(diaSemanaLocalEsperado).toBe(0) // domingo
    expect(diaSemanaUtcIngenuo).toBe(1) // segunda

    // 20 carimbos de preenchimento (quinta 2026-08-20, horas variadas) só
    // para cruzar o piso de amostra (`MAPA_DE_CALOR_MIN_ATIVIDADES`) sem
    // interferir na célula sob teste — dia da semana diferente do alvo nos
    // dois referenciais (UTC e local), então nunca cai na mesma célula.
    const preenchimento: number[] = []
    for (let i = 0; i < 20; i++) {
      const hora = (i * 2) % 24
      preenchimento.push(Date.parse(`2026-08-20T${String(hora).padStart(2, "0")}:00:00.000Z`))
    }

    // O offset usado aqui é o MESMO resolvido pelo caminho real de produção
    // (nunca um `-180` reescrito solto neste arquivo) — se a constante mudar,
    // este teste muda junto, sem precisar de segunda edição.
    const offset = resolverFusoHorarioMinutos(undefined)
    const carimbos = [...preenchimento, alvoUtcMs]

    const r = montarMapaDeCalorAtividade(carimbos, new Date(alvoUtcMs), offset, 12)
    expect(temLastro(r)).toBe(true)
    if (!temLastro(r)) throw new Error("esperava grade, veio SemLastro")

    // domingo (diaSemana=0), faixa 11 = 22h–24h → onde 23h30 LOCAL cai.
    const celulaDomingoNoite = r.grade.celulas[0]?.[11]
    // segunda (diaSemana=1), faixa 1 = 2h–4h → onde 02h30 UTC cairia se o
    // deslocamento NÃO tivesse chegado até a grade (o bug original).
    const celulaSegundaMadrugada = r.grade.celulas[1]?.[1]

    expect(celulaDomingoNoite?.contagem).toBe(1)
    expect(celulaSegundaMadrugada?.contagem).toBe(0)
  })
})
