# Contrato, Anúncios de Novidade com Janela de Validade

**Repo:** `/Users/hugocapitelli/Dev/eximia/eximia-academy-v2` (branch `deploy/cory`)
**Migration alvo:** `supabase/migrations/20260801140000_product_announcements.sql`
**Status:** ESCRITO, NÃO APLICADO. Banco é produção compartilhada, 4 tenants, Cory Alimentos pagante.

---

> ## ⚠ SUPERSEDED EM 2026-08-04 — LEIA ANTES DE COPIAR QUALQUER DDL DAQUI
>
> Este documento é o **rascunho de arquitetura** de 08-01/08-03. Ele foi
> consolidado (e, em três pontos, **revogado**) por
> `docs/stories/feat-onboarding-novidades-lancamento.md` e pela migration que de
> fato existe, `supabase/migrations/20260803000000_onboarding_novidades.sql`.
> **Em qualquer divergência, a migration vence, porque é o schema que vai
> existir.**
>
> O que aqui está **REVOGADO**:
>
> 1. **A frase canônica da §1** e as linhas de §5 (casos de borda) que dela
>    derivam. A coorte deixou de ser trava obrigatória e virou **opt-in por
>    anúncio** (`product_announcements.cohort_gated`, default `false`). Ver a
>    story §1.2, "Correção 2026-08-04".
> 2. **O predicado de coorte DENTRO da RLS** — `OR auth_announcements_since() <
>    starts_at`, que aparece nas §5 e §"as 4 condições" adiante, e a função
>    `auth_announcements_since()` da §4. Isso **não deve ser implementado**. A
>    regra é condicional por linha (`cohort_gated`), e duplicá-la no banco criaria
>    o caso "a aplicação libera e a RLS esconde", cujo sintoma é *não aparece*,
>    sem erro nenhum — o pior modo de falha do desenho. A **janela** continua
>    sendo predicado de RLS (é garantia de banco, imune a bug de cache no front);
>    a **coorte** é regra única de `apps/web/src/lib/onboarding/resolve.ts`.
> 3. **O DDL de exemplo** (nomes `key`/`trigger_route`/`cohort_gate`/`tenant_ids`,
>    `is_published`, chave de views por `announcement_id + version`). A migration
>    modela outra coisa, com a prova de cada decisão na story §1.3. Copiar daqui
>    produz código que fala com um schema que não existe.
>
> O que aqui **permanece válido e vale a leitura**: o raciocínio de *produto x
> feature* (§2), a medição que reprova `users.created_at` como âncora, e a lista
> de casos de borda **como catálogo de riscos** — desde que lidos com a correção
> acima.

---

## 1. A regra em uma frase

> ~~**Um anúncio só aparece para quem já estava na plataforma antes de ele começar, só enquanto a janela dele estiver aberta, e só uma vez.**~~
>
> **REVOGADA em 2026-08-04.** Vigente: *um anúncio só aparece enquanto a janela
> dele estiver aberta, e só uma vez.* A cláusula de coorte é opt-in por linha.

~~Fora da janela ele não aparece para ninguém, nem para quem nunca viu. Quem chegou depois do `starts_at` nunca vê, porque para essa pessoa a palavra "novidade" é literalmente falsa.~~

Fora da janela ele não aparece para ninguém, nem para quem nunca viu. **Dentro**
da janela ele aparece para todo o público declarado, inclusive para quem chegou
depois do `starts_at` — o que impede acúmulo é a janela fechar, não a coorte.

---

## 2. Produto x feature, o veredito

**A distinção se sustenta, mas não como rótulo escolhido por quem publica. Ela se sustenta como GATILHO, e o gatilho determina o schema.**

O corte "produto x feature" é uma propriedade da RELAÇÃO entre a pessoa e a mudança, não do artefato. No mesmo instante, "Jornada" é feature para quem entrou em maio e é produto para quem entrou hoje. Logo, um campo `tipo` livre estaria sempre errado para metade das pessoas, e todo mundo marcaria "produto" na hora de publicar, porque "produto" soa mais importante e não expira. O acúmulo voltaria pela porta do rótulo em três meses.

O que substitui o rótulo livre: **três gatilhos, e o gatilho decide o que a linha PODE conter.**

| Camada | Gatilho | Expira? | Onde mora |
|:---|:---|:---|:---|
| **Superfície permanente** | a pessoa perguntou | nunca | ícone "i" (`apps/web/src/components/analytics/column-help-popover.tsx`, já em produção), estados vazios, `/help` |
| **Tour de tela** | primeira visita àquela rota | nunca | `product_announcements`, `kind = 'product_onboarding'`, janela PROIBIDA pelo CHECK |
| **Anúncio** | janela de data | sempre | `product_announcements`, `kind = 'announcement'`, janela OBRIGATÓRIA pelo CHECK |

**As três travas que fazem isso ser garantia e não boa intenção:**

1. `CONSTRAINT pa_window_by_kind`, anúncio exige `starts_at` e `ends_at`, tour proíbe os dois. Ninguém consegue escrever "anúncio eterno" nem "tour com validade".
2. `help_url TEXT NOT NULL`, o banco recusa publicar anúncio que não declare onde o conhecimento mora depois que a janela fechar. É o que impede o **anúncio órfão**: se N1 for a única coisa que já explicou o que é Percorrido, expirar N1 cria um buraco permanente. No caso de hoje o repo está coberto por sorte de sequência (o popover "i" já existe), e essa trava transforma sorte em invariante.
3. `CONSTRAINT pa_window_max_35d`, teto duro. Não existe janela eterna cadastrável. Renovar exige um `UPDATE` deliberado, que é uma decisão, não um esquecimento.

**Consequência aceita:** feature de 6 meses com adoção baixa NÃO se corrige reabrindo anúncio velho, isso é literalmente o acúmulo proibido. Corrige-se com estado vazio, ajuda contextual, ou um relançamento deliberado, que é uma linha NOVA com chave nova, copy nova e janela nova, opcionalmente com `cohort_gate = false` para alcançar também quem chegou depois.

---

## 3. O catálogo

### Onde vive: metadados em tabela, conteúdo em React, linha nascida em migration

