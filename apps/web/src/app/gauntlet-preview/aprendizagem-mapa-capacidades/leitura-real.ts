// ---------------------------------------------------------------------------
// Modo MOTOR do preview da Tela 3 (Mapa de Capacidades) — mesmo contrato de
// `../aprendizagem-padroes-evolucao/leitura-real.ts`.
// ---------------------------------------------------------------------------

import { carregarMapaCapacidades } from "@/lib/analytics/aprendizagem-time"
import type { MapaCapacidadesDados } from "@/lib/analytics/aprendizagem-time"
import { createServiceClient } from "@/lib/supabase/service"
import { getTenantContext } from "@/lib/tenant"

const PERIODO_DIAS = 30
const CURSO_TITULO = "Análise e Solução de Problemas"

/**
 * O id do tenant DESTA REQUISIÇÃO (D2), não mais o do slug de build.
 *
 * O preview resolvia a empresa por `getTenantConfig().brand.slug` — um literal
 * que só existia porque a marca era env de BUILD. Com a resolução por host o id
 * já vem pronto, e num host neutro não há empresa nenhuma: `null` é a resposta
 * certa, em vez da empresa que por acaso estava no artefato.
 */
async function idDoTenant(): Promise<string | null> {
  return (await getTenantContext()).tenantId
}

async function idDoCurso(
  db: ReturnType<typeof createServiceClient>,
  tenantId: string,
): Promise<string | null> {
  const { data } = await db
    .from("courses")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("title", CURSO_TITULO)
    .maybeSingle()
  return (data as { id?: string } | null)?.id ?? null
}

function erroSemTenant(agoraMs: number): MapaCapacidadesDados {
  const erro = { codigo: "SEM_TENANT", mensagem: "tenant não resolvido" }
  const blocoErro = { estado: "erro" as const, erro, textoVazio: null, motivoVazio: null }
  return {
    estado: "erro",
    erro,
    contexto: {
      tenantNome: "—",
      gestorNome: "—",
      gestorPapel: "—",
      agoraISO: new Date(agoraMs).toISOString(),
      periodoDias: PERIODO_DIAS,
      periodoInicioISO: new Date(agoraMs).toISOString(),
      periodoFimISO: new Date(agoraMs).toISOString(),
      periodoAnteriorInicioISO: new Date(agoraMs).toISOString(),
      periodoAnteriorFimISO: new Date(agoraMs).toISOString(),
      escopoEquipe: "diretos",
      cursoFiltroNome: null,
      totalAprendizesElegiveis: 0,
    },
    cabecalho: { titulo: "Aprendizagem do Time", subtitulo: "" },
    capacidadesDoTime: { ...blocoErro, linhas: [] },
    capacidadeComMaiorGap: { ...blocoErro, capacidade: null },
    mapaCapacidadeEquipe: { ...blocoErro, colunas: [], linhas: [] },
    evidenciasDisponiveis: {
      ...blocoErro,
      reflexoesAnalisadas: 0,
      casosPraticos: 0,
      validacoesGestor: 0,
    },
    pessoasApoio: { ...blocoErro, capacidadeGapTitulo: null, linhas: [] },
    recomendacoes: { ...blocoErro, itens: [] },
  }
}

export async function carregarMapaDoBanco(agoraMs: number): Promise<MapaCapacidadesDados> {
  const tenantId = await idDoTenant()
  if (!tenantId) return erroSemTenant(agoraMs)

  const db = createServiceClient()
  const cursoId = await idDoCurso(db, tenantId)

  return carregarMapaCapacidades({
    db,
    tenantId,
    escopoAlunoIds: null,
    cursoId,
    agoraMs,
    periodoDias: PERIODO_DIAS,
    contexto: {
      tenantNome: "Academy",
      gestorNome: "Preview",
      gestorPapel: "Gestor",
      escopoEquipe: "diretos",
      cursoFiltroNome: null,
    },
  })
}
