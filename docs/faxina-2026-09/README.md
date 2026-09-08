# Faxina 2026-09 — índice

Síntese de 10 leituras independentes do repositório, cruzadas e verificadas no código em `integra/main-cory` (2026-09-05).
**Objetivo:** chegar a um app funcional pela `main`, um único serviço no EasyPanel, com empresas novas cadastradas pela própria plataforma.

| Documento | O que responde |
|---|---|
| [`01-diagnostico.md`](./01-diagnostico.md) | Como o sistema funciona hoje de verdade; a causa-raiz de "um deploy por empresa" com `caminho:linha`; inventário fica/refatora/sai; o que está quebrado, por severidade; o que existe e o que falta no cadastro de empresa |
| [`02-plano-app-novo.md`](./02-plano-app-novo.md) | Estratégia de resolução de tenant (recomendação e justificativa); migrações; RPC e tela de cadastro; branding/módulos vindos do banco; remoção dos gates do Dockerfile; EasyPanel + Traefik + env vars finais; 14 PRs em ordem de risco; destino de `main`/`deploy/cory`/`deploy/vertice`; riscos e como validar; decisões que só o Hugo pode tomar |
| [`03-inventario-sujeira.md`](./03-inventario-sujeira.md) | Cada arquivo sujo, branch (48) e stash (5) com ação recomendada, e a ordem da faxina |
| [`04-critica.md`](./04-critica.md) | Revisão independente cruzada com o código: o que nos três documentos acima foi refutado (e por quê) e as lacunas que ficaram abertas, por severidade |
| [`05-tarefas-para-o-hugo.md`](./05-tarefas-para-o-hugo.md) | Checklist do que só o Hugo pode fazer: painéis externos, DNS, SQL de produção, decisões de negócio |
| [`08-revisao-onda-c.md`](./08-revisao-onda-c.md) | Revisão adversarial do código por 3 lentes: o que foi corrigido, refutado e adiado (itens H1–H19 para o Hugo) |
| [`09-encerramento.md`](./09-encerramento.md) | Estado final da branch, commits, gate medido, o que não está provado e a ordem sugerida |
| [`10-parceiros-argos.md`](./10-parceiros-argos.md) | Argos é parceiro com várias empresas dentro: o terceiro nível que o modelo ainda não tem, e o que precisa ser desenhado |

---

## As 4 coisas que importam, se você só ler isto

1. **O banco já é multi-tenant. A interface não.** RLS por `users.tenant_id` já serve N empresas num deploy só. O que trava é `apps/web/src/lib/tenant.ts:1` — um `import` estático que resolve a marca em **build time**.
2. **Três bloqueadores, não um.** (i) marca em build; (ii) `supabase db reset` do zero **não roda** (`20260702222743_auth_direct_student_ids.sql:96-98` revoga funções que nenhuma migration cria) — sem ambiente reprodutível não há self-service; (iii) o bucket `tenant-assets` **não existe**, então todo upload de logo falha hoje.
3. **Não há falha de segurança viva.** As 9 rotas `/gauntlet-preview/*` estão de fato fora de `protectedPaths` (`middleware.ts:336-345`), mas todas fazem `notFound()` quando `NODE_ENV === "production"` (ex.: `visao-geral/page.tsx:93`), e o Dockerfile/compose fixam `NODE_ENV=production` — em produção elas devolvem 404 antes de tocar `service_role`. Refutado em `04-critica.md`; vira defesa em profundidade sem prioridade (`00-decisoes.md` D8).
4. **A `main` está a um fast-forward de distância.** `HEAD` é idêntico a `origin/deploy/cory`, e `origin/main` é ancestral estrito (52 atrás, 0 à frente). `git push origin integra/main-cory:main` resolve, sem merge e sem conflito. Fica para o Hugo executar (`05-tarefas-para-o-hugo.md` item (f)).

Recomendação de estratégia: **subdomínio wildcard** (`{slug}.<base>`) como canônico, tabela `tenant_domains` aceitando também domínio próprio, path só em dev, host desconhecido → marca NEUTRA. Justificativa em `02-plano-app-novo.md` §1.

Itens marcados **[VERIFICAR]** são os que não deu para confirmar só lendo o repo (labels reais do Traefik no EasyPanel, se o Auth Hook de JWT ainda está ativo no Dashboard, e se o bucket `tenant-assets` foi criado à mão em produção) — checklist em `05-tarefas-para-o-hugo.md` item (i).

Uma revisão independente (`04-critica.md`) conferiu cada `caminho:linha` destes documentos contra o código: refutou 7 afirmações (a mais importante: não há falha de segurança viva no item 3 acima) e abriu 14 lacunas, 2 delas bloqueantes. As decisões que resultaram dessa revisão estão em `00-decisoes.md` (D1–D20); as que ainda dependem do Hugo estão em `05-tarefas-para-o-hugo.md`.
