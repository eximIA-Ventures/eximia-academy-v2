# 07 — Guia de deploy no EasyPanel (serviço único, main)

> Escrito para o Hugo executar sem o agente do lado. Assume EasyPanel já instalado numa
> VPS com um domínio wildcard disponível. Nenhum passo daqui foi executado — é a
> tradução operacional de `00-decisoes.md` e `02-plano-app-novo.md` §5, não uma confirmação
> de que rodou.
>
> Leitura prévia se algo aqui não bater com o que você vê no painel: `00-decisoes.md`
> (D1, D2, D7, D11, D13, D15, D16, D17, D20), `06-contrato-de-dados.md` (§4.2, §6).

---

## 0. O que muda em relação ao modelo antigo

Antes: **um serviço EasyPanel por cliente**, cada um numa branch `deploy/{client}` com
`NEXT_PUBLIC_TENANT_*` cravadas como build-arg. Depois: **um serviço só**, buildado a
partir de `main`, servindo qualquer empresa pelo host da requisição. Cliente novo deixa de
ser "criar branch + criar serviço + apontar DNS" e passa a ser **uma linha em `tenants`**,
cadastrada pela própria UI do super_admin.

`apps/central` não existe mais (D7) — o painel do super_admin vive dentro do serviço único,
em `/admin`.

---

## 0.1 Instâncias: eximIA e Argos

A partir de 2026-09-08 este guia serve para configurar **qualquer instância** da
plataforma, não só a da eximIA (D21, `00-decisoes.md`). "eximIA Academy" e "Argos
Academy" são a **mesma imagem Docker**, a mesma `main`, o mesmo `Dockerfile` — o que
muda entre elas é: o **serviço** EasyPanel (um por instância), o **projeto Supabase**
(um por instância, isolado — nenhuma tabela compartilhada), o **domínio base** e a
**marca neutra** da instância, que agora vem de variáveis `PLATFORM_*` lidas em
**runtime, no servidor** (aba **Environment**, nunca **Build** — ao contrário de
`NEXT_PUBLIC_APP_BASE_DOMAIN`, essas não entram no bundle do navegador).

Sem nenhuma `PLATFORM_*` setada no serviço, a instância é a **eximIA Academy** — é o
default (`PLATFORM_SLUG=eximia` implícito), não uma instância "em branco". Para subir a
instância Argos, siga este guia inteiro normalmente (§1–§9) num serviço novo, banco novo,
domínio novo, e some as variáveis abaixo na aba **Environment**:

| Variável | Obrigatória? | Exemplo/uso |
|---|---|---|
| `PLATFORM_SLUG` | não (default `eximia`) | `argos` — identifica a instância para lógica futura, nunca vira branch de código |
| `PLATFORM_BRAND_NAME` | não | `Argos Academy` |
| `PLATFORM_BRAND_LOGO` | não | caminho do arquivo, ex. `/logos/argos-academy-color.png` (já existe em `apps/web/public/logos/`) |
| `PLATFORM_BRAND_LOGO_LIGHT` | não | ex. `/logos/argos-academy-light.png` |
| `PLATFORM_BRAND_FAVICON` | não | ex. `/logos/argos-color.png` |
| `PLATFORM_BRAND_PRIMARY_COLOR` / `PLATFORM_BRAND_ACCENT_COLOR` | não | hex, `#RRGGBB` |
| `PLATFORM_BRAND_PARTNER_NAME` / `PLATFORM_BRAND_PARTNER_LOGO` | não | "Academy by X", se a instância quiser um selo de parceiro na marca neutra |
| `PLATFORM_FOOTER_TEXT` | não | texto do rodapé da marca neutra |
| `PLATFORM_SUPPORT_EMAIL` | não | e-mail de suporte da marca neutra |
| `PLATFORM_MODULES` | não | CSV de módulos habilitados por default na marca neutra da instância |

