// ---------------------------------------------------------------------------
// O modo MOTOR do preview de Aprendizagem do Time — banco real, somente
// leitura. Mesmo contrato de `gauntlet-preview/padroes-tendencias/leitura-
// real.ts`: I-4 é o contrato deste arquivo (toda leitura desestrutura
// `error`), e `carregarVisaoGeralAprendizagem` não tem caminho de escrita.
// ---------------------------------------------------------------------------

import { carregarVisaoGeralAprendizagem } from "@/lib/analytics/aprendizagem-time"
import type { VisaoGeralAprendizagemDados } from "@/lib/analytics/aprendizagem-time"
import { createServiceClient } from "@/lib/supabase/service"
import { getTenantConfig } from "@/lib/tenant"

const PERIODO_DIAS = 30

async function idDoTenant(): Promise<string | null> {
  const slug = getTenantConfig().brand.slug
  let db: ReturnType<typeof createServiceClient>
  try {
    db = createServiceClient()
  } catch {
    return null
  }
  const { data } = await db.from("tenants").select("id").eq("slug", slug).maybeSingle()
  return (data as { id?: string } | null)?.id ?? null
}

export async function carregarDoBanco(agoraMs: number): Promise<VisaoGeralAprendizagemDados> {
  const tenantId = await idDoTenant()
  if (!tenantId) {
    return {
      estado: "erro",
      erro: { codigo: "SEM_TENANT", mensagem: "tenant não resolvido" },
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
      placar: {
        estado: "erro",
        erro: { codigo: "SEM_TENANT", mensagem: "tenant não resolvido" },
        textoVazio: null,
        motivoVazio: null,
        compreensao: { valorPercent: null, deltaPp: null },
        profundidade: { valorPercent: null, deltaPp: null },
        aplicacao: { valorPercent: null, deltaPp: null },
        evolucao: { valorPercent: null, deltaPp: null },
      },
      mudancas: {
        estado: "erro",
        erro: { codigo: "SEM_TENANT", mensagem: "tenant não resolvido" },
        textoVazio: null,
        motivoVazio: null,
        sinais: [],
      },
      atencao: {
        estado: "erro",
        erro: { codigo: "SEM_TENANT", mensagem: "tenant não resolvido" },
        textoVazio: null,
        motivoVazio: null,
        itens: [],
      },
      recomendacoes: {
        estado: "erro",
        erro: { codigo: "SEM_TENANT", mensagem: "tenant não resolvido" },
        textoVazio: null,
        motivoVazio: null,
        itens: [],
      },
      capacidadesEvolucao: {
        estado: "erro",
        erro: { codigo: "SEM_TENANT", mensagem: "tenant não resolvido" },
        textoVazio: null,
        motivoVazio: null,
        linhas: [],
      },
      gapsPrioritarios: {
        estado: "erro",
        erro: { codigo: "SEM_TENANT", mensagem: "tenant não resolvido" },
        textoVazio: null,
        motivoVazio: null,
        linhas: [],
      },
    }
  }

  return carregarVisaoGeralAprendizagem({
    db: createServiceClient(),
    tenantId,
    // Preview sem sessão: tenant inteiro. Quem resolve escopo de verdade é o
    // gate de segurança da rota real (`_trinca/recorte.ts`).
    escopoAlunoIds: null,
    cursoId: null,
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
