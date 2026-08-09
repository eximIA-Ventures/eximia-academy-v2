-- =============================================================================
-- Onboarding de Novidades — anúncios com janela + tour armado do construtor
-- =============================================================================
-- STATUS: NÃO APLICADA. Escrita em 2026-08-03, aguardando GO do Hugo.
-- CONFIRMADO em produção em 2026-08-04, por consulta de leitura:
--   to_regclass('public.product_announcements')      → NULL
--   to_regclass('public.product_announcement_views') → NULL
--   coluna users.announcements_since                 → não existe
-- Enquanto isso for verdade, `resolveOnboarding()` recebe 42P01, cai no
-- fail-open e devolve `null`: NADA aparece para NINGUÉM, em qualquer papel, sem
-- erro na tela e com uma única linha em console.error do servidor. Nenhuma
-- mudança de código muda esse fato — é o primeiro passo, não um detalhe.
-- Projeto Supabase alvo: vaguswivhqnlbgqvnjch (eximia-academy — PRODUÇÃO
-- COMPARTILHADA, serve argos.eximiaacademy.com.br e 4 tenants reais, incluindo
-- Cory Alimentos com cliente pagante).
--
-- Contrato de entrada: docs/stories/feat-onboarding-novidades-lancamento.md
--   §1.1 divisão conteúdo/metadados · §1.2 âncora de coorte · §1.3 decisões de
--   chave · §1.4 as três travas · Fase 2 os três artefatos
-- Contrato de nomes: apps/web/src/lib/onboarding/types.ts (NÃO editar; esta
--   migration usa exatamente as strings de FEATURE_KEYS de lá).
--
-- APLICAR VIA MANAGEMENT API, NÃO VIA `supabase db push`. O histórico de
-- migrations deste banco tem versões remote-only não reconciliadas; um
-- `db push` aplicaria migrations não autorizadas junto com esta. Mesmo
-- procedimento de 20260730000000 e 20260729120000. Ver o relatório de
-- aplicação ao final.
--
-- -----------------------------------------------------------------------------
-- PROBLEMA
-- -----------------------------------------------------------------------------
-- Dois anúncios (modal ilustrado) e um tour de 6 passos no construtor de
-- jornada vão ao ar. A regra de produto que organiza tudo: um anúncio só
-- aparece enquanto a janela dele estiver aberta, e só uma vez. O tour NÃO
-- expira e dispara por LUGAR (mount do construtor), nunca por data — ver §2.1
-- do contrato.
--
-- A COORTE ("só quem já estava aqui antes do anúncio começar") era, no
-- rascunho de 2026-08-03, uma segunda trava obrigatória. Em 2026-08-04 o Hugo
-- decidiu que ela passa a ser OPT-IN POR ANÚNCIO (coluna `cohort_gated`,
-- default `false`). O motivo está inteiro na §2 abaixo, junto da coluna: o que
-- ele nunca quis foi ACÚMULO, e a janela sozinha já impede acúmulo.
--
-- A janela precisa ser avaliada DENTRO da RLS (§1.1): se vivesse só no
-- TypeScript, um bug de cache no front poderia ressuscitar um anúncio de 2026
-- em 2027. Com o predicado no banco, o front pode errar e o dado simplesmente
-- não aparece.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- TIMEOUTS — o que torna seguro aplicar isto em horário útil
-- -----------------------------------------------------------------------------
-- O trabalho em si é trivial: `ADD COLUMN` nullable sem default é alteração só
-- de catálogo (instantânea), e o UPDATE de backfill toca 184 linhas em
-- milissegundos. O risco NÃO é a duração do trabalho, é a FILA.
--
-- O `ALTER TABLE users` pede ACCESS EXCLUSIVE em `public.users` — a tabela que
-- TODA policy do produto lê indiretamente, via `auth_tenant_id()`,
-- `auth_user_role()` e `is_super_admin()` (todas SECURITY DEFINER consultando
-- `users`). Basta UMA transação lenta ou `idle in transaction` segurando
-- qualquer lock em `users` no instante da aplicação para o ALTER entrar na fila
-- e, a partir daí, toda nova query em `users` ficar ATRÁS dele: login, home,
-- jornada e engagement dos 4 tenants param juntos, por tempo ilimitado.
--
-- Com `lock_timeout`, o pior caso deixa de ser "a plataforma congela" e passa a
-- ser "a migration falha em 3s, rollback total, nada aplicado, basta rodar de
-- novo". `SET LOCAL` vale só até o COMMIT desta transação — não muda o default
-- do banco.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

