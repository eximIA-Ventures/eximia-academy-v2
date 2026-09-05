# 09 — Encerramento da faxina (2026-09-05)

> Estado final da branch local `faxina/app-unico`. Nada foi enviado ao remoto; nenhuma branch remota foi apagada. Leia `05-tarefas-para-o-hugo.md` e a seção final de `08-revisao-onda-c.md` para o que só o Hugo faz.

## O que mudou, em uma frase

O banco já era multi-tenant; a interface era amarrada a um cliente por build. Agora a identidade da empresa (marca, módulos, domínio) é resolvida **por host em runtime**, lida do banco, e uma empresa nova é cadastrada **pela tela do super admin** — uma imagem Docker serve N empresas.

## Commits (base: `origin/deploy/cory`, que é o que roda em produção)

| Commit | O que entrega |
|---|---|
| `b939107` docs | 35 arquivos pendentes do working tree consolidados |
| `5d9c74b` chore(git) | `.gitignore` fechado; 38 branches locais apagadas (patches em `/tmp/arquivo-morto/`) |
| `927e76e` feat(db) | `tenant_domains`, `tenants.brand/modules`, bucket `tenant-assets`, RPC `provisionar_tenant`, `seed_tenant_defaults` + trigger, bootstrap do super_admin, 3 funções que o REVOKE de julho exigia |
| `ac335e8` feat(blueprint) | microserviço interno-only: token obrigatório, CORS por domínio base |
| `64f3eca` docs(faxina) | diagnóstico, plano, crítica, decisões, contrato de dados, tarefas |
| `7a5ea42` feat(tenant) | resolução por host (domínio próprio → subdomínio → env legado → neutro), marca do banco, `force-dynamic`, e-mails pelo host da empresa, rate limit por slug |
| `fe425d3` feat(admin) | wizard de cadastro em 3 passos, convite do primeiro admin, reenvio, importar marca do ambiente |
| `77e0dea` chore(infra) | Dockerfile sem gates de marca, gate de rotas dinâmicas, `apps/central` removido, guia EasyPanel |
| `7455fcf` test(ci) | suíte verde em todos os workspaces (CI estava vermelho desde agosto) |
| `ac92ecd` fix(revisao) | 8 achados graves da revisão adversarial corrigidos |
| `ff96b37` style(web) | formatação automática |
| (último) fix(lint) | 176 erros de lint reais zerados sem afrouxar regra |

## Gate final (medido nesta máquina)

| Passo | Resultado |
|---|---|
| `pnpm typecheck` | verde nos 6 workspaces |
| `pnpm lint` | verde (0 erros; warnings restantes são a11y/index-key não obrigatórios) |
| `pnpm test` | verde: 4335+ em `apps/web`, 630 nos pacotes |
| `pnpm build` | verde |
| gate de rotas de marca dinâmicas | as 7 rotas saem dinâmicas |
| `supabase db reset` | **não medido** — sem Docker/psql aqui (item (e) do 05) |
| `docker build` | **não medido** — sem Docker aqui |

## O que NÃO está provado e por quê

1. As migrations novas foram revisadas por leitura (três vezes), nunca executadas. O primeiro `supabase db push` num projeto de teste é o teste real.
2. O convite por e-mail depende da allowlist de Redirect URLs no Dashboard do Supabase (D11). Sem ela, o link sai errado em silêncio.
3. A marca da Cory só existe nas env vars do serviço atual do EasyPanel. O caminho de migração está no §9 do `07-guia-easypanel.md`.

## Ordem sugerida para o Hugo

1. Ler `05-tarefas-para-o-hugo.md` (a) a (i) e os itens H1–H19 de `08-revisao-onda-c.md`.
2. `git push origin faxina/app-unico`; abrir PR para `main` (ou fast-forward) e conferir o CI remoto verde.
3. Num projeto Supabase de teste: `supabase db push` e o bootstrap do super_admin; cadastrar uma empresa pela tela; conferir `{slug}.{base}`.
4. Só então: serviço único no EasyPanel seguindo o `07-guia-easypanel.md`, e migração da Cory.
