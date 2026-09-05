# 08 — Revisão da onda C: o que foi corrigido, o que ficou

> Três revisões independentes e cegas (lentes **isolamento**, **sql** e
> **cadastro-e2e**) leram `git diff origin/deploy/cory...HEAD` conferindo
> `caminho:linha` no código, não nas docs. Este arquivo é o registro do que se
> fez com cada achado: **corrigido**, **refutado** ou **adiado**.
>
> Leitura prévia: `00-decisoes.md`, `04-critica.md` (a revisão da onda anterior),
> `06-contrato-de-dados.md`.
>
> **Nada de SQL foi executado.** Continua sem Docker e sem psql nesta máquina;
> as duas migrations tocadas foram revisadas por LEITURA. O que se garante do
> lado TypeScript é o gate: `tsc --noEmit` limpo, `393` arquivos de teste
> (`4335` testes) verdes, `biome check` limpo nos arquivos tocados.

---

## Como ler a coluna "status"

| Status | Significa |
|---|---|
| **corrigido** | o cenário de falha foi confirmado no código e há mudança neste commit, com teste quando é TypeScript |
| **refutado** | o cenário não se sustenta na leitura do código atual — nada foi mudado, e o porquê está na justificativa |
| **adiado** | o cenário é real, mas fora do raio desta rodada; virou item numerado para o Hugo na seção final |

---

## 1. Achados bloqueantes e altos

| # | Lente | Achado | Arquivo | Status | Justificativa |
|---|---|---|---|---|---|
| G1 | isolamento | Host NEUTRO (ápice, `www.`, subdomínio inexistente) serve o app logado com marca e módulos do NEUTRO; a D3 não dispara | `apps/web/src/lib/tenant/pertencimento.ts:54` | **corrigido** | `hostDeDestinoD3` ganhou ramo para `tenantDoHost === null`, restrito a hosts DENTRO do domínio base; o middleware deixou de exigir `tenant.tenantId` |
| G2 | sql | `20260905120000` aborta em banco povoado (`42701`) e leva junto toda a onda de 06/09 | `supabase/migrations/20260905120000_...sql:105` | **corrigido** | migration reescrita idempotente com checagem objeto a objeto **e** verificação de TIPO — a garantia que motivava o DDL cru continua de pé |
| G3 | sql | `20260702222742` é retrodatada; com `--include-all` faz `CREATE OR REPLACE` por cima dos corpos de produção | `supabase/migrations/20260702222742_...sql:109` | **corrigido** | os três `CREATE OR REPLACE` viraram `DO $do$ ... IF to_regprocedure(...) IS NULL THEN CREATE FUNCTION ...`; produção emite `NOTICE` e não muda nada |
| G4 | sql | A marca é lida de `tenants.brand` e a tela que a grava escreve só em `branding`/`whitelabel_config` — editor write-only | `apps/web/src/app/(platform)/admin/settings/actions.ts:98` | **corrigido** | `saveTenantSettings` e `saveWhitelabelConfig` passam a espelhar em `brand` via `mesclarBrand`, no mesmo UPDATE; teste fecha o laço gravar→ler |
| G5 | cadastro-e2e | Convite aponta para `/auth/accept-invite`, rota que não existe (`(auth)` é route group) | `apps/web/src/app/api/admin/users/invite-user.ts:58` | **corrigido** | os dois call-sites passam a usar `/accept-invite`; teste de fonte confere o caminho contra as rotas reais de `app/` |
| G6 | cadastro-e2e | Guia manda importar a marca do ambiente no serviço NOVO, onde a rota sempre devolve 400 | `docs/faxina-2026-09/07-guia-easypanel.md:262` | **corrigido** | §9 passo 3 reescrito com os dois caminhos que funcionam (3a: deploy de `main` no serviço ANTIGO mantendo as `NEXT_PUBLIC_TENANT_*`; 3b: gravar à mão pela tela de marca) |
| G7 | cadastro-e2e | Bootstrap do super_admin depende de um cadastro por senha que não existe no app | `docs/faxina-2026-09/07-guia-easypanel.md:222` | **corrigido** | §7.3 passo 2 reescrito para **Dashboard → Authentication → Users → Add user** (ou Google, se configurado); o comentário de `20260906005000` que afirmava o mesmo também foi corrigido |
| G8 | cadastro-e2e | "Reenviar convite" não recupera os dois cenários para os quais foi criado | `apps/web/src/app/api/admin/tenants/[tenantId]/convidar-admin/route.ts:63` | **corrigido** | queda para `generateLink({type:"invite"})` + `upsert` do perfil quando `inviteUserByEmail` recusa por e-mail já registrado; erro original preservado se a queda também falhar |

