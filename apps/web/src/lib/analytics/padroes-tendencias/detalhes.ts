// ---------------------------------------------------------------------------
// O QUE CADA "ver tudo" DESTA ABA MOSTRA — os 7 CTAs deixando de ser decorativos.
// ---------------------------------------------------------------------------
// Os sete rótulos acionáveis desta tela (`F-44`) eram `<span>` inertes. Isso era
// correto enquanto não existia destino: um CTA que navega para lugar errado é
// pior que um rótulo mudo. Agora cada um tem conteúdo, e o conteúdo é sempre
// MAIS do que o bloco já mostra — senão o CTA continua morto, só que disfarçado
// de vivo, que é a pior das três situações.
//
// A regra que governa cada item abaixo: o bloco na tela é um CORTE (4 mudanças,
// 12 semanas de gráfico, 4 módulos, 3 sinais), e a gaveta é o conjunto de onde
// aquele corte saiu. Nenhum número novo nasce aqui — todos vêm de `BasePadroes`,
// a MESMA estrutura que os blocos leem. Dois caminhos para o mesmo fato divergem
// em silêncio (foi o que aconteceu com o percentual do tile contra o da frase no
// Mapa, 72% x 71%), então este arquivo lê a base e nunca reconta o banco.
//
// Função PURA, sem `Date.now()` e sem `process.env`: mesma disciplina de
// `montagem.ts`, pelo mesmo motivo (o teste desloca o tempo sem mock).
//
// I-7: nada aqui toca reflexão. As tabelas são de MÓDULO, SEMANA e INDICADOR;
// a única que nomeia gente é a de participação, e ela nomeia por FAIXA DE
// FREQUÊNCIA, que é contagem de dia, não conteúdo.
// ---------------------------------------------------------------------------

import type { AlinhamentoColuna, ConteudoGaveta } from "@/lib/analytics/gaveta/tipos"
import { chaveDiaUtc, semanasCheias } from "../visao-geral/dia-utc"
import type { BasePadroes } from "./base"
import { montarLeituraAssistida } from "./leitura"
import { REGULARIDADE_MIN_DIAS_NA_SEMANA } from "./parametros"
import { ROTULO_FAIXA } from "./textos"

/** Chaveado pelo `Acao.id` que cada bloco emite. Um destino por CTA. */
export type DetalhesPadroes = Record<string, ConteudoGaveta>

const PCT = (parte: number, total: number): string =>
  total > 0 ? `${Math.round((parte / total) * 100)}%` : "—"

/** "−18%" com o menos tipográfico da casa, e "+3" com sinal explícito. */
function comSinal(n: number, sufixo = ""): string {
  if (n > 0) return `+${n}${sufixo}`
  if (n < 0) return `−${Math.abs(n)}${sufixo}`
  return `0${sufixo}`
}

/**
 * §15 — "Como ler esta visão".
 *
 * Glossário, não prompt: cada linha é a régua que o código já obedece, escrita
 * por extenso. Era o único dos sete CTAs cujo destino natural nunca foi uma
 * lista longa, e por isso ele é o que mais corria risco de virar um modal vazio
 * de boas-vindas. O critério aqui é: só entra termo cujo valor numérico
 * apareceu em algum lugar da tela.
 */
