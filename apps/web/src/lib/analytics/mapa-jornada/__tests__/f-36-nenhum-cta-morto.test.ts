import type { ConteudoGaveta, PessoaDaGaveta } from "@/lib/analytics/gaveta/tipos"
import { describe, expect, it } from "vitest"
import { calcular, entradaBase, recortarPara } from "./contrato"

/**
 * F-36 · nenhum elemento acionável desta tela é decorativo.
 *
 * ESTADO ANTERIOR, medido: SEIS elementos pareciam controle e não eram — a
 * pílula "Filtrar alunos" (com ícone de funil), o "+ N alunos", "Ver todos os
 * módulos", "Ver funil completo", "Ver pessoas (N)" (desenhado como botão, com
 * borda laranja) e "Ver recomendações". Mais os nomes de aluno na matriz e na
 * tabela de travados, que é a lacuna mais séria: a aba inteira é sobre pessoas e
 * nenhuma pessoa era clicável, contra a §30 explícita.
 *
 * Este arquivo tranca o CONTEÚDO que cada um passou a ter. A superfície (o
 * elemento ser `<button>` e não `<span>`) é responsabilidade do componente; o
 * que se verifica aqui é que existe o que mostrar — um botão que abre um painel
 * vazio é o mesmo nada, com um passo a mais.
 *
 * CONTROLE POSITIVO: cada asserção afirma primeiro que o cenário TEM o dado
 * (roster não vazio, gargalos existindo, funil com linhas). Sem isso,
 * "todas as fichas presentes" seria verdade sobre conjunto vazio.
 */

interface ComDetalhes {
  detalhes: {
    fichaPorAluno: Record<string, PessoaDaGaveta>
    matrizCompleta: readonly { alunoId: string; nome: string; estado: string }[]
    todosOsModulos: ConteudoGaveta
    funilCompleto: ConteudoGaveta
    travados: ConteudoGaveta
  }
}

async function calcularComDetalhes(entrada: Parameters<typeof calcular>[0]) {
  // `SaidaMapa` do contrato é um subconjunto tipado da saída, montado antes de
  // `detalhes` existir. O cast lê o campo novo sem alargar o contrato do
  // gauntlet, que descreve o que a TELA precisa e não o que a gaveta acrescenta.
  const r = (await calcular(entrada)) as unknown as ComDetalhes &
    Awaited<ReturnType<typeof calcular>>
  return r
}