### O que cada correção mudou, em uma linha

- **G1** — `apps/web/src/lib/tenant/pertencimento.ts`, `apps/web/src/middleware.ts`.
  `ORIGENS_COM_IDENTIDADE` virou `ORIGENS_SEM_DESTINO` (`env-legado`, `dev`), e o
  host neutro passou a ter destino **quando está dentro do domínio base**
  (`host === base || host.endsWith("." + base)`). Fora do domínio base nada
  muda: `localhost`, um IP de healthcheck e o domínio próprio de um cliente no
  meio da virada de DNS continuam sendo servidos onde estão — redirecioná-los
  trocaria uma marca incoerente por uma navegação quebrada. No middleware, o
  ramo neutro **não** vale para `/api/*`: um 307 cruzando de origem chega sem
  cookie de sessão (host-only), e rota de API não pinta marca nenhuma.
  Testes: 7 casos novos em `lib/tenant/__tests__/pertencimento.test.ts` e 5 em
  `src/__tests__/middleware-tenant.test.ts`.
- **G2** — colunas por `information_schema.columns` com `RAISE EXCEPTION` em tipo
  divergente; constraints por `pg_constraint`; índices com `IF NOT EXISTS`;
  gatilhos por `pg_trigger`; tabelas por `to_regclass`; policies por
  `DROP POLICY IF EXISTS` + `CREATE` (o Postgres não tem `CREATE POLICY IF NOT
  EXISTS`, e como tudo roda numa transação só não há janela sem política).
  **Escolhi editar a migration original em vez de escrever uma de correção**
  porque ela ainda não rodou em lugar nenhum — em produção ela nunca chegou a
  aplicar (abortava na primeira instrução) e em terreno virgem não existe banco
  para reconciliar. Uma migration de correção teria que desfazer um estado que
  não existe.
- **G3** — mesma decisão e mesmo motivo: `20260702222742` também nunca rodou.
  Editar é honesto; empilhar um `CREATE OR REPLACE` corretivo depois dela seria
  deixar o perigo no arquivo e pedir para o operador confiar no seguinte.
- **G4** — helper `mesclarBrand` novo em `apps/web/src/lib/tenant/marca.ts`,
  ao lado do leitor de propósito: uma função de escrita por tela seria a mesma
  divergência de novo, num arquivo diferente. `undefined` remove a chave (campo
  esvaziado volta ao fallback do NEUTRO em vez de virar `<img src="">`).
  Teste novo: `admin/settings/__tests__/marca-gravada-e-a-marca-lida.test.ts`,
  que alimenta o `brand` gravado pela action no `montarConfigDoTenant` REAL.
- **G5** — o teste novo (`src/__tests__/redirect-de-convite-existe-no-app.test.ts`)
  varre `app/` montando o conjunto de URLs realmente servidas (ignorando route
  groups e pastas `_privadas`) e confere cada `redirectTo: ${baseUrl}...` dos
  dois call-sites contra ele. É teste de fonte porque o defeito não aparece em
  unitário de rota nenhum: para o mock do GoTrue, `redirectTo` é string opaca.
