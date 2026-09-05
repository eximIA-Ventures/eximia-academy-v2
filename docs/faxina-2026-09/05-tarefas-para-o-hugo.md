# 05 — Tarefas que só o Hugo pode fazer

> Nada aqui é executável pelos agentes: exige acesso a um painel externo (Supabase Dashboard, EasyPanel, DNS), uma decisão de produto/negócio, ou uma máquina com Docker. `00-decisoes.md` referencia estes itens como **[HUGO]**; este documento é o checklist operacional com os comandos/SQL prontos.

---

## (a) Confirmar o domínio base — `NEXT_PUBLIC_APP_BASE_DOMAIN`

`00-decisoes.md` D1 assume `academy.eximiaventures.com.br`, mas o repo tem duas respostas: `docs/DEPLOY-GUIDE.md` usa `{slug}.academy.eximiaventures.com.br`; a produção da Cory hoje é `argos.eximiaacademy.com.br`.

- [ ] Decidir o valor definitivo de `NEXT_PUBLIC_APP_BASE_DOMAIN`.
- [ ] Configurar essa env no serviço único do EasyPanel.

Isso define o wildcard de DNS, o certificado e o backfill de `tenant_domains` (item (c) abaixo).

---

## (b) Supabase Dashboard → Redirect URLs com wildcard

Sem isso, todo convite de empresa nova volta para o host errado, em silêncio (lacuna bloqueante da crítica, fechada em D11).

- [ ] Authentication → URL Configuration → **Redirect URLs**, adicionar:
  ```
  https://*.<NEXT_PUBLIC_APP_BASE_DOMAIN>/**
  ```
- [ ] Para desenvolvimento local, editar `supabase/config.toml:156` (`additional_redirect_urls`) para incluir o mesmo padrão wildcard (ou os hosts de teste usados).
- [ ] Para cada domínio próprio de cliente (fora do wildcard), adicionar a URL exata quando o domínio for verificado — este é um passo manual por cliente até existir automação via Management API.
- [ ] Conferir se o mesmo Site URL/allowlist cobre `signInWithOAuth` (Google) e o fluxo de reset de senha, não só o convite.

---

## (c) DNS wildcard + certificado DNS-01 no EasyPanel

- [ ] Criar registro `*.{NEXT_PUBLIC_APP_BASE_DOMAIN} A → IP do EasyPanel`.
- [ ] Configurar credencial de API do provedor de DNS no Traefik do EasyPanel (obrigatório para emissão de certificado wildcard — HTTP-01 não emite wildcard, é preciso DNS-01).
- [ ] Confirmar/ajustar labels do Traefik no serviço (**[VERIFICAR]** — sintaxe exata depende da versão do EasyPanel, não deu para confirmar sem acesso ao painel):
  ```
  traefik.http.routers.academy.rule=HostRegexp(`{sub:[a-z0-9-]+}.<base>`) || Host(`<dominio-proprio-do-cliente>`)
  traefik.http.routers.academy.tls.certresolver=letsencrypt
  traefik.http.routers.academy.tls.domains[0].main=<base>
  traefik.http.routers.academy.tls.domains[0].sans=*.<base>
  ```
- [ ] Emitir e testar o certificado **antes** da virada (P8 no plano), num subdomínio de teste — é o risco R7 do plano.

---

## (d) SQL de `pg_get_functiondef` para as 3 funções que faltam (M0 / P2)

`20260702222743_auth_direct_student_ids.sql:96-98` revoga `EXECUTE` em 3 funções que nenhuma das 111 migrations cria: `subtree_student_ids(uuid)`, `auth_subtree_user_ids()`, `auth_reachable_student_ids()`. Sem elas, `supabase db reset` não roda do zero.

- [ ] Rodar em produção (via SQL Editor do Dashboard, ou `psql`) e colar o resultado num arquivo/migration:
  ```sql
  SELECT pg_get_functiondef(oid)
  FROM pg_proc
  WHERE proname IN ('subtree_student_ids', 'auth_subtree_user_ids', 'auth_reachable_student_ids');
  ```
- [ ] Conferir também gatilhos e colunas dependentes citados no cabeçalho de `supabase/migrations/20260905120000_equivalencia_git_producao_colunas_gatilhos_tabelas.sql:1-6` (o levantamento já existe; falta aplicar):
  ```sql
  SELECT tgname, tgrelid::regclass, pg_get_triggerdef(oid)
  FROM pg_trigger
  WHERE NOT tgisinternal;
  ```
- [ ] Entregar o resultado para uma migration com timestamp **anterior** a `20260702222743` (mesmo padrão que `20260831125000` já usou).

---

## (e) Rodar `supabase db reset` num ambiente com Docker

Não foi possível validar nesta máquina (sem Docker, sem `psql`, sem `supabase db reset`) — ver `docs/faxina-2026-09/04-critica.md`, lacuna "M0 tratado como 3 funções faltando".

- [ ] Com as funções do item (d) aplicadas, rodar `supabase db reset` num ambiente com Docker.
- [ ] Se falhar, o erro aponta a próxima peça faltando (gatilho, coluna ou tabela) — iterar até passar limpo. Não é "uma migration", é um loop até o reset fechar (ver D14).
- [ ] Registrar o número de iterações e o que cada uma corrigiu, para o histórico do PR P2.

---

## (f) Git: push, PR/fast-forward para `main`, e apagar branches remotas

Nenhum agente enviou nada ao remoto nem apagou branch remota (D19). Isso é decisão e ação do Hugo.

