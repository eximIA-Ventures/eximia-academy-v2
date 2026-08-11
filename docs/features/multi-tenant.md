# Multi-tenant e White-label

> **Este documento descreve um invariante de segurança.** O que está aqui não é
> convenção de estilo nem preferência de arquitetura: se violado, dados de um
> cliente aparecem para outro, ou a marca de um cliente aparece no produto de
> outro. Ambas já quase aconteceram neste repositório, e a §"O merge que apaga a
> marca em silêncio" conta exatamente como.

---

## 1. O produto é um só, os clientes são muitos

A eximIA Academy é vendida como plataforma white-label. Cada cliente
(Argos Consultoria, Vértice Indústria, os próximos) recebe algo que parece um
produto próprio: nome próprio, logotipo próprio, cores próprias, domínio próprio,
e apenas os módulos que ele contratou. Por baixo, é o mesmo codebase.

Sustentar essa ilusão exige **dois eixos de separação completamente distintos**,
e a confusão entre eles é a fonte de praticamente todo risco desta feature:

| Eixo | O que separa | Onde vive | Resolvido em | É trava de segurança? |
|:---|:---|:---|:---|:---|
| **Identidade** | marca, cores, módulos visíveis | `apps/web/tenant.config.ts`, uma versão por branch `deploy/{client}` | **build time** | **NÃO** |
| **Dados** | quais linhas do banco cada pessoa alcança | `tenant_id` + Row Level Security no Postgres | **cada query, em runtime** | **SIM** |

**A regra que não pode ser esquecida:** `tenant.config.ts` é apresentação.
Ele decide o que a interface *mostra*, nunca o que a pessoa *pode*. Um módulo
desligado esconde uma tela; ele não impede ninguém de ler um dado. A única
autorização real está na RLS do banco. Essa fronteira está escrita, em letras
maiúsculas, no próprio código:

```ts
// packages/shared/src/modules/registry.ts:52-54
// These are pure UX exposure flags (e.g. show/hide an admin sub-feature)
// — NEVER permission. The RLS in the database remains the only
// authorization gate.
```

Quem tratar a config de tenant como mecanismo de segurança vai, mais cedo ou
mais tarde, deixar um dado exposto atrás de um menu escondido.

---

## 2. Eixo da identidade: `TenantConfig`

### 2.1 A estrutura real

O contrato de tipo vive em `packages/shared/src/modules/tenant-config.ts` e é
compartilhado por todas as branches. A instância vive em
`apps/web/tenant.config.ts` e é **a única coisa que muda de cliente para
cliente**.

```ts
interface TenantConfig {
  brand: TenantBrand
  modules: ModuleId[]
  features?: { orgTree?: boolean }
  settings?: { ... }
}
```

**`brand`** (`TenantBrand`), a identidade visível:

| Campo | Obrigatório | Papel |
|:---|:---:|:---|
| `name` | sim | Nome de exibição da empresa |
| `slug` | sim | Identificador curto, usado em caminhos e identificadores |
| `logo` | sim | Caminho relativo a `/public` |
| `favicon` | não | Caminho relativo a `/public` |
| `primaryColor` | sim | Cor primária, hex |
| `accentColor` | sim | Cor de destaque, hex |
| `partnerName` | não | Texto "powered by" do parceiro |
| `partnerLogo` | não | Caminho do logotipo do parceiro |

**`modules`** (`ModuleId[]`), o que o cliente contratou. Existem 9 módulos
declarados em `MODULE_IDS`, três deles `core: true`:

| Módulo | Core | Observação |
|:---|:---:|:---|
| `academy`, `analytics`, `admin` | **sim** | Sempre ativos, listar ou não é irrelevante |
| `assessments`, `biblioteca`, `community`, `course-designer`, `units`, `integrations` | não | Add-ons, ligados por contrato |

`getEnabledModules()` sempre injeta os `core` antes de qualquer coisa. A
consequência prática, e ela importa para avaliar risco: **uma lista `modules`
restrita esconde, nunca expõe.** `isRouteAllowed()` e `isApiRouteAllowed()` são
fail-closed: rota que nenhum módulo habilitado reivindica é negada. Errar para
menos deixa o cliente sem uma tela que ele pagou (irritante, visível, corrigível
em minutos). Errar para mais liga um add-on não contratado (silencioso, e é
exatamente o modo de falha que a §4 documenta).

**`features`**, flags de exposição de UI dentro de módulos core. Mesma natureza
que `modules`: visibilidade, não permissão. O próprio comentário do tipo declara
que "enabling a flag here grants no data access".

