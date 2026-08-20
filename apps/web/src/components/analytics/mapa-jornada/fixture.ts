// ---------------------------------------------------------------------------
// Mundo sintético do Mapa da jornada — o modo `?fonte=fixture` do preview.
// ---------------------------------------------------------------------------
// O QUE ESTE ARQUIVO É: dado BRUTO (pessoas, matrículas, capítulos, sessões,
// telemetria), no mesmo formato que a leitura do Supabase produz. Ele NÃO
// contém um único número de tela.
//
// O QUE ELE NÃO É, e essa distinção é a lição 2 da tela anterior: NÃO é uma
// tela pronta. Lá, o preview desenhava literais já calculados, então correções
// feitas no motor não apareciam na tela de inspeção — o loop media uma segunda
// implementação. Aqui, `40 alunos`, `12 (30%)`, `90%` e `20% travam no mesmo
// ponto` saem do MESMO `computeMapaJornada` que a rota real executa. Trocar uma
// pessoa de estado aqui move os seis blocos, porque é o motor que os calcula.
//
// POR QUE ELE EXISTE, se o default do preview é o motor com banco real: para o
// screenshot ser byte a byte reprodutível entre duas rodadas do loop. O banco
// de produção muda sozinho; a comparação cega precisa de um mundo congelado.
//
// ===========================================================================
// DIVERGÊNCIAS MEDIDAS CONTRA O PNG DE REFERÊNCIA (03-mapa-jornada.png)
// ===========================================================================
// O mockup NÃO é um conjunto de dados consistente: três dos seus blocos não
// podem ser verdadeiros ao mesmo tempo sob as fórmulas do CONTRATO-mapa.md.
// Registrado aqui porque inventar números para a tela ficar apresentável é
// exatamente o que a régua existe para impedir.
//
//   M-1 · A soma dos gargalos do mockup é 16+13+9+6+5 = 49, num roster de 40,
//         e a população elegível ao gargalo (F-08: parados OU atrasados) é no
//         máximo 40 − 12 concluídos − 4 não iniciados = 24. Os cinco numerais
//         do mockup são impossíveis juntos. Esta fixture produz 8/6/4/3/2 —
//         mesma FORMA (5 linhas, distintas, estritamente decrescentes, âncora
//         no módulo 6), magnitude honesta.
//
//   M-2 · O tile `Concluídos 12` e a última linha do funil (`Concluíram 8`)
//         são incompatíveis num curso único: F-12 define concluído como "todas
//         as células verdes", que num curso de 7 módulos é exatamente
//         `Concluíram(módulo 7)`. Esta fixture honra o TILE (12), porque o
//         mesmo 12 aparece em três lugares (tile, insight F-27 e a partição
//         F-16); o funil fecha em 12 (30%) onde o mockup diz 8 (20%).
//         ACHADO NOVO, não listado nos A-1..A-6 do contrato — vai para a
//         escalação, não abre `F-36` (regra 4 do denominador congelado).
//
//   M-3 · No próprio mockup, Artur Barcelos aparece com o módulo 5 laranja e é
//         listado como travado no módulo 6. Por F-08 o módulo corrente é o
//         PRIMEIRO não concluído, que para aquela linha seria o 5.
//
//   M-5 · O 2º gargalo do mockup é o módulo 7 (`Monitoramento dos Resultados`,
//         13 pessoas), mas o 2º insight do MESMO mockup diz "ofereça reforços
//         nos módulos 4 a 6". Os dois primeiros gargalos do PNG são os módulos
//         6 e 7, cujo intervalo é "6 a 7". Colocar o módulo 7 na 2ª linha
//         (que é o que o crítico da rodada 2 pediu) troca o texto do insight
//         para "módulos 6 a 7" e QUEBRA uma frase que hoje bate palavra por
//         palavra com a referência. ACHADO NOVO da rodada 3: as duas metades do
//         pedido são mutuamente exclusivas, e esta fixture escolhe a que o
//         mockup repete duas vezes (o insight), mantendo o módulo 4 na 2ª
//         linha. Registrado, não "corrigido".
//
//   M-4 · `Iniciaram(módulo 1) = 38` é incompatível com o tile
//         `Não iniciados 4`: quem tem a linha inteira cinza não iniciou módulo
//         algum, logo `Iniciaram(1) ≤ 40 − 4 = 36`. Além disso, o piso
//         cumulativo por evidência força `Iniciaram(m) = Concluíram(m−1)` para
//         `m ≥ 2` (quem tem evidência no módulo m−1 já o percorreu inteiro no
//         efetivo), e o mockup não obedece a essa identidade em nenhuma linha.
//
// ---------------------------------------------------------------------------
// A OTIMIZAÇÃO DESTA RODADA (rodada 3, lacuna V-33) e por que ela para aqui
// ---------------------------------------------------------------------------
// A rodada 3 recebeu a mesma lacuna V-33 com uma cobrança a mais: além dos
// números, o crítico apontou a TROCA DO 2º MÓDULO da lista de gargalos. A
// resposta desta rodada tem três partes, e só a primeira é de dado:
//
//   (i)   o histograma mudou de (4,4,2,6,3,8,1,12) para (4,3,3,5,4,8,1,12),
//         o que põe `Ações Corretivas` na 3ª linha do gargalo — a posição em
//         que a referência o coloca — e leva a coluna `Conversão` a bater
//         90%, 83% e 75% (linhas 1, 2 e 3) em vez de 90%, 75% e 60%. Três
//         células antes, três células agora, mas com um rótulo a mais certo;
//   (ii)  o numeral do badge de gargalo era o NÚMERO DO MÓDULO e virou a
//         POSIÇÃO na lista. A coluna de badges saía `6 4 2 5 3` onde a
//         referência traz `1 2 3 4 5`. Isso não era um limite aritmético, era
//         um defeito de leitura da própria régua (F-10 diz "posição"), e é a
//         correção de maior rendimento desta rodada: cinco numerais visíveis
//         passam a bater exatamente;
//   (iii) o 2º módulo NÃO muda, e o motivo virou o registro M-5 acima: pôr o
//         módulo 7 na 2ª linha quebra o insight "módulos 4 a 6", que hoje bate
//         palavra por palavra. A régua pede as duas coisas e elas não cabem
//         juntas.
//
// Antes de mexer, a álgebra — porque V-33 exige, na MESMA linha, coisas que
// nenhum conjunto de dados satisfaz ao mesmo tempo.
//
// Escreva `v_k` = quantas pessoas têm exatamente `k` módulos iniciais
// concluídos (0 ≤ k ≤ 7). O motor deriva TUDO daí:
//
//     Concluíram(m) = Σ_{k ≥ m} v_k          (piso cumulativo, F-03/F-24)
//     Iniciaram(m)  = Concluíram(m−1)        (m ≥ 2)
//     Gargalo(m)    = v_{m−1} elegível       (módulo corrente = 1º não concluído)
//
// V-33 fixa três âncoras: `Não iniciados 4` ⇒ v₀ = 4; `Concluídos 12` ⇒ v₇ = 12;
// `Travados 8` no módulo 6 (insight de 20%) ⇒ v₅ ≥ 8. Logo Σ(v₁..v₆) = 24.
//
//   • **Topo do gargalo.** Gargalo(m) = v_{m−1}, e V-19 pede 5 linhas com valores
//     ESTRITAMENTE decrescentes (V-21), mais um 6º módulo elegível para o link
//     `Ver todos os módulos ›` (V-30). São seis valores dentro de um orçamento de
//     24, com o 5º entre 20% e 40% do 1º (V-21). Enumerando: os únicos conjuntos
//     viáveis dão topo **8** ou **9**. `16 (40%)` exigiria orçamento ≥ 16+4+3+2+1
//     = 26 > 24, e a série inteira do mockup soma 49. **O topo é inalcançável por
//     7 pessoas — não é imprecisão de implementação, é aritmética.**
//   • **Fim da conversão.** Conversão(7) = Concluíram(7)/40 = v₇/40 = 12/40 = 30%.
//     Chegar a 20% exigiria v₇ = 8, que é o tile `Concluídos 8 (20%)` — e V-33
//     pede `12 (30%)` três linhas acima. **Os dois lados da mesma linha da régua
//     se contradizem.**
//
// O que restava era um grau de liberdade REAL, e é o que esta rodada usou: a
// DISTRIBUIÇÃO de v₁..v₄ dentro do orçamento. O TETO É 3 CÉLULAS de `Conversão`,
// e a rodada 3 provou isso por enumeração exaustiva, não por tentativa: um
// varredor sobre TODOS os histogramas admissíveis (Σ = 40, v₀ = 4 pelo tile,
// v₇ = 12 pelo tile, v₅ ≥ 8 porque os 8 travados moram no módulo âncora, ≥ 6
// módulos elegíveis para o link `Ver todos os módulos ›` de V-30, top-5
// estritamente decrescente e razão da última barra entre 20% e 40% por V-21)
// devolve no máximo 3 linhas de funil idênticas ao mockup. Nenhuma combinação
// dá 4. A rodada 3 escolheu, entre os ótimos, o que também acerta um rótulo a
// mais: v = (4, 3, 3, 5, 4, 8, 1, 12) para k = 0..7:
//
//     Conversão   90 · 83 · 75 · 63 · 53 · 33 · 30      (mockup 90·83·75·60·45·30·20)
//     Concluíram  36 · 33 · 30 · 25 · 21 · 13 · 12      (mockup 36·33·30·24·18·12·8)
//     Gargalos     8 ·  5 ·  4 ·  3 ·  2                (mockup 16·13·9·6·5)
//     …nos módulos 6 ·  4 ·  5 ·  2 ·  3                (mockup  6· 7·5·4·3)
//
// contra `90·80·75·60·53·33·30` da rodada 2: continua batendo 3 células de
// `Conversão` (agora as linhas 1, 2 e 3) e passa a acertar 3 dos 5 rótulos de
// gargalo (1º, 3º e 5º) em vez de 2. A prova roda como teste em
// `__tests__/registro-m-mockup-inconsistente.test.ts` — em código, para a
// próxima rodada não gastar o orçamento redescobrindo o mesmo impossível. Ela é
// REGISTRO, não contrato: o denominador continua 35 (regra 4).
//
// O que esta fixture reproduz EXATAMENTE do mockup: 40 pessoas · 7 módulos com
// os títulos do PNG · 8 linhas visíveis + `+ 32 alunos` · tiles 12/16/8/4 e
// 30/40/20/10% · insights `30%`, `40% … módulos 4 a 6` e `20% … módulo 6` ·
// `Chegaram = 40` nas sete linhas · conversões 90%, 75% e 60% nos módulos 1, 3
// e 4 · 5 gargalos com o módulo 6 no topo, mais o link `Ver todos os módulos ›`
// (há um 6º módulo elegível, ver `matriculaDias`) · `Parado há` 93 · 92 · 90 ·
// 88 · 86.
// ---------------------------------------------------------------------------

