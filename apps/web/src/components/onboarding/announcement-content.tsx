/**
 * Conteúdo das duas novidades e do tour — os textos exatos aprovados pelo
 * Hugo em `app/dev/preview-feature-review/page.tsx`, depois do pedido dele
 * de revisão ("bota um revisor em todos os textos") e do aceite que veio
 * depois disso. Não editar copy aqui sem motivo forte — ver o cabeçalho de
 * `announcement-modal.tsx`, o componente que consome este arquivo.
 *
 * Contrato de origem: `lib/onboarding/types.ts` e
 * `docs/stories/feat-onboarding-novidades-lancamento.md`.
 */

import { openModulesText } from "@/components/analytics/comparison-insights-table"
import { ANCHORS } from "@/lib/onboarding/types"
import type { AnnouncementPage, StudentProgressSnapshot, TourStep } from "@/lib/onboarding/types"

/**
 * O bloco "No seu caso" da novidade 1, montado com o dado REAL de quem lê.
 *
 * Até 2026-08-05 esta frase era um literal com os números de ninguém
 * ("Percorrido em 100% e Conclusão em 50%… falta fechar 4 módulos"), exibido
 * igual para toda pessoa — inclusive para quem tinha 42% e 10% na tabela "Meu
 * ritmo" da mesma tela. O Hugo reportou com print.
 *
 * Três decisões que valem registro:
 *
 * 1. **Os dois números ou nenhum.** A frase afirma uma RELAÇÃO ("percorreu
 *    mais do que fechou"); com metade do par ela não é meia verdade, é uma
 *    frase sem sujeito. Faltando qualquer um, o bloco inteiro some (B9).
 * 2. **A contagem de módulos vem de `openModulesText`**, a MESMA função que a
 *    linha Conclusão da tabela usa. Reimplementar a conta aqui criaria o
 *    defeito que aquele módulo documenta em si mesmo: duas afirmações
 *    contraditórias sobre o mesmo aluno, na mesma tela. Sem denominador ela
 *    devolve `null`, e a frase simplesmente não cita módulo nenhum.
 * 3. **O convite é condicional.** "É o caminho mais curto" só é verdade quando
 *    o aluno percorreu MAIS do que fechou e ainda há o que fechar. Para quem
 *    fechou tudo, ou para quem ainda não percorreu à frente da conclusão, a
 *    frase seria um conselho falso.
 */
function destaquePercorrido({
  percorridoPct,
  conclusaoPct,
  totalModules,
}: StudentProgressSnapshot): string | null {
  if (percorridoPct === null || conclusaoPct === null) return null

  const base = `Percorrido em ${percorridoPct}% e Conclusão em ${conclusaoPct}%.`
  const modulos = openModulesText(conclusaoPct, totalModules ?? undefined)
  const fato = modulos ? ` ${modulos.charAt(0).toUpperCase()}${modulos.slice(1)}.` : ""
  const atalho =
    percorridoPct > conclusaoPct && conclusaoPct < 100
      ? " Fechar o que você já percorreu é o caminho mais curto que você tem hoje."
      : ""

  return `${base}${fato}${atalho}`
}

/**
 * Novidade 1 — `percorrido-vs-conclusao` (`FEATURE_KEYS.percorrido`).
 *
 * Uma tela só. O Hugo apontou esta versão e disse "ficou muito bem
 * explicado": título com as duas palavras em destaque, subtítulo que diz o
 * que a linha faz, os dois cartões com os números, o bloco "No seu caso" e o
 * par ação-mais-saída. Paginar uma ideia única só adicionaria cliques.
 */
