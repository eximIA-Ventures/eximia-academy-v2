// ---------------------------------------------------------------------------
// §11 + §29 — "O que fazer agora": as 4 regras determinísticas, corte em 3.
// ---------------------------------------------------------------------------
// A §29 diz que IA generativa não é obrigatória no MVP. Aqui ela é ativamente
// CONTRAINDICADA, e o motivo é concreto: o `ActionInsightCard` que já existe
// (`analytics-ui.tsx`) tem um CTA que faz `POST /api/analytics/insights` e
// SUBSTITUI todas as recomendações determinísticas por texto de modelo. Numa
// tela medida por fixture determinística isso quebra a verificação, e num card
// sujeito a I-7 coloca texto não-auditado em cena. O que se reusa dele é o
// IDIOM (função pura sobre agregados já calculados, como `generateUsageInsights`),
// não o componente: a forma do dado nem cabe — faltam prioridade, contexto,
// CTA e alvos, que são justamente o que a §11 torna obrigatório.
//
// ORDENAÇÃO: por GRAVIDADE (A=1, C=1, B=2, D=3), empate resolvido pela ordem
// FIXA das regras. Nunca por magnitude — ordenar por magnitude reintroduziria o
// ranking que I-8 proíbe, por outra porta.
//
// ═══ DIVERGÊNCIA REGISTRADA (doutrina do texto, 2026-08-19) ═════════════════
// Uma das três lentes pediu para PROMOVER a regra D (reconhecer) à primeira
// posição sempre que houver concluintes: no tenant medido 4 de 6 concluíram, e
// reconhecimento seria objetivamente a ação de maior rendimento disponível —
// além de ser o único CTA que ESCREVE em três abas, o único lugar onde o gestor
// faz algo em vez de ler.
//
// NÃO foi implementado, e o dissenso fica aqui em vez de sumir. Razão: a ordem
// por gravidade é decisão de produto já registrada (§29 + o defeito real dos
// badges "1,1,2" de 2026-08-16), e inverter a fila para pôr o elogio na frente
// de "reativar 2 pessoas sem acesso há 40 dias" é mudança de PRIORIDADE DE
// AÇÃO, não correção de texto. Isso pertence ao dono do produto, não a esta
// frente, cujo escopo é o que as frases DIZEM. A lente segue com razão sobre o
// mérito; o que falta é o aval, não o argumento.
//
// GRAVIDADE ≠ PRIORIDADE, e confundir as duas foi um defeito real (dono do
// produto, 2026-08-16: a tela mostrou os badges "1, 1, 2" e o React avisou
// "two children with the same key"). A §11 da spec numera 1, 2 e 3 em três
// linhas de uma lista de no máximo três: ali "Prioridade" é ORDINAL DE
// EXIBIÇÃO, única por construção. A §29 não atribui número nenhum às regras
// A–D — a escala 1/1/2/3 é interna a este arquivo e serve só para ordenar.
// Emitir a gravidade no campo que o badge desenha juntava duas coisas
// diferentes num número só: duas regras críticas viravam dois "1" na tela e
// duas chaves iguais na lista.
//
// Desde então: a gravidade fica em `gravidade` (interna, nunca sai daqui, e
// chega à tela só como COR via `badgeTom`), e `prioridade` é atribuída DEPOIS
// da ordenação e do corte, como 1..N. Cada recomendação também carrega `id`,
// a identidade estável da regra que a emitiu — é ela a chave de lista.
//
// QUEM CONCLUIU NÃO É ALVO DE COBRANÇA (dono do produto, 2026-08-17, tenant
// Cory em produção). A tela exibiu "Apoiar 4 pessoas paradas em 'Padronização'"
// e as 4 eram exatamente as 4 com `enrollments.status = 'completed'` e 100% de
// progresso: elas "pararam" porque TERMINARAM. A regra A filtrava só o estado
// `"sustentando"` e nunca excluía `"concluido"` — que existe e é projetado em
// `base.ts` (`projetarEstado`). O defeito não produz número errado, produz AÇÃO
// ERRADA SOBRE PESSOA REAL, e é a violação mais direta possível da §2 Regra 2
// ("dados para apoiar, não vigiar") e da §10.2 (ações neutras, nunca cobrança).
//
// A correção é um crivo ÚNICO (`semQuemConcluiu`), aplicado por TODA regra cujo
// alvo é uma ação sobre a pessoa (A, B e C). Três condições ad-hoc espalhadas
// pelo arquivo deixariam a próxima regra §29 nascer sem a exclusão; um crivo com
// nome faz a pergunta "isto passa pelo crivo?" ser obrigatória na revisão.
// ---------------------------------------------------------------------------

