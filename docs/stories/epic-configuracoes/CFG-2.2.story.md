# CFG-2.2 — Camada de acesso + UI de estado: ciclo de vida de convites

> **Status:** Ready
> **Tier:** 1 (camada de acesso + UI de estado — **deixou de ser schema**, ver decisão do dono abaixo) · **Tamanho:** L (accessor novo + 2 endpoints + estado derivado em 4 variantes + UI de lista/stats, sem migration) · **Depende de:** CFG-1.1
> **Fonte:** `docs/architecture/configuracoes-publicacao-fase1.md` §3.5 (seção "Fica para depois" de Usuários)
> **Migrations:** **NENHUMA.** Decisão do dono (Hugo, 2026-07-28): caminho **D-mínimo** — o Supabase Auth já é a fonte da verdade do aceite (`invited_at`/`confirmed_at`), esta story lê esse estado por um accessor server-side, não cria tabela nem altera `users.status`. Ver `docs/architecture/convites-desenho.md` §5 (caminho D), §6 (tabela comparativa) e §7 (recomendação).

## Contexto

O mockup de Usuários (fidelidade em CFG-6.1, AC8) modela convites com ciclo de vida: pill "Convite pendente", ação "Reenviar convite", ação "Revogar convite", stat clicável "Convites pendentes". O produto **já convida de verdade** — `serviceClient.auth.admin.inviteUserByEmail` está em produção desde antes deste épico (`apps/web/src/app/api/admin/users/route.ts:188`), com rota de aceite (`apps/web/src/app/(auth)/accept-invite/`) e auditoria (`action: "user.invited"`, `route.ts:226`). O que falta não é enviar o convite, é **representar** o estado dele: hoje a mesma rota já insere a pessoa em `public.users` com `status: 'active'` (`route.ts:205`), então quem nunca abriu o e-mail nasce indistinguível de quem já é usuário. Fato medido em produção (2026-07-28): **54 usuários no Auth, 0 convites nunca aceitos** — o problema é prospectivo, não há saneamento de dado pendente hoje.

O Supabase Auth já guarda o que essa story precisa: `admin.listUsers()` (chamado pela mesma rota de usuários desde a CFG-2.3, `route.ts:108`, e consumido pelo loader compartilhado `admin/users/loader.ts` + accessor `admin/users/last-sign-in.ts`) já devolve `invited_at` e `confirmed_at` por conta, sem query nova. Esta story lê esse ciclo em vez de construir um segundo, no mesmo padrão de accessor de privilégio mínimo já estabelecido pela CFG-2.3.

## Decisão do dono (Hugo, 2026-07-28)

**Caminho D, na variante D-mínimo** (Auth como fonte da verdade do aceite; ledger `user_invites` desenhado em `convites-desenho.md` §5, engatilhado mas **não** implementado nesta story — só entra se a contagem em volume vier a exigir). Material completo, blast radius medido e tabela comparativa dos 4 caminhos: `docs/architecture/convites-desenho.md`. Justificativa resumida do @architect (§7): dos 23 call-sites que tocam `users.status` em produção, 1 tem guard de tipo e 0 quebrariam o build com um valor novo (`users.status` é `string`, clientes Supabase não tipados) — o mesmo modo de falha que já reprovou os caminhos B/P2/P3 na CFG-2.1; o caminho B, além disso, não consegue satisfazer o AC "revogar sem nunca ter criado um usuário `active`" sem reescrevê-lo. D-mínimo é o único caminho totalmente reversível por `git revert`, sem passo em banco.

Isso substitui a QUESTÃO ABERTA (a)/(b)/(c) que bloqueava a story (fix **F2** do @po). Os ACs abaixo são a redação final para o caminho D-mínimo.

## Acceptance Criteria

