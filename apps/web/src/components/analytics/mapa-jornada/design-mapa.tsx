// ---------------------------------------------------------------------------
// EXTENSÃO da linguagem visual para a aba "Mapa da jornada".
// ---------------------------------------------------------------------------
// Decisão IDS: REUSAR por import tudo que já existe em
// `components/analytics/visao-geral/design.tsx` (Card, CardTitulo, LinkRodape,
// CirculoIcone, TEXTO, TOM_ICONE, TOM_ICONE_SUAVE, COR_ACAO, RAIO_*, SOMBRA).
// Aquele arquivo é a linguagem visual da casa e NÃO é editado por esta run.
// Aqui moram apenas as primitivas que a Visão geral não tem porque não precisa:
// o marcador de célula da matriz, o avatar com iniciais, o badge numerado de
// gargalo e a barra de proporção.
//
// V-14 É O CRITÉRIO QUE GOVERNA ESTE ARQUIVO, e é o mais caro de errar:
// os três estados da célula têm de se distinguir POR GLIFO, não só por cor.
// Convertida a tela para escala de cinza, `concluído`, `em andamento` e
// `não iniciado` continuam distinguíveis:
//   • concluído    = disco PREENCHIDO com check (área cheia);
//   • em andamento = anel ABERTO, com falha visível no traço (arco, não círculo);
//   • não iniciado = anel FINO e vazio (contorno leve, miolo do fundo).
// Uma matriz de 7 × 8 = 56 células cuja única diferença é matiz é ruído para
// quem não distingue verde de laranja — e é a leitura central desta tela.
// ---------------------------------------------------------------------------

import { TOM_ICONE, TOM_ICONE_SUAVE } from "@/components/analytics/visao-geral/design"
import type { EstadoCelula } from "@/lib/analytics/mapa-jornada/tipos"
import type { Tom } from "@/lib/analytics/visao-geral/tipos"

/** Ø do marcador de célula (V-14 exige 12 a 18; a referência mede 14). */
export const DIAMETRO_CELULA = 14

/**
 * O marcador de uma célula da matriz. Sem texto: a legenda (V-16) publica o
 * significado uma vez, e o glifo o repete 56 vezes sem custo de leitura.
 */
export function MarcadorCelula({ estado }: { estado: EstadoCelula }) {
  const d = DIAMETRO_CELULA

  if (estado === "concluido") {
    return (
      <svg width={d} height={d} viewBox="0 0 14 14" role="img" aria-label="Concluído">
        <circle cx="7" cy="7" r="7" fill={TOM_ICONE.green.fill} />
        <path
          d="M4 7.2 L6.2 9.4 L10.1 4.9"
          fill="none"
          stroke={TOM_ICONE.green.ink}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (estado === "em-andamento") {
    // Arco de ~300°: a FALHA no traço é o que sobrevive à escala de cinza e
    // separa este estado do anel fechado de "não iniciado".
    return (
      <svg width={d} height={d} viewBox="0 0 14 14" role="img" aria-label="Em andamento">
        <path
          d="M7 1.4 A5.6 5.6 0 1 1 3.05 3.05"
          fill="none"
          stroke={TOM_ICONE.amber.ink}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  return (
    <svg width={d} height={d} viewBox="0 0 14 14" role="img" aria-label="Não iniciado">
      <circle cx="7" cy="7" r="5.6" fill="none" stroke="#C9C3BF" strokeWidth="1.2" />
    </svg>
  )
}

/**
 * Paleta do avatar: a MESMA de `TOM_ICONE_SUAVE`, com `red` remapeado.
 *
 * V-34 reserva o vermelho a gargalo e a travado, e enumera os quatro elementos
 * da tela inteira que podem usá-lo (1ª barra, 1º badge, tile `Travados`, ícone
 * do 3º insight). Um avatar rosa não significa nada nessa gramática: ele só
 * gasta o sinal mais caro da tela em ruído — e, pior, coloca a cor de gravidade
 * ao lado do nome de uma pessoa, que é a leitura que I-8 existe para impedir.
 *
 * Trocar o tom NÃO viola F-34c: a régua declara livre o "mapeamento cor/pessoa"
 * ("NÃO É CRITÉRIO" item 3), e o que F-34c exige é que a cor derive das
 * INICIAIS e nunca do ESTADO. Isso continua valendo — `tomDoAvatar` segue sendo
 * a única fonte, e duas pessoas de estados opostos com as mesmas iniciais
 * continuam com o mesmo tom.
 */
const TOM_AVATAR: Record<Tom, { fill: string; ink: string }> = {
  ...TOM_ICONE_SUAVE,
  red: TOM_ICONE_SUAVE.blue,
}

/**
 * Avatar de pessoa. O TOM vem das INICIAIS (`tomDoAvatar`), nunca do estado —
 * F-34c / I-8: derivá-lo do estado transformaria a coluna em semáforo de gente.
 */
export function AvatarPessoa({
  iniciais,
  tom,
  diametro = 18,
}: { iniciais: string; tom: Tom; diametro?: number }) {
  const { fill, ink } = TOM_AVATAR[tom]
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: diametro,
        height: diametro,
        backgroundColor: fill,
        color: ink,
        fontSize: diametro <= 18 ? 8 : 9,
        letterSpacing: "0.01em",
      }}
    >
      {iniciais}
    </span>
  )
}

/**
 * Badge numerado de gargalo (V-19). O numeral é de MÓDULO, não de pessoa —
 * permitido por I-8 pela mesma razão que os badges de "O que fazer agora" são.
 */
export function BadgeModulo({ numero, tom }: { numero: number; tom: Tom }) {
  const { fill, ink } = TOM_ICONE_SUAVE[tom]
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
      style={{ width: 25, height: 25, backgroundColor: fill, color: ink }}
    >
      {numero}
    </span>
  )
}

/**
 * Cabeçalho de coluna da matriz: círculo numerado de CONTORNO (V-11), nunca
 * preenchido — o preenchido é o badge de gargalo, e confundi-los faria a tela
 * afirmar duas coisas com o mesmo sinal.
 */
export function NumeroColuna({ numero }: { numero: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-full text-[10px] font-semibold"
      style={{
        width: 22,
        height: 22,
        border: "1px solid #D8D2CE",
        color: "#3A3737",
      }}
    >
      {numero}
    </span>
  )
}

/**
 * Barra de proporção dos gargalos (V-20/V-21). Trilha compartilhada visível em
 * cinza claro; o preenchimento é `proporcao` (0..1) relativo ao MAIOR
 * numerador, e não ao roster — é representação de ordem, não de percentual.
 */
export function BarraProporcao({ proporcao, tom }: { proporcao: number; tom: Tom }) {
  const largura = Math.max(0, Math.min(1, proporcao)) * 100
  return (
    <span className="block h-[8px] w-full rounded-full" style={{ backgroundColor: "#EDE9E6" }}>
      <span
        className="block h-full rounded-full"
        style={{ width: `${largura}%`, backgroundColor: TOM_ICONE[tom].ink }}
      />
    </span>
  )
}
