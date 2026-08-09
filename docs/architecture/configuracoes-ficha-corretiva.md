# Ficha Corretiva — Hub de Configurações (pós-estudo Stratws One)

> **Autor:** REGENTE · **Data:** 2026-07-22
> **Insumos:** mockup aprovado (`JARVIS/apps/hub-discovery/configuracoes-hub.html`), mapa do estado atual (`configuracoes-estado-atual.md`), estudo da referência (`configuracoes-referencia-stratws.md`) e **verificação direta do schema/migrations** deste repo.
> **Regra de ouro:** correção só entra aqui se nasce de gap VERIFICADO (mapa ou estudo), nunca de suposição. Visual não muda — decisão do Hugo, o nosso mockup é a direção.

---

## 0. Fatos verificados no repo (âncoras desta ficha)

| Fato | Evidência |
|:---|:---|
| `users.reports_to` existe no banco e é usado pelo scoping de manager | `supabase/migrations/20260702222743_auth_direct_student_ids.sql` linhas 32/65 (`WHERE u.reports_to = _node`) |
| `users.job_role_id` existe no banco (FK para job_roles + índice) | `supabase/migrations/20260229000000_trails_job_roles.sql` linhas 135-138 |
| **DRIFT:** nenhuma das duas colunas está no Drizzle `packages/database/src/schema/users.ts` | Leitura direta do arquivo (só id, tenantId, email, fullName, reportName, role, status, avatarUrl, profile, onboarding, timestamps) |
| Nenhum campo tipo matrícula/terceiro existe hoje | grep em `packages/database/src/schema/*.ts` sem resultado |

O drift é uma correção por si: código novo que use Drizzle não enxerga `reports_to`/`job_role_id`, e a tela de Usuários do hub vai precisar dos dois.

---

## BLOCO A — Correções que entram no épico JÁ (sem decisão de arquitetura pendente)

### A1. Corrigir o drift do Drizzle (pré-requisito técnico)
- **Gap:** colunas reais invisíveis ao ORM.
- **Correção:** adicionar `reportsTo` (self-FK) e `jobRoleId` (FK job_roles) em `users.ts`. SEM migration — as colunas já existem; é só o mapa do ORM.
- **Onde entra:** primeira story técnica do épico (junto do shell). Custo **P**. Gate: `tsc` + vitest.

### A2. Ficha do usuário ganha vínculo organizacional (padrão Stratws, dados JÁ nossos)
- **Gap:** o banco tem organograma (`reports_to`) e cargo (`job_role_id`), mas a UI de `/admin/users` não expõe nenhum dos dois — hoje só role/status/áreas.
- **Correção:** no drawer de edição de usuário do hub, adicionar campos **Superior imediato** (picker de usuário, escreve `reports_to`) e **Cargo** (select de job_roles). É a versão nossa da aba "Profissional" do Stratws, sem criar nada novo de schema.
- **Onde entra:** story "Seção Usuários" do hub. Custo **M**. Mockup: delta pequeno no drawer (registrado na story; não reabre o HTML sem pedido do Hugo).

### A3. Ações administrativas na ficha do usuário
- **Gap (estudo §2.3):** Stratws oferece Redefinir Senha e Logs de Acesso do indivíduo na ficha; nós não temos nenhum dos dois.
- **Correção:**
  1. **Redefinir senha** — ação que dispara email de recovery via Supabase Auth admin (`generateLink`/reset). Endpoint novo `POST /api/admin/users/[id]/reset-password`, guard requireAdmin, auditado.
  2. **"Ver ações deste usuário"** — link da ficha para a seção Auditoria já filtrada por ator/alvo (é o nosso equivalente SUPERIOR ao "Logs de Acesso" deles: ações, não só último acesso; o último acesso já está na listagem).
- **Onde entra:** stories "Seção Usuários" + "Auditoria". Custo **M**. Sem migration.

