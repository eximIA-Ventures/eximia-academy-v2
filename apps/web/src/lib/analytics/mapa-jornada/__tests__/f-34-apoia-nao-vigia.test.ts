import { describe, expect, it } from "vitest"
import {
  CAPS_A,
  CURSO_A,
  type EntradaMapaJornada,
  acrescentarPessoa,
  apenas,
  calcular,
  coletarStrings,
  darAtividadeHoje,
  detectarPosicaoEmListaDePessoas,
  detectarVocabularioPunitivo,
  diasAtras,
  entradaBase,
} from "./contrato"

/**
 * F-34 · I-8 — a tela apoia, não vigia.
 *
 * É a lição 5 da tela anterior, onde a recomendação mandava COBRAR quem já
 * tinha concluído o curso. Número errado é ruim; ação errada sobre pessoa real
 * é pior. Três exigências verificáveis, todas aqui:
 *
 *  (a) nenhuma lista de PESSOAS numerada por posição. A lista de travados é
 *      ordenada por tempo parado — fila de triagem, não pódio —, e o que a
 *      separa de um ranking é justamente a ausência de numeral, badge e
 *      vocabulário comparativo. Os numerais 1..5 dos gargalos e 1..7 do funil
 *      são de MÓDULO e de PERCURSO: permitidos;
 *  (b) nenhum vocabulário punitivo em nenhuma string da saída;
 *  (c) nenhuma cor de mérito por pessoa: o tom do avatar deriva das INICIAIS,
 *      nunca do estado, senão a coluna de avatares vira semáforo de gente.
 *
 * DETECTOR obrigatório: os dois detectores são testados contra violação
 *   plantada. Detector que não morde aprova qualquer coisa em silêncio — foi
 *   assim que a tela anterior passou no invariante e falhou na vida.
 *
 * Fonte: CONTRATO-mapa.md F-34 · INVARIANTES.md I-8 · SPEC-FUNCIONAL.md §2/§22.
 */

/**
 * Duas pessoas com as MESMAS iniciais e estados OPOSTOS.
 *
 * "Tarso Vieira" e "Tereza Vasques" dão `TV` nas duas. Uma tem atividade de
 * hoje, a outra nenhuma. Se o tom do avatar viesse do estado, os dois tons
 * divergiriam — e a coluna de avatares estaria classificando gente.
 */
function comGemeasDeInicial(): EntradaMapaJornada {
  const capitulo = CAPS_A[0] as string
  let e = acrescentarPessoa(entradaBase(), "TV1", "Tarso Vieira", CURSO_A)
  e = acrescentarPessoa(e, "TV2", "Tereza Vasques", CURSO_A)
  e = darAtividadeHoje(e, "TV1", capitulo)
  e = {
    ...e,
    sessoes: [
      ...(e.sessoes ?? []),
      // TV2 esteve lá há muito tempo: iniciou, e está parada.
      { alunoId: "TV2", capituloId: capitulo, criadaEmISO: diasAtras(80) },
    ],
  }
  return apenas(e, ["P01", "P05", "TV1", "TV2"])
}

