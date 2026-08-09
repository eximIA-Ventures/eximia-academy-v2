-- =============================================================================
-- Percorrido x Elaborado — telemetria de exposição por módulo
-- =============================================================================
-- STATUS: NÃO APLICADA. Escrita em 2026-07-30, aguardando GO do Hugo.
-- Projeto Supabase alvo: vaguswivhqnlbgqvnjch (eximia-academy — PRODUÇÃO
-- COMPARTILHADA, serve argos.eximiaacademy.com.br e 4 tenants reais, incluindo
-- Cory Alimentos com 51 usuários de cliente).
--
-- Contrato de entrada: docs/architecture/medicao-percorrido-vs-elaborado.md
--   §4 contrato de dado · §5 fórmulas · §6 RLS e multi-tenant
--
-- APLICAR VIA MANAGEMENT API, NÃO VIA `supabase db push`. O histórico de
-- migrations deste banco tem 12 versões remote-only não reconciliadas; um
-- `db push` aplicaria migrations não autorizadas junto com esta. Mesmo
-- procedimento de 20260729120000. Ver o relatório de aplicação ao final.
--
-- -----------------------------------------------------------------------------
-- PROBLEMA
-- -----------------------------------------------------------------------------
-- A coluna "Progresso %" do painel do gestor não mede leitura nem interação: ela
-- é autodeclaração pelo botão "Módulo Concluído" (`markChapterComplete` insere
-- uma linha em `sessions` com status 'completed' e chama o RPC
-- `update_enrollment_progress`). Quem clica sem ler fica com 100%, idêntico a
-- quem estudou. Não existe telemetria de slide, e o dado NÃO é reconstruível
-- retroativamente — a duração de `sessions` foi testada como proxy e é
-- inservível. Esta tabela começa a colher a série a partir da aplicação.
--
-- -----------------------------------------------------------------------------
-- DESENHO: MARCA D'ÁGUA, NÃO TRILHA
-- -----------------------------------------------------------------------------
-- Uma linha por par (aluno, capítulo), guardando apenas o MAIOR índice de slide
-- já alcançado. Não há linha por slide visto: a pergunta de produto é "ele
-- chegou ao fim do módulo?", e uma trilha slide a slide custaria duas ordens de
-- grandeza a mais em volume para responder perguntas que ninguém fez.
-- Revisitar slides anteriores não escreve nada.
--
-- Volume estimado no tenant demo: 129 usuários × 8 capítulos ≈ 1.000 linhas.
-- =============================================================================

BEGIN;

-- =============================================================
-- 1. Tabela
-- =============================================================

CREATE TABLE chapter_view_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Marca d'água: maior índice de slide alcançado (0-based, espelha o
  -- `currentIndex` do presentation-viewer). Monotônico — ver invariante I1.
  max_slide_index INTEGER NOT NULL DEFAULT 0 CHECK (max_slide_index >= 0),

  -- Snapshot do denominador no momento da última escrita. NÃO é diagnóstico
  -- apenas: por decisão de produto P2 (Hugo, 2026-07-30), quando diferir do
  -- total atual de slides do capítulo, a leitura expõe "há conteúdo novo desde
  -- a passagem deste aluno" — sem rebaixar quem já concluiu.
  slides_total_at_last_view INTEGER NOT NULL CHECK (slides_total_at_last_view > 0),

  -- O SINAL QUE IMPORTA. Nulo até o aluno alcançar o último slide. Uma vez
  -- gravado, nunca volta a ser nulo — ver invariante I2. É o curto-circuito que
  -- torna o percorrido do módulo estável contra edição posterior do capítulo
  -- (§5.1 e §5.3 do documento de arquitetura).
  reached_last_slide_at TIMESTAMPTZ,

  first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Uma linha por aluno por capítulo. É também o alvo do ON CONFLICT do upsert.
  UNIQUE (student_id, chapter_id)
);

COMMENT ON TABLE chapter_view_progress IS
  'Exposição por módulo (percorrido). Marca d''água do maior slide alcançado por aluno/capítulo. Mede passagem, NÃO atenção nem aprendizagem — ver docs/architecture/medicao-percorrido-vs-elaborado.md';

COMMENT ON COLUMN chapter_view_progress.reached_last_slide_at IS
  'Timestamp em que o aluno alcançou o último slide. Irreversível (trigger). Base do percorrido do curso.';

-- =============================================================
-- 2. Índices
-- =============================================================

