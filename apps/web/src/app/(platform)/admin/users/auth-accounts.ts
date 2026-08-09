import { createServiceClient } from "@/lib/supabase/service"

/**
 * A ÚNICA leitura privilegiada de `auth.users` da tela de Usuários.
 *
 * Nasceu como `last-sign-in.ts` (CFG-2.3, "último acesso") e foi generalizada
 * pela CFG-2.2 (ciclo de vida de convites, AC1). A generalização é o ponto: as
 * duas informações — quando a pessoa entrou pela última vez e se ela chegou a
 * aceitar o convite — vêm do MESMO objeto, na MESMA resposta de
 * `auth.admin.listUsers`. Buscá-las em duas varreduras paginadas independentes
 * seria pagar duas vezes pelo mesmo payload e abrir espaço para as duas
 * divergirem (foi assim que a cópia de `listUsers` que morava na rota de API
 * ficou silenciosamente errada acima de 1000 contas, antes da CFG-2.3).
 *
 * ## Por que não é um `.in("id", ids)` no schema `auth`
 *
 * Verificado contra a produção (leitura, 2026-07-28):
 * `serviceClient.schema("auth").from("users").select(...).in("id", ids)` devolve
 * `PGRST106 Invalid schema: auth` — PostgREST só expõe `public` (e
 * `graphql_public`/`storage`). Um `IN` de verdade exigiria uma função
 * `SECURITY DEFINER` em `public`, ou seja, uma migration — que a CFG-2.2 proíbe
 * (AC10). Também não existe RPC pronta (`PGRST202`).
 *
 * O que resta, e é o que o AC realmente protege ("nunca 1 query por usuário"), é
 * a API administrativa do GoTrue: `listUsers` é paginada, traz o lote inteiro
 * numa chamada e resolve N usuários com O(1) requisições no caso normal (54
 * contas hoje em produção cabem numa página).
 *
 * ## Least privilege
 *
 * `listUsers` carrega 13 campos por usuário no fio (email, phone, identities,
 * metadata...). Esta função é a fronteira que os descarta: o retorno projeta
 * SOMENTE `last_sign_in_at`, `invited_at` e `confirmed_at`, e apenas para os ids
 * pedidos. Nada mais do schema `auth` atravessa daqui para cima — nem para o
 * loader, nem para a página, nem para o client.
 *
 * ## Degradação graciosa
 *
 * Qualquer falha (service role ausente, erro de rede, GoTrue fora do ar) devolve
 * mapa vazio. O "último acesso" volta a "—", a pílula volta ao par binário
 * Ativo/Inativo e o contador de convites some — a tela continua de pé. Estado
 * derivado é informação acessória; nenhum dos dois é motivo para derrubar a
 * lista de usuários inteira.
 */

/** Tamanho de página do GoTrue admin (máximo aceito pela API). */
const PAGE_SIZE = 1000

/**
 * Teto duro de páginas varridas. Sem ele, um erro de paginação viraria loop
 * infinito contra a API de Auth em produção (`finops-guardrails`: toda operação
 * iterativa tem parada explícita). 10 páginas = 10k contas.
 */
const MAX_PAGES = 10

/** Fronteira tipada: o resto do app nunca vê o objeto cru do schema `auth`. */
export interface AuthAccountFacts {
  last_sign_in_at: string | null
  invited_at: string | null
  confirmed_at: string | null
}

export type AuthAccountMap = Record<string, AuthAccountFacts>

/** A forma bruta que interessa dentro do objeto do GoTrue. Nada além disso. */
interface RawAuthUser {
  id: string
  last_sign_in_at?: string | null
  invited_at?: string | null
  confirmed_at?: string | null
  email_confirmed_at?: string | null
}

export async function fetchAuthAccounts(userIds: string[]): Promise<AuthAccountMap> {
  if (userIds.length === 0) return {}

  const wanted = new Set(userIds)
  const map: AuthAccountMap = {}

  try {
    const serviceClient = createServiceClient()

    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data, error } = await serviceClient.auth.admin.listUsers({
        page,
        perPage: PAGE_SIZE,
      })

      if (error || !data?.users) break

      // Projeção: só os 3 campos, só dos ids pedidos.
      for (const authUser of data.users as RawAuthUser[]) {
        if (!wanted.has(authUser.id)) continue
        map[authUser.id] = {
          last_sign_in_at: authUser.last_sign_in_at ?? null,
          invited_at: authUser.invited_at ?? null,
          // `confirmed_at` é derivado pelo GoTrue (o primeiro entre e-mail e
          // telefone confirmados). Projetos antigos podem devolver só
          // `email_confirmed_at`; aceitar os dois evita ler "nunca aceitou"
          // sobre quem aceitou.
          confirmed_at: authUser.confirmed_at ?? authUser.email_confirmed_at ?? null,
        }
      }

      // Parada antecipada: todos resolvidos, ou acabaram as páginas.
      if (Object.keys(map).length >= wanted.size) break
      if (data.users.length < PAGE_SIZE) break
    }
  } catch {
    // Falha do acesso privilegiado não derruba a página.
    return {}
  }

  return map
}
