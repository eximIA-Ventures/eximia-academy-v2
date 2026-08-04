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

import { ANCHORS } from "@/lib/onboarding/types"
import type { AnnouncementPage, TourStep } from "@/lib/onboarding/types"

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
    destaque:
      "Percorrido em 100% e Conclusão em 50%. Você já viu o material inteiro, falta fechar 4 módulos. É o caminho mais curto que você tem hoje.",
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
