-- Guarda de CHAMADOR em `update_enrollment_progress` — a última das funções que
-- escreviam recebendo a identidade do alvo por parâmetro sem conferir quem chama.
--
-- O QUE ISTO FECHA
-- `20260831130000` tirou `anon` desta função, mas `authenticated` teve de
-- permanecer: progresso de matrícula é caminho quente do aluno. Restava o buraco
-- que privilégio nenhum alcança — um aluno logado passava o UUID de outro e
-- reescrevia o `progress` e o `status` da matrícula alheia, inclusive levando-a a
-- `completed`, o que dispara emissão automática de certificado no chamador.
--
-- =============================================================================
-- CENSO DOS CHAMADORES — 3 sítios, varredura ampla, argumento lido no sítio
-- =============================================================================
--  #  sítio                                                              papel          p_student_id  guarda afeta?
--  1  (platform)/courses/[courseId]/chapters/[chapterId]/actions.ts:126  authenticated  user.id       NÃO (é self)
--  2  (platform)/courses/[courseId]/chapters/[chapterId]/session/actions.ts:13
--                                                                       authenticated  user.id       NÃO (é self)
--  3  api/sessions/[sessionId]/messages/route.ts:275                     service_role   user.id       NÃO (auth.uid() é NULL)
--
-- Os três passam `user.id` obtido de `auth.getUser()` na própria função. **Nenhum
-- sítio atualiza progresso de terceiro** — não há gestor marcando conclusão de
-- aluno por esta porta, que era a condição de parada do briefing. Verificado por
-- varredura ampla (`*.ts`, `*.tsx`, `*.js`, `*.mjs`), não apenas nos caminhos
-- esperados: foi omitindo essa varredura que um 13º sítio de `jsonb_profile_merge`
-- escapou de um censo anterior.
--
-- =============================================================================
-- POR QUE **NÃO** HÁ ISENÇÃO DE `super_admin` AQUI
-- =============================================================================
-- Em `swap_onboarding_course` a isenção foi obrigatória, porque lá a comparação é
-- por TENANT e o super_admin tem `users.tenant_id` **NULO** — a guarda o bloquearia
-- em 100% dos casos. Aqui a comparação é de USUÁRIO com USUÁRIO
-- (`auth.uid() <> p_student_id`), e o censo não encontrou nenhum caminho em que um
-- super_admin (ou admin, ou gestor) atualize o progresso de um aluno sob sessão
-- própria. Acrescentar a isenção sem esse caminho existir afrouxaria a guarda em
-- troca de nada.
--
-- **A válvula de escape, se esse caminho for construído no futuro:** qualquer
-- ferramenta administrativa que precise mexer no progresso de terceiro deve usar o
-- `service_role`, exatamente como o sítio 3 já faz — ali `auth.uid()` é NULL e a
-- guarda não dispara. Ou seja, o caminho existe e é o correto; não é preciso
-- reabrir a função para o chamador com sessão.
--
-- FORMA DA GUARDA — três estados, como nas duas irmãs de `20260831140000`:
--   auth.uid() IS NULL   -> service_role / processo interno   -> PASSA
--   auth.uid() = alvo    -> aluno agindo sobre si             -> PASSA
--   auth.uid() <> alvo   -> aluno agindo sobre outro          -> BARRA (42501)
--
-- A guarda é a PRIMEIRA instrução do corpo, antes de qualquer leitura ou escrita.
-- Isso importa para a prova: alcançar o `RAISE 'Enrollment not found'` (`P0001`)
-- passa a ser evidência de que a guarda deixou passar.
--
-- `CREATE OR REPLACE` preserva a ACL — o `REVOKE` de `anon` de `20260831130000`
-- permanece em vigor. Verificado depois de aplicar, não assumido. A assinatura
-- `RETURNS TABLE(enrollment_id uuid, new_progress integer, new_status text)` é
-- reproduzida intacta: os três sítios leem `progressResult[0].new_status` e
-- `enrollment_id` para emitir certificado.
--
-- O corpo abaixo é o de produção, lido de `pg_get_functiondef`, com APENAS o bloco
-- de guarda acrescentado no topo. Nenhuma outra linha foi tocada.
--
-- REVERSÃO: reaplicar o corpo sem o bloco `IF ... RAISE EXCEPTION ... END IF;`.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_enrollment_progress(
  p_student_id uuid,
  p_course_id uuid
)
RETURNS TABLE(enrollment_id uuid, new_progress integer, new_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_enrollment RECORD;
  v_total_chapters INTEGER;
  v_completed_chapters INTEGER;
  v_progress INTEGER;
  v_status TEXT;
  v_user_tenant UUID;
BEGIN
  -- GUARDA DE CHAMADOR. `auth.uid()` NULL = service_role/processo interno, que
  -- atualiza progresso de terceiro legitimamente (messages/route.ts:275, e é a
  -- via correta para qualquer ferramenta administrativa futura).
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_student_id THEN
    RAISE EXCEPTION
      'update_enrollment_progress: chamador % nao pode alterar o progresso de %',
      auth.uid(), p_student_id
      USING ERRCODE = '42501';
  END IF;

  -- Get user tenant
  SELECT u.tenant_id INTO v_user_tenant FROM users u WHERE u.id = p_student_id;

  -- Get enrollment
  SELECT e.* INTO v_enrollment
  FROM enrollments e
  WHERE e.student_id = p_student_id
    AND e.course_id = p_course_id
    AND e.tenant_id = v_user_tenant
  FOR UPDATE;

  IF v_enrollment IS NULL THEN
    RAISE EXCEPTION 'Enrollment not found';
  END IF;

  -- Count total published chapters
  SELECT COUNT(*) INTO v_total_chapters
  FROM chapters c
  WHERE c.course_id = p_course_id
    AND c.status = 'published';

  IF v_total_chapters = 0 THEN
    v_progress := 0;
  ELSE
    -- Count chapters with at least one completed session
    SELECT COUNT(DISTINCT s.chapter_id) INTO v_completed_chapters
    FROM sessions s
    JOIN chapters c ON c.id = s.chapter_id
    WHERE s.student_id = p_student_id
      AND c.course_id = p_course_id
      AND s.status = 'completed';

    v_progress := ROUND((v_completed_chapters::NUMERIC / v_total_chapters) * 100);
  END IF;

  -- Determine status
  IF v_progress >= 100 THEN
    v_status := 'completed';
  ELSE
    v_status := 'active';
  END IF;

  -- Update enrollment
  UPDATE enrollments e SET
    progress = jsonb_build_object('percentage', v_progress, 'completed_chapters', v_completed_chapters, 'total_chapters', v_total_chapters),
    status = v_status,
    updated_at = now()
  WHERE e.id = v_enrollment.id;

  RETURN QUERY SELECT v_enrollment.id, v_progress, v_status;
END;
$function$;

COMMIT;