-- Leitura do gestor: "neste capítulo, quem percorreu?" (§6, item 6)
CREATE INDEX idx_cvp_tenant_chapter ON chapter_view_progress(tenant_id, chapter_id);

-- Leitura por aluno dentro do tenant (linha da tabela do gestor, por pessoa)
CREATE INDEX idx_cvp_tenant_student ON chapter_view_progress(tenant_id, student_id);

-- Percorrido do CURSO = contagem de capítulos com reached_last_slide_at não
-- nulo (§5.2). Índice parcial: só as linhas completas entram, mantendo-o
-- pequeno e servindo exatamente à contagem que a leitura faz.
CREATE INDEX idx_cvp_completed ON chapter_view_progress(tenant_id, student_id)
  WHERE reached_last_slide_at IS NOT NULL;

-- =============================================================
-- 3. Invariantes — GARANTIDAS NO BANCO, não no cliente
-- =============================================================
-- MECANISMO ESCOLHIDO: trigger BEFORE UPDATE. Justificativa das alternativas:
--
--   CHECK constraint    → descartada. Não enxerga OLD, então é incapaz de
--                         expressar "não pode decrescer".
--   Função RPC de upsert → descartada como ÚNICA defesa. Protegeria apenas quem
--                         passasse por ela; as policies abaixo permitem UPDATE
--                         direto via PostgREST, que a contornaria. Uma invariante
--                         que depende do caminho escolhido não é invariante.
--   Trigger BEFORE UPDATE → ESCOLHIDA. Vale para TODO caminho de escrita,
--                         incluindo caminhos que ainda não existem. Poka-yoke:
--                         torna o estado errado inalcançável em vez de pedir
--                         disciplina a quem escreve.
--
-- COMPORTAMENTO: clamp silencioso, não exceção. Requisição fora de ordem é
-- condição NORMAL de rede (o cliente coalesce e faz flush por beacon), não erro
-- do cliente. Lançar exceção obrigaria o app a tratar algo que não é problema
-- dele e poluiria o log com ruído previsível.

CREATE OR REPLACE FUNCTION chapter_view_progress_invariants_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- I1: a marca d'água nunca decresce, mesmo com requisições fora de ordem.
  NEW.max_slide_index := GREATEST(NEW.max_slide_index, OLD.max_slide_index);

  -- I2: alcançar o fim é irreversível. Uma escrita posterior com valor nulo
  -- (ex.: aluno reabre o capítulo no slide 1) não apaga o fato histórico.
  NEW.reached_last_slide_at := COALESCE(OLD.reached_last_slide_at, NEW.reached_last_slide_at);

  -- I3: a primeira passagem é imutável.
  NEW.first_viewed_at := OLD.first_viewed_at;

  -- Carimbo de servidor: o cliente não dita quando a escrita aconteceu.
  NEW.last_viewed_at := now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER chapter_view_progress_invariants
  BEFORE UPDATE ON chapter_view_progress
  FOR EACH ROW
  EXECUTE FUNCTION chapter_view_progress_invariants_fn();

-- =============================================================
-- 4. RLS — uma policy POR COMANDO, nunca FOR ALL
-- =============================================================
-- Este repositório tem vazamento cross-tenant PROVADO por policies `FOR ALL`
-- sem recorte de tenant (`jr_super_admin`, `lt_super_admin`,
-- `super_admin_all_users`; o @qa apagou cargo de empresa alheia explorando
-- exatamente isso). Esta tabela nasce escopada, sem exceção.

ALTER TABLE chapter_view_progress ENABLE ROW LEVEL SECURITY;

-- Aluno lê o próprio percorrido.
CREATE POLICY "cvp_student_select" ON chapter_view_progress FOR SELECT
  USING (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  );

-- Aluno cria a própria linha.
--
-- ATENÇÃO, DEFEITO CONHECIDO NÃO REPETIDO AQUI: as policies irmãs de escrita do
-- aluno nasceram com `auth_user_role() = 'student'` e isso quebrou "visão de
-- aluno" para todo usuário com chapéu singular diferente de student
-- (corrigido em 20260729000000 e 20260729120000, cinco tabelas afetadas).
-- Esta policy JÁ NASCE sem esse predicado. Ninguém ganha escrita para
-- terceiros: o dono continua tendo de ser auth.uid(), dentro do próprio tenant.
CREATE POLICY "cvp_student_insert" ON chapter_view_progress FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  );

