# eximIA Academy v2 — Deploy Guide

> Guia completo, passo a passo, para configurar o serviço no EasyPanel:
> [`docs/faxina-2026-09/07-guia-easypanel.md`](./faxina-2026-09/07-guia-easypanel.md).
> Este arquivo é só o resumo executivo.

## Arquitetura

**Um serviço único** (`apps/web`, buildado a partir de `main`) atende **todas as
empresas clientes**, cada uma resolvida pelo host da requisição:

- `{slug}.{NEXT_PUBLIC_APP_BASE_DOMAIN}` — cadastro instantâneo, derivado por string,
  sem tocar o banco.
- Domínio próprio (ex. `argos.eximiaacademy.com.br`) — para o tenant que contratou,
  guardado em `tenant_domains`.

Não existe mais branch `deploy/{client}` nem serviço por cliente. Cliente novo é uma
linha na tabela `tenants`, cadastrada pela UI do super_admin (`/admin`), não um deploy.

Dois microserviços opcionais, internos (nunca expostos publicamente), atrás de
`INTERNAL_AUTH_TOKEN`:

- `blueprint` — geração de blueprint de curso por IA.
- `docling` — extração avançada de PDF/PPTX/DOCX (tabelas, OCR).

## Cadastrar uma empresa nova

Não é mais um passo de infraestrutura. Com um super_admin logado: **Admin → Empresas →
Nova empresa** (wizard de 3 passos: identidade, marca, acesso). O tenant nasce ativo,
com área padrão, templates de notificação semeados e convite do primeiro admin
disparado — tudo isso é a RPC `provisionar_tenant`
(`06-contrato-de-dados.md` §4.2), não um script manual.

## Variáveis de ambiente

Lista completa e comentada: [`.env.example`](../.env.example) na raiz do repositório —
é a fonte única, não duplicada aqui. As obrigatórias em produção são
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_BASE_DOMAIN` e ao
menos um provedor de LLM (`OPENAI_API_KEY`).

## Deploy do serviço no EasyPanel

Build args, env vars, domínio wildcard + certificado DNS-01, healthcheck, migrations,
Redirect URLs do Supabase, bootstrap do super_admin, cadastro da primeira empresa,
migração de um tenant já em produção (a Cory) e rollback — tudo isso está em
[`docs/faxina-2026-09/07-guia-easypanel.md`](./faxina-2026-09/07-guia-easypanel.md),
escrito para ser seguido sem contexto adicional.

## Build local (sanity check antes de configurar o EasyPanel)

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx \
  --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  --build-arg NEXT_PUBLIC_APP_BASE_DOMAIN=academy.exemplo.com.br \
  -t eximia-academy-v2 .
```

O build roda o gate de rotas de marca (`apps/web/scripts/verificar-rotas-de-marca-dinamicas.mjs`,
D17) depois do `next build`: ele reprova se alguma rota que consome marca de tenant
(`/`, `/login`, `/entrar`, `/workspace`, `/onboarding`, `/dashboard`, `/_not-found`) saiu
pré-renderizada como HTML estático — nesse modelo de serviço único, uma rota estática
serviria a marca de UM tenant para TODOS os hosts.