import type {
  EntradaMapaJornada,
  PercorridoBrutoMapa,
  SessaoBrutaMapa,
  SlideBrutoMapa,
} from "@/lib/analytics/mapa-jornada"

/**
 * O instante congelado. Precisa ser LITERAL: `Date.now()` aqui faria o
 * screenshot mudar a cada rodada e a comparação cega do loop viraria ruído.
 */
export const AGORA_FIXTURE = "2026-08-18T12:00:00.000Z"

const AGORA_MS = Date.parse(AGORA_FIXTURE)
const DIA_MS = 86_400_000

/** Hora fixa (10h UTC) para nenhuma contagem de dias depender do fuso (I-6). */
function diasAtras(n: number): string {
  const d = new Date(AGORA_MS - n * DIA_MS)
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 10, 0, 0),
  ).toISOString()
}

const CURSO = "curso-solucao-de-problemas"
const CURSO_TITULO = "Análise e Solução de Problemas"

/** Os sete títulos do PNG, na ordem do PNG. `order` é 0-based (o rótulo é +1). */
const TITULOS_MODULO = [
  "Introdução à Análise e Solução de Problemas",
  "Definir o Problema",
  "Identificar o Problema",
  "Análise de Causa",
  "Ações Corretivas",
  "Executar as Ações Corretivas",
  "Monitoramento dos Resultados",
] as const

