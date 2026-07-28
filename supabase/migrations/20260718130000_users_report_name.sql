-- =============================================================================
-- users.report_name — nome de exibição padronizado (Hugo, 2026-07-18)
-- =============================================================================
-- Problema: full_name é inconsistente (às vezes só primeiro nome, ex. "Artur";
-- às vezes nome completo, ex. "Cintia de Cassia Santana") porque veio de um
-- seed batch digitado à mão. As tabelas de análise/engajamento precisam de um
-- nome de exibição padronizado e previsível.
--
-- report_name é DISTINTO de full_name (nome de cadastro). NULL = "não
-- padronizado ainda", e a UI faz fallback para full_name (report_name ??
-- full_name) no ponto de transformação mais alto (analytics/engajamento), nunca
-- espalhado pelos componentes-folha.
--
-- Coluna ADITIVA e nullable, sem default: nenhuma linha existente muda de
-- comportamento; o preenchimento é going-forward (cadastro) + backfill
-- controlado por tenant (scripts/backfill-cory-report-name.ts, escopado ao
-- tenant Cory, idempotente por report_name IS NULL, respeita deleted_at).
--
-- Sem índice: a coluna é lida por linha (junto do roster já filtrado por
-- tenant/role) e nunca usada como filtro de busca.
-- =============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS report_name TEXT;

COMMENT ON COLUMN public.users.report_name IS
  'Nome de exibição padronizado usado em relatórios e tabelas de análise/engajamento. Distinto de full_name (nome de cadastro). NULL = não padronizado ainda; a UI faz fallback para full_name. Preenchido no cadastro (going forward) e por backfill controlado por tenant.';
