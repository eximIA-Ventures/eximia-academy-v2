// ---------------------------------------------------------------------------
// O modo MOTOR do preview — banco real, somente leitura.
// ---------------------------------------------------------------------------
// Por que o default da rota é este, e não a fixture: na tela anterior o preview
// desenhava literais, então correções feitas no motor não apareciam na tela de
// inspeção e o loop aprovava um defeito já corrigido — ou reprovava uma correção
// que existia. O default tem que ser o caminho de produção. A fixture continua
// existindo, mas como MODO EXPLÍCITO (`?fonte=fixture`), para a comparação
// visual do loop ser byte a byte reprodutível.
//
// SOMENTE LEITURA, e isto não é promessa: a única coisa que este arquivo chama
// é `carregarPadroesTendencias`, cuja camada inteira não tem caminho de escrita.
// O `.env.local` deste repositório aponta para PRODUÇÃO — nenhuma linha aqui
// grava, migra ou semeia.
//
// I-4 É O CONTRATO DESTE ARQUIVO. Toda leitura desestrutura `error` e o trata.
// Quando a resolução do tenant falha, a saída NÃO é uma tela limpa nem um
// `throw` que vira erro genérico do App Router: é o estado `erro` do próprio
// motor, com a causa dentro. Falha de banco apresentada como fato sobre a
// equipe é exatamente o defeito que esta tela existe para não repetir.
// ---------------------------------------------------------------------------

import {
  carregarPadroesTendencias,
  fonteDaEntrada,
  montarPadroesTendencias,
} from "@/lib/analytics/padroes-tendencias"
import type { FalhaLeitura, PadroesTendenciasDados } from "@/lib/analytics/padroes-tendencias"
import { createServiceClient } from "@/lib/supabase/service"
import { getTenantConfig } from "@/lib/tenant"

/** Período do recorte do preview. Os 30 dias do PNG aprovado. */
const PERIODO_DIAS = 30

/**
 * A tela inteira em estado de ERRO, montada pelo próprio motor.
 *
 * Reusa o caminho de falha que a camada já tem (`falhas.roster`) em vez de
 * inventar uma segunda tela de erro: sem universo, todo denominador é chute, e
 * é assim que o motor já trata a perda do roster.
 */
function telaEmErro(falha: FalhaLeitura, agoraMs: number): PadroesTendenciasDados {
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
    capitulos: [],
    tenantId: "",
  })
  const falhas = { ...fonte.falhas }
  for (const chave of Object.keys(falhas) as (keyof typeof falhas)[]) falhas[chave] = falha
  return montarPadroesTendencias({ ...fonte, falhas })
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

/**
 * Lê o banco e monta a aba.
 *
 * `agoraMs` entra por parâmetro — nenhuma função pura desta tela chama o relógio
 * por conta própria, e o preview precisa poder congelá-lo para o screenshot ser
 * comparável entre duas rodadas.
 */
export async function carregarDoBanco(agoraMs: number): Promise<PadroesTendenciasDados> {
  const { id, falha } = await idDoTenant()
  if (falha || !id) {
    return telaEmErro(falha ?? { codigo: "SEM_TENANT", mensagem: "tenant não resolvido" }, agoraMs)
  }

  return carregarPadroesTendencias({
    db: createServiceClient(),
    tenantId: id,
    // O preview não tem sessão: não há gestor logado a quem atribuir a tela. O
    // campo só filtra acionamentos (§12), que esta aba não usa.
    gestorId: "preview",
    // `null` = o tenant inteiro. Esta camada NÃO resolve escopo, ela o obedece;
    // quem resolve escopo de verdade é o gate de segurança da rota real.
    escopoAlunoIds: null,
    agoraMs,
    periodoDias: PERIODO_DIAS,
  })
}