**`settings`**, todos opcionais: `maxInteractionsPerSession`, `aiModel`,
`sessionTimeoutHours`, `footerText`, `supportEmail`, `customCSS`.

### 2.2 Como é lido

Um único ponto de leitura, e ele é estático de propósito:

```ts
// apps/web/src/lib/tenant.ts
import tenantConfig from "../../tenant.config"
export function getTenantConfig(): TenantConfig { return tenantConfig }
```

O comentário logo acima diz "Replaces the old dynamic tenant resolution from
Supabase". Isso é uma decisão de arquitetura com consequência direta: **a
identidade do deploy é assada no bundle**. Mudar cor, logo ou lista de módulos
exige rebuild, não um `UPDATE`.

Há uma exceção deliberada, e ela existe justamente porque a config estática não
serve para tudo: `apps/web/src/lib/tenant-features.ts` lê kill-switches de
`tenants.settings` **no servidor, a cada request**. O comentário do arquivo
explica o porquê com franqueza incomum: "uma flag lida do bundle do cliente não
se mata (...) desligar uma feature precisa valer no PRÓXIMO request, sem deploy
nenhum". Ou seja, config estática para identidade, banco para o que precisa
morrer rápido. E `isTenantFeatureEnabled` falha sempre na direção `false`,
inclusive quando a RLS nega a leitura.

---

## 3. Como nasce uma branch `deploy/{client}`

Hoje existem duas, confirmadas em `git branch -r`: `origin/deploy/cory` (cliente
Argos Consultoria) e `origin/deploy/vertice` (Vértice Indústria, demonstração).
A topologia declarada em `docs/DEPLOY-GUIDE.md` é:

```
main                  → plataforma limpa, codebase canônico, NÃO é implantada
deploy/central        → central de gestão (super admin)
deploy/{client}       → o que de fato vai a produção
```

O nascimento, resumido do guia de deploy:

1. **Criar um projeto Supabase** para o cliente e rodar as migrations. Este
   passo é a primeira camada de isolamento, e a mais forte: bancos fisicamente
   distintos.
2. `git checkout main && git checkout -b deploy/{client-slug}`.
3. Colocar os binários de marca em `apps/web/public/brand/`.
4. Editar `apps/web/tenant.config.ts` com a marca e a lista de módulos.
5. Criar o app no EasyPanel apontando para a branch, com as env vars e o
   domínio `{slug}.academy.eximiaventures.com.br`.
6. Commit e push.

O commit da branch é minúsculo por desenho. O da Vértice, `5a91cd0`, toca **um
único arquivo, 12 linhas**. Tudo o mais é herdado.

### `main` é neutra, e isso é uma regra, não um acaso

`main` carrega `name: "eximIA Academy"`, `slug: "demo"`, `primaryColor:
"#2a6ab0"`, sem `partnerName`, e a lista **ampla** de módulos (todos os seis
add-ons ligados, porque é a configuração de desenvolvimento local).

`main` nunca recebe marca de cliente. Não é higiene estética: `main` é a base de
corte de **todo cliente futuro**. Um vazamento de config em `main` se propaga
para todos os deploys criados a partir dali, e ninguém vai olhar de novo para um
arquivo que "já estava certo".

---

## 4. O merge que apaga a marca em silêncio

Esta seção não é teoria. É o achado de duas stories concluídas
(`docs/stories/chore-reconcile-main-com-deploy-cory.md` e
`chore-reconcile-main-com-deploy-vertice.md`, ambas Done, 2026-08-09 e
2026-08-10), medido por dry-run real de merge em worktree isolada.

O `docs/DEPLOY-GUIDE.md` §"Atualizar Cliente Existente" ainda diz:

```bash
git merge main
# Resolver conflitos em tenant.config.ts se houver (raro)
```

**Essa instrução é insuficiente, e seguir só ela quebra o produto do cliente.**
Ela assume que o merge avisa quando há algo a decidir. Ele não avisa.

### O mecanismo

`deploy/vertice` não foi cortada de `main`. Foi cortada de `deploy/cory`, no
commit `19c2824`. Logo, o **merge-base** entre `deploy/vertice` e `main` contém
a config do **Cory/Argos**, não a config neutra de `main`.

O commit próprio da Vértice mexeu apenas em `name`, `slug` e `footerText`. Ela
nunca "declarou como seus" os campos de cor, parceiro e módulos, porque eles já
vinham herdados do Cory e estavam certos por acidente de linhagem.

Para o merge de 3 vias, um campo que **só um lado mudou** em relação ao
ancestral não é conflito. É decisão automática. Resultado medido:

