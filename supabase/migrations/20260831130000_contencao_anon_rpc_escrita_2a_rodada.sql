-- Segunda rodada de contenção: as demais `SECURITY DEFINER` alcançáveis por `anon`
-- que ESCREVEM. Mesmo mecanismo de `20260831100000` (DEFAULT ACL do Supabase),
-- conjunto diferente.
--
-- COMO ESTE CONJUNTO FOI DELIMITADO, E POR QUE AS CONTAGENS DIVERGIRAM
-- Duas medições independentes deram 4 e 5. Nenhuma das duas estava completa: são
-- **6** funções `SECURITY DEFINER` alcançáveis por `anon` cujo corpo escreve, e
-- elas se dividem em DUAS classes que exigem tratamento diferente. O discriminante
-- é o tipo de retorno (`pg_proc.prorettype = 'trigger'`), não o nome:
--
--   classe A — chamáveis por RPC (4). O PostgREST as expõe; são vetor real.
--     claim_session_turn(uuid,uuid)          record
--     release_session_turn(uuid,uuid)        void
--     update_enrollment_progress(uuid,uuid)  record
--     recompute_primary_role(uuid)           void
--
--   classe B — funções de GATILHO (2 que escrevem, +1 guarda que só valida).
--     trg_recompute_primary_role()   trigger   @ user_roles
--     users_reports_to_guard()       trigger   @ users
--     manager_groups_parent_guard()  trigger   @ manager_groups   (só valida)
--
-- Uma contagem viu 4 (só a classe A), a outra viu 5 (classe A + `users_reports_to_guard`,
-- sem `trg_recompute_primary_role`). A divergência era de critério, como suspeitado —
-- e o critério certo separa as classes em vez de somá-las.
--
-- MEDIÇÃO DA CLASSE A, com a chave anon, por `GET` (nunca `POST`):
--   claim_session_turn          405 + 25006 "cannot execute SELECT FOR UPDATE in a read-only transaction"
--   release_session_turn        405 + 25006
--   update_enrollment_progress  405 + 25006
--   recompute_primary_role      **204 — executou de fato**
-- Nas três primeiras o corpo RODOU e só o verbo `GET` barrou: por `POST` executam.
-- A quarta não encontrou barreira alguma. (O parâmetro dela é `_uid`, não
-- `p_user_id`; com o nome errado o PostgREST devolve `404 PGRST202` e a sonda dá
-- um falso "fechado" — foi o que aconteceu na primeira tentativa desta medição.)
--
-- MEDIÇÃO DA CLASSE B: as três devolvem `404 PGRST202`. **O PostgREST não expõe
-- função que retorna `trigger`**, então elas nunca foram vetor de RPC. O `EXECUTE`
-- de `anon` sobre elas é resíduo do DEFAULT ACL, não porta aberta.
--
-- POR QUE REVOGAR DA CLASSE B MESMO ASSIM, E POR QUE ISSO NÃO QUEBRA O GATILHO
-- É higiene: `EXECUTE` que não serve a ninguém não deve existir, e assim a próxima
-- varredura não precisa reclassificar estas três do zero. **Não quebra nada**
-- porque o PostgreSQL checa `EXECUTE` sobre a função de gatilho no momento do
-- `CREATE TRIGGER`, não a cada disparo: o gatilho dispara independentemente do
-- privilégio de quem fez a escrita que o acionou.
--
-- POR QUE `authenticated` SAI DE `recompute_primary_role` — E O QUE FOI PRECISO
-- CONFERIR ANTES
-- Ela não tem chamador nenhum na aplicação (`grep` por `rpc(` → 0 sítios). Quem a
-- chama é a função de gatilho `trg_recompute_primary_role()`. O risco era: se esse
-- gatilho fosse `SECURITY INVOKER`, a chamada interna correria com o papel de quem
-- escreveu em `user_roles`, e revogar de `authenticated` quebraria o caminho
-- legítimo. **Medido antes de revogar:**
--     trg_recompute_primary_role()  dono=postgres  prosecdef=TRUE
-- Sendo `SECURITY DEFINER` de `postgres`, a chamada interna é autorizada como
-- `postgres`, que mantém `EXECUTE`. O gatilho segue funcionando. Não foi suposto.
--
-- POR QUE `authenticated` PERMANECE NAS OUTRAS TRÊS — chamadores conferidos:
--   claim_session_turn         apps/web/src/app/api/sessions/[sessionId]/messages/route.ts:56
--   release_session_turn       …/messages/route.ts:360
--       ambas por `createClient()` (sessão do aluno) → papel `authenticated`.
--       É o turno da sessão socrática: caminho legítimo do produto.
--   update_enrollment_progress 2 sítios `authenticated`
--       ((platform)/courses/[courseId]/chapters/[chapterId]/actions.ts:126 e
--        …/session/actions.ts:13) + 1 `service_role` (…/messages/route.ts:275).
-- Revogar de `authenticated` aqui derrubaria progresso de matrícula e turno de
-- sessão. `anon` não tem chamador em nenhuma das três.
--
-- `PUBLIC` **e** `anon` são nomeados nos dois casos: `=X/postgres` é `PUBLIC` (do
-- qual `anon` herda) e `anon=X/postgres` é concessão nominal (que sobrevive ao
-- revogue de `PUBLIC`). Revogar só um dos dois fecha pela metade e parece fechado.
--
-- RISCO RESIDUAL, DECLARADO: `update_enrollment_progress` continua sem conferir o
-- CHAMADOR — um aluno logado ainda pode mexer no progresso de outro passando o
-- UUID dele. Isso não se fecha por privilégio sem derrubar o produto; fecha-se com
-- guarda no corpo. Fora do escopo desta migration, que só mexe em privilégio.
--
-- REVERSÃO
--   GRANT EXECUTE ON FUNCTION public.claim_session_turn(uuid,uuid)         TO anon;
--   GRANT EXECUTE ON FUNCTION public.release_session_turn(uuid,uuid)       TO anon;
--   GRANT EXECUTE ON FUNCTION public.update_enrollment_progress(uuid,uuid) TO anon;
--   GRANT EXECUTE ON FUNCTION public.recompute_primary_role(uuid)          TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.trg_recompute_primary_role()          TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.users_reports_to_guard()              TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.manager_groups_parent_guard()         TO anon, authenticated;

BEGIN;

-- ---------------------------------------------------------------------------
-- Classe A.1 — vetor real, `authenticated` é caminho legítimo do produto.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.claim_session_turn(uuid, uuid)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.release_session_turn(uuid, uuid)       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_enrollment_progress(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.claim_session_turn(uuid, uuid)         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_session_turn(uuid, uuid)       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_enrollment_progress(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Classe A.2 — executava de fato (`204`) e não tem chamador na aplicação.
-- Só o gatilho a chama, e ele é SECURITY DEFINER de `postgres` (medido acima).
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.recompute_primary_role(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.recompute_primary_role(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Classe B — funções de gatilho. Não expostas pelo PostgREST; o revogue é
-- higiene e não afeta o disparo (privilégio é checado no CREATE TRIGGER).
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.trg_recompute_primary_role()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.users_reports_to_guard()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.manager_groups_parent_guard() FROM PUBLIC, anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