describe("F-34 · a tela apoia, não vigia", () => {
  it("INVARIÂNCIA (b) — nenhuma string da saída usa vocabulário punitivo", async () => {
    const r = await calcular(entradaBase())
    const violacoes = detectarVocabularioPunitivo(r)

    expect(
      violacoes.map((v) => `${v.caminho}: ${v.detalhe}`),
      "§2 Regra 2: a tela usa vocabulário de apoio, nunca de cobrança",
    ).toEqual([])
  })

  it("ANTI-VACUIDADE — a saída varrida tem texto de verdade", async () => {
    const r = await calcular(entradaBase())
    const strings = coletarStrings(r)

    // Uma saída vazia satisfaria o detector acima sem mérito nenhum.
    expect(strings.length).toBeGreaterThan(40)
    expect(r.insights.itens.length).toBeGreaterThan(0)
    expect(r.travados.linhas.length).toBeGreaterThan(0)
  })

  it("INVARIÂNCIA (a) — nenhuma lista de PESSOAS carrega chave de posição", async () => {
    const r = await calcular(entradaBase())

    expect(detectarPosicaoEmListaDePessoas(r.travados.linhas)).toEqual([])
    expect(detectarPosicaoEmListaDePessoas(r.mapa.linhas)).toEqual([])
  })

  it("INVARIÂNCIA (a) — os numerais que existem são de MÓDULO e de PERCURSO", async () => {
    const r = await calcular(entradaBase())

    // Gargalos e funil PODEM numerar: são módulos, não gente (I-8 proíbe
    // ranking com posição de PESSOA). A asserção existe para a ausência de
    // numeral em pessoas não ser confundida com "esta tela não numera nada".
    expect(r.gargalos.linhas.every((l) => Number.isInteger(l.numero))).toBe(true)
    expect(r.funil.linhas.every((l) => Number.isInteger(l.numero))).toBe(true)
    expect(r.gargalos.linhas.length).toBeGreaterThan(0)
  })

  it("INVARIÂNCIA (c) — mesmo par de iniciais, estados opostos, MESMO tom de avatar", async () => {
    const r = await calcular(comGemeasDeInicial())

    const tv1 = r.mapa.linhas.find((l) => l.alunoId === "TV1")
    const tv2 = r.mapa.linhas.find((l) => l.alunoId === "TV2")

    expect(tv1, "TV1 fora da amostra exibida: a asserção seria vacuosa").toBeDefined()
    expect(tv2, "TV2 fora da amostra exibida: a asserção seria vacuosa").toBeDefined()
    expect(tv1?.estado, "os dois estados precisam DIVERGIR para o par valer").not.toBe(tv2?.estado)
    expect(
      tv1?.avatarTone,
      "o tom do avatar deriva das INICIAIS; derivá-lo do estado transforma a " +
        "coluna de avatares em semáforo de gente",
    ).toBe(tv2?.avatarTone)
  })

  it("VARIÂNCIA — mudar o estado da pessoa muda a CÉLULA, não a cor dela", async () => {
    const base = comGemeasDeInicial()
    const depois = darAtividadeHoje(base, "TV2", CAPS_A[0] as string)

    const antes = await calcular(base)
    const agora = await calcular(depois)

    const linha = (r: Awaited<ReturnType<typeof calcular>>) =>
      r.mapa.linhas.find((l) => l.alunoId === "TV2")

    expect(linha(antes)?.estado).not.toBe(linha(agora)?.estado)
    expect(linha(antes)?.avatarTone).toBe(linha(agora)?.avatarTone)
  })

  it("DETECTOR — vocabulário punitivo plantado é acusado", () => {
    const plantado = {
      insights: {
        acao: { texto: "Cobrar as 16 pessoas paradas no módulo 6." },
        itens: [{ texto: "O pior aluno da turma é o que menos avança." }],
      },
    }
    const violacoes = detectarVocabularioPunitivo(plantado)

    expect(violacoes.length).toBeGreaterThanOrEqual(2)
    expect(violacoes.map((v) => v.detalhe).join(" ")).toContain("cobrar")
  })

  it("DETECTOR — chave de posição plantada em lista de pessoas é acusada", () => {
    const plantado = [
      { alunoId: "P1", nome: "Alguém", posicao: 1 },
      { alunoId: "P2", nome: "Outro" },
    ]
    const violacoes = detectarPosicaoEmListaDePessoas(plantado)

    expect(violacoes).toHaveLength(1)
    expect(violacoes[0]?.detalhe).toContain("posicao")
  })

  it("CONTROLE NEGATIVO — `numero` de módulo NÃO é acusado como posição", () => {
    const modulos = [{ moduloId: "cap1", numero: 1, titulo: "Introdução" }]
    expect(detectarPosicaoEmListaDePessoas(modulos)).toEqual([])
  })

  it("INVARIÂNCIA — a ação recomendada aponta para um MÓDULO, não para pessoas", async () => {
    const r = await calcular(entradaBase())
    const acao = r.insights.acao

    expect(acao, "a fixture tem concentração: a ação precisa existir").not.toBeNull()
    expect(acao?.moduloId, "o alvo da ação é um módulo").toBeTruthy()
    // Nenhum nome de pessoa do roster pode aparecer no texto da ação.
    const nomes = r.mapa.linhas.map((l) => l.nome)
    for (const nome of nomes) {
      expect(acao?.texto ?? "", `a ação nomeia a pessoa "${nome}"`).not.toContain(nome)
    }
  })
})