- [ ] `git push origin faxina/app-unico` (branch local de trabalho desta faxina).
- [ ] Depois de revisar: `git push origin faxina/app-unico:main` é um fast-forward puro (`origin/main` está 52 commits atrás de `HEAD`, 0 à frente — sem merge, sem conflito) — ou abrir PR normal se preferir revisão via GitHub antes.
- [ ] Branches remotas a apagar (mergeadas em HEAD, listadas em `03-inventario-sujeira.md` §2.3): `origin/docs/reorganizacao-readmes`, `origin/feat/analytics-visao-geral`, `origin/feat/aprendizagem-time-migrations` (conferir antes se não existe local), `origin/feat/issue-73-72-feature-gate`, `origin/fix/71-course-designer-guardrails`, `origin/work/pop-fix-analytics-20260812`.
- [ ] `origin/deploy/cory`: manter até o PR P8 (virada do EasyPanel) apontar o serviço único; depois apagar.
- [ ] `origin/deploy/vertice`: manter até extrair a identidade Vértice para seed (D10/migration M4); depois apagar.

---

## (g) Decisões ainda abertas

Estas não foram fechadas em `00-decisoes.md` porque são de produto/negócio, não de arquitetura:

| # | Decisão | Opções | Onde impacta |
|---|---|---|---|
| 1 | **Login canônico** | `/entrar` (sem Google/SSO) ou `/login` (com Google/SSO/reset)? | Define se SSO por empresa entra no roadmap; `validate-tenant` (D9) já fica adaptado para o login legado, mas qual sobrevive é decisão de produto |
| 2 | **E-mail transacional** | Seguir no SMTP único do projeto Supabase (um remetente/template para todas as empresas) ou migrar para provedor com template por tenant? | Afeta D11 (redirectTo) e a experiência de marca no e-mail |
| 3 | **Branches `feat/epic-30-multinivel` (18 commits), `feat/epic-30-multinivel-pr` (20), `feat/gestor-escopado-por-time` (12)** | Paradas desde 21-22/jun/2026. Têm trabalho de multinível/hierarquia a resgatar antes de apagar, ou descartam? | Interseção com RLS de subárvore e possível hierarquia de empresa/área |
| 4 | **Domínio próprio de cliente entra na v1 ou fica para depois?** | Muda esforço de Traefik/ACME por cliente, não o modelo de dados (`tenant_domains` já suporta os dois) | Escopo do PR P8/EasyPanel |
| 5 | **Vértice continua demo ativa?** | Precisa do host funcionando no dia 1 da virada, ou pode ficar fora do ar durante a transição? | Ordem de execução do P8 |
| 6 | **`next/image` e logo em CDN externo** | Proibir logo de host externo no schema do cadastro, usar `<img>` puro para marca, ou `images.unoptimized`? (lacuna baixa da crítica, não fechada em D#) | `next.config.ts:9-21`, schema de cadastro (M2/P10) |
| 7 | **5 stashes** | Recuperar `stash@{0}` (único que toca schema Drizzle: `unit-practices`, `competencies`, `reflection-feedback`, `challenges/feed`) em worktree isolada, ou descartar todos os 5? | `03-inventario-sujeira.md` §3 |

---

## (h) Importar marca da Cory antes da virada (D20)

`00-decisoes.md` D20 cria a rota `POST /api/admin/tenants/[id]/importar-marca-do-ambiente` (super_admin) para copiar as `NEXT_PUBLIC_TENANT_*` do serviço atual da Cory para `tenants.brand`/`tenants.modules` — porque esses valores só existem hoje nas env vars do EasyPanel, não no banco.

- [ ] Antes da virada (PR P8, serviço único substituindo `deploy/cory`), chamar essa rota uma vez para o tenant da Cory, com o serviço antigo (que ainda tem as env vars de marca) no ar.
- [ ] Conferir visualmente que `tenants.brand` da Cory bate com o que está em produção hoje (logo, cores, favicon) antes de desligar o serviço antigo.
- [ ] Repetir o mesmo raciocínio para Vértice: como o serviço dela não estará necessariamente no ar no momento da migração, extrair os valores diretamente do `tenant.config.ts` da branch `deploy/vertice` (já listados em `02-plano-app-novo.md` §7: slug `vertice-industria`, `#1E3A5F`/`#C4A882`, partner exímIA, footer, `suporte@eximiaventures.com.br`, módulos `["biblioteca","units"]`) e usar como seed (migration M4), não a rota de importação.

---

## (i) Itens `[VERIFICAR]` — só confirmáveis com acesso a produção/Dashboard

| Item | Onde | O que verificar |
|---|---|---|
| Auth Hook de JWT | `supabase/migrations/20260421000000_jwt_tenant_claim_hook.sql:4-5` afirma que `auth_tenant_id()` lê o JWT; a definição vigente (`20260518100000:12-19`) lê a tabela `users` | Conferir no Dashboard (Authentication → Hooks) se o Custom Access Token Hook ainda está ativo. Se estiver, ele pode estar gravando um claim que ninguém mais lê — vestigial. Se não estiver, documentar como removido |
| Labels reais do Traefik no EasyPanel | `02-plano-app-novo.md` §5 | Sintaxe exata das labels de roteamento HostRegexp/TLS depende da versão do EasyPanel instalada — abrir o painel e confirmar antes de aplicar o item (c) acima |
| Bucket `tenant-assets` criado à mão em produção | `01-diagnostico.md` (d) item 4 | Confirmar no Dashboard (Storage) se alguém já criou o bucket manualmente em produção, fora de migration — se sim, a migration M3 precisa de `ON CONFLICT DO NOTHING` (já prevista) e as policies existentes precisam ser auditadas antes de sobrescrever |
