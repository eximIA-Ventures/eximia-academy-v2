# CFG-2.3 — Último acesso real (leitura de `auth.users` via service role)

> **Status:** InReview (GO do Hugo em 2026-07-28, implementada — ver Change Log)
> **Tier:** 1 (camada de acesso a dados) · **Tamanho:** S (1 accessor + 1 loader compartilhado, sem migration) · **Depende de:** CFG-1.1
> **Fonte:** `docs/architecture/configuracoes-publicacao-fase1.md` §3.5 (seção "Fica para depois" de Usuários)
> **Migrations:** NENHUMA — `auth.users.last_sign_in_at` já existe (schema gerenciado pelo Supabase Auth). Esta story é sobre CAMADA DE ACESSO (service role), não sobre schema. Mesmo assim fica `Blocked`: ler `auth.users` com privilégio elevado em produção exige GO explícito do Hugo, pela mesma régua de qualquer operação sensível em produção compartilhada (regra do mandato).

## Contexto

A coluna "Último acesso" já é renderizada na lista de Usuários, mas `apps/web/src/app/(platform)/admin/users/page.tsx:129` chumba `last_sign_in_at: null` para todo mundo — o dado nunca foi lido de verdade. `auth.users.last_sign_in_at` é gerenciado pelo Supabase Auth (schema `auth`, não `public`), inacessível pelo client autenticado normal por RLS — só o service role (ou uma function `SECURITY DEFINER`) consegue lê-lo. Sem esta story, CFG-6.1 não pode mostrar último acesso real, apenas manter o placeholder atual.

## Acceptance Criteria

1. Nenhuma migration — `auth.users.last_sign_in_at` já existe.
2. Novo accessor server-side que usa o client de service role já existente no repo (`createServiceClient` de `apps/web/src/lib/supabase/service.ts`, mesmo padrão já usado em `admin/areas/page.tsx` para "bypass RLS when tenant_id is null") para buscar `last_sign_in_at` em lote (`IN` por lista de ids), para os usuários da página atual — nunca 1 query por usuário.
3. `apps/web/src/app/(platform)/admin/users/page.tsx:129` deixa de chumbar `last_sign_in_at: null` e passa a popular com o valor retornado pelo novo accessor.
4. **Least privilege**: o accessor só lê `id` e `last_sign_in_at` de `auth.users` — nenhum outro campo do schema `auth` (email, phone, metadata, etc.) é exposto pela nova função, mesmo que o service role tecnicamente tenha acesso a tudo.
5. O accessor é isolado num módulo próprio (não inline no `page.tsx`) para ser reusável pelo loader extraído em CFG-1.1 (AC6 daquela story) sem duplicar a lógica de service role entre a rota antiga `/admin/users` e a nova `/configuracoes/usuarios`.
6. Falha do accessor (erro de rede, service role indisponível) degrada para o comportamento atual (`null`/"—" na coluna), nunca quebra a página inteira.
7. Uso do service role sobre `auth.users` em produção só ocorre após GO explícito e por escrito do Hugo (mesma régua de qualquer acesso privilegiado em banco compartilhado).

## Dev Notes

- Padrão de service role já em uso no repo (citar como precedente, não inventar um novo): `apps/web/src/app/(platform)/admin/areas/page.tsx:71-73` — `"Use service role to bypass RLS when tenant_id is null"`, `const { createServiceClient } = await import("@/lib/supabase/service")`.
- Linha exata a substituir: `apps/web/src/app/(platform)/admin/users/page.tsx:129` (`last_sign_in_at: null as string | null,` dentro do map que monta `allUsers`).
- Os 3 clientes Supabase do repo são não-tipados (`client.ts`, `server.ts` sem genérico; `service.ts` usa `SupabaseClient<any,...>`, achado do plano executável §4) — o accessor novo deve tipar manualmente o shape retornado (`{ id: string; last_sign_in_at: string | null }[]`) na fronteira, para não propagar `any` para o resto do `page.tsx`.
- Este accessor é consumido tanto pela rota antiga (`/admin/users`, que continua viva por D3) quanto pela nova (`/configuracoes/usuarios`, CFG-1.1 AC6) — implementar 1x, chamar 2x.

## Gate

> **Correções de gate do @po (verificadas em disco):** (a) `npx vitest` não roda na raiz (binário só em `apps/web` e `packages/shared`); (b) **não existe nenhum arquivo de teste sob `apps/web/src/app/(platform)/admin/users`** — `find` confirma que os únicos `__tests__` do domínio de usuários são `src/app/api/admin/users/__tests__/` e `src/components/admin/__tests__/user-list.test.tsx`. O comando original não executava nada e passaria por "verde" sem rodar um único assert.

