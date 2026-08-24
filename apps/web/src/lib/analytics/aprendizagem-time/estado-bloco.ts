// ---------------------------------------------------------------------------
// Três construtores — um por veredito de bloco. Nenhum `montarX` monta
// `EstadoBloco` à mão: usa um destes, então o compilador garante que os
// quatro campos (`estado`/`erro`/`textoVazio`/`motivoVazio`) nunca ficam
// inconsistentes entre si (ex.: `estado: "erro"` com `erro: null`).
// ---------------------------------------------------------------------------

import type { ComEstado, FalhaLeitura, MotivoVazio } from "./tipos"

export function blocoOk<T extends object>(dados: T): ComEstado<T> {
  return { ...dados, estado: "ok", erro: null, textoVazio: null, motivoVazio: null }
}

export function blocoVazio<T extends object>(
  dados: T,
  motivo: MotivoVazio,
  texto: string,
): ComEstado<T> {
  return { ...dados, estado: "vazio", erro: null, textoVazio: texto, motivoVazio: motivo }
}

export function blocoErro<T extends object>(dados: T, erro: FalhaLeitura): ComEstado<T> {
  return { ...dados, estado: "erro", erro, textoVazio: null, motivoVazio: null }
}

/** Texto literal da §7 — usado por todo bloco cuja amostra não bate o piso. */
export const TEXTO_AMOSTRA_INSUFICIENTE = "Amostra ainda insuficiente"

/** Texto literal aproximado da §7 para tendência sem histórico comparável. */
export const TEXTO_SEM_TENDENCIA =
  "Ainda não há histórico suficiente para identificar uma tendência."