import { SEM_ACESSO_DAYS } from "@/lib/student-triage"
import { contagem, listaEmPortugues, pluralDe, primeiroNome } from "../_comum/texto"
import type { BaseCalculo } from "./base"
import { chaveDiaUtc } from "./dia-utc"
import { type FalhasPorFonte, primeiraFalha } from "./fonte"
import {
  CONCENTRACAO_MODULO_PCT,
  MS_SEMANA,
  QUEDA_ATIVOS_PCT,
  RECOMENDACOES_MAX,
  REGULARIDADE_MIN_DIAS_NA_SEMANA,
  RITMO_CONSISTENTE_SEMANAS,
} from "./parametros"
import { VAZIO_GARGALOS, VAZIO_SEM_ESCOPO } from "./textos"
import type { BlocoRecomendacoes, ComEstado, Recomendacao } from "./tipos"

const FONTES_DAS_RECOMENDACOES = [
  "roster",
  "sessoes",
  "reflexoes",
  "matriculas",
  "cursos",
  "capitulos",
] as const

/**
 * Uma regra que disparou, ANTES de saber em que posição da lista ela vai cair.
 *
 * `prioridade` sai fora de propósito: ela não existe até a lista estar ordenada
 * e cortada. O que existe aqui é `gravidade` (quão urgente é a ação) e
 * `ordemDaRegra` (o desempate fixo, para a saída não depender da ordem de
 * avaliação nem da magnitude).
 */
interface Candidata extends Omit<Recomendacao, "prioridade"> {
  /** 1 = crítico · 2 = atenção · 3 = positivo. Ordena; NÃO é o numeral do badge. */
  gravidade: 1 | 2 | 3
  ordemDaRegra: number
}

/**
 * O crivo da §2 Regra 2: quem CONCLUIU não é alvo de apoio, verificação nem
 * reativação. Terminar o curso é o desfecho que a tela existe para produzir —
 * transformá-lo em pendência é o oposto exato do propósito do bloco.
 *
 * O predicado é `base.concluidos` (o fato de matrícula: todas `completed`), não
 * `estadoPorAluno === "concluido"` (a projeção §4). Os dois coincidem no caso
 * normal, mas a projeção tem precedência própria — `nao-iniciou` vem ANTES de
 * `concluiu` em `projetarEstado` — e uma matrícula marcada como concluída sem
 * sessão nenhuma cairia fora do filtro. O fato de matrícula é o mesmo que a
 * triagem canônica usa na regra 0 (`isStudentConcluido`), então as duas leituras
 * do sistema concordam sobre quem terminou.
 */
function concluiu(base: BaseCalculo, alunoId: string): boolean {
  return base.concluidos.has(alunoId)
}

function semQuemConcluiu(base: BaseCalculo, ids: readonly string[]): string[] {
  return ids.filter((id) => !concluiu(base, id))
}

/** Quantos itens de uma enumeração cabem no card antes de virar parágrafo. */
const ITENS_VISIVEIS_NO_CONTEXTO = 3

/**
 * Os dias sem acesso dos alvos, do mais recente ao mais antigo, já em texto.
 *
 * ═══ O QUE ESTA FUNÇÃO EXISTE PARA MATAR ════════════════════════════════════
 * Três dos quatro `contexto` desta §29 eram STRINGS LITERAIS — "Há concentração
 * de pessoas neste módulo…", "A ativação caiu significativamente…", "Todas
 * estavam em dia no cronograma quando pararam." Elas passam qualquer teste de
 * estabilidade, qualquer snapshot e qualquer crítico cego, e nunca leram o
 * dado: são a "função constante que satisfaz toda invariância" desta obra,
 * aplicada a texto.
 *
 * O que decide se o gestor marca uma SESSÃO ou manda DUAS MENSAGENS não é
 * "há concentração", é "paradas há 12, 19 e 26 dias". E esse dado já estava em
 * memória (`diasSemAtividadePorAluno`), sem nenhuma consulta nova ao banco.
 * Lista vazia devolve `null` — quem chama decide a frase de fallback, porque
 * emitir "há  dias" seria pior que não emitir nada.
 */
function diasDosAlvos(base: BaseCalculo, alvos: readonly string[]): string | null {
  const dias = alvos
    .map((id) => base.diasSemAtividadePorAluno.get(id) ?? null)
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b)
  if (dias.length === 0) return null
  return listaEmPortugues(dias.map(String), ITENS_VISIVEIS_NO_CONTEXTO)
}