-- Aluno avança a própria marca d'água. O trigger da §3 impede regressão.
CREATE POLICY "cvp_student_update" ON chapter_view_progress FOR UPDATE
  USING (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  )
  WITH CHECK (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  );

-- Instrutor, gestor e admin leem o percorrido dentro do próprio tenant.
CREATE POLICY "cvp_content_role_select" ON chapter_view_progress FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('instructor', 'manager', 'admin')
  );

-- Líder lê apenas o percorrido de quem está nas próprias áreas.
-- Espelha `sr_leader_select` (20260518000000) para manter uma única semântica
-- de escopo hierárquico entre reflexão e percorrido.
CREATE POLICY "cvp_leader_select" ON chapter_view_progress FOR SELECT
  USING (
    auth_user_role() = 'leader'
    AND tenant_id = auth_tenant_id()
    AND (
      student_id = auth.uid()
      OR student_id IN (
        SELECT ua2.user_id
        FROM user_areas ua1
        JOIN user_areas ua2 ON ua1.area_id = ua2.area_id
        WHERE ua1.user_id = auth.uid()
      )
    )
  );

-- Super admin: SOMENTE LEITURA, e deliberadamente NÃO `FOR ALL`.
--
-- ROMPIMENTO CONSCIENTE COM O PADRÃO DO REPO: as tabelas irmãs criaram
-- `{prefixo}_super_admin ON ... FOR ALL USING (is_super_admin())`. Esse padrão
-- é a origem documentada da escalação cross-tenant. Super admin não tem nenhum
-- caso de uso para ESCREVER o percorrido de um aluno — auditar exige ler, não
-- gravar. Conceder apenas SELECT elimina a superfície sem custo funcional.
-- Se um dia houver necessidade real de escrita administrativa, ela deve nascer
-- como policy própria e escopada, não como `FOR ALL`.
CREATE POLICY "cvp_super_admin_select" ON chapter_view_progress FOR SELECT
  USING (is_super_admin());

COMMIT;

-- =============================================================================
-- APLICAÇÃO E VERIFICAÇÃO (para o @devops executar, após GO do Hugo)
-- =============================================================================
-- APLICAR: POST /v1/projects/vaguswivhqnlbgqvnjch/database/query com o corpo
-- desta migration, em transação única. NÃO usar `supabase db push` (motivo no
-- cabeçalho). NÃO rodar `supabase migration repair` às cegas: numa sessão
-- anterior a sugestão automática do CLI teria marcado uma migration como
-- aplicada SEM a tabela existir. Registrar em
-- `supabase_migrations.schema_migrations` somente DEPOIS de confirmar a
-- existência real da tabela.
--
-- VERIFICAR DEPOIS, nesta ordem:
--   1. Existência real: GET /rest/v1/chapter_view_progress?limit=1 → 200
--      (404 significa que a migration não pegou, independentemente do histórico).
--   2. Policies presentes e nenhuma FOR ALL:
--      SELECT policyname, cmd FROM pg_policy p
--      JOIN pg_class c ON c.oid = p.polrelid
--      WHERE c.relname = 'chapter_view_progress';
--      → esperado 6 linhas, cmd ∈ {SELECT, INSERT, UPDATE}, nenhum ALL.
--   3. PROVA DE ISOLAMENTO, com controle negativo obrigatório, dentro de
--      transação com ROLLBACK:
--        POSITIVO: INSERT como `authenticated` com jwt sub = aluno real do
--                  tenant, student_id = ele mesmo → ACEITO.
--        NEGATIVO: mesmo INSERT com student_id de um terceiro → 42501.
--        NEGATIVO: mesmo INSERT com tenant_id de OUTRO tenant → 42501.
--      O controle negativo não é opcional: sem ele, um "passou" pode significar
--      apenas que a RLS nunca foi aplicada (o role `postgres` ignora policies).
--   4. Invariante I1: UPDATE baixando max_slide_index de 10 para 3 → a linha
--      deve permanecer em 10, sem erro.
--   5. Invariante I2: UPDATE setando reached_last_slide_at = NULL numa linha
--      que já o tinha → deve permanecer preenchido.
--
-- ROLLBACK: DROP TRIGGER, DROP FUNCTION, DROP TABLE. Aditiva e isolada —
-- nenhuma tabela existente é alterada, então a remoção não afeta nada em uso.
-- =============================================================================