function comoLer(base: BasePadroes): ConteudoGaveta {
  const semanas = semanasCheias(base.visao.janelas.duracaoMs)
  return {
    tipo: "tabela",
    titulo: "Como ler esta visão",
    subtitulo: "Os critérios por trás de cada número desta aba.",
    nota: "São as regras que o cálculo obedece hoje, não uma descrição aproximada delas.",
    colunas: ["Termo", "Critério"],
    alinhamentos: ["esquerda", "esquerda"],
    linhas: [
      [
        "Período comparado",
        `Os ${Math.round(base.visao.janelas.duracaoMs / 86_400_000)} dias atuais contra os ${Math.round(
          base.visao.janelas.duracaoMs / 86_400_000,
        )} imediatamente anteriores, sobre o MESMO conjunto de pessoas.`,
      ],
      ["Pessoa ativa", "Teve ao menos uma sessão de aprendizagem iniciada ou retomada na janela."],
      [
        "Regularidade",
        `Atividade em ${REGULARIDADE_MIN_DIAS_NA_SEMANA}+ dias distintos na maioria das semanas cheias do período (${semanas} ${
          semanas === 1 ? "semana" : "semanas"
        } nesta janela).`,
      ],
      [
        "Semana",
        "Blocos de 7 dias contados para trás a partir do fim do período, em UTC — a mesma chave de dia em qualquer máquina.",
      ],
      [
        "Sinal emergente",
        "Padrão que se repete em 2+ períodos consecutivos ou ultrapassa o limiar configurado. Um pico isolado não entra.",
      ],
      [
        "Queda por módulo",
        "Só entram módulos com base mínima no período anterior. Sem base, a variação percentual é ruído, não tendência.",
      ],
      [
        "Sem comparação",
        "Quando a janela anterior não tem carimbo algum, a variação some da tela em vez de aparecer como 0.",
      ],
    ],
    textoVazio: "",
  }
}

/**
 * §16 — "Ver todas as mudanças".
 *
 * O bloco mostra no máximo 4 e descarta as irrelevantes. A gaveta mostra as
 * QUATRO DIMENSÕES medidas com atual, anterior e variação, inclusive as que não
 * passaram no corte de relevância. É a diferença entre "não mudou nada" e "mudou
 * pouco", que o bloco não consegue dizer.
 */
function todasAsMudancas(base: BasePadroes): ConteudoGaveta {
  const { visao, regularidade } = base
  const linhas: string[][] = [
    [
      "Pessoas ativas",
      String(visao.ativosNoPeriodo.size),
      String(visao.ativosNoPeriodoAnterior.size),
      comSinal(visao.ativosNoPeriodo.size - visao.ativosNoPeriodoAnterior.size),
    ],
    [
      "Regularidade",
      `${regularidade.taxaAtualPct}%`,
      regularidade.taxaAnteriorPct === null ? "—" : `${regularidade.taxaAnteriorPct}%`,
      regularidade.deltaPp === null ? "sem comparação" : comSinal(regularidade.deltaPp, " p.p."),
    ],
    [
      "Sessões realizadas",
      String(visao.sessoesNoPeriodo),
      String(visao.sessoesNoPeriodoAnterior),
      comSinal(visao.sessoesNoPeriodo - visao.sessoesNoPeriodoAnterior),
    ],
    [
      "Módulos em queda",
      String(base.variacaoPorModulo.filter((m) => m.variacao < 0).length),
      `de ${base.variacaoPorModulo.length} com base comparável`,
      "—",
    ],
  ]
  return {
    tipo: "tabela",
    titulo: "Todas as mudanças do período",
    subtitulo: "As quatro dimensões medidas, inclusive as que não passaram no corte de relevância.",
    nota: "O bloco na tela mostra só as mudanças com implicação para a jornada. Aqui estão todas as medidas.",
    colunas: ["Indicador", "Atual", "Anterior", "Variação"],
    alinhamentos: ["esquerda", "direita", "direita", "direita"],
    linhas,
    textoVazio: "Não há período anterior com que comparar.",
    // ÚNICO ponto de IA das três telas, e ele mora aqui por semântica, não por
    // conveniência: o trabalho que a regra faz mal é costurar estas quatro
    // variações numa leitura só, e é exatamente o que esta gaveta contém.
    leituraAssistida: montarLeituraAssistida(base),
  }
}

/**
 * §17 — "Ver detalhes da série histórica".
 *
 * O gráfico desenha duas linhas; a gaveta dá os números por trás delas, semana a
 * semana, mais a razão sessões/pessoa — que é a leitura que a §17 pede
 * ("menos pessoas entrando, ou as mesmas pessoas estudando menos?") e que o
 * desenho sozinho não entrega.
 */
