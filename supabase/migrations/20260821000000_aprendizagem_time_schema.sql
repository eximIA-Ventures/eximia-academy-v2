-- ===========================================================================
-- NEUTRALIZADA EM 2026-08-28 — SUPERSEDIDA POR
-- `20260828120000_aprendizagem_time_convergencia.sql`
-- ===========================================================================
-- O QUE ESTE ARQUIVO FAZIA (conteúdo integral no histórico do git: introduzido
-- em `98240be`, íntegro em `d2b8083`, o HEAD imediatamente anterior a esta
-- neutralização — `git show d2b8083:supabase/migrations/<este-arquivo>`):
--
--   Criava as 8 tabelas do domínio "Aprendizagem do Time" (`concepts`,
--   `capabilities`, `capability_concepts`, `capability_criteria`,
--   `capability_evidence`, `capability_assessments`,
--   `capability_assessment_evidence`, `capability_assessment_criteria`), os
--   índices de dedup e a RLS de leitura, supondo TERRENO VAZIO.
--
-- POR QUE FOI NEUTRALIZADA, E NÃO CORRIGIDA NO LUGAR:
--
--   O terreno nunca esteve vazio. `capabilities` (15 linhas),
--   `capability_criteria` (63) e `capability_evidence` (853) já existiam em
--   produção com OUTRO formato. Contra esse terreno este arquivo FALHA de
--   forma dura, porque cria índice sobre `source_table`, coluna que a tabela
--   viva não tem — e o `BEGIN;`/`COMMIT;` explícito derruba tudo junto.
--
--   Medido em PGlite (Postgres real) contra uma réplica do schema vivo, a
--   primeira pedra é ainda anterior: `relation "idx_capability_criteria_capability"
--   already exists`, porque os `CREATE INDEX` deste arquivo não são guardados.
--   O veredito é o mesmo por qualquer caminho: não roda em produção.
--
--   Corrigi-la no lugar não resolveria nada, porque a migration seguinte
--   (`20260825220000`) falha no terreno oposto — o par é MUTUAMENTE EXCLUSIVO
--   POR TERRENO. A correção só existe como um alvo único convergido, que é
--   exatamente o que a `20260828120000` é.
--
-- ESTE ARQUIVO PERMANECE NA ÁRVORE, e não é apagado, porque um número de
-- versão que some do diretório vira uma lacuna inexplicável para quem auditar
-- o histórico depois. Ele agora é um no-op declarado, não um no-op silencioso.
-- ===========================================================================

DO $$
BEGIN
  RAISE NOTICE 'Aprendizagem do Time 20260821000000: NO-OP. Supersedida por 20260828120000_aprendizagem_time_convergencia.sql (par mutuamente exclusivo por terreno). Nenhuma alteração aplicada.';
END $$;
