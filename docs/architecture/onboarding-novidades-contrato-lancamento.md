# CONTRATO DE LANÇAMENTO, Onboarding "Percorrido x Conclusão" + "Jornada"

**Repo:** `eximia-academy-v2`, branch `deploy/cory`
**Banco:** `vaguswivhqnlbgqvnjch`, produção compartilhada, 4 tenants, Cory com clientes pagantes
**Data:** 2026-08-01
**Status:** GO condicionado. **Não lance esta semana.** Três bloqueadores de código precedem qualquer disparo, e estão na seção 3.

## Veredito honesto de abertura

A feature está desenhada, mas o caminho por onde ela deveria acontecer não existe ainda no código. Verifiquei, arquivo por arquivo:

1. **A faixa que é o passo final da novidade 2 não está no DOM em toda carga fria.** `StudyPlanInviteStrip` só renderiza no ramo feliz de `apps/web/src/components/analytics/student-comparison.tsx` (linha 251), depois de um `fetch` client-side. Os quatro ramos anteriores (`NoScopeInvite`, `ErrorState`, `Skeleton`, `OwnMetricsOnly`, linhas 237 a 244) não a renderizam, e `Skeleton` é literalmente todo primeiro paint. Isso vale também para a novidade 1, porque a tabela "Meu ritmo" (`StudentHomeCard` mais `comparison-insights-table.tsx`, linhas das duas réguas em 1362 e 1372) vive no mesmo ramo.
2. **O tour nunca dispararia onde foi projetado.** A faixa é `href="/jornada"` sem `?curso=` (`study-plan-invite-strip.tsx:38`), e `apps/web/src/app/(platform)/jornada/page.tsx` (comentário JRN-D/D11) devolve `initialView="hub"` sem `?curso=` válido, inclusive para quem tem uma matrícula só, porque o Hugo removeu o atalho de propósito. Ou seja, cem por cento das entradas pela faixa caem no hub, onde nenhum controle do construtor existe.
3. **Não há infraestrutura de tour no repositório.** `grep` negativo para `data-tour`, `data-onboarding`, `driver.js`, `reactour`, `joyride` e `shepherd`. Nenhuma âncora, nenhuma biblioteca. Isso é construção não contabilizada, não ajuste.

Lançar antes de resolver os três significa apontar o guia para o nada e gastar munição de tiro único. Cada artefato aparece uma vez por pessoa e, por desenho, não volta. Consumir errado é perda permanente de atenção de 181 alunos, não um bug que se corrige com deploy.

---

## 1. Como se controla quem viu

### 1.1 Onde vive

Tabela nova e dedicada, `public.user_feature_intro`, uma linha por (pessoa, artefato). Não é feature flag, não é analytics, é o registro de apresentação de novidade. O gate de render lê esta tabela, o funil de comportamento vive no PostHog, e as duas coisas não se confundem.

**Recusado, com motivo:**

| Alternativa | Por que não |
|:---|:---|
| `localStorage` | O estado `armed` do tour precisa durar semanas e sobreviver a troca de máquina. Público corporativo alterna desktop e celular. Além disso é inauditável, e um lançamento errado para 275 matrículas ativas ficaria sem rollback e sem resposta para "quem já viu". |
| `users.onboarding_completed` | Booleano único, sem granularidade e sem versão, e já alimenta o redirect de `(platform)/layout.tsx:265`. Sobrecarregar quebra o wizard. |
| `users.profile` JSONB | RLS no Postgres é por linha, não por coluna, então escrever ali obriga a dar UPDATE na tabela mais sensível do schema no caminho quente. O update via PostgREST substitui o jsonb inteiro, então duas abas se sobrescrevem em silêncio. E `jsonb_profile_merge` é `SECURITY DEFINER` sem checagem de `p_user_id` e sem `REVOKE`, achado C6 de `docs/qa/QA_FIX_REQUEST_EPIC_29.md`, ainda aberto. |
| `notifications` | Sequestro semântico. `notifications_select` dá a admin e manager a visão nominal de todo o tenant, e `notifications_delete` permitiria a um gestor redisparar o tour para a empresa inteira. As 120 linhas em produção têm `cta_url` e `acted_at` nulos, e serviriam de baseline. |

### 1.2 A chave, e por que ela não inclui `tenant_id` nem `version`

**Chave única: `(user_id, feature_key)`. Sem `tenant_id`. `version` é coluna comum, fora da chave.**

Sem `tenant_id`, por três razões independentes e verificadas:

- `auth_tenant_id()` lê `users.tenant_id`, a coluna singular e mutável (`20260518100000_fix_leader_rls_recursion.sql:13`), não um claim de JWT. `20260311100000_user_tenant_memberships.sql` documenta no cabeçalho que a troca de tenant faz UPDATE direto nessa coluna.
- Para qualquer conta com `users.tenant_id` nulo, `WITH CHECK (... AND tenant_id = auth_tenant_id())` avalia para NULL, não para TRUE, e devolve 42501. Combinado com `tenant_id NOT NULL`, a pessoa lê, nunca escreve, e toma o modal em todo carregamento de página, para sempre. É exatamente o modo de falha caro desta feature, e a conta de super admin que faria a onda 0 é candidata. **Verificação obrigatória no item 6 da seção 1.6.**
- `user_id = auth.uid()` já é estritamente mais estreito que qualquer escopo de tenant. Somar `AND tenant_id = auth_tenant_id()` só pode remover linhas, nunca conceder. Isolamento ganho: zero. Custo: os dois itens acima, mais o laço de INSERT 409 para usuário multi-tenant, porque a linha antiga fica invisível ao SELECT enquanto o UNIQUE continua a segurando.

Adoção por tenant se calcula em query time, por JOIN em `enrollments`, que carrega o tenant do aprendizado real. Carimbar um tenant mutável na hora da escrita atribuiria adoção ao lugar errado.