Esta foi a maior divergência entre as lentes e ela está decidida assim:

| Parte | Onde vive | Por quê |
|:---|:---|:---|
| Conteúdo (modal de 3 telas, tour de 6 passos, imagens) | componente React, registrado num mapa `content_key -> componente` | anúncio é interface, não parágrafo. HTML em coluna vira XSS e vira conteúdo que ninguém revisa em PR |
| Metadados (chave, janela, público, kind, help_url) | tabela `product_announcements` | a janela precisa ser avaliada DENTRO da RLS, para que um bug de cache do front não consiga ressuscitar um anúncio de 2026 em 2027. O front pode errar, o dado não aparece |
| A linha em si | `INSERT` dentro da migration do mesmo PR da feature | revisável em PR, versionado, e o anúncio nasce e morre no mesmo commit da feature. Rollback da feature leva a linha junto |

Isso pega o ponto decisivo de cada lente sem fazer média: o conteúdo é código (senão o refactor do construtor deixa um ponteiro pendurado apontando para seletores DOM mortos), e a janela é dado avaliado no banco (senão a expiração é promessa de código em vez de garantia física).

**Trava contra o ponteiro pendurado:** teste que falha se algum `content_key` publicado não existir no mapa de componentes. Um refactor que apaga o componente quebra o CI, não a tela do aluno.

### Como se cadastra uma novidade, o ritual de 4 passos

Todos executados pela MESMA pessoa, dentro do PR da feature. O critério que decide se um ritual sobrevive não é o número de passos, é quantas pessoas diferentes ele atravessa.

1. **Escrever a casa permanente.** Texto do popover "i" ou seção nova em `/help` com âncora. Sem essa URL o passo 3 falha, porque `help_url` é `NOT NULL`.
2. **Criar o componente** em `announcements/<key>.tsx` e registrar no mapa `content_key -> componente`.
3. **Rodar `SELECT * FROM preview_announcement_reach('<key>')`** antes de publicar. Imprime "vai aparecer para 14 gestores e 0 alunos". Este é o único gate humano do desenho, e existe porque público errado é a única falha que erra para MAIS exposição e é irreversível.
4. **Merge.** Feature e anúncio sobem no mesmo deploy. Anúncio sem feature é mentira, feature sem anúncio é o problema que estamos resolvendo.

**Verificação no dia seguinte:** se `seen = 0` com a janela aberta, a data está errada. Este passo não é opcional, é a única defesa contra o modo de falha mais provável do desenho (ver seção 5).

### DDL