Ordem de mescla da marca (D4/D21): **banco** (`tenants.brand`, por empresa) → **env
legado** `NEXT_PUBLIC_TENANT_*` (D2 passo 3, serviço de um cliente só) → **marca da
instância** (`PLATFORM_*`) → **NEUTRO eximIA** (cravado em `tenant.config.ts`). Uma
empresa sem marca própria, dentro da instância Argos, herda a marca `PLATFORM_*` da
Argos — não a NEUTRO eximIA.

O que **não** muda entre instâncias: tudo o resto deste guia (§1 a §9) — Dockerfile,
build args, migrations, RLS, provisionamento de tenant, healthcheck. Cada instância é
uma execução independente do mesmo passo a passo.

---

## 1. Criar o serviço novo no EasyPanel

> **Ordem: as migrations (§7.1) e as Redirect URLs (§7.2) vêm ANTES de qualquer deploy.**
> `GET /api/health` faz `select id from tenants` e devolve 503 em erro
> (`apps/web/src/app/api/health/route.ts`). Num projeto Supabase novo a tabela `tenants`
> ainda não existe quando o container sobe: com o healthcheck do §5 configurado
> (`interval 30s`, `retries 3`), o EasyPanel marca o serviço unhealthy e entra em ciclo de
> restart antes de você chegar ao §7. A conferência do §4.4 também só é honesta depois
> das migrations — antes delas a página não consegue resolver `tenant_domains` nem ler
> `tenants.brand`. Se o projeto Supabase for novo, **rode §7.1 e §7.2 agora** e volte
> para cá.

1. **App → Create → From Git Repository.**
2. **Repositório**: o mesmo de sempre. **Branch**: `main` (nunca mais `deploy/*` — essa
   convenção morreu com este guia).
3. **Build method**: Dockerfile. **Caminho do Dockerfile**: `Dockerfile` (raiz do repo).
   O contexto de build é a raiz do monorepo — não aponte para `apps/web/`.
4. **Nome do serviço**: algo estável, ex. `academy-web`. Vai aparecer nos logs e no
   healthcheck; não precisa levar nome de cliente nenhum, porque agora atende todos.

Não crie um segundo serviço para `apps/central` — ele foi apagado do repositório (D7).

---

## 2. Build args

O `Dockerfile` só aceita `ARG` para o que precisa ser **inlinado no bundle do
navegador** (prefixo `NEXT_PUBLIC_*`) ou usado durante o `next build`. Cadastre estes no
EasyPanel na aba **Build** do serviço (não na aba **Environment** — build-arg e env de
runtime são cadastros diferentes no painel, e um `NEXT_PUBLIC_*` só de runtime não chega
ao bundle):

| Build arg | Valor | Origem |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | a anon key do projeto | idem |
| `NEXT_PUBLIC_APP_URL` | `https://academy.{seu-domínio-base}` (um valor qualquer estável; deixou de ser identidade, é só fallback quando não há request para derivar o host) | escolha sua |
| `NEXT_PUBLIC_APP_BASE_DOMAIN` | ex. `academy.eximiaventures.com.br` | **[HUGO decide]** — D1. É o domínio depois do qual todo `{slug}.` vira um tenant |
| `NEXT_PUBLIC_SENTRY_DSN` | opcional | Sentry |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | opcional | PostHog |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | opcional, só se for subir source maps | Sentry |

**Não existe mais nenhum `NEXT_PUBLIC_TENANT_*` nem `MARCA_ESPERADA_SLUG`.** Se você
migrou de um serviço antigo e copiou os build args dele, apague essas 16 variáveis — elas
não têm efeito nenhum no `Dockerfile` novo (não são mais lidas) e deixá-las lá só confunde
o próximo humano que olhar o painel.

---

## 3. Environment vars (runtime)

Aba **Environment** do serviço. Estas não afetam o bundle, são lidas a cada request/boot:

| Variável | Obrigatória? | Valor / origem |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sim | mesma do build |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | mesma do build |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | Supabase Dashboard → Settings → API → `service_role` (secreta — nunca vai para o navegador). É usada pelo middleware para resolver `tenant_domains.host` e por toda rota `service_role` |
| `NEXT_PUBLIC_APP_URL` | sim | mesmo valor do build |
| `NEXT_PUBLIC_APP_BASE_DOMAIN` | sim | mesmo valor do build |
| `OPENAI_API_KEY` | sim (pelo menos um provedor de LLM) | OpenAI |
| `DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` | opcionais | provedores adicionais de LLM |
| `INTERNAL_AUTH_TOKEN` | obrigatória **se** for usar o microserviço `blueprint` | gere um segredo forte (`openssl rand -hex 32`); o mesmo valor precisa estar cadastrado no serviço `blueprint` (ver §5). Autentica `X-Internal-Token` nas duas pontas — D15 |
| `BLUEPRINT_MICROSERVICE_URL` | opcional | URL interna do serviço `blueprint` (ex. `http://blueprint:8000` se estiver no mesmo projeto EasyPanel/rede interna) |
| `DOCLING_API_URL` | opcional | URL interna do serviço `docling` |
| `BOOTSTRAP_SUPER_ADMIN_EMAIL` | recomendada num ambiente novo | ver §7 — não é lida pelo Next; é o valor que você usa nas Formas A/B do bootstrap |
| `CRON_SECRET` | recomendada | segredo dos jobs de nudge/notificações |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | **obrigatórias em produção** (D16) | Upstash — sem elas o rate limit cai para memória local, que não sobrevive a restart nem é compartilhada entre réplicas |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_*`, `NEXT_PUBLIC_POSTHOG_*` | opcionais | observabilidade |
| `ISBNDB_API_KEY`, `RESEND_API_KEY`, `TAVILY_API_KEY`, `ELEVENLABS_*`, `INTEGRATION_ENCRYPT_SECRET` | opcionais | integrações pontuais, ver `.env.example` na raiz do repo para a lista completa e o que cada uma faz |
| `PLATFORM_SLUG`, `PLATFORM_BRAND_*`, `PLATFORM_FOOTER_TEXT`, `PLATFORM_SUPPORT_EMAIL`, `PLATFORM_MODULES` | opcionais (sem elas a instância é a eximIA Academy) | marca **neutra da instância** (D21) — ver §0.1 acima para a lista completa e a ordem de mescla. Só faz sentido preencher num serviço de instância diferente da eximIA, ex. Argos |

Lista completa e comentada: `.env.example` na raiz do repositório — é a fonte única, não
duplicada aqui.

---

## 4. Domínio wildcard e certificado

> **Realidade do DNS em 2026-09-08**: o domínio `eximiaacademy.com.br` está hospedado na
> Hostinger (`dns-parking.com`). A Hostinger **não tem suporte garantido** para registro
> wildcard associado a credencial de API para DNS-01 (o que o passo 3 abaixo exige). Até
> migrar o DNS para um provedor que suporte isso de forma confiável (Cloudflare é a
> sugestão — API de DNS estável e amplamente documentada para integração com Traefik/
> EasyPanel), **não crie um registro wildcard**: crie **um registro `A` por host** que
> precisar responder (ex. `app`, `teste-faxina`, cada empresa nova cadastrada), todos
> apontando para `76.13.82.199` (a VPS do EasyPanel). Isso funciona — cada host individual
> emite certificado por HTTP-01 normal, sem precisar de DNS-01 — só não é "cadastro sem
> nenhum passo de infra" (D1) até o wildcard existir; é registro manual por host
> enquanto o DNS estiver na Hostinger. A raiz (`eximiaacademy.com.br`) e `argos` já
> apontam para esse IP; `academy.eximiaacademy.com.br` está em uso pela landing page —
> **não mexer nele**.

1. **DNS**: crie um registro `A` (ou `CNAME`, dependendo do seu provedor) para
   `*.{NEXT_PUBLIC_APP_BASE_DOMAIN}` apontando para o IP da VPS do EasyPanel. **Um
   registro só** cobre toda empresa nova — cadastrar um tenant não exige tocar DNS.
2. **No EasyPanel**, aba **Domains** do serviço: adicione
   `*.{NEXT_PUBLIC_APP_BASE_DOMAIN}` como domínio.
3. **Certificado**: um wildcard **não pode** ser emitido por desafio HTTP-01 (o desafio
   padrão do Let's Encrypt/EasyPanel) — exige **DNS-01**, que precisa de credencial de API
   do seu provedor de DNS configurada no EasyPanel (Settings → Let's Encrypt / DNS
   Provider, o nome exato do menu depende da versão instalada — **verifique no seu
   painel**). Sem isso o EasyPanel tenta HTTP-01 e falha silenciosamente para o wildcard;
   sintoma: o serviço sobe, mas `https://qualquer-slug.{base}` dá erro de certificado.
