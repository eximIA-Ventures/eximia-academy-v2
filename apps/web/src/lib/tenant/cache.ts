import type { TenantIdentificado } from "./tipos"

/**
 * Cache em memória da resolução host -> tenant, com TTL.
 *
 * POR QUE ELE PRECISA DO RUNTIME `nodejs` NO MIDDLEWARE
 * -----------------------------------------------------
 * Um `Map` de módulo só é cache de verdade se o módulo viver o suficiente. No
 * runtime Edge o middleware roda em ISOLATES efêmeros e replicados: cada um
 * teria o próprio mapa, o TTL não seria observável e a taxa de acerto tenderia
 * a zero — o custo (uma leitura de `tenant_domains` por requisição anônima com
 * a chave de serviço) ficaria de pé e o benefício, não. Por isso
 * `src/middleware.ts` declara `export const runtime = "nodejs"`, onde há UM
 * processo por instância e o mapa é compartilhado por todas as requisições
 * dela. Ver `docs/faxina-2026-09/04-critica.md`, linha "Middleware do P6".
 *
 * O NEGATIVO TAMBÉM É CACHEADO, E ISSO É O PONTO
 * ----------------------------------------------
 * "Este host não é domínio próprio de ninguém" é a resposta mais comum em
 * produção (todo acesso por subdomínio passa por aqui). Guardar só os acertos
 * transformaria o caso comum em "uma consulta por requisição". E o negativo é
 * guardado com a MESMA chave do positivo, o que é a defesa contra o pior
 * defeito possível aqui: servir a marca do último tenant lido para um host
 * desconhecido. Não existe estado "último": existe um mapa por chave.
 *
 * TTL de 60s é o que a D2 pede. É o atraso máximo entre cadastrar um domínio
 * próprio (P10 escreve em `tenant_domains`) e ele passar a resolver. Não há
 * sinal de invalidação: 60 segundos de espera num ato que já envolve
 * propagação de DNS não justifica um canal de invalidação entre processos.
 */
const TTL_MS = 60_000

/** Teto de chaves. Host é entrada de rede: sem teto, um atacante enche a RAM. */
const MAX_CHAVES = 5_000

interface Entrada {
  valor: TenantIdentificado | null
  expiraEm: number
}

const mapa = new Map<string, Entrada>()

/** `undefined` = não sei (não está no cache). `null` = sei que NÃO existe. */
export function lerDoCache(
  chave: string,
  agora = Date.now(),
): TenantIdentificado | null | undefined {
  const entrada = mapa.get(chave)
  if (!entrada) return undefined
  if (agora >= entrada.expiraEm) {
    mapa.delete(chave)
    return undefined
  }
  return entrada.valor
}

export function gravarNoCache(
  chave: string,
  valor: TenantIdentificado | null,
  agora = Date.now(),
): void {
  if (mapa.size >= MAX_CHAVES) {
    // Primeiro tenta só o que já venceu; se nada venceu, derruba tudo. Um
    // cache vazio custa uma consulta por host; um cache sem teto custa o
    // processo.
    for (const [k, v] of mapa) {
      if (agora >= v.expiraEm) mapa.delete(k)
    }
    if (mapa.size >= MAX_CHAVES) mapa.clear()
  }
  mapa.set(chave, { valor, expiraEm: agora + TTL_MS })
}

/** Só para teste: cada caso começa de um cache limpo. */
export function limparCacheDeTenants(): void {
  mapa.clear()
}

export const TTL_DO_CACHE_MS = TTL_MS