- **G8** — testes em `api/admin/tenants/__tests__/convidar-admin.test.ts`,
  incluindo o caso "a queda também falhou" (a mensagem devolvida é a original) e
  "`stage: profile` não tenta a queda".

---

## 2. Achados médios e baixos

| # | Lente | Achado | Arquivo | Status | Justificativa |
|---|---|---|---|---|---|
| M1 | isolamento | `modules` vazio cai no NEUTRO: toda empresa já cadastrada veria os 6 módulos contratáveis | `apps/web/src/lib/tenant/marca.ts:116` | **adiado** → H1 | Real e confirmado (o contrato §2.2 diz que `modules` não foi backfillada). É mudança de semântica de um default e mexe em `configDoAmbiente()`, `marca.ts` e nos testes dos dois — trabalho próprio, não conserto lateral |
| M2 | isolamento | `loadAdminAreas` decide o gate de módulo pelo HOST e lê o dado pelo USUÁRIO | `apps/web/src/app/(platform)/admin/areas/loader.ts:37` | **adiado** → H2 | Real; o mesmo padrão está em `(platform)/layout.tsx:293`, e consertar só o loader deixaria a metade maior. Módulo é UI, não permissão (AGENTS.md), então não é escalação — é a tela errada |
| M3 | isolamento | `normalizarHost` escolhe o PRIMEIRO de `x-forwarded-host`, enquanto o IP usa o ÚLTIMO de `x-forwarded-for` | `apps/web/src/lib/tenant/resolver.ts:42` | **adiado** → H3 | Real e a assimetria é indefensável. Mas a escolha certa depende de quantos proxies existem entre o navegador e o container no EasyPanel — trocar para `.pop()` sem saber isso pode passar a resolver o host do Traefik em vez do host do cliente, e aí TODA empresa vira NEUTRO |
| M4 | isolamento | `customHost` pode ficar DENTRO do domínio base e sequestrar o host canônico de outra empresa | `packages/shared/src/validators/whitelabel.ts:96` | **adiado** → H4 | Real. A correção (b) sugerida — pular `tenant_domains` quando `slugDoSubdominio` resolve — muda a ordem da D2 e merece decisão explícita, não um patch de revisão |
| M5 | isolamento | `NEXT_PUBLIC_APP_BASE_DOMAIN` lido em BUILD num lugar e em RUNTIME no outro | `apps/web/src/lib/admin/host-canonico.ts:23` | **adiado** → H5 | Real (é o mesmo achado que C2 abaixo, visto por outra lente). O conserto toca `provisionar-tenant.ts`, `admin/tenants/[id]/page.tsx` e o wizard |
| M6 | isolamento | D16 pôs na chave do rate limit um componente escolhido pelo chamador: 1 IP → N baldes | `apps/web/src/middleware.ts:253` | **adiado** → H6 | Real, e o remédio (um segundo `checkLimit` por IP puro, teto global) exige um limitador novo em `lib/rate-limit.ts` com números que ninguém calibrou |
| M7 | isolamento | Requisição anônima vale uma consulta `service_role` por host distinto, sem rate limit, e zera o cache | `apps/web/src/lib/tenant/resolver.ts:165` | **adiado** → H7 | Real. Depende de M4/H4 (o passo (a) é a mesma mudança de ordem) e de trocar `mapa.clear()` por LRU em `cache.ts` |
| M8 | isolamento | O redirecionamento D3 atravessa origem replicando caminho e query, e os cookies são host-only | `apps/web/src/middleware.ts:459` | **adiado** → H8 | Real. Não ampliei: a correção proposta (redirecionar para `/login?next=...` e excluir `/auth/*`) muda o comportamento cravado em `middleware-tenant.test.ts:225` e o fluxo de callback do GoTrue. **Mitigação parcial já neste commit**: o ramo NEUTRO novo (G1) não vale para `/api/*`, justamente por esse raciocínio |
| M9 | isolamento | `/api/v1/*` sai do middleware sem apagar `x-tenant-*` do cliente | `apps/web/src/middleware.ts:142` | **adiado** → H9 | Real e barato, mas hoje nenhum handler de `/api/v1` chama `getTenantContext()` — é armadilha futura, não falha viva. Fica numerado para não ser esquecido |
| M10 | isolamento | O gate D17 mede uma lista fechada de 7 rotas escrita à mão | `apps/web/scripts/verificar-rotas-de-marca-dinamicas.mjs:55` | **adiado** → H10 | Real. Inverter a régua ("reprova se `manifest.routes` tiver QUALQUER chave") é mudança de contrato do gate e mexe nos 16 testes de `verificar-rotas-de-marca-dinamicas.test.ts` |
| S1 | sql | `provisionar_tenant` não valida o formato de `p_custom_host`: host inválido vira `23514`, fora do mapa do contrato | `supabase/migrations/20260906003000_...sql:330` | **adiado** → H11 | Real. Não toquei porque o conserto certo é o mesmo movimento de H4 (recusar host sob o domínio base) e os dois devem entrar juntos, com o `HTTP_POR_SQLSTATE` atualizado |
| S2 | sql | Nada impede cadastrar em `tenant_domains` um host SOB o domínio base | `supabase/migrations/20260906000000_...sql:73` | **adiado** → H4 | Mesmo achado que M4, visto do lado do banco. Um item só para o Hugo |
| S3 | sql | `promover_super_admin` arranca `tenant_id` de um usuário existente, e `user_roles_recompute_primary` trava a reversão | `supabase/migrations/20260906005000_...sql:157` | **adiado** → H12 | Real e desagradável (o rebaixamento aborta com `23514` dentro do gatilho). Exige parâmetro `p_forcar` e coluna de `tenant_id` anterior — decisão de desenho, não patch |
| S4 | sql | O wizard sobe logo/favicon para `{tenantId}/` antes do POST; criação falha, objetos ficam órfãos | `apps/web/src/app/(platform)/admin/tenants/_components/upload-de-arquivo-da-marca.tsx:72` | **adiado** → H13 | Real, sem consequência de isolamento (bucket público só para logo/favicon, D12). Custo: lixo no bucket |
| S5 | sql | `config.toml`: o glob `http://localhost:3000/**` não casa o host nu, e `site_url` segue em `127.0.0.1` | `supabase/config.toml:167` | **adiado** → H14 | Real, e só afeta o ambiente local. Não editei porque `supabase/config.toml` não estava no raio desta rodada e a mudança merece um `supabase start` para conferir |
| S6 | sql | `seed.sql`: o tenant `Demo` nasce com `brand.name` "eximIA Academy" | `supabase/seed.sql:21` | **adiado** → H15 | Real e trivial (uma string), mas `seed.sql` não é arquivo desta rodada e o valor tem leitores em três scripts de seed — trocar sem rodar `db reset` é chute |
| C1 | cadastro-e2e | Guia sobe o serviço antes das migrations; healthcheck falha em ambiente novo | `docs/faxina-2026-09/07-guia-easypanel.md:178` | **corrigido** | Trivial e no MESMO arquivo do G6/G7: §1 ganhou um aviso em destaque mandando rodar §7.1 e §7.2 antes de qualquer deploy num projeto Supabase novo, com o porquê (`/api/health` faz `select id from tenants` e devolve 503) |
| C2 | cadastro-e2e | Duas funções `hostCanonico` com semânticas de env divergentes (build vs runtime) | `apps/web/src/lib/admin/host-canonico.ts:23` | **adiado** → H5 | Mesmo achado que M5. Um item só |
| C3 | cadastro-e2e | Wizard faz `resposta.json()` antes de checar `ok` e engole erros não-JSON | `apps/web/src/app/(platform)/admin/tenants/_components/tenant-wizard.tsx:200` | **adiado** → H16 | Real e confirmado (o arquivo irmão `tenants-management-client.tsx` já faz na ordem certa). Não toquei porque outro agente está editando os componentes dessa árvore nesta mesma janela |
| C4 | cadastro-e2e | CI não roda o gate D17 sobre o artefato e o comentário afirma que roda | `.github/workflows/ci.yml:56` | **adiado** → H17 | Confirmado: `node apps/web/scripts/verificar-rotas-de-marca-dinamicas.mjs` só aparece no `Dockerfile:68`; não há passo no job `quality`. E o comentário cita um `docker build` "documentado no guia" que o guia não tem |
| C5 | cadastro-e2e | `.env.example` declarado como fonte única não é completo | `docs/faxina-2026-09/07-guia-easypanel.md:87` | **adiado** → H18 | Real. Completar `.env.example` é trabalho de inventário (5 chaves + a seção de modo legado), não uma linha |
| C6 | cadastro-e2e | `RESERVED_SLUGS` duplicado; a cópia de `apps/web` não normaliza a entrada | `apps/web/tenant.config.ts:56` | **refutado** | O estado atual do arquivo já faz o que o achado pede: `tenant.config.ts:61` é `export { RESERVED_SLUGS }` de `@eximia/shared` e `ehSlugReservado` (`:63-65`) delega a `isReservedSlug`, que normaliza com `trim().toLowerCase()`. Não há segunda lista nem segundo predicado. O próprio achado registra isso entre parênteses |
| C7 | cadastro-e2e | `/entrar` mostra duas marcas ao mesmo tempo num host de cliente | `apps/web/src/app/(auth)/entrar/page.tsx:47` | **adiado** → H19 | Confirmado por leitura: o layout `(auth)/layout.tsx:21` pinta `brand.logo` do tenant e a página desenha, no meio, um SVG genérico e o texto cravado "eximIA Academy" (`:47-56`). É defeito de UI numa rota secundária (`/` redireciona para `/login`) |