4. **Confirme** acessando `https://algum-slug-qualquer.{base}` depois do certificado
   emitido — deve responder (o middleware resolve para NEUTRO se o slug não existir em
   `tenants`, então a página carrega mesmo sem tenant cadastrado ainda).

### Domínio próprio de um cliente (ex. `argos.eximiaacademy.com.br`)

Domínio próprio é **adicional**, no **mesmo** serviço — nunca cria um serviço novo:

1. No EasyPanel, aba **Domains** do mesmo serviço `academy-web`: adicione o domínio
   próprio (`argos.eximiaacademy.com.br`).
2. Peça ao cliente (ou você mesmo, se o DNS for seu) para apontar um `CNAME` desse host
   para o domínio do EasyPanel, ou um `A` para o IP da VPS — o que o painel pedir na tela
   de confirmação do domínio.
3. Certificado deste host é **HTTP-01 normal** (não é wildcard, não precisa de DNS-01).
4. No banco, associe o host ao tenant: `tenant_domains` precisa de uma linha
   `{tenant_id, host: 'argos.eximiaacademy.com.br', is_primary: true}`. Isso é feito pela
   RPC `provisionar_tenant` (campo `p_custom_host`) no cadastro, ou por um UPDATE manual
   se o tenant já existir — nunca insira direto sem passar pelo `service_role`, a tabela
   tem RLS que bloqueia escrita de `admin` de cliente (`06-contrato-de-dados.md` §2.1).
5. **Redirect URL do Supabase** (próximo passo) precisa de uma linha a mais para este
   host — sem ela, o link de convite/reset de senha de usuários deste tenant sai
   apontando para o lugar errado, em silêncio.

---

## 5. Healthcheck

O serviço já expõe `GET /api/health`. No EasyPanel, aba **Health Check** (ou dentro da
config avançada do serviço, dependendo da versão):

- **Path**: `/api/health`
- **Porta**: `3000`
- **Intervalo/timeout/retries**: os mesmos do `docker-compose.yml` servem de referência —
  `interval: 30s`, `timeout: 10s`, `retries: 3`, `start_period: 40s`.

---

## 6. Microserviços opcionais: `blueprint` e `docling`

Só cadastre se for usar geração de blueprint de curso por IA (`blueprint`) e/ou extração
avançada de PDF/PPTX/DOCX com tabelas/OCR (`docling`). O app funciona sem os dois —
`BLUEPRINT_MICROSERVICE_URL`/`DOCLING_API_URL` ausentes só desativam essas features.

### `blueprint`

1. **App → Create → From Git Repository**, mesmo repositório, **Build path**:
   `microservice/` (tem `Dockerfile` próprio ali).
2. Environment do serviço `blueprint`:
   - `INTERNAL_AUTH_TOKEN`: **o mesmo valor** cadastrado no serviço `academy-web` (§3).
     O microserviço rejeita qualquer chamada sem o cabeçalho `X-Internal-Token`
     correspondente (D15) — os dois lados do par têm que bater.
   - `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY`: mesmos valores do Supabase
     usados em `academy-web` (nomes de env diferentes do lado do microserviço — sem
     `NEXT_PUBLIC_` porque não é Next).
   - `APP_BASE_DOMAIN`: mesmo valor de `NEXT_PUBLIC_APP_BASE_DOMAIN` — o microserviço usa
     isso para `allow_origin_regex` (aceitar CORS de qualquer `*.{base}`, não uma origem
     fixa).
3. **Não exponha publicamente.** Ele só precisa ser alcançável pelo serviço `academy-web`
   na rede interna do EasyPanel — não cadastre domínio/porta pública para ele.
