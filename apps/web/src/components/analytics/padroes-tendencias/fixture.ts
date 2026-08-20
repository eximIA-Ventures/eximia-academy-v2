// ---------------------------------------------------------------------------
// Mundo sintético determinístico da aba "Padrões e tendências".
// ---------------------------------------------------------------------------
// ATENÇÃO AO QUE ESTE ARQUIVO **NÃO** É, porque é a lição mais cara da tela
// anterior: isto NÃO é uma saída pronta de `PadroesTendenciasDados`. É o mundo
// BRUTO — pessoas, carimbos, matrículas e capítulos — que o preview empurra
// pelo MESMO motor que a produção executa (`computePadroesTendencias`).
//
// A diferença importa: na tela anterior o preview desenhava uma fixture com os
// números já escritos, então uma correção feita no motor existia no código e
// NÃO aparecia na tela de inspeção. Quem olhava aprovava o defeito corrigido.
// Aqui não há número escrito à mão: todo valor que aparece na tela de preview
// foi calculado agora, pelo código de produção, a partir das linhas abaixo.
// Quebre o motor e o modo fixture quebra junto — que é exatamente o que se quer
// de um trilho de comparação.
//
// O relógio é CONGELADO (`AGORA_FIXTURE`). O modo fixture existe para a
// comparação visual do loop ser byte a byte reprodutível; o modo motor, que lê
// o banco, é o default da rota.
// ---------------------------------------------------------------------------

import type {
  AlunoBruto,
  AtividadeBruta,
  CapituloBruto,
  CursoBruto,
  EntradaVisaoGeral,
  MatriculaBruta,
} from "@/lib/analytics/padroes-tendencias"

/** Instante congelado do mundo sintético. */
export const AGORA_FIXTURE = "2026-08-17T12:00:00.000Z"

const AGORA_MS = Date.parse(AGORA_FIXTURE)
const DIA_MS = 86_400_000

/** Período do recorte sintético. Os 30 dias do PNG aprovado. */
export const PERIODO_FIXTURE = 30

/**
 * ISO de `n` dias atrás, às 10h UTC.
 *
 * A hora fixa em 10h contra um "agora" de 12h é deliberada: todo carimbo cai a
 * 2h DENTRO do dia, longe da fronteira de balde semanal. Sem isso, o índice de
 * semana de um offset ficaria a um minuto de arredondamento de virar outro, e o
 * mundo deixaria de ser determinístico exatamente onde ele precisa ser.
 */
function diasAtras(n: number): string {
  const diaUtc = new Date(AGORA_MS - n * DIA_MS).toISOString().slice(0, 10)
  return `${diaUtc}T10:00:00.000Z`
}

const CURSO: CursoBruto = { id: "curso-fixture", deadlineDays: 90 }

/** Os quatro módulos do PNG aprovado, na ordem de currículo. */
const CAPITULOS: readonly CapituloBruto[] = [
  { id: "mod-1", courseId: CURSO.id, titulo: "Executar Ações Corretivas", ordem: 1 },
  { id: "mod-2", courseId: CURSO.id, titulo: "Monitoramento dos Resultados", ordem: 2 },
  { id: "mod-3", courseId: CURSO.id, titulo: "Análise de Causa", ordem: 3 },
  { id: "mod-4", courseId: CURSO.id, titulo: "Ações Corretivas", ordem: 4 },
]

// ---------------------------------------------------------------------------
// O CALENDÁRIO DO MUNDO
// ---------------------------------------------------------------------------
// Um só lugar declara em que dias qualquer pessoa deste mundo pode aparecer, e
// a razão é dura: em `montarBasePadroes` TUDO se decide por dia UTC distinto —
// regularidade (§20), estado da jornada (§21), retomada (§4), balde semanal
// (§17) e as duas janelas comparáveis (§16). Um dia solto acrescentado sem
// pensar move quatro blocos ao mesmo tempo, em direções que não se percebem
// olhando um deles.
//
// Janela de 30 dias = 4 semanas cheias. Os baldes da série (8 semanas, F-10)
// mapeiam exatamente assim, contados de HOJE para trás:
//
//   balde 7 → 1..7 dias atrás    balde 3 → 29..35   (janela ANTERIOR)
//   balde 6 → 8..14              balde 2 → 36..42
//   balde 5 → 15..21             balde 1 → 43..49
//   balde 4 → 22..28             balde 0 → 50..56
//
// A hora de 10h contra um "agora" de 12h põe todo carimbo 2h DENTRO do dia,
// longe da fronteira de balde: sem isso o índice de semana ficaria a um
// arredondamento de virar outro.
const D = {
  /** Dias da janela ATUAL, um por balde, do mais recente ao mais antigo. */
  agora: { b7: 3, b6: 10, b5: 15, b4: 25 },
  /** O segundo dia da semana, que é o que separa "2x ou mais" de "1x". */
  agoraSegundo: { b6: 8, b5: 17 },
  /** Dias da janela ANTERIOR. `b3`/`b2` em pares, para caber a regularidade. */
  antes: { b3: 31, b3b: 34, b2: 38, b2b: 41, b1: 45, b0: 52 },
  /** Fora das duas janelas: existe histórico, mas nada a comparar. */
  arqueologia: 70,
} as const