```sql
-- =============================================================================
-- supabase/migrations/20260801140000_product_announcements.sql
-- ANÚNCIOS DE NOVIDADE COM JANELA DE VALIDADE
-- =============================================================================
-- REQUISITO LITERAL (Hugo, 2026-08-01): "a pessoa que acabou de entrar em uma
-- plataforma e não viu nenhum negócio de feature vai ver todos? não, não pode,
-- ela tem que ver só os atuais."
--
-- COMO ISTO ATENDE, EM UMA FRASE: a visibilidade é um PREDICADO AVALIADO EM
-- LEITURA DENTRO DA POLICY DE SELECT, nunca uma linha materializada por
-- destinatário. Fora da janela o predicado é falso para TODO MUNDO, inclusive
-- para quem nunca viu. O acúmulo deixa de ser um bug a evitar e passa a ser
-- fisicamente impossível.
--
-- POR QUE NÃO REUSAR notification_templates / notifications:
--   1. notification_templates.tenant_id é NOT NULL. Anúncio de produto vale
--      para os 4 tenants e para o 5o que ainda não existe.
--   2. notifications é uma linha POR DESTINATÁRIO materializada no disparo, que
--      é exatamente a máquina de acúmulo que o requisito manda matar.
--   3. O acesso do engagement é admin/manager/instructor DO TENANT. Quem lança
--      feature de produto é a exímIA, não o admin do cliente.
--
-- RLS: policies POR COMANDO. NENHUM "FOR ALL", nem para super_admin. O padrão
-- FOR ALL é o que produziu vazamento cross-tenant provado neste repo.
--
-- ADITIVA E IDEMPOTENTE. Nenhuma tabela existente é alterada, renomeada ou
-- dropada.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. A ÂNCORA: users.announcements_since
-- -----------------------------------------------------------------------------
-- MEDIDO em produção em 2026-08-01 (service role, somente leitura):
--   * vertice-industria: 120/120 alunos (100%) têm evidência de atividade
--     ANTERIOR ao próprio users.created_at. Efeito do seed de 2026-07-29.
--   * 129/181 alunos (71%) têm a primeira enrollment criada ANTES da própria
--     linha em users.
--   * public.users.created_at == auth.users.created_at em 184/184. As duas
--     tabelas foram recriadas JUNTAS, então concordarem NÃO prova nada.
--   * 133/185 contas nunca fizeram login. "Conta criada" não é "pessoa
--     presente", e a janela pergunta pela pessoa.
-- CONCLUSÃO: nem users.created_at nem enrollments.created_at servem de âncora.
-- Esta coluna é o carimbo do próprio sistema de anúncios e nunca deriva delas.
-- Segue o padrão já provado de users.last_seen_at (20260714120000).
ALTER TABLE users ADD COLUMN IF NOT EXISTS announcements_since TIMESTAMPTZ;

COMMENT ON COLUMN users.announcements_since IS
  'Instante em que o usuário passou a ser OBSERVÁVEL pelo sistema de anúncios. '
  'NULL = nunca teve presença autenticada desde a criação da coluna; é cunhado '
  'na primeira chamada de announcements_baseline(). Um anúncio só é elegível se '
  'announcements_since < starts_at. NUNCA derivar de users.created_at nem de '
  'enrollments.created_at: medidos como não confiáveis.';

-- Backfill por EVIDÊNCIA DE PRESENÇA. Usa EXISTÊNCIA de linha, nunca timestamp,
-- portanto é imune à contaminação medida. Quem já provou ter estado aqui recebe
-- o carimbo da migration e é "antigo" para qualquer anúncio futuro. Quem nunca
-- apareceu fica NULL e cunha o carimbo no primeiro acesso real dele.
-- enrollments NÃO conta como evidência: matrícula é ato do admin, não presença
-- da pessoa. Impacto esperado hoje: ~134 carimbados, ~48 alunos permanecem NULL.
UPDATE users u
   SET announcements_since = now()
 WHERE u.announcements_since IS NULL
   AND (
        u.last_seen_at IS NOT NULL
     OR EXISTS (SELECT 1 FROM sessions s              WHERE s.student_id = u.id)
     OR EXISTS (SELECT 1 FROM chapter_view_progress p WHERE p.student_id = u.id)
   );

-- Cunhagem preguiçosa, atômica e SEM NENHUM PARÂMETRO por desenho: não existe
-- forma de apontar esta função para outro usuário. Idempotente.
CREATE OR REPLACE FUNCTION announcements_baseline()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;

  UPDATE users SET announcements_since = now()
   WHERE id = auth.uid() AND announcements_since IS NULL
  RETURNING announcements_since INTO v;

  IF v IS NULL THEN
    SELECT announcements_since INTO v FROM users WHERE id = auth.uid();
  END IF;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION announcements_baseline() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION announcements_baseline() TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. HELPERS DE POLICY (PL/pgSQL de propósito)
-- -----------------------------------------------------------------------------
-- PL/pgSQL nunca é inlined pelo planner, o que garante o SECURITY DEFINER e
-- evita recursão de RLS ao ler `users` de dentro de uma policy de outra tabela.
-- Esse foi exatamente o bug corrigido em 20260518100000; não reintroduzir.

-- Chapéus do usuário: users.role (legado) UNIÃO user_roles (EPIC-30). Precisa
-- ser a união porque o repo tem os dois modelos vivos ao mesmo tempo.
CREATE OR REPLACE FUNCTION auth_role_set() RETURNS TEXT[]
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE _roles TEXT[];
BEGIN
  SELECT COALESCE(array_agg(DISTINCT s.r), ARRAY[]::TEXT[]) INTO _roles
  FROM (
    SELECT u.role AS r FROM users u WHERE u.id = auth.uid() AND u.role IS NOT NULL
    UNION
    SELECT ur.role FROM user_roles ur WHERE ur.user_id = auth.uid()
  ) s;
  RETURN _roles;
END;
$$;

-- ### REVOGADO EM 2026-08-04 — NÃO IMPLEMENTAR ESTA FUNÇÃO. ###
-- A coorte deixou de viver no banco: ela virou opt-in por linha
-- (`product_announcements.cohort_gated`) e é avaliada SOMENTE em
-- `apps/web/src/lib/onboarding/resolve.ts`. Uma cópia da regra aqui dentro
-- criaria o caso "a aplicação libera e a RLS esconde", cujo sintoma é o
-- anúncio não aparecer, sem erro nenhum. Ver o aviso SUPERSEDED no topo
-- deste arquivo e a story §1.2, "Correção 2026-08-04".
CREATE OR REPLACE FUNCTION auth_announcements_since() RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE _t TIMESTAMPTZ;
BEGIN
  SELECT announcements_since INTO _t FROM users WHERE id = auth.uid();
  RETURN _t;
END;
$$;

COMMENT ON FUNCTION auth_announcements_since() IS
  'NULL faz o gate de coorte reprovar (NULL < x é NULL, logo falso), ou seja, '
  'falha para MENOS exibição. Proposital: dado ruim resulta em uma pessoa a '
  'menos vendo, nunca em 181 pessoas vendo o errado.';

-- -----------------------------------------------------------------------------
-- 3. product_announcements, o catálogo (1 linha por novidade, NUNCA por aluno)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_announcements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  key            TEXT NOT NULL UNIQUE,     -- slug estável, citado em código e log
  version        INT  NOT NULL DEFAULT 1,  -- ÚNICA forma de re-exibir

  kind           TEXT NOT NULL CHECK (kind IN ('announcement', 'product_onboarding')),
  surface        TEXT NOT NULL CHECK (surface IN ('modal', 'tour')),

  title          TEXT NOT NULL,
  content_key    TEXT NOT NULL,            -- chave no mapa React, nunca HTML

  -- POKA-YOKE PRINCIPAL. A casa PERMANENTE do conhecimento. NOT NULL faz o banco
  -- RECUSAR anúncio que não tenha onde o conhecimento morar quando a janela
  -- fechar. Sem isto, em 3 semanas o conhecimento evapora do produto.
  help_url       TEXT NOT NULL,

  trigger_route  TEXT,                     -- só para product_onboarding

  -- SEM DEFAULT de propósito: obriga decisão explícita. O default preguiçoso
  -- seria "todo mundo", e "todo mundo" é como se mata um canal no primeiro uso.
  audience_roles TEXT[] NOT NULL CHECK (cardinality(audience_roles) > 0),

  tenant_ids     UUID[],                   -- NULL = todos os tenants

  cohort_gate    BOOLEAN NOT NULL DEFAULT true,
  priority       INT NOT NULL DEFAULT 100, -- menor aparece primeiro

  starts_at      TIMESTAMPTZ,
  ends_at        TIMESTAMPTZ,

  is_published   BOOLEAN NOT NULL DEFAULT false,
  stats          JSONB NOT NULL DEFAULT '{}',

  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Janela OBRIGATÓRIA para anúncio, PROIBIDA para onboarding de produto. É este
  -- CHECK, e não a disciplina de ninguém, que responde "o tour expira?".
  CONSTRAINT pa_window_by_kind CHECK (
    (kind = 'announcement'
       AND starts_at IS NOT NULL AND ends_at IS NOT NULL AND ends_at > starts_at)
    OR
    (kind = 'product_onboarding'
       AND starts_at IS NULL AND ends_at IS NULL)
  ),

  -- "duas a três semanas, um mês no máximo" virando restrição física.
  CONSTRAINT pa_window_max_35d CHECK (
    kind <> 'announcement' OR ends_at <= starts_at + INTERVAL '35 days'
  ),

  -- Tour sem rota nunca dispararia. Falha no cadastro, não em produção.
  CONSTRAINT pa_onboarding_needs_route CHECK (
    kind <> 'product_onboarding' OR trigger_route IS NOT NULL
  ),

  -- Coorte não se aplica a tour: o aluno de outubro PRECISA aprender a usar a
  -- tela, mesmo que ela não seja nova para ele.
  CONSTRAINT pa_onboarding_no_cohort CHECK (
    kind <> 'product_onboarding' OR cohort_gate = false
  )
);

CREATE INDEX IF NOT EXISTS idx_pa_live
  ON product_announcements (is_published, kind, priority, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_pa_route
  ON product_announcements (trigger_route) WHERE kind = 'product_onboarding';

-- -----------------------------------------------------------------------------
-- 4. product_announcement_views, quem viu o quê
-- -----------------------------------------------------------------------------
-- Tabela dedicada, NUNCA um booleano em users nem um blob em users.profile.
-- users.profile é gravável pelo próprio usuário e é compartilhado
-- (ai_learning_profile, weekly_plan). Um read-modify-write errado em qualquer
-- caminho que grava profile reabriria todos os modais para todo mundo. O repo
-- já foi mordido por essa corrida (jsonb_profile_merge, 20260210000002).
CREATE TABLE IF NOT EXISTS product_announcement_views (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id      UUID NOT NULL REFERENCES product_announcements(id) ON DELETE CASCADE,
  announcement_version INT  NOT NULL,
  user_id              UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  seen_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at         TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  cta_clicked_at       TIMESTAMPTZ,
  last_step            SMALLINT CHECK (last_step IS NULL OR last_step >= 0),

  -- A LINHA É O CADEADO: o direito de exibir se conquista com o INSERT
  -- (ON CONFLICT DO NOTHING), não com o render. Duas abas simultâneas, uma
  -- ganha o INSERT e exibe, a outra perde e cala.
  UNIQUE (announcement_id, announcement_version, user_id),
  CONSTRAINT pav_dismiss_after_seen
    CHECK (dismissed_at IS NULL OR dismissed_at >= seen_at)
);

CREATE INDEX IF NOT EXISTS idx_pav_user   ON product_announcement_views (user_id);
CREATE INDEX IF NOT EXISTS idx_pav_ann    ON product_announcement_views (announcement_id, announcement_version);
CREATE INDEX IF NOT EXISTS idx_pav_tenant ON product_announcement_views (tenant_id, seen_at DESC);

-- -----------------------------------------------------------------------------
-- 5. RLS, UMA POLICY POR COMANDO
-- -----------------------------------------------------------------------------
ALTER TABLE product_announcements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_announcement_views ENABLE ROW LEVEL SECURITY;

-- 5.1 O REQUISITO DO HUGO VIVE AQUI DENTRO.
-- ### A LINHA `-- COORTE` DESTA POLICY ESTÁ REVOGADA (2026-08-04). ###
-- A JANELA continua sendo predicado de banco (é o que a torna imune a bug de
-- cache no front). A COORTE saiu daqui: é condicional por linha
-- (`cohort_gated`) e mora só em `lib/onboarding/resolve.ts`. A policy que de
-- fato existe é `pa_select_eligible`, em
-- `supabase/migrations/20260803000000_onboarding_novidades.sql`.
DROP POLICY IF EXISTS pa_select_audience ON product_announcements;
CREATE POLICY pa_select_audience ON product_announcements FOR SELECT
  TO authenticated
  USING (
    is_published = true
    AND (
      kind = 'product_onboarding'
      OR (now() >= starts_at AND now() < ends_at)                    -- JANELA
    )
    AND (tenant_ids IS NULL OR auth_tenant_id() = ANY (tenant_ids))  -- ESCOPO
    AND (auth_role_set() && audience_roles)                          -- PÚBLICO
    AND (cohort_gate = false
         OR auth_announcements_since() < starts_at)                  -- COORTE
  );

-- 5.2 super_admin, por comando, nunca FOR ALL.
DROP POLICY IF EXISTS pa_select_super_admin ON product_announcements;
CREATE POLICY pa_select_super_admin ON product_announcements FOR SELECT
  TO authenticated USING (is_super_admin());

DROP POLICY IF EXISTS pa_insert_super_admin ON product_announcements;
CREATE POLICY pa_insert_super_admin ON product_announcements FOR INSERT
  TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS pa_update_super_admin ON product_announcements;
CREATE POLICY pa_update_super_admin ON product_announcements FOR UPDATE
  TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS pa_delete_super_admin ON product_announcements;
CREATE POLICY pa_delete_super_admin ON product_announcements FOR DELETE
  TO authenticated USING (is_super_admin());

-- SEM policy de escrita para admin de tenant, de propósito. Admin da Cory
-- escrevendo aqui atingiria os outros 3 tenants.

-- 5.3 views: cada um cuida das próprias.
DROP POLICY IF EXISTS pav_select_own ON product_announcement_views;
CREATE POLICY pav_select_own ON product_announcement_views FOR SELECT
  TO authenticated USING (user_id = auth.uid() AND tenant_id = auth_tenant_id());

-- O EXISTS prova que o tenant_id denormalizado bate com o tenant real do
-- usuário (mesmo padrão de sp_student_insert, 20260723000000).
DROP POLICY IF EXISTS pav_insert_own ON product_announcement_views;
CREATE POLICY pav_insert_own ON product_announcement_views FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = auth_tenant_id()
    AND EXISTS (SELECT 1 FROM users u
                 WHERE u.id = auth.uid()
                   AND u.tenant_id = product_announcement_views.tenant_id)
  );

DROP POLICY IF EXISTS pav_update_own ON product_announcement_views;
CREATE POLICY pav_update_own ON product_announcement_views FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND tenant_id = auth_tenant_id())
  WITH CHECK (user_id = auth.uid() AND tenant_id = auth_tenant_id());

-- Admin do tenant lê para medir saúde do mecanismo. Somente leitura.
DROP POLICY IF EXISTS pav_admin_select ON product_announcement_views;
CREATE POLICY pav_admin_select ON product_announcement_views FOR SELECT
  TO authenticated
  USING (tenant_id = auth_tenant_id() AND 'admin' = ANY (auth_role_set()));

DROP POLICY IF EXISTS pav_select_super_admin ON product_announcement_views;
CREATE POLICY pav_select_super_admin ON product_announcement_views FOR SELECT
  TO authenticated USING (is_super_admin());

-- SEM DELETE para humano, nem para super_admin. Apagar view re-dispara
-- modal ou tour: é a operação perigosa que sempre acaba virando DELETE sem
-- WHERE em banco de produção compartilhada. Re-exibir é UPDATE de version.

-- -----------------------------------------------------------------------------
-- 6. Estado derivado e dry run de alcance
-- -----------------------------------------------------------------------------
-- Estado derivado de datas, NUNCA digitado. Digitar estado cria "publicado mas
-- invisível", o erro mais caro deste tipo de sistema.
CREATE OR REPLACE FUNCTION announcement_state(a product_announcements) RETURNS TEXT
LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF a.kind = 'product_onboarding' THEN
    RETURN CASE WHEN a.is_published THEN 'permanente' ELSE 'rascunho' END;
  END IF;
  IF NOT a.is_published   THEN RETURN 'rascunho';  END IF;
  IF now() <  a.starts_at THEN RETURN 'agendado';  END IF;
  IF now() >= a.ends_at   THEN RETURN 'encerrado'; END IF;
  RETURN 'no ar';
END;
$$;

-- O ÚNICO gate humano do desenho. Responde "vai aparecer para quantas pessoas"
-- ANTES de publicar, porque público errado é a única falha irreversível.
CREATE OR REPLACE FUNCTION preview_announcement_reach(p_key TEXT)
RETURNS TABLE (tenant_id UUID, role TEXT, eligible BIGINT)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'preview_announcement_reach: apenas super_admin';
  END IF;

  RETURN QUERY
  SELECT u.tenant_id, u.role, count(*)::BIGINT
  FROM product_announcements a
  JOIN users u ON u.deleted_at IS NULL AND u.status = 'active'
  LEFT JOIN LATERAL (
    SELECT COALESCE(array_agg(DISTINCT x.r), ARRAY[]::TEXT[]) AS roles
    FROM (SELECT u.role AS r
          UNION SELECT ur.role FROM user_roles ur WHERE ur.user_id = u.id) x
  ) hats ON true
  WHERE a.key = p_key
    AND (a.tenant_ids IS NULL OR u.tenant_id = ANY (a.tenant_ids))
    AND (hats.roles && a.audience_roles)
    AND (a.cohort_gate = false
         OR (u.announcements_since IS NOT NULL AND u.announcements_since < a.starts_at))
  GROUP BY u.tenant_id, u.role
  ORDER BY u.tenant_id, u.role;
END;
$$;

COMMIT;
```

