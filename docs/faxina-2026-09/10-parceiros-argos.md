# 10 — Instâncias: eximIA Academy e Argos Academy (reescrito em 2026-09-08)

> Substitui a versão anterior deste documento por completo. O modelo de tabela
> `partners` (parceiro como terceiro nível dentro do banco da eximIA, com
> `partner_admin` e `tenants.partner_id`) foi **descartado pelo Hugo** em
> 2026-09-08 — Argos não é cliente da eximIA, é outro operador da mesma
> plataforma. Ver `00-decisoes.md` D21.

## O que é uma instância

A plataforma (esta imagem Docker) pode rodar mais de uma vez, para operadores
diferentes. Cada execução é uma **instância**: um serviço EasyPanel próprio,
buildado a partir da mesma `main`, apontando para o **seu** projeto Supabase,
respondendo no **seu** domínio base, com a **sua** marca neutra vinda de
variáveis de ambiente `PLATFORM_*` (D21). "eximIA Academy" e "Argos Academy"
são duas instâncias da mesma plataforma — não duas features, não dois
branches, não duas tabelas no mesmo banco.

Dentro de cada instância, o multi-tenant por host continua **exatamente como
está** hoje (D1–D5): a instância eximIA tem suas empresas (`{slug}.{base
eximIA}`), a instância Argos tem as dela (`{slug}.{base Argos}`), cada uma
isolada por RLS no banco daquela instância. Uma empresa nunca "pertence" a
duas instâncias ao mesmo tempo, porque cada instância é literalmente um banco
diferente.

## eximIA vs Argos, lado a lado

| | Instância eximIA | Instância Argos |
|---|---|---|
| Imagem Docker | mesma (`main`, este repo) | mesma (`main`, este repo) |
| Serviço EasyPanel | `academy-web` (ou nome equivalente) | `argos-academy-web` |
| Projeto Supabase | `eximia-academy-multi` (ref `hrnpjsimcjobilbjteno`) | candidato natural: `vaguswivhqnlbgqvnjch` (ver §"Destino do banco de produção" abaixo) |
| Domínio base | `eximiaacademy.com.br` | domínio próprio da Argos (a definir; hoje `argos.eximiaacademy.com.br` aponta para o banco de produção antigo — ver abaixo) |
| Porta de entrada neutra (super_admin da instância, empresas sem marca) | `app.eximiaacademy.com.br` | equivalente no domínio da Argos, a decidir |
| `PLATFORM_SLUG` | `eximia` (ou ausente — é o default) | `argos` |
| `PLATFORM_BRAND_*` | ausente (usa o NEUTRO cravado em `tenant.config.ts`) | nome/logo/cores da Argos — os arquivos já existem em `apps/web/public/logos/argos-*.png` |
| `super_admin` | `hugo.capitelli@eximiaventures.com.br` (bootstrap feito em 2026-09-08) | próprio da Argos, cadastra as empresas dela nesse Supabase |
| Empresas que cadastra | as empresas da eximIA (ex.: `teste-faxina`) | as empresas de treinamento da Argos (ex.: Cory) |

Argos **não aparece em nenhuma tabela do banco da eximIA**. Não há
`partners`, não há `partner_id` em `tenants`, não há papel `partner_admin`. A
Argos é só outro deploy do mesmo código, com seu próprio Supabase.

## O destino do banco de produção `vaguswivhqnlbgqvnjch`

O projeto Supabase de produção atual (`vaguswivhqnlbgqvnjch`) já roda com a
marca Argos e já tem a Cory como tenant — ele é o **candidato natural** a
virar o banco oficial da instância Argos: menor caminho, sem migração de
dados, sem downtime para a Cory.

O problema: esse mesmo banco também tem tenants da **eximIA** hoje —
**eximIA Academy** (o tenant demo da própria eximIA), **Harven** e
**Vértice**. Se `vaguswivhqnlbgqvnjch` vira o banco da instância Argos, esses
três tenants ficam "morando" no banco errado — a instância Argos passaria a
hospedar dados de clientes que não são dela.

Decisão pendente do Hugo, uma das duas:

1. **Mover** eximIA Academy, Harven e Vértice para o banco novo da instância
   eximIA (`eximia-academy-multi`, ref `hrnpjsimcjobilbjteno`) antes de
   `vaguswivhqnlbgqvnjch` virar oficialmente o banco da Argos — exige export/
   import de dados desses três tenants (usuários, cursos, progresso) e trocar
   o DNS deles para o domínio base da instância eximIA.
2. **Manter** os três onde estão e aceitar que, formalmente, esses tenants
   ficam hospedados no banco da instância Argos até uma migração futura —
   funciona no curto prazo (RLS ainda isola os dados entre tenants dentro do
   mesmo banco), mas mistura a fonte de verdade das duas instâncias e
   complica qualquer auditoria ou rollback futuro de uma instância sem afetar
   a outra.

Nenhuma das duas foi executada por este documento — é decisão de negócio,
registrada aqui para não se perder.

## Plano para desligar o `deploy/cory`

O serviço antigo (`deploy/cory`, branding via `NEXT_PUBLIC_TENANT_*` cravado
em build) atende hoje `argos.eximiaacademy.com.br` a partir de
`vaguswivhqnlbgqvnjch`. Passo a passo para substituí-lo pela instância Argos
de verdade, sem downtime:

1. **Decidir** primeiro a questão do parágrafo acima (mover ou manter os
   tenants eximIA) — o passo 2 aplica migrations no mesmo banco que serve
   esses tenants hoje, então a decisão precisa vir antes, não depois.
2. **Aplicar as migrations** (`supabase db push`) em `vaguswivhqnlbgqvnjch` —
   é o mesmo processo do §7.1 de `07-guia-easypanel.md`, incluindo a
   conferência de `pg_get_functiondef` contra as 3 funções do M0 antes de
   aplicar (é banco de produção real, com dado real da Cory).
3. **Subir `argos-academy-web`**: novo serviço EasyPanel, mesma imagem
   (`main`, mesmo `Dockerfile`), apontando para `vaguswivhqnlbgqvnjch`
   (`NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` desse projeto), com
   as `PLATFORM_*` da Argos:
   - `PLATFORM_SLUG=argos`
   - `PLATFORM_BRAND_NAME`, `PLATFORM_BRAND_LOGO`, `PLATFORM_BRAND_LOGO_LIGHT`,
     `PLATFORM_BRAND_FAVICON` apontando para os arquivos que já existem em
     `apps/web/public/logos/argos-academy-color.png`,
     `apps/web/public/logos/argos-academy-light.png`,
     `apps/web/public/logos/argos-academy-dark.png`,
     `apps/web/public/logos/argos-color.png`,
     `apps/web/public/logos/argos-light.png`,
     `apps/web/public/logos/argos-dark.png` (escolher qual par vira logo
     principal/claro/favicon é decisão de design, não deste documento).
   - `PLATFORM_BRAND_PRIMARY_COLOR` / `PLATFORM_BRAND_ACCENT_COLOR` da Argos.
4. **Bootstrap do super_admin da Argos** nesse Supabase, com
   `scripts/bootstrap-super-admin.mjs` (mesma Forma C documentada em
   `07-guia-easypanel.md` §7.3), com o e-mail que a Argos indicar.
5. **Conferir** que `argos-academy-web` responde e mostra a marca Argos antes
   de tocar DNS — testar pelo domínio temporário que o EasyPanel atribui ao
   serviço.
6. **Virar o DNS**: apontar `argos.eximiaacademy.com.br` (hoje na Hostinger,
   apontando para `76.13.82.199`) para o serviço novo. Registro por host
   (sem wildcard na Hostinger hoje) — ver `07-guia-easypanel.md` §4.
7. **Desligar o serviço antigo** (`deploy/cory`) só depois do passo 6
   confirmado — mantê-lo parado, não apagado, por alguns dias como rollback.

Isso fecha o ciclo: o serviço `deploy/cory` deixa de existir e a instância
Argos passa a ser um deploy de primeira classe da mesma plataforma, não um
branding cravado em build de um serviço que originalmente era só da Cory.
