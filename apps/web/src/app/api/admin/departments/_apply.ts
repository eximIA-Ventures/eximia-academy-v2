import type { PresencePlan } from "@/app/(platform)/admin/areas/departments-model"

// =============================================================================
// EXECUÇÃO DO PLANO DE PRESENÇA (CFG-7.1)
// =============================================================================
// O plano vem PRONTO do modelo puro (`departments-model.ts`), já validado e já
// provado por teste. Aqui só se escreve — nenhuma decisão de negócio mora neste
// arquivo, de propósito: se a regra de "mover x expandir" pudesse ser reaberta
// no executor, a prova do modelo deixaria de valer.
//
// ORDEM DAS ESCRITAS (decisão registrada): INSERE antes de REMOVER.
// Não há transação disponível pelo client HTTP, então uma das duas metades pode
// falhar sozinha. Inserindo primeiro, a falha deixa o departamento presente nas
// DUAS unidades — estado visível na tela, que o admin corrige com um clique.
// Removendo primeiro, a falha deixaria o departamento em NENHUMA unidade: ele
// some do Mapa e vira um arquivado que ninguém pediu. Entre um erro visível e um
// erro mudo, escolhe-se sempre o visível.
// =============================================================================

// biome-ignore lint/suspicious/noExplicitAny: ponte estrutural entre os dois clients supabase
type AnyDbClient = { from: (table: string) => any }

export type ApplyResult =
  | {
      ok: true
      /**
       * Pessoas que o plano mandava reatribuir e cuja linha em `user_areas` NÃO
       * mudou (tipicamente RLS recusando em silêncio). Sobe para a resposta como
       * aviso: uma reatribuição que não aconteceu precisa aparecer, não sumir.
       */
      unreassignedUserIds: string[]
    }
  | { ok: false; error: string }

export async function applyPresencePlan(
  client: AnyDbClient,
  tenantId: string,
  plan: PresencePlan,
): Promise<ApplyResult> {
  // 1. Inserções (o lado seguro).
  for (const add of plan.addPresences) {
    const { error } = await client
      .from("department_areas")
      .insert({ department_id: add.departmentId, area_id: add.areaId, tenant_id: tenantId })
    // 23505 = a presença já existe. Isso é idempotência, não falha: o estado
    // desejado (presente naquela unidade) já vale.
    if (error && error.code !== "23505") {
      return { ok: false, error: error.message }
    }
  }

  // 2. Remoções, sempre escopadas por empresa.
  for (const remove of plan.removePresences) {
    const { error } = await client
      .from("department_areas")
      .delete()
      .eq("department_id", remove.departmentId)
      .eq("area_id", remove.areaId)
      .eq("tenant_id", tenantId)
    if (error) return { ok: false, error: error.message }
  }

  // 3. Pessoas que acompanham a mudança de unidade (só em MOVER).
  // O `where` carrega a unidade de ORIGEM: quem já estava em outra unidade não é
  // tocado nem por acidente.
  const unreassignedUserIds: string[] = []
  for (const reassign of plan.reassignUsers) {
    const { data, error } = await client
      .from("user_areas")
      .update({ area_id: reassign.toAreaId })
      .eq("user_id", reassign.userId)
      .eq("area_id", reassign.fromAreaId)
      .select("user_id")
    if (error) return { ok: false, error: error.message }
    // `.select()` existe para CONTAR: um update que não atingiu nenhuma linha
    // não devolve erro no PostgREST. Sem esta checagem, "a pessoa não mudou de
    // unidade" seria indistinguível de "a pessoa mudou de unidade".
    if (!data || data.length === 0) unreassignedUserIds.push(reassign.userId)
  }

  return { ok: true, unreassignedUserIds }
}
