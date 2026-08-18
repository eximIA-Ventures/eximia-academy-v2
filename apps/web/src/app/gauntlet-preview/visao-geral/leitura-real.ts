// ---------------------------------------------------------------------------
// O modo MOTOR do preview da "Visão geral" — banco real, somente leitura.
// ---------------------------------------------------------------------------
// POR QUE ESTE ARQUIVO EXISTE (2026-08-18). As rotas de preview das outras duas
// abas já tinham modo motor; esta NÃO tinha: `page.tsx` importava
// `VISAO_GERAL_COMPLETA` e nunca lia o banco, então `?fonte=motor` e
// `?fonte=fixture` devolviam byte a byte a MESMA tela. O efeito prático não era
// cosmético: defeitos que só existem com dado REAL ficavam invisíveis ao trilho
// de medição. O caso concreto medido foi o tile "No ritmo", que com dado real
// cai no ramo `deltaLabel === null` e imprime "sem comparação" — a string que
// vazava do tile e era coberta pelo fundo do tile vizinho. Na fixture os cinco
// tiles têm `deltaLabel`, então esse ramo nunca era fotografado.
//
// É a MESMA lição já escrita no `leitura-real.ts` da aba "Padrões": um preview
// que só desenha fixture mede uma segunda implementação, não a tela.
//
// SOMENTE LEITURA, e não é promessa: a única função chamada é
// `carregarVisaoGeral`, cuja camada inteira não tem caminho de escrita (ver o
// cabeçalho de `lib/analytics/visao-geral/index.ts`). O `.env.local` deste
// repositório aponta para PRODUÇÃO — nenhuma linha aqui grava, migra ou semeia.
//
// I-4 É O CONTRATO DESTE ARQUIVO. Toda leitura desestrutura `error` e o trata.
// Quando a resolução do tenant falha, a saída NÃO é uma tela limpa nem um
// `throw` genérico do App Router: é o estado `erro` do próprio motor, com a
// causa dentro.
//
// Decisão IDS: ADAPTAR. A anatomia é a de
// `gauntlet-preview/padroes-tendencias/leitura-real.ts` (mesmo `idDoTenant`,
// mesmo `telaEmErro`, mesmo `PERIODO_DIAS`); o que muda é a camada de destino,
// que tem `contexto` e não tem `capitulos` na entrada. Não dá para REUSAR o
// arquivo vizinho porque o tipo de saída é outro.
// ---------------------------------------------------------------------------

import { carregarVisaoGeral, fonteDaEntrada, montarVisaoGeral } from "@/lib/analytics/visao-geral"
import type { FalhaLeitura, VisaoGeralDados } from "@/lib/analytics/visao-geral"
import { createServiceClient } from "@/lib/supabase/service"
import { getTenantConfig } from "@/lib/tenant"

/** Período do recorte do preview. Os 30 dias do PNG aprovado. */
const PERIODO_DIAS = 30

/** O contexto de tela do preview: sem sessão, logo sem gestor nomeado. */
const CONTEXTO_PREVIEW = {
  tenantNome: "",
  gestorNome: "",
  gestorPapel: "Gestor",
  escopoEquipe: "hierarquia" as const,
  cursoFiltroNome: null,
}

/**
 * A tela inteira em estado de ERRO, montada pelo próprio motor.
 *
 * Reusa o caminho de falha que a camada já tem em vez de inventar uma segunda
 * tela de erro: sem universo, todo denominador é chute.
 */
function telaEmErro(falha: FalhaLeitura, agoraMs: number): VisaoGeralDados {
  const fonte = fonteDaEntrada({
    agoraISO: new Date(agoraMs).toISOString(),
    periodoDias: PERIODO_DIAS,
    gestorId: "preview",
    escopo: [],
    alunos: [],
    atividades: [],
    acionamentos: [],
    matriculas: [],
    cursos: [],
    tenantId: "",
  })
  const falhas = { ...fonte.falhas }
  for (const chave of Object.keys(falhas) as (keyof typeof falhas)[]) falhas[chave] = falha
  return montarVisaoGeral({ ...fonte, falhas }, { ...CONTEXTO_PREVIEW, atualizadoEmMs: agoraMs })
}

/**
 * O id do tenant a partir do slug de `tenant.config.ts`.
 *
 * `error` é desestruturado e devolvido como VALOR (I-4). `supabase-js` devolve
 * `{data, error}` em vez de lançar: uma leitura que só olhasse `data` trataria
 * "a consulta quebrou" e "não existe tenant" como a mesma coisa.
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

/** Lê o banco e monta a aba. Somente leitura. */
export async function carregarDoBanco(agoraMs: number): Promise<VisaoGeralDados> {
  const { id, falha } = await idDoTenant()
  if (falha || !id) {
    return telaEmErro(falha ?? { codigo: "SEM_TENANT", mensagem: "tenant não resolvido" }, agoraMs)
  }

  return carregarVisaoGeral({
    db: createServiceClient(),
    tenantId: id,
    // O preview não tem sessão: não há gestor logado a quem atribuir a tela. O
    // campo só filtra acionamentos (§12).
    gestorId: "preview",
    // `null` = o tenant inteiro. Esta camada NÃO resolve escopo, ela o obedece;
    // quem resolve escopo de verdade é o gate de segurança da rota real.
    escopoAlunoIds: null,
    agoraMs,
    periodoDias: PERIODO_DIAS,
    contexto: CONTEXTO_PREVIEW,
  })
}