export const PERCORRIDO_PAGES: AnnouncementPage[] = [
  {
    titulo: (
      <>
        Agora dá para ver a diferença entre <span className="text-cerrado-300">percorrer</span> e{" "}
        <span className="text-cerrado-300">concluir</span>
      </>
    ),
    corpo:
      "Passar por todos os slides não fecha o módulo. Quem fecha é você, clicando em Módulo Concluído no fim de cada um. É esse clique que conta na Conclusão.",
    botao: "Ver onde fica",
    noodle: "/noodles/medir.svg",
    cartoes: "percorrido",
    destaque: destaquePercorrido,
  },
]

/**
 * Novidade 2 — `jornada-intro` (`FEATURE_KEYS.jornada`). Três telas
 * sequenciais: o que é, como cada módulo ganha data, e onde montar.
 */
export const JORNADA_PAGES: AnnouncementPage[] = [
  {
    titulo: "Você pode montar sua jornada de estudos",
    corpo:
      "O curso tem uma data final que não muda. Você escolhe quantos dias dar a cada módulo até lá, e confirma no fim para salvar.",
    botao: "Ver como funciona",
    noodle: "/noodles/calendario.svg",
    cartoes: "jornada",
  },
  {
    titulo: "Cada módulo ganha uma data",
    corpo:
      "Dê mais dias aos módulos que pedem mais de você e menos aos que já domina. Depois, você vê as datas da sua jornada e o que já concluiu.",
    botao: "Onde eu encontro isso",
    noodle: "/noodles/planejar.svg",
  },
  {
    titulo: "Onde você monta sua jornada",
    corpo: 'Ela se chama "Monte ou revise sua jornada" e abre a tela onde você escolhe as datas.',
    botao: "Abrir agora",
    noodle: "/noodles/porta.svg",
  },
]

/**
 * Os 6 passos do tour do construtor — `jornada-builder-tour`
 * (`FEATURE_KEYS.tour`), amarrados a `TOUR_STEP_ORDER` do contrato, nesta
 * ordem: timeline→jornadaLinha, auto→jornadaAuto, unidade→jornadaUnidade,
 * tabela→jornadaModulos, reset→jornadaReset, cta→jornadaCta.
 *
 * A §0.3 da story lista `jornada-prazo` e `jornada-sugestao` entre as
 * âncoras do tour, mas o protótipo aprovado pelo Hugo — depois da revisão de
 * textos — ensina `reset` e `cta` no lugar dos dois. Prevalece o protótipo
 * (ver "CORREÇÃO 2" na story e o comentário sobre `TOUR_STEP_ORDER` em
 * `lib/onboarding/types.ts`).
 */
export const TOUR_STEPS: TourStep[] = [
  {
    anchor: ANCHORS.jornadaLinha,
    titulo: "Cada bloco é um módulo",
    corpo:
      "Arraste a borda do bloco para dar mais ou menos dias a ele, e a data do módulo muda junto. Os que você já concluiu ficam travados, sem dias.",
  },
  {
    anchor: ANCHORS.jornadaAuto,
    titulo: "Auto-ajuste",
    corpo:
      "Ligado, alongar um módulo empurra os seguintes para a frente, sem passar da data final do curso. Desligado, você mexe em um sem mover os outros.",
  },
  {
    anchor: ANCHORS.jornadaUnidade,
    titulo: "Semanas ou dias",
    corpo: "Troca a unidade da linha do tempo, conforme for mais fácil de pensar.",
  },
  {
    anchor: ANCHORS.jornadaModulos,
    titulo: "Prefere sem arrastar?",
    corpo: "Use os botões de mais e menos ao lado de cada módulo. Faz a mesma coisa.",
  },
  {
    anchor: ANCHORS.jornadaReset,
    titulo: "Voltar ao ponto de partida",
    corpo:
      "Desfaz o que você mexeu e volta os módulos como estavam. Nada fica salvo até você clicar em Começar minha jornada.",
  },
  {
    anchor: ANCHORS.jornadaCta,
    titulo: "Começar minha jornada",
    corpo:
      "Salva a jornada que você montou, e os prazos passam a aparecer junto com o seu progresso. Dá para refazer quando quiser.",
  },
]
