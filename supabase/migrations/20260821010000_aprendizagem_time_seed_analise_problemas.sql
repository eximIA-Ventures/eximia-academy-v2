-- Seed de capacidades — curso "Análise e Solução de Problemas" (§27 da spec
-- Aprendizagem do Time). Só este curso recebe capacidades reais nesta
-- passada: é o único nomeado na especificação funcional. Qualquer outro
-- curso permanece SEM capacidades até que o time de currículo defina as
-- dele — nunca inventadas em runtime (§28: "a IA não pode inventar
-- critério dinamicamente").
--
-- CRITÉRIOS: os 5 de "Uso de evidência" são TEXTO LITERAL da spec (§28). Os
-- das outras 4 capacidades são INFERIDOS a partir do vocabulário usado em
-- §21/§22/§32/§36 da mesma spec (ex.: "Delimitação", "Relação causa-ação",
-- "Indicador e meta", "Contenção x contramedida") — precisam de validação do
-- dono de currículo/pedagogia antes de virarem critério de produção. Estão
-- aqui para o pipeline ter algo determinístico para avaliar contra, não como
-- afirmação de que são os critérios finais.
--
-- IDEMPOTENTE: pode rodar de novo sem duplicar (ON CONFLICT DO UPDATE) e é um
-- no-op silencioso (com aviso) se o curso ainda não existir no ambiente —
-- não falha o `db push` de um ambiente que não tenha esse curso semeado.

BEGIN;

DO $$
DECLARE
  v_course_id uuid;
  v_tenant_id uuid;
  v_cap_clareza uuid;
  v_cap_causal uuid;
  v_cap_evidencia uuid;
  v_cap_contramedida uuid;
  v_cap_eficacia uuid;
BEGIN
  SELECT id, tenant_id INTO v_course_id, v_tenant_id
  FROM public.courses
  WHERE title = 'Análise e Solução de Problemas'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_course_id IS NULL THEN
    RAISE NOTICE 'Seed Aprendizagem do Time: curso "Análise e Solução de Problemas" não encontrado — nenhuma capacidade semeada neste ambiente. Rode esta migration de novo (ou um seed avulso) quando o curso existir.';
    RETURN;
  END IF;

  INSERT INTO public.capabilities (tenant_id, course_id, slug, title, description, display_order)
  VALUES (v_tenant_id, v_course_id, 'clareza-do-fenomeno', 'Clareza do fenômeno',
    'Descrever o problema com precisão observável, sem confundir sintoma com causa.', 1)
  ON CONFLICT (course_id, slug) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description
  RETURNING id INTO v_cap_clareza;

  INSERT INTO public.capabilities (tenant_id, course_id, slug, title, description, display_order)
  VALUES (v_tenant_id, v_course_id, 'pensamento-causal', 'Pensamento causal',
    'Identificar causa raiz e articular a cadeia causal até o fenômeno observado.', 2)
  ON CONFLICT (course_id, slug) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description
  RETURNING id INTO v_cap_causal;

  INSERT INTO public.capabilities (tenant_id, course_id, slug, title, description, display_order)
  VALUES (v_tenant_id, v_course_id, 'uso-de-evidencia', 'Uso de evidência',
    'Sustentar hipóteses e conclusões com dados e observação, não com opinião.', 3)
  ON CONFLICT (course_id, slug) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description
  RETURNING id INTO v_cap_evidencia;

  INSERT INTO public.capabilities (tenant_id, course_id, slug, title, description, display_order)
  VALUES (v_tenant_id, v_course_id, 'construcao-de-contramedida', 'Construção de contramedida',
    'Propor ação que ataca a causa raiz identificada, não apenas conter o sintoma.', 4)
  ON CONFLICT (course_id, slug) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description
  RETURNING id INTO v_cap_contramedida;

  INSERT INTO public.capabilities (tenant_id, course_id, slug, title, description, display_order)
  VALUES (v_tenant_id, v_course_id, 'verificacao-de-eficacia', 'Verificação de eficácia',
    'Definir indicador e meta antes de agir, e verificar se a ação funcionou de fato.', 5)
  ON CONFLICT (course_id, slug) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description
  RETURNING id INTO v_cap_eficacia;

  -- Clareza do fenômeno (critérios inferidos — ver nota de topo)
  INSERT INTO public.capability_criteria (tenant_id, capability_id, code, description, display_order) VALUES
    (v_tenant_id, v_cap_clareza, 'CF-1', 'Delimita o escopo do problema (o quê, onde, quando, quanto)', 1),
    (v_tenant_id, v_cap_clareza, 'CF-2', 'Diferencia sintoma de causa na própria descrição do fenômeno', 2),
    (v_tenant_id, v_cap_clareza, 'CF-3', 'Descreve o fenômeno com dado observável, não com generalização vaga', 3),
    (v_tenant_id, v_cap_clareza, 'CF-4', 'Evita atribuir causa antes de descrever o fenômeno com precisão', 4)
  ON CONFLICT (capability_id, code) DO UPDATE SET description = EXCLUDED.description;

  -- Pensamento causal (critérios inferidos)
  INSERT INTO public.capability_criteria (tenant_id, capability_id, code, description, display_order) VALUES
    (v_tenant_id, v_cap_causal, 'PC-1', 'Distingue causa raiz de sintoma', 1),
    (v_tenant_id, v_cap_causal, 'PC-2', 'Articula a cadeia causal (encadeia "por quê" até a raiz)', 2),
    (v_tenant_id, v_cap_causal, 'PC-3', 'Conecta a causa identificada de volta ao fenômeno descrito', 3),
    (v_tenant_id, v_cap_causal, 'PC-4', 'Considera causas concorrentes em vez de fixar em uma única', 4)
  ON CONFLICT (capability_id, code) DO UPDATE SET description = EXCLUDED.description;

  -- Uso de evidência — TEXTO LITERAL da spec §28
  INSERT INTO public.capability_criteria (tenant_id, capability_id, code, description, display_order) VALUES
    (v_tenant_id, v_cap_evidencia, 'UE-1', 'Diferencia fato de opinião', 1),
    (v_tenant_id, v_cap_evidencia, 'UE-2', 'Sustenta hipótese com dados', 2),
    (v_tenant_id, v_cap_evidencia, 'UE-3', 'Referencia observação', 3),
    (v_tenant_id, v_cap_evidencia, 'UE-4', 'Valida conclusão', 4),
    (v_tenant_id, v_cap_evidencia, 'UE-5', 'Evita inferência sem evidência', 5)
  ON CONFLICT (capability_id, code) DO UPDATE SET description = EXCLUDED.description;

  -- Construção de contramedida (critérios inferidos)
  INSERT INTO public.capability_criteria (tenant_id, capability_id, code, description, display_order) VALUES
    (v_tenant_id, v_cap_contramedida, 'CC-1', 'Diferencia contenção (paliativo) de contramedida (ataca a causa raiz)', 1),
    (v_tenant_id, v_cap_contramedida, 'CC-2', 'Propõe ação diretamente ligada à causa identificada', 2),
    (v_tenant_id, v_cap_contramedida, 'CC-3', 'Define responsável e prazo da ação proposta', 3),
    (v_tenant_id, v_cap_contramedida, 'CC-4', 'Antecipa efeito colateral ou risco da ação proposta', 4)
  ON CONFLICT (capability_id, code) DO UPDATE SET description = EXCLUDED.description;

  -- Verificação de eficácia (critérios inferidos)
  INSERT INTO public.capability_criteria (tenant_id, capability_id, code, description, display_order) VALUES
    (v_tenant_id, v_cap_eficacia, 'VE-1', 'Define indicador mensurável antes de agir', 1),
    (v_tenant_id, v_cap_eficacia, 'VE-2', 'Estabelece meta ou critério de sucesso', 2),
    (v_tenant_id, v_cap_eficacia, 'VE-3', 'Compara resultado real contra a meta definida', 3),
    (v_tenant_id, v_cap_eficacia, 'VE-4', 'Revisa a ação quando o indicador não melhora', 4)
  ON CONFLICT (capability_id, code) DO UPDATE SET description = EXCLUDED.description;
END $$;

COMMIT;