-- =============================================================
-- 1. users.announcements_since — a âncora de coorte
-- =============================================================
-- §1.2 do contrato: nem `users.created_at` nem `enrollments.created_at`
-- servem. Medido em produção em 2026-08-01: 120 de 120 alunos de Vértice têm
-- atividade ANTERIOR ao próprio `users.created_at`, e 133 de 185 contas nunca
-- logaram. Timestamp de criação MENTE; existência de linha de atividade não.
--
-- Esta coluna é o carimbo do próprio sistema de anúncios. O backfill abaixo
-- usa EXISTÊNCIA DE LINHA em `sessions` OU `chapter_view_progress`, nunca
-- timestamp — por isso é imune à contaminação medida. `enrollments` NÃO conta
-- como evidência: matrícula é ato do admin, não presença da pessoa.
--
-- A coluna PERMANECE mesmo com a coorte tendo virado opt-in (§2,
-- `cohort_gated`), e de propósito: é aditiva, barata, e é a âncora disponível
-- no dia em que um aviso de mudança de comportamento precisar dela.
--
-- -----------------------------------------------------------------------------
-- LIMITE HONESTO DESTA COLUNA (corrigido em 2026-08-04, LEIA ANTES DE LIGAR
-- `cohort_gated = true` em qualquer linha)
-- -----------------------------------------------------------------------------
-- O rascunho de 08-03 afirmava aqui que "a regra de aplicação, fora desta
-- migration, cunha announcements_since no primeiro acesso real dessas contas".
-- ESSA REGRA NÃO EXISTE. `grep -rn announcements_since apps/web/src` devolve
-- LEITURA e só (`lib/onboarding/resolve.ts`): não há UPDATE, trigger, DEFAULT
-- nem RPC que escreva nesta coluna em lugar nenhum do repositório.
--
-- Consequência exata, e ela é silenciosa: quem não tem evidência de atividade
-- hoje (29 contas medidas em 2026-08-04) e TODA conta criada a partir de agora
-- ficam com `announcements_since = NULL` PARA SEMPRE. Como
-- `resolve.ts` faz `if (!announcementsSince) continue`, ligar `cohort_gated`
-- num anúncio futuro suprimiria, sem erro e sem log, exatamente quem entrou
-- depois de hoje — inclusive alguém com um ano de uso em 2027, que é o
-- veterano que a coorte existiria para alcançar.
--
-- Portanto: este mecanismo está INCOMPLETO, e não "pronto para o dia em que
-- fizer sentido". Ligar `cohort_gated = true` exige, ANTES, implementar o
-- carimbo (a forma mínima é uma escrita idempotente no primeiro acesso
-- autenticado: `UPDATE users SET announcements_since = now() WHERE id =
-- auth.uid() AND announcements_since IS NULL`). Enquanto o carimbo não
-- existir, o valor desta coluna é um SNAPSHOT CONGELADO do backfill de
-- 2026-08-04, nada além disso.

ALTER TABLE users ADD COLUMN IF NOT EXISTS announcements_since TIMESTAMPTZ;

COMMENT ON COLUMN users.announcements_since IS
  'Âncora de coorte do onboarding de novidades: instante a partir do qual há evidência de que a pessoa já usava a plataforma. Backfill por existência de linha em sessions/chapter_view_progress, nunca por timestamp de criação (ver docs/stories/feat-onboarding-novidades-lancamento.md §1.2). Por default NÃO gateia nada: só é comparada com starts_at nos anúncios que optaram por product_announcements.cohort_gated = true. INCOMPLETA em 2026-08-04: NADA no código escreve nesta coluna depois do backfill, então toda conta criada a partir de então fica NULL para sempre e seria suprimida em silêncio por qualquer anúncio com cohort_gated = true. Implementar o carimbo no primeiro acesso autenticado ANTES de ligar a coorte em qualquer linha.';

-- Backfill: existência de linha em sessions OU chapter_view_progress marca a
-- pessoa como "já ativa" antes de hoje. Usa o timestamp mais antigo disponível
-- entre as duas fontes como carimbo (é só ordenação para fins de coorte, não
-- reconstrução de história — a garantia é BINÁRIA: tinha atividade ou não).
UPDATE users u
SET announcements_since = LEAST(
  COALESCE((SELECT MIN(s.created_at) FROM sessions s WHERE s.student_id = u.id), 'infinity'::timestamptz),
  COALESCE((SELECT MIN(c.first_viewed_at) FROM chapter_view_progress c WHERE c.student_id = u.id), 'infinity'::timestamptz)
)
WHERE announcements_since IS NULL
  AND (
    EXISTS (SELECT 1 FROM sessions s WHERE s.student_id = u.id)
    OR EXISTS (SELECT 1 FROM chapter_view_progress c WHERE c.student_id = u.id)
  );

-- Quem não tem NENHUMA evidência de atividade permanece NULL — o que é a
-- classificação correta (conta velha com experiência zero é recém-chegado, não
-- veterano, §Casos de borda do contrato), mas é também um estado do qual essas
-- contas NUNCA saem hoje: ver o "LIMITE HONESTO DESTA COLUNA" acima. Como os
-- três artefatos desta leva vão ao ar com `cohort_gated = false`, isso não
-- afeta ninguém agora; afetaria no primeiro anúncio que ligasse a coorte.

-- =============================================================
-- 2. product_announcements — o catálogo de metadados
-- =============================================================
-- Metadados, NÃO conteúdo. O conteúdo (títulos, corpo, imagens) é componente
-- React mapeado por content_key — HTML em coluna vira XSS e conteúdo que
-- ninguém revisa em PR (§1.1).
--
-- `IF NOT EXISTS` aqui, `DROP POLICY IF EXISTS` nas policies e `ON CONFLICT DO
-- NOTHING` nos INSERTs existem por um motivo operacional concreto: o caminho de
-- aplicação é um `curl` ao Management API. Se a conexão cair ou der 504 DEPOIS
-- do COMMIT (resposta perdida, transação efetivada), o operador não tem como
-- saber se aplicou, e a reação natural é rodar de novo. Sem idempotência, a
-- segunda execução aborta em 42P07 ("relation already exists") e a mensagem
-- SUGERE que nada foi criado — em produção compartilhada com cliente pagante,
-- isso convida a um DROP TABLE de pânico. Com ela, reexecutar é um no-op
-- verificável em vez de um erro ambíguo.

