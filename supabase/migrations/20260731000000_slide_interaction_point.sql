-- =============================================================================
-- Percorrido x Progressão — materializa "este slide é ponto de interação"
-- =============================================================================
-- STATUS: NÃO APLICADA. Escrita em 2026-07-31, aguardando GO do Hugo.
-- Projeto alvo: vaguswivhqnlbgqvnjch (eximia-academy — PRODUÇÃO COMPARTILHADA,
-- serve argos.eximiaacademy.com.br e 4 tenants reais, Cory Alimentos incluída).
--
-- Contrato: docs/architecture/percorrido-progressao-conclusao.md §3.2 e §3.3
--
-- APLICAR VIA MANAGEMENT API, NUNCA `supabase db push` (o histórico tem 12
-- migrations remote-only não reconciliadas). Instruções no rodapé.
--
-- -----------------------------------------------------------------------------
-- PROBLEMA
-- -----------------------------------------------------------------------------
-- "Este slide é um ponto de interação?" hoje é decidido por `isReflectionBlock`,
-- regex avaliada NO CLIENTE, em tempo de render. Serve para decidir se renderiza
-- um componente. NÃO serve como denominador de métrica que define quem concluiu
-- um treinamento corporativo: não é auditável (ninguém responde "quantos pontos
-- tem este capítulo?" sem renderizar a página), é instável (editar uma palavra
-- muda o denominador de todos, retroativamente e em silêncio) e teria de ser
-- reimplementada em cada consumidor.
--
-- =============================================================================
-- A DECISÃO MAIS IMPORTANTE DESTA MIGRATION: quem calcula o valor
-- =============================================================================
-- Alternativas avaliadas:
--
--   (A) TRIGGER replicando a heurística em SQL.
--       Pega todo caminho de escrita. DESCARTADA, e não por preferência de
--       estilo: a heurística NÃO roda sobre o slide, roda sobre cada BLOCKQUOTE
--       do markdown. Replicá-la em plpgsql exigiria PARSEAR MARKDOWN dentro do
--       banco para extrair os blockquotes antes de testar os cinco padrões
--       (incluindo classe de emoji com flag unicode). Isso é código que ninguém
--       consegue manter em sincronia com o TypeScript, e a divergência seria
--       SILENCIOSA — o pior tipo, porque o denominador erraria sem avisar.
--
--   (B) CÁLCULO NA APLICAÇÃO + comando de recálculo.
--       Lógica única, testável, sem divergência possível. Risco: um caminho de
--       escrita que não passe pela aplicação deixa o valor velho, também em
--       silêncio.
--
--   (C) ESCOLHIDA — (B), com o silêncio eliminado por um trigger que NÃO
--       replica heurística nenhuma.
--
-- O trigger abaixo faz uma única coisa: quando `text_content` muda, ele ZERA o
-- carimbo de cálculo. Ele não sabe o que é uma reflexão e não precisa saber.
-- Com isso:
--
--   · a heurística continua tendo UMA fonte, em TypeScript, testável;
--   · qualquer caminho de escrita — app, admin, script, SQL direto — invalida
--     o cálculo automaticamente;
--   · "valor velho" deixa de ser invisível e passa a ser CONSULTÁVEL
--     (`interaction_computed_at IS NULL` ⇒ precisa recalcular).
--
-- O dado carrega a própria validade em vez de fingir que está sempre certo.
-- =============================================================================

BEGIN;

-- =============================================================
-- 1. Colunas (aditivas em chapter_slides, tabela de 698 linhas)
-- =============================================================
-- Coluna dedicada e NÃO tabela própria: a cardinalidade é estritamente 1:1 com
-- o slide, o volume é pequeno, e uma tabela separada só acrescentaria um JOIN a
-- toda leitura sem ganhar nada. `metadata` (jsonb) foi descartado de propósito:
-- campo de métrica precisa ser indexável e auditável, não escondido num blob.

ALTER TABLE chapter_slides
  ADD COLUMN IF NOT EXISTS interaction_type TEXT
    CHECK (interaction_type IN ('reflection', 'quiz', 'assignment', 'scenario')),
  ADD COLUMN IF NOT EXISTS interaction_computed_at TIMESTAMPTZ;

COMMENT ON COLUMN chapter_slides.interaction_type IS
  'Ponto de interação deste slide. NULL = não é ponto. Calculado na APLICAÇÃO (fonte única da heurística), nunca no banco.';

COMMENT ON COLUMN chapter_slides.interaction_computed_at IS
  'Quando interaction_type foi calculado. NULL = STALE, precisa recalcular. O trigger zera isto sempre que text_content muda.';

-- =============================================================
-- 2. Índices — o denominador da §3.3 tem de ser barato
-- =============================================================
-- "Quantos pontos de interação tem este capítulo?" é a pergunta mais quente do
-- cálculo de progressão. Índice parcial: só as linhas que SÃO ponto entram,
-- mantendo-o pequeno (123 de 698 hoje).
CREATE INDEX IF NOT EXISTS idx_slides_interaction_point
  ON chapter_slides(chapter_id)
  WHERE interaction_type IS NOT NULL;

-- Fila de recálculo: encontrar o que está stale sem varrer a tabela.
CREATE INDEX IF NOT EXISTS idx_slides_interaction_stale
  ON chapter_slides(tenant_id)
  WHERE interaction_computed_at IS NULL;

