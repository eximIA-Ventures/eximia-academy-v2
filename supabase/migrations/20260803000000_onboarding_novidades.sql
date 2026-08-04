-- =============================================================================
-- Onboarding de Novidades — anúncios com janela + tour armado do construtor
-- =============================================================================
-- STATUS: NÃO APLICADA. Escrita em 2026-08-03, aguardando GO do Hugo.
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
-- aparece para quem já estava na plataforma antes de ele começar, só enquanto
-- a janela dele estiver aberta, e só uma vez. O tour NÃO expira e dispara por
-- LUGAR (mount do construtor), nunca por data — ver §2.1 do contrato.
--
-- A janela precisa ser avaliada DENTRO da RLS (§1.1): se vivesse só no
-- TypeScript, um bug de cache no front poderia ressuscitar um anúncio de 2026
-- em 2027. Com o predicado no banco, o front pode errar e o dado simplesmente
-- não aparece.
-- =============================================================================

BEGIN;

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
-- como evidência: matrícula é ato do admin, não presença da pessoa. Quem não
-- tem nenhuma das duas evidências fica NULL e cunha a âncora no primeiro
-- acesso real (regra de aplicação, fora desta migration).

ALTER TABLE users ADD COLUMN IF NOT EXISTS announcements_since TIMESTAMPTZ;

COMMENT ON COLUMN users.announcements_since IS
  'Âncora de coorte do onboarding de novidades: só quem estava aqui ANTES do início da janela de um anúncio o vê. Backfill por existência de linha em sessions/chapter_view_progress, nunca por timestamp de criação — ver docs/stories/feat-onboarding-novidades-lancamento.md §1.2.';

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

-- Quem não tem NENHUMA evidência de atividade permanece NULL. A regra de
-- aplicação (fora desta migration) cunha announcements_since no primeiro
-- acesso real dessas contas — conta velha com experiência zero é recém-
-- chegado, não veterano (§Casos de borda do contrato).

-- =============================================================
-- 2. product_announcements — o catálogo de metadados
-- =============================================================
-- Metadados, NÃO conteúdo. O conteúdo (títulos, corpo, imagens) é componente
-- React mapeado por content_key — HTML em coluna vira XSS e conteúdo que
-- ninguém revisa em PR (§1.1).

CREATE TABLE product_announcements (
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

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ===========================================================
  -- 1.4 As três travas que tornam a janela uma garantia
  -- ===========================================================

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

  CONSTRAINT pa_ends_after_starts CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

COMMENT ON TABLE product_announcements IS
  'Catálogo de metadados do onboarding de novidades. Conteúdo vive em componente React (content_key), não aqui — ver docs/stories/feat-onboarding-novidades-lancamento.md §1.1.';

COMMENT ON COLUMN product_announcements.kind IS
  'announcement dispara por DATA e sempre expira (starts_at/ends_at obrigatórios). product_onboarding dispara por LUGAR e nunca expira (starts_at/ends_at proibidos). Ver pa_window_by_kind.';

COMMENT ON COLUMN product_announcements.help_url IS
  'Onde o conhecimento mora depois que a janela fecha. NOT NULL de propósito: impede o anúncio órfão (a única explicação de uma feature desaparecendo sem deixar rastro).';

-- =============================================================
-- 3. product_announcement_views — quem viu
-- =============================================================
-- §1.3 do contrato, cada decisão de chave com a prova medida:

CREATE TABLE product_announcement_views (
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

CREATE INDEX idx_paviews_user_state ON product_announcement_views(user_id, state);

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
CREATE POLICY "pa_select_eligible" ON product_announcements FOR SELECT
  USING (
    is_active = true
    AND auth_user_role() = ANY (audience_roles)
    AND (
      kind = 'product_onboarding'
      OR (starts_at <= now() AND ends_at > now())
    )
  );

-- Só super admin publica/edita/desativa anúncios. Nenhum caso de uso comum
-- escreve nesta tabela.
CREATE POLICY "pa_admin_insert" ON product_announcements FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "pa_admin_update" ON product_announcements FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- --- product_announcement_views -----------------------------------------

-- Cada pessoa lê apenas as próprias views.
CREATE POLICY "pav_select_own" ON product_announcement_views FOR SELECT
  USING (user_id = auth.uid());

-- Cada pessoa só cria/atualiza a própria linha, nunca em nome de terceiro.
-- Sem predicado de tenant (§1.3): user_id = auth.uid() já é o escopo mais
-- estreito possível.
CREATE POLICY "pav_insert_own" ON product_announcement_views FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "pav_update_own" ON product_announcement_views FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Super admin: SOMENTE LEITURA, deliberadamente NÃO `FOR ALL` — mesmo
-- rompimento consciente com o padrão legado já feito em
-- 20260730000000_chapter_view_progress.sql. Auditar exige ler, não gravar em
-- nome de outra pessoa.
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

INSERT INTO product_announcements
  (feature_key, content_key, kind, starts_at, ends_at, audience_roles, priority, version, help_url, is_active)
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
    true
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
    true
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
    true
  );

-- =============================================================
-- 6. Gancho LGPD (preparado, NÃO implementado nesta migration)
-- =============================================================
-- O soft delete de usuário (lgpd_soft_delete_user, 20260208000004) vai
-- precisar apagar/anonimizar as views desta pessoa quando o agente
-- responsável pelo gancho LGPD chegar. A tabela certa para o DELETE dele é
-- `product_announcement_views` (chave user_id, feature_key) — a FK
-- ON DELETE CASCADE em auth.users(id) já cobre o caso de exclusão dura da
-- conta; o que falta é o caso do soft delete, que NÃO deleta auth.users.
-- NÃO há necessidade de tocar `product_announcements` (não tem PII).
--
-- Alteração esperada em lgpd_soft_delete_user (fora do escopo desta
-- migration):
--   DELETE FROM product_announcement_views WHERE user_id = p_user_id;
-- E, se houver export de dados do usuário em outro lugar do código, incluir
-- product_announcement_views no bloco de export.

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
--      SELECT feature_key, kind, starts_at, ends_at, audience_roles, priority
--      FROM product_announcements ORDER BY priority;
--      → esperado 3 linhas, jornada-builder-tour com starts_at/ends_at NULL.
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
--
-- ROLLBACK:
--   DROP TABLE product_announcement_views;
--   DROP TABLE product_announcements;
--   ALTER TABLE users DROP COLUMN IF EXISTS announcements_since;
-- Aditiva e isolada — nenhuma tabela existente além de `users` é alterada
-- (e a alteração em `users` é uma coluna nullable sem default obrigatório),
-- então a remoção não afeta nada em uso.
-- =============================================================================