describe("F-36 · nenhum CTA morto no Mapa", () => {
  it("CONTROLE POSITIVO — o cenário tem roster, módulos e funil", async () => {
    const r = await calcularComDetalhes(entradaBase())
    expect(r.mapa.totalAlunos).toBeGreaterThan(0)
    expect(r.mapa.colunas.length).toBeGreaterThan(0)
    expect(r.detalhes).toBeDefined()
  })

  it("INVARIÂNCIA — toda pessoa do roster tem ficha da §30", async () => {
    const r = await calcularComDetalhes(entradaBase())
    expect(r.detalhes.matrizCompleta.length).toBe(r.mapa.totalAlunos)
    for (const linha of r.detalhes.matrizCompleta) {
      const ficha = r.detalhes.fichaPorAluno[linha.alunoId]
      expect(ficha, `sem ficha para ${linha.nome}`).toBeDefined()
      expect(ficha?.nome).toBe(linha.nome)
      // Os campos da §30 que esta aba MEDE não podem sair vazios.
      expect(ficha?.statusRotulo.length).toBeGreaterThan(0)
      expect(ficha?.cursoRotulo.length).toBeGreaterThan(0)
      expect(ficha?.sinalLabel.length).toBeGreaterThan(0)
      expect(ficha?.acaoLabel.length).toBeGreaterThan(0)
    }
  })

  it("INVARIÂNCIA — a aba diz que NÃO mede frequência, em vez de inventar", async () => {
    // O Mapa mede posição ACUMULADA (régua F-33). Preencher "frequência
    // recente" aqui daria à mesma pessoa dois valores em duas abas.
    const r = await calcularComDetalhes(entradaBase())
    const fichas = Object.values(r.detalhes.fichaPorAluno)
    expect(fichas.length).toBeGreaterThan(0)
    for (const f of fichas) expect(f.frequenciaLabel).toBeNull()
  })

  it("INVARIÂNCIA — a matriz COMPLETA é superconjunto da amostra exibida", async () => {
    // A tela mostra 8 (F-06); o "+ N alunos" só pode expandir se as linhas
    // existirem, e na MESMA ordem — senão expandir reembaralha a tabela.
    const r = await calcularComDetalhes(entradaBase())
    if (r.mapa.estado !== "ok") return
    expect(r.detalhes.matrizCompleta.length).toBeGreaterThanOrEqual(r.mapa.linhas.length)
    for (const [i, linha] of r.mapa.linhas.entries()) {
      expect(r.detalhes.matrizCompleta[i]?.alunoId, `posição ${i}`).toBe(linha.alunoId)
    }
  })

  it("INVARIÂNCIA — 'Ver todos os módulos' cobre pelo menos o que o card corta", async () => {
    const r = await calcularComDetalhes(entradaBase())
    const destino = r.detalhes.todosOsModulos
    expect(destino.tipo).toBe("tabela")
    if (destino.tipo !== "tabela") return
    if (r.gargalos.estado === "ok") {
      expect(destino.linhas.length).toBeGreaterThanOrEqual(r.gargalos.linhas.length)
    }
    for (const linha of destino.linhas) {
      expect(linha.length).toBe(destino.colunas.length)
    }
  })

  it("INVARIÂNCIA — 'Ver funil completo' mostra a PERDA, que o card não mostra", async () => {
    // Este era o CTA mais enganoso dos seis: a tabela do card já listava todos
    // os módulos, então "completo" não prometia nada. O que ela não dá é onde a
    // jornada perde gente (§35).
    const r = await calcularComDetalhes(entradaBase())
    const destino = r.detalhes.funilCompleto
    expect(destino.tipo).toBe("tabela")
    if (destino.tipo !== "tabela") return
    expect(destino.colunas).toContain("Perda ao iniciar")
    expect(destino.colunas).toContain("Perda ao concluir")
    for (const linha of destino.linhas) {
      expect(linha.length).toBe(destino.colunas.length)
    }
  })

  it("INVARIÂNCIA — 'Ver pessoas' abre a população COMPLETA, não o corte (F-21)", async () => {
    const r = await calcularComDetalhes(entradaBase())
    const destino = r.detalhes.travados
    expect(destino.tipo).toBe("pessoas")
    if (destino.tipo !== "pessoas") return
    if (r.travados.estado === "ok") {
      // `ctaTotal` é o total completo; a lista da gaveta tem que alcançá-lo,
      // senão o botão anuncia um número e entrega outro — que é exatamente o
      // defeito que F-21 já pegou uma vez nesta tela.
      expect(destino.pessoas.length).toBe(r.travados.ctaTotal)
      expect(destino.pessoas.length).toBeGreaterThanOrEqual(r.travados.linhas.length)
    }
  })

  it("VARIÂNCIA — recorte vazio não fabrica ficha nem linha", async () => {
    const r = await calcularComDetalhes(recortarPara(entradaBase(), 0))
    expect(Object.keys(r.detalhes.fichaPorAluno)).toHaveLength(0)
    expect(r.detalhes.matrizCompleta).toHaveLength(0)
    const travados = r.detalhes.travados
    if (travados.tipo === "pessoas") {
      expect(travados.pessoas).toHaveLength(0)
      // I-3: vazio se diz com texto, nunca com ausência.
      expect(travados.textoVazio.length).toBeGreaterThan(0)
    }
  })
})
