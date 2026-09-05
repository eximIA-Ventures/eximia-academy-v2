# 03 — Inventário de sujeira: arquivos, branches e stashes

> Medido em `integra/main-cory`, 2026-09-05. Ações são recomendações; nada foi executado.

---

## 1. Arquivos em `git status`

### 1.1 Lixo real — apagar

| Arquivo | O que é | Ação |
|---|---|---|
| `apps/web/src/lib/analytics/aprendizagem-time/fonte-supabase.ts.mutacao-backup` | backup automático de `scripts/mutacao.mjs:731`; **`diff` contra o original é vazio** (conferido) | **APAGAR** + `*.mutacao-backup` no `.gitignore` |
| `apps/web/src/lib/analytics/autogestao/fonte-supabase.ts.mutacao-backup` | idem | **APAGAR** + mesmo ignore |
| `.demo-tenant-vertice-inventory.json` | dump de saída de `scripts/demo-tenant-vertice-seed.mjs:766` e `phase5.mjs:285`; conteúdo já está em prosa em `docs/qa/demo-tenant-vertice-2026-07-29.md:77-111`; contém `tenantId ec814e94-…` | **APAGAR** + `.demo-tenant-*.json` no `.gitignore` |
| `.claude/settings.local.json` | allowlist de sessão apontando para `/Users/hugocapitelli/Dev/eximia/JARVIS/business/Harven/…` — **outro projeto**. Já coberto por `.gitignore:39`, então nunca seria commitado | **APAGAR local** (contaminação de sessão) |
| `apps/central/.DS_Store`, `apps/central/src/.DS_Store` | lixo do macOS | **APAGAR** + garantir `.DS_Store` no ignore |
| `apps/central/tsconfig.tsbuildinfo`, `apps/central/.turbo/*` | artefatos de build | **APAGAR** / ignorar |

### 1.2 Lacuna de `.gitignore` — fechar

| Caminho | Situação | Ação |
|---|---|---|
| `.claude/agent-memory/aiox-analyst/…`, `.claude/agent-memory/aiox-dev/…` | **não batem em nenhuma regra**; `.gitignore` só cobre `.claude/settings.local.json:39` e `.claude/handoffs/:46`. Um `git add -A` distraído commita memória de agente no repo | **decidir**: ignorar `.claude/` inteiro (com exceção de `.claude/skills/`), ou versionar de propósito. A lacuna atual é acidental |
| `*.mutacao-backup` | sem regra | adicionar |
| `.demo-tenant-*.json` | sem regra | adicionar |

### 1.3 Arquivo rastreado com mudança — precisa decisão humana

| Arquivo | O que mudou | Ação |
|---|---|---|
| `docs/gauntlet/autogestao-jornada/GABARITO.json` | `courseId`, 8 `capituloIds`, `studentId` e `enrollmentId` trocados por UUIDs novos — é um **reseed do tenant/curso de fixture** não consolidado. Se ficar assim, o teste de paridade bate contra IDs que o HEAD não conhece | **HUGO DECIDE**: commitar como reseed intencional (com mensagem explicando o novo tenant de referência) **ou** `git checkout --` para voltar ao HEAD. Não deixar pendurado |

### 1.4 Documentação e scripts legítimos — commitar

Seguem convenções já estabelecidas no repo. Recomendo **um commit de docs** com todos.