---

## 4. A regra de elegibilidade, completa

A regra vive na policy de SELECT (`pa_select_audience` acima). O app apenas faz `SELECT`, e não existe caminho de código alternativo capaz de entregar anúncio vencido ou acumulado.

> **Condição 4 (`CORTE DO NOVO`) REVOGADA em 2026-08-04.** As condições 1 a 3
> permanecem (a 1, a janela, é a inegociável). A quarta saiu da RLS: a coorte é
> opt-in por linha (`cohort_gated`) e é avaliada só em
> `lib/onboarding/resolve.ts`. Mantida abaixo apenas como registro do rascunho.

```sql
is_published = true
E ( kind = 'product_onboarding'                                  -- tour: sem janela
    OU (now() >= starts_at AND now() < ends_at) )                -- 1. JANELA ABERTA
E ( tenant_ids IS NULL OR auth_tenant_id() = ANY(tenant_ids) )   -- 2. ESCOPO
E ( auth_role_set() && audience_roles )                          -- 3. PÚBLICO
E ( cohort_gate = false
    OR auth_announcements_since() < starts_at )                  -- 4. CORTE DO NOVO
```

O "já viu" NÃO está na policy, ele é um `NOT EXISTS` no server action que monta a fila, porque precisa carregar a ordem e o teto:

