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