// ---------------------------------------------------------------------------
// OS SEIS PERFIS, e o que cada um produz nos seis blocos
// ---------------------------------------------------------------------------
// O recorte tem 100 pessoas. O número não é estético: ele é o DENOMINADOR de
// todo percentual da tela (F-30), e com 100 os tamanhos de grupo abaixo são
// lidos diretamente como o percentual que a §20 vai imprimir. Um mundo em que
// é preciso fazer conta para saber o que a tela deveria dizer não serve de
// trilho de comparação.
//
//  perfil     n   §20 participação   §21 estado        por que existe
//  ────────────────────────────────────────────────────────────────────────
//  REGULAR    32  2x ou mais/semana  sustentando       o corpo saudável
//  UMA_VEZ    28  1x/semana          sust. / desacel.  a migração que faz a
//                                                      regularidade CAIR
//  RETOMOU    12  irregular          retomando         pausa longa + volta
//  MORNO       8  irregular          desacelerando     entrou e não voltou
//  SUMIU       5  irregular          parado            ativo, mas há 20 dias
//  AUSENTE    10  sem atividade      parado            só histórico anterior
//  FORMADO     3  sem atividade      concluído         some dos 4 cards (F-37)
//  NOVO        2  sem atividade      não iniciou       idem, e nunca sai do
//                                                      denominador (lição 4)
//
// §20 fecha em 32 / 28 / 25 / 15 — que somam 100 e são, por construção, os
// percentuais que a barra empilhada da §20 vai desenhar.

/** 2 dias em cada uma de 2 semanas cheias → REGULAR agora (§8.2). */
const REGULAR_AGORA: readonly number[] = [
  D.agora.b7,
  D.agoraSegundo.b6,
  D.agora.b6,
  D.agora.b5,
  D.agoraSegundo.b5,
  D.agora.b4,
]

/**
 * Um dia em CADA uma das 4 semanas cheias.
 *
 * Presente em todas as semanas e ainda assim NÃO regular — é exatamente o
 * ponto: quem estuda toda semana, uma vez só, cai em "1x/semana", e a diferença
 * entre este perfil e o de cima é a única coisa que a §20 mede.
 */
const UMA_VEZ_AGORA: readonly number[] = [
  D.agora.b7,
  D.agora.b6 - 1,
  D.agora.b5 + 1,
  D.agora.b4 - 2,
]

/** 2 dias em cada um de 2 baldes da janela anterior → REGULAR antes. */
const REGULAR_ANTES: readonly number[] = [D.antes.b3, D.antes.b3b, D.antes.b2, D.antes.b2b]

/**
 * Presença na janela anterior SEM regularidade, mais o dia b0.
 *
 * O `b0` não é enfeite: sem um carimbo no balde mais antigo a série abriria em
 * zero, e um gráfico que começa no chão comunica "a equipe nasceu semana
 * passada" quando o que houve foi a borda da janela.
 */
const PRESENTE_ANTES: readonly number[] = [D.antes.b3 + 1]

interface Perfil {
  prefixo: string
  quantos: number
  dias: readonly number[]
  progresso: number
  status?: "active" | "completed" | "cancelled"
  semMatricula?: boolean
}

/**
 * Progresso 80 contra ~50 esperado (matrícula a 45 dias de um prazo de 90):
 * dentro do ritmo. Progresso 12 contra os mesmos ~50: atrasado. É só por este
 * par de números que a §21 separa "sustentando" de "desacelerando", e é por
 * isso que ele está nomeado em vez de espalhado como literal.
 */
const NO_RITMO = 80
const ATRASADO = 12