```sql
SELECT a.key, a.content_key, a.surface, a.trigger_route, a.version
  FROM product_announcements a                    -- RLS já aplicou 1 a 4
 WHERE a.kind = 'announcement'
   AND NOT EXISTS (                               -- 5. JÁ VIU
         SELECT 1 FROM product_announcement_views v
          WHERE v.announcement_id      = a.id
            AND v.announcement_version = a.version
            AND v.user_id              = auth.uid())
 ORDER BY a.priority ASC, a.ends_at ASC           -- 6. ORDEM
 LIMIT 1;                                         -- 7. TETO: 1 MODAL POR SESSÃO
```

**`ORDER BY priority ASC, ends_at ASC`:** prioridade é o controle explícito de quem lança, e `ends_at` é o desempate correto, quem morre primeiro aparece primeiro, senão a janela mais curta expira sem ser vista.

**`LIMIT 1`:** no máximo um modal por sessão. Ao dispensar, o próximo só aparece na sessão seguinte. Três interrupções em fila viram uma parede a ser fechada, e a pessoa aprende a fechar antes de ler, o que envenena o próximo anúncio que realmente importar.

**O registro é o cadeado.** O direito de exibir se conquista com o `INSERT ... ON CONFLICT DO NOTHING`, executado ANTES do render. Trade-off assumido de forma explícita: um crash entre o INSERT e o render queima o anúncio para aquela pessoa. Mostrar duas vezes é pior que perder uma vez, dado que o objetivo declarado é não incomodar.

**Regras de precedência e supressão, no app:**

| Regra | Comportamento |
|:---|:---|
| Modal vence tour | Se há modal pendente para a rota, o tour espera a próxima visita. Sem isso, o dia do lançamento entrega 3 telas de modal seguidas de 6 passos de tour, 9 interrupções antes de a pessoa tocar em qualquer controle |
| Rotas silenciosas | Nenhum modal em `/assessments/*` nem em `/courses/*/chapters/*/present`. Interromper um quiz com "olha a novidade" é o jeito mais rápido de o aluno passar a fechar tudo no reflexo |
| Modo "ver como aluno" | Anúncios suprimidos por completo, nenhuma linha gravada. O repo já queimou cinco tabelas com bugs de chapéu (20260729000000 e 20260729120000). Gravar `seen_at` em nome de outra pessoa queima o anúncio dela sem que ela tenha visto nada |
| Preview | Por query param, e NÃO grava linha. Sem isso, quem revisa queima a própria exibição e polui a métrica de cobertura |