CREATE TABLE IF NOT EXISTS product_announcements (
  feature_key TEXT PRIMARY KEY,
  content_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('announcement', 'product_onboarding')),

  -- Janela. NULL para product_onboarding (nunca expira, dispara por lugar).
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,

  -- Público: lista de roles (users.role / user_roles.role) que podem ver este
  -- artefato. Sem CHECK fechado de valores: o repo tem multi-hat via
  -- user_roles e o conjunto de roles não é estático o bastante para travar
  -- aqui sem acoplar esta migration ao catálogo de roles do produto.
  audience_roles TEXT[] NOT NULL,

  priority INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,

  -- Onde o conhecimento mora depois que a janela fecha. Recusa publicar
  -- anúncio órfão — ver trava 3 abaixo.
  help_url TEXT NOT NULL,

  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Coorte: opt-in POR ANÚNCIO, decisão do Hugo em 2026-08-04, revendo o
  -- rascunho de 08-03 que a fazia obrigatória.
  --
  -- Ligada, a regra é `users.announcements_since < starts_at`: só vê quem já
  -- estava aqui antes do anúncio começar. Default `false` porque uma feature
  -- nova é novidade para TODO MUNDO enquanto a janela está aberta, inclusive
  -- para quem chegou ontem — e negá-la a ele é justamente esconder a novidade
  -- de quem tem MENOS repertório para descobri-la sozinho.
  --
  -- O medo original era ACÚMULO: alguém entrar daqui a dois anos e tomar na
  -- cara toda a fila de avisos já publicados. A JANELA sozinha já mata esse
  -- caso — `pa_window_max_35d` garante que todo anúncio morre em no máximo 35
  -- dias, então não existe fila para acumular. A coorte era uma SEGUNDA trava
  -- para o mesmo problema, e cobrava um preço alto: excluía exatamente quem
  -- está entrando enquanto a feature é nova para o produto inteiro.
  --
  -- Continua existindo, desligada, porque há um caso legítimo que a janela não
  -- cobre: o aviso de MUDANÇA DE COMPORTAMENTO ("o cálculo de X mudou"), que
  -- só faz sentido para quem conhecia o comportamento antigo. Para quem nunca
  -- viu o antigo, esse aviso não é novidade, é confusão. Quem publicar esse
  -- tipo de anúncio liga aqui, deliberadamente, linha a linha.
  cohort_gated BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ===========================================================
  -- 1.4 As travas que tornam a janela uma garantia
  -- ===========================================================
  -- Eram três no contrato (§1.4); a quarta nasceu com `cohort_gated` e serve
  -- ao mesmo propósito das outras: tornar a combinação errada NÃO CADASTRÁVEL,
  -- em vez de documentada.

  -- Trava 1: anúncio EXIGE janela, tour PROÍBE janela. Ninguém escreve
  -- "anúncio eterno" nem "tour com validade".
  CONSTRAINT pa_window_by_kind CHECK (
    (kind = 'announcement' AND starts_at IS NOT NULL AND ends_at IS NOT NULL)
    OR
    (kind = 'product_onboarding' AND starts_at IS NULL AND ends_at IS NULL)
  ),

  -- Trava 2: teto duro de 35 dias. Não existe janela eterna cadastrável.
  -- Renovar exige UPDATE deliberado, que é decisão, não esquecimento. Só se
  -- aplica quando a janela existe (announcement); tour não tem starts_at/
  -- ends_at para medir, e a trava 1 já garante que não pode ter.
  CONSTRAINT pa_window_max_35d CHECK (
    ends_at IS NULL OR starts_at IS NULL OR (ends_at - starts_at) <= INTERVAL '35 days'
  ),

  -- Trava 3 é a própria coluna: help_url TEXT NOT NULL acima. O banco recusa
  -- a linha inteira sem ela — não há como publicar um anúncio que não declare
  -- onde o conhecimento mora depois que a janela fechar.

  CONSTRAINT pa_ends_after_starts CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),

  -- Trava 4: coorte só existe onde existe janela para comparar, e só
  -- announcement tem janela (trava 1). Um product_onboarding com cohort_gated
  -- ligado compararia a âncora contra `starts_at IS NULL` — não daria erro,
  -- daria SILÊNCIO: o tour simplesmente nunca apareceria para ninguém, sem
  -- nenhum sintoma. O banco recusa a combinação em vez de deixá-la cadastrável.
  CONSTRAINT pa_cohort_only_announcement CHECK (
    cohort_gated = false OR kind = 'announcement'
  )
);

COMMENT ON TABLE product_announcements IS
  'Catálogo de metadados do onboarding de novidades. Conteúdo vive em componente React (content_key), não aqui — ver docs/stories/feat-onboarding-novidades-lancamento.md §1.1.';

