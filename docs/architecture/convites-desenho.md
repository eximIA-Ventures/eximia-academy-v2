# Ciclo de vida de convites, material de decisão

> **Autor:** Aria (@architect) · **Data:** 2026-07-28
> **Para:** Hugo (decisão de desenho) · **Story bloqueada por este documento:** `docs/stories/epic-configuracoes/CFG-2.2.story.md` (fix **F2** do @po)
> **Consome:** CFG-6.1 AC8 (stat "Convites pendentes", Reenviar, Revogar) · **Vizinha:** CFG-2.3 (leitura de `auth.users` via service role)
> **Escopo deste documento:** desenho e comparação. Nenhuma migration foi escrita, nenhum código de aplicação foi tocado, nada foi aplicado em banco.

---

## 1. O problema, em um parágrafo

O mockup de Usuários promete um convite com ciclo de vida (pílula "Convite pendente", "Reenviar convite", "Revogar convite", stat clicável "Convites pendentes"), e o produto não tem onde guardar esse ciclo. Convidar hoje envia um e-mail de convite real pelo Supabase Auth **e**, no mesmo request, insere a pessoa em `public.users` com `status: 'active'`, então quem nunca abriu o e-mail já nasce contado como usuário ativo, indistinguível de quem entrou ontem. Não existe estado "pendente", não existe registro de reenvio, não existe revogação (o mais próximo é a desativação, que só faz sentido para quem já é usuário) e não existe expiração consultável. A decisão pendente não é "como enviar convite" (isso já funciona), é **onde mora o estado do convite**, e ela tem três candidatos no AC2 da CFG-2.2 mais um quarto que o próprio código já usa sem que a story tenha registrado.

---

## 2. Correção de premissa antes de decidir (fato verificado)

A CFG-2.2 Dev Notes afirma que o convite grava `status: 'active'` **"sem generateLink/e-mail de convite formal"**. A primeira metade é verdadeira, a segunda **não é**:

```
apps/web/src/app/api/admin/users/route.ts:188
  await serviceClient.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { tenant_id, role, full_name, report_name },
    redirectTo: `${NEXT_PUBLIC_APP_URL}/auth/accept-invite`,
  })
```

O convite formal do Supabase Auth **já é o mecanismo de convite do produto** desde antes deste épico. Existe rota de aceite (`apps/web/src/app/(auth)/accept-invite/`), existe provisionamento server-side no aceite (`actions.ts`, com o comentário de segurança AUTH-04 explicando que role/tenant vêm do metadata do convite e nunca do cliente), e existe auditoria (`action: "user.invited"`, `route.ts:226`). O que falta não é o convite: é a **representação do estado do convite** no lado do produto.

Isso importa para a decisão porque um dos candidatos (o caminho D abaixo) deixa de ser "adotar uma tecnologia nova" e passa a ser "ler o que já estamos escrevendo".

**Segunda correção, menor:** o gate da CFG-2.2 afirma que `user-admin-handlers.test.ts` "já existe e cobre o fluxo atual (convite grava `status: 'active'`)". O arquivo existe, mas **não tem nenhum caso para o POST de convite**: os 12 `it()` cobrem `PATCH /api/admin/users/[userId]` (campos organizacionais) e `POST .../reset-password`. Verificação: `grep -n "describe\|it(" apps/web/src/app/api/admin/users/__tests__/user-admin-handlers.test.ts` e `grep -n "inviteUserByEmail" <mesmo arquivo>` (zero hits). Qualquer caminho escolhido precisa **criar** o teste do convite, não estendê-lo.

---

## 3. Blast radius medido (comandos, não estimativa)

### 3.1 O grep ingênuo mente por 14x

```bash
grep -rn --include='*.ts' --include='*.tsx' "'active'\|'inactive'\|\"active\"\|\"inactive\"" apps/web/src | wc -l
# 321 ocorrências em 128 arquivos
```