`version` fora da chave, e esta é a correção do segundo furo apontado no ataque: se `version` entrasse no UNIQUE e o upsert usasse `version` no conflict target, subir o catálogo de v1 para v2 com uma linha `armed` pendente não avançaria aquela linha, inseriria uma linha nova e deixaria a `armed` órfã para sempre. A consulta "quantos tours armados existem" passaria a contar fantasmas a cada bump. `armed` é uma intenção sobre a feature, não sobre uma versão dela.

Custo aceito: a tabela não guarda o histórico "quantos viram a v1". Se esse histórico for necessário, ele vive em evento append-only ou no PostHog, nunca fraturando a chave do gate.

### 1.3 Versionamento

A versão corrente de cada artefato é constante em código, em `apps/web/src/lib/feature-intro/catalog.ts`. Subir a versão é deploy, não migration.

- Corrigir vírgula, ajustar espaçamento: **não sobe**.
- Mudar significado, acrescentar tela, mudar passo do tour: **sobe**.

Gate: mostra o artefato K se não existe linha para K, **ou** se `linha.version < CATALOGO[K].version`. O trigger permite que `version` avance sempre, e quando ela avança a linha reabre. Dentro da mesma versão, status terminal é irreversível.

Isso é o rollback da copy: texto errado entregue aos 275 ativos se corrige subindo a versão, e quem não viu a errada não vê nada duas vezes.

### 1.4 O que acontece quando falha

Assimetria deliberada, porque os dois erros custam coisas muito diferentes. Um falso "já viu" custa uma pessoa perder um aviso, uma vez. Um falso "ainda não viu" custa um modal ressurgindo a cada page load na cara de um cliente pagante, e isso não se autocorrige, se amplifica.

| Falha | Comportamento |
|:---|:---|
| **Leitura do gate falha** | FECHADO. Não mostra nada. |
| **Escrita falha** | Suprime o artefato pelo resto da sessão via `sessionStorage`, nunca `localStorage`, e tenta de novo na navegação seguinte. |
| **Upsert devolve zero linhas afetadas sem erro** | Trata como falha de escrita, não como sucesso. O app **verifica linhas afetadas**, nunca só a ausência de exceção. RLS rejeita em silêncio. |
| **Âncora do balão ou do destaque ausente** | Degrada para modal simples, sem spotlight. Nunca desenha anel em 0,0. Vale para as duas novidades. |
| **Âncora do tour ausente** | **NÃO grava resolução, mantém `armed`, registra evento de diagnóstico.** Proibido degradar o tour para modal simples, ver seção 2.3. |

### 1.5 DDL

Aplicar **exclusivamente via Management API** (`POST /v1/projects/vaguswivhqnlbgqvnjch/database/query`), em transação única, com o token do Keychain no serviço `mission-control-supabase`, via `curl`. **Nunca `supabase db push`**: o histórico tem 12 migrations remote-only não reconciliadas, e `20260730000000_chapter_view_progress.sql` segue não aplicada aguardando GO. Um push arrastaria as 13 junto.

