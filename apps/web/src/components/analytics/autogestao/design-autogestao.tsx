// ---------------------------------------------------------------------------
// LINGUAGEM VISUAL da Autogestão da minha Jornada — peças compartilhadas pelas
// 3 telas (Visão Geral, Padrões e Tendências, Mapa da Jornada).
// ---------------------------------------------------------------------------
// Reusa as PRIMITIVAS do design system já calibradas para o Analytics do
// gestor (`components/analytics/visao-geral/design.tsx`): `Card`, `CardTitulo`,
// `CirculoIcone`, `TEXTO`, `TOM_ICONE`, `VARIACAO`, `CtaPilula`. A Autogestão é
// a MESMA linguagem visual da Academy aplicada a um sujeito diferente (o
// próprio aluno, não uma equipe) — inventar uma segunda paleta produziria duas
// aplicações que não se parecem, e o aluno navega entre as duas (o gestor
// pode inclusive ser aluno de outro curso).
//
// O QUE ESTE ARQUIVO ACRESCENTA, e por quê:
//   • `FaltaProva` — o desenho da regra "SEM LASTRO" (CONTRATO-DE-DADOS.md,
//     decisão do dono 2026-08-21): nunca um número inventado, nunca "0", nunca
//     travessão mudo. Sempre o texto "falta prova" mais o motivo legível.
//   • `PilulaEstado` — os rótulos de estado (ritmo, tendência, status de
//     módulo) em pílula colorida, vocabulário SEM JULGAMENTO (spec §2).
// ---------------------------------------------------------------------------

import type { Tom } from "@/lib/analytics/autogestao"
import { AlertTriangle } from "lucide-react"
import { TEXTO, TOM_ICONE } from "../visao-geral/design"

export {
  Card,
  CardTitulo,
  CirculoIcone,
  MioloCard,
  TEXTO,
  TOM_ICONE,
  TOM_ICONE_SUAVE,
  VARIACAO,
  CtaPilula,
  LinkRodape,
  COR_ACAO,
  RAIO_TILE,
  COR_TILE,
} from "../visao-geral/design"

/**
 * O desenho de "falta prova" (SEM LASTRO). Nunca um número, nunca um zero,
 * nunca um travessão silencioso — sempre esta frase mais o motivo real.
 *
 * `title` carrega o motivo completo para quem passa o mouse; o texto também
 * é renderizado por extenso ao lado (I-2 do gestor: informação renderizada,
 * nunca só em tooltip).
 */
export function FaltaProva({ motivo, className = "" }: { motivo: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-start gap-[6px] ${className}`}
      style={{ color: TEXTO.mudo }}
      title={motivo}
    >
      <AlertTriangle size={12} strokeWidth={2.2} className="mt-[2px] shrink-0" />
      <span className="text-[11.5px] leading-[16px]">
        <span className="font-semibold">Falta prova.</span> {motivo}
      </span>
    </span>
  )
}

/** Paleta de pílula por tom — fundo pastel + tinta, mesma família de `TOM_ICONE`. */
const FUNDO_PILULA: Record<Tom, string> = {
  green: TOM_ICONE.green.fill,
  amber: TOM_ICONE.amber.fill,
  blue: TOM_ICONE.blue.fill,
  red: TOM_ICONE.red.fill,
  neutral: TOM_ICONE.neutral.fill,
}

/**
 * Rótulo de estado em pílula (ritmo, tendência, status de módulo).
 *
 * Vocabulário SEM JULGAMENTO (spec §2): os rótulos que chegam aqui são sempre
 * "No ritmo" / "Retomando" / "Sustentando" / "Em andamento" — nunca "bom
 * aluno" ou nota. O componente só pinta; o texto vem de `textos.ts`.
 */
export function PilulaEstado({ rotulo, tom }: { rotulo: string; tom: Tom }) {
  return (
    <span
      className="inline-flex w-fit items-center rounded-[8px] px-[10px] py-[4px] text-[12px] font-semibold"
      style={{ backgroundColor: FUNDO_PILULA[tom], color: TOM_ICONE[tom].ink }}
    >
      {rotulo}
    </span>
  )
}

/** Fundo da faixa de mensagem-síntese (§9), um tom mais claro que a pílula. */
export const FUNDO_SINTESE: Record<Tom, string> = {
  green: "#EDF7F2",
  amber: "#FDF3E7",
  blue: "#EEF3FC",
  red: "#FBEDED",
  neutral: "#F3F1EF",
}