1. **Accessor server-side de estado de convite, sem migration.** Novo módulo irmão de `admin/users/last-sign-in.ts` (CFG-2.3), reusando o **mesmo** princípio de least privilege e, sempre que viável, a **mesma** chamada `auth.admin.listUsers` já paginada por aquele módulo (não uma segunda varredura paginada independente contra o Auth). Devolve, por id de usuário, a projeção mínima `{ invited_at, confirmed_at }` — nada mais do schema `auth` atravessa para o loader, a página ou o client.
2. **Estado derivado, exibido sem escrever em `users.status`.** Para cada usuário, nesta ordem de precedência: `status = 'inactive'` → "Desativado"; senão `confirmed_at IS NULL` e `now() > invited_at + INVITE_TTL_DAYS` → "Convite expirado"; senão `confirmed_at IS NULL` e `invited_at IS NOT NULL` → "Convite pendente"; caso contrário → "Ativo". A coluna `users.status` no banco **não muda de valor nem de significado** em nenhum desses casos — o estado exibido é inteiramente derivado em memória.
3. **Pílula "Convite pendente" (e "Convite expirado") na lista de usuários** (`components/admin/user-list.tsx`), substituindo o par binário Ativo/Inativo por essas 4 variantes derivadas do AC2, sem alterar a lógica de Desativar/Reativar já existente (que continua operando sobre `users.status`, intocado).
4. **Ação "Reenviar convite".** Novo endpoint `/api/admin/users/[userId]/resend-invite` (padrão tenant-scoped admin/super_admin, AC8), que chama `auth.admin.generateLink({ type: "invite", email, options: { data, redirectTo } })` — o mesmo padrão já em produção em `reset-password/route.ts:51` (`type: "recovery"`), sem devolver o link ao chamador. Não cria nem duplica linha em `users` (a linha já existe desde o convite original). Só é permitido enquanto o estado derivado (AC2) for "Convite pendente" ou "Convite expirado"; sobre um usuário já "Ativo" ou "Desativado" o endpoint rejeita com 409. Audita `action: "user.invite_resent"`.
5. **Ação "Revogar convite".** Novo endpoint `/api/admin/users/[userId]/revoke-invite` (mesmo padrão de guard), que executa `auth.admin.deleteUser(id)` **e** remove a linha correspondente de `public.users` — linha ainda virgem, sem `enrollments`, sem `sessions`, sem `manager_group_members`. Satisfaz literalmente a promessa do mockup: o ciclo se encerra **sem nunca ter existido um usuário `active`**. Só é permitido enquanto o estado derivado for "Convite pendente" ou "Convite expirado" (`confirmed_at IS NULL`); sobre um usuário já confirmado o endpoint rejeita com 409 — revogar não é uma forma alternativa de desativar. Audita `action: "user.invite_revoked"`.
6. **Contador "Convites pendentes".** `admin/users/loader.ts` passa a expor a contagem de usuários em estado "Convite pendente" ou "Convite expirado" (AC2), calculada em memória sobre o mesmo lote do accessor do AC1 — **não** um `count(*)` SQL novo. O stat "Ativos" existente (`loader.ts:171-175`) para de contar quem está com convite pendente/expirado (hoje ele conta, porque a linha nasce `status: 'active'` — é a origem da contagem inflada medida em `convites-desenho.md` §3.5).
7. **`INVITE_TTL_DAYS` como constante de aplicação, com a origem do valor documentada.** Definida em código (não em banco, não em migration), com comentário explicando que o TTL efetivo do projeto Supabase (configuração de painel, tipo `MAILER_OTP_EXP` ou equivalente da tela de Auth) precisa ser lido e conferido antes de o valor ser considerado definitivo — hoje esse TTL é desconhecido, e isso é um gap pré-existente do produto, não uma dívida criada por esta story. A constante é revisável sem migration.
8. **RLS/guards.** Os dois endpoints novos (AC4, AC5) seguem o mesmo padrão tenant-scoped `admin`/`super_admin` já usado nos demais endpoints `/api/admin/*` — o `userId` alvo é validado contra o `tenant_id` de quem chama antes de qualquer ação no Auth, no mesmo padrão de `api/admin/users/[userId]/route.ts`.
9. **Degradação graciosa.** Se a chamada ao Auth (AC1) falhar — service role ausente, erro de rede, GoTrue fora do ar —, o accessor devolve mapa vazio (mesmo contrato de `last-sign-in.ts`), a pílula volta ao par binário Ativo/Inativo atual (sem "Convite pendente"/"expirado") e o contador do AC6 fica ausente do stats (`null`, não zero, para não ser lido como "zero pendentes"). A lista de usuários **continua renderizando** — nenhum desses 4 ACs pode derrubar a página.
10. **Zero objeto de banco tocado.** Nenhuma migration, nenhum `ALTER` em `users_status_check`, nenhuma tabela nova. Verificável por `git diff --stat -- supabase/migrations/` vazio ao final da implementação. Reversão desta story é `git revert` puro, sem passo em banco.

## Dev Notes