---

## 3. Itens para o Hugo

Numerados, na ordem em que eu os pegaria. Nada aqui bloqueia o deploy da onda C;
os bloqueantes estão todos em §1 e todos corrigidos.

1. **H1 — `modules` vazio não pode cair no NEUTRO.** No dia da virada, cada
   empresa existente passa a ver os 6 módulos contratáveis na navegação,
   inclusive os que nunca contratou, até alguém rodar `importar-marca-do-ambiente`
   ou editar a coluna. Conserto: em `configDoAmbiente()`, quando
   `NEXT_PUBLIC_TENANT_SLUG` estiver ausente (ou seja, não é o modo legado),
   devolver `modules: []` em vez de `[...NEUTRO.modules]`.
   *Impacto se não fizer: módulo aparece para quem não comprou. Não abre dado
   (a trava é RLS), abre menu.*
2. **H2 — o gate de módulo tem que sair do mesmo tenant que dona o dado.**
   `admin/areas/loader.ts:37-39` decide `module-disabled` por
   `getTenantConfig()` (HOST) e lê as áreas por `resolveTenantId(profile.tenant_id)`
   (USUÁRIO). Mesmo padrão em `(platform)/layout.tsx:293`. Ler `modules` da
   linha do tenant dono do dado (`COLUNAS_DE_MARCA` já traz a coluna) resolve os
   dois.