const PERFIS: readonly Perfil[] = [
  // --- 2x ou mais/semana (32) --------------------------------------------
  {
    prefixo: "regular",
    quantos: 32,
    dias: [...REGULAR_AGORA, ...REGULAR_ANTES, D.antes.b0],
    progresso: NO_RITMO,
  },

  // --- 1x/semana (28), partido em dois pelo PROGRESSO --------------------
  // Os 6 primeiros eram REGULARES na janela anterior e não são mais: são eles,
  // e só eles, que fazem a regularidade cair de 38% para 32% — os −6 p.p. que
  // aparecem em TRÊS lugares da tela (§16, §18 e §20) e saem de UMA conta só.
  {
    prefixo: "caiu",
    quantos: 6,
    dias: [...UMA_VEZ_AGORA, ...REGULAR_ANTES],
    progresso: NO_RITMO,
  },
  {
    prefixo: "uma-ok",
    quantos: 7,
    dias: [...UMA_VEZ_AGORA, ...PRESENTE_ANTES],
    progresso: NO_RITMO,
  },
  {
    prefixo: "uma-atras",
    quantos: 15,
    dias: [...UMA_VEZ_AGORA, ...PRESENTE_ANTES],
    progresso: ATRASADO,
  },

  // --- irregular (25) ----------------------------------------------------
  // Uma pausa de 41 dias com retorno DENTRO da janela: "retomando" (§4) ganha
  // de "parado", porque quem voltou é notícia melhor que o motivo do sumiço.
  { prefixo: "retomou", quantos: 12, dias: [D.antes.b1, D.agora.b7 + 1], progresso: ATRASADO },
  // Um dia só, recente: aparece na tela como irregular e atrasado, nunca parado.
  { prefixo: "morno", quantos: 8, dias: [D.agora.b6 + 1], progresso: ATRASADO },
  // Ativo DENTRO da janela e ainda assim parado: 20 dias sem voltar. É o caso
  // que um filtro ingênuo de "teve atividade no período?" classificaria como
  // saudável.
  { prefixo: "sumiu", quantos: 5, dias: [D.agora.b5 + 5], progresso: ATRASADO },

  // --- sem atividade (15) ------------------------------------------------
  { prefixo: "ausente", quantos: 10, dias: [D.antes.b1], progresso: 8 },
  {
    prefixo: "formado",
    quantos: 3,
    dias: [D.arqueologia],
    progresso: 100,
    status: "completed",
  },
  { prefixo: "novo", quantos: 2, dias: [], progresso: 0, semMatricula: true },
]

// ---------------------------------------------------------------------------
// O TRÁFEGO POR MÓDULO (§18 e §19)
// ---------------------------------------------------------------------------
// DUAS DECISÕES ESTRUTURAIS, e as duas existem porque a alternativa já falhou:
//
// 1. Quem visita módulo é gente que JÁ EXISTE no recorte (os `regular`), não um
//    grupo novo. Inventar pessoas para o §19 inflaria o denominador de todos os
//    outros blocos — a rodada anterior tinha 91 pessoas no recorte, das quais 45
//    só existiam para dar tráfego a capítulo, e a §20 media um mundo que não é o
//    da §21.
//
// 2. O carimbo de módulo cai num dia que a pessoa JÁ TEM. Assim ele não cria dia
//    UTC novo, e portanto não move regularidade, estado, retomada nem balde.
//    Antes o carimbo de "ponte" carregava capítulo e caía a 24 dias, DENTRO da
//    janela atual: toda pessoa contada no período anterior reaparecia no atual,
//    a variação dava exatamente zero e a §19 saía VAZIA num mundo construído
//    inteiro para ter gargalo.
//
// `antes` é a contagem no período anterior; `semanal` são os três últimos
// baldes, encaixados (`i < quantos`), então a contagem da janela ATUAL é o maior
// deles. Os quatro pares produzem, por divisão, os quatro valores do PNG:
// 9/11 = −18% · 11/13 = −15% · 8/9 = −11% · 11/12 = −8%.
//
// Só `mod-1` cai SEMANA A SEMANA (9 → 7 → 5): é o único que produz o sinal de
// recorrência da §18. Os outros três caem contra o período anterior sem
// desacelerar dentro dele — que é outra coisa, e a tela não pode confundir as
// duas.
const TRAFEGO_POR_MODULO: readonly { capituloId: string; antes: number; semanal: number[] }[] = [
  { capituloId: "mod-1", antes: 11, semanal: [9, 7, 5] },
  { capituloId: "mod-2", antes: 13, semanal: [11, 11, 11] },
  { capituloId: "mod-3", antes: 9, semanal: [8, 8, 8] },
  { capituloId: "mod-4", antes: 12, semanal: [11, 11, 11] },
]