| Grupo | Arquivos | Ação |
|---|---|---|
| Diagramas archify | `docs/architecture/eximia-academy-archify.{html,json}`, `-jovial.html`, `-speaker-notes.md`, `-tema-jovial.md`, `eximia-academy-conceitos.{html,json}`, `-academy.html`, `-jovial.html`, `eximia-academy-mastermind.html`, `meu-plano-defeitos-archify.{html,json}`, `eximia-academy-guia-de-fala.md`, `fontes/`, `tema-academy.mjs`, `tema-jovial.mjs` | **COMMITAR** — há precedente rastreado (`maestri-terminal-structure.html`, `percorrido-elaborado-archify.html`). Ver nota de peso abaixo |
| Docs de feature | `docs/features/` (`README.md`, `multi-tenant.md`, `course-designer.md`, `motor-socratico.md`) | **COMMITAR** — já referenciado por `packages/agents/README.md`. `multi-tenant.md` é bom e vira leitura obrigatória do plano |
| PRD / QA / story | `docs/prd/roadmap-em-andamento-2026-08.md`, `docs/qa/demo-course-jornada-2026-07-28.md`, `docs/qa/demo-tenant-vertice-2026-07-29.md`, `docs/qa/paridade-visual-2026-07-30/`, `docs/stories/chore-reconcile-main-com-deploy-vertice.md` | **COMMITAR** |
| READMEs novos | `apps/web/README.md`, `packages/agents/README.md`, `packages/shared/README.md` | **COMMITAR** — primeira documentação desses pacotes |
| Scripts | `scripts/auditoria-dobra-real.mjs`, `scripts/demo-tenant-vertice-seed.mjs`, `scripts/demo-tenant-vertice-phase5.mjs` | **COMMITAR com ressalva**: contêm `service_role` lida de `.env.local`, UUIDs de tenant e credenciais de demo hardcoded. Commitar como estão e abrir tarefa para portá-los à RPC `provisionar_tenant` (ver `02-plano-app-novo.md` §3) |
| Next | `apps/central/next-env.d.ts` | **COMMITAR** se `apps/central` sobreviver; se for apagado (recomendado no plano), sai junto |
| Migration | `supabase/migrations/20260905120000_equivalencia_git_producao_colunas_gatilhos_tabelas.sql` | **COMMITAR** — mas ler o cabeçalho antes: ele declara que o replay do zero continua quebrado por `20260702222743:96-98`. É o PR **P2** do plano |

**Nota de peso**: os HTMLs do archify são de 600-700 KB cada e há ~8 deles + fontes woff2. São ~5 MB entrando no histórico permanente do git. Existe precedente, então não é regressão — mas vale decidir de uma vez se diagramas gerados moram no repo ou fora dele.

### 1.5 Código morto encontrado pela crítica (`04-critica.md`) — decidir destino

| Caminho | O que é | Ação |
|---|---|---|
| `apps/web/src/lib/get-base-url.ts:8` | Deriva base URL de `x-forwarded-proto`/`x-forwarded-host`, fallback `NEXT_PUBLIC_APP_URL`. **Zero chamadores hoje** — mas é exatamente a função que resolve o link de convite/e-mail por host (`02-plano-app-novo.md` §4). **NÃO apagar**: passa a ser usada nos 3 call-sites de `NEXT_PUBLIC_APP_URL` (`invite-user.ts:52`, `resend-invite/route.ts:44`, `notifications/nudge/route.ts:95`), ver `00-decisoes.md` D11 |
| `apps/web/src/lib/blueprint-client.ts` | Cliente do microserviço `blueprint` a partir do browser | **APAGAR** junto com o PR do microserviço interno-only (`00-decisoes.md` D15) |
| `apps/web/src/components/blueprint/blueprint-generator.tsx` | Consumidor de `blueprint-client.ts`; **não é renderizado por nenhum arquivo** (verificado) | **APAGAR** — mesmo PR de D15 |

### 1.6 Falso positivo — não é sujeira

| Caminho | Por quê |
|---|---|
| `ANALYTICS-MELHORIAS-REPORT.md`, `BUG-SWEEP-REPORT.md`, `ENGAGEMENT-ENGINE-REPORT.md`, `FIXES-APPLIED.md` (raiz) | **já rastreados** desde `327963c`, sem diff pendente. Não aparecem em `git status`. Poluem a raiz, mas isso é uma decisão de organização (mover para `docs/`), não faxina de git |
| `design-systems/` | ignorado de propósito (`.gitignore:49`, "local only") |
| `.maestri/` | ignorado (`.gitignore:58`) |
| `apps/web/src/app/gauntlet-preview/**` | **rastreado** e referenciado por código real (`moldura.tsx`, `gaveta.tsx`, `nav-abas.tsx`). Não é preview morto — mas é **falha de segurança** (ver `01-diagnostico.md` (d) item 1) |
| `docs/gauntlet/` | pasta estabelecida e rastreada |

### 1.7 Marca de cliente versionada em código

| Caminho | Ação |
|---|---|
| `apps/web/public/logos/argos-{academy-color,academy-dark,academy-light,color,dark,light}.png` | **REMOVER** após P4/P10 — vai para `tenant-assets/{tenantId}/` |
| `apps/web/public/logos/harven-finance-{horizontal,horizontal-dark}.svg`, `harven-finance-white.png` | **REMOVER** idem |
| `apps/web/public/logos/eximia-*.{svg,png}` | **FICA** — é a marca da própria plataforma (partner logo) |
| `apps/web/public/brand/{logo.png,logo-color.png,logo.svg,favicon.ico}` | **FICA** — é o NEUTRO, fallback legítimo |