3. **H3 — decidir a ponta confiável de `x-forwarded-host`.** Hoje o host usa o
   PRIMEIRO valor (o que o cliente pediu) e o IP usa o ÚLTIMO (o que o proxy
   pôs). **Antes de mudar**, conte quantos saltos existem entre o navegador e o
   container no EasyPanel: se for só o Traefik, `.pop()` é o certo; se houver
   CDN na frente, `.pop()` passa a devolver o host interno e TODA empresa vira
   NEUTRO. Ajustar `resolver.test.ts:68` junto.
4. **H4 — recusar `customHost` dentro do domínio base.** Um super_admin que
   digite `cory-alimentos.{base}` no campo "domínio próprio" de outra empresa
   faz o host canônico da Cory servir a marca alheia — e a D3 passa a expulsar
   todo mundo da Cory do próprio endereço. Duas travas: (a) 400 em
   `provisionarTenant` para host que termine em `.{dominioBase()}`; (b) pular a
   consulta a `tenant_domains` quando `slugDoSubdominio` já resolveu (isso
   também é o passo (a) do H7).
5. **H5 — uma função `hostCanonico` só.** `lib/admin/host-canonico.ts` lê a env
   por extenso (inlinada em BUILD) e `tenant.config.ts:dominioBase()` lê dinâmico
   (RUNTIME). Se a base só existir como env de runtime — que é o ponto de "uma
   imagem para N empresas" — o middleware resolve certo e o wizard mostra
   `host: null`. Servidor deve importar de `lib/tenant/resolver`; o literal fica
   só no `"use client"` do wizard. E aplicar em `dominioBase()` a mesma limpeza
   de pontos das pontas que `host-canonico.ts:24` faz.