4. Em `academy-web`, `BLUEPRINT_MICROSERVICE_URL` aponta para o hostname interno que o
   EasyPanel atribuiu ao serviço `blueprint` (geralmente o nome do serviço na rede
   interna, ex. `http://blueprint:8000` — confirme o hostname exato na aba **Networking**
   do EasyPanel).

### `docling`

Imagem pronta (`quay.io/docling-project/docling-serve-cpu:latest`), sem build — no
EasyPanel use **App → Create → From Docker Image**. Sem `INTERNAL_AUTH_TOKEN`: este
serviço não valida o cabeçalho (ver `docker-compose.yml` para a referência de
healthcheck/recursos: 4G de memória recomendado).

---

## 7. Migrations e bootstrap do super_admin

### 7.1 Migrations

```bash
supabase link --project-ref <ref-do-projeto>
supabase db push
```

**Antes disso**, revise `06-contrato-de-dados.md` §8 (item 2): os corpos das 3 funções do
M0 (`subtree_student_ids`, `auth_subtree_user_ids`, `auth_reachable_student_ids`) vieram
de uma branch nunca mergeada, não de produção — se você está migrando um ambiente que
**já tem produção rodando** (ex. a Cory), compare com `pg_get_functiondef` antes de
aplicar (`05-tarefas-para-o-hugo.md` tem o SQL de extração).

### 7.2 Redirect URLs no Supabase (D11)

**Authentication → URL Configuration → Redirect URLs**, adicione:

```
https://*.{NEXT_PUBLIC_APP_BASE_DOMAIN}/**
```

E **uma linha extra por domínio próprio** de cada cliente, ex.:

```
https://argos.eximiaacademy.com.br/**
```

Sem isso, o GoTrue reescreve silenciosamente o `redirectTo` de convite/reset de senha
para a `Site URL` default — o link do e-mail sai errado sem nenhum erro visível em lugar
nenhum.

### 7.3 Bootstrap do super_admin (D13)

Você precisa de **um** super_admin para começar a cadastrar empresas pela UI. Duas formas
(`06-contrato-de-dados.md` §5) — no Supabase hospedado, use a **Forma B**:

1. **Antes de qualquer signup**, insira o seu e-mail na tabela via SQL Editor do Supabase
   Dashboard:
   ```sql
   insert into public.bootstrap_super_admins (email, motivo)
   values ('seu-email@dominio.com', 'bootstrap do ambiente novo');
   ```
2. **Crie a conta pelo Supabase Dashboard**: **Authentication → Users → "Add user"**,
   com o mesmo e-mail e uma senha. Marque "Auto Confirm User". Esse INSERT em
   `auth.users` é o que dispara o gatilho `trg_bootstrap_super_admin`, que promove a
   conta a `super_admin` no mesmo instante.

   > **Não existe tela de cadastro neste app, e isso é de propósito.**
   > `grep -rn signUp apps/web/src` devolve zero; não há rota `signup`/`cadastro`/
   > `registrar`; `login-form.tsx` só oferece entrar por senha, por Google e por SSO.
   > Quem cria conta é o convite (`inviteUserByEmail`, disparado por um admin) ou o
   > Dashboard. Uma versão anterior deste guia mandava "fazer o cadastro normal" em
   > `/login` — não havia como, e o bootstrap travava no passo zero: sem `auth.users`
   > o gatilho nunca dispara, `promover_super_admin` devolve `false`, e sem super_admin
   > não há `/admin/tenants` nem primeira empresa.

   Alternativa, **só se** o provider Google já estiver configurado no projeto Supabase:
   faça o primeiro login por Google com esse e-mail — o efeito no `auth.users` é o mesmo.
3. **Rede, e é ela que você deve usar se a conta já existia** (o gatilho só pega INSERT
   novo). Depois do passo 1, no SQL Editor:
   ```sql
   select public.promover_super_admin('seu-email@dominio.com');
   ```
   Devolve `true` quando encontrou a conta e promoveu, `false` (com `WARNING`) quando não
   há `auth.users` com esse e-mail — nesse caso volte ao passo 2.