### A4. Auditoria: filtro por pessoa + gravação ampla (reforço, já era o plano)
- **Gap (mapa gap 1 + estudo §4):** a referência nem tem trilha de ações — a nossa Auditoria é diferencial real. O estudo acrescenta um requisito: filtro **por ator e por alvo** (para o link do A3.2 funcionar).
- **Correção:** a story de Auditoria inclui: instrumentar handlers admin (role change, convite, área, chave, webhook, settings, desativação), UI com filtros período/tipo/**pessoa**, export CSV (já no mockup).
- **Onde entra:** story "Auditoria" ([NOVO] do épico). Custo **G** (é o maior [NOVO], já previsto). Migration: NENHUMA (tabela `platform_audit_log` pronta).

### A5. Subtítulo descritivo por seção (padrão do diretório Stratws)
- **Gap:** nenhum — o mockup já faz nos panel-headers. Entra na ficha só como **requisito de aceitação**: toda seção do hub DEVE ter a descrição de 1 linha (não perder na migração das 16 páginas).
- **Onde entra:** critério de aceite transversal do épico. Custo **zero**.

## BLOCO B — Correções condicionadas a DECISÃO do Hugo (arquitetura antes de tela)

### B1. Modelo de permissões granulares: "grants" por usuário OU grupo (gap 9 + estudo §2.4)
- **O que a referência ensina:** papel global raso + **regras granulares** atribuíveis a usuário ou a grupo + escopo por unidade. Nosso `instructor_permissions` já prova o padrão para 1 papel; a generalização natural é uma tabela única de grants:
```sql
-- PROPOSTA (só com GO; não aplicar):
CREATE TABLE permission_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('user','manager_group')),
  subject_id uuid NOT NULL,
  permission_key text NOT NULL,          -- ex.: 'analytics.view_raw_reflections', 'users.invite'
  granted_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, subject_type, subject_id, permission_key)
);
```
- **Decisão do Senhor:** generalizar agora (tabela acima + guards consultam grants além do role), ou manter enum fechado + `instructor_permissions` e só CONSOLIDAR a visualização (a tela Perfis & Permissões do mockup funciona nos dois cenários — ela mostra a matriz real).
- **Recomendação do REGENTE:** fase 1 do épico SÓ consolida a visualização (zero migration); grants viram story própria pós-GO. Custo se aprovado: **G**.

### B2. Hierarquia de unidades (gap 8 + estudo §2.2/§3.1)
- **Nomenclatura cravada pelo Hugo (2026-07-22):** **Unidade = site físico** (ex.: Unidade Minas Gerais, Unidade Ribeirão Preto) e **Área = departamento** (Operações, Comercial, RH, Logística). A tabela `areas` de hoje corresponde às ÁREAS; o que falta é o nível **Unidade** ACIMA delas — não uma árvore genérica, mas dois níveis nomeados: Unidade > Área. O mockup já reflete isso (grupos "UNIDADE MINAS GERAIS" / "UNIDADE RIBEIRÃO PRETO" na seção Unidades & Áreas, com badge [NOVO] no nível Unidade).
- **O que a referência ensina:** os 3 padrões prontos — `parent_id` (ou tabela `units` própria com `areas.unit_id`), flag **"acesso às subordinadas"** no vínculo usuário-unidade, e **cascade opt-in** de configuração ("manter esta configuração nas subordinadas").
- **Decisão do Senhor:** assumir flat (como hoje) ou introduzir árvore. Mexe em TODO o scoping de analytics (E9), então a ficha só registra o desenho de referência:
```sql
-- PROPOSTA (só com GO; não aplicar):
ALTER TABLE areas ADD COLUMN parent_id uuid REFERENCES areas(id) ON DELETE SET NULL;
ALTER TABLE user_areas ADD COLUMN include_descendants boolean NOT NULL DEFAULT false;
```
- **Área que permeia 2+ unidades (pergunta Hugo 2026-07-22):** o desenho recomendado é N:N com identidade única — a área é UMA (mesmo nome, mesmos cursos/trilhas), e um vínculo área×unidade diz onde ela está presente; a pessoa pertence à área NUMA unidade; o gestor da área pode ser **local** (uma unidade) ou **corporativo** (todas). É a promoção do conceito que o produto JÁ tem nos `manager_groups` (`is_corporate` + `manager_group_units` N:N com áreas) a estrutura de 1ª classe:
```sql
-- PROPOSTA (só com GO; não aplicar):
CREATE TABLE units (            -- site físico: "Minas Gerais", "Ribeirão Preto"
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL
);
CREATE TABLE area_units (       -- presença da área nas unidades (área corporativa = 2+ linhas)
  area_id uuid NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  PRIMARY KEY (area_id, unit_id)
);
ALTER TABLE user_areas ADD COLUMN unit_id uuid REFERENCES units(id); -- pessoa está na área NUMA unidade
-- gestor local vs corporativo: escopo do gestor referencia area_id (+ unit_id opcional; NULL = corporativo)
```
- **Recomendação:** manter flat neste épico (o mockup já comunica o alvo: grupos por unidade + seção "Áreas corporativas" [NOVO]). Custo se aprovado no futuro: **G** (scoping inteiro).

### B3. Campos Matrícula e Terceiro no usuário (estudo §2.3, item 5 da síntese)
- **O que a referência ensina:** `Matrícula` (chave de RH, útil como chave de match no **bulk import CSV**) e flag `Terceiro` (prestador externo, filtrável).
- **Proposta:** `ALTER TABLE users ADD COLUMN registration_code text; ADD COLUMN is_third_party boolean DEFAULT false;` — migration pequena, mas é migration ⇒ **precisa de GO explícito** (produção compartilhada).
- **Recomendação:** aprovar junto com a story de bulk import (a matrícula paga o custo lá: match de planilha de RH por matrícula, não só email). Custo **P** (com GO).

## BLOCO C — O que explicitamente NÃO copiamos (registrado para não rediscutir)

| Item Stratws | Por que não |
|:---|:---|
| Papel global de só 3 níveis | Nossos 6 roles + multi-chapéu são mais expressivos para LMS; o que importamos é o conceito de grants (B1), não o achatamento |
| Cargos de 1 campo | O nosso (área, senioridade, descrição, trilhas) é superior — "não copiar para baixo" |
| Personalização Visual (logo + cor de menu) | Nosso whitelabel completo é superior |
| Logs de Acesso como "auditoria" | É só adoção (último acesso por módulo); nossa lista de usuários já tem último acesso e nossa Auditoria cobre ações |
| Search-first (lista vazia até buscar) | Nossa lista paginada com filtros serve melhor o tamanho dos nossos tenants |
| Estrutura versionada por ano (Plano de Gestão) + rollover | Não se aplica ao LMS hoje; anotado como conceito se Academy ganhar ciclos/turmas anuais |
| Config contextual por chips unidade/ano | Nosso tenant-chip já cumpre o papel no multi-tenant |

## D. Consolidação — onde cada correção entra no modelo

| # | Correção | Mockup (seção) | Schema | Story do épico | Custo | Precisa de GO? |
|:--|:---|:---|:---|:---|:--|:--|
| A1 | Drift Drizzle (reports_to, job_role_id) | — | `users.ts` (ORM apenas) | Story técnica da fase 1 | P | Não |
| A2 | Superior imediato + Cargo no drawer | Usuários | nenhum (colunas existem) | Seção Usuários | M | Não |
| A3.1 | Redefinir senha | Usuários | nenhum | Seção Usuários | M | Não |
| A3.2 | "Ver ações deste usuário" | Usuários → Auditoria | nenhum | Auditoria | P | Não |
| A4 | Auditoria com filtro por pessoa + instrumentação | Auditoria | nenhum (tabela pronta) | Auditoria | G | Não |
| A5 | Descrição de 1 linha por seção | todas | — | Critério transversal | zero | Não |
| B1 | permission_grants (usuário OU grupo) | Perfis & Permissões | tabela nova | Story pós-GO | G | **Sim** |
| B2 | Árvore de unidades + acesso a subordinadas | Unidades & Áreas | 2 colunas novas | Fora deste épico | G | **Sim** |
| B3 | Matrícula + Terceiro | Usuários / Convites / Import | 2 colunas novas | Junto do bulk import | P | **Sim** (migration) |

**Sequência proposta dentro do épico:** A1 entra na fase 1 (shell); A2/A3 entram na story da seção Usuários; A4 na story de Auditoria; A5 é aceite transversal. B1/B2/B3 aguardam o GO do Hugo, com B3 acoplado ao bulk import.

---
*Nenhuma migration será aplicada sem GO explícito do Hugo, por escrito, no momento (regra do mandato). Os SQLs acima são PROPOSTAS de desenho.*