---

## 5. Casos de borda

| Caso | Comportamento | Por quê |
|:---|:---|:---|
| **Aluno volta depois de 3 meses, 2 janelas abertas** | Vê UM modal, o de menor `priority`. O segundo só na sessão seguinte, e só se ainda estiver em janela | Quem sumiu 3 meses tem problema de evasão, não de desatualização. Empilhar interrupção em quem está prestes a abandonar otimiza a métrica errada |
| **Aluno entra no MEIO da janela (dia 10 de 21)** | NÃO vê. `announcements_since` é cunhado agora, logo é maior que `starts_at` | Para ele a palavra "novidade" é literalmente falsa. Ele recebe a feature pela ajuda contextual e pelo `help_url`. Custo do gate: zero, é derivado, nunca digitado |
| **Copy do anúncio mudou (vírgula, clareza, screenshot)** | NÃO reabre para ninguém, nunca. A chave é a identidade do evento | Reexibir modal por revisão de copy é o acúmulo do Hugo em câmera lenta. Reabrir exige `version + 1`, que é um `UPDATE` deliberado e visível |
| **Alguém esqueceu de fechar a janela** | Impossível. `ends_at` é NOT NULL para anúncio e o CHECK corta acima de 35 dias. Fecha sozinho por decurso de prazo | Não existe janela eterna cadastrável. Renovar é uma decisão, não um esquecimento. O sistema não depende de ninguém lembrar de nada |
| **Operador cadastra `ends_at` no passado ou erra o ano** | O anúncio NUNCA aparece. Falha silenciosa e completa | É o modo de falha MAIS PROVÁVEL do desenho e o mais desconfortável. Falha segura, mas invisível. Mitigação obrigatória: `announcement_state()` mostra "encerrado" na consulta, e o passo de verificação no dia seguinte (`seen = 0` com estado "no ar" = data errada) pega em 24h |
| **`starts_at` menor ou igual ao carimbo do backfill da migration** | NINGUÉM vê. Todos os ~134 carimbados recebem `announcements_since = instante da migration`, e a condição `announcements_since < starts_at` falha para todos ao mesmo tempo | O modo de falha mais perigoso do desenho inteiro, porque não gera erro, só silêncio. É o único que ganha teste de CI obrigatório antes do primeiro lançamento |
| **48 alunos que nunca logaram (34 deles na Cory)** | Ficam `NULL` no backfill, cunham o carimbo no primeiro acesso real, e por isso não veem nada cuja janela abriu antes desse acesso | Conta velha com experiência zero é um recém-chegado, não um veterano. Ancorar em criação de linha classificaria 133 de 185 contas como "veteranas" e despejaria nelas o anúncio de mudanças que nunca viveram |
| **Veterano real de maio, sem `last_seen_at`** (coluna só existe desde 2026-07-14) | É elegível. O backfill usa existência de linha em `sessions` ou `chapter_view_progress`, não timestamp | Falso negativo aqui é pior que falso positivo, porque some em silêncio. O veterano perderia justamente o anúncio desenhado para ele |
| **Tenant novo (5o cliente) entra no meio da janela** | Ninguém daquela empresa vê os anúncios de agosto, sem nenhuma ação do operador | Cliente novo não tem "antes", logo não tem "novidade". Sai de graça do `tenant_ids IS NULL` mais o gate de coorte |
| **Aluno com duas abas ou dois dispositivos** | A que ganha o `INSERT` exibe, a outra cala | Ver a mesma novidade duas vezes na mesma sessão é a versão em miniatura do acúmulo, e destrói a credibilidade do mecanismo mais rápido que qualquer outra falha |
| **Feature revertida por rollback depois do anúncio no ar** | A linha some junto, porque nasceu na migration do mesmo PR. Quem viu fica com linha órfã, o que é inofensivo | É o dividendo de a linha nascer no commit da feature. Com cadastro manual, a linha sobreviveria ao componente e o aluno receberia modal em branco |
| **`content_key` aponta para componente que o refactor apagou** | O CI falha, não a tela do aluno | É o único risco real de o metadado morar em tabela enquanto o conteúdo mora em React, e custa um teste para fechar |
| **Deploy atrasa e `starts_at` fica no passado** | A janela encurta proporcionalmente ao atraso | Encurtar em silêncio é aceitável para atraso de dias. Expirar em silêncio não é, e é o que o teste de CI acima cobre |
| **Aluno abre `/jornada` com modal N2 pendente e tour nunca visto** | Vê o modal. O tour espera a próxima visita | Sem precedência, o dia do lançamento entrega 9 interrupções seguidas |
| **Tour de 6 passos abandonado no passo 3** | Retoma do passo 4 na próxima visita, via `last_step`. Não reinicia, não expira | Tour é disparado por lugar, não por tempo. Recomeçar do zero é punição por ter saído da tela |
| **`announcements_since` NULL por dado legado** | Não vê o anúncio | Falha em direção segura de propósito: dado ruim resulta em MENOS exibição. Melhor uma pessoa deixar de ver do que 181 verem o errado |

---

## 6. O tour do construtor

**NÃO EXPIRA. E o `CONSTRAINT pa_window_by_kind` recusa gravar data numa linha de tour, para que a decisão não dependa de ninguém lembrar.**

As três lentes convergiram, e por caminhos diferentes. A justificativa que decide:

**1. O gatilho por data erra nas duas direções ao mesmo tempo.** Com janela de 3 semanas, o tour dispararia para alunos que nunca abrem o construtor (ruído para as 181 pessoas) e NÃO dispararia para quem abre o construtor pela primeira vez em outubro (que é exatamente quem precisa). Um gatilho que erra nos dois sentidos está modelando a coisa errada. O tour não responde "o que mudou", responde "onde fica o quê", e essa é uma pergunta que a pessoa faz quando CHEGA na tela, não no dia em que a tela nasceu.