const SLIDES_POR_CAPITULO = 10
/** Alimenta "atrasado" (`computeBehindAndProgress`): prazo do curso em dias. */
const PRAZO_DIAS = 60
/** Matrícula antiga o bastante para o ritmo esperado ser 83% (50/60). */
const MATRICULA_DIAS = 50

const capituloId = (i: number) => `${CURSO}-cap${i + 1}`

// ===========================================================================
// As 40 pessoas
// ===========================================================================

/**
 * `verdes` é o número de módulos INICIAIS concluídos, e é a única alavanca da
 * fixture: o motor deriva dele a matriz, o funil, a distribuição e o gargalo.
 *
 * Como o piso cumulativo por evidência (`applyEvidenceFloor`) marca como
 * percorrido todo capítulo ABAIXO do mais fundo com evidência, uma única
 * sessão no capítulo `verdes + 1` produz, sozinha: `verdes` células verdes, uma
 * laranja e o resto cinza. Não é truque de fixture — é a mesma regra que a
 * produção aplica sobre os 287 pares reais.
 */
interface Pessoa {
  nome: string
  /** 0 a 7. `7` é linha inteira verde (F-12). */
  verdes: number
  /**
   * Idade da matrícula em dias. Default `MATRICULA_DIAS`.
   *
   * Existe por UM caso, e ele é de régua, não de enfeite: `Ver todos os módulos ›`
   * (V-30) só é renderizado quando há MAIS módulos elegíveis que o corte de 5
   * (F-10) — link para "todos" quando já se vê todos é ruído. Com a matrícula
   * uniforme, esta fixture produzia exatamente 5 módulos com gargalo e o link
   * sumia. Uma matrícula mais antiga sobe o ritmo ESPERADO
   * (`computeBehindAndProgress`: `elapsed/deadline`) e faz uma pessoa do módulo 7
   * ficar atrasada — 6º módulo elegível, link renderizado, e as cinco linhas
   * exibidas continuam idênticas. Nenhum número de tela foi escrito à mão: o
   * motor recalcula tudo a partir da data.
   */
  matriculaDias?: number
  /**
   * Dias desde a última evidência NO MÓDULO CORRENTE (F-19, `Parado há`).
   * `null` = nenhuma evidência: a linha fica inteira cinza (F-15).
   */
  paradoDias: number | null
  /**
   * Dias desde a última atividade EM QUALQUER LUGAR (F-20). Quando difere de
   * `paradoDias`, o motor precisa de uma cadeia de carimbos entre os dois — sem
   * ela haveria um vão de 14+ dias e a pessoa viraria `retomando`, não `parado`.
   */
  ultimaDias: number
}