6. **H6 — devolver a cota por IP puro.** `{slug}:{ip}` resolve a justiça entre
   empresas e desfaz o teto por IP: um atacante multiplica a própria cota pelo
   número de empresas só trocando o `Host`. Acrescentar um `checkLimit` com
   identificador `ip` e teto global ANTES do por-empresa; a mais restritiva
   vence.
7. **H7 — a consulta anônima com `service_role` não pode ser ilimitada.**
   `porHostComCache` paga uma consulta `service_role` por host novo, e
   `GET /login` não é limitado por nada (o rate limit só cobre `/api/`). Além do
   passo (a) do H4, trocar o `mapa.clear()` de `cache.ts:69` por eviction
   LRU/FIFO — hoje encher o cache custa as chaves quentes de todo mundo.
8. **H8 — o redirect D3 não deve replicar caminho e query ao cruzar de origem.**
   Cookies são host-only: quem é redirecionado chega deslogado no destino. Pior,
   links do GoTrue (`?code=`, `?token_hash=`) abertos no host errado têm o código
   de uso único replicado numa origem sem o `code_verifier`, queimando o convite.
   Redirecionar para `https://{destino}/login?next={pathname}` e excluir
   `/auth/*` e `/api/auth/*` do D3.
9. **H9 — apagar `x-tenant-*` antes dos early-returns do middleware.** Hoje
   `/api/v1/*` e o atalho de assets saem antes do bloco que limpa esses três
   cabeçalhos. Nada quebra hoje; o primeiro handler de `/api/v1` que chamar
   `getTenantContext()` herda um tenant escolhido pelo chamador.
10. **H10 — inverter a régua do gate D17.** `ROTAS_DE_MARCA` é um array literal
    de 7 rotas; o app inteiro é `force-dynamic` hoje, então o estado esperado é
    `manifest.routes` VAZIO. Reprovar por qualquer chave e listar exceções
    explícitas faz rota nova entrar reprovando por default.
11. **H11 — `provisionar_tenant` deve validar o formato de `p_custom_host`.**
    Hoje só rejeita porta; qualquer outro formato inválido é barrado pelo CHECK
    de `tenant_domains` e vira `23514`, que `HTTP_POR_SQLSTATE`
    (`lib/admin/provisionar-tenant.ts:70-73`) não conhece → HTTP 500 com a
    mensagem crua do Postgres, onde o contrato §4.2 promete 400. Entra junto com
    o H4.
12. **H12 — `promover_super_admin` não pode arrancar `tenant_id` em silêncio.**
    Promover um admin ativo zera `users.tenant_id`, e daí `auth_tenant_id()`
    devolve NULL para ele — perde acesso a todo dado escopado, inclusive o upload
    de marca. E a reversão é impossível: apagar o chapéu faz
    `recompute_primary_role` gravar `role='admin'` numa linha com
    `tenant_id IS NULL`, violando `users_super_admin_tenant_check` DENTRO do
    gatilho. Precisa de `p_forcar boolean DEFAULT false` e de guardar o
    `tenant_id` anterior.