```sql
-- =============================================================================
-- 20260802000000_user_feature_intro.sql
-- Ledger de apresentação de novidade in-app: quem já viu qual artefato,
-- em qual versão, e quem tem tour armado esperando.
-- =============================================================================
-- STATUS: NÃO APLICADA. Aguardando GO do Hugo.
-- Projeto alvo: vaguswivhqnlbgqvnjch (PRODUÇÃO COMPARTILHADA, 4 tenants,
-- Cory Alimentos com clientes pagantes).
--
-- APLICAR VIA MANAGEMENT API, NUNCA `supabase db push`. Instruções no rodapé.
--
-- SEM tenant_id, DE PROPÓSITO. `auth_tenant_id()` lê users.tenant_id, coluna
-- SINGULAR e MUTÁVEL (20260518100000:13), não um claim de JWT. Conta com
-- tenant_id nulo avaliaria o predicado para NULL e tomaria 42501 em TODA
-- escrita, ficando presa num laço de modal permanente. E `user_id = auth.uid()`
-- já é estritamente mais estreito que qualquer escopo de tenant: somar o
-- predicado só REMOVE linhas, nunca concede. Adoção por tenant sai de JOIN em
-- enrollments, em query time.
-- =============================================================================

BEGIN;

-- =============================================================
-- 1. Tabela
-- =============================================================

CREATE TABLE user_feature_intro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ancorado em auth.users porque a linha é da PESSOA e atravessa tenants.
  -- Mesmo padrão de chapter_view_progress (20260730000000).
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- CHECK de FORMATO, não lista fechada. O conjunto é ABERTO (haverá mais
  -- novidades) e um enum obrigaria DDL em produção compartilhada a cada
  -- lançamento. O formato barra lixo; a lista canônica e a versão corrente
  -- vivem em apps/web/src/lib/feature-intro/catalog.ts.
  feature_key TEXT NOT NULL
    CHECK (feature_key ~ '^[a-z][a-z0-9_-]{2,47}$'),

  -- Versão do artefato NESTA linha. Fora da chave única de propósito: com
  -- version na chave, um bump de catálogo com linha 'armed' pendente criaria
  -- linha nova e orfanaria a armed para sempre.
  version SMALLINT NOT NULL DEFAULT 1 CHECK (version >= 1),

  -- 'armed' é o único estado não terminal.
  --   novidades: escrito no PRIMEIRO RENDER, significa "já entrou no radar".
  --   tour:      significa ARMADO, dispara no mount do construtor.
  status TEXT NOT NULL
    CHECK (status IN ('armed', 'completed', 'dismissed')),

  -- Onde parou no tour de 6 passos. NULL para os modais.
  last_step SMALLINT CHECK (last_step >= 0),

  armed_at       TIMESTAMPTZ,
  first_shown_at TIMESTAMPTZ,
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Segunda cerca do que o trigger já garante, válida para qualquer caminho
  -- de escrita, inclusive os que ainda não existem.
  CONSTRAINT ufi_resolved_iff_terminal CHECK (
    (status =  'armed' AND resolved_at IS NULL)
    OR
    (status <> 'armed' AND resolved_at IS NOT NULL)
  ),

  -- Uma linha por pessoa por artefato. Alvo do ON CONFLICT do upsert.
  UNIQUE (user_id, feature_key)
);

COMMENT ON TABLE user_feature_intro IS
  'Ledger de apresentação de novidade in-app (modal, balão, tour). Uma linha por (usuário, artefato). Mede EXPOSIÇÃO A UM AVISO, não aprendizado nem esforço. NÃO é feature flag, NÃO é analytics e NÃO é insumo de relatório de gestor, ver as policies.';

COMMENT ON COLUMN user_feature_intro.status IS
  'armed = no radar (para o tour, significa ARMADO e pendente). completed/dismissed = terminais e irreversíveis dentro da mesma versão.';

COMMENT ON COLUMN user_feature_intro.version IS
  'Versão do artefato desta linha. A versão CORRENTE vive no catálogo em TypeScript. Subir a versão reexibe; corrigir vírgula não sobe.';

-- =============================================================
-- 2. Índices
-- =============================================================
-- APENAS o índice implícito do UNIQUE (user_id, feature_key). Ele serve o
-- caminho quente (gate por pessoa a cada render) e o ON CONFLICT do upsert.
-- Volume: 181 alunos x 3 artefatos = ~543 linhas. Seq scan nesse volume é mais
-- barato que manter um segundo btree.
-- GATILHO DE REVISÃO explícito: acima de ~100k linhas, ou se a consulta de
-- adoção virar tela com refresh automático, criar então
--   CREATE INDEX idx_ufi_key ON user_feature_intro(feature_key, version, status);

-- =============================================================
-- 3. Invariantes, GARANTIDAS NO BANCO
-- =============================================================
-- MECANISMO: trigger BEFORE INSERT OR UPDATE, mesmo padrão de
-- 20260730000000. CHECK não enxerga OLD, logo não expressa monotonicidade.
-- RPC de upsert protegeria só quem passasse por ela, e as policies abaixo
-- permitem UPDATE direto via PostgREST, que a contornaria. Invariante que
-- depende do caminho escolhido não é invariante.
-- COMPORTAMENTO: clamp silencioso, não exceção. Duas abas abertas é condição
-- NORMAL, não erro do cliente.

CREATE OR REPLACE FUNCTION user_feature_intro_invariants_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    NEW.updated_at := now();
    IF NEW.status = 'armed' THEN
      NEW.armed_at    := now();
      NEW.resolved_at := NULL;
    ELSE
      NEW.first_shown_at := COALESCE(NEW.first_shown_at, now());
      NEW.resolved_at    := now();
    END IF;
    RETURN NEW;
  END IF;

  -- I1: identidade da linha é imutável.
  NEW.id          := OLD.id;
  NEW.user_id     := OLD.user_id;
  NEW.feature_key := OLD.feature_key;
  NEW.created_at  := OLD.created_at;

  -- I2: a versão nunca retrocede.
  NEW.version := GREATEST(NEW.version, OLD.version);

  IF NEW.version > OLD.version THEN
    -- I3: bump DELIBERADO de catálogo reabre a linha. É o único caminho de
    -- reexibição, e ele é um deploy, não um acidente de cliente.
    IF NEW.status = 'armed' THEN
      NEW.armed_at    := now();
      NEW.resolved_at := NULL;
      NEW.last_step   := NULL;
    ELSE
      NEW.first_shown_at := COALESCE(NEW.first_shown_at, now());
      NEW.resolved_at    := now();
    END IF;
  ELSE
    -- I4: dentro da MESMA versão, status terminal é irreversível. Sem isto,
    -- um bug de cliente que reenvie 'armed' faz o modal RESSURGIR.
    IF OLD.status <> 'armed' THEN
      NEW.status := OLD.status;
    END IF;

    -- I5: fatos históricos não se apagam.
    NEW.armed_at       := COALESCE(OLD.armed_at, NEW.armed_at);
    NEW.first_shown_at := COALESCE(OLD.first_shown_at, NEW.first_shown_at);

    -- I6: o progresso do tour nunca retrocede (requisição fora de ordem).
    NEW.last_step := GREATEST(COALESCE(NEW.last_step, -1), COALESCE(OLD.last_step, -1));
    IF NEW.last_step < 0 THEN
      NEW.last_step := NULL;
    END IF;

    -- I7: resolvido é irreversível e carimbado pelo servidor.
    IF NEW.status <> 'armed' THEN
      NEW.resolved_at    := COALESCE(OLD.resolved_at, now());
      NEW.first_shown_at := COALESCE(NEW.first_shown_at, now());
    ELSE
      NEW.resolved_at := NULL;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_feature_intro_invariants ON user_feature_intro;
CREATE TRIGGER user_feature_intro_invariants
  BEFORE INSERT OR UPDATE ON user_feature_intro
  FOR EACH ROW
  EXECUTE FUNCTION user_feature_intro_invariants_fn();

-- =============================================================
-- 4. RLS, uma policy POR COMANDO, nunca FOR ALL
-- =============================================================
-- Este repositório tem vazamento cross-tenant PROVADO por policies `FOR ALL`
-- sem recorte (jr_super_admin, lt_super_admin, super_admin_all_users), e
-- vazamento PROVADO por policy sem gate de papel (messages_select, 960/960
-- mensagens do tenant lidas por um manager+student). Esta tabela nasce no
-- mínimo. Mesmo rompimento consciente de 20260730000000.

ALTER TABLE user_feature_intro ENABLE ROW LEVEL SECURITY;

-- (a) Dono lê o próprio estado. É a consulta do gate, roda a cada render.
--
-- SEM predicado de papel, DELIBERADAMENTE. `auth_user_role() = 'student'` é o
-- defeito que quebrou a escrita do aluno em cinco tabelas (corrigido em
-- 20260729000000 e 20260729120000), porque lê a coluna SINGULAR LEGADA
-- users.role e não o chapéu multi-papel. Um manager, instructor ou leader em
-- "visão de aluno" é caso real e frequente. Posse é o único teste, e é o único
-- que não tem como quebrar para multi-hat.
CREATE POLICY "ufi_owner_select" ON user_feature_intro FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- (b) Dono cria a própria linha. O WITH CHECK amarra a posse: ninguém grava
-- "fulano já viu" em nome de fulano, o que suprimiria um aviso de terceiro.
CREATE POLICY "ufi_owner_insert" ON user_feature_intro FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- (c) Dono avança o próprio estado. USING decide quais linhas ele ALCANÇA,
-- WITH CHECK impede que a linha RESULTANTE deixe de ser dele. O trigger da §3
-- é a segunda barreira do mesmo ponto.
CREATE POLICY "ufi_owner_update" ON user_feature_intro FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- (d) Super admin: SOMENTE LEITURA, e deliberadamente NÃO `FOR ALL`.
-- Auditar exige ler, não gravar. Não existe caso de uso para o super admin
-- ESCREVER que um aluno viu um aviso. is_super_admin() (20260209000000:49)
-- não toca tenant_id, então funciona inclusive para conta sem tenant.
CREATE POLICY "ufi_super_admin_select" ON user_feature_intro FOR SELECT
  TO authenticated
  USING (is_super_admin());

-- (e) GESTOR, LÍDER, INSTRUTOR e ADMIN DE TENANT: NENHUMA POLICY, DE PROPÓSITO.
-- Enquanto só o dono lê, "viu o modal às 14h32" é preferência de interface.
-- Numa tela de gestor, ao lado do nome do funcionário, o MESMO dado vira
-- monitoramento de comportamento de trabalhador: exige base legal própria e
-- finalidade específica e informada (LGPD art. 6 I-II, art. 7), e consentimento
-- não serve de base em relação de emprego pela assimetria de poder. Nenhum
-- tenant contratou isso.
-- Além disso o dado não responde à pergunta que o gestor faria: "não viu o
-- tour" significa "não abriu a Jornada" (tela fora do menu, cuja única porta
-- some em 4 de 5 estados de render), não "não se esforçou". A migration
-- 20260730000000 já documenta a lição: "Progresso %" "não mede leitura nem
-- interação". Repetir com sinal mais fraco é regressão consciente.
-- O alcance do lançamento, que é a necessidade legítima, se responde AGREGADO
-- (seção 6 do contrato), com piso de k-anonimato de 5.

-- (f) DELETE: NENHUMA POLICY, PARA NINGUÉM. Apagar a linha REARMA o aviso e
-- destrói a resposta de "quem já viu", que é a razão de a tabela existir. O
-- único apagamento legítimo é o do direito ao esquecimento, que roda por
-- lgpd_soft_delete_user (SECURITY DEFINER) e não passa por policy.

-- =============================================================
-- 5. GRANTs explícitos, segunda cerca
-- =============================================================
-- Divergência consciente do estilo do repo. Negar DELETE no nível de GRANT
-- significa que nem uma policy de DELETE criada por engano no futuro seria
-- utilizável. Poka-yoke: tornar o caminho errado inalcançável.

GRANT SELECT, INSERT, UPDATE ON user_feature_intro TO authenticated;
REVOKE DELETE ON user_feature_intro FROM authenticated;

-- =============================================================
-- 6. LGPD, o esquecimento apaga esta linha DE VERDADE
-- =============================================================
-- O ON DELETE CASCADE NÃO resolve sozinho: /api/privacy/delete BANE o
-- auth.users (ban_duration '876600h') em vez de apagá-lo, então o cascade
-- nunca dispara. Sem a linha abaixo, o registro comportamental sobreviveria ao
-- direito ao esquecimento, em silêncio.
-- Ack de interface não tem valor probatório nem contratual: sem finalidade
-- viva após a eliminação, a lei manda apagar (art. 15 I, art. 18 VI). Logo
-- DELETE, não soft delete. Corpo original de 20260208000004 preservado, com
-- UMA linha nova (2b).

CREATE OR REPLACE FUNCTION lgpd_soft_delete_user(p_user_id UUID)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Anonymize sessions, set student_id to NULL
  UPDATE sessions SET student_id = NULL WHERE student_id = p_user_id;

  -- 2. Soft delete enrollments
  UPDATE enrollments SET deleted_at = v_now WHERE student_id = p_user_id AND deleted_at IS NULL;

  -- 2b. NOVO: acks de interface não têm valor probatório, eliminação real.
  DELETE FROM user_feature_intro WHERE user_id = p_user_id;

  -- 3. Soft delete user
  UPDATE users SET deleted_at = v_now WHERE id = p_user_id AND deleted_at IS NULL;

  RETURN v_now;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
```