- Fato verificado: `supabase/migrations/20260209000000_epic11_super_admin_whitelabel.sql:25` — `ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'inactive'));`. Esta story não toca essa constraint.
- Convite individual hoje: `apps/web/src/components/admin/invite-user-dialog.tsx` + handler em `POST /api/admin/users` — chama `inviteUserByEmail` (envia o convite real) e insere `status: 'active'` no mesmo request (`route.ts:188` e `:205`). Esta story não muda esse insert; ela só passa a **exibir** o estado real por cima do valor gravado.
- Accessor irmão de referência: `apps/web/src/app/(platform)/admin/users/last-sign-in.ts` (CFG-2.3) — mesmo padrão de paginação (`PAGE_SIZE=1000`, `MAX_PAGES=10`), mesmo contrato de falha silenciosa (catch → `{}`), mesma fronteira de projeção mínima. Preferir estender aquele módulo (ou um irmão que compartilhe a mesma chamada `listUsers`) a duplicar a varredura paginada contra o Auth.
- Padrão de `generateLink` já em produção: `apps/web/src/app/api/admin/users/[userId]/reset-password/route.ts:51` (`type: "recovery"`). O AC4 usa o mesmo mecanismo com `type: "invite"`.
- `registration_code`/`is_third_party` (B3 da ficha corretiva) é migration **diferente**, acoplada ao bulk import — fora do escopo desta story, não antecipar.
- Ledger `user_invites` (D+ledger, `convites-desenho.md` §5): **não** implementado nesta story. Fica desenhado e adiável; entra apenas se a contagem do AC6 (memória sobre `listUsers`, project-wide e paginado) vier a doer em volume — hoje (54 usuários) é irrelevante.
- Medição de produção que motivou a decisão: 54 usuários no Auth, 0 convites nunca aceitos (2026-07-28) — registrado para não se perder, não é um AC (não há saneamento de dado pendente).

## Gate

> **Correção de gate herdada (@po):** `npx vitest` não roda na raiz do repo — o binário só existe em `apps/web` e `packages/shared`. Comandos abaixo já vêm com `cd` correto.

```bash
git diff --stat -- supabase/migrations/                                       # DEVE ficar vazio — AC10
npx tsc --noEmit -p apps/web/tsconfig.json ; echo "exit=$?"
cd apps/web && npx vitest run src/app/api/admin/users 2>&1 | tail -20
npx biome check apps/web/src/components/admin/user-list.tsx apps/web/src/app/api/admin/users apps/web/src/app/\(platform\)/admin/users
```

> **Gate corrigido (achado do @architect, verificado em campo, 2026-07-28):** o gate anterior desta story afirmava que `user-admin-handlers.test.ts` "já cobre o fluxo atual (convite grava `status: 'active'`)". **Isso é falso** — `grep -n "describe\|it("` no arquivo mostra 12 `it()`, todos cobrindo `PATCH /api/admin/users/[userId]` (campos organizacionais) e `POST .../reset-password`; `grep -c "inviteUserByEmail" <mesmo arquivo>` → **0**. Não existe nenhum caso de teste para o POST de convite hoje. O gate real desta story exige **criar**, não estender, os seguintes casos (no mesmo arquivo ou em um novo `__tests__` irmão):
> - accessor do AC1 devolvendo `{ invited_at, confirmed_at }` corretamente projetado, e devolvendo `{}` quando o Auth falha (AC9);
> - derivação do AC2 para os 4 estados (Ativo, Desativado, Convite pendente, Convite expirado), incluindo a precedência de "Desativado" sobre os demais;
> - `POST .../resend-invite`: 200 quando pendente/expirado, 409 quando já ativo/desativado, guard tenant-scoped (401/403/404 no mesmo padrão dos handlers existentes);
> - `POST .../revoke-invite`: 200 quando pendente/expirado (e a linha some de `users`), 409 quando já confirmado, guard tenant-scoped;
> - stat de "Convites pendentes" do AC6 refletindo o contador em memória, e o stat "Ativos" deixando de contar pendentes.
> Sem esses casos, o gate desta story não prova nada — mesma lição já registrada em F6 do README do épico.

## Dev Agent Record (Dex, 2026-07-28)

**Arquivos novos:** `apps/web/src/lib/invites/ttl.ts` (AC7), `.../status.ts` (derivação pura, AC2), `.../revoke-safety.ts` (trava do destrutivo), `.../target.ts` (guard compartilhado, AC8); `apps/web/src/app/(platform)/admin/users/auth-accounts.ts` (accessor, AC1); rotas `api/admin/users/[userId]/resend-invite/` e `revoke-invite/`. **Testes novos:** `admin/users/__tests__/{auth-accounts,invite-status,loader-invite-stats}.test.ts`, `api/admin/users/__tests__/invite-lifecycle.test.ts`, mais 3 casos em `components/admin/__tests__/user-list.test.tsx`.

**Editados:** `last-sign-in.ts` (virou projeção fina do accessor único — "último acesso" e convite saem da MESMA `listUsers`, como o AC1 pede), `loader.ts`, `api/admin/users/route.ts` (GET), `user-list.tsx`, `user-stats-grid.tsx` e as 2 páginas.