-- =============================================================
-- 3. Trigger de INVALIDAÇÃO (não de cálculo)
-- =============================================================
-- Repare no que ele NÃO faz: não testa regex, não conhece "reflexão", não
-- parseia markdown. Ele só declara que o cálculo anterior não vale mais.
-- É por isso que ele não pode divergir do TypeScript: não há o que divergir.

CREATE OR REPLACE FUNCTION chapter_slides_invalidate_interaction_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- `IS DISTINCT FROM` cobre NULL nos dois lados sem caso especial.
  IF NEW.text_content IS DISTINCT FROM OLD.text_content THEN
    NEW.interaction_computed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chapter_slides_invalidate_interaction ON chapter_slides;
CREATE TRIGGER chapter_slides_invalidate_interaction
  BEFORE UPDATE ON chapter_slides
  FOR EACH ROW
  EXECUTE FUNCTION chapter_slides_invalidate_interaction_fn();

-- =============================================================
-- 4. RLS — nada a criar, e a razão importa
-- =============================================================
-- `chapter_slides` JÁ tem RLS com quatro policies POR COMANDO
-- (chapter_slides_select/insert/update/delete, migration 20260314000000).
-- Colunas novas herdam essas policies automaticamente: RLS no Postgres é por
-- LINHA, não por coluna. Quem já podia ler o slide passa a ler o campo novo;
-- quem já podia atualizá-lo passa a poder atualizar o campo.
--
-- NENHUMA policy `FOR ALL` é criada aqui. (As menções a "FOR ALL" neste arquivo
-- são todas em comentário, explicando por que o padrão é evitado — ele é a
-- origem documentada da escalação cross-tenant que o @qa provou neste repo.)
--
-- Consequência aceita e registrada: quem tem UPDATE em `chapter_slides` (autor
-- de conteúdo) pode escrever `interaction_type` à mão. Isso é coerente — é o
-- mesmo papel que edita o texto de onde o valor deriva — e o trigger de
-- invalidação continua valendo se o texto mudar depois.

-- =============================================================
-- 5. População inicial: deixar TUDO stale, de propósito
-- =============================================================
-- As 698 linhas nascem com interaction_computed_at NULL, que é exatamente o
-- estado "precisa calcular". Não há UPDATE de dado aqui: quem calcula é a
-- aplicação (§decisão C), e o comando de recálculo (etapa 3) vai varrer a fila
-- de stale e preencher. Idempotente por construção — rodar esta migration duas
-- vezes não muda nada, porque `ADD COLUMN IF NOT EXISTS` e os índices são
-- condicionais.

COMMIT;

-- =============================================================================
-- APLICAÇÃO E VERIFICAÇÃO (para o @devops, após GO do Hugo)
-- =============================================================================
-- APLICAR: POST /v1/projects/vaguswivhqnlbgqvnjch/database/query com o corpo
-- desta migration. Token no Keychain do macOS, serviço `mission-control-supabase`
-- (NÃO "Supabase CLI", que é envelope do go-keyring e devolve 401). Use `curl`;
-- o urllib do Python falha com CERTIFICATE_VERIFY_FAILED neste host.
-- NUNCA `supabase db push`.
--
-- VERIFICAR, nesta ordem:
--   1. Colunas existem:
--      SELECT column_name FROM information_schema.columns
--       WHERE table_name='chapter_slides'
--         AND column_name IN ('interaction_type','interaction_computed_at');
--      → esperado 2 linhas.
--
--   2. Tudo nasce stale (é o correto, não um erro):
--      SELECT COUNT(*) FILTER (WHERE interaction_computed_at IS NULL) AS stale,
--             COUNT(*) AS total FROM chapter_slides;
--      → esperado stale = total = 698.
--
--   3. O CHECK recusa tipo inválido:
--      dentro de transação com ROLLBACK, UPDATE chapter_slides
--        SET interaction_type='xpto' WHERE id = (SELECT id FROM chapter_slides LIMIT 1);
--      → esperado 23514 (violação de check).
--
--   4. O trigger invalida de verdade — o teste que importa:
--      dentro de transação com ROLLBACK:
--        UPDATE chapter_slides SET interaction_type='reflection',
--               interaction_computed_at=now() WHERE id = <um id real>;
--        UPDATE chapter_slides SET text_content = text_content || ' x'
--         WHERE id = <o mesmo id>;
--        SELECT interaction_computed_at FROM chapter_slides WHERE id = <o mesmo id>;
--      → esperado NULL (o texto mudou, o cálculo caducou).
--
--   5. Índices presentes:
--      SELECT indexname FROM pg_indexes WHERE tablename='chapter_slides'
--       AND indexname LIKE 'idx_slides_interaction%';
--      → esperado 2.
--
--   6. Só então registrar em supabase_migrations.schema_migrations, e apenas
--      DEPOIS de confirmar que as colunas existem de verdade.
--
-- ROLLBACK: DROP TRIGGER, DROP FUNCTION, DROP INDEX (x2), ALTER TABLE DROP
-- COLUMN (x2). Estritamente aditiva — nenhuma coluna ou policy existente é
-- alterada, então a remoção não afeta nada em uso.
-- =============================================================================