---

## 2. Branches

48 branches locais: **30 já mergeadas em HEAD**, 18 não.

### 2.1 Mergeadas — apagar sem cerimônia (30)

`git branch -d` funciona nelas por definição. Preservar só `main` e `integra/main-cory`.

```
chore/issue-template-agente        feat/analytics-melhorias           feat/t1
chore/reconcile-main-deploy-cory   feat/analytics-minha-aprendizagem  feat/t4
ci-fix-base                        feat/analytics-visao-geral         feat/workspace-separation
feat/SH-1.1-distinct-active-days   feat/engagement-center-v2          fix/71-course-designer-guardrails
feat/SH-1.2-indicator-comparison…  feat/engagement-panel              fix/ci-independent-steps
feat/SH-1.3-progress-headline      feat/engajamento-gestor-m1         fix/dup-archived-course-listing
feat/SH-1.4-student-home-card      feat/issue-73-72-feature-gate      fix/lint-packages
feat/manager-engagement-dashboard  feat/manager-ux-wave2              fix/unit-scope-analytics
integra/aprendizagem-time-cory     integration/minha-jornada-x-cory   work/pop-fix-analytics-20260812
deploy/cory (local)
```

`deploy/cory` local é **idêntica a HEAD** (0/0 contra `origin/deploy/cory`). Só apagar a local **depois** que o EasyPanel deixar de buildar a remota (PR P8).

### 2.2 Não mergeadas (18)

| Branch | Último commit | À frente | Ação |
|---|---|---|---|
| `deploy/vertice` | 2026-07-29 | 1 | **EXTRAIR ANTES DE APAGAR**: o `tenant.config.ts` dela tem a identidade Vértice (slug `vertice-industria`, `#1E3A5F`/`#C4A882`, partner exímIA, footer, `suporte@eximiaventures.com.br`, módulos `["biblioteca","units"]`). Vira linha de seed. Depois: apagar local e remota |
| `chore/reconcile-main-deploy-vertice` | 2026-08-11 | 3 | **REVISAR**: trabalho de reconciliação recente. Conferir se algo não chegou a HEAD; provavelmente apagar |
| `docs/reorganizacao-readmes` | 2026-08-11 | 1 | **REVISAR** — 1 commit de docs. Cherry-pick ou apagar |
| `feat/epic-30-multinivel` | 2026-06-22 | 18 | **HUGO DECIDE** — "multinível" pode ter trabalho relevante para hierarquia de empresa/área |
| `feat/epic-30-multinivel-pr` | 2026-06-21 | 20 | idem; provavelmente duplicata da anterior |
| `feat/gestor-escopado-por-time` | 2026-06-21 | 12 | **HUGO DECIDE** — escopo de gestor tem interseção com RLS de subárvore |
| `fix/audit-sprint-1-security` | 2026-05-24 | 15 | **REVISAR** — é "security"; conferir se as correções chegaram por outro caminho antes de descartar |
| `preview/quick-wins-f1-f2-f5` | 2026-05-24 | 10 | **APAGAR** — integração das três abaixo |
| `feat/f1-next-best-action` | 2026-05-24 | 3 | **APAGAR** — >3 meses parada |
| `feat/f2-gold-reflections` | 2026-05-24 | 2 | **APAGAR** |
| `feat/f5-conscious-completion` | 2026-05-24 | 3 | **APAGAR** |
| `integration/main-x-engagement` | 2026-07-16 | 8 | **APAGAR** — engagement já está em HEAD |
| `fix/wave1-observability-corrections` | 2026-05-17 | 4 | **APAGAR** |
| `integration/board-20260718` | 2026-07-18 | 3 | **APAGAR** |
| `feat/t8` | 2026-07-18 | 1 | **APAGAR** |
| `devops/workspace-landing-publish` | 2026-07-28 | 1 | **APAGAR** |
| `feat/lxp-ai-flip` | 2026-05-17 | 1 | **APAGAR** |
| `feat/semantic-analysis` | 2026-05-19 | 1 | **APAGAR** |

Antes de apagar qualquer uma com `ahead > 5`: `git format-patch HEAD..<branch> -o /tmp/arquivo-morto/<branch>` para ter o histórico fora do git sem custo.

### 2.3 Remotas