Desses 321, a esmagadora maioria é `enrollments.status`, `sessions.status`, `courses.status`, `questions.status`, `api_keys.status`, `tenants.status`, campanhas e trilhas. Filtrando para o que de fato encosta em `users.status` (varredura estruturada: para cada `.from("users")`, inspecionar as 14 linhas seguintes procurando filtro/select/escrita da coluna `status`):

| Categoria | Call-sites | Arquivos |
|:--|--:|--:|
| Filtros `.eq("status", ...)` sobre `users` | **4** | 4 |
| `SELECT` de `users` que trazem a coluna `status` | **9** | 8 |
| Escritas de `users.status` (insert/update) | **5** | 4 |
| UI que assume o par binário ativo/inativo | **5** | 2 |
| **Total** | **23** | **13** |

### 3.2 Os 23 call-sites, nomeados

**Filtros (4)**, todos hoje significam "esconda quem está inativo", e todos passariam a significar, sem aviso, "esconda também quem está pendente":

| Arquivo | Linha | Efeito de um `'pending'` novo |
|:--|:--|:--|
| `apps/web/src/app/(platform)/admin/areas/[areaId]/page.tsx` | 54 | convidado não aparece como atribuível a uma área (provavelmente **correto**) |
| `apps/web/src/app/(platform)/admin/users/loader.ts` | 168 | stat "Ativos" deixa de contar pendentes (**correto e desejado**) |
| `apps/web/src/app/api/admin/notifications/route.ts` | 120 | convidado não recebe notificação (**correto**) |
| `apps/web/src/lib/leader/team.ts` | 50 | convidado some do time do líder (**correto**, mas silencioso) |

**Escritas (5)**: `api/admin/users/route.ts:205` (insert do convite), `(auth)/accept-invite/actions.ts:72` (insert de fallback no aceite), `api/auth/callback/route.ts:67` (insert no OAuth/SAML), `api/admin/users/[userId]/route.ts:157` (PATCH) e `:217` (DELETE, que é soft delete para `'inactive'`, não remoção).

**Selects (9 em 8 arquivos)**, incluindo dois que **exportam `users.status` para fora do produto**: `apps/web/src/app/api/v1/integration/[...path]/route.ts:227` e `:238` (contrato público da API v1, tipado em `apps/web/src/lib/openapi/registry.ts` como `z.string()` genérico) e `apps/web/src/app/api/privacy/export/route.ts:69` (exportação LGPD).

**UI (5 em 2 arquivos)**: `components/admin/user-list.tsx:54` (`status === "active" ? success : error`), `:243` (`"Ativo" : "Inativo"`), `:277` (`"Desativar" : "Reativar"`), `:171` (reativação chuta `"active"`), e `components/admin/user-profile-dialog.tsx:108` (candidatos a superior imediato filtrados por `status === "active"`).

### 3.3 O número que mais pesa: 1 guard em 23, 0 no compilador

```
packages/database/src/types/supabase.ts:3932
  users: { Row: { ... status: string ... } }
```

`users.status` é `string`, não uma união de literais. E os três clientes Supabase do repo são não tipados (achado já registrado no plano executável §4 e na CFG-2.3 Dev Notes: `client.ts` e `server.ts` sem genérico, `service.ts` com `SupabaseClient<any, ...>`).

Consequência dura: **dos 23 call-sites, exatamente 1 tem guard** (o `z.enum(["active", "inactive"])` do PATCH, `api/admin/users/[userId]/route.ts:10`) e **exatamente 0 seriam apontados por `tsc`** ao introduzir um terceiro valor. É o mesmo modo de falha pelo qual o @po rejeitou P2/P3 na CFG-2.1 (fix F1): mudar o significado de uma coluna viva sem que o compilador avise.

### 3.4 A dependência que ninguém vê: uma função de RLS