/** §29 regra A — concentração de pessoas não-sustentando no mesmo módulo. */
function regraConcentracao(base: BaseCalculo): Candidata | null {
  const total = base.roster.size
  if (total === 0) return null

  const porModulo = new Map<string, string[]>()
  for (const [alunoId, capituloId] of base.moduloCorrentePorAluno) {
    if (base.estadoPorAluno.get(alunoId) === "sustentando") continue
    // O módulo corrente de quem concluiu é o ÚLTIMO que ele estudou, não onde
    // ele empacou. Sem esta linha, o fim do curso vira o gargalo do curso.
    if (concluiu(base, alunoId)) continue
    porModulo.set(capituloId, [...(porModulo.get(capituloId) ?? []), alunoId])
  }

  let melhorId: string | null = null
  let melhorAlvos: string[] = []
  for (const [capituloId, alvos] of porModulo) {
    if (alvos.length > melhorAlvos.length) {
      melhorId = capituloId
      melhorAlvos = alvos
    }
  }
  if (melhorId === null || melhorAlvos.length / total <= CONCENTRACAO_MODULO_PCT) return null

  const titulo = base.tituloPorCapitulo.get(melhorId) ?? "este módulo"
  const dias = diasDosAlvos(base, melhorAlvos)
  const n = melhorAlvos.length
  return {
    id: "concentracao-modulo",
    gravidade: 1,
    badgeTom: "red",
    titulo: `Apoiar ${contagem(n, "pessoa parada", "pessoas paradas")} em "${titulo}"`,
    // O QUE MUDA A AÇÃO é o tempo parado, não o adjetivo "concentração": 3 e 5
    // dias pedem uma mensagem; 26 e 40 pedem outra conversa.
    contexto:
      dias === null
        ? `${contagem(n, "pessoa está", "pessoas estão")} neste módulo sem concluí-lo.`
        : `${pluralDe(n, "Parada", "Paradas")} há ${dias} dias, no mesmo ponto da jornada.`,
    ctaRotulo: "Ver pessoas",
    ctaIcone: "users",
    alunosAlvo: [...melhorAlvos].sort(),
    ctaEscreve: false,
    ordemDaRegra: 1,
  }
}

/** §29 regra B — queda de PESSOAS ativas (não de sessões) acima de 15%. */
function regraQuedaDeAtivos(base: BaseCalculo): Candidata | null {
  const anterior = base.ativosNoPeriodoAnterior.size
  // Sem período anterior a regra NÃO dispara: o bloco irmão "O que mudou" já
  // cobre esse caso com o texto de §32. Inventar aqui seria inventar duas vezes.
  if (anterior === 0) return null
  const atual = base.ativosNoPeriodo.size
  const variacao = (atual - anterior) / anterior
  if (variacao >= -QUEDA_ATIVOS_PCT) return null

  // O GATILHO acima é a métrica da equipe e fica intacto (I-5: um denominador
  // só, os dois lados no mesmo universo). O que o crivo filtra é o ALVO: quem
  // concluiu não "deixou de acessar", terminou. Pedir ao gestor que verifique
  // essa pessoa é mandá-lo desfazer o próprio resultado.
  const alvos = semQuemConcluiu(
    base,
    [...base.ativosNoPeriodoAnterior].filter((id) => !base.ativosNoPeriodo.has(id)),
  )
  // Queda inteiramente explicada por conclusões: há o que celebrar, não há o que
  // verificar. Sem esta guarda a tela emitiria "Verificar 0 pessoas".
  if (alvos.length === 0) return null

  return {
    id: "queda-de-ativos",
    gravidade: 2,
    badgeTom: "amber",
    // "Verificar" era o único título deste card que NÃO é uma ação — é o
    // adiamento de uma. Os outros três mandam apoiar, reativar e reconhecer;
    // este mandava olhar de novo. `Falar com` é o que o gestor de fato faz, e é
    // o que o CTA já entrega.
    titulo: `Falar com ${contagem(alvos.length, "pessoa que deixou", "pessoas que deixaram")} de acessar`,
    // Os DOIS LADOS ABSOLUTOS, nunca o percentual: em base pequena "−40%" são
    // duas pessoas, e o percentual implica uma população que não existe.
    // "Verifique os grupos" também morre aqui: com 6 pessoas não há grupos, e o
    // conselho desaconselhava exatamente a única ação viável (agir por pessoa).
    contexto: `As pessoas ativas caíram de ${anterior} para ${atual} entre os dois períodos.`,
    ctaRotulo: "Ver pessoas",
    ctaIcone: "users",
    alunosAlvo: alvos.sort(),
    ctaEscreve: false,
    ordemDaRegra: 2,
  }
}

