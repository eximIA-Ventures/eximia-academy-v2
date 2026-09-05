// ---------------------------------------------------------------------------
// OS DOIS DOMÍNIOS do Analytics do gestor, e o caminho entre eles.
//
// POR QUE ESTE ARQUIVO EXISTE (2026-08-25). O domínio "Aprendizagem do Time"
// subiu com o seletor de domínio morando DENTRO da própria moldura dele
// (`_aprendizagem-time/moldura.tsx`), que só renderiza quando
// `?dominio=aprendizagem` JÁ está na URL. Resultado: a única porta para a tela
// ficava dentro da tela — circular. Só chegava lá quem digitasse o parâmetro à
// mão, e para o gestor o domínio simplesmente não existia.
//
// É o MESMO defeito corrigido horas antes em `/jornada` (commit 790298e, "a
// rota existia e o caminho até ela não"). Ele reapareceu porque a lista de
// domínios era privada de um dos lados: quem entra por `/analytics` nunca teve
// como saber que havia um segundo destino. A lista passa a viver aqui, fora dos
// dois, e os DOIS lados a consomem — assim adicionar um terceiro domínio um dia
// não depende de alguém lembrar de editar dois arquivos distantes.
//
// FILTROS SOBREVIVEM À TROCA, `?tab=` e `?vista=` NÃO. Recorte de equipe,
// período e curso descrevem a MESMA população nos dois domínios, então viajam
// junto (mesma regra da §3.4 que `NavAbas` já cumpre entre abas). Já `?tab=` é a
// trinca de Ativação e `?vista=` a de Aprendizagem: carregar um para dentro do
// outro deixaria na URL uma chave sem significado no destino.
//
// ═══ PRECEDENTE ENCERRADO (28→29/08/2026) ══════════════════════════════════
// Por um dia, "Aprendizagem do Time" NÃO apareceu nesta barra: um campo
// `oculto` no catálogo retirava o item, porque o schema da frente ainda não
// estava no banco e as 3 telas imprimiam ao gestor `column capabilities.title
// does not exist`. Caminho até tela quebrada é pior que caminho nenhum, e o
// gate de `/analytics` é por papel, não por plano — o link chegava a todo
// gestor de Cory Alimentos e Vértice Indústria.
//
// A migration foi aplicada (`20260828120000_aprendizagem_time_convergencia`) e
// as 3 telas passaram a renderizar contra o motor. A marca saiu — e o CAMPO que
// a hospedava saiu junto, de propósito. Um interruptor de ocultar parado no
// código convida a esconder a próxima tela quebrada em vez de consertá-la, sem
// a disciplina que fez esta contenção funcionar (condição de reversão objetiva
// escrita antes, e teste guardando os dois estados). Se um dia for preciso de
// novo, o desenho inteiro está no histórico: `git log -S oculto -- <este>`.
// ---------------------------------------------------------------------------

export type DominioId = "ativacao" | "aprendizagem"

export const DOMINIOS: readonly { id: DominioId; rotulo: string }[] = [
  { id: "ativacao", rotulo: "Ativação da Jornada" },
  { id: "aprendizagem", rotulo: "Aprendizagem do Time" },
]

/** Rota base da trinca. Hoje os dois domínios são servidos pela mesma rota. */
const ROTA = "/analytics"

/**
 * O href de um domínio a partir da query ATUAL (sem o "?").
 *
 * Ativação é o domínio de ENTRADA: ele não carrega `?dominio=`, para que
 * `/analytics` continue significando exatamente o que sempre significou e
 * nenhum bookmark antigo mude de destino.
 */
export function hrefDoDominio(dominio: DominioId, query = ""): string {
  const parametros = new URLSearchParams(query)
  parametros.delete("dominio")
  parametros.delete("tab")
  parametros.delete("vista")
  if (dominio === "aprendizagem") parametros.set("dominio", "aprendizagem")
  const restante = parametros.toString()
  return restante ? `${ROTA}?${restante}` : ROTA
}

/** Os itens prontos para `NavSecundaria`, com o domínio corrente marcado. */
export function itensDominio(
  ativo: DominioId,
  query = "",
): { id: string; rotulo: string; ativo: boolean; href: string }[] {
  return DOMINIOS.map((d) => ({
    id: d.id,
    rotulo: d.rotulo,
    ativo: d.id === ativo,
    href: hrefDoDominio(d.id, query),
  }))
}