### 1.6 Verificação pós-aplicação, obrigatória e nesta ordem

Rodar como role `authenticated`, **nunca** como `postgres`, que ignora policies e daria falso verde.

1. **Existência real.** `GET /rest/v1/user_feature_intro?limit=1` devolve 200. 404 significa que a migration não pegou, qualquer que seja o histórico.
2. **Policies presentes e nenhuma `FOR ALL`.**
   `SELECT polname, polcmd FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid WHERE c.relname = 'user_feature_intro';`
   Esperado: 4 linhas, `polcmd` em `{r, a, w}`, nenhum `*`, nenhum `d`.
3. **Isolamento, com controle negativo obrigatório**, em transação com ROLLBACK.
   Positivo: INSERT como `authenticated`, jwt sub de aluno real, `user_id` dele mesmo, ACEITO.
   Negativo: mesmo INSERT com `user_id` de terceiro, 42501.
   Negativo: SELECT do aluno A tentando ler a linha do aluno B, zero linhas.
   Negativo: `feature_key = 'X'` (2 caracteres), 23514.
   Negativo: DELETE da própria linha como `authenticated`, zero linhas afetadas.
4. **Multi-hat.** Repetir o positivo com jwt de `users.role = 'manager'` que tem matrícula própria (usar `2aed9aec-be4a-4301-ad86-3b4bb47e7605`, o mesmo da prova de `20260729120000`). ACEITO. Se der 42501, alguém reintroduziu predicado de papel e a migration está errada.
5. **Invariante I4.** Insere `status='completed'`, depois UPDATE para `'armed'` sem mexer em version. Permanece `'completed'`, sem erro.
6. **Conta sem tenant.** Confirmar primeiro se existe: `SELECT id, email, role FROM users WHERE tenant_id IS NULL AND deleted_at IS NULL AND status = 'active';`. Se existir, INSERT como ela, `user_id` dela mesma, **ACEITO**. Se der 42501, o predicado de tenant voltou. Se não existir nenhuma, o teste vira regressão futura, mantenha-o no arquivo de verificação.
7. **Invariante I3.** `status='armed', version=1`, depois UPDATE `version=2, status='completed'`, resulta `version=2, status='completed'`. Depois UPDATE `status='armed'` sem mexer em version, permanece `'completed'`.
8. **LGPD.** `SELECT count(*) WHERE user_id = X`, roda `lgpd_soft_delete_user(X)` em transação com ROLLBACK, confere count zero.
9. **Só então** registrar em `supabase_migrations.schema_migrations`. Nunca rodar `supabase migration repair` às cegas: já houve caso do CLI sugerir marcar como aplicada uma migration cuja tabela não existia.