**2. O teste da frase.** Se a frase envelhece, o artefato tem janela. Se ela continua verdadeira em 2028, não tem. "A Jornada chegou" envelhece. "Como montar sua jornada" não.

**3. A assimetria é absurda.** Custo de manter: zero, o tour não interrompe ninguém, ele só existe para quem já está lá dentro por vontade própria, e ele não entra no ritual de lançamento (sem data para cadastrar, sem janela para fechar, sem `seen` para conferir). Custo de expirar: permanente, todo aluno futuro entra numa tela com 6 controles sem explicação. Não é uma decisão difícil, é assimétrica.

**4. Não é o anúncio da Jornada.** São dois objetos que sobem no mesmo PR e morrem separados. O modal de 3 telas ("a Jornada chegou") é anúncio e morre em 31/08. O tour de 6 passos ("estes são os controles") dispara na primeira visita, para sempre. Se fossem um objeto só, ou o tour morreria em setembro, ou o anúncio viveria para sempre.

**O que o tour precisa e o anúncio não dá: `version`.** Tour não envelhece por calendário, envelhece por mudança de tela. Quando o construtor for redesenhado de verdade, o tour v1 passa a ensinar uma tela que não existe mais, o que é pior que não ter tour. A saída é `version` de 1 para 2, e a chave única faz todos verem de novo. Datar um tour é usar o relógio para medir uma coisa que se mede em commits.

**Emenda obrigatória (senão o tour não pode ser o `help_url` de N2):** o construtor precisa de um "Rever o tour" discreto no cabeçalho. Sem isso, quem pulou não tem caminho de volta e o único ensino da tela vira evento de tiro único. Com isso, o tour deixa de ser evento e vira a casa permanente do ensino do construtor, que é exatamente o que autoriza o anúncio de N2 a morrer em 28 dias sem deixar buraco.

**Verificação, deve FALHAR de propósito:**
```sql
UPDATE product_announcements SET ends_at = now() + interval '30 days'
 WHERE key = 'jornada-builder-tour';
-- esperado: violação de pa_window_by_kind
```

---

## 7. O caso de hoje

Hoje é sábado, 01/08/2026. Início na segunda, 03/08, 09:00. Fusos em `-03` EXPLÍCITOS, porque data pura faria o anúncio sumir 3 horas antes no Brasil e ninguém entenderia por quê.

N1 e N2 começam JUNTOS e são serializados por `priority` (um modal por sessão), não por datas escalonadas. Escalonar por data atrasaria o anúncio da Jornada em 3 semanas sem motivo.

**Público de N1, verificado no repo, não presumido:** a tabela "Meu ritmo" com as colunas Percorrido e Conclusão lado a lado vive em `apps/web/src/app/(platform)/engagement/_components/roster-tab.tsx` e nas tabelas de analytics, e `/engagement` é gated por `ENGAGEMENT_ACCESS_ROLES = ["admin", "manager", "instructor", "super_admin"]`. **`leader` não tem acesso e `student` não tem acesso.** Disparar N1 para 181 alunos seria ruído para gente que nem consegue abrir a tela.

```sql
-- N1: Percorrido x Conclusão. Público GESTOR. 21 dias.
INSERT INTO product_announcements
  (key, version, kind, surface, title, content_key, help_url,
   audience_roles, tenant_ids, cohort_gate, priority,
   starts_at, ends_at, is_published)
VALUES
  ('percorrido-vs-conclusao', 1, 'announcement', 'modal',
   'Percorrido e Conclusão são dois números diferentes',
   'PercorridoVsConclusao',
   '/help#percorrido-vs-conclusao',
   ARRAY['admin','manager','instructor'],   -- verificado contra ENGAGEMENT_ACCESS_ROLES
   NULL,                                    -- todos os 4 tenants
   true,                                    -- só quem já estava aqui
   10,                                      -- vem antes de N2
   TIMESTAMPTZ '2026-08-03 09:00:00-03',
   TIMESTAMPTZ '2026-08-24 23:59:59-03',    -- 21 dias
   true)
ON CONFLICT (key) DO NOTHING;

-- N2: Jornada, modal de 3 telas. Público ALUNO. 28 dias.
INSERT INTO product_announcements
  (key, version, kind, surface, title, content_key, help_url,
   audience_roles, tenant_ids, cohort_gate, priority,
   starts_at, ends_at, is_published)
VALUES
  ('jornada-intro', 1, 'announcement', 'modal',
   'Agora você monta a sua Jornada',
   'JornadaIntro3Telas',
   '/help#jornada',
   ARRAY['student','leader','manager','admin','instructor'],
   NULL, true, 20,
   TIMESTAMPTZ '2026-08-03 09:00:00-03',
   TIMESTAMPTZ '2026-08-31 23:59:59-03',    -- 28 dias, ação maior pede janela maior
   true)
ON CONFLICT (key) DO NOTHING;

-- N2b: TOUR do construtor. NÃO É ANÚNCIO. Sem datas (o CHECK proíbe).
INSERT INTO product_announcements
  (key, version, kind, surface, title, content_key, help_url,
   trigger_route, audience_roles, tenant_ids, cohort_gate, priority,
   starts_at, ends_at, is_published)
VALUES
  ('jornada-builder-tour', 1, 'product_onboarding', 'tour',
   'Como montar sua jornada',
   'JornadaBuilderTour6Passos',
   '/help#jornada-construtor',
   '/jornada',
   ARRAY['student','leader','manager','admin','instructor'],
   NULL,
   false,                                   -- obrigatório: pa_onboarding_no_cohort
   50,
   NULL, NULL,                              -- obrigatório: pa_window_by_kind
   true)
ON CONFLICT (key) DO NOTHING;
```

**Pré-condições antes de rodar os INSERTs:**

