// ---------------------------------------------------------------------------
// O modo MOTOR do preview de Aprendizagem do Time — banco real, somente
// leitura. Mesmo contrato de `gauntlet-preview/padroes-tendencias/leitura-
// real.ts`: I-4 é o contrato deste arquivo (toda leitura desestrutura
// `error`), e `carregarVisaoGeralAprendizagem` não tem caminho de escrita.
// ---------------------------------------------------------------------------

import { carregarVisaoGeralAprendizagem } from "@/lib/analytics/aprendizagem-time"
import type { VisaoGeralAprendizagemDados } from "@/lib/analytics/aprendizagem-time"
import { createServiceClient } from "@/lib/supabase/service"
import { getTenantContext } from "@/lib/tenant"

const PERIODO_DIAS = 30

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
