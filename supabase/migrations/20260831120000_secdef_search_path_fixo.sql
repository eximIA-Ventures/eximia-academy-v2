-- Fixar `search_path` nas 10 funções `SECURITY DEFINER` que não o fixavam.
--
-- O PROBLEMA (inventário, achado 7)
-- Das 31 funções `SECURITY DEFINER` de `public`, 10 tinham `pg_proc.proconfig`
-- vazio — isto é, resolviam nomes pelo `search_path` de QUEM CHAMA. Uma função
-- `SECURITY DEFINER` roda com os privilégios do DONO; se quem chama controla o
-- `search_path`, ele controla PARA QUAL OBJETO cada nome não qualificado resolve.
-- Criando um `meu_schema.users` e pondo `meu_schema` na frente do caminho, a
-- função passa a ler a tabela do atacante — executando como o dono. É o vetor
-- clássico de escalada em Postgres.
--
-- POR QUE ESTAS 10 IMPORTAM MAIS QUE A CONTAGEM SUGERE
-- Três delas — `auth_tenant_id`, `auth_user_role`, `auth_user_area_ids` — são a
-- base de decisão de quase toda política de RLS deste banco. Quem controlasse a
-- resolução de nomes dentro de `auth_tenant_id` controlaria o veredito de tenant
-- de praticamente todas as 324 políticas de uma vez. Não é uma função exposta a
-- mais; é o alicerce.
--
-- ALCANCE HOJE, DECLARADO COM HONESTIDADE
-- Pelo PostgREST o `search_path` é fixado pela configuração do serviço, não pelo
-- chamador — então **não há vetor conhecido por aquela porta hoje**. Isto é
-- endurecimento contra qualquer caminho FUTURO que consiga definir `search_path`:
-- job interno, ferramenta de manutenção, conexão direta ao Postgres, ou uma função
-- nova que chame estas. Fecha-se agora porque é barato agora.
--
-- POR QUE `ALTER FUNCTION ... SET`, E NÃO `CREATE OR REPLACE`
-- `ALTER FUNCTION ... SET search_path` anexa uma configuração à função e **não
-- toca no corpo nem na assinatura nem na ACL**. É a correção de menor risco
-- possível: nenhuma linha de lógica muda, nenhum privilégio muda, nada a revisar
-- em diff de corpo. Reescrever as 10 com `CREATE OR REPLACE` seria arriscar
-- regressão de comportamento para obter o mesmo efeito.
--
-- POR QUE `= public`, E POR QUE SEM `extensions` NEM `pg_temp`
-- Verificado nos corpos das 10 antes de escolher o valor:
--   * a ÚNICA referência a outro schema é `auth.uid()`, em 3 delas, e está
--     **qualificada** — nome qualificado não depende de `search_path`;
--   * nenhuma chamada não qualificada a função de extensão (`gen_random_uuid`,
--     `crypt`, `digest`, `gen_salt`, `pgp_*`, `unaccent`, `similarity`): 0
--     ocorrências. Logo `extensions` no caminho seria ruído sem função;
--   * nenhuma menção a `TEMP`/`TEMPORARY`: 0 ocorrências. Logo `pg_temp` é
--     dispensável — e omiti-lo é o mais seguro, porque `pg_temp` no caminho
--     reabre parcialmente a mesma porta (o chamador cria objetos temporários e
--     eles passam a poder resolver nomes que `public` não tenha).
-- `pg_catalog` é implicitamente o primeiro do caminho, sempre, então os
-- built-ins continuam resolvendo.
--
-- REVERSÃO (por função)
--   ALTER FUNCTION public.<nome>(<args>) RESET search_path;

BEGIN;

-- Base de decisão da RLS — as três mais críticas do conjunto.
ALTER FUNCTION public.auth_tenant_id()                       SET search_path = public;
ALTER FUNCTION public.auth_user_role()                       SET search_path = public;
ALTER FUNCTION public.auth_user_area_ids()                   SET search_path = public;

-- As três que escrevem e recebem o alvo por parâmetro (achado 1, já contidas
-- quanto a `anon` por `20260831100000`; aqui fecha-se o outro flanco delas).
ALTER FUNCTION public.jsonb_profile_merge(uuid, text, text, text) SET search_path = public;
ALTER FUNCTION public.lgpd_soft_delete_user(uuid)                 SET search_path = public;
ALTER FUNCTION public.swap_onboarding_course(uuid, uuid)          SET search_path = public;

-- Restantes.
ALTER FUNCTION public.claim_session_turn(uuid, uuid)         SET search_path = public;
ALTER FUNCTION public.release_session_turn(uuid, uuid)       SET search_path = public;
ALTER FUNCTION public.get_random_active_question(uuid)       SET search_path = public;
ALTER FUNCTION public.update_enrollment_progress(uuid, uuid) SET search_path = public;

COMMIT;