1. Migration da seção 3 aplicada, e `starts_at` (03/08 09:00) é POSTERIOR ao instante do backfill. Se não for, ninguém vê nada e ninguém descobre.
2. `/help` ganha as três âncoras (`#percorrido-vs-conclusao`, `#jornada`, `#jornada-construtor`). Hoje `apps/web/src/app/(platform)/help/page.tsx` tem FAQ hardcoded e nenhuma âncora. Sem isso, `help_url` aponta para o vazio e a expiração passa a criar buraco.
3. Botão "Rever o tour" no cabeçalho do construtor.
4. Conferir o backfill: `SELECT count(*) FILTER (WHERE announcements_since IS NOT NULL) AS carimbados, count(*) FILTER (WHERE announcements_since IS NULL) AS novos FROM users;` Esperado: ~136 e ~48.
5. `SELECT * FROM preview_announcement_reach('percorrido-vs-conclusao');` deve mostrar 0 alunos.

**Testes de CI que a story precisa entregar junto:**

```
1. starts_at de toda entrada publicada é POSTERIOR ao timestamp do backfill.
2. nenhuma entrada listada tem ends_at <= now() (anúncio expirado sai do catálogo).
3. todo content_key publicado existe no mapa de componentes React.
4. usuário criado agora enxerga ZERO linhas de kind='announcement'.
   Este é o requisito literal do Hugo virando assertiva, não promessa.
5. nenhuma policy com polcmd = '*' nas duas tabelas novas.
6. INSERT com ends_at = starts_at + 90 days FALHA.
7. UPDATE pondo ends_at numa linha de tour FALHA.
```

---

## 8. O que NÃO entra nesta versão

| Fora de escopo | Por quê |
|:---|:---|
| Tela de admin CRUD `/super-admin/novidades` | 1 a 1,5 dia de dev sobre um formato de modal que vai mudar nas duas primeiras rodadas. O cadastro por migration no PR é revisável, versionado e custa 2 minutos. Construir no TERCEIRO anúncio, não no primeiro |
| Página "Novidades" com histórico pull | Boa ideia, e é a única forma de ter arquivo sem reabrir acúmulo. Mas é superfície nova e não é pré-condição de nada aqui. Depois |
| Tira compacta para 2 ou mais releases simultâneos | O `LIMIT 1` já resolve o problema real (parede de modais). A tira é otimização de um caso que ainda não aconteceu |
| Cooldown de 14 dias e `EXCLUDE` de frequência como constraint | Vira restrição física assim que existir um terceiro anúncio. Com dois, o teto de 1 por sessão basta, e o `EXCLUDE` exigiria `btree_gist` só para isso |
| Cron de purga e consolidação de `stats` | Higiene, nunca capacidade: ~3,6k linhas por ano é nada. Quando entrar, precisa das duas travas (só `kind='announcement'`, e só se o agregado já existe), senão um DELETE bem intencionado re-dispara o tour para os 181 alunos |
| Tabela `announcement_overrides` (break-glass) | Redundante neste desenho. Com os metadados em tabela, desligar um anúncio quebrado é `UPDATE ... SET is_published = false`, sem deploy. O override só fazia sentido se o catálogo vivesse inteiro no repo |
| `dwell_ms` e a contra-métrica anti-spam | `dismissed_at - seen_at` já dá o mesmo sinal com as colunas existentes. Medir a partir do segundo lançamento |
| Migrar `users.onboarding_completed` para este mecanismo | O booleano antigo continua vivo e intocado. Unificar é outro trabalho, com outro risco |
| Grok, Composio ou qualquer disparo externo | Nada aqui sai da plataforma |

---

## 9. Divergências entre as lentes, e o veredito

| # | Divergência | Decisão e razão |
|:---|:---|:---|
| 1 | **Catálogo no repo (TS) x catálogo em tabela** | **Dividido pelo eixo certo, não pela metade.** Conteúdo em React (o argumento decisivo da lente de dados: o tour está amarrado a seletores DOM, e uma linha de tabela apontando para componente refatorado é ponteiro pendurado). Metadados em tabela (o argumento decisivo das outras duas: a janela precisa viver na RLS para que um bug de cache do front não ressuscite anúncio de 2026). A linha nasce na migration do PR da feature, o que recupera o versionamento, a revisão em PR e o rollback atômico que a lente de dados queria |
| 2 | **Âncora: `announcements_since` x `first_seen_at` x `users.created_at`** | **`announcements_since` vence, com backfill por EXISTÊNCIA de evidência.** A lente de dados mediu produção e provou 100% de contradição em `created_at` no tenant `vertice-industria` e 71% no total. Isso derruba a proposta que usa `created_at` cru, e derruba também a que usa `LEAST(created_at, MIN(sessions))`, porque ela ainda importa o timestamp contaminado. Carimbo por existência é o único imune. Preço conhecido e pago: nenhum anúncio pode começar antes do backfill, o que virou o teste de CI número 1 |
| 3 | **Teto da janela: 28 x 35 x 45 dias** | **35.** 28 é o "um mês" literal, mas um lançamento que começa numa terça e quer fechar quatro semanas depois numa sexta estoura por dois dias e obriga um deploy só por isso. 45 já não é mais "um mês no máximo". Default de cadastro continua 21 |
| 4 | **Fila: 2 por sessão x 1 por sessão** | **1.** Duas lentes convergiram no mais conservador. Ordem por `priority ASC, ends_at ASC`, que junta o controle explícito de quem lança com o desempate correto (quem morre antes aparece antes) |
| 5 | **Público de N1** | **Só gestor**, e não por opinião: `/engagement` é gated por `["admin","manager","instructor","super_admin"]`. A proposta que incluía `leader` estava errada contra o código. `student` também sai |
| 6 | **Aluno que entra no meio da janela vê?** | Convergência total das três: **não vê**. Mantido |
| 7 | **O tour expira?** | Convergência total das três: **não**. Mantido, com o CHECK do banco tornando a expiração inexpressável e com a emenda do "Rever o tour" |

**A lente de operações levantou um ponto que ninguém contestou e que decide a viabilidade:** o sistema não é o custo, o texto é. Todo o ritual acima cabe em 20 a 30 minutos, dos quais 15 são escrever a copy. Qualquer coisa que adicione mais de 5 minutos de burocracia acima do texto vai ser pulada no terceiro lançamento, e é por isso que a tela de CRUD ficou fora e as travas foram todas para o schema.