13. **H13 — limpar `tenant-assets/{uuid}/` órfão.** O wizard sobe os arquivos
    antes do POST; se a RPC recusar, os objetos ficam no bucket público para
    sempre. Apagar no `catch`, ou um job para pastas sem tenant com mais de 24h.
    De quebra, separar a mensagem de `23505` por constraint — hoje `tenants_pkey`,
    `tenants_slug_key` e `tenant_domains_host_key` dizem todas a mesma coisa e só
    uma está certa.
14. **H14 — `supabase/config.toml`.** Acrescentar `"http://localhost:3000"` e
    `"http://*.localhost:3000"` (sem `/**`) ao allow-list, e alinhar `site_url`
    (hoje `http://127.0.0.1:3000`) com o resto. Só afeta o ambiente local — que é
    justamente onde o defeito seria detectado.
15. **H15 — `supabase/seed.sql:21`.** `brand.name` do tenant "Demo" é
    "eximIA Academy": o `db reset` local produz uma empresa que a interface
    inteira chama por outro nome, exercitando o caminho banco→marca com um dado
    que não corresponde à linha.
16. **H16 — `tenant-wizard.tsx:200` e `:223`.** `await resposta.json()` roda
    ANTES do `if (!resposta.ok)`: um 502 do Traefik ou uma página HTML de erro do
    Next fazem a exceção subir sem toast nenhum, e o super_admin clica de novo —
    levando 409 sobre uma empresa que ele acha que não criou. **Não toquei porque
    outro agente está editando essa árvore.**
17. **H17 — CI.** Acrescentar `- name: Gate rotas de marca` /
    `run: node apps/web/scripts/verificar-rotas-de-marca-dinamicas.mjs` depois do
    passo Build, e corrigir o comentário de `ci.yml:56-59`, que hoje afirma que
    o gate roda no CI (roda só no `Dockerfile:68`) e cita um `docker build`
    "documentado em 07-guia-easypanel.md" que o guia não tem.
18. **H18 — completar `.env.example`.** Faltam `NEXT_PUBLIC_SITE_URL`,
    `POSTHOG_API_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_BRANDBOOK_CODE`, `CHAT_MODEL`
    e uma seção "modo legado — só no serviço antigo de um cliente" com as
    `NEXT_PUBLIC_TENANT_*` que o §9 do guia ainda exige.
19. **H19 — `/entrar` pinta duas marcas.** O layout mostra o logo do tenant no
    canto e a página desenha "eximIA Academy" cravado no meio. `/login` não tem
    o problema e é para ele que `/` redireciona, então só aparece para quem digita
    `/entrar` ou segue link antigo.

---

## 4. Gate desta rodada

```
pnpm --filter @eximia/web exec tsc --noEmit                     # limpo
pnpm --filter @eximia/web exec vitest run \
  src/lib/tenant src/__tests__ src/app/api/admin/tenants src/lib/__tests__
                                                                # 39 arquivos, 499 testes
pnpm --filter @eximia/web test                                  # 393 arquivos, 4335 testes
pnpm --filter @eximia/web exec biome check <arquivos tocados>   # limpo
```

**O que o gate NÃO cobre, e é preciso dizer:** as duas migrations tocadas (G2, G3)
não foram executadas contra banco nenhum. A revisão delas é leitura de SQL, e a
prova de que `20260905120000` agora atravessa um banco povoado só existe no dia
em que o `supabase db push` rodar. Se ele falhar, o sintoma esperado mudou de
`42701 column already exists` (abortava tudo) para o `RAISE EXCEPTION` explícito
de tipo divergente — que é a única forma de falha que a versão idempotente
mantém de pé.