/** Os três baldes recentes em que o tráfego de módulo é medido, do mais antigo. */
const SEMANAS_DO_MODULO: readonly number[] = [D.agora.b5, D.agora.b6, D.agora.b7]

/** O dia da janela anterior em que o módulo é medido. */
const SEMANA_ANTERIOR_DO_MODULO = D.antes.b3

interface PessoaFixture {
  id: string
  /** Offsets em dias: cada um vira uma sessão sem capítulo. */
  sessoes: readonly number[]
  /** Offsets por capítulo: é daqui que saem §18 (recorrência) e §19 (queda). */
  porCapitulo: Readonly<Record<string, readonly number[]>>
  matricula: { status: "active" | "completed" | "cancelled"; progresso: number } | null
}

/** As 100 pessoas do recorte, montadas a partir dos perfis. */
function pessoas(): PessoaFixture[] {
  const lista: PessoaFixture[] = []
  for (const p of PERFIS) {
    for (let i = 0; i < p.quantos; i++) {
      lista.push({
        id: `${p.prefixo}-${i}`,
        sessoes: p.dias,
        porCapitulo: {},
        matricula: p.semMatricula ? null : { status: p.status ?? "active", progresso: p.progresso },
      })
    }
  }
  return lista
}

/**
 * Espalha o tráfego de módulo sobre as pessoas do perfil `regular`.
 *
 * Muta as pessoas que já existem, de propósito: o recorte não cresce, e cada
 * carimbo de capítulo cai num dia que aquela pessoa já tinha.
 */
function aplicarTrafegoDeModulo(lista: PessoaFixture[]): void {
  const pool = lista.filter((p) => p.id.startsWith("regular-"))
  for (const m of TRAFEGO_POR_MODULO) {
    const alcance = Math.max(m.antes, ...m.semanal)
    for (let i = 0; i < alcance; i++) {
      const pessoa = pool[i]
      if (pessoa === undefined) continue
      const dias: number[] = []
      if (i < m.antes) dias.push(SEMANA_ANTERIOR_DO_MODULO)
      SEMANAS_DO_MODULO.forEach((dia, s) => {
        if (i < (m.semanal[s] ?? 0)) dias.push(dia)
      })
      if (dias.length === 0) continue
      pessoa.porCapitulo = { ...pessoa.porCapitulo, [m.capituloId]: dias }
    }
  }
}

/** O mundo bruto que o motor recebe. Puro, congelado, sem I/O. */
export function entradaFixture(): EntradaVisaoGeral {
  const todas = pessoas()
  aplicarTrafegoDeModulo(todas)

  const alunos: AlunoBruto[] = []
  const atividades: AtividadeBruta[] = []
  const matriculas: MatriculaBruta[] = []

  for (const p of todas) {
    // O nome existe no mundo BRUTO de propósito: é a única forma de F-42 provar
    // que ele não vaza para a saída. Um mundo sem nomes tornaria a prova vazia.
    alunos.push({ id: p.id, nome: `Pessoa ${p.id}` })

    for (const offset of p.sessoes) {
      atividades.push({ studentId: p.id, createdAt: diasAtras(offset), tipo: "sessao" })
    }
    for (const [capituloId, offsets] of Object.entries(p.porCapitulo)) {
      for (const offset of offsets) {
        atividades.push({
          studentId: p.id,
          createdAt: diasAtras(offset),
          tipo: "sessao",
          chapterId: capituloId,
        })
      }
    }

    if (p.matricula === null) continue
    matriculas.push({
      studentId: p.id,
      courseId: CURSO.id,
      status: p.matricula.status,
      // 45 dias atrás contra um prazo de 90: metade do curso decorrida, então o
      // progresso esperado é ~50%. Com a matrícula a 120 dias (mais que o
      // prazo inteiro), TODA pessoa ficava atrasada e a §21 saía com
      // "Sustentando 0" — um mundo em que ninguém pode estar no ritmo não
      // exercita a categoria que a tela mais precisa mostrar.
      createdAt: diasAtras(45),
      progressPercent: p.matricula.progresso,
    })
  }

  return {
    agoraISO: AGORA_FIXTURE,
    periodoDias: PERIODO_FIXTURE,
    gestorId: "gestor-fixture",
    escopo: todas.map((p) => p.id),
    alunos,
    atividades,
    acionamentos: [],
    matriculas,
    cursos: [CURSO],
    capitulos: CAPITULOS,
    tenantId: "tenant-fixture",
  }
}
