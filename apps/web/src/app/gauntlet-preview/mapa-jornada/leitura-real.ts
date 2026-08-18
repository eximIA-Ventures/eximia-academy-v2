// ---------------------------------------------------------------------------
// O modo MOTOR do preview do Mapa da jornada — banco real, somente leitura.
// ---------------------------------------------------------------------------
// POR QUE ESTE É O DEFAULT DA ROTA, e não a fixture: na primeira tela desta
// série o preview desenhava literais já calculados, então correções feitas no
// motor não apareciam na tela de inspeção — o loop aprovava um defeito que já
// estava corrigido, e reprovava correção que já existia. O caminho default de
// um trilho de inspeção tem de ser o caminho de PRODUÇÃO. A fixture continua
// existindo como modo EXPLÍCITO (`?fonte=fixture`), para o screenshot ser byte
// a byte reprodutível entre rodadas.
//
// SOMENTE LEITURA, e não é promessa: a única função chamada aqui é
// `carregarMapaJornada`, e a camada inteira dela não tem caminho de escrita —
// nem update, nem insert, nem RPC que mute. O `.env.local` deste repositório
// aponta para PRODUÇÃO.
//
// I-4 É O CONTRATO DESTE ARQUIVO. A resolução do tenant desestrutura `error` e
// o trata como VALOR. Falha de banco NÃO pode virar tela limpa: sem tenant não
// há roster, sem roster todo denominador é chute, e uma tela vazia apresentada
// como fato sobre a equipe é precisamente o defeito que esta série de telas
// existe para não repetir.
// ---------------------------------------------------------------------------

import {
  carregarMapaJornada,
  fonteDaEntradaMapa,
  montarMapaJornada,
} from "@/lib/analytics/mapa-jornada"
import type { ChaveFonteMapa, FalhaLeitura, MapaJornadaDados } from "@/lib/analytics/mapa-jornada"
import { TODAS_AS_CHAVES } from "@/lib/analytics/mapa-jornada"
import { createServiceClient } from "@/lib/supabase/service"
import { getTenantConfig } from "@/lib/tenant"

/** O recorte do preview: os 30 dias do PNG aprovado. */
const PERIODO_DIAS = 30

/**
 * A tela inteira em estado de ERRO, montada pelo PRÓPRIO motor.
 *
 * Reusa o caminho de falha que a camada já tem (uma `FalhaLeitura` em cada uma
 * das oito chaves) em vez de inventar uma segunda tela de erro. Assim o que o
 * inspetor vê é exatamente o que a rota real mostraria — inclusive o
 * discriminante entre "erro" e "vazio" que F-21/F-32 exigem não colapsar.
 */
function telaEmErro(falha: FalhaLeitura): MapaJornadaDados {
  const fonte = fonteDaEntradaMapa({
    agoraISO: new Date().toISOString(),
    periodoDias: PERIODO_DIAS,
    escopo: [],
    alunos: [],
    cursos: [],
    capitulos: [],
    slides: [],
    matriculas: [],
  })
  const falhas: Record<ChaveFonteMapa, FalhaLeitura | null> = { ...fonte.falhas }
  for (const chave of TODAS_AS_CHAVES) falhas[chave] = falha
  return montarMapaJornada({ ...fonte, falhas }, { cursoFiltroNome: null })
}

/**
 * O id do tenant a partir do slug de `tenant.config.ts`.
 *
 * `error` é desestruturado e devolvido como valor (I-4). `supabase-js` devolve
 * `{ data, error }` em vez de lançar: uma leitura que só olhasse `data`
 * trataria "a consulta quebrou" e "não existe tenant" como a mesma coisa.
 */
async function idDoTenant(): Promise<{ id: string | null; falha: FalhaLeitura | null }> {
  const slug = getTenantConfig().brand.slug

  let db: ReturnType<typeof createServiceClient>
  try {
    db = createServiceClient()
  } catch (e) {
    return {
      id: null,
      falha: { codigo: "SEM_CREDENCIAL", mensagem: e instanceof Error ? e.message : String(e) },
    }
  }

  const { data: linha, error } = await db
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle()

  if (error) return { id: null, falha: { codigo: error.code ?? "PGRST", mensagem: error.message } }

  const id = (linha as { id?: string } | null)?.id ?? null
  if (!id) {
    return {
      id: null,
      falha: { codigo: "SEM_TENANT", mensagem: `nenhum tenant com slug "${slug}"` },
    }
  }
  return { id, falha: null }
}

/**
 * Lê o banco e monta a aba.
 *
 * `agoraMs` entra por PARÂMETRO — nenhuma função pura desta tela chama o
 * relógio por conta própria, e o preview precisa poder congelá-lo para o
 * screenshot ser comparável entre duas rodadas mesmo lendo dado real.
 */
export async function carregarDoBanco(agoraMs: number): Promise<MapaJornadaDados> {
  const { id, falha } = await idDoTenant()
  if (falha || !id) {
    return telaEmErro(falha ?? { codigo: "SEM_TENANT", mensagem: "tenant não resolvido" })
  }

  return carregarMapaJornada({
    db: createServiceClient(),
    tenantId: id,
    // `null` = o tenant inteiro. Esta camada NÃO resolve escopo, ela o obedece;
    // quem resolve escopo de verdade é o gate de segurança da rota real.
    escopoAlunoIds: null,
    agoraMs,
    periodoDias: PERIODO_DIAS,
    contexto: { cursoFiltroNome: null },
  })
}
