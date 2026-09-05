# Blueprint Microservice

Microserviço Python/FastAPI responsável por gerar o "blueprint" (estrutura pedagógica)
de um curso a partir dos parâmetros enviados pelo app Next.js (`apps/web`).

Este serviço **não é exposto diretamente à internet**. Ele roda em uma rede interna
do Docker Compose e só deve ser chamado pelo proxy Next.js
(`apps/web/src/app/api/blueprint/**`).

## Rodando localmente

```bash
cd microservice
python3 -m pip install -e ".[dev]"
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

## Autenticação interna (D15)

Toda rota deste serviço, **exceto `GET /health`**, exige um token compartilhado
enviado pelo chamador (o proxy Next.js). O token pode ser enviado de duas formas:

- Header `X-Internal-Token: <token>`
- Header `Authorization: Bearer <token>`

O valor esperado é `settings.internal_auth_token` (env `INTERNAL_AUTH_TOKEN`).
Requisições sem o header, ou com o header errado, recebem `401 Unauthorized`.

**Fail closed em produção**: se `ENVIRONMENT=production` e `INTERNAL_AUTH_TOKEN`
continuar com o valor padrão de desenvolvimento (`dev-token-change-in-prod`), o
processo **recusa subir** (`RuntimeError` no startup/lifespan da aplicação). Isso é
verificado em `app/auth.py::validate_startup_auth_config`, chamado no `lifespan` do
FastAPI em `app/main.py`.

Implementação: `app/auth.py` (dependency `require_internal_token`), aplicada em
`app/main.py` via `Depends` no `include_router(...)` do router de blueprint e na
rota raiz `/`. O router de `health` fica de fora dessa dependency de propósito
(é usado pelo healthcheck do orquestrador/Docker, que não tem o token).

> Nota para quem for atualizar o proxy Next (`apps/web`, fora do escopo deste
> microserviço): o proxy precisa passar a enviar o header `X-Internal-Token`
> (ou `Authorization: Bearer`) com o valor de `INTERNAL_AUTH_TOKEN` em toda chamada
> a este serviço, senão as requisições passam a receber 401 depois desta mudança.

## CORS

O CORS não usa mais uma lista fixa de `allow_origins`. Em vez disso, usa
`allow_origin_regex`, construído em `app/main.py::build_cors_origin_regex()` a
partir de:

- `APP_BASE_DOMAIN` (ex.: `academy.eximiaventures.com.br`): aceita a origem exata
  `https://academy.eximiaventures.com.br` e qualquer subdomínio de tenant, ex.:
  `https://cliente.academy.eximiaventures.com.br` (regex:
  `^https://([a-z0-9-]+\.)?academy\.eximiaventures\.com\.br$`, combinado com as
  demais origens abaixo).
- `NEXT_APP_URL`: mantido como origem adicional (fallback / ambientes onde o app
  Next não está sob o domínio base, ex.: preview/staging).
- Em qualquer ambiente que não seja `production`, `http://localhost:<porta>` e
  `http://127.0.0.1:<porta>` também são aceitos, para facilitar o desenvolvimento.

Se nenhuma origem estiver configurada (nem `APP_BASE_DOMAIN` nem `NEXT_APP_URL`),
o regex resultante não casa com nada — falha fechado em vez de aceitar `*`.

## `tenant_id` do corpo da requisição

O schema de `POST /blueprint/generate` (`app/models/schemas.py`) continua aceitando
`tenant_id` no corpo da requisição, sem validação adicional aqui. Isso só é seguro
porque o proxy Next.js (`apps/web/src/app/api/blueprint/generate/route.ts`) **já
valida, antes de repassar a chamada**, que o `tenant_id` do corpo bate com o
`tenant_id` do perfil do usuário autenticado (`profile.tenant_id`), retornando
`403 Forbidden` caso contrário. Este microserviço confia nessa validação feita
a montante e não deve ser usado diretamente por nenhum outro chamador sem repetir
essa checagem — daí a autenticação interna acima existir como segunda barreira
(qualquer chamador direto ainda precisa do token, mas o token sozinho **não**
substitui a validação de tenant, que continua sendo responsabilidade do proxy).

## Variáveis de ambiente relevantes

| Variável | Descrição | Default |
|---|---|---|
| `ENVIRONMENT` | `development` / `production` | `development` |
| `INTERNAL_AUTH_TOKEN` | Token exigido em todas as rotas exceto `/health` | `dev-token-change-in-prod` (recusado em produção) |
| `APP_BASE_DOMAIN` | Domínio base para `allow_origin_regex` do CORS | `""` (vazio) |
| `NEXT_APP_URL` | Origem adicional aceita pelo CORS | `http://localhost:3000` |

Ver `.env.example` para a lista completa.

## Testes

```bash
cd microservice
python3 -m pip install -e ".[dev]"
python3 -m pytest -q
```

Testes relevantes para D15:

- `tests/test_auth.py`: sem token → 401; token errado (header ou Bearer) → 401;
  token certo (header ou Bearer) → passa; `/health` sem token → 200; `/` exige
  token; startup falha em produção com o token padrão e passa com token customizado.
- `tests/test_cors.py`: preflight aceita subdomínio do `APP_BASE_DOMAIN` configurado
  e recusa uma origem fora dele.
