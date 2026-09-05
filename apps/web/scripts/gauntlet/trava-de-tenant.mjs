// ===========================================================================
// A TRAVA — nenhuma escrita deste run alcança um tenant de cliente.
//
// POR QUE ELA EXISTE, COM DATA
// ---------------------------------------------------------------------------
// O banco do `.env.local` É PRODUÇÃO, compartilhada por quatro tenants, dois
// deles clientes pagantes (Cory Alimentos, Vértice Indústria). Em 18/08/2026
// esta casa teve um vazamento cross-tenant REAL chegar à produção. Semear dado
// de teste aqui sem trava não é risco teórico: é a repetição de um acidente
// que já aconteceu.
//
// POKA-YOKE, NÃO DISCIPLINA
// ---------------------------------------------------------------------------
// A regra não é "lembre de filtrar por tenant". É que não existe caminho de
// código neste run que escreva fora do tenant descartável. Toda escrita passa
// por `guardar()`, que inspeciona LINHA A LINHA e lança antes de tocar a rede.
// Disciplina falha em silêncio às duas da manhã, na sétima rodada; uma exceção
// lançada, não.
//
// A LISTA NEGRA É REDUNDANTE DE PROPÓSITO
// ---------------------------------------------------------------------------
// `guardar()` já garante que o alvo é o descartável. A lista negra abaixo
// checa a mesma coisa pelo outro lado (o alvo NÃO é nenhum dos quatro slugs
// reais). Duas asserções independentes sobre o mesmo fato: se um dia alguém
// "simplificar" a resolução do tenant e ela passar a devolver o id errado, a
// lista negra ainda derruba. Defesa em profundidade custa quatro linhas.
// ===========================================================================

/** O único tenant que este run pode tocar. */
export const SLUG_DESCARTAVEL = "gauntlet-descartavel"

/** Os slugs que NUNCA podem ser alvo de escrita, nem por engano. */
export const SLUGS_PROIBIDOS = Object.freeze([
  "cory-alimentos",
  "eximia-academy",
  "harven-finance",
  "vertice-industria",
])

export class TravaViolada extends Error {
  constructor(mensagem) {
    super(`[TRAVA] ${mensagem}`)
    this.name = "TravaViolada"
  }
}

/**
 * Resolve o tenant descartável e prova que ele não é de cliente.
 *
 * NÃO cria o tenant em silêncio. Criar linha em produção é ato deliberado, e
 * um script que cria o que não acha transforma erro de digitação em tenant
 * novo no banco do cliente.
 */
export async function resolverTenantDescartavel(db) {
  const { data, error } = await db
    .from("tenants")
    .select("id,slug,name")
    .eq("slug", SLUG_DESCARTAVEL)
    .maybeSingle()

  if (error) throw new TravaViolada(`falha ao resolver o tenant: ${error.message}`)
  if (!data) {
    throw new TravaViolada(
      `o tenant "${SLUG_DESCARTAVEL}" não existe. Crie-o explicitamente com \`node apps/web/scripts/gauntlet/criar-tenant-descartavel.mjs\` antes de semear. Este script NÃO cria tenant sozinho: criar linha em produção é ato deliberado.`,
    )
  }
  // Redundância deliberada (ver cabeçalho).
  if (SLUGS_PROIBIDOS.includes(data.slug)) {
    throw new TravaViolada(`o alvo resolvido é o tenant de PRODUÇÃO "${data.slug}". Abortado.`)
  }
  return data.id
}

/**
 * O portão único de escrita. Toda linha é inspecionada ANTES da rede.
 *
 * Falha fechada em três direções, e cada uma é um acidente distinto:
 *   - linha sem `tenant_id`      → a coluna cairia no default do banco
 *   - linha com outro `tenant_id`→ escrita no cliente errado
 *   - alvo igual a um proibido   → a resolução do tenant foi corrompida
 */
export function guardar(tenantDescartavelId, linhas) {
  if (!tenantDescartavelId) {
    throw new TravaViolada("tenant descartável não resolvido; resolva antes de guardar.")
  }
  const lista = Array.isArray(linhas) ? linhas : [linhas]
  if (lista.length === 0) {
    throw new TravaViolada("nada a guardar: lista vazia é quase sempre um filtro que não casou.")
  }
  lista.forEach((linha, i) => {
    if (!linha || typeof linha !== "object") {
      throw new TravaViolada(`linha ${i} não é um objeto.`)
    }
    if (!("tenant_id" in linha)) {
      throw new TravaViolada(
        `linha ${i} não declara tenant_id. Sem ele a coluna cai no default do banco, e o dado de teste aterrissa onde ninguém procurou.`,
      )
    }
    if (linha.tenant_id !== tenantDescartavelId) {
      throw new TravaViolada(
        `linha ${i} aponta para o tenant "${linha.tenant_id}", que NÃO é o descartável ` +
          `("${tenantDescartavelId}"). Escrita abortada antes de tocar a rede.`,
      )
    }
  })
  return lista
}

/**
 * Apaga apenas o que este run semeou. Reusa `resolverTenantDescartavel`, de
 * modo que a limpeza herda as mesmas duas asserções da escrita — um `delete`
 * com o id errado é o pior comando deste arquivo.
 */
export async function limpar(db, tenantDescartavelId, tabelas) {
  if (SLUGS_PROIBIDOS.length === 0) throw new TravaViolada("lista negra vazia.")
  if (!tenantDescartavelId) throw new TravaViolada("limpeza sem tenant resolvido.")

  // Reconfirma pelo banco que este id é mesmo o descartável, e não outro.
  const { data, error } = await db
    .from("tenants")
    .select("slug")
    .eq("id", tenantDescartavelId)
    .maybeSingle()
  if (error) throw new TravaViolada(`falha ao reconfirmar o tenant: ${error.message}`)
  if (!data) throw new TravaViolada(`o tenant "${tenantDescartavelId}" não existe mais.`)
  if (data.slug !== SLUG_DESCARTAVEL) {
    throw new TravaViolada(
      `o id "${tenantDescartavelId}" pertence ao tenant "${data.slug}", não ao descartável. DELETE abortado.`,
    )
  }

  const apagadas = {}
  for (const tabela of tabelas) {
    const { error: erroDel, count } = await db
      .from(tabela)
      .delete({ count: "exact" })
      .eq("tenant_id", tenantDescartavelId)
    if (erroDel) throw new TravaViolada(`falha ao limpar ${tabela}: ${erroDel.message}`)
    apagadas[tabela] = count ?? 0
  }
  return apagadas
}
