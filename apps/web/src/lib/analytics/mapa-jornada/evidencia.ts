// ---------------------------------------------------------------------------
// Evidência de presença por (pessoa, módulo) — F-04.
// ---------------------------------------------------------------------------
// POR QUE ESTE ARQUIVO EXISTE, e não é duplicação por descuido: `slideFloorsOf`
// e `sessionChaptersOf` já existem em `view-progress-read.ts:265-312`, e são
// PRIVADAS (não exportadas). Reusar por import exigiria editar um arquivo fora
// da fronteira desta run. A saída é a reimplementação com a semântica DECLARADA
// idêntica — e ela está escrita aqui para que qualquer divergência futura seja
// visível em vez de silenciosa:
//
//   • `sessionChaptersOf` — **qualquer `status` conta**, não só `completed`. A
//     pergunta que a sessão responde é *"a pessoa chegou até este módulo?"*,
//     não *"terminou este módulo?"*. Exigir `completed` deixaria de fora
//     exatamente quem começou e parou, que é presença igualmente comprovada.
//     É a mesma régua de `whereStoppedChapterIdOf` (`area-gestor.ts:1113`).
//   • `slideFloorsOf` — reflexão sem `slide_id`, ou apontando para slide fora
//     do universo carregado, é IGNORADA: não dá para provar presença num ponto
//     que não se sabe onde fica.
//
// I-7: a reflexão entra como par `(student_id, slide_id)`. O texto (`response`)
// não é lido, não é projetado e não chega aqui.
// ---------------------------------------------------------------------------

import type { LinhaReflexaoMapa, LinhaSessaoMapa, LinhaSlideMapa } from "./fonte"

export interface PosicaoSlide {
  chapterId: string
  order: number
}

/** `slide_id → (chapter_id, order)`. Slide sem `order` degrada para 0. */
export function indexarSlides(slides: readonly LinhaSlideMapa[]): Map<string, PosicaoSlide> {
  const out = new Map<string, PosicaoSlide>()
  for (const s of slides) {
    out.set(s.id, { chapterId: s.chapter_id, order: s.order ?? 0 })
  }
  return out
}

/** `chapter_id → total ATUAL de slides` (denominador móvel, §5.3). */
export function totalDeSlidesPorCapitulo(slides: readonly LinhaSlideMapa[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const s of slides) out.set(s.chapter_id, (out.get(s.chapter_id) ?? 0) + 1)
  return out
}

/** `student_id → (chapter_id → maior order de slide COM reflexão)`. */
export function pisosDeSlidePorAluno(
  reflexoes: readonly LinhaReflexaoMapa[],
  slideById: ReadonlyMap<string, PosicaoSlide>,
): Map<string, Map<string, number>> {
  const porAluno = new Map<string, Map<string, number>>()
  for (const r of reflexoes) {
    if (!r.slide_id) continue
    const slide = slideById.get(r.slide_id)
    if (!slide) continue
    const capitulos = porAluno.get(r.student_id) ?? new Map<string, number>()
    const anterior = capitulos.get(slide.chapterId)
    if (anterior === undefined || slide.order > anterior) {
      capitulos.set(slide.chapterId, slide.order)
    }
    porAluno.set(r.student_id, capitulos)
  }
  return porAluno
}

/** `student_id → capítulos onde há sessão`. QUALQUER `status` conta. */
export function capitulosComSessaoPorAluno(
  sessoes: readonly LinhaSessaoMapa[],
): Map<string, Set<string>> {
  const porAluno = new Map<string, Set<string>>()
  for (const s of sessoes) {
    if (!s.chapter_id) continue
    const capitulos = porAluno.get(s.student_id) ?? new Set<string>()
    capitulos.add(s.chapter_id)
    porAluno.set(s.student_id, capitulos)
  }
  return porAluno
}

/**
 * F-04 · `student_id → capítulos com QUALQUER evidência de presença`.
 *
 * União das três fontes da fórmula: (a) linha em `chapter_view_progress`,
 * (b) sessão com aquele `chapter_id`, (c) reflexão num slide daquele capítulo.
 * É o predicado que separa laranja de cinza — e a negação exata dele é F-05.
 */
export function capitulosComEvidenciaPorAluno(args: {
  percorridoPorAluno: ReadonlyMap<string, ReadonlySet<string>>
  sessoesPorAluno: ReadonlyMap<string, ReadonlySet<string>>
  pisosPorAluno: ReadonlyMap<string, ReadonlyMap<string, number>>
}): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  const juntar = (alunoId: string, capitulos: Iterable<string>) => {
    const destino = out.get(alunoId) ?? new Set<string>()
    for (const c of capitulos) destino.add(c)
    out.set(alunoId, destino)
  }
  for (const [alunoId, capitulos] of args.percorridoPorAluno) juntar(alunoId, capitulos)
  for (const [alunoId, capitulos] of args.sessoesPorAluno) juntar(alunoId, capitulos)
  for (const [alunoId, capitulos] of args.pisosPorAluno) juntar(alunoId, capitulos.keys())
  return out
}
