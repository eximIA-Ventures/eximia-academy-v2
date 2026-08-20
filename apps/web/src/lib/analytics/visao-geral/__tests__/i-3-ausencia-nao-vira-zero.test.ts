import { describe, expect, it } from "vitest"
import {
  type AtividadeBruta,
  DIA_MS,
  type EntradaVisaoGeral,
  NOMES_ENTRADA_PRINCIPAL,
  TEXTOS_VAZIOS,
  carregarModulo,
  chamar,
  coletarStrings,
  contemNumeralSolto,
  diasAtras,
  entradaBase,
  esvaziarPeriodoAnterior,
  resolverExport,
} from "./contrato"

/**
 * I-3 · Ausência de dado nunca vira zero.
 *
 * INVARIÂNCIA (testes 1 a 4): para cada um dos QUATRO estados vazios da §32
 *   (tendência, acionamentos, gargalos, sinais fora do padrão), o bloco
 *   devolve o texto literal da §32 e NÃO devolve um numeral zero solto.
 * VARIÂNCIA (testes 5 e 6): com dado presente, o mesmo bloco devolve NÚMERO e
 *   NÃO o texto de vazio. Sem isto, uma função que devolve sempre o texto de
 *   §32 passaria nos quatro primeiros — a armadilha desta tarefa.
 * DISCRIMINANTE (teste 7): "vazio" e "erro" são estados DIFERENTES. Falha de
 *   consulta não pode ser apresentada como "você não acionou ninguém", que é
 *   o achado A-1 na sua forma mais cara.
 *
 * Fonte: INVARIANTES.md I-3 · SPEC-FUNCIONAL.md §32 · fixture.ts §14.
 */

interface Bloco {
  estado?: string
  [k: string]: unknown
}

interface Resultado {
  estado?: string
  erro?: { codigo: string; mensagem: string } | null
  mudancas: Bloco
  atencao: Bloco
  resposta: Bloco
  sinais: Bloco
}

async function calcular(entrada: EntradaVisaoGeral): Promise<Resultado> {
  const mod = await carregarModulo()
  const fn = resolverExport<(e: EntradaVisaoGeral) => unknown>(
    mod,
    "entrada principal da Visão geral",
    NOMES_ENTRADA_PRINCIPAL,
  )
  return chamar<Resultado>(fn, entrada)
}

/** Todos regulares e recentes: sem gargalo e sem desvio do padrão próprio. */
function todosSustentando(): EntradaVisaoGeral {
  const base = entradaBase()
  const atividades: AtividadeBruta[] = []
  for (const aluno of base.alunos) {
    // 2 dias distintos por semana, 8 semanas, todo mundo igual.
    for (let d = 1; d < 56; d += 7) {
      atividades.push({
        studentId: aluno.id,
        createdAt: diasAtras(d),
        tipo: "sessao",
        questionId: "Q1",
      })
      atividades.push({ studentId: aluno.id, createdAt: diasAtras(d + 3), tipo: "reflexao" })
    }
  }
  return {
    ...base,
    atividades,
    matriculas: base.matriculas.map((m) => ({ ...m, progressPercent: 90 })),
  }
}

function textosDe(bloco: unknown): string[] {
  return coletarStrings(bloco).map((s) => s.texto)
}

describe("I-3 · ausência de dado nunca vira zero", () => {
  it("INVARIÂNCIA §32/acionamentos — sem acionamento devolve o texto, não 0%", async () => {
    const { resposta } = await calcular({ ...entradaBase(), acionamentos: [] })

    expect(textosDe(resposta)).toContain(TEXTOS_VAZIOS.acionamentos)
    expect(resposta.estado).toBe("vazio")
    const numerais = contemNumeralSolto(resposta)
    expect(
      numerais.map((n) => `${n.caminho}="${n.texto}"`),
      "bloco vazio não pode renderizar numeral solto (0, 0%)",
    ).toHaveLength(0)
  })

  it("INVARIÂNCIA §32/tendência — sem período anterior devolve o texto, não 0%", async () => {
    const { mudancas } = await calcular(esvaziarPeriodoAnterior(entradaBase()))

    expect(textosDe(mudancas)).toContain(TEXTOS_VAZIOS.tendencia)
    expect(mudancas.estado).toBe("vazio")
    expect(contemNumeralSolto(mudancas)).toHaveLength(0)
  })

  it("INVARIÂNCIA §32/gargalos — todos sustentando devolve o texto, não lista vazia com 0", async () => {
    const { atencao } = await calcular(todosSustentando())

    expect(textosDe(atencao)).toContain(TEXTOS_VAZIOS.gargalos)
    expect(atencao.estado).toBe("vazio")
  })

  it("INVARIÂNCIA §32/sinais — nenhum desvio do padrão próprio devolve o texto", async () => {
    const { sinais } = await calcular(todosSustentando())

    expect(textosDe(sinais)).toContain(TEXTOS_VAZIOS.sinais)
    expect(sinais.estado).toBe("vazio")
  })

  it("VARIÂNCIA — com acionamento no período o bloco devolve número, não o texto de vazio", async () => {
    const base = entradaBase()
    const { resposta } = await calcular({
      ...base,
      acionamentos: [
        { recipientId: "P3", sentAt: diasAtras(9), sentByManager: "G1" },
        { recipientId: "P5", sentAt: diasAtras(4), sentByManager: "G1" },
      ],
    })

    expect(resposta.estado).toBe("ok")
    expect(textosDe(resposta)).not.toContain(TEXTOS_VAZIOS.acionamentos)
    expect(contemNumeralSolto(resposta).length).toBeGreaterThan(0)
  })

  it("VARIÂNCIA — 0 retornos com 2 acionados é DADO, e continua sendo 'ok' com 0%", async () => {
    // Distinção que I-3 exige preservar: zero MEDIDO ≠ ausência de base.
    // Ninguém teve atividade depois do acionamento, então a taxa é 0% legítima.
    const base = entradaBase()
    const { resposta } = await calcular({
      ...base,
      atividades: base.atividades.filter(
        (a) => Date.parse(a.createdAt) < Date.parse(diasAtras(10)) - DIA_MS,
      ),
      acionamentos: [
        { recipientId: "P4", sentAt: diasAtras(2), sentByManager: "G1" },
        { recipientId: "P5", sentAt: diasAtras(1), sentByManager: "G1" },
      ],
    })

    expect(resposta.estado).toBe("ok")
    expect(textosDe(resposta)).not.toContain(TEXTOS_VAZIOS.acionamentos)
  })

  it("DISCRIMINANTE — estado 'erro' nunca é apresentado como estado 'vazio'", async () => {
    // Escopo inexistente força uma leitura sem linhas. O que NÃO pode acontecer
    // é o contrato de erro (§15) colapsar em vazio: se `erro` estiver
    // preenchido, `estado` tem que ser "erro" e nenhum texto de §32 pode
    // aparecer como se fosse fato sobre a equipe.
    const resultado = await calcular({ ...entradaBase(), escopo: [], alunos: [], atividades: [] })

    if (resultado.erro) {
      expect(resultado.estado).toBe("erro")
      const textos = textosDe(resultado)
      for (const literal of Object.values(TEXTOS_VAZIOS)) {
        expect(textos, `estado de erro não pode exibir o texto de §32: ${literal}`).not.toContain(
          literal,
        )
      }
    } else {
      // Sem erro, recorte vazio ainda não pode virar "0 de 0 · 0%".
      expect(resultado.estado).not.toBe("ok")
      expect(contemNumeralSolto(resultado)).toHaveLength(0)
    }
  })
})