| Campo | Valor em `deploy/vertice` | O que o merge faz sozinho | Por quê |
|:---|:---|:---|:---|
| `name` / `slug` | `Vértice Indústria` | **conflito** (visível) | os dois lados mudaram |
| `footerText` / `supportEmail` | texto Vértice | **conflito** (visível) | região colidiu |
| `primaryColor` | `#1E3A5F` | vira **`#2a6ab0`**, sem avisar | só `main` mudou |
| `partnerName` / `partnerLogo` | exímIA Ventures | **desaparecem**, sem avisar | só `main` removeu |
| `modules` | `["biblioteca","units"]` | vira **6 add-ons ligados**, sem avisar | só `main` mudou |

Um `@dev` que resolva os marcadores `<<<<<<<`, veja `git status` limpo e faça
push entrega ao cliente: **a cor errada, o parceiro sumido, e quatro módulos que
ele nunca contratou, ligados em produção.** Nada disso aparece no `git status`.
Nada disso aparece na revisão de conflito. O relatório do merge diz "Automatic
merge went well".

### O caso inverso, na mesma frente

Os binários de marca contam a outra metade da história. `deploy/vertice` servia
`logo.png` com **29.959 bytes**, que são os pixels do logotipo **ARGOS
Consultoria**, herdados do corte e nunca substituídos. O tenant de demonstração
estava exibindo a marca de um cliente pagante. Aqui a resolução automática (para
os 36.379 bytes neutros da eximIA) era a **correção** de um bug preexistente, e
ainda assim teve que ser provada por tamanho e hash.

Motivo: **o `git grep` é estruturalmente incapaz de ver marca assada em pixel.**
A varredura textual por `cory|argos` retorna limpo enquanto o logotipo errado
segue na tela.

### O que ficou como procedimento obrigatório

Destilado das duas stories. Cada item existe porque a ausência dele custou uma
reprovação de quality gate ou uma correção de última hora:

1. **`git merge --no-commit`, nunca `--no-ff` sozinho.** `--no-ff` auto-commita.
   Se algo interromper entre o merge e a correção manual dos campos silenciosos,
   a branch fica com `git status` limpo e nada sinalizando que falta trabalho.
2. **Verificar `tenant.config.ts` campo a campo** contra o valor pré-merge
   capturado na hora, não contra um SHA congelado na story. "Os marcadores foram
   resolvidos" não é verificação.
3. **Provar os binários de marca por tamanho ou hash**, nunca por "não deu
   conflito".
4. **Tabela de arquivos sensíveis com coluna de justificativa.** Nunca
   `-X ours` / `-X theirs` em bloco, e nunca em `tenant.config.ts` ou em
   migration.
5. **`git grep -inP`, jamais `-iE`.** Medido nas stories: com `-E`, o `\b` falha
   em silêncio e a varredura retorna **0 matches falso-limpos**. Sem `\b`,
   "cargos" casa com "argos".
6. **Abortar e escalar antes de chutar** em arquivo sensível, não depois.

O glob de varredura herdado das stories tem furos conhecidos, corrigidos aqui:
use `'*tenant*'` (e não `'*tenant*config*'`, que exige as duas palavras e perde
`tenant-features.ts`), inclua `'*registry*'` (é onde vive o gating de módulos) e
lembre que `'**/auth*'` não casa o route group parentetizado `(auth)`.

---

## 5. Eixo dos dados: RLS é a única trava

Enquanto a §4 trata de marca e módulos, esta seção trata do que realmente
importa se der errado: **linhas de banco atravessando a fronteira entre
empresas.**

### 5.1 A âncora

Toda tabela multi-tenant carrega uma coluna `tenant_id` com FK para `tenants`.
Toda pessoa carrega `users.tenant_id NOT NULL REFERENCES tenants(id)`. A ponte
entre "quem está logado" e "qual empresa" é uma função:

```sql
-- supabase/migrations/20260518100000_fix_leader_rls_recursion.sql
CREATE OR REPLACE FUNCTION auth_tenant_id() RETURNS UUID AS $$
DECLARE _tenant_id UUID;
BEGIN
  SELECT tenant_id INTO _tenant_id FROM users WHERE id = auth.uid();
  RETURN _tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

E a policy típica, repetida por dezenas de tabelas, é literalmente uma linha:

```sql
USING (tenant_id = auth_tenant_id())
```

Escala medida no repositório (99 migrations em `supabase/migrations/`):

| Medida | Valor |
|:---|---:|
| Tabelas distintas com `ENABLE ROW LEVEL SECURITY` | **67** |
| Statements `CREATE POLICY` | **359** |
| Linhas de migration que invocam `auth_tenant_id()` | **340** |

### 5.2 O detalhe que quase custou a trava

`auth_tenant_id()` foi redefinida uma vez, e o motivo merece ser lido devagar.
A versão original era `LANGUAGE sql`. O comentário da migration de correção
explica:

> "auth helper functions can be inlined by PostgreSQL optimizer, losing
> SECURITY DEFINER protection. (...) PL/pgSQL functions are NEVER inlined, so
> SECURITY DEFINER is guaranteed."

Uma função SQL simples pode ser embutida pelo otimizador na query que a chama,
e ao ser embutida perde o `SECURITY DEFINER`, o que na prática fazia a checagem
de tenant ser reavaliada sob a RLS que ela mesma deveria decidir (a recursão
infinita observada em `users`). A correção foi trocar a linguagem para
`plpgsql`. **A trava de isolamento deste produto depende de uma escolha de
linguagem de função.** Qualquer reescrita futura de `auth_tenant_id()` para
`LANGUAGE sql` reabre isso.

### 5.3 A trava do super admin

`is_super_admin()` (migration `20260209000000_epic11_super_admin_whitelabel.sql`)
é a única saída legítima do tenant, e ela é deliberadamente estreita:

```sql
SELECT EXISTS (
  SELECT 1 FROM public.users
  WHERE id = auth.uid()
    AND role = 'super_admin'
    AND status = 'active'
    AND deleted_at IS NULL
)
```

Três condições, não uma. Um super admin com `status` diferente de `active`, ou
com `deleted_at` preenchido, **perde o alcance cross-tenant inteiro**. As
policies `super_admin_all_*` (tenants, users, courses, chapters, questions,
enrollments, sessions, messages, audit log) dependem só dessa função.

> **Ponto de atenção conhecido:** `users.status` não é tipado no TypeScript.
> Mudar o domínio de valores dessa coluna não é pego pelo compilador e passa
> direto pelo `tsc`, mas altera silenciosamente quem tem alcance global aqui.
> Trate qualquer mexida em `users.status` como mudança de superfície de
> segurança.

### 5.4 O claim de JWT, e por que não confiar no cabeçalho

Existe `custom_access_token_hook` (migration `20260421000000_jwt_tenant_claim_hook.sql`)
que injeta `tenant_id` e `role` nos claims do access token. Ele exige ativação
manual no dashboard (Authentication → Hooks) e falha para o lado seguro (o
`EXCEPTION WHEN OTHERS` devolve o evento original em vez de quebrar o login).

**Porém:** o cabeçalho dessa migration afirma que "auth_tenant_id() lê
auth.jwt() -> 'custom_claims' ->> 'tenant_id'". Nenhuma das duas definições de
`auth_tenant_id()` presentes nas migrations faz isso; ambas leem a tabela
`users`, e a mais recente (`20260518100000`, posterior ao hook) também. O
comentário descreve um estado que o código não tem.

Isso é um lembrete de disciplina, não uma correção a fazer no escuro:
**cabeçalho de migration não é fonte de verdade sobre o estado do banco.**
Antes de agir sobre qualquer afirmação de RLS deste repositório, consulte
`pg_policy` e `pg_proc` no banco real.

### 5.5 A escotilha: `service_role`

`createServiceClient()` (`apps/web/src/lib/supabase/service.ts`) cria um client
com a `SUPABASE_SERVICE_ROLE_KEY`, que **ignora RLS por completo**. É a única
coisa neste codebase que enxerga todos os tenants sem passar por
`auth_tenant_id()`.

**Este não é um caminho raro.** Medido em `apps/web/src`, excluindo testes e
mocks:

| Medida | Valor |
|:---|---:|
| Arquivos de produção que chamam `createServiceClient()` | **126** |
| Call sites | **190** |
| Desses arquivos, os que sequer mencionam `tenant_id` | **13** |
| Call sites que aplicam o padrão condicional "só quando o admin não tem tenant próprio" | **4** |

A consequência é direta e vale ser dita sem rodeio: em 190 pontos deste
aplicativo, o isolamento entre clientes **não é garantido pelo banco**, é
garantido por o autor daquele trecho ter lembrado de filtrar por `tenant_id` na
mão. A §5.1 descreve a trava; esta seção descreve os 190 lugares onde ela está
desligada por opção.

O padrão disciplinado existe e está escrito, por exemplo em
`admin/areas/loader.ts`:

```ts
// Service role apenas quando o admin não tem tenant próprio (cross-tenant).
let areasClient = supabase
if (!profile.tenant_id) {
  const { createServiceClient } = await import("@/lib/supabase/service")
  areasClient = createServiceClient()
}
```

Escalar para o service client **apenas no ramo em que ele é necessário**, e
manter o client normal (sob RLS) no caminho comum. Esse padrão aparece em 4
call sites dos 190.

Os **13 arquivos que não mencionam `tenant_id` em lugar nenhum** merecem
auditoria dedicada, e vale registrar que nem todos são suspeitos pelo mesmo
motivo: `api/health/route.ts` e `api/admin/tenants/route.ts` são plausivelmente
cross-tenant por natureza, enquanto `lib/notifications/engagement-scope.ts`,
`lib/last-seen.ts`, `lib/profiling.ts` e `lib/api-auth/v1-helpers.ts` tocam dado
de pessoa e superfície de API pública. Nenhum deles foi verificado como defeito
aqui; a lista existe para que alguém verifique, em vez de presumir.

**Regra para o futuro:** toda nova chamada a `createServiceClient()` é, por
definição, uma consulta que opera fora da trava de isolamento, e deve carregar a
checagem de tenant explicitamente no código, porque o banco não vai fazer isso
por ela. Preferir sempre a escalada condicional acima ao client de serviço no
topo do arquivo.

---

## 6. As duas camadas juntas

Vale explicitar como os dois eixos se compõem, porque a segurança real vem da
combinação:

1. **Camada física:** cada cliente tem um projeto Supabase próprio
   (`DEPLOY-GUIDE` passo 1). Dois clientes em bancos diferentes não têm como
   vazar um para o outro, independente de qualquer policy.
2. **Camada lógica:** dentro de um mesmo banco, a RLS separa por `tenant_id`.
   É o que sustenta múltiplos tenants num projeto (o caso do super admin, dos
   ambientes de demonstração e de qualquer consolidação futura).
3. **Camada de apresentação:** `tenant.config.ts` decide o que aparece.
   Não protege nada, e nunca deve ser tratada como se protegesse.

Retirar a camada 2 por achar que a camada 1 basta é o erro clássico: basta um
cliente compartilhar projeto com outro (por custo, por consolidação, por
demonstração) para o isolamento inteiro passar a depender de policies que
ninguém revisou.

---

## 7. Checklist de invariantes

Antes de aprovar qualquer mudança que toque tenant, marca ou acesso a dado:

- [ ] `main` continua neutra: `git grep -inP '\b(cory|argos|vertice)\b' main -- apps/web packages/ supabase/` sem match novo
- [ ] `apps/web/tenant.config.ts` da branch de deploy verificado **campo a campo**, incluindo `primaryColor`, `partnerName`, `partnerLogo` e `modules`
- [ ] Binários em `apps/web/public/brand/` conferidos por tamanho ou hash
- [ ] Nenhuma tabela nova sem `ENABLE ROW LEVEL SECURITY` e sem policy por `tenant_id`
- [ ] `auth_tenant_id()` continua `LANGUAGE plpgsql` (nunca `sql`)
- [ ] Nenhuma nova chamada a `createServiceClient()` sem checagem de tenant explícita no código, e preferindo escalada condicional a client de serviço no topo do arquivo
- [ ] Mudanças em `users.status` ou `users.role` tratadas como mudança de superfície de segurança

---

## Referências

| Assunto | Arquivo |
|:---|:---|
| Contrato de tipo | `packages/shared/src/modules/tenant-config.ts` |
| Instância por cliente | `apps/web/tenant.config.ts` |
| Registro e gating de módulos | `packages/shared/src/modules/registry.ts` |
| Leitura da config | `apps/web/src/lib/tenant.ts` |
| Kill-switch em runtime | `apps/web/src/lib/tenant-features.ts` |
| Guards de rota e workspace | `apps/web/src/middleware.ts` |
| Escotilha de RLS | `apps/web/src/lib/supabase/service.ts` |
| RLS base e `auth_tenant_id()` | `supabase/migrations/20260207000000_initial_schema.sql` |
| Correção do inlining | `supabase/migrations/20260518100000_fix_leader_rls_recursion.sql` |
| Super admin cross-tenant | `supabase/migrations/20260209000000_epic11_super_admin_whitelabel.sql` |
| Claim de JWT | `supabase/migrations/20260421000000_jwt_tenant_claim_hook.sql` |
| Procedimento de deploy | `docs/DEPLOY-GUIDE.md` |
| Lição da reconciliação (Argos) | `docs/stories/chore-reconcile-main-com-deploy-cory.md` |
| Lição da reconciliação (Vértice) | `docs/stories/chore-reconcile-main-com-deploy-vertice.md` |
