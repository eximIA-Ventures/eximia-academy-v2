-- ===========================================================================
-- NEUTRALIZADA EM 2026-08-28 — SUPERSEDIDA POR
-- `20260828120000_aprendizagem_time_convergencia.sql`
-- ===========================================================================
-- O QUE ESTE ARQUIVO FAZIA (conteúdo integral no histórico do git: introduzido
-- em `5c3c57b`, íntegro em `d2b8083`, o HEAD imediatamente anterior a esta
-- neutralização — `git show d2b8083:supabase/migrations/<este-arquivo>`):
--
--   Reconciliação aditiva contra o terreno ocupado: adicionava às 3 tabelas
--   existentes as colunas que a camada de leitura pede, preenchia-as a partir
--   das equivalentes legadas, criava as 5 tabelas faltantes e ligava a RLS.
--   A intenção estava certa; a execução tinha três defeitos.
--
-- POR QUE FOI NEUTRALIZADA:
--
--   1. NÃO RODA EM TERRENO VIRGEM. Ela lê `capabilities.code`, `.name`,
--      `."order"` e `capability_evidence.category`, `.observed_at` — colunas
--      que só existem no schema LEGADO e que a `20260821000000` nunca cria.
--      Verificado em PGlite (Postgres real): em terreno virgem falha com
--      `column "code" does not exist`. Somado ao fato de a `20260821000000`
--      falhar em terreno ocupado, o par é MUTUAMENTE EXCLUSIVO POR TERRENO:
--      não existia sequência capaz de levantar este schema em lugar nenhum.
--
--   2. TRADUÇÃO CONTRA RÓTULOS QUE NÃO EXISTEM. O `CASE category` mapeava
--      `'aplicacao'` e `'contexto_real'`. O CHECK vivo, lido de `pg_constraint`
--      em produção, admite `'cognitiva'`, `'aplicada'`, `'real'`. Os dois
--      rótulos supostos não pertencem ao domínio, então esses ramos nunca
--      casariam e a coluna ficaria NULL para sempre — um backfill que parece
--      ter rodado e não preencheu nada.
--
--   3. NÃO DESTRAVAVA O `upsert`, que era o objetivo declarado. Faltavam três
--      correções que só a convergência traz: o índice único árbitro do
--      `ON CONFLICT` (ausente aqui), o relaxamento dos NOT NULL de
--      `criterion_id`/`category`/`observed_at` (que o payload não fornece), e a
--      ampliação do CHECK de `source_type`, que só admite o vocabulário em
--      português enquanto o pipeline escreve em inglês. Com esta migration
--      aplicada e mais nada, o `upsert` continuaria falhando — por 23502 e
--      23514 em vez de 42703.
--
-- ESTE ARQUIVO PERMANECE NA ÁRVORE como no-op declarado, não silencioso.
-- ===========================================================================

DO $$
BEGIN
  RAISE NOTICE 'Aprendizagem do Time 20260825220000: NO-OP. Supersedida por 20260828120000_aprendizagem_time_convergencia.sql. Nenhuma alteração aplicada.';
END $$;