**Rollback:** `DROP TRIGGER`, `DROP FUNCTION user_feature_intro_invariants_fn`, `DROP TABLE`, e restaurar `lgpd_soft_delete_user` sem a linha 2b. Estritamente aditiva e isolada, nenhuma tabela existente é alterada.

### 1.7 Protocolo de escrita no cliente

Uma via só, idempotente, e a ordem importa mais que o mecanismo:

1. **INSERT com `status='armed'` no PRIMEIRO RENDER do artefato**, com `ON CONFLICT (user_id, feature_key) DO NOTHING`. Não no fechamento. Se o ack falhar depois, a linha já existe e a novidade não volta. Escrever no fechamento é o que transforma falha de rede em laço.
2. **UPDATE para `completed` ou `dismissed`** no encerramento, com `version` do catálogo.
3. Toda escrita **verifica linhas afetadas**. Zero linhas sem erro é falha, não sucesso.

---

## 2. Os três artefatos

Catálogo em `apps/web/src/lib/feature-intro/catalog.ts`, fonte única da versão corrente.

| | `ritmo_percorrido` | `jornada_novidade` | `jornada_tour` |
|:---|:---|:---|:---|
| **O que é** | Modal de 1 tela sobre a diferença entre as duas réguas, mais balão destacando as linhas "Percorrido" e "Conclusão" na tabela real | Modal de 3 telas, último passo destaca a faixa "Monte ou revise sua jornada" | Tour de 6 passos dentro do construtor |
| **Versão inicial** | v1 | v1 | v1 |
| **Quando aparece** | No mount da tabela "Meu ritmo" (`StudentHomeCard`), **não** no load da home. Se a tabela não montou, o balão não tem onde ancorar | No mount da home do aluno, **depois** de `ritmo_percorrido` estar resolvido | No **mount do `JourneyBuilder`** (`JourneyShell` resolveu `view === "builder"`), e somente se existir linha `armed` |
| **Pré-condição dura** | `onboarding_completed = true`, flag do tenant ligada, matrícula ativa | O anterior, mais `ritmo_percorrido` com status terminal | Linha `jornada_tour` com `status = 'armed'` |
| **Como nasce a linha** | `armed` no primeiro render | `armed` no primeiro render | `armed` **na resolução de `jornada_novidade`**, sempre, independente de a pessoa ter clicado na faixa |
| **Quando some para sempre** | Ao fechar, concluir ou dispensar, dentro da versão corrente | Idem | Ao percorrer os 6 passos ou dispensar explicitamente **com as 6 âncoras presentes** |
| **O que reabre** | Bump de versão no catálogo (deploy) | Bump de versão no catálogo (deploy) | Bump de versão, ou a afordância "Ver o guia do construtor" (seção 2.4), que regrava `armed` |
| **Duração típica do estado não terminal** | Segundos | Segundos | Dias, semanas, possivelmente nunca |

### 2.1 Simplificação deliberada do gatilho do tour

O briefing original ramificava: se a pessoa entrar na jornada, o tour dispara; se pular, fica armado. **As duas pontas colapsam numa só**, e isso não é perda de escopo, é a correção do gatilho.

A faixa aponta para `/jornada` sem `?curso=`. `page.tsx` devolve o hub nesses casos, sempre, inclusive para quem tem uma matrícula só, porque o atalho foi removido de propósito (JRN-D/D11). O hub para o construtor é `router.push('/jornada?curso=X')`, navegação dentro da mesma rota (`journey-shell.tsx:129`). Logo, um gatilho que observa "entrou em /jornada" não distingue hub de construtor, e dispararia o tour numa tela onde nenhuma das 6 âncoras existe.

Portanto: **arma sempre na resolução da novidade 2, dispara no mount do construtor.** Quem clicou na faixa e navegou até o construtor no mesmo minuto recebe o tour ali. Quem pulou recebe meses depois. Mesmo código, mesmo estado.

### 2.2 As 6 âncoras do tour, mapeadas ao código real

Em `apps/web/src/app/(platform)/jornada/_components/builder/journey-builder.tsx`, na ordem em que aparecem na tela:

| Passo | Elemento | Atributo a criar |
|:---:|:---|:---|
| 1 | `deadlineChip`, "Disponível até {data}" | `data-onboarding="jornada-prazo"` |
| 2 | `<AutoSwitch>` (auto-ajuste em cascata) | `data-onboarding="jornada-auto"` |
| 3 | `<UnitSegmented>` (unidade de tempo) | `data-onboarding="jornada-unidade"` |
| 4 | `<SuggestDropdown>` (presets) | `data-onboarding="jornada-sugestao"` |
| 5 | `<TimelineCanvas>` (arrastar módulos) | `data-onboarding="jornada-linha"` |
| 6 | `<ModuleTable>` (ajuste fino por módulo) | `data-onboarding="jornada-modulos"` |

