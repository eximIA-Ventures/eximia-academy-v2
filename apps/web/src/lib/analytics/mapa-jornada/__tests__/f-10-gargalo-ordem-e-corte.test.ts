import { describe, expect, it } from "vitest"
import {
  CAPS_A,
  CAP_ANCORA,
  calcular,
  darAtividadeHoje,
  embaralharCapitulos,
  entradaBase,
} from "./contrato"

/**
 * F-10 · Ordenação e corte da lista de gargalos (§24: "do maior para o menor").
 *
 * INVARIÂNCIA: embaralhar a ordem de entrada dos módulos não muda a saída;
 *   com mais módulos elegíveis que o corte, o link aparece.
 * VARIÂNCIA: subir o numerador de um módulo de baixo reordena a lista.
 * REGRA DE RUÍDO: com módulos elegíveis dentro do corte, o link `Ver todos os
 *   módulos ›` SOME — link para "todos" quando já se vê todos é ruído.
 */
describe("F-10 · ordem e corte dos gargalos", () => {
  it("INVARIÂNCIA — decrescente por numerador", async () => {
    const r = await calcular(entradaBase())
    const contagens = r.gargalos.linhas.map((g) => g.pessoas)
    for (let i = 1; i < contagens.length; i++) {
      expect(contagens[i - 1], `posição ${i}`).toBeGreaterThanOrEqual(contagens[i] as number)
    }
    expect(r.gargalos.linhas[0]?.moduloId).toBe(CAP_ANCORA)
  })

  it("INVARIÂNCIA — a ordem de chegada do banco não muda a saída", async () => {
    const normal = await calcular(entradaBase())
    const embaralhado = await calcular(embaralharCapitulos(entradaBase()))
    expect(embaralhado.gargalos.linhas.map((g) => `${g.moduloId}=${g.pessoas}`)).toEqual(
      normal.gargalos.linhas.map((g) => `${g.moduloId}=${g.pessoas}`),
    )
  })

  it("INVARIÂNCIA — dentro do corte, o link `Ver todos os módulos` some", async () => {
    const r = await calcular(entradaBase())
    expect(r.gargalos.linhas.length).toBeLessThanOrEqual(5)
    expect(r.gargalos.linkRodape).toBeNull()
  })

  // -------------------------------------------------------------------------
  // O NUMERAL DO BADGE é a POSIÇÃO na lista, não o número do módulo.
  //
  // O contrato F-10 diz, com todas as letras, que "os numerais 1..5 do mockup
  // são posição". A referência confirma: as cinco linhas trazem `1 2 3 4 5` ao
  // lado dos módulos 6, 7, 5, 4 e 3. A implementação renderizava `numero` (a
  // posição do módulo na GRADE), e a coluna de badges saía `6 4 2 5 3`.
  //
  // Os dois campos convivem de propósito e medem coisas diferentes: `ordem` é o
  // badge, `numero` alimenta o insight F-28 ("reforços nos módulos a a b"). Por
  // isso o par abaixo: um teste que fixa `ordem` e outro que prova que `ordem`
  // e `numero` DIVERGEM — sem o segundo, uma implementação que devolvesse
  // `ordem = numero` passaria no primeiro sempre que a lista, por acaso,
  // começasse no módulo 1.
  // -------------------------------------------------------------------------
  it("INVARIÂNCIA — `ordem` é 1..N na sequência exibida, sem buraco", async () => {
    const r = await calcular(entradaBase())
    expect(r.gargalos.linhas.map((g) => g.ordem)).toEqual(r.gargalos.linhas.map((_, i) => i + 1))
    expect(r.gargalos.linhas[0]?.ordem).toBe(1)
  })

  it("VARIÂNCIA — `ordem` NÃO acompanha o módulo: o topo é módulo alto e ordem 1", async () => {
    const r = await calcular(entradaBase())
    const topo = r.gargalos.linhas[0]
    expect(topo).toBeDefined()
    // O módulo âncora desta fixture NÃO é o primeiro da grade. Se `ordem`
    // fosse `numero` disfarçado, os dois seriam iguais aqui.
    expect(topo?.numero).toBeGreaterThan(1)
    expect(topo?.ordem).toBe(1)
    expect(topo?.ordem).not.toBe(topo?.numero)

    // Nesta fixture as duas linhas saem `(ordem 1, módulo 6)` e
    // `(ordem 2, módulo 2)`: a segunda tem `ordem === numero` POR COINCIDÊNCIA.
    // Registrado no teste porque é exatamente o tipo de coincidência que faria
    // um verificador frouxo aprovar a implementação errada — o que se afirma é
    // que ao menos uma linha diverge, não que todas divirjam.
    const divergem = r.gargalos.linhas.filter((g) => g.ordem !== g.numero).length
    expect(divergem).toBeGreaterThanOrEqual(1)
  })

  it("VARIÂNCIA — reordenar a lista reatribui `ordem` sem mexer em `numero`", async () => {
    const antes = await calcular(entradaBase())
    let e = entradaBase()
    for (const alunoId of ["P03", "P04", "P05", "P06"]) {
      e = darAtividadeHoje(e, alunoId, CAP_ANCORA)
    }
    const depois = await calcular(e)

    const moduloDaOrdem1Antes = antes.gargalos.linhas.find((g) => g.ordem === 1)?.moduloId
    const moduloDaOrdem1Depois = depois.gargalos.linhas.find((g) => g.ordem === 1)?.moduloId
    expect(moduloDaOrdem1Antes).toBeDefined()
    expect(moduloDaOrdem1Depois).toBeDefined()
    expect(moduloDaOrdem1Depois).not.toBe(moduloDaOrdem1Antes)

    // `numero` é propriedade do módulo e sobrevive à reordenação: o mesmo
    // módulo carrega o mesmo `numero` nas duas montagens, com `ordem` outra.
    const porModuloAntes = new Map(antes.gargalos.linhas.map((g) => [g.moduloId, g.numero]))
    for (const linha of depois.gargalos.linhas) {
      const numeroAntigo = porModuloAntes.get(linha.moduloId)
      if (numeroAntigo !== undefined) expect(linha.numero).toBe(numeroAntigo)
    }
  })

  it("VARIÂNCIA — esvaziar o topo reordena a lista inteira", async () => {
    let e = entradaBase()
    for (const alunoId of ["P03", "P04", "P05", "P06"]) {
      e = darAtividadeHoje(e, alunoId, CAP_ANCORA)
    }
    const r = await calcular(e)
    expect(r.gargalos.linhas[0]?.moduloId, "o antigo topo saiu do gargalo").not.toBe(CAP_ANCORA)
  })

  it("VARIÂNCIA — com mais módulos elegíveis que o corte, o link aparece", async () => {
    // Seis módulos com pelo menos uma pessoa parada cada: o corte é 5.
    const base = entradaBase()
    const extras = CAPS_A.slice(0, 6).map((capituloId, i) => ({
      alunoId: `Y${i}`,
      capituloId,
      criadaEmISO: new Date(Date.parse(base.agoraISO) - 200 * 86_400_000).toISOString(),
    }))
    const e = {
      ...base,
      escopo: [...base.escopo, ...extras.map((x) => x.alunoId)],
      alunos: [
        ...base.alunos,
        ...extras.map((x) => ({ id: x.alunoId, nome: `Parado ${x.alunoId}` })),
      ],
      matriculas: [
        ...base.matriculas,
        ...extras.map((x) => ({
          alunoId: x.alunoId,
          cursoId: "C1-solucao-de-problemas",
          status: "active" as const,
          criadaEmISO: new Date(Date.parse(base.agoraISO) - 300 * 86_400_000).toISOString(),
        })),
      ],
      sessoes: [...(base.sessoes ?? []), ...extras],
    }
    const r = await calcular(e)
    expect(r.gargalos.linhas).toHaveLength(5)
    expect(r.gargalos.linkRodape).toBe("Ver todos os módulos")
  })
})