/**
 * §29 regra C — "estava no ritmo e não acessa há 14+ dias".
 *
 * Nenhuma consulta nova: a triagem canônica devolve `sem_acesso` quando, e só
 * quando, a pessoa não concluiu, NÃO está atrasada, NÃO é não-iniciada e sumiu
 * há mais de 14 dias. Traduzido: em dia no cronograma quando parou, e sumida.
 * É a regra C ao pé da letra, com outro nome.
 */
function regraReativar(base: BaseCalculo): Candidata | null {
  // O crivo é REDUNDANTE hoje, e a redundância é deliberada: a regra 0 de
  // `computeStudentTriagem` já devolve `no_ritmo` para quem concluiu, então
  // nenhum concluído chega em `sem_acesso`. Só que essa exclusão é de
  // `student-triage.ts`, módulo compartilhado por quatro telas — o invariante
  // "não se cobra quem terminou" é DESTE bloco e não pode depender de uma regra
  // de precedência que outro dono pode reordenar. As três regras de alvo passam
  // pelo mesmo crivo; nenhuma delega o próprio invariante.
  const alvos = semQuemConcluiu(
    base,
    [...base.triagemPorAluno.entries()].filter(([, t]) => t === "sem_acesso").map(([id]) => id),
  ).sort()
  if (alvos.length === 0) return null

  const dias = diasDosAlvos(base, alvos)
  return {
    id: "reativar-sem-acesso",
    gravidade: 1,
    badgeTom: "red",
    titulo: `Reativar ${contagem(alvos.length, "pessoa sem acesso", "pessoas sem acesso")} há mais de ${SEM_ACESSO_DAYS} dias`,
    // ═══ POR QUE "Todas estavam em dia no cronograma quando pararam." MORREU ══
    // Ela era a frase mais perigosa do catálogo: é a que MAIS muda a ação do
    // gestor (diz "a culpa não é delas" — isso decide o tom da conversa), tinha
    // plural fixo (emitia "Todas estavam" para UMA pessoa no tenant real), e
    // era VERDADEIRA POR CONSTRUÇÃO: `sem_acesso` já exclui quem está atrasado,
    // então a afirmação nunca poderia sair falsa. Frase que não pode ser falsa
    // não é informação, é legenda impressa — a "função constante" desta obra.
    // Verificar de fato ("estava em dia NO INSTANTE em que parou") exigiria um
    // histórico de pace que o banco não guarda.
    //
    // O que sobra é o que foi MEDIDO: há quantos dias cada uma sumiu. O título
    // diz "mais de 14"; só o contexto diz se são 15 ou 90.
    contexto:
      dias === null
        ? `${contagem(alvos.length, "pessoa iniciou", "pessoas iniciaram")} a jornada e não ${pluralDe(alvos.length, "retornou", "retornaram")} desde então.`
        : `Sem acesso há ${dias} dias.`,
    ctaRotulo: "Ver pessoas",
    ctaIcone: "users",
    alunosAlvo: alvos,
    ctaEscreve: false,
    ordemDaRegra: 3,
  }
}

/**
 * §29 regra D — ritmo mantido por 3 semanas consecutivas.
 *
 * NÃO passa pelo crivo `semQuemConcluiu`, e isso é decisão, não esquecimento:
 * aqui o alvo é um ELOGIO, e o invariante da §2 Regra 2 é sobre cobrança. O
 * filtro `!== "sustentando"` já exclui quem concluiu, por efeito da precedência
 * de `projetarEstado`.
 *
 * Deixar entrar quem concluiu seria uma regra NOVA ("reconhecer quem terminou"),
 * que a §29 não escreve, e que expandiria o alvo de um CTA que ESCREVE em banco
 * (`ctaEscreve: true`) — decisão do dono do produto, não de um fix. Fica
 * registrado o efeito colateral conhecido: quem concluiu e segue estudando com
 * regularidade não é reconhecido hoje. É um elogio perdido, nunca uma cobrança
 * indevida, e por isso não bloqueia esta correção.
 */