```sql
-- supabase/migrations/20260209000000_epic11_super_admin_whitelabel.sql:52-63
CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'super_admin'
    AND status = 'active' AND deleted_at IS NULL);
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

`is_super_admin()` é `SECURITY DEFINER` e é usada como policy `FOR ALL` em `tenants`, `users`, `platform_audit_log`, `manager_groups`, `manager_group_units` e `manager_group_members`. Qualquer desenho que possa deixar um super_admin com `status <> 'active'` o expulsa de todo o painel cross-tenant sem mensagem de erro compreensível. Não é motivo para vetar nada, é um item obrigatório de checklist do caminho B.

### 3.5 A contagem inflada, confirmada

`apps/web/src/app/(platform)/admin/users/loader.ts:159-162` calcula `totalCount` sem nenhum filtro de status. Como o convite insere a linha já `'active'`, **todo convite nunca aceito conta como usuário do tenant hoje**, no total e no "Ativos". O @po tinha razão nesse ponto.

---

## 4. O que o Supabase Auth já guarda (e o que não guarda)

Verificado no tipo real instalado (`@supabase/auth-js@2.98.0`, `dist/module/lib/types.d.ts:340-366`), retornado por `admin.listUsers()` e `admin.getUserById()`:

| Campo | Semântica para convite | Já disponível? |
|:--|:--|:--|
| `invited_at` | quando o convite foi emitido | **sim** |
| `confirmed_at` / `email_confirmed_at` | quando foi aceito (definiu senha) | **sim** |
| `last_sign_in_at` | último acesso (é o objeto da CFG-2.3) | **sim** |
| `deleted_at`, `banned_until` | revogação dura / bloqueio | **sim** |
| `user_metadata` | `tenant_id`, `role`, `full_name`, `report_name` do convite | **sim**, já gravado em `route.ts:188` |
| `expires_at` do link | quando o convite caduca | **não existe como campo**; o TTL é configuração do projeto (`MAILER_OTP_EXP`), não é consultável por convite |
| quem convidou (`invited_by`) | autoria | **não**; hoje só existe no `platform_audit_log` (`user.invited`) |
| atributos organizacionais ricos do convite (área, cargo, unidade) | pré-atribuição | **não** de forma estruturada |

Dois fatos operacionais que mudam o custo do caminho D:

1. **`listUsers` já é chamado no fluxo de usuários.** `apps/web/src/app/api/admin/users/route.ts:108-118` faz `serviceClient.auth.admin.listUsers({ perPage: 1000 })` para popular `last_sign_in_at`. O mesmo payload já traz `invited_at` e `confirmed_at`. Derivar "pendente" custa **zero query nova** nesse caminho.
2. **`listUsers` não é escopado por tenant e é paginado.** Ele lista o projeto Auth inteiro, com teto de página. Isso é aceitável no volume atual (Cory), e é exatamente o ponto fraco do caminho D puro quando o assunto é **contagem** (stat "Convites pendentes"), não exibição.

---

## 5. Os caminhos

### Caminho A, tabela `user_invites` como fonte da verdade

O convite vira um registro próprio. `public.users` só ganha linha quando o convite é aceito.

```sql
CREATE TABLE IF NOT EXISTS user_invites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email        text NOT NULL,
  role         text NOT NULL,
  job_role_id  uuid REFERENCES job_roles(id) ON DELETE SET NULL,
  area_id      uuid REFERENCES areas(id) ON DELETE SET NULL,
  invited_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  invited_at   timestamptz NOT NULL DEFAULT now(),
  resent_at    timestamptz,
  resend_count integer NOT NULL DEFAULT 0,
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  accepted_at  timestamptz,
  accepted_user_id uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_invites_pending
  ON user_invites (tenant_id, lower(email))
  WHERE revoked_at IS NULL AND accepted_at IS NULL;