4. Confirme entrando em `/admin` — deve aparecer o painel de tenants, vazio.

**Forma C — automatizada, com `scripts/bootstrap-super-admin.mjs`** (usada para a
instância eximIA em 2026-09-08, recomendada quando você tem a `SUPABASE_SERVICE_ROLE_KEY`
à mão e prefere um comando a três cliques no Dashboard): o script faz os passos 1–3 acima
num só comando — insere em `bootstrap_super_admins`, cria a conta em `auth.users` via
Admin API (ou promove pela rede `promover_super_admin` se a conta já existir) e confere o
resultado em `public.users`:

```bash
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
node scripts/bootstrap-super-admin.mjs <email> [senha]
```

Sem senha, o script gera uma e imprime **uma única vez** (nunca grava em disco). Ao
final, confirma `role = super_admin` e `tenant_id IS NULL` em `public.users` — se isso
falhar, ele encerra com erro em vez de deixar um super_admin "quase" criado.

---

## 8. Cadastrar a primeira empresa pela UI

Com o super_admin logado: **Admin → Empresas → Nova empresa**. O wizard (3 passos:
identidade, marca, acesso) chama `POST /api/admin/tenants`, que por baixo executa a RPC
`provisionar_tenant` — tudo numa transação (tenant + domínio + seed de áreas e templates
de notificação + auditoria), e o convite do primeiro admin é disparado **depois** do
commit. Se o convite falhar, a empresa já existe e a tela oferece "reenviar convite" — não
recrie o tenant.

Depois de criada, ela já responde em `https://{slug}.{NEXT_PUBLIC_APP_BASE_DOMAIN}` sem
nenhum passo de infraestrutura adicional — é isso que "cadastro instantâneo" (D1) quer
dizer.

---

## 9. Migrar a Argos Academy (e a Cory dentro dela)

> Reescrito em 2026-09-08. A versão anterior desta seção tratava
> `argos.eximiaacademy.com.br` como "a Cory com domínio próprio, dentro do serviço único
> da eximIA" — isso estava errado (esclarecimento do Hugo, ver `10-parceiros-argos.md`).
> `argos.eximiaacademy.com.br` é a **instância Argos Academy**, um operador próprio que
> vai treinar várias empresas (a Cory é uma delas). Esta seção substitui a anterior por
> completo; leitura obrigatória antes de executar:
> [`10-parceiros-argos.md`](./10-parceiros-argos.md) (D21, tabela comparativa eximIA vs
> Argos, e a decisão pendente sobre os tenants eximIA hoje hospedados no banco de
> produção).

O serviço antigo (`deploy/cory`, branding via `NEXT_PUBLIC_TENANT_*` cravado em build) usa
hoje o projeto Supabase de produção `vaguswivhqnlbgqvnjch` e atende
`argos.eximiaacademy.com.br`. Esse banco é o **candidato natural** a virar o banco oficial
da instância Argos — já roda com a marca Argos e já tem a Cory. O problema: ele também tem
tenants da **eximIA** (eximIA Academy, Harven, Vértice), que precisam de uma decisão antes
do passo 2 (mover para o banco da instância eximIA, ou manter e aceitar a mistura — ver
`10-parceiros-argos.md`).

Passo a passo para desligar `deploy/cory` e subir a instância Argos de verdade:

1. **Decida** o destino dos tenants eximIA em `vaguswivhqnlbgqvnjch` (mover ou manter —
   `10-parceiros-argos.md`) antes de aplicar migrations nesse banco: é produção real, com
   dado real de mais de um tenant.
2. **Aplique as migrations** (`supabase db push`) em `vaguswivhqnlbgqvnjch`, com a mesma
   ressalva do §7.1 — confira `pg_get_functiondef` das 3 funções do M0 contra o que já
   existe nesse banco antes de aplicar, é produção com dado real.