function serieHistorica(base: BasePadroes): ConteudoGaveta {
  const linhas = base.semanas.map((semana, i) => {
    const ativos = base.ativosPorSemana[i] ?? 0
    const sessoes = base.sessoesPorSemana[i] ?? 0
    return [
      semana.rotulo,
      String(ativos),
      String(sessoes),
      ativos > 0 ? (sessoes / ativos).toFixed(1) : "—",
    ]
  })
  return {
    tipo: "tabela",
    titulo: "Série histórica, semana a semana",
    subtitulo: "Pessoas ativas, sessões realizadas e a razão entre as duas.",
    nota: "Semanas cheias em UTC. A razão responde se caiu gente ou caiu intensidade — o gráfico mostra as duas curvas, não o quociente.",
    colunas: ["Semana", "Pessoas ativas", "Sessões", "Sessões por pessoa"],
    alinhamentos: ["esquerda", "direita", "direita", "direita"],
    linhas,
    textoVazio:
      "Precisamos de pelo menos dois períodos de atividade para identificar uma tendência.",
  }
}

/**
 * §18 — "Ver todos os sinais".
 *
 * O bloco mostra no máximo 3 sinais, escolhidos por recorrência. A EVIDÊNCIA de
 * onde eles saem é a atividade por módulo, semana a semana — a gaveta publica
 * essa evidência inteira, para o gestor poder discordar da seleção em vez de ter
 * que confiar nela.
 */
function todosOsSinais(base: BasePadroes): ConteudoGaveta {
  const colunas = ["Módulo", ...base.semanas.map((s) => s.rotulo)]
  return {
    tipo: "tabela",
    titulo: "Atividade por módulo, semana a semana",
    subtitulo: "A evidência de onde os sinais emergentes são extraídos.",
    nota: "Pessoas distintas com atividade naquele módulo, na semana. Um sinal só entra no bloco quando se repete; aqui está a série completa.",
    colunas,
    alinhamentos: colunas.map<AlinhamentoColuna>((_, i) => (i === 0 ? "esquerda" : "direita")),
    linhas: base.seriesPorModulo.map((s) => [s.titulo, ...s.ativosPorSemana.map(String)]),
    textoVazio: "Nenhum sinal relevante fora do padrão foi identificado.",
  }
}

/**
 * §19 — "Ver comparação completa".
 *
 * O bloco mostra os 4 módulos que MAIS caíram. A gaveta mostra todos os que têm
 * base comparável, inclusive os que subiram — sem eles, a tela afirma queda
 * generalizada quando talvez a atividade só tenha migrado de módulo.
 */
function comparacaoCompleta(base: BasePadroes): ConteudoGaveta {
  const linhas = base.variacaoPorModulo.map((m) => [
    m.titulo,
    String(m.ativosAtual),
    String(m.ativosAnterior),
    comSinal(Math.round(m.variacao * 100), "%"),
  ])
  return {
    tipo: "tabela",
    titulo: "Comparação completa por módulo",
    subtitulo: "Todos os módulos com base comparável, em queda ou em alta.",
    nota: "O bloco na tela mostra só as maiores quedas. Módulos sem base mínima no período anterior ficam fora dos dois: variação sobre base ínfima é ruído.",
    colunas: ["Módulo", "Ativos agora", "Ativos antes", "Variação"],
    alinhamentos: ["esquerda", "direita", "direita", "direita"],
    linhas,
    textoVazio: "Nenhum gargalo relevante foi identificado neste período.",
  }
}

/**
 * §20 — "Ver composição por semana".
 *
 * O bloco mostra a composição do PERÍODO INTEIRO. A gaveta abre por semana, que
 * é literalmente o que o rótulo do CTA promete e o que distingue "a equipe é
 * irregular" de "a equipe era regular e parou na terceira semana".
 *
 * A cascata é a MESMA da §20 (`base.ts`), reaplicada semana a semana: 0 dias →
 * sem atividade; ≥2 dias → regular; 1 dia → uma vez. Não há um terceiro critério
 * novo aqui, e por isso a soma de cada linha fecha com o recorte por construção.
 */