| Remota | Ação |
|---|---|
| `origin/main` | **FAST-FORWARD para HEAD** — é a primeira ação do plano. 52 commits atrás, 0 à frente, sem conflito |
| `origin/deploy/cory` | manter até P8; depois apagar |
| `origin/deploy/vertice` | manter até a identidade virar seed; depois apagar |
| `origin/docs/reorganizacao-readmes`, `origin/feat/analytics-visao-geral`, `origin/feat/aprendizagem-time-migrations`, `origin/feat/issue-73-72-feature-gate`, `origin/fix/71-course-designer-guardrails`, `origin/work/pop-fix-analytics-20260812` | **APAGAR** (as mergeadas) / revisar `feat/aprendizagem-time-migrations` — não existe local, conferir se o conteúdo está em HEAD |

---

## 3. Stashes (5)

Nenhum tem relação com tenant/marca. Todos são WIP de features analíticas de mai/2026.

| Stash | Base | Conteúdo | Ação |
|---|---|---|---|
| `stash@{0}` | `fix/audit-sprint-1-security` @ `e98c3b6` | exports novos de schema Drizzle (`unit-practices`, `competencies`, `reflection-feedback`, `challenges/feed`) | **REVISAR** — é o único que toca schema. Aplicar em worktree isolada, ver se algo já existe em HEAD |
| `stash@{1}` | `preview/quick-wins-f1-f2-f5` @ `4eedfe6` | campos SAR/`engagementRate` em tipos de analytics | **DESCARTAR** |
| `stash@{2}` | `preview/quick-wins-f1-f2-f5` @ `096e8c7` | idem | **DESCARTAR** |
| `stash@{3}` | `feat/f5-conscious-completion` @ `324385f` | idem | **DESCARTAR** |
| `stash@{4}` | `feat/f1-next-best-action` @ `6a18128` | enum de status de enrollment em `openapi/registry.ts` | **DESCARTAR** |

Antes de `git stash drop`: `git stash show -p stash@{N} > /tmp/arquivo-morto/stash-N.patch`. Custo zero, e stash apagado não volta.

---

## 4. Dívida documental

| Documento | Problema | Ação |
|---|---|---|
| `docs/DEPLOY-GUIDE.md:13-16` | manda "Criar Supabase project" por cliente — **factualmente errado**: produção tem 1 projeto com 4 tenants | **REESCREVER** no PR P12 |
| `docs/DEPLOY-GUIDE.md:11-70` | prescreve branch `deploy/{client}` + app novo no EasyPanel | idem |
| `apps/web/src/lib/tenant.ts:4-7` | comentário "Replaces the old dynamic tenant resolution from Supabase" é raso; a motivação real está em `tenant.config.ts` e no commit `13f090d` | reescrever junto com P7 |
| `supabase/migrations/20260421000000_jwt_tenant_claim_hook.sql:4-5` | afirma que `auth_tenant_id()` lê o JWT; a definição vigente (`20260518100000:12-19`) lê a **tabela** `users` | **[VERIFICAR]** se o hook ainda está ativo no Dashboard. Se não for mais necessário, documentar como vestigial |
| `supabase/migrations/20260311100000_user_tenant_memberships.sql:30-35` | DDL genérico misturado com `INSERT` de 2 e-mails reais da Cory e UUID literal | dívida histórica aplicada em produção — **não mexer**, só não repetir o padrão |

---

## 5. Ordem sugerida da faxina (uma sessão)

1. `git push origin integra/main-cory:main` (fast-forward, sem conflito).
2. Decidir `GABARITO.json`: commit ou revert.
3. Apagar os 2 `.mutacao-backup`, `.demo-tenant-vertice-inventory.json`, `.DS_Store`, `.claude/settings.local.json`.
4. Atualizar `.gitignore`: `*.mutacao-backup`, `.demo-tenant-*.json`, regra de `.claude/`.
5. Um commit de docs com tudo de 1.4.
6. `format-patch` das branches de 2.2 com `ahead > 5`; `stash show -p` dos 5 stashes → `/tmp/arquivo-morto/`.
7. Apagar as 30 mergeadas (menos `main`, `integra/main-cory`, `deploy/cory`).
8. Apagar as não mergeadas marcadas **APAGAR** (13).
9. Deixar pendentes só as 5 que exigem decisão do Hugo: `deploy/vertice`, `epic-30-multinivel`(×2), `gestor-escopado-por-time`, `audit-sprint-1-security`.