COMMENT ON COLUMN product_announcements.kind IS
  'announcement dispara por DATA e sempre expira (starts_at/ends_at obrigatórios). product_onboarding dispara por LUGAR e nunca expira (starts_at/ends_at proibidos). Ver pa_window_by_kind.';

COMMENT ON COLUMN product_announcements.cohort_gated IS
  'Opt-in por anúncio (default false). true = só vê quem tem users.announcements_since anterior a starts_at, isto é, quem já estava aqui antes do anúncio começar. Ligar só para aviso de MUDANÇA de comportamento, que depende de a pessoa ter conhecido o comportamento antigo. Para novidade pura, deixe false: dentro da janela ela é novidade para todo mundo. O acúmulo de avisos antigos é impedido pela janela (pa_window_max_35d), não por esta coluna.';

COMMENT ON COLUMN product_announcements.help_url IS
  'Onde o conhecimento mora depois que a janela fecha. NOT NULL de propósito: impede o anúncio órfão (a única explicação de uma feature desaparecendo sem deixar rastro).';

-- =============================================================
-- 3. product_announcement_views — quem viu
-- =============================================================
-- §1.3 do contrato, cada decisão de chave com a prova medida:

CREATE TABLE IF NOT EXISTS product_announcement_views (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL REFERENCES product_announcements(feature_key) ON DELETE CASCADE,

  -- Estados: armed | seen | skipped | completed (types.ts ViewState). `armed`
  -- é o que faz o tour esperar: a linha nasce armada quando a novidade da
  -- Jornada se resolve, e só vira terminal quando a pessoa chega ao
  -- construtor — um minuto ou seis meses depois. `armed` não expira: durar É
  -- o ponto.
  state TEXT NOT NULL DEFAULT 'armed' CHECK (state IN ('armed', 'seen', 'skipped', 'completed')),

  -- Passo em que a pessoa parou, para o tour retomar em vez de recomeçar
  -- (§Casos de borda: "recomeçar do zero é punição por ter saído da tela").
  -- Só faz sentido para kind='product_onboarding'; para announcement fica
  -- sempre NULL (não há CHECK cruzando tabelas aqui — a aplicação escreve
  -- corretamente, e um NULL indevido em announcement é inofensivo).
  last_step INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- `version` FORA da chave: dentro dela, subir v1→v2 com um tour `armed`
  -- pendente não avançaria a linha, inseriria uma nova e deixaria a `armed`
  -- órfã para sempre. A contagem de tours armados passaria a contar
  -- fantasmas a cada bump. `version` fica como coluna comum, para a
  -- aplicação decidir se uma view antiga ainda vale para o conteúdo atual.
  version INTEGER NOT NULL DEFAULT 1,

  -- Chave SEM tenant_id: auth_tenant_id() lê users.tenant_id, coluna MUTÁVEL
  -- (troca de tenant faz UPDATE direto nela). Para conta com tenant nulo,
  -- `WITH CHECK (... AND tenant_id = auth_tenant_id())` avalia NULL (não
  -- TRUE) e devolve 42501: a pessoa leria mas nunca escreveria, e tomaria o
  -- modal em TODO page load, para sempre. Como user_id = auth.uid() já é mais
  -- estreito que qualquer escopo de tenant, somar tenant não ganha isolamento
  -- nenhum — só adiciona um jeito de travar a escrita.
  PRIMARY KEY (user_id, feature_key)
);

COMMENT ON TABLE product_announcement_views IS
  'Quem viu o quê. Chave (user_id, feature_key) SEM tenant_id e SEM version — ver docs/stories/feat-onboarding-novidades-lancamento.md §1.3 para a prova de cada omissão.';

COMMENT ON COLUMN product_announcement_views.state IS
  'armed = tour aguardando a pessoa chegar ao lugar certo (não expira). seen/skipped/completed são terminais.';

CREATE INDEX IF NOT EXISTS idx_paviews_user_state ON product_announcement_views(user_id, state);

-- =============================================================
-- 4. RLS — uma policy POR COMANDO, nunca FOR ALL
-- =============================================================
-- Este repositório tem vazamento cross-tenant PROVADO por policies `FOR ALL`
-- sem recorte de tenant (`jr_super_admin`, `lt_super_admin`,
-- `super_admin_all_users`). Estas tabelas nascem escopadas, sem exceção.
-- Reforço do §1.1: a janela é predicado AQUI, não só no TypeScript, para que
-- um bug de cache no front nunca consiga ressuscitar um anúncio expirado.

ALTER TABLE product_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_announcement_views ENABLE ROW LEVEL SECURITY;

-- --- product_announcements ---------------------------------------------