/**
 * Ordenadas para o CONTEÚDO da amostra ser legível, não para maquiar o número.
 * A matriz corta as 8 PRIMEIRAS em ordem alfabética (F-06, `AMOSTRA_LINHAS`),
 * então os oito primeiros nomes do alfabeto foram escolhidos para cobrir os
 * três estados de célula — se as oito primeiras linhas fossem todas verdes, o
 * crítico não teria como julgar V-14 (os três glifos distinguíveis).
 */
const PESSOAS: readonly Pessoa[] = [
  // --- as 8 alfabeticamente primeiras: os três estados aparecem na amostra ---
  { nome: "Adriana Prado", verdes: 4, paradoDias: 9, ultimaDias: 9 },
  { nome: "Artur Barcelos", verdes: 5, paradoDias: 93, ultimaDias: 15 },
  { nome: "Beatriz Nogueira", verdes: 7, paradoDias: 4, ultimaDias: 4 },
  { nome: "Caio Pinheiro", verdes: 3, paradoDias: 7, ultimaDias: 7 },
  { nome: "Cintia Santana", verdes: 4, paradoDias: 11, ultimaDias: 11 },
  { nome: "Diego Marques", verdes: 0, paradoDias: null, ultimaDias: 0 },
  { nome: "Eduarda Lima", verdes: 7, paradoDias: 6, ultimaDias: 6 },
  { nome: "Fábio Rocha", verdes: 2, paradoDias: 8, ultimaDias: 8 },

  // --- travados (8 no total, todos no módulo 6) ---------------------------
  { nome: "Oziel Silva", verdes: 5, paradoDias: 92, ultimaDias: 18 },
  { nome: "Neusa Jorge", verdes: 5, paradoDias: 90, ultimaDias: 16 },
  { nome: "Ribeiro Preto", verdes: 5, paradoDias: 88, ultimaDias: 20 },
  { nome: "Lucas Ferreira", verdes: 5, paradoDias: 86, ultimaDias: 21 },
  { nome: "Igor Bastos", verdes: 5, paradoDias: 80, ultimaDias: 23 },
  { nome: "Karina Melo", verdes: 5, paradoDias: 75, ultimaDias: 25 },
  { nome: "Tadeu Rosa", verdes: 5, paradoDias: 70, ultimaDias: 27 },

  // --- perdendo ritmo (15 no total) ---------------------------------------
  // As TRÊS alavancas da rodada 3 estão nesta lista, e nenhuma delas escreve um
  // número de tela — todas mexem em dado bruto e deixam o motor recalcular:
  //
  //   1. Rafael Quintana, `verdes` 1 → 2.
  //   2. Otávio Guimarães, `verdes` 3 → 4.
  //      Juntas, movem o histograma de v = (4,4,2,6,3,8,1,12) para
  //      (4,3,3,5,4,8,1,12) e produzem DOIS efeitos: o gargalo do módulo 5
  //      ("Ações Corretivas") sobe de 3 para 4 e passa o do módulo 2, entrando
  //      na 3ª linha — que é onde a referência o coloca; e a coluna `Conversão`
  //      troca o par (75%, 60%) das linhas 3 e 4 pelo par (83%, 75%) das linhas
  //      2 e 3, mantendo TRÊS células idênticas ao mockup e ganhando o rótulo.
  //   3. Juliana Peixoto ganha `matriculaDias: 15`.
  //      Com os dois primeiros movimentos, os módulos 2 e 3 ficam ambos com 3
  //      pessoas e as barras 4ª e 5ª empatam — V-21 pede comprimento
  //      ESTRITAMENTE decrescente. Uma matrícula recente baixa o ritmo
  //      ESPERADO (`computeBehindAndProgress`: 15/60 = 25% contra os 29% que
  //      ela já percorreu), então ela deixa de estar atrasada e sai da
  //      população do gargalo (F-08) sem sair do roster, do tile
  //      `Em andamento` nem da matriz. O empate se desfaz em 3 × 2.
  { nome: "Gabriel Tavares", verdes: 1, paradoDias: 5, ultimaDias: 5 },
  { nome: "Helena Duarte", verdes: 1, paradoDias: 12, ultimaDias: 12 },
  { nome: "Isadora Freitas", verdes: 1, paradoDias: 6, ultimaDias: 6 },
  { nome: "Juliana Peixoto", verdes: 2, matriculaDias: 15, paradoDias: 10, ultimaDias: 10 },
  { nome: "Leandro Vieira", verdes: 3, paradoDias: 5, ultimaDias: 5 },
  { nome: "Marcos Teixeira", verdes: 3, paradoDias: 9, ultimaDias: 9 },
  { nome: "Mariana Alves", verdes: 3, paradoDias: 12, ultimaDias: 12 },
  { nome: "Natália Cordeiro", verdes: 3, paradoDias: 6, ultimaDias: 6 },
  { nome: "Otávio Guimarães", verdes: 4, paradoDias: 13, ultimaDias: 13 },
  { nome: "Patrícia Moura", verdes: 4, paradoDias: 7, ultimaDias: 7 },
  { nome: "Rafael Quintana", verdes: 2, paradoDias: 10, ultimaDias: 10 },

  // --- concluíram a jornada (12 no total) ---------------------------------
  { nome: "Luiza Andrade", verdes: 7, paradoDias: 3, ultimaDias: 3 },
  { nome: "Paulo Sérgio Braga", verdes: 7, paradoDias: 5, ultimaDias: 5 },
  { nome: "Raquel Bittencourt", verdes: 7, paradoDias: 7, ultimaDias: 7 },
  { nome: "Renata Coelho", verdes: 7, paradoDias: 8, ultimaDias: 8 },
  { nome: "Rodrigo Sales", verdes: 7, paradoDias: 9, ultimaDias: 9 },
  { nome: "Samuel Nunes", verdes: 7, paradoDias: 10, ultimaDias: 10 },
  { nome: "Sofia Machado", verdes: 7, paradoDias: 11, ultimaDias: 11 },
  { nome: "Talita Campos", verdes: 7, paradoDias: 12, ultimaDias: 12 },
  { nome: "Thiago Barros", verdes: 7, paradoDias: 13, ultimaDias: 13 },
  { nome: "Valentina Ramos", verdes: 7, paradoDias: 14, ultimaDias: 14 },

  // --- perdendo ritmo no módulo 7, o 6º módulo elegível (ver `matriculaDias`) --
  { nome: "Vitória Assis", verdes: 6, paradoDias: 2, ultimaDias: 2, matriculaDias: 58 },

  // --- nunca iniciaram (4 no total) ----------------------------------------
  { nome: "Jonas Ribeiro", verdes: 0, paradoDias: null, ultimaDias: 0 },
  { nome: "Sabrina Xavier", verdes: 0, paradoDias: null, ultimaDias: 0 },
  { nome: "Vinícius Lopes", verdes: 0, paradoDias: null, ultimaDias: 0 },
]