**Divergências da redação da story, todas na direção da cautela:**

1. **AC5 ganhou uma trava que a story não pedia.** `public.users.id` é `REFERENCES auth.users(id) ON DELETE CASCADE` (`20260207000000_initial_schema.sql:27`): `deleteUser` sozinho já derruba a linha do produto **e tudo que pendura nela** (24 tabelas com FK para `public.users`, 14 para `auth.users`, a maioria CASCADE). Por isso a revogação agora verifica 27 vínculos ANTES de tocar no Auth (`revoke-safety.ts`) e **recusa com 409** se achar qualquer um — ou se não conseguir verificar (fail-closed). Única exceção: tabela inexistente (drift de schema) não bloqueia, porque não guarda dado a perder. Também 400 para quem tentar revogar o próprio acesso.
2. **AC6 trocou um `count(*)` por um censo em memória.** O `count(*)` de "Ativos" foi substituído por um `select id, status` do tenant, e "Ativos"/"Convites pendentes" saem da derivação em memória sobre ele. Não é um `count(*)` novo (é um a menos), mas é uma leitura nova — necessária porque contar só a página de 20 daria um número errado com cara de certo. Se doer em volume, é exatamente o gatilho do ledger `user_invites` já desenhado.
3. **AC4/AC5 recusam agir quando o Auth não responde.** Sem os fatos do convite não há como afirmar "pendente"; os dois endpoints devolvem 409 em vez de agir no escuro. A LISTA, essa sim, continua renderizando (AC9).
4. **O reenvio reconstitui o `user_metadata` do convite original** (`tenant_id`, `role`, `full_name`, `report_name`). `generateLink` grava o metadata que recebe: mandar menos apagaria `role`/`tenant_id`, que é o fallback lido em `accept-invite/actions.ts`.
5. **`INVITE_TTL_DAYS = 7`** é decisão de exibição, não leitura do servidor. A única pista em disco é `supabase/config.toml:217` (`otp_expiry = 3600`, ambiente LOCAL). O TTL de produção segue não lido, como o AC7 antecipa.

**Gates (2026-07-28):** `git diff --stat -- supabase/migrations/` vazio · `tsc --noEmit` exit 0 · vitest nos 3 caminhos do gate: 8 arquivos, **99 testes verdes** · `biome check` sem erro (1 warning pré-existente em `loading.tsx`) · `turbo run build --filter=@eximia/web` verde. Suíte completa de `apps/web`: 1731 verdes, 23 vermelhos em 6 arquivos (`sessions/messages`, `login-form-google-oauth`, `manager-dashboard`, `manager-course-dashboard`, `step-employee-status`, `rate-limit`) — nenhum deles importa qualquer módulo desta story (verificado por grep); são das outras frentes em voo na mesma árvore suja.

## Change Log

| Data | Evento |
|:--|:--|
| 2026-07-25 | Story criada por River (@sm) a partir do gap identificado em `configuracoes-publicacao-fase1.md` §3.5. Bloqueada por desenho de schema não decidido + GO do Hugo. |
| 2026-07-25 | Validada por Pax (@po): NO-GO como story implementável (6/10), GO como pedido de decisão (fix **F2**). Recomendação do @po ao dono: caminho (a) tabela `user_invites`. |
| 2026-07-28 | Material de decisão produzido por Aria (@architect): `docs/architecture/convites-desenho.md`. Quarto caminho (D, Auth como fonte da verdade) acrescentado e recomendado; blast radius medido (23 call-sites de `users.status`, 1 guard, 0 pegos pelo compilador); duas premissas da story corrigidas em campo (o produto já usa `inviteUserByEmail`; o teste do POST de convite não existe). Nenhuma migration escrita, nenhum código tocado. |
| 2026-07-28 | **Decisão do dono (Hugo): caminho D, variante D-mínimo.** River (@sm) reescreveu a story por completo para esse caminho: Status `Blocked` → `Ready`; `Migrations` de "SIM, desenho pendente" para "NENHUMA"; Tier de "schema" para "camada de acesso + UI de estado"; ACs 1-10 redigidos para D-mínimo (accessor irmão de CFG-2.3, estado derivado sem escrita em `users.status`, reenviar/revogar via Auth admin, `INVITE_TTL_DAYS` como constante de aplicação, degradação graciosa, zero objeto de banco tocado); Gate corrigido para exigir a **criação** (não extensão) do teste de convite, com achado do @architect que `user-admin-handlers.test.ts` tem 0 casos para `inviteUserByEmail`, confirmado por `grep`. Fix **F2** do @po resolvido. |