Fora do tour, de propósito: `ConsequenceBanner` e o botão "Começar minha jornada", que já tem peso visual próprio.

Âncoras das novidades:

| Artefato | Elemento | Atributo |
|:---|:---|:---|
| `ritmo_percorrido` | linha "Percorrido" em `comparison-insights-table.tsx` (~1362) | `data-onboarding="ritmo-percorrido"` |
| `ritmo_percorrido` | linha "Conclusão" em `comparison-insights-table.tsx` (~1372) | `data-onboarding="ritmo-conclusao"` |
| `jornada_novidade` | raiz do `<Link>` em `study-plan-invite-strip.tsx` | `data-onboarding="faixa-jornada"` |

Todas por atributo estável, nunca por classe, seletor de posição ou texto.

### 2.3 Regra dura: o tour não se resolve sem âncora

**A transição `armed` para terminal do `jornada_tour` só pode ser gravada se as 6 âncoras existirem no DOM.** Âncora ausente não grava nada, mantém `armed`, registra evento de diagnóstico.

Isto existe porque a mitigação genérica "âncora sumiu, mostra modal simples" **consome o artefato**: o trigger torna a resolução irreversível dentro da versão, então o tour de 6 passos seria gasto na tela errada, uma vez, por pessoa, e a própria invariante que protege contra reaparecimento impediria que ele voltasse quando ela finalmente chegasse ao construtor. A salvaguarda viraria o mecanismo de destruição.

A degradação para modal simples continua válida e recomendada para as duas novidades, que são autocontidas.

### 2.4 Armado órfão, e a afordância que fecha o buraco

Quem já tem jornada ativa cai no dashboard, e o construtor só monta pelo caminho "Revisar jornada". Hoje são 3 pessoas, mas o número cresce com o sucesso da própria feature. Sem tratamento, a fila de armados acumula sem consumo e a métrica mente.

**Entra no escopo, ~10 linhas, e é a mitigação de melhor retorno do desenho inteiro:** um link discreto "Ver o guia do construtor" dentro do `JourneyDashboard` e do `JourneyBuilder`, que grava `jornada_tour` como `armed` na versão corrente e leva ao construtor em modo revisar. Ele transforma toda omissão do sistema, incluindo falhas de escrita, âncora ausente e usuário que dispensou por engano, de irrecuperável em autoatendível.

`armed` **não expira** na v1. Durar é o ponto.

---

## 3. Ordem de implantação

Numerada, com o motivo de cada posição. Os itens 1 a 3 são **bloqueadores**: nada dispara antes deles.

**1. Tornar a faixa incondicional.** Subir `<StudyPlanInviteStrip />` de `student-comparison.tsx` (onde hoje é a linha 251, dentro do único ramo feliz) para `apps/web/src/components/dashboard/student-dashboard.tsx`, como irmã do bloco `<div className="px-6">` que contém `<StudentComparison>` (linha 171), fora do fetch. O componente é um `<Link>` estático, não recebe prop nenhuma, não tem dependência de dado, então não há razão para estar atrás de uma API de analytics. Preservar o padding `px-6` e o espaçamento vertical. Um movimento pequeno conserta 4 dos 5 estados de render.
*Por que primeiro:* sem isso, o passo final da novidade 2 aponta para elemento inexistente em toda carga fria, para todo usuário, sempre.

**2. Colocar `/jornada` no menu.** `apps/web/src/components/layout/sidebar.tsx:105`, `navItems`. Hoje a tela não está na navegação e a faixa é o único link.
*Por que:* uma feature cuja única porta pode sumir não sustenta um anúncio em massa, e o tour armado depende de a pessoa conseguir chegar ao construtor por vontade própria.

**3. Âncoras e infraestrutura de tour, antes de qualquer copy.** Criar os `data-onboarding` da seção 2.2 e escolher o mecanismo do tour. Não há biblioteca no repo (`grep` negativo), então isto é construção, não configuração. Somar teste de render que falha se qualquer uma das 9 âncoras sumir.
*Por que:* é o único item cujo custo estava fora do plano original, e é o que trava o cronograma se descoberto tarde.

**4. Migration `user_feature_intro`, via Management API**, com as 9 verificações da seção 1.6. Isolada e aditiva, pode subir em paralelo aos itens 1 a 3, mas o GO do Hugo é pré-requisito e ela não vai junto com nenhuma outra migration pendente.

**5. Catálogo, gate server-side e hook de escrita.** `catalog.ts`, leitura no server component da home e do `/jornada`, upsert com verificação de linhas afetadas, `sessionStorage` como supressão de falha, fail-closed na leitura.

**6. Kill switch, e ensaio dele.** Seção 4. Desligar de verdade na onda 0 e cronometrar.

**7. Instrumentação do funil.** Seção 6. Antes de qualquer exibição real, porque sem os níveis 3 e 4 o lançamento é infalsificável.

**8. LGPD no mesmo PR.** `DELETE` em `lgpd_soft_delete_user` (já no DDL) e bloco nomeado `feature_intro` em `apps/web/src/app/api/privacy/export/route.ts`, somando ao `Promise.all` a leitura de `feature_key, version, status, created_at, updated_at`, com teste em `apps/web/src/app/api/privacy/__tests__/export.test.ts`. Bloco nomeado, não blob: o art. 9 exige informação clara.
*Por que no mesmo PR:* omitir tabela nova de dado pessoal de um export que já existe cria não conformidade nova em produção, não herda uma antiga. E follow-up de conformidade não volta. **Critério de aceite: o PR não passa no QA gate sem isto.**

**9. Novidade 1 e novidade 2 ligadas na onda 0.** Percorrer como aluno real, em 3G throttled.

**10. Ondas 1 a 3.** Seção 5.

---

## 4. Kill switch

**Mecanismo: `tenants.settings` JSONB, chave `features.onboarding_jornada_v1`, default OFF.**

Desligar é **um UPDATE em 4 linhas**, sem deploy, sem build, executável do Supabase Studio por um humano às 9h01 de uma segunda-feira.

Por que não os outros:

| Candidato | Veredito |
|:---|:---|
| Deploy | **Inviável como mitigação.** `.github/workflows/ci.yml` dispara só em `main` e `develop`, o branch é `deploy/cory`, e não há job de deploy. Produção é rebuild manual no EasyPanel. Isso é build Docker mais humano disponível. |
| PostHog (`apps/web/src/lib/feature-flags.ts`) | **Não verificado, logo fora do plano de contingência.** É client-only (`typeof window === "undefined"` devolve false) e depende de `NEXT_PUBLIC_POSTHOG_KEY`, que é ARG de build assado na imagem. Não foi possível confirmar telemetria de produção. Mecanismo não verificado não é alavanca. |
| `plan_features` / `checkFeature` | Semântica errada (gate comercial de plano) e cache em memória de 5 minutos por processo. Até 5 minutos preso ligado. |
| **`tenants.settings`** | **Escolhido.** Precedente vivo: `manager-dashboard-page.tsx:152` lê `isFeatureEnabled(tenant?.settings, "ai_detection")`, helper local definido na linha 681 do mesmo arquivo. Leitura direta, sem camada de cache. |

Três condições sem as quais isto não é kill switch:

1. **Extrair o helper** de `manager-dashboard-page.tsx:681` para `apps/web/src/lib/tenant-features.ts` e **ler server-side**, passando como prop. Flag lida no bundle do cliente não se mata.
2. **Garantir que a rota não seja cacheada estaticamente**, senão virar a linha no banco não muda nada.
3. **Ensaiar na onda 0**, desligando de fato e confirmando o sumiço no reload, com o tempo cronometrado. Kill switch nunca ensaiado é intenção, não alavanca.

Ausência da chave significa desligado, então a falha do próprio flag é "feature invisível", nunca "presa ligada".

**Limite honesto, aceito:** o flag corta exibições novas, não tira o modal de quem já está com ele na tela. Perda limitada.

Comando, escrito **antes** de subir, no runbook:

```sql
UPDATE tenants
   SET settings = jsonb_set(
         COALESCE(settings, '{}'::jsonb),
         '{features,onboarding_jornada_v1}',
         'false'::jsonb,
         true)
 WHERE id = '<tenant>';
```

---

## 5. Rollout

### 5.1 Ondas por tenant, Cory por último

**Recusada a data de corte** ("só quem entrar depois de X"): não resolve avalanche, só adia, e exclui exatamente os 181 alunos que a feature existe para converter.

**Recusado o big-bang**: não por carga (181 modais é irrelevante para o servidor), mas por raio de explosão reputacional. O erro chega por telefone do RH, não por log.

| Onda | Quando | Alvo | Portão para avançar |
|:---:|:---|:---|:---|
| 0 | D-3 | tenant demo | Hugo percorre como aluno real, em 3G throttled, com as 3 contas da seção 5.3, e o kill switch é ensaiado de verdade |
| 1 | D0 | menor tenant real | 48h sem âncora órfã e taxa de gravação do "visto" próxima de 100% |
| 2 | D+3 | demais, exceto Cory | idem |
| 3 | D+7 | **Cory** | idem |

### 5.2 Regras de disparo, baratas agora e caras depois

- **Só em carga nova da home**, nunca sobre sessão ativa. Modal por cima do trabalho de alguém é o pior primeiro contato possível.
- **Só se `onboarding_completed = true`.** `(platform)/layout.tsx:265` redireciona `!onboarding_completed && role === 'student'` para `/onboarding`. Sem esta condição, quem acabou de sair do wizard toma dois onboardings em sequência.
- **Só com matrícula ativa** e módulo habilitado no tenant.
- **Um email de uma linha ao RH de cada tenant antes da respectiva onda.** A avalanche real não é de servidor, é de suporte: mesmo funcionando, uma fração das 181 pessoas acha que quebrou.

### 5.3 As três contas do ensaio da onda 0

Percorrer, não olhar log. O defeito do gatilho do tour só aparece percorrendo.

1. Aluno com **1 curso**: confirmar que a faixa leva ao hub e que o tour **não** dispara ali.
2. Aluno com **2 ou mais cursos**: confirmar que o tour dispara depois de escolher o curso, com as 6 âncoras.
3. Aluno com **jornada ativa**: confirmar que cai no dashboard, que o tour **não** dispara, que a linha permanece `armed`, e que a afordância "Ver o guia do construtor" funciona.

---

## 6. Como se mede

**Verdade incômoda de partida:** as 120 notificações em produção têm `cta_url` e `acted_at` nulos. O motor de engajamento nunca mediu um clique. Sem instrumentar o funil antes, o lançamento é infalsificável e a conversa de D+30 vira opinião.

### 6.1 O funil, por tenant

| Nível | Métrica | O que prova |
|:---:|:---|:---|
| 0 | exibido / elegíveis que logaram | o gatilho funciona |
| 1 | chegou à última tela / exibido | o conteúdo prende |
| 2 | clicou na faixa / concluiu a novidade 2 | a promessa converteu |
| 3 | entrou em `/jornada` | intenção |
| 3b | **montou o construtor** (`view === "builder"`) | chegou onde o tour mora |
| 4 | **salvou jornada** | a que importa |
| 5 | voltou em 14 dias | não foi teatro |

Níveis 0 a 3b e 5 no PostHog. Nível 4 sai do banco, contagem de jornadas persistidas. O nível 3b existe porque foi exatamente a lacuna que quase queimou o tour: sem ele, "entrou em /jornada" seria lido como "viu o construtor".

Saúde operacional, não funil, mas com alarme:

- **razão exibições por usuário acima de 1,2** dispara investigação imediata. É o detector do laço de modal, e sem ele o sintoma só aparece como reclamação humana dois ou três dias depois, quando a munição de todo mundo já queimou.
- **tours armados e não consumidos**: `SELECT count(*) FROM user_feature_intro WHERE feature_key='jornada_tour' AND status='armed';`. Reportado separado, nunca somado ao funil.

