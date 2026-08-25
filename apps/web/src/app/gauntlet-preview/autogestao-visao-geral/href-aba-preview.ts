import type { AbaAutogestao } from "@/app/(platform)/jornada/_autogestao/moldura"

// ---------------------------------------------------------------------------
// `hrefAbaPreview` — o `hrefDeAba` das 3 rotas `/gauntlet-preview/autogestao-*`.
// ---------------------------------------------------------------------------
// A moldura de produção (`_autogestao/moldura.tsx`) navega entre abas
// reescrevendo `?aba=` numa ÚNICA rota (`/jornada`). O harness de preview é o
// INVERSO: as 3 abas são TRÊS ROTAS IRMÃS (`autogestao-visao-geral`,
// `autogestao-padroes`, `autogestao-mapa`), porque a rota real vive atrás de
// auth (`(platform)/jornada` redireciona para `/login` sem sessão — ver o
// cabeçalho de `autogestao-visao-geral/page.tsx`). Sem este mapeamento, o
// `href` default da moldura levava o clique para `/jornada?...`, ou seja,
// para FORA do preview e direto no muro de login.
//
// A query é copiada inteira via `URLSearchParams` (nunca listada a dedo — os
// 3 harnesses já têm o hábito de aceitar `tenant`/`estudante` além de
// `aluno`/`agora`/`periodo`, e um novo parâmetro futuro não pode exigir
// lembrar de atualizar este arquivo também).
// ---------------------------------------------------------------------------

const ROTA_PREVIEW_DA_ABA: Record<AbaAutogestao, string> = {
  "visao-geral": "/gauntlet-preview/autogestao-visao-geral",
  padroes: "/gauntlet-preview/autogestao-padroes",
  mapa: "/gauntlet-preview/autogestao-mapa",
}

/** `queryAtual` é a MESMA string montada em cada `page.tsx` (`agora`/`aluno`/`periodo`/`tenant`?/`estudante`?). */
export function hrefAbaPreview(queryAtual: string): (aba: AbaAutogestao) => string {
  return (aba) => {
    const parametros = new URLSearchParams(queryAtual)
    return `${ROTA_PREVIEW_DA_ABA[aba]}?${parametros.toString()}`
  }
}