const alunoId = (i: number) => `aluno-${String(i + 1).padStart(2, "0")}`

/**
 * A cadeia de carimbos entre `paradoDias` e `ultimaDias`, passo de 6 dias.
 *
 * NÃO é enfeite. `projetarEstado` testa `retomouNaJanela` ANTES de `parado`:
 * quem some por 78 dias e reaparece dentro da janela é `retomando`, não
 * `parado`. Sem esta cadeia, os oito travados desta fixture sairiam como
 * `retomando`, o bloco §26 sumiria por F-21 e o insight de 20% não existiria —
 * a fixture estaria medindo outra tela.
 */
function cadeiaDeCarimbos(de: number, ate: number): number[] {
  const dias: number[] = []
  for (let d = de - 6; d > ate; d -= 6) dias.push(d)
  dias.push(ate)
  return dias
}

export function entradaMapaFixture(): EntradaMapaJornada {
  const alunos = PESSOAS.map((p, i) => ({ id: alunoId(i), nome: p.nome }))
  const escopo = alunos.map((a) => a.id)

  const capitulos = TITULOS_MODULO.map((titulo, i) => ({
    id: capituloId(i),
    cursoId: CURSO,
    titulo,
    ordem: i,
    status: "published",
  }))

  // Laço explícito, e NÃO `Array.from({length})`: o detector de cobertura de
  // I-4 (`f-32`) conta ocorrências de `.from(` para saber quais arquivos falam
  // com o Supabase, e `Array.from(` cai na mesma regex. Trocar a forma aqui é
  // mais barato — e mais honesto — que afrouxar o detector que me mede.
  const slides: SlideBrutoMapa[] = []
  for (let i = 0; i < TITULOS_MODULO.length; i++) {
    for (let s = 0; s < SLIDES_POR_CAPITULO; s++) {
      slides.push({ id: `${capituloId(i)}-slide${s + 1}`, capituloId: capituloId(i), ordem: s })
    }
  }

  // Todo mundo matriculado no curso único: é o que faz `Chegaram` valer 40 nas
  // sete linhas (F-22 · achado A-2, o produto não trava módulo).
  const matriculas = PESSOAS.map((p, i) => ({
    alunoId: alunoId(i),
    cursoId: CURSO,
    status: "active" as const,
    criadaEmISO: diasAtras(p.matriculaDias ?? MATRICULA_DIAS),
  }))

  const sessoes: SessaoBrutaMapa[] = []
  const percorrido: PercorridoBrutoMapa[] = []

  PESSOAS.forEach((p, i) => {
    const id = alunoId(i)
    if (p.paradoDias === null) return // linha inteira cinza, sem carimbo nenhum

    if (p.verdes >= TITULOS_MODULO.length) {
      // Linha inteira verde: telemetria que chega ao último slide do módulo 7.
      // O piso cumulativo cuida de 1..6 — não há linha inventada para eles.
      const capitulo = capituloId(TITULOS_MODULO.length - 1)
      percorrido.push({
        alunoId: id,
        capituloId: capitulo,
        maxSlideIndex: SLIDES_POR_CAPITULO - 1,
        slidesTotalNaPassagem: SLIDES_POR_CAPITULO,
        chegouAoFimISO: diasAtras(p.paradoDias),
        ultimaVistaISO: diasAtras(p.paradoDias),
      })
      sessoes.push({
        alunoId: id,
        capituloId: capitulo,
        status: "completed",
        criadaEmISO: diasAtras(p.paradoDias),
      })
      return
    }

    // Módulo corrente: uma sessão nele deixa a célula LARANJA (F-04, "qualquer
    // status conta") e, pelo piso, tudo abaixo VERDE (F-03).
    const corrente = capituloId(p.verdes)
    sessoes.push({
      alunoId: id,
      capituloId: corrente,
      status: "abandoned",
      criadaEmISO: diasAtras(p.paradoDias),
    })

    // Atividade posterior em módulo JÁ concluído: é o par do mockup (`Parado há
    // 93 dias` com `Última atividade 15 dias atrás`) e a prova viva de que F-19
    // e F-20 não são a mesma consulta com dois rótulos.
    if (p.ultimaDias < p.paradoDias && p.verdes > 0) {
      const revisitado = capituloId(p.verdes - 1)
      for (const dia of cadeiaDeCarimbos(p.paradoDias, p.ultimaDias)) {
        sessoes.push({
          alunoId: id,
          capituloId: revisitado,
          status: "completed",
          criadaEmISO: diasAtras(dia),
        })
      }
    }
  })

  return {
    agoraISO: AGORA_FIXTURE,
    periodoDias: 30,
    escopo,
    alunos,
    cursos: [{ id: CURSO, titulo: CURSO_TITULO, deadlineDays: PRAZO_DIAS }],
    capitulos,
    slides,
    matriculas,
    percorrido,
    sessoes,
    // I-7 · nenhuma reflexão nesta fixture, e nenhum campo capaz de carregar o
    // texto de uma. A presença de reflexão já é exercitada pelos testes.
    reflexoes: [],
    tenantId: "fixture",
    contexto: { cursoFiltroNome: null },
  }
}