Adoção agregada, resposta legítima ao "o lançamento chegou?", por RPC `SECURITY DEFINER` com **piso de k-anonimato de 5** no denominador, porque num time de 3 o agregado é nominal por dedução:

```sql
SELECT ufi.feature_key, ufi.version, ufi.status, count(DISTINCT ufi.user_id)
  FROM user_feature_intro ufi
  JOIN enrollments e ON e.student_id = ufi.user_id AND e.status = 'active'
 WHERE e.tenant_id = '<tenant>'
 GROUP BY 1,2,3;
```

### 6.2 Meta

**De 3 para 25 jornadas salvas em 30 dias**, ou seja de 1% para cerca de 14% dos 181 alunos com matrícula. Ordem de grandeza defensável: 119 dos 181 têm 2 ou mais cursos, logo têm motivo real para sequenciar. Se cerca de 120 virem o guia e 20% agirem, dá 24.

Leituras em **D+7** e **D+14**, decisão em **D+30**. Nada decidido antes de D+7.

### 6.3 Critérios de conclusão, definidos agora e não depois

| Sinal | Conclusão obrigatória |
|:---|:---|
| Nível 0 abaixo de 80% | O problema é o gatilho, não a copy. **Não mexer no texto.** |
| Nível 1 abaixo de 60% | 4 telas mais 6 passos é longo demais. Cortar. |
| Nível 3b alto e nível 4 abaixo de 10% | O guia funcionou e **o construtor é que não presta**. Conclusão cara e valiosa. |
| Razão exibições por usuário acima de 1,2 | Laço. **Desligar o tenant afetado no ato**, investigar depois. |
| Tours armados não consumidos crescendo sem nível 3b subir | O caminho até o construtor é o gargalo, não o tour. |

**Critério de FRACASSO, o que faz desligar:**

- **Menos de 10 jornadas salvas em 30 dias.** A conclusão nesse caso **não é "melhora o modal"**. É que montar jornada não é um problema que o aluno tem. 1% de adoção pode ser falta de descoberta ou falta de desejo, e o onboarding só testa descoberta. Descoberta resolvida com adoção parada responde a pergunta. **O próximo passo passa a ser conversar com 5 alunos da Cory, não iterar copy.** Isto precisa estar escrito antes, senão vira iteração infinita de texto.
- **Qualquer laço confirmado em tenant real**, mesmo com adoção boa: desliga o tenant, corrige, sobe versão, reabre.
- **Reclamação formal de RH de tenant** sobre interrupção não anunciada: desliga tudo, revisa comunicação antes de qualquer nova onda.

---

## 7. O que NÃO entra nesta versão

1. **Coluna "viu o tour" na tela do gestor, líder, instrutor ou admin de tenant.** Registrado com nome e data. Quatro razões: muda a natureza jurídica do dado (preferência de interface vira monitoramento de trabalhador, exigindo base legal que ninguém constituiu, com consentimento inservível por assimetria de poder); não responde à pergunta que o gestor faria, porque "não viu" mede o defeito de navegação e culpa a pessoa; contamina o instrumento, porque no dia em que o aluno souber que o "pulei" chega ao chefe o clique deixa de medir o que media; e o precedente deste repo é inequívoco, toda tabela que nasceu com leitura de gestor "porque pode ser útil depois" virou vazamento. Alargar depois é uma migration de 5 linhas. Estreitar depois de vazar é um incidente com cliente pagante.
2. **Histórico "quantos viram a v1" dentro da tabela.** A chave é `(user_id, feature_key)` de propósito. Se o histórico for necessário, vai para evento append-only ou PostHog.
3. **Expiração automática do `armed`.** Durar é o ponto. O que existe é a afordância manual da seção 2.4.
4. **Segundo índice.** Só o implícito do UNIQUE. Gatilho de revisão documentado no próprio DDL: acima de 100 mil linhas ou tela de adoção com refresh.
5. **Enum de `feature_key` no banco.** CHECK de formato, nunca lista fechada, porque lista fechada exige DDL em produção compartilhada a cada novidade nova, e contradiz a promessa de relançar sem migration.
6. **Backfill para os 302 matriculados.** Não há, e não deve haver. Ausência de linha **é** o estado inicial correto.
7. **Tour para quem nunca viu a novidade 2.** O `jornada_tour` só nasce armado pela resolução da novidade 2 ou pela afordância manual. Aluno novo que entra no construtor sem passar pela novidade não recebe tour na v1.
8. **Correção do C6 (`jsonb_profile_merge` SECURITY DEFINER sem checagem de `p_user_id` e sem `REVOKE`).** É pré-existente, não é causado por esta feature, e é a razão decisiva para recusar `users.profile`. Registrar como story própria: guard `IF p_user_id <> auth.uid() AND NOT is_super_admin() THEN RAISE` mais `REVOKE EXECUTE FROM PUBLIC, anon`. Verificar `proacl` em produção antes do lançamento.
9. **Aplicação de `20260730000000_chapter_view_progress.sql` ou de qualquer das 12 migrations remote-only não reconciliadas.** Esta migration sobe sozinha, via Management API, uma por vez.
10. **Ativar o review gate automático de qualquer executor externo** durante a janela de lançamento.
11. **Frase de aviso de privacidade do tenant.** Fica fora do PR de código, mas **entra antes da onda 1**: uma linha dizendo que a plataforma registra quais avisos já foram vistos para não repeti-los. Sem ela é tratamento não informado.
12. **Purga por retenção.** Definir prazo depois de o funil rodar. Como o versionamento está no catálogo e a chave é estável, a purga futura é um DELETE por `feature_key`, trivial e auditável.

---

## Resumo executável em uma linha

Não lance ainda. Conserte a faixa, coloque `/jornada` no menu, crie as 9 âncoras e o mecanismo de tour, suba a tabela `user_feature_intro` sem `tenant_id` e com chave `(user_id, feature_key)`, amarre o tour ao mount do construtor e nunca à rota, ensaie o kill switch em `tenants.settings`, instrumente o funil até o nível 4, e só então rode 4 ondas com a Cory por último.