-- Qualquer usuário autenticado lê os anúncios ATIVOS cujo próprio role está
-- no público E cuja janela está aberta agora (para announcement) ou que são
-- product_onboarding (sem janela, sempre elegível por data — o filtro de
-- "já chegou ao lugar certo" é da aplicação, não do banco). A pessoa só vê a
-- LINHA de metadado; ver o conteúdo de fato depende também de ter uma view
-- elegível — isso é resolvido pela aplicação combinando as duas tabelas.
--
-- NÃO HÁ PREDICADO DE COORTE AQUI, e isso é deliberado (não esquecimento). O
-- rascunho de contrato previa um `auth_announcements_since() < starts_at`
-- dentro desta policy; ele nunca foi escrito, e agora não deve ser: a coorte
-- é condicional POR LINHA (`cohort_gated`), e um predicado aqui teria de
-- carregar o mesmo condicional. Duplicar a regra em dois lugares é como se
-- cria a divergência silenciosa em que a aplicação libera e o banco esconde —
-- o sintoma seria "não aparece", sem erro nenhum, o pior modo de falha
-- possível de diagnosticar. A JANELA continua sendo predicado daqui (é
-- garantia de banco, imune a bug de cache no front); a COORTE é regra única
-- de `lib/onboarding/resolve.ts`.
DROP POLICY IF EXISTS "pa_select_eligible" ON product_announcements;
CREATE POLICY "pa_select_eligible" ON product_announcements FOR SELECT
  USING (
    is_active = true
    AND auth_user_role() = ANY (audience_roles)
    AND (
      kind = 'product_onboarding'
      OR (starts_at <= now() AND ends_at > now())
    )
  );

-- Leitura de OPERAÇÃO para o super admin. Sem ela, quem edita o catálogo não
-- enxerga nenhuma linha dele, e três coisas se somam para tornar isso pior do
-- que parece:
--   (a) `pa_select_eligible` exige `auth_user_role() = ANY (audience_roles)`, e
--       `auth_user_role()` é `SELECT role FROM users WHERE id = auth.uid() AND
--       tenant_id = auth_tenant_id()`. O ÚNICO super_admin deste banco tem
--       `tenant_id IS NULL` (medido 2026-08-04, 1 de 184 contas): o predicado
--       vira NULL, nenhuma linha casa, a função devolve NULL, e `NULL = ANY(...)`
--       é NULL, não TRUE. Ele lê ZERO linhas.
--   (b) a mesma policy exige `is_active = true` E janela aberta, então qualquer
--       linha desativada ou expirada some para TODOS, inclusive para quem tem
--       `pa_admin_update`.
--   (c) PostgREST filtra por coluna, e filtrar exige SELECT. Um
--       `PATCH ...?feature_key=eq.jornada-intro` para corrigir um `ends_at`
--       digitado errado — o erro que o passo 7 da verificação manda vigiar —
--       devolveria 200 com ZERO linhas afetadas, SEM erro: o anúncio segue
--       errado e o sintoma é silêncio.
-- `is_super_admin()` não depende de tenant (só role/status/deleted_at), então
-- funciona para a conta de tenant nulo e enxerga linha inativa e expirada.
-- SOMENTE SELECT, nunca FOR ALL — mesmo rompimento consciente com o padrão
-- legado feito em `pav_super_admin_select` abaixo e em 20260730000000.
DROP POLICY IF EXISTS "pa_super_admin_select" ON product_announcements;
CREATE POLICY "pa_super_admin_select" ON product_announcements FOR SELECT
  USING (is_super_admin());

-- Só super admin publica/edita/desativa anúncios. Nenhum caso de uso comum
-- escreve nesta tabela.
DROP POLICY IF EXISTS "pa_admin_insert" ON product_announcements;
CREATE POLICY "pa_admin_insert" ON product_announcements FOR INSERT
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "pa_admin_update" ON product_announcements;
CREATE POLICY "pa_admin_update" ON product_announcements FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- --- product_announcement_views -----------------------------------------

-- Cada pessoa lê apenas as próprias views. NÃO há policy de leitura para admin
-- de tenant, e isso é decisão de produto (story §"O que NÃO entra", item 1:
-- leitura de "quem viu o aviso" pelo gestor/admin transforma preferência de
-- interface em monitoramento de trabalhador). A consequência para o export
-- LGPD feito por admin em nome de terceiro está tratada explicitamente em
-- `api/privacy/export/route.ts` — RLS de SELECT FILTRA em vez de recusar, e
-- sem tratamento o export sairia com `[]` subdeclarando o dado retido.
DROP POLICY IF EXISTS "pav_select_own" ON product_announcement_views;
CREATE POLICY "pav_select_own" ON product_announcement_views FOR SELECT
  USING (user_id = auth.uid());

-- Cada pessoa só cria/atualiza a própria linha, nunca em nome de terceiro.
-- Sem predicado de tenant (§1.3): user_id = auth.uid() já é o escopo mais
-- estreito possível.
DROP POLICY IF EXISTS "pav_insert_own" ON product_announcement_views;
CREATE POLICY "pav_insert_own" ON product_announcement_views FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "pav_update_own" ON product_announcement_views;
CREATE POLICY "pav_update_own" ON product_announcement_views FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Super admin: SOMENTE LEITURA, deliberadamente NÃO `FOR ALL` — mesmo
-- rompimento consciente com o padrão legado já feito em
-- 20260730000000_chapter_view_progress.sql. Auditar exige ler, não gravar em
-- nome de outra pessoa.
DROP POLICY IF EXISTS "pav_super_admin_select" ON product_announcement_views;
CREATE POLICY "pav_super_admin_select" ON product_announcement_views FOR SELECT
  USING (is_super_admin());

