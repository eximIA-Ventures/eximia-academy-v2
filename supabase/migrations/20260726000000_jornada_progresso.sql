-- ---------------------------------------------------------------------------
-- JRN-E — Jornada consciente do progresso (montar/revisar no MEIO do curso)
-- ---------------------------------------------------------------------------
-- Story: docs/stories/epic-jornada/JRN-E.story.md (Trilha E1, D6 + AC-E1.5/E1.7/E1.8)
-- Contrato: docs/stories/epic-jornada/contrato-progresso.md §4
--
-- ESTA MIGRATION NÃO FOI APLICADA POR NENHUM AGENTE (AC-E1.8 / R10 do épico).
-- O banco do .env.local é produção compartilhada. Aplicar exige GO explícito do
-- Hugo, idealmente contra branch/staging antes de produção.
--
-- Duas mudanças, ambas aditivas e reversíveis:
--
--  1. `baseline` (coluna NOVA, jsonb nullable) — a fotografia do progresso no
--     instante da PRIMEIRA confirmação da jornada. Sem ela, o dashboard credita
--     à jornada todo o trabalho que o aluno fez ANTES de montá-la: o aluno de
--     50% abre o anel já cheio de um mérito que o plano não produziu, nunca
--     existe "dia 0", e o ritmo aparece inflado (trabalho lifetime dividido por
--     ~0 semanas de jornada). Decisão D3 do Hugo, 2026-07-25.
--
--  2. `module_durations` muda de FORMA (não de tipo) — de `int[]` posicional
--     puro para `[{chapterId, days}]`. A coluna já é jsonb, então NÃO há DDL
--     para isso; o que muda aqui é o COMMENT, que era a única documentação da
--     forma antiga, e um backfill defensivo. Decisão D6.
--
-- Por que a forma antiga era uma bomba-relógio: o índice do array significava
-- "i-ésimo capítulo publicado por `order`". Publicar, despublicar ou reordenar
-- um capítulo deslizava TODAS as durações seguintes, em silêncio, e o aluno via
-- o próprio plano mudar sem nenhum erro na tela. `study_plans` tinha 0 linhas em
-- produção quando isto foi escrito (apurado por consulta direta, 2026-07-25):
-- trocar a forma é gratuito agora e caro depois do lançamento.
-- ---------------------------------------------------------------------------

-- 1) Ponto de partida (baseline) -------------------------------------------
ALTER TABLE study_plans
  ADD COLUMN IF NOT EXISTS baseline JSONB;

COMMENT ON COLUMN study_plans.baseline IS
  'JRN-E — fotografia do progresso na PRIMEIRA confirmação: {capturedAt, progressPct, sessionsDone, reflectionsDone, completedChapterIds[]}. Escrita UMA vez; revisar a jornada NÃO reescreve (senão o progresso feito dentro da jornada seria reabsorvido como "veio de antes"). NULL em jornadas anteriores ao JRN-E.';

-- 2) Durações ancoradas por capítulo ---------------------------------------
COMMENT ON COLUMN study_plans.module_durations IS
  'JRN-E — [{chapterId, days}] ANCORADO POR CAPÍTULO (era int[] posicional, que deslizava quando um capítulo era publicado/despublicado/reordenado). Módulo concluído = 0 dias exato; módulo vivo >= 4; soma dos vivos clampada à janela que RESTA (normalizeRemainingDurations). O leitor aceita as duas formas e reancora a antiga.';

-- Backfill defensivo: converte qualquer linha ainda no formato posicional para
-- a forma ancorada, casando a posição do array com a ordem publicada dos
-- capítulos do curso — exatamente o significado que o formato antigo tinha.
--
-- Esperado: 0 linhas afetadas (a tabela estava vazia quando isto foi escrito).
-- O bloco existe para o caso de alguma jornada ser gravada entre a escrita e a
-- aplicação desta migration. Idempotente: só toca linhas cujo primeiro elemento
-- NÃO é um objeto.
UPDATE study_plans sp
SET module_durations = anchored.value
FROM (
  SELECT
    p.id,
    COALESCE(
      jsonb_agg(
        jsonb_build_object('chapterId', ch.id, 'days', elem.value)
        ORDER BY elem.ord
      ),
      '[]'::jsonb
    ) AS value
  FROM study_plans p
  CROSS JOIN LATERAL jsonb_array_elements(p.module_durations) WITH ORDINALITY AS elem(value, ord)
  LEFT JOIN LATERAL (
    SELECT c.id
    FROM chapters c
    WHERE c.course_id = p.course_id
      AND c.status = 'published'
    ORDER BY c."order" ASC
    OFFSET (elem.ord - 1)
    LIMIT 1
  ) ch ON TRUE
  WHERE jsonb_typeof(p.module_durations) = 'array'
    AND jsonb_array_length(p.module_durations) > 0
    AND jsonb_typeof(p.module_durations -> 0) <> 'object'
    AND ch.id IS NOT NULL
  GROUP BY p.id
) AS anchored
WHERE sp.id = anchored.id;

-- ---------------------------------------------------------------------------
-- ROLLBACK (manual, se necessário):
--   ALTER TABLE study_plans DROP COLUMN IF EXISTS baseline;
--   -- module_durations: o leitor aceita as duas formas, então reverter o
--   -- COMMENT basta; não há perda de dado ao voltar ao código anterior, apenas
--   -- as durações voltam a ser lidas por posição.
-- ---------------------------------------------------------------------------