```
Mais RLS tenant-scoped `admin`/`super_admin` no padrão de `20260530130000_area_gestor.sql` (bypass `is_super_admin()`, `auth_tenant_id()`, `auth_user_role()`).

- **`users_status_check` intocado.** Zero objeto existente alterado.
- **Blast radius de schema: 0 dos 23 call-sites.** Nada que hoje lê `users.status` muda de significado.
- **Blast radius de comportamento: 5 call-sites + 1 decisão de produto.** Parar de inserir em `users` no convite (`route.ts:205`) obriga a rota de aceite a criar a linha (o caminho já existe, `accept-invite/actions.ts:65-74`, hoje é só fallback), e **reverte deliberadamente** a decisão comentada no código: `"Create user profile in public.users so they appear in the user list immediately"`. A lista de usuários passa a ter duas origens (linhas de `users` + linhas de `user_invites`), o que atinge `loader.ts` (select, paginação por cursor em `created_at`, e os 3 counts), `admin/users/page.tsx` e `user-list.tsx`.
- **Reenviar:** `UPDATE user_invites SET resent_at = now(), resend_count = resend_count + 1, expires_at = now() + ttl` mais um novo link do Auth. Uma linha, nunca duplica.
- **Revogar:** `UPDATE ... SET revoked_at = now()` mais `auth.admin.deleteUser(authUserId)`. Nunca existiu usuário `active`, que é a promessa literal do AC3.
- **Reversão:** `DROP TABLE user_invites` mais reverter os 5 call-sites. Sem perda de dado de usuário.
- **Risco próprio:** duas fontes de verdade sobre "quem existe" (o Auth cria o usuário no `inviteUserByEmail` de qualquer forma, então `auth.users` e `user_invites` podem divergir se um passo falhar no meio). Exige um caminho de reconciliação que hoje não existe.

### Caminho B, estender `users.status` com `'pending'`

```sql
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check
  CHECK (status IN ('active','inactive','pending'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_resent_at timestamptz;
```

- **Menor migration dos quatro** e a que mais casa com o modelo mental do mockup (uma pessoa, um estado).
- **Blast radius: os 23 call-sites, dos quais 22 sem guard e 23 sem cobertura de compilador.** É o único caminho em que o significado de um dado vivo em produção muda. Sobra revisão manual, e revisão manual é justamente o que o F1 da CFG-2.1 concluiu que este repo não consegue sustentar.
- **Contrato público vaza:** `/api/v1/integration` passa a devolver `status: "pending"` para integradores que só conhecem dois valores, sem versionamento.
- **`is_super_admin()` fica exposta** (§3.4), assim como o soft delete do DELETE handler, que escreve `'inactive'` por cima de qualquer estado.
- **Reenviar:** `UPDATE users SET invite_resent_at = now(), invite_expires_at = ...`. Simples.
- **Revogar:** aqui está o defeito de fundo. A linha em `users` **já existe**, então revogar é apagar uma linha de `users` (perigoso: FKs em `enrollments`, `sessions`, `manager_group_members`, `platform_audit_log.actor_id`) ou marcar `'inactive'`, que é exatamente o estado que o AC3 diz que revogação **não** pode produzir ("encerra o ciclo sem nunca ter criado um usuário `active`"). **O caminho B não consegue satisfazer o AC3 sem reescrevê-lo.**
- **Reversão:** só é limpa se nenhuma linha estiver em `'pending'` no momento do rollback; senão o `CHECK` antigo rejeita o `ALTER` e é preciso decidir para onde essas linhas vão.

### Caminho C, híbrido do AC2 (tabela pré-aceite + `'pending'` pós-aceite)

Tabela de convite para o ciclo pré-aceite, e `users.status = 'pending'` só para representar "aceitou o convite mas ainda não fez o primeiro login".

- **Paga os dois custos e compra pouco:** cria a tabela (custo do A) **e** mexe no `users_status_check` de produção (custo do B, com os mesmos 23 call-sites e o mesmo problema em `is_super_admin()`).
- **O estado que ele adiciona já existe em outro lugar:** "aceitou mas nunca logou" é `confirmed_at IS NOT NULL AND last_sign_in_at IS NULL` no Auth, e `last_sign_in_at` é precisamente o dado que a **CFG-2.3 já vai trazer**. O terceiro estado do C nasce redundante com a story vizinha.
- **Nenhum requisito lido (mockup, `SPEC-usuarios-v2.md`, CFG-6.1 AC8) pede distinguir "aceitou mas não logou" de "ativo".** É complexidade sem demanda.
- Reenviar/revogar funcionam como no A. Reversão é a soma das duas reversões.

### Caminho D, Auth como fonte da verdade do aceite (+ ledger opcional)

Não é um caminho novo do zero: é reconhecer que a máquina de estados **já roda** (§2 e §4) e passar a lê-la, em vez de construir uma segunda.

**D-mínimo (zero migration).** Um accessor server-side, irmão do que a CFG-2.3 já vai criar (mesmo módulo, mesma chamada `listUsers`, mesmo princípio de least privilege), devolve por id: `{ invited_at, confirmed_at, last_sign_in_at }`. O estado exibido passa a ser derivado:

| Condição | Estado exibido |
|:--|:--|
| `users.status = 'inactive'` | Desativado (precedência sobre tudo) |
| `confirmed_at IS NULL AND invited_at IS NOT NULL` | **Convite pendente** |
| `confirmed_at IS NULL AND invited_at IS NOT NULL AND now() > invited_at + TTL` | **Convite expirado** (TTL como constante de aplicação, ver §7) |
| caso contrário | Ativo |

- **`users_status_check` intocado, zero migration, zero mudança de significado nos 23 call-sites.** Os 4 filtros continuam querendo dizer o que sempre quiseram.
- **Convite deixa de mentir "ativo" sem parar de inserir a linha:** a linha em `users` continua nascendo (preservando o comportamento comentado "so they appear in the user list immediately" e evitando a divergência de duas fontes do caminho A), mas a **exibição** e o **stat** deixam de chamá-la de ativa. `loader.ts:168` (stat "Ativos") passa a subtrair os pendentes.
- **Reenviar:** `auth.admin.generateLink({ type: "invite", email, options: { data, redirectTo } })`, exatamente o padrão já em produção em `reset-password/route.ts:51` (que usa `type: "recovery"` e nunca devolve o link ao chamador). Não duplica linha porque não há linha nova para duplicar.
- **Revogar:** `auth.admin.deleteUser(id)` mais remoção da linha ainda virgem de `users` (uma linha sem `enrollments`, sem `sessions`, sem histórico) mais `logAdminAction({ action: "user.invite_revoked" })`. Satisfaz o AC3 literalmente.
- **Reversão:** apagar o accessor. É o único caminho **inteiramente reversível por `git revert`**, sem passo em banco.
- **Limite honesto (o preço real):** contagem. O stat "Convites pendentes" e a correção do "Ativos" saem de um `count(*)` no Postgres e viram um passe em memória sobre `listUsers`, que é **project-wide e paginado**. No volume de hoje é irrelevante; em dezenas de milhares de usuários no projeto Auth, é. Ele também não dá `expires_at` por convite (§4) nem `invited_by` estruturado (só no `platform_audit_log`).

**D+ledger (uma migration pequena, puramente aditiva).** Se e quando o limite acima incomodar, adiciona-se `user_invites` **como espelho consultável, não como fonte da verdade**: `(id, tenant_id, email, invited_by, invited_at, resent_at, resend_count, expires_at, revoked_at)`, sem `accepted_at` (o aceite continua sendo `confirmed_at` do Auth, para não haver duas verdades sobre a mesma pergunta). Isso devolve `count(*)` barato, `expires_at` por convite, autoria e filtro em SQL, **sem tocar `users`, sem tocar `users_status_check` e sem tocar nenhum dos 23 call-sites**.

O ponto que torna D atraente do ponto de vista de risco: **D-mínimo e D+ledger não competem**. Adotar o mínimo agora não gera retrabalho se o ledger entrar depois, porque a leitura derivada continua correta com ou sem ele. É bala antes de canhão, com o canhão já desenhado.

---

## 6. Tabela comparativa

| Critério | A (`user_invites` fonte) | B (`'pending'` em `users`) | C (híbrido AC2) | **D (Auth + ledger opcional)** |
|:--|:--|:--|:--|:--|
| Migration necessária agora | 1 tabela + RLS | `ALTER` do CHECK + 3 colunas | 1 tabela + `ALTER` do CHECK | **nenhuma** (D-mínimo) |
| Toca objeto existente em produção | não | **sim** (`users`, `users_status_check`) | **sim** | **não** |
| Call-sites de `users.status` cujo significado muda | 0 | **23** | **23** | 0 |
| Desses, pegos pelo compilador | n/a | **0** | **0** | n/a |
| Call-sites de código a alterar | ~5 + lista com 2 origens | ~8 (4 filtros + UI + zod + contrato v1) | ~10 | ~4 (accessor, loader, badge, ações) |
| `is_super_admin()` em risco (§3.4) | não | **sim** | **sim** | não |
| Contrato público `/api/v1` afetado | não | **sim** (valor novo) | **sim** | não |
| Satisfaz AC3 (revogar sem nunca ter criado `active`) | **sim** | **não** (só via `'inactive'`) | sim | **sim** |
| Reenviar sem duplicar linha | sim (`UPDATE`) | sim (`UPDATE`) | sim | sim (nada a duplicar) |
| `expires_at` por convite | **sim** | **sim** | sim | não no mínimo, **sim** no ledger |
| `invited_by` estruturado | **sim** | via audit log | sim | via audit log; **sim** no ledger |
| Stat "Convites pendentes" | `count(*)` SQL | `count(*)` SQL | `count(*)` SQL | memória (mínimo) / `count(*)` (ledger) |
| Fontes de verdade sobre o aceite | **2** (tabela + Auth) | 1 | **2** | **1** (Auth) |
| Custo de reversão | `DROP TABLE` + revert de código | `ALTER` condicionado a não haver `'pending'` vivo | soma dos dois | **`git revert`** |
| Risco de regressão silenciosa | baixo | **alto** | **alto** | baixo |

---

## 7. Recomendação

**Caminho D, na variante D-mínimo agora, com o ledger `user_invites` desenhado e engatilhado para quando a contagem exigir.**

Justificativa, na ordem em que pesou:

1. **O compilador não protege nada aqui.** 23 call-sites tocam `users.status`, 1 tem guard e 0 quebrariam o build com um valor novo, porque `users.status` é `string` (`packages/database/src/types/supabase.ts:3932`) e os três clientes Supabase são não tipados. Este é o mesmo argumento que já matou P2/P3 na CFG-2.1, e ele mata B e C pelo mesmo motivo. Não é uma preferência de estilo: é a constatação de que revisão manual de 23 pontos em produção compartilhada é a forma mais cara de descobrir um erro.
2. **B não consegue cumprir o AC3.** Revogar um convite no caminho B ou apaga uma linha de `users` com FKs vivas, ou marca `'inactive'`, que é literalmente o estado que o AC3 proíbe. Um caminho que exige reescrever o critério de aceite para caber nele não é o caminho.
3. **A máquina de estados já existe e já está sendo alimentada.** `inviteUserByEmail` está em produção desde antes deste épico, `invited_at`/`confirmed_at` já vêm no `listUsers` que a rota de usuários **já chama** (`route.ts:108`), e a CFG-2.3 vai formalizar exatamente esse accessor para `last_sign_in_at`. Construir uma segunda máquina de estados ao lado de uma que já roda é o custo do caminho A, e o preço dele é permanente (duas fontes de verdade sobre "quem existe" divergem no primeiro erro parcial).
4. **É o único caminho reversível sem tocar em banco.** Num épico cuja regra inviolável é "sem migration sem GO do Hugo", o desenho que entrega o AC8 da CFG-6.1 **sem gastar o GO** deveria ser a escolha default, e só ser abandonado se falhasse em algum requisito real. Ele não falha: entrega pílula, reenvio, revogação e stat.
5. **O que D-mínimo não entrega tem preço conhecido e adiável.** Falta `expires_at` por convite e contagem em SQL. O primeiro se resolve com uma constante de aplicação (`INVITE_TTL_DAYS`) alinhada ao TTL configurado no projeto Supabase, e essa constante é honesta: hoje **ninguém sabe qual é o TTL efetivo**, o que já é um bug latente do produto atual, não uma dívida criada por este desenho. O segundo só dói em volume que não existe hoje, e o ledger o resolve depois sem invalidar nada.
6. **C perde por ser o único caminho que paga os dois custos.** Cria tabela e mexe no CHECK, e o terceiro estado que ele adiciona ("aceitou mas nunca logou") já vem de graça da CFG-2.3. Nenhum requisito lido pede esse estado.

**Se o Senhor preferir gastar o GO de migration agora**, a segunda escolha é **A**, não B. A tem blast radius de schema zero sobre `users.status` e cumpre o AC3; o preço dele é a lista de usuários passar a ter duas origens e a reconciliação `auth.users` x `user_invites` virar responsabilidade nossa. **B só deveria ser escolhido se houver uma exigência que eu não vi de que o estado do convite tem de ser filtrável por SQL na mesma coluna que o estado do usuário.** Nesse caso, ele vem obrigatoriamente acoplado a: revisão manual dos 23 call-sites, atualização do `z.enum` do PATCH, decisão explícita sobre `is_super_admin()`, e versionamento do contrato `/api/v1`.

---

## 8. O que este documento deliberadamente não decidiu

- **Números de produção.** Quantas linhas de `users` na Cory correspondem a convites nunca aceitos é mensurável e **não foi medido** (o mandato do épico proíbe operação em banco de produção neste passo). A pergunta se responde com `admin.listUsers()` filtrando `confirmed_at IS NULL`, ou, com service role, `SELECT count(*) FROM auth.users WHERE confirmed_at IS NULL AND deleted_at IS NULL`. **Recomendo medir antes de implementar qualquer caminho**: se o número for zero, o problema é só prospectivo; se for alto, ele também é um saneamento de dado, e isso muda a ordem das stories.
- **B3 da ficha corretiva** (`registration_code`, `is_third_party`) permanece uma migration **diferente**, acoplada ao bulk import, como a própria CFG-2.2 Dev Notes já registra. Nenhum caminho acima depende dela nem a antecipa. Se o caminho escolhido for D+ledger ou A, `registration_code` pode entrar como coluna do convite no futuro sem retrabalho, mas isso é decisão da story de import, não desta.
- **O TTL real do convite no projeto Supabase.** É configuração de projeto e precisa ser lida no painel antes de cravar a constante `INVITE_TTL_DAYS`.
- **Redação final dos ACs da CFG-2.2.** Assim que o Senhor escolher, o @sm reescreve os ACs 1/3/4 para o desenho vencedor (e, se for D, o AC1 deixa de falar em migration).

---

## 9. Change Log

| Data | Evento |
|:--|:--|
| 2026-07-28 | Documento criado por Aria (@architect) a pedido do dono, para destravar o fix **F2** da CFG-2.2. Blast radius medido por varredura estruturada sobre `.from("users")` (23 call-sites em 13 arquivos), não por estimativa. Duas premissas da story corrigidas: o produto **já usa** `inviteUserByEmail` desde antes do épico, e o teste `user-admin-handlers.test.ts` **não** cobre o POST de convite. Recomendação: **caminho D** (Auth como fonte da verdade do aceite, ledger `user_invites` aditivo e adiável). Nenhuma migration escrita, nenhum código tocado, nada aplicado em banco. |