-- =============================================================
-- 5. Os três artefatos de hoje (Fase 2 do contrato)
-- =============================================================
-- Início 2026-08-03 09:00 com fuso -03 EXPLÍCITO: data pura faria o anúncio
-- sumir 3 horas antes no Brasil (o servidor Supabase é UTC). N1 e N2 começam
-- JUNTOS, serializados por priority, não por datas escalonadas — escalonar
-- atrasaria o anúncio da Jornada em 3 semanas sem motivo.
--
-- CORREÇÃO ao contrato de arquitetura (registrada para não ser "corrigida de
-- volta"): o público de N1 (percorrido-vs-conclusao) INCLUI 'student'. O
-- contrato de arquitetura original restringia a gestores por achar que a
-- tabela "Percorrido" só existe em /engagement; está errado — ela também
-- existe em comparison-insights-table.tsx, a versão do PRÓPRIO ALUNO no card
-- "Meu ritmo" da home dele. Restringir a gestores excluiria exatamente quem o
-- onboarding mira. "Gestores" aqui = ENGAGEMENT_ACCESS_ROLES do app
-- (apps/web/src/app/(platform)/engagement/page.tsx): admin, manager,
-- instructor, super_admin.
--
-- -----------------------------------------------------------------------------
-- O QUE `audience_roles` É E O QUE ELE NÃO É (verificado no código, 2026-08-04)
-- -----------------------------------------------------------------------------
-- `audience_roles` é um TETO ("quem pode, no máximo, ver esta linha"), não uma
-- promessa de entrega. Quem entrega é a superfície, e hoje existe UMA
-- superfície de modal: `AnnouncementHost`, montado só pelo `StudentDashboard`
-- (`components/dashboard/student-dashboard.tsx:142`), alimentado só pelo ramo
-- `case "student"` de `(platform)/dashboard/page.tsx`.
--
-- Quem chega lá, na prática:
--   - `student`: sempre.
--   - `admin` e `super_admin`: sim, no MUNDO PADRÃO — `resolveDashboardKind`
--     remove os chapéus admin-tier nesse mundo e reprocessa, caindo em
--     "student".
--   - `manager` e `instructor`: SÓ com contexto ativo `personal` (e, no caso do
--     instrutor, com matrícula). No contexto `team`/`organization` eles montam
--     `ManagerDashboardPage`/`ManagerTeamDashboardPage`, que NÃO chamam
--     `resolveOnboarding()` — nenhum modal aparece ali.
--   - `teacher` e `leader`: não existem em `users.role` neste banco (medido:
--     admin, instructor, manager, student, super_admin), e `auth_user_role()`
--     lê `users.role`. São peso morto inofensivo na lista.
--
-- Os papéis ficam na lista de propósito: estreitar agora quebraria o gestor e o
-- instrutor que ESTUDAM (contexto pessoal), que é um público real. O que não
-- pode acontecer é alguém ler esta lista como "o gestor vai ver isto no painel
-- dele" — não vai, e o sintoma é silêncio. Levar o modal aos painéis de gestão
-- é trabalho de outra story (montar o host lá e chamar `resolveOnboarding()`
-- com `surface: "home"`), deliberadamente fora do escopo desta migration.

-- Os três nascem com `cohort_gated = false`, escrito EXPLICITAMENTE em vez de
-- herdado do default: nenhum dos três é aviso de mudança de comportamento.
-- "Percorrido x Conclusão" e a Jornada são capacidades que passaram a existir,
-- e o construtor é um lugar que passou a existir — para quem entrou ontem elas
-- são tão novas quanto para quem está aqui há um ano. Deixar implícito
-- convidaria a próxima pessoa a copiar a linha sem perceber que existe uma
-- decisão aqui.
INSERT INTO product_announcements
  (feature_key, content_key, kind, starts_at, ends_at, audience_roles, priority, version, help_url, is_active, cohort_gated)
VALUES
  (
    'percorrido-vs-conclusao',
    'percorrido-vs-conclusao',
    'announcement',
    TIMESTAMPTZ '2026-08-03 09:00:00-03',
    TIMESTAMPTZ '2026-08-03 09:00:00-03' + INTERVAL '21 days',
    ARRAY['student', 'admin', 'manager', 'instructor', 'super_admin'],
    10,
    1,
    '/ajuda/percorrido-vs-conclusao',
    true,
    false
  ),
  (
    'jornada-intro',
    'jornada-intro',
    'announcement',
    TIMESTAMPTZ '2026-08-03 09:00:00-03',
    TIMESTAMPTZ '2026-08-03 09:00:00-03' + INTERVAL '28 days',
    ARRAY['student', 'teacher', 'admin', 'manager', 'instructor', 'leader', 'super_admin'],
    20,
    1,
    '/ajuda/jornada',
    true,
    false
  ),
  (
    'jornada-builder-tour',
    'jornada-builder-tour',
    'product_onboarding',
    NULL,
    NULL,
    ARRAY['student', 'teacher', 'admin', 'manager', 'instructor', 'leader', 'super_admin'],
    50,
    1,
    '/ajuda/jornada',
    true,
    false
  )
ON CONFLICT (feature_key) DO NOTHING;

-- =============================================================
-- 6. Gancho LGPD — IMPLEMENTADO AQUI, não adiado
-- =============================================================
-- O rascunho de 08-03 declarava este passo "fora do escopo desta migration".
-- Isso contradizia diretamente a story, que o põe como critério de aceite
-- BLOQUEANTE (§Ordem de implantação, "LGPD entra no mesmo PR": DELETE em
-- lgpd_soft_delete_user + bloco nomeado feature_intro no export; "o PR não
-- passa no QA gate sem isto"). A contradição é resolvida a favor da story, e
-- pelo motivo que ela mesma dá: omitir tabela NOVA de dado pessoal de um
-- export/soft delete que JÁ existe cria não conformidade nova em produção, não
-- herda uma antiga — e follow-up de conformidade não volta.
--
-- Por que o soft delete precisa do DELETE explícito: a FK
-- `ON DELETE CASCADE` de `product_announcement_views.user_id` só dispara na
-- exclusão DURA de `auth.users`. O soft delete não deleta `auth.users`, só
-- carimba `users.deleted_at` — sem esta linha, as views do titular que pediu
-- exclusão continuariam vivas indefinidamente.
--
-- `product_announcements` NÃO é tocada: é catálogo de metadados, sem PII.
--
-- A função inteira é reescrita (CREATE OR REPLACE) preservando os 3 passos
-- originais de 20260208000004 byte a byte; o DELETE entra como passo 4, DEPOIS
-- deles, e a atomicidade continua sendo a da própria função.

CREATE OR REPLACE FUNCTION lgpd_soft_delete_user(p_user_id UUID)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Anonymize sessions — set student_id to NULL
  UPDATE sessions SET student_id = NULL WHERE student_id = p_user_id;

  -- 2. Soft delete enrollments
  UPDATE enrollments SET deleted_at = v_now WHERE student_id = p_user_id AND deleted_at IS NULL;

  -- 3. Soft delete user
  UPDATE users SET deleted_at = v_now WHERE id = p_user_id AND deleted_at IS NULL;

  -- 4. Onboarding de novidades: apagar, não anonimizar. Diferente de `sessions`
  --    (onde o conteúdo pedagógico tem valor agregado depois de desvinculado),
  --    aqui a linha É a associação pessoa↔aviso: sem `user_id` ela não guarda
  --    nada de útil, só um registro de comportamento de uma pessoa que pediu
  --    para sair. DELETE é a operação certa.
  DELETE FROM product_announcement_views WHERE user_id = p_user_id;

  RETURN v_now;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- =============================================================================
-- APLICAÇÃO E VERIFICAÇÃO (para o @devops executar, após GO do Hugo)
-- =============================================================================
-- APLICAR: POST /v1/projects/vaguswivhqnlbgqvnjch/database/query com o corpo
-- desta migration, em transação única, autenticado com o token do Keychain
-- (serviço `mission-control-supabase`), via curl. Exemplo de forma (token
-- lido do Keychain, nunca hardcoded):
--
--   TOKEN=$(security find-generic-password -s "mission-control-supabase" -w)
--   curl -sS -X POST \
--     "https://api.supabase.com/v1/projects/vaguswivhqnlbgqvnjch/database/query" \
--     -H "Authorization: Bearer ${TOKEN}" \
--     -H "Content-Type: application/json" \
--     -d "$(jq -Rs '{query: .}' < supabase/migrations/20260803000000_onboarding_novidades.sql)"
--
-- NÃO usar `supabase db push` (motivo no cabeçalho: 12+ migrations
-- remote-only não reconciliadas seriam aplicadas junto). NÃO rodar
-- `supabase migration repair` às cegas. Registrar em
-- `supabase_migrations.schema_migrations` somente DEPOIS de confirmar a
-- existência real das duas tabelas.
--
-- VERIFICAR DEPOIS, nesta ordem:
--   1. Existência real:
--      GET /rest/v1/product_announcements?limit=1 → 200
--      GET /rest/v1/product_announcement_views?limit=1 → 200
--   2. As 3 linhas de catálogo existem com as chaves certas:
--      SELECT feature_key, kind, starts_at, ends_at, audience_roles, priority,
--             cohort_gated
--      FROM product_announcements ORDER BY priority;
--      → esperado 3 linhas, jornada-builder-tour com starts_at/ends_at NULL,
--        e cohort_gated = false nas TRÊS. Um `true` aqui significa que alguém
--        editou o INSERT sem ler o comentário da coluna, e o sintoma em
--        produção seria "o anúncio não aparece para os novos" — silencioso.
--   3. Nenhuma policy FOR ALL:
--      SELECT policyname, cmd FROM pg_policy p
--      JOIN pg_class c ON c.oid = p.polrelid
--      WHERE c.relname IN ('product_announcements', 'product_announcement_views');
--      → cmd ∈ {SELECT, INSERT, UPDATE}, nenhum ALL.
--   4. Trava de janela: tentar INSERT de announcement sem ends_at → deve
--      falhar com violação de pa_window_by_kind. Tentar INSERT de
--      product_onboarding COM starts_at → deve falhar com o mesmo CHECK.
--   5. Trava de 35 dias: tentar INSERT de announcement com ends_at 40 dias
--      após starts_at → deve falhar com violação de pa_window_max_35d.
--   5b. Trava de coorte: tentar INSERT de product_onboarding com
--      cohort_gated = true → deve falhar com violação de
--      pa_cohort_only_announcement (coorte sem janela para comparar não daria
--      erro em runtime, daria um tour invisível para todos).
--   6. PROVA DE ISOLAMENTO, com controle negativo obrigatório, dentro de
--      transação com ROLLBACK:
--        POSITIVO: INSERT em product_announcement_views como `authenticated`
--                  com jwt sub = usuário real, user_id = ele mesmo → ACEITO.
--        NEGATIVO: mesmo INSERT com user_id de um terceiro → 42501.
--      O controle negativo não é opcional: sem ele, "passou" pode significar
--      apenas que a RLS nunca foi aplicada (o role `postgres` ignora
--      policies).
--   7. Verificação de janela em D+1 (mitigação obrigatória do contrato para
--      "operador erra o ano em ends_at"): consultar se `seen = 0` com janela
--      aberta — se sim, suspeitar de erro de data no cadastro.
--   8. Reexecução (idempotência): rodar a migration inteira uma SEGUNDA vez
--      deve terminar sem erro e sem duplicar nada — 3 linhas em
--      product_announcements, não 6. É o que torna seguro repetir o curl
--      quando a resposta se perde.
--
-- =============================================================================
-- DEPOIS DE APLICAR: LIGAR O KILL SWITCH (passo separado, NÃO é opcional)
-- =============================================================================
-- Medido em produção em 2026-08-04: `settings->'features'` é NULL nos 4 tenants
-- (Cory Alimentos, exímIA Academy, Harven Finance, Vértice Indústria). A chave
-- nunca foi criada. Como `isTenantFeatureEnabled()` devolve `false` na ausência
-- da chave (default OFF deliberado, `lib/tenant-features.ts`),
-- `resolveOnboarding()` retorna `null` na linha seguinte — ou seja: aplicar a
-- migration e parar por aí produz EXATAMENTE o mesmo sintoma de não a ter
-- aplicado. São duas travas independentes, e as duas precisam cair.
--
-- Não vai dentro da migration de propósito (a story manda ENSAIAR o kill switch
-- antes de ligar, e ligar para os 4 tenants de uma vez não é decisão desta
-- transação). Ligar tenant a tenant, com o Hugo sabendo:
--
--   UPDATE tenants
--      SET settings = jsonb_set(
--            COALESCE(settings, '{}'::jsonb),
--            '{features,onboarding_jornada_v1}',
--            'true'::jsonb,
--            true)
--    WHERE id = '<tenant_id>';
--
-- Conferir antes de pedir ao Hugo para olhar a tela:
--   SELECT name, settings->'features'->>'onboarding_jornada_v1' FROM tenants;
--
-- E DESLIGAR (o ensaio do kill switch, que vale no PRÓXIMO request, sem deploy):
--   UPDATE tenants
--      SET settings = jsonb_set(settings, '{features,onboarding_jornada_v1}', 'false'::jsonb)
--    WHERE id = '<tenant_id>';
--
-- =============================================================================
-- COM QUAL CONTA CONFERIR (importa mais do que parece)
-- =============================================================================
-- A conta `super_admin` do Hugo (`hugo.capitelli@eximiaventures.com.br`) tem
-- `tenant_id IS NULL` — a ÚNICA das 184 contas nessa situação, medido em
-- 2026-08-04. Ela é barrada DUAS vezes: `resolveOnboarding()` sai em
-- `if (!ctx.tenantId) return null` antes de tocar o banco, e, se passasse,
-- `auth_user_role()` (`... AND tenant_id = auth_tenant_id()`) devolveria NULL,
-- fazendo `NULL = ANY(audience_roles)` avaliar NULL e a RLS esconder as 3
-- linhas. Conferir com ela é garantir não ver nada, mesmo com tudo certo.
--
-- Conta que atravessa todos os gates hoje: `hugocapitelli17@gmail.com`
-- (student, tenant exímIA Academy, `onboarding_completed = true`).
-- Alternativa sem tocar em dado de gente: `/dashboard?onboarding=percorrido`
-- (modo demonstração) — mas ele sai ANTES de qualquer query, então prova que a
-- PEÇA renderiza, e não que o caminho real resolve. As duas conferências são
-- necessárias, e não substituem uma à outra.
--
-- ROLLBACK (nesta ordem — a função primeiro, senão ela fica referenciando uma
-- tabela que já não existe e o próximo soft delete falha):
--   1. Restaurar lgpd_soft_delete_user na versão de 20260208000004, isto é, sem
--      o passo 4 (`DELETE FROM product_announcement_views ...`). Reaplicar o
--      corpo daquele arquivo com CREATE OR REPLACE resolve.
--   2. DROP TABLE product_announcement_views;
--   3. DROP TABLE product_announcements;
--   4. ALTER TABLE users DROP COLUMN IF EXISTS announcements_since;
-- Aditiva e isolada — além de `users` (coluna nullable, sem default) e da
-- função de soft delete, nenhuma tabela existente é alterada.
-- =============================================================================
