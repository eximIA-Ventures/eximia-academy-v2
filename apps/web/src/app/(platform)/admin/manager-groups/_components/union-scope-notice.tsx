import { Info } from "lucide-react"

/**
 * UnionScopeNotice: callout fixo (estático, sem props) que torna a semântica
 * de alcance tangível na própria UI (E10 §4.1, AC2).
 *
 * Comunica D2 (UNIÃO SEMPRE, sem CLIFF): o alcance de um gestor é a UNIÃO de
 * (1) quem reporta a ele no organograma (subárvore `reports_to`) e (2) os alunos
 * incluídos manualmente aqui. Incluir ACRESCENTA ao alcance; remover daqui
 * NÃO remove ninguém da hierarquia. A trava real é o RLS, não esta tela.
 */
export function UnionScopeNotice() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-teal-500/20 bg-teal-500/5 px-4 py-3">
      <Info size={18} className="mt-0.5 shrink-0 text-teal-600" aria-hidden="true" />
      <div className="space-y-1 text-sm text-text-secondary">
        <p className="font-semibold text-text-primary">Como o alcance funciona</p>
        <p>
          O que um gestor enxerga é a <strong>união</strong> de (1) todos que reportam a ele no
          organograma (direta ou indiretamente) e (2) os alunos incluídos aqui manualmente. Incluir
          um aluno <strong>acrescenta</strong> ao alcance.{" "}
          <strong>Remover daqui não remove da hierarquia</strong>: se o aluno reporta ao gestor, ele
          continua no alcance.
        </p>
      </div>
    </div>
  )
}