3. **Suba um serviço novo, `argos-academy-web`**: mesma imagem (`main`, mesmo
   `Dockerfile`), apontando para `vaguswivhqnlbgqvnjch`
   (`NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` desse projeto), com as
   `PLATFORM_*` da Argos (§0.1): `PLATFORM_SLUG=argos`, `PLATFORM_BRAND_NAME`,
   `PLATFORM_BRAND_LOGO`/`_LOGO_LIGHT`/`_FAVICON` apontando para os arquivos que já
   existem em `apps/web/public/logos/argos-*.png`, e as cores da Argos.
4. **Bootstrap do super_admin da Argos** nesse Supabase (Forma C, §7.3, com o e-mail que a
   Argos indicar) — é o super_admin **dela**, que vai cadastrar as empresas dela (Cory
   inclusa, que já existe como tenant nesse banco).
5. **Confirme visualmente** pelo domínio temporário do EasyPanel, antes de tocar DNS, que
   `argos-academy-web` responde com a marca Argos e que a Cory aparece no painel de
   tenants.
6. **Vire o DNS**: aponte `argos.eximiaacademy.com.br` (hoje na Hostinger, apontando para
   `76.13.82.199`) para o serviço novo — registro por host, sem wildcard disponível ainda
   (§4). Certificado HTTP-01 normal.
7. **Desligue o serviço antigo** (`deploy/cory`) só depois do passo 6 confirmado — não
   antes. Mantenha-o parado, não apagado, por alguns dias como rollback rápido.

---

## 10. Rollback

- **Domínio próprio migrado (Cory) com problema**: reverta o DNS de
  `argos.eximiaacademy.com.br` para apontar de volta ao serviço antigo (ainda parado, não
  apagado — §9 passo 7). Efeito em minutos, dependendo do TTL do registro DNS.
- **Serviço novo com problema geral, sem cliente ainda migrado**: nenhum rollback
  necessário além de corrigir e re-buildar — nenhum cliente real depende dele até o passo
  9 rodar.
- **Migration aplicada com problema**: as migrations deste pacote são aditivas (colunas
  novas com default, tabelas novas, funções novas) — nenhuma delas dropa ou altera dado
  existente de forma destrutiva. Reverter é dropar o que foi adicionado
  (`DROP FUNCTION`/`DROP TABLE`/`ALTER TABLE ... DROP COLUMN`), na ordem inversa da lista
  em `06-contrato-de-dados.md` §1.
- **Bootstrap do super_admin errado**: `bootstrap_super_admins` é só uma tabela — delete a
  linha errada; isso não desfaz uma promoção já aplicada (use
  `update public.users set role = 'student' where email = '...'` se precisar reverter uma
  promoção, com cautela).

---

## 11. Passo a passo executado em 2026-09-08 (instância eximIA)

Registro do que já foi feito para a instância eximIA, para não repetir nem confundir com
o que ainda falta (ver `05-tarefas-para-o-hugo.md` para o que resta):

1. Projeto Supabase novo criado pela CLI: `eximia-academy-multi` (ref
   `hrnpjsimcjobilbjteno`).
2. `supabase db push` aplicou as 120 migrations do zero nesse projeto, com duas
   correções no caminho: `20260703003112` (`semantic_analyses`) e `20260703003113`
   (`has_role`).
3. Super_admin `hugo.capitelli@eximiaventures.com.br` criado com
   `scripts/bootstrap-super-admin.mjs` (Forma C, §7.3).
4. Empresa `teste-faxina` cadastrada pela API (`POST /api/admin/tenants`, 201).
5. Confirmado no DNS da Hostinger: raiz (`eximiaacademy.com.br`) e `argos` já apontam
   para `76.13.82.199` (a VPS do EasyPanel). `academy.eximiaacademy.com.br` está em uso
   pela landing page e não deve ser tocado. A porta neutra do super_admin da instância
   eximIA será `app.eximiaacademy.com.br` — registro DNS desse host ainda **não** foi
   criado (ver `05-tarefas-para-o-hugo.md`).

Ainda não feito para a instância eximIA (ver `05-tarefas-para-o-hugo.md` para o
checklist completo): registro DNS de `app.` e `teste-faxina.`, Redirect URLs e Site URL
no projeto Supabase novo, deploy do serviço `academy-web` no EasyPanel apontando para
`eximia-academy-multi`.
