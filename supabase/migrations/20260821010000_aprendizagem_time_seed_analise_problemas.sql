-- ===========================================================================
-- NEUTRALIZADA EM 2026-08-28 — SUPERSEDIDA POR
-- `20260828120000_aprendizagem_time_convergencia.sql` (bloco 9)
-- ===========================================================================
-- O QUE ESTE ARQUIVO FAZIA (conteúdo integral no histórico do git: introduzido
-- em `98240be`, íntegro em `d2b8083`, o HEAD imediatamente anterior a esta
-- neutralização — `git show d2b8083:supabase/migrations/<este-arquivo>`):
--
--   Semeava 5 capacidades e 21 critérios para o curso "Análise e Solução de
--   Problemas", com `ON CONFLICT (course_id, slug) DO UPDATE`.
--
-- POR QUE FOI NEUTRALIZADA — TRÊS RAZÕES INDEPENDENTES, cada uma bastante:
--
--   1. ORDEM. O timestamp deste arquivo (20260821010000) é MENOR que o da
--      migration que cria o schema convergido (20260828120000). Num terreno
--      virgem, num `db push`, este seed rodaria ANTES de a tabela existir. Um
--      seed que precede a tabela que semeia não é recuperável por idempotência
--      nenhuma — a única correção é ele passar a viver DEPOIS do schema, que é
--      onde ele está agora (bloco 9 da migration de convergência).
--
--   2. SLUG DIVERGENTE. Medido em produção, os 5 `capabilities.code` vivos são
--      `clareza_fenomeno`, `pensamento_causal`, `uso_evidencia`,
--      `construcao_contramedida`, `verificacao_eficacia`. Os slugs que este
--      seed pressupõe são `clareza-do-fenomeno`, `uso-de-evidencia`,
--      `construcao-de-contramedida`, `verificacao-de-eficacia` — ou seja, em
--      4 dos 5 casos o `ON CONFLICT (course_id, slug)` ERRARIA o alvo e
--      tentaria INSERIR capacidade duplicada em cima das 15 que já estão lá.
--
--   3. COLUNAS OBRIGATÓRIAS. O INSERT não fornece `code`, `name` nem
--      `focus_text`, que eram NOT NULL na tabela viva. Contra produção ele
--      falharia em 23502 antes mesmo de chegar ao ON CONFLICT.
--
-- O QUE MUDA NO SUBSTITUTO: o seed do bloco 9 da `20260828120000` é guardado
-- pelo ESTADO REAL, não por colisão de nome — só semeia curso que ainda não
-- tem capacidade alguma. Em produção, onde os 3 cursos homônimos já têm 5
-- capacidades cada, ele é integralmente no-op: nenhum título, nenhuma
-- descrição, nenhuma linha das 15 vivas é tocada.
-- ===========================================================================

DO $$
BEGIN
  RAISE NOTICE 'Aprendizagem do Time 20260821010000: NO-OP. Seed movido para o bloco 9 de 20260828120000_aprendizagem_time_convergencia.sql, onde roda DEPOIS do schema. Nenhuma alteração aplicada.';
END $$;