function composicaoPorSemana(base: BasePadroes): ConteudoGaveta {
  const total = base.visao.roster.size
  const linhas = base.semanas.map((semana) => {
    let regulares = 0
    let umaVez = 0
    let sem = 0
    for (const id of base.visao.roster) {
      const dias = new Set<string>()
      for (const t of base.visao.carimbosPorAluno.get(id) ?? []) {
        if (t >= semana.inicioMs && t < semana.fimMs) dias.add(chaveDiaUtc(t))
      }
      if (dias.size === 0) sem++
      else if (dias.size >= REGULARIDADE_MIN_DIAS_NA_SEMANA) regulares++
      else umaVez++
    }
    return [
      semana.rotulo,
      `${regulares} · ${PCT(regulares, total)}`,
      `${umaVez} · ${PCT(umaVez, total)}`,
      `${sem} · ${PCT(sem, total)}`,
    ]
  })
  return {
    tipo: "tabela",
    titulo: "Composição semana a semana",
    subtitulo: `Como as ${total} ${total === 1 ? "pessoa" : "pessoas"} do recorte se distribuem em cada semana.`,
    nota: "Mesma cascata do bloco: 2+ dias na semana, 1 dia, nenhum. As três colunas somam o recorte inteiro por construção.",
    colunas: [
      "Semana",
      ROTULO_FAIXA["2x-ou-mais"],
      ROTULO_FAIXA["1x"],
      ROTULO_FAIXA["sem-atividade"],
    ],
    alinhamentos: ["esquerda", "direita", "direita", "direita"],
    linhas,
    textoVazio: "Ainda não há semana cheia com atividade neste recorte.",
  }
}

/**
 * §21 — "Ver critérios de classificação".
 *
 * As quatro categorias e a régua exata de cada uma, mais os DOIS estados que não
 * têm card (concluído e não iniciou) — que é a informação que a nota de
 * cobertura do bloco anuncia e não cabe em uma linha.
 */
function criteriosDeClassificacao(base: BasePadroes): ConteudoGaveta {
  return {
    tipo: "tabela",
    titulo: "Critérios de classificação",
    subtitulo: "O que coloca cada pessoa em cada categoria.",
    nota: "A §4 da especificação tem SEIS estados e este bloco desenha QUATRO cards. Os dois de fora estão nomeados abaixo.",
    colunas: ["Categoria", "Critério", "Pessoas"],
    alinhamentos: ["esquerda", "esquerda", "direita"],
    linhas: [
      [
        "Sustentando",
        "Iniciou, teve atividade recente e o progresso está igual ou acima do esperado para hoje.",
        "no bloco",
      ],
      [
        "Desacelerando",
        "Iniciou e apresenta ao menos um sinal de queda: progresso abaixo do esperado, frequência em queda ou progresso parado.",
        "no bloco",
      ],
      ["Parado", "Já iniciou e está sem atividade de aprendizagem há 14 dias ou mais.", "no bloco"],
      [
        "Retomando",
        "Ficou 14 dias ou mais sem atividade e voltou a estudar dentro do período analisado.",
        "no bloco",
      ],
      [
        "Concluiu (fora dos cards)",
        "Terminou a jornada. Não é cobrado nem contado como parado — a ausência de atividade aqui é o fim esperado.",
        String(base.concluidos),
      ],
      [
        "Não iniciou (fora dos cards)",
        "Matriculado, sem nenhuma sessão de estudo. Não entra em ritmo porque nunca houve ritmo.",
        String(base.naoIniciaram),
      ],
    ],
    textoVazio: "",
  }
}

export function montarDetalhesPadroes(base: BasePadroes): DetalhesPadroes {
  return {
    "como-ler": comoLer(base),
    mudancas: todasAsMudancas(base),
    serie: serieHistorica(base),
    sinais: todosOsSinais(base),
    gargalos: comparacaoCompleta(base),
    participacao: composicaoPorSemana(base),
    risco: criteriosDeClassificacao(base),
  }
}