function regraReconhecer(base: BaseCalculo): Candidata | null {
  const alvos: string[] = []
  for (const id of base.roster) {
    if (base.estadoPorAluno.get(id) !== "sustentando") continue
    if (manteveRitmo(base.carimbosPorAluno.get(id) ?? [], base.agoraMs)) alvos.push(id)
  }
  if (alvos.length === 0) return null

  const nomes = alvos
    .map((id) => primeiroNome(base.nomePorAluno.get(id) ?? ""))
    .filter((n) => n.length > 0)
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
  return {
    id: "reconhecer-ritmo",
    gravidade: 3,
    badgeTom: "green",
    titulo: `Reconhecer ${contagem(alvos.length, "pessoa", "pessoas")} com ritmo consistente`,
    // RECONHECER É ATO NOMINAL. "Mantiveram o plano" obriga o gestor a abrir a
    // gaveta para descobrir a quem vai agradecer — e ainda emitia plural fixo
    // para uma pessoa só. Os primeiros nomes já estavam em memória (C-35: só o
    // primeiro nome, nunca o completo).
    contexto:
      nomes.length === 0
        ? `${contagem(alvos.length, "pessoa manteve", "pessoas mantiveram")} o plano por ${RITMO_CONSISTENTE_SEMANAS} semanas.`
        : `${listaEmPortugues(nomes, ITENS_VISIVEIS_NO_CONTEXTO)} ${pluralDe(alvos.length, "manteve", "mantiveram")} o plano por ${RITMO_CONSISTENTE_SEMANAS} semanas.`,
    ctaRotulo: "Reconhecer",
    ctaIcone: "award",
    alunosAlvo: alvos.sort(),
    // Escreve em banco: fica inerte enquanto o gate estiver desligado.
    ctaEscreve: true,
    ordemDaRegra: 4,
  }
}

/**
 * 3 semanas consecutivas com atividade em ≥2 dias distintos.
 *
 * A semana deriva da CHAVE DE DIA UTC (I-6), nunca de `startOfISOWeek` do
 * date-fns — que é local-timezone e é importado por
 * `api/analytics/manager/route.ts`. Esse é o precedente a NÃO copiar: com ele,
 * uma sessão das 21h de Brasília cai numa semana no servidor e noutra no
 * cliente, e o reconhecimento passa a depender de quem renderizou.
 */
function manteveRitmo(carimbos: readonly number[], agoraMs: number): boolean {
  for (let w = 0; w < RITMO_CONSISTENTE_SEMANAS; w++) {
    const ate = agoraMs - w * MS_SEMANA
    const de = ate - MS_SEMANA
    const dias = new Set<string>()
    for (const t of carimbos) {
      if (t >= de && t < ate) dias.add(chaveDiaUtc(t))
    }
    if (dias.size < REGULARIDADE_MIN_DIAS_NA_SEMANA) return false
  }
  return true
}

export function montarRecomendacoes(
  base: BaseCalculo,
  falhas: FalhasPorFonte,
): ComEstado<BlocoRecomendacoes> {
  const moldura = { titulo: "O que fazer agora", tituloIcone: "sparkles" }

  const falha = primeiraFalha(falhas, FONTES_DAS_RECOMENDACOES)
  if (falha) {
    return {
      ...moldura,
      recomendacoes: [],
      estado: "erro",
      erro: falha,
      textoVazio: null,
      motivoVazio: "falha-de-leitura",
    }
  }
  if (base.roster.size === 0) {
    return {
      ...moldura,
      recomendacoes: [],
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_SEM_ESCOPO,
      motivoVazio: "sem-escopo",
    }
  }

  const candidatas = [
    regraConcentracao(base),
    regraQuedaDeAtivos(base),
    regraReativar(base),
    regraReconhecer(base),
  ].filter((c): c is Candidata => c !== null)

  if (candidatas.length === 0) {
    return {
      ...moldura,
      recomendacoes: [],
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_GARGALOS,
      motivoVazio: "sem-gargalos",
    }
  }

  // A POSIÇÃO é atribuída aqui, depois de ordenar e cortar — nunca pela regra
  // que emitiu. É o que garante `1, 2, 3` sem repetição em qualquer combinação
  // de regras que dispare, e é o que dá à lista uma chave estável e única.
  // `gravidade` e `ordemDaRegra` morrem nesta linha: ordenaram, não vão à tela.
  const recomendacoes = candidatas
    .sort((a, b) => a.gravidade - b.gravidade || a.ordemDaRegra - b.ordemDaRegra)
    .slice(0, RECOMENDACOES_MAX)
    .map(({ ordemDaRegra: _ordem, gravidade: _gravidade, ...rec }, indice) => ({
      ...rec,
      // O corte em RECOMENDACOES_MAX (3) é o que mantém o índice dentro de
      // 1|2|3; a asserção não inventa nada que o `slice` acima não garanta.
      prioridade: (indice + 1) as Recomendacao["prioridade"],
    }))

  return {
    ...moldura,
    recomendacoes,
    estado: "ok",
    erro: null,
    textoVazio: null,
    motivoVazio: null,
  }
}
