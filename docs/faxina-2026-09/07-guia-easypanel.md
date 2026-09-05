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

Lista completa e comentada: `.env.example` na raiz do repositório — é a fonte única, não
duplicada aqui.

---

## 4. Domínio wildcard e certificado

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

## 9. Migrar a Cory para o serviço novo

A Cory hoje roda num serviço antigo (`deploy/cory` / branding via `NEXT_PUBLIC_TENANT_*`),
com o host próprio `argos.eximiaacademy.com.br`. Passo a passo para trazê-la ao serviço
único sem downtime:

1. **Confirme** que o serviço novo (`academy-web`, `main`) está no ar e saudável
   (`/api/health`) apontando para o **mesmo projeto Supabase** que a Cory já usa — não
   crie um projeto novo, a Cory já tem dados lá.
2. **Confirme** que a linha `tenant_domains` da Cory existe — a migration
   `20260906000000_tenant_domains.sql` já faz esse backfill (`argos.eximiaacademy.com.br`
   → tenant `cory-alimentos`, `is_primary=true`), condicionado a esse tenant existir no
   banco. Se não existir, insira manualmente via `service_role` antes de prosseguir.
3. **Traga a marca do ambiente antigo** (D20). A rota
   `POST /api/admin/tenants/{id}/importar-marca-do-ambiente` lê
   `process.env.NEXT_PUBLIC_TENANT_*` **do próprio processo que a atende** e recusa com
   400 quando `NEXT_PUBLIC_TENANT_SLUG` não está definido ali
   (`importar-marca-do-ambiente/route.ts`). Ou seja: **chamá-la no serviço novo devolve
   erro sempre**, porque o §2 deste guia manda apagar exatamente essas 16 variáveis de
   lá. Ela só funciona rodando DENTRO do serviço do cliente. Dois caminhos, escolha um:

   **3a — pela rota, no serviço ANTIGO** (automático, mas exige um deploy a mais):
   1. no serviço **antigo** da Cory, troque a branch de `deploy/cory` para `main` e
      rebuilde — **mantendo** as `NEXT_PUBLIC_TENANT_*` e o `SUPABASE_SERVICE_ROLE_KEY`
      que já estão lá. A branch `deploy/cory` não tem essa rota; sem o deploy da imagem
      nova, não há o que chamar;
   2. logue como super_admin **naquele** serviço e chame
      `POST /api/admin/tenants/{id-do-tenant-cory}/importar-marca-do-ambiente`. A rota
      recusa se o `NEXT_PUBLIC_TENANT_SLUG` do processo não for exatamente o slug do
      tenant do path — é a trava que impede gravar a marca de uma empresa em outra;
   3. confira o resultado no serviço **novo** (passo 4) e só então siga.

   **3b — à mão, pela tela de marca** (sem deploy, mais passos manuais): copie os valores
   das `NEXT_PUBLIC_TENANT_*` do painel do serviço antigo (logo, cores, favicon, nome,
   módulos) e grave-os no serviço **novo** em **Admin → Empresas → Cory → Marca**, ou em
   **Configurações → Organização**. É o mesmo destino (`tenants.brand`/`tenants.modules`),
   digitado em vez de copiado.

   Nos dois caminhos: faça isso **antes** de desligar o serviço antigo, não depois — os
   valores só existem no painel do EasyPanel.
4. **Confirme visualmente**: acesse `https://argos.eximiaacademy.com.br` — como o
   `tenant_domains` já resolve esse host, e o serviço novo está com o DNS ainda no
   serviço antigo, isso só é testável de fato depois do passo 5. Para conferir antes,
   acesse pelo host derivado por slug: `https://cory-alimentos.{NEXT_PUBLIC_APP_BASE_DOMAIN}`
   e confira que a marca (logo, cores) bate com a da Cory.
5. **Vire o DNS**: aponte `argos.eximiaacademy.com.br` (CNAME ou A, o que já estiver
   configurado) para o serviço **novo**, e adicione esse domínio próprio na aba
   **Domains** do serviço `academy-web` (§4, "Domínio próprio de um cliente").
   Certificado HTTP-01 normal.
6. **Aguarde a propagação de DNS/certificado** e confirme `https://argos.eximiaacademy.com.br`
   servindo pelo serviço novo (logs do EasyPanel do serviço novo devem mostrar as
   requisições chegando).
7. **Desligue o serviço antigo** só depois do passo 6 confirmado — não antes. Mantenha-o
   parado (não apagado) por alguns dias como rollback rápido caso algo apareça.

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