```bash
npx tsc --noEmit -p apps/web/tsconfig.json ; echo "exit=$?"
cd apps/web && npx vitest run src/app/api/admin/users src/components/admin/__tests__/user-list.test.tsx 2>&1 | tail -10
npx biome check "apps/web/src/app/(platform)/admin/users/page.tsx" apps/web/src/lib/supabase/service.ts
grep -n "last_sign_in_at: null" "apps/web/src/app/(platform)/admin/users/page.tsx"   # esperado: nenhum hit após a mudança
grep -rn "auth\.users\|auth_users\|listUsers" <novo-módulo-accessor>.ts   # least privilege (AC4): só id + last_sign_in_at devem ser selecionados
```

> **Gate novo exigido pelo @po (AC6 hoje não tem prova):** o AC6 promete degradação graciosa (accessor falha → coluna volta a `null`, página não quebra). Isso precisa de um teste unitário novo do accessor com o service client mockado devolvendo erro, provando que a página continua renderizando. Sem esse teste, AC6 é promessa não verificável — e é justamente o AC que protege produção.

## Change Log
| Data | Evento |
|:--|:--|
| 2026-07-25 | Story criada por River (@sm) a partir do gap identificado em `configuracoes-publicacao-fase1.md` §3.5. Bloqueada por GO do Hugo (acesso a `auth.users` em produção). |
| 2026-07-28 | **GO explícito do Hugo** para o acesso privilegiado a `auth.users` em produção (AC7 satisfeito). Status: `Blocked` → implementada por Dex (@dev). |
| 2026-07-28 | Implementada. Accessor novo em `apps/web/src/app/(platform)/admin/users/last-sign-in.ts` (`fetchLastSignInAt(ids)`), consumido pelo `loadAdminUsers` (`loader.ts`) — o mesmo loader que CFG-1.1 já fez as DUAS rotas (`/admin/users` e `/admin/configuracoes/usuarios`) compartilharem, então é 1 implementação e 2 consumos sem duplicar service role (AC5). O `last_sign_in_at: null` chumbado NÃO estava mais em `page.tsx:129`: a extração da CFG-1.1 o moveu para `loader.ts:151`, e foi lá que ele morreu (AC3). Retorno tipado na fronteira (`Record<string, string \| null>`), sem `any` vazando (Dev Note). |
| 2026-07-28 | **Achado que altera a leitura literal do AC2** (verificado contra a produção, só leitura): `serviceClient.schema("auth").from("users").select("id, last_sign_in_at").in("id", ids)` devolve `PGRST106 Invalid schema: auth` — PostgREST só expõe `public`/`graphql_public`/`storage`. Um `IN` de verdade sobre `auth.users` exigiria função `SECURITY DEFINER` em `public`, ou seja, uma **migration — proibida pelo AC1**. Não há RPC pronta (`PGRST202`). A leitura foi feita pela API administrativa do GoTrue (`auth.admin.listUsers`, paginada), que honra o que o AC2 realmente protege ("nunca 1 query por usuário"): 1 chamada resolve o lote inteiro. **AC2 cumprido no espírito, não na letra** — registrado aqui em vez de silenciado. |
| 2026-07-28 | Least privilege (AC4): `listUsers` carrega 13 campos por usuário no fio (email, phone, identities, metadata). O accessor é a fronteira que os descarta — projeta só `id` + `last_sign_in_at`, e só dos ids pedidos. Teste dedicado quebra se essa projeção for afrouxada. |
| 2026-07-28 | Gate novo do @po entregue: `__tests__/last-sign-in.test.ts`, 11 testes. 4 provam a degradação graciosa do AC6 (service role lançando, erro da API, rede rejeitando, e o `?? null` que vira "—" na tela). Prova de que o teste morde: removendo o `try/catch` do accessor, 2 testes falham; restaurado, 11/11 verdes. Há ainda teto duro de 10 páginas contra varredura infinita da API de Auth (`finops-guardrails`). |
| 2026-07-28 | Duplicata removida no caminho vizinho: `apps/web/src/app/api/admin/users/route.ts` (o "carregar mais" da MESMA lista) tinha a própria cópia do service role, varrendo uma única página de 1000 (silenciosamente errada acima disso) e sem degradação. Passou a chamar o mesmo accessor — a leitura privilegiada de `auth.users` existe agora em UM lugar só. |
| 2026-07-28 | Validação READ-ONLY contra produção (`argos.eximiaacademy.com.br`, autorizada pelo GO): 8 ids pedidos, 8 resolvidos, 8 com data real (ex.: `2026-06-09T13:03:01Z`, `2026-06-29T22:28:25Z`). No universo, 51 de 54 contas têm `last_sign_in_at`. Nenhuma escrita. |
| 2026-07-25 | Validada por Pax (@po): **GO condicional, 9/10.** Escopo bem cercado, least-privilege explícito, degradação graciosa prevista, reuso 1×/chamada 2× correto. Fixes aplicados: gate de teste apontava para um diretório **sem nenhum arquivo de teste** (não rodava nada) e usava `vitest` na raiz, onde o binário não existe; adicionado gate de least-privilege e exigência de teste para o AC6. Manter `Blocked` até o GO do Hugo. |
