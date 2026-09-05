# Roadmap "Em andamento", plano executável até 30/08/2026

> Status: Plano aprovado para execução, aguardando 3 decisões do dono (secao 8).
> Data: 2026-08-14 (sexta) · Agente: @pm (Morgan) · Dono do produto: Hugo Capitelli
> Repositório: `eximia-academy-v2` · Branch de produção: `deploy/cory` (Argos / Cory Alimentos)
> Prazo declarado: **30/08/2026**. Prazo operacional real: **sexta, 28/08/2026** (ver secao 3.0).

---

## 0. Sumário executivo, em 8 linhas

O bloco "Em andamento" declarava 4 itens somando 34 dias. O reconhecimento de código mostrou que
**cerca de metade do bloco já está entregue e em produção**, e que uma parte do que resta não é
o que o roadmap dizia que era. Sobram 11 dias úteis. O plano abaixo corta escopo em vez de data,
conforme decisão do dono, e organiza o que resta em 5 frentes, das quais 4 rodam em paralelo real
porque não compartilham arquivo nem dado. A única dependência dura do bloco é a **espinha de
agregação de `study_plans` para N alunos**, que hoje não existe em lugar nenhum e que duas frentes
diferentes precisam, cada uma na sua ponta. Ela vai primeiro, sozinha, e destrava as demais.
O maior risco do bloco não é prazo, é **adoção: 1,3% de jornadas criadas** (secao 7).

---

## 1. Ação de higiene, primeira coisa a fazer

**AÇÃO 0, desbloquear a issue #32 (ADM-4, cobertura de jornadas).**

A issue #32 está registrada como BLOQUEADA, e o motivo declarado é que a coluna
`courses.manager_deadline_days` nunca teria sido aplicada em produção.

**O motivo é factualmente falso.** A verificação foi feita diretamente no banco de produção via
Supabase Management API, e a coluna **existe**. O bloqueio é um resíduo de registro, não um
impedimento técnico. Enquanto ele permanecer, a #32 fica fora de qualquer planejamento por um
motivo que não existe, e a Jornada da Organização parece parada quando na verdade está livre.

| Item | Valor |
|:---|:---|
| Quem executa | @devops (Gage), única autoridade sobre operações no GitHub |
| O que fazer | Remover o rótulo/estado de bloqueio da #32 e comentar registrando a verificação em produção da coluna `courses.manager_deadline_days` |
| Quando | 14/08/2026, antes de qualquer linha de código do bloco |
| Prova | `gh issue view 32 --json labels,state` não apresenta mais marcação de bloqueio |

Nenhuma issue foi tocada na produção deste plano. A ação acima é uma ordem registrada, não um
fato consumado.

---

## 2. Roadmap corrigido, o bloco "Em andamento" reescrito

### 2.1 O que o roadmap dizia

| # | Item declarado | Estimativa |
|:---|:---|---:|
| 1 | Analytics de uso/alunos para Gestor + Admin + Instrutor | 7d |
| 2 | Jornada da minha turma, visão do instrutor | 10d |
| 3 | Jornada da Organização, visão do Admin | 7d |
| 4 | Telas pendentes da gestão de configurações (7 telas) | 10d |
| | **Total declarado** | **34d** |

### 2.2 O que a realidade diz, item a item

#### Item 1, Analytics de uso (declarado 7d)

| Papel | Estado real | Evidência |
|:---|:---|:---|
| Gestor | **ENTREGUE**, sai da lista | `/analytics` com recorte Diretos/Hierarquia, drill-down por subtree, cards de triagem, `api/analytics/manager`, nudges |
| Admin | **ENTREGUE**, sai da lista | `/admin/visao-geral` mais painel admin em `/dashboard` |
| Instrutor | **PARCIAL**, permanece | `/instructor` existe e funciona, mas não é um `DashboardKind` em `resolve-dashboard-kind.ts:104`, é achatado em `manager` por `toAnalyticsRole()` em `api/analytics/manager-groups/route.ts:76-88`, e não tem escopo "meus alunos" real |

O buraco do instrutor não é de tela, é de **escopo de dado**: `getStudentDetails` e
`getRecentReflections` filtram por tenant mais área ativa, então **todo instrutor vê exatamente os
mesmos alunos**. Uma tela de "meus alunos" que mostra os alunos de todo mundo não é uma tela
incompleta, é uma tela que mente.

**Item 1 corrigido:** "Fechar o analytics do instrutor, papel de primeira classe mais escopo real
de alunos". Estimativa revista: 2 sessões.

#### Item 1-bis, bug de controle de acesso encontrado de carona (NOVO)

Não estava no roadmap e precisa estar. `/analytics` autoriza pela **união de chapéus**
(`page.tsx:82`), mas o drill-down autoriza pelo **`profile.role` singular** em 2 páginas e 5 rotas
de API:

| Superfície | Local |
|:---|:---|
| Página | `analytics/students/[studentId]/page.tsx:16` |
| Página | `analytics/sessions/[sessionId]/page.tsx:19` |
| API | `analytics/aggregate:700` |
| API | `analytics/insights:56` |
| API | `analytics/pedagogical-actions:217` |
| API | `analytics/students:42` |
| API | `analytics/sessions:39` |

Consequência observável: um usuário multi-chapéu passa na tela e é barrado no drill-down.
Herança do EPIC-30, mesma família do fix já feito em `epic-manager-ux/S5-fix-gate-union.md`.
É defeito de autorização, entra no bloco com prioridade alta e custo baixo.

**Item 1-bis:** "Unificar a autorização do drill-down de analytics por união de chapéus".
Estimativa: 1 sessão.

#### Item 2, Jornada da Turma (declarado 10d)

Epic GitHub #22, com 5 sub-issues (#23 contrato `ClassJourneyView`, #24 `/instructor/turma`,
#25 alunos em risco, #26 gargalo por módulo, #27 agenda 14 dias). **0 de 5 fechadas.**

Achado estrutural: o conceito "turma" **não existe no schema** (zero ocorrências de `turma`,
`cohort` ou `class_id` em `supabase/`). O dono decidiu que **turma = curso x unidade**, sem
entidade nova e sem migration, que é o escopo que `/instructor` já usa. Isso remove o custo de
modelagem, mas não remove os 10 dias de superfície.

**Item 2 corrigido:** ESCORREGA PARA SETEMBRO por decisão do dono (secao 4). O que fica em agosto
é apenas a fundação de dado que a #23 vai consumir, e ela entra por outro motivo (ver item 5).

#### Item 3, Jornada da Organização (declarado 7d)

Epic GitHub #28.

| Sub-issue | Estado |
|:---|:---|
| #29 | **ENTREGUE e em produção**, é a `/admin/visao-geral` |
| #30 | Fechada, absorvida pela #29 |
| #31 | Fechada, absorvida pela #29 |
| #32 (ADM-4, cobertura de jornadas) | **ÚNICA aberta**, bloqueada por motivo falso, ver AÇÃO 0 |

**Item 3 corrigido:** "Fechar a #32, cobertura de jornadas na visão do Admin". Dos 7 dias
declarados, restam a #32 e nada mais. Estimativa: 1 sessão depois da espinha pronta.

#### Item 4, Telas de configuração (declarado 10d, 7 telas)

O item está desatualizado em 6 das 7 telas.

| Tela | Estado real | O que fazer |
|:---|:---|:---|
| Auditoria | **EXISTE e funciona**, dentro do hub `/admin/configuracoes` | Nada, sai da lista |
| Plano | **EXISTE e funciona**, dentro do hub `/admin/configuracoes` | Nada, sai da lista |
| APIs | **EXISTE e completa** (`/admin/api-keys`), com CRUD e RLS, marcada "Em breve" no menu | Religar no menu |
| Integrações | **EXISTE e completa** (`/admin/integrations`), marcada "Em breve" no menu | Religar no menu |
| Webhooks | **EXISTE e completa** (`/admin/webhooks`), com HMAC, worker de retry e teste de entrega, marcada "Em breve" no menu | Religar no menu |
| Notificações | **MOCK NÃO PERSISTIDO**, 4 toggles em `useState`, zero fetch, em `(platform)/configuracoes/page.tsx:30-54` | Construir a persistência |
| Perfis e Permissões | **NÃO EXISTE** | Construir, escopo = CRUD de chapéus |
| Cobrança | **NÃO EXISTE e não tem uma linha**: zero tabela de assinatura ou fatura, zero gateway de pagamento no repo | Sai do bloco, ver secao 4 |

As três telas "Em breve" (APIs, Integrações, Webhooks) estão escondidas por **decisão registrada**
em `packages/shared/src/modules/registry.ts:401-410`, com a justificativa de que "vão ser
retrabalhados". As rotas e os guards seguem intactos, e as telas continuam acessíveis por URL
direta. Isso significa que existem **três features completas com adoção estruturalmente zero**,
porque nenhum usuário chega a uma tela sem porta. Religar é uma decisão do dono, não uma
correção que eu possa tomar sozinho (secao 8, DECISÃO 1).

**Item 4 corrigido:** "Religar 3 telas prontas no menu, persistir Notificações, construir CRUD de
chapéus". Estimativa: 3 sessões. Dos 10 dias declarados, a maior parte já estava construída.

#### Item 5, a espinha compartilhada (NOVO, não estava no roadmap)

Achado estrutural, e o mais importante deste reconhecimento.

A "Jornada do meu time" do gestor **não lê `study_plans`**. Ela deriva ritmo de
`courses.deadline_days`. O motor de jornada real existe, mas só para **um** aluno, do lado do
aluno:

| Arquivo | Escopo |
|:---|:---|
| `lib/journey/journey-plan-data.ts` | 1 aluno |
| `lib/analytics/study-plan-projection.ts` | 1 aluno |
| `lib/analytics/plan-dashboard-data.ts` | 1 aluno |

**Agregar `study_plans` para N alunos não existe em lugar nenhum do código.** E é exatamente
isso que a #23 (Jornada da Turma) e a #32 (cobertura de jornadas do Admin) precisam, cada uma na
sua ponta.

Construir dentro de cada frente produz duas implementações divergentes do mesmo cálculo, com dois
conjuntos de bugs e duas definições concorrentes de "aluno atrasado". Construir uma vez, antes,
destrava as duas. É o único item do bloco que é dependência dura de outros.

**Item 5:** "Espinha de agregação de `study_plans` para N alunos". Entra no bloco de agosto mesmo
com a Jornada da Turma escorregando, porque a #32 também a consome, e porque a decisão do dono foi
explícita: a espinha fica pronta antes da Jornada da Turma.

### 2.3 O bloco "Em andamento" corrigido

| # | Item corrigido | Epic | Estado | Esforço |
|:---|:---|:---|:---|---:|
| 0 | Desbloquear a #32 | #28 | Higiene, 14/08 | 0 |
| 5 | Espinha de agregação de `study_plans` para N alunos | EPIC-JORNADA-AGG (novo) | Entra, dependência dura | 3 sessões |
| 3 | Cobertura de jornadas na visão do Admin | #28 / #32 | Entra, consome a espinha | 1 sessão |
| 1 | Fechar o analytics do instrutor | EPIC-ANALYTICS-INSTRUTOR (novo) | Entra, paralelo | 2 sessões |
| 1-bis | Unificar autorização do drill-down por união de chapéus | EPIC-ANALYTICS-INSTRUTOR | Entra, paralelo, fix de segurança | 1 sessão |
| 4 | Religar 3 telas de config, Notificações persistida, CRUD de chapéus | EPIC-CONFIGURACOES | Entra, paralelo | 3 sessões |
| 6 | Instrumentar o funil de adoção da jornada | EPIC-JORNADA-AGG | Entra, resposta ao risco (secao 7) | 1 sessão |
| 2 | Jornada da Turma | #22 | **SAI**, setembro | 10d |
| 4-bis | Cobrança | roadmap próprio | **SAI**, dependência externa dura | n/a |
| 4-ter | RBAC customizável | epic próprio | **SAI**, não é o que foi pedido | n/a |

Entregue e removido da lista: analytics do Gestor, analytics do Admin, sub-issues #29, #30 e #31,
telas de Auditoria e Plano.

---

## 3. Sequência de execução até 30/08

### 3.0 A data real é 28/08, não 30/08

30/08/2026 cai num **domingo**. 29/08 é sábado. O último dia útil antes do prazo declarado é
**sexta, 28/08**. Planejar entrega para 30/08 é planejar deploy de produção num domingo, num
cliente com operação em dia útil (Argos / Cory Alimentos).

O plano trata **28/08 como a data de corte**, e 29 e 30/08 como contingência que não deve ser
usada. Isso não encurta o prazo, apenas o torna honesto.

Dias úteis disponíveis: **11** (14, 17, 18, 19, 20, 21, 24, 25, 26, 27, 28).

### 3.1 Calendário

| Janela | Frente | O que sai | Depende de |
|:---|:---|:---|:---|
| **Sex 14/08** | Higiene e decisões | AÇÃO 0 (#32 desbloqueada), 3 decisões do dono (secao 8), stories abertas | nada |
| **Seg 17 a Qua 19** | **Trilha A**, espinha | JAG-1 (contrato e agregação), JAG-2 (rota e desempenho) | nada |
| **Seg 17 a Ter 18** | **Trilha B**, segurança | GRD-1 (união de chapéus no drill-down) | nada |
| **Seg 17 a Ter 18** | **Trilha C**, config | CFG-1 (religar 3 telas), condicionada à DECISÃO 1 | nada |
| **Qua 19 a Qui 20** | **Trilha B**, instrutor | INS-1 (`instructor` como `DashboardKind`) | GRD-1 |
| **Qui 20 a Sex 21** | **Trilha A**, admin | ADM-4.2 (#32, cobertura de jornadas) | JAG-1, JAG-2 |
| **Qui 20 a Sex 21** | **Trilha B**, instrutor | INS-2 (escopo "meus alunos" real) | INS-1 |
| **Qua 19 a Sex 21** | **Trilha C**, config | CFG-2 (Notificações persistida) | nada |
| **Seg 24 a Qua 26** | **Trilha C**, config | CFG-3 (CRUD de chapéus sobre `user_roles`) | GRD-1 |
| **Seg 24 a Ter 25** | **Trilha A**, adoção | ADO-1 (instrumentar o funil de jornada) | JAG-1 |
| **Qua 26** | Congelamento | Fim de escopo novo. Nada entra depois disto. | tudo acima |
| **Qui 27** | QA gate | 7 checks do gate, correções de defeito apenas | congelamento |
| **Sex 28/08** | Deploy | Merge em `deploy/cory` e deploy, por @devops | QA gate PASS |
| Sáb 29, Dom 30 | Contingência | Não usar. Existe para absorver falha de deploy. | |

### 3.2 Por que cada paralelismo é legítimo

Paralelismo sem dependência real é coordenação gratuita. Cada uma das justificativas abaixo é por
ausência de arquivo compartilhado, não por conveniência de calendário.

**Trilha A (espinha, #32, adoção) roda isolada.** JAG-1 e JAG-2 criam um módulo novo em
`lib/analytics/`, não editam nenhum arquivo existente das outras trilhas. ADM-4.2 consome o módulo
e toca apenas `/admin/visao-geral`, que nenhuma outra trilha abre.

**Trilha B (segurança e instrutor) é paralela a A porque não lê `study_plans`.** O analytics do
instrutor trabalha com sessões, reflexões e detalhes de aluno (`getStudentDetails`,
`getRecentReflections`), não com plano de estudo. Não existe um arquivo em comum entre
`resolve-dashboard-kind.ts` mais as rotas de analytics e o módulo novo de agregação. É paralelismo
real.

**Dentro da Trilha B há uma dependência de ordem, e ela é declarada: GRD-1 antes de INS-1.** As
duas mexem na mesma decisão conceitual (quem pode ver o quê, por união de chapéus) e INS-1 toca
`api/analytics/manager-groups/route.ts:76-88`, vizinho das rotas que GRD-1 migra. GRD-1 estabelece
o helper de autorização e INS-1 o consome, exatamente o padrão que a casa já usou em
`epic-manager-ux/S5-fix-gate-union.md`. Rodar as duas em paralelo produziria conflito de merge na
camada de autorização e, pior, duas semânticas de precedência concorrentes.

**Trilha C (configurações) é paralela a A e a B porque é outro módulo inteiro.** CFG-1 toca
`packages/shared/src/modules/registry.ts`, CFG-2 toca `(platform)/configuracoes/page.tsx` mais uma
migration de preferências, CFG-3 cria tela nova sobre `user_roles`. Zero interseção com analytics
ou com jornada.

**CFG-3 depende de GRD-1.** Um CRUD que atribui e revoga chapéus tem que ser gateado pela mesma
semântica de união que GRD-1 estabelece, senão a tela que gerencia papéis seria a única a
autorizar pelo papel singular, que é o defeito que o bloco está corrigindo.

**ADM-4.2 depende de JAG-1 e JAG-2, sem atalho.** É a razão de existir da espinha. Começar a #32
antes é construir a agregação dentro dela, que é precisamente o que a secao 2.2 item 5 diz para
não fazer.

**ADO-1 depende de JAG-1 apenas para reusar o contrato de tipos**, não para funcionar. Se JAG-1
atrasar, ADO-1 pode ser feita com query direta, com custo de retrabalho pequeno.

### 3.3 Ponto de não retorno

**Se, no fim de quarta 19/08, JAG-2 não estiver verde**, a #32 não entra em agosto e o bloco fecha
sem ela. Nesse cenário, a espinha ainda é entregue (ela serve setembro), e o Admin fica com a
`/admin/visao-geral` atual, que já está em produção e funcionando. É uma perda aceitável, e é
preferível a comprimir a #32 contra o QA gate na quinta 27.

---

## 4. O que fica de fora, decisões registradas

Isto é decisão, não omissão. Cada item abaixo foi avaliado e cortado com motivo.

### 4.1 Jornada da Turma (#22, sub-issues #23 a #27), para setembro

**Motivo:** são 5 sub-issues, 0 fechadas, sobre uma superfície nova (`/instructor/turma`) que
depende de um dado agregado que não existe hoje. Cabe em 10 dias, não cabe em 11 dias úteis que
já contêm outras 4 frentes e um QA gate. Manter no bloco significaria entregar as 5 pela metade.

**Decisão do dono, já tomada:** a Jornada da Turma escorrega para setembro, e a espinha de
agregação fica pronta antes dela.

**O que muda com isso:** em setembro, a #23 (contrato `ClassJourneyView`) começa consumindo um
módulo pronto e testado, em vez de começar construindo o cálculo do zero. A frente sai de agosto
mais barata do que entrou.

**Condição de revisão:** ver secao 7. Se a cobertura de jornadas medida pela #32 continuar
próxima de 1%, a #22 não deve ser construída em setembro, deve ser reavaliada.

### 4.2 Cobrança, item de roadmap próprio

**Motivo:** não existe uma linha. Zero tabela de assinatura, zero tabela de fatura, zero gateway
de pagamento no repositório. Não é uma tela pendente, é um subsistema.

Cobrança tem **dependência externa dura**: escolha e contratação de gateway, dados fiscais,
modelo de plano e preço, e uma decisão de negócio sobre quem é cobrado num produto que hoje é
entregue a um cliente enterprise (Argos / Cory Alimentos) e não a self-service. Nenhuma dessas
decisões é de engenharia, e nenhuma delas está tomada.

**Decisão:** sai do bloco "Em andamento" e vira item de roadmap próprio, a ser aberto quando o
modelo comercial estiver decidido. Enquanto isso, a tela "Cobrança" não aparece no menu e não
aparece como "Em breve", porque prometer uma data implícita para algo sem gateway é dívida de
expectativa.

### 4.3 RBAC customizável, epic próprio

**Motivo:** "Perfis e Permissões" pode significar duas coisas muito diferentes. RBAC customizável
(criar papéis novos, compor permissões arbitrárias, matriz de recurso por ação) é um subsistema
que atravessa app-layer e RLS, e reabriria toda a camada de autorização que o bloco está
justamente estabilizando com GRD-1.

**Decisão do dono, já tomada:** "Perfis e Permissões" nesta entrega é **CRUD de chapéus**,
atribuir e revogar os 6 papéis existentes sobre a tabela `user_roles`. Nada mais.

RBAC customizável vira epic próprio, sem data, e só deve ser considerado quando existir demanda
de cliente que os 6 papéis não atendam. Não há registro dessa demanda hoje.

### 4.4 Migrar `auth_user_role()` do banco para união de chapéus

**Motivo:** o anel RLS continua decidindo pelo papel singular, o que já foi mapeado e sinalizado
em `epic-manager-ux/S5-fix-gate-union.md`. Migrar a função do banco é mudança de blast radius
alto sobre dezenas de policies, e não é o defeito que o usuário sente hoje.

**Decisão:** fora do bloco. GRD-1 corrige a camada de aplicação, que é o gate real nas rotas que
usam service client, e **sinaliza** o resíduo do banco sem tocá-lo. Não representar o RLS como
defesa em profundidade para este defeito específico.

---

## 5. Epics e stories

Formato AIOX. Toda story declara **Critério de aceite** verificável e **Gate mecânico** com
comando literal. "Testar manualmente" não é gate e não aparece em nenhuma story abaixo.

Convenções de comando neste repositório (verificadas):

| Comando | O que faz |
|:---|:---|
| `pnpm --filter @eximia/web typecheck` | `tsc --noEmit` em `apps/web` |
| `pnpm --filter @eximia/web lint` | `biome check ./src` |
| `pnpm --filter @eximia/web test` | `vitest run` |
| `pnpm --filter @eximia/web exec vitest run <path>` | roda um arquivo de teste específico |

Testes novos seguem o padrão existente em `apps/web/tests/lib/`.

---

### EPIC-JORNADA-AGG (novo), Espinha de agregação de jornada

**Objetivo:** existir **um** cálculo de jornada agregada para N alunos, testado, consumido por
todas as visões de gestão, presentes e futuras.

**Por que existe:** hoje o motor de jornada só existe para 1 aluno
(`lib/journey/journey-plan-data.ts`, `lib/analytics/study-plan-projection.ts`,
`lib/analytics/plan-dashboard-data.ts`) e a visão do gestor deriva ritmo de
`courses.deadline_days`, não de `study_plans`. A #32 e a #23 precisam do mesmo agregado.

**Regra de ouro:** nada aqui inventa vocabulário novo. `ModuleStatus`, `ModuleJourneyItem`,
`PlanDashboardData`, `StudyPlanDiagnostic` são **importados**, não redesenhados (Constitution,
Artigo IV, No Invention).

---

#### JAG-1, Contrato e função de agregação de `study_plans` para N alunos

> Executor: @dev · Tipo: feat · Janela: seg 17 a ter 18/08 · Depende de: nada

**User Story**
Como plataforma que precisa mostrar jornada de um conjunto de alunos (time do gestor, alunos de
um instrutor, organização inteira), preciso de **uma única** função que receba uma lista de
`studentId` mais um escopo de curso e devolva o estado agregado de jornada, reusando o motor por
aluno que já existe, para que Admin, Gestor e Instrutor leiam o mesmo número e a mesma definição
de "atrasado".

**Estado atual (recon)**
- Motor por 1 aluno existe e é correto: `lib/analytics/study-plan-projection.ts`,
  `lib/analytics/plan-dashboard-data.ts`, `lib/journey/journey-plan-data.ts`.
- Agregação para N alunos: **não existe** em nenhum arquivo do repositório.
- Visão do gestor deriva ritmo de `courses.deadline_days`, não de `study_plans`.
- Produção: 302 matrículas, **4 `study_plans`**. O caso dominante é "aluno sem plano".

**Escopo decidido**
1. Criar `apps/web/src/lib/analytics/journey-aggregate.ts` com o contrato de tipos e a função de
   agregação por lista de `studentId` mais `courseId`.
2. Tratar **"aluno sem `study_plan`" como estado de primeira classe** e nomeado (não como `null`
   silencioso, não como zero). É o estado de 98,7% da base, e é o dado que a #32 precisa reportar.
3. Reusar os tipos existentes por importação. Zero sinônimo novo para conceito já modelado.
4. Função pura sobre dados já buscados, sem acesso a rede, para ser testável por fixture.

**Fora de escopo**
- Rota de API e desempenho (é JAG-2).
- Qualquer tela (é ADM-4.2, e em setembro a #24).
- Alterar o motor por 1 aluno.

**Critério de aceite**
1. `journey-aggregate.ts` exporta uma função que recebe `studentIds: string[]` mais escopo de
   curso e devolve o agregado, com o estado "sem plano" nomeado explicitamente no tipo de retorno.
2. Existe teste com fixture cobrindo, no mínimo: N alunos todos com plano, N alunos nenhum com
   plano, e o caso misto que é o de produção (poucos com plano, maioria sem).
3. Nenhum tipo novo duplica semântica de `ModuleStatus`, `ModuleJourneyItem`, `PlanDashboardData`
   ou `StudyPlanDiagnostic`. Todos são importados.
4. Nenhum arquivo fora de `lib/analytics/` foi modificado.

**Gate mecânico**
```
pnpm --filter @eximia/web exec vitest run tests/lib/journey-aggregate.test.ts
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web lint
git diff --name-only main...HEAD -- apps/web/src | grep -v '^apps/web/src/lib/analytics/' ; test $? -eq 1
```
A última linha prova o AC4: o grep não pode encontrar nenhum arquivo modificado fora de
`lib/analytics/`, portanto tem que sair com status 1.

---

#### JAG-2, Rota de agregação e desempenho para N alunos

> Executor: @dev · Tipo: feat · Janela: ter 18 a qua 19/08 · Depende de: JAG-1

**User Story**
Como consumidor da agregação (Admin hoje, Instrutor em setembro), preciso de uma rota que devolva
o agregado para um escopo, sem N+1 de consulta, para que a tela carregue com a base real de 184
usuários e 302 matrículas sem degradar.

**Escopo decidido**
1. Rota de API que resolve o escopo (tenant, subtree de gestor, ou curso x unidade) e chama a
   função pura de JAG-1.
2. Busca em lote de `study_plans` para os N alunos, **uma consulta**, sem laço por aluno.
3. Autorização por união de chapéus desde o primeiro commit, nunca por `profile.role` singular.
   Esta rota nasce correta e não entra na dívida que GRD-1 está pagando.

**Fora de escopo**
- Cache entre requisições. Se o desempenho medido exigir, vira story própria em setembro.

**Critério de aceite**
1. A rota devolve o agregado para os 3 escopos previstos, com teste por escopo.
2. Teste prova ausência de N+1: para uma lista de 50 alunos, o número de chamadas ao cliente de
   banco é constante e não cresce com N (asserção sobre o mock).
3. A rota autoriza por união de chapéus. Um usuário com chapéu válido e `profile.role` singular
   diferente **passa**.
4. `grep -n "profile.role" ` no arquivo da rota não retorna nenhuma linha em decisão de gate.

**Gate mecânico**
```
pnpm --filter @eximia/web exec vitest run tests/lib/journey-aggregate-route.test.ts
grep -rn "profile\.role" apps/web/src/app/api/analytics/journey-aggregate/ ; test $? -eq 1
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web test
```

---

#### ADO-1, Instrumentar o funil de adoção da jornada

> Executor: @dev · Tipo: feat · Janela: seg 24 a ter 25/08 · Depende de: JAG-1 (contrato)

**User Story**
Como dono do produto, preciso saber **por que** só 4 de 302 matrículas têm plano de estudo, para
decidir se a Jornada da Turma deve mesmo ser construída em setembro, porque construir a terceira
camada de leitura sobre um dado que quase não existe é desperdício.

**Estado atual (recon)**
Produção: 184 usuários, 302 matrículas, 3 de 6 cursos com meta de gestor configurada,
**4 `study_plans` para 4 alunos distintos**, ou seja **1,3% de adoção** desde 23/07.
Não existe hoje nenhuma medição de onde o funil quebra.

**Escopo decidido**
1. Instrumentar 3 pontos do funil: quantos alunos **veem** o convite para montar a jornada,
   quantos **abrem** `/jornada`, quantos **salvam** um plano.
2. Expor a série num lugar consultável (query documentada, ou card na `/admin/visao-geral`,
   decisão do executor conforme custo).
3. Documentar a leitura: descoberta, fricção ou desinteresse. São três causas com três remédios
   opostos, e hoje não sabemos qual é.

**Fora de escopo**
- Qualquer mudança no fluxo de criação de plano. Esta story **mede**, não conserta.

**Critério de aceite**
1. Os 3 eventos do funil são registrados e consultáveis.
2. Existe uma consulta documentada que devolve os 3 números para um intervalo de datas.
3. O documento de leitura declara qual causa cada padrão de número indicaria.

**Gate mecânico**
```
pnpm --filter @eximia/web exec vitest run tests/lib/journey-funnel.test.ts
grep -n "journey_funnel\|jornada_funil" docs/analytics/journey-funnel.md
pnpm --filter @eximia/web typecheck
```

---

### EPIC #28, Jornada da Organização

#### ADM-4.2, Cobertura de jornadas na visão do Admin (issue #32)

> Executor: @dev · Tipo: feat · Janela: qui 20 a sex 21/08 · Depende de: JAG-1, JAG-2, AÇÃO 0

**User Story**
Como Admin, quero ver na `/admin/visao-geral` quantos alunos da organização têm jornada montada e
quantos não têm, quebrado por curso e por unidade, para saber se a camada de jornada está sendo
usada antes de cobrar resultado dela.

**Estado atual (recon)**
- `/admin/visao-geral` existe e está em produção (entrega da #29).
- A #32 está registrada como bloqueada por `courses.manager_deadline_days` não aplicada em
  produção. **A coluna existe em produção**, verificado via Management API. Ver AÇÃO 0.
- 3 de 6 cursos têm meta de gestor configurada, então a tela precisa distinguir "curso sem meta"
  de "aluno sem plano". São coisas diferentes e um número só as confunde.

**Escopo decidido**
1. Card de cobertura de jornada na `/admin/visao-geral`, consumindo a rota de JAG-2.
2. Três estados distintos e visíveis: curso sem meta configurada, aluno com plano, aluno sem plano.
3. Quebra por curso e por unidade.

**Fora de escopo**
- Ação sobre o número (convidar, cobrar, gerar plano). É leitura, não intervenção.
- Qualquer visão de instrutor. É a Trilha B e, para turma, setembro.

**Critério de aceite**
1. O card aparece na `/admin/visao-geral` para papel Admin, com os 3 estados nomeados.
2. Com os dados reais de produção, o card apresenta cobertura próxima de 1,3%, e não um número
   inflado por contar como "coberto" aluno de curso sem meta.
3. A tela não faz nenhum cálculo de jornada própria, apenas consome a rota de JAG-2. Grep prova
   ausência de import direto de `study-plan-projection` no componente.
4. Nenhum acesso da tela sobrepõe o escopo de tenant do Admin.

**Gate mecânico**
```
pnpm --filter @eximia/web exec vitest run tests/lib/admin-journey-coverage.test.ts
grep -rn "study-plan-projection\|plan-dashboard-data" apps/web/src/app/\(platform\)/admin/visao-geral/ ; test $? -eq 1
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web test
```

---

### EPIC-ANALYTICS-INSTRUTOR (novo), Analytics do instrutor e autorização do drill-down

**Objetivo:** o instrutor deixa de ser um gestor disfarçado e passa a ser um papel de primeira
classe com escopo de dado real, e o drill-down de analytics para de barrar usuário multi-chapéu.

---

#### GRD-1, Unificar autorização do drill-down de analytics por união de chapéus

> Executor: @dev · Tipo: fix de segurança · Janela: seg 17 a ter 18/08 · Depende de: nada
> **LANDS FIRST** dentro deste epic. INS-1 e CFG-3 consomem o que esta story estabelece.

**User Story**
Como plataforma com usuários multi-chapéu, o drill-down de analytics DEVE autorizar pela união
real de chapéus (`user_roles`), igual à tela que dá acesso a ele, e nunca pela coluna singular
`profile.role`, para que um usuário que passa em `/analytics` não seja barrado ao clicar num aluno.

**Estado atual (recon, arquivo:linha)**
- `/analytics` autoriza por união: `apps/web/src/app/(platform)/analytics/page.tsx:82`.
- Autorizam por singular:
  `analytics/students/[studentId]/page.tsx:16`,
  `analytics/sessions/[sessionId]/page.tsx:19`,
  `api/analytics/aggregate:700`,
  `api/analytics/insights:56`,
  `api/analytics/pedagogical-actions:217`,
  `api/analytics/students:42`,
  `api/analytics/sessions:39`.
- Política canônica de precedência já existe e deve ser espelhada, não reinventada:
  `api/analytics/aggregate/route.ts` (admin e super_admin acima de manager, acima de instructor,
  fail-closed no resto).
- Helpers já existem: `lib/role-helpers.ts` (`hasRole`, `hasAnyRole`), `lib/auth.ts`
  (`getAuthProfile()` já devolve `roles: string[]`).

**Escopo decidido**
1. Migrar as 2 páginas e as 5 rotas para união de chapéus, com a precedência canônica.
2. Onde a rota não usa `getAuthProfile()`, disponibilizar `roles` pelo mesmo recipe já usado na
   casa, minimizando blast radius.
3. Teste **vermelho primeiro**: reproduzir o barramento indevido do multi-chapéu antes do fix.
4. Produzir a lista autoritativa dos `profile.role` restantes em decisão de gate no analytics,
   com grep residual igual a zero nas 7 superfícies.

**Fora de escopo**
- Migrar `auth_user_role()` no banco (secao 4.4). Apenas sinalizar.
- Qualquer mudança de UI.

**Critério de aceite**
1. Teste vermelho existente antes do fix, verde depois: usuário com `roles` contendo `manager` e
   `profile.role` singular diferente **acessa** o drill-down de aluno e de sessão.
2. Teste prova que a precedência é idêntica à de `aggregate/route.ts`, incluindo o fail-closed.
3. Grep de `profile.role` em decisão de gate nas 7 superfícies retorna zero.
4. Nenhuma regressão: a suíte inteira de `apps/web` passa.

**Gate mecânico**
```
pnpm --filter @eximia/web exec vitest run tests/lib/analytics-drilldown-authz.test.ts
grep -rn "profile\.role" apps/web/src/app/\(platform\)/analytics/students apps/web/src/app/\(platform\)/analytics/sessions apps/web/src/app/api/analytics ; test $? -eq 1
pnpm --filter @eximia/web test
pnpm --filter @eximia/web typecheck
```

---

#### INS-1, `instructor` como `DashboardKind` de primeira classe

> Executor: @dev · Tipo: feat · Janela: qua 19 a qui 20/08 · Depende de: GRD-1

**User Story**
Como instrutor, quero que o sistema me reconheça como instrutor e não me achate em gestor, para
que a resolução de painel e o recorte de analytics sejam os meus, e não os de outro papel.

**Estado atual (recon, arquivo:linha)**
- `/instructor` existe e funciona.
- `instructor` **não é** um `DashboardKind` em `resolve-dashboard-kind.ts:104`.
- `toAnalyticsRole()` em `api/analytics/manager-groups/route.ts:76-88` achata `instructor` em
  `manager`.

**Escopo decidido**
1. Adicionar `instructor` como `DashboardKind`, com a precedência de papéis explícita.
2. Remover o achatamento em `toAnalyticsRole()`, passando o papel real adiante.
3. Preservar comportamento atual de gestor e admin, byte a byte, verificado por teste.

**Fora de escopo**
- Escopo de dado "meus alunos" (é INS-2).
- Qualquer tela nova.

**Critério de aceite**
1. `resolve-dashboard-kind` devolve `instructor` para usuário cujo chapéu de maior precedência é
   instrutor, e continua devolvendo o mesmo de hoje para gestor, admin e aluno.
2. `toAnalyticsRole()` não mapeia mais `instructor` para `manager`. Grep prova.
3. Teste de não regressão cobre os 4 papéis existentes na resolução de painel.

**Gate mecânico**
```
pnpm --filter @eximia/web exec vitest run tests/lib/resolve-dashboard-kind.test.ts
grep -n "instructor" apps/web/src/lib/resolve-dashboard-kind.ts
grep -n "manager" apps/web/src/app/api/analytics/manager-groups/route.ts | grep -i instructor ; test $? -eq 1
pnpm --filter @eximia/web test
```

---

#### INS-2, Escopo "meus alunos" real para o instrutor

> Executor: @dev · Tipo: fix · Janela: qui 20 a sex 21/08 · Depende de: INS-1

**User Story**
Como instrutor, quero ver os alunos que são meus, definidos por curso x unidade, e não todos os
alunos do tenant, porque hoje dois instrutores de unidades diferentes veem exatamente a mesma
lista, o que torna a tela inútil e vazante ao mesmo tempo.

**Estado atual (recon)**
`getStudentDetails` e `getRecentReflections` filtram por tenant mais área ativa. Não há recorte
por instrutor. **Todo instrutor vê os mesmos alunos.**

**Decisão do dono aplicada:** turma = **curso x unidade**. Sem entidade nova, sem migration. É o
escopo que `/instructor` já usa.

**Escopo decidido**
1. `getStudentDetails` e `getRecentReflections` passam a aceitar escopo de instrutor, resolvido
   por curso x unidade.
2. Fail-closed: instrutor sem vínculo de curso x unidade vê lista vazia, nunca a lista do tenant.
3. Teste vermelho primeiro, provando que hoje dois instrutores de unidades diferentes recebem o
   mesmo conjunto.

**Fora de escopo**
- Criar entidade `turma`, `cohort` ou `class_id`. Decisão do dono, sem migration.
- A superfície `/instructor/turma` e as sub-issues #24 a #27. Setembro.

**Critério de aceite**
1. Teste vermelho antes, verde depois: instrutor A da unidade X e instrutor B da unidade Y
   recebem conjuntos **diferentes** e corretos de alunos.
2. Instrutor sem vínculo recebe conjunto vazio, não o tenant inteiro.
3. Gestor e Admin não têm o escopo alterado. Teste de não regressão prova.

**Gate mecânico**
```
pnpm --filter @eximia/web exec vitest run tests/lib/instructor-student-scope.test.ts
pnpm --filter @eximia/web test
pnpm --filter @eximia/web typecheck
```

---

### EPIC-CONFIGURACOES, Fechamento das telas de gestão

#### CFG-1, Religar APIs, Integrações e Webhooks no menu

> Executor: @dev · Tipo: chore · Janela: seg 17 a ter 18/08 · Depende de: **DECISÃO 1 do dono**

**User Story**
Como Admin, quero alcançar pelo menu as telas de API Keys, Integrações e Webhooks, que já existem
completas e funcionais, porque hoje elas só são acessíveis por URL direta e portanto têm adoção
estruturalmente zero.

**Estado atual (recon, arquivo:linha)**
- As 3 telas existem e estão completas: CRUD, RLS, HMAC, worker de retry, teste de entrega.
- `packages/shared/src/modules/registry.ts:401-410` registra a decisão do dono de mantê-las em
  "Em breve" no hub e sem porta na barra, com a justificativa de que serão retrabalhadas.
  `routes` e `apiRoutes` seguem intactos.

**Bloqueio declarado:** esta story **não executa** sem a DECISÃO 1 (secao 8). A decisão de esconder
foi do dono e registrada em código, e reverter sem o GO seria desfazer decisão alheia.

**Escopo decidido (se DECISÃO 1 for religar)**
1. Restaurar as entradas de navegação das 3 telas no registry.
2. Nenhuma mudança nas telas, nas rotas ou nos guards. É porta, não conteúdo.
3. Atualizar o comentário de decisão no registry com a data e o motivo da reversão.

**Fora de escopo**
- Retrabalhar as telas. Se o retrabalho for a decisão, isso é epic próprio, não cabe em agosto.

**Critério de aceite**
1. As 3 telas aparecem na navegação para o papel que já tinha permissão de rota.
2. Nenhum guard foi afetado. Usuário sem permissão continua barrado, provado por teste.
3. O comentário de decisão no registry está atualizado com data e motivo.

**Gate mecânico**
```
grep -n "api-keys\|integrations\|webhooks" packages/shared/src/modules/registry.ts
pnpm --filter @eximia/web exec vitest run tests/lib/feature-gate.test.ts
pnpm --filter @eximia/web test
pnpm --filter @eximia/web typecheck
```

---

#### CFG-2, Notificações persistida

> Executor: @dev · Tipo: feat · Janela: qua 19 a sex 21/08 · Depende de: nada

**User Story**
Como usuário que desliga um tipo de notificação, quero que a escolha sobreviva a um recarregar de
página, porque hoje os 4 toggles vivem em `useState`, não fazem nenhum fetch, e a preferência é
esquecida no instante seguinte. Uma tela que finge salvar é pior do que uma tela ausente.

**Estado atual (recon, arquivo:linha)**
- `apps/web/src/app/(platform)/configuracoes/page.tsx:30-54`: 4 toggles em `useState`, zero fetch,
  zero persistência.
- Já existe Engagement Center funcional em `/admin/notifications`, com Resend integrado. A
  preferência do usuário precisa ser **respeitada** por ele, não apenas gravada.

**Escopo decidido**
1. Persistir as preferências (tabela ou coluna JSONB, decisão do executor com @data-engineer).
2. Carregar no SSR e salvar no toggle, com estado de erro visível.
3. **O Engagement Center passa a respeitar a preferência no disparo.** Sem isto, a story entrega
   um toggle honesto que não faz nada, que é apenas uma mentira mais bem guardada.

**Fora de escopo**
- Novos canais de notificação. Os 4 tipos existentes, e só.

**Critério de aceite**
1. Preferência salva sobrevive a recarregar a página, provado por teste de integração.
2. Disparo do Engagement Center para um usuário com o tipo desligado **não** envia, provado por
   teste.
3. Falha de rede no salvamento apresenta erro e não deixa o toggle num estado falso.
4. Grep prova que não resta `useState` como única fonte de verdade das 4 preferências.

**Gate mecânico**
```
pnpm --filter @eximia/web exec vitest run tests/lib/notification-preferences.test.ts
grep -n "useState" apps/web/src/app/\(platform\)/configuracoes/page.tsx
pnpm --filter @eximia/web test
pnpm --filter @eximia/web typecheck
```

---

#### CFG-3, Perfis e Permissões, CRUD de chapéus sobre `user_roles`

> Executor: @dev · Tipo: feat · Janela: seg 24 a qua 26/08 · Depende de: GRD-1

**User Story**
Como Admin, quero atribuir e revogar os papéis existentes de um usuário numa tela, para parar de
depender de acesso ao banco toda vez que alguém vira gestor ou instrutor.

**Decisão do dono aplicada:** isto é **CRUD de chapéus** sobre `user_roles`, atribuir e revogar os
6 papéis existentes. **Não é RBAC customizável** (secao 4.3).

**Escopo decidido**
1. Tela de listagem de usuários do tenant com os chapéus atuais de cada um.
2. Atribuir e revogar chapéu, com registro de auditoria (a tela de Auditoria já existe e deve
   receber o evento).
3. Gate por união de chapéus, consumindo o que GRD-1 estabeleceu.
4. Duas travas duras: um Admin **não pode** revogar o próprio último chapéu de Admin, e
   `super_admin` não é atribuível pela tela.

**Fora de escopo**
- Criar papel novo, compor permissão, matriz de recurso por ação. Epic próprio.
- Alterar `auth_user_role()` no banco.

**Critério de aceite**
1. Atribuir e revogar chapéu reflete em `user_roles` e passa a valer na próxima sessão do usuário
   alvo, provado por teste.
2. Tentativa de auto-revogar o último chapéu de Admin é bloqueada, provado por teste.
3. `super_admin` não é oferecido nem aceito pela rota, mesmo por requisição forjada, provado por
   teste.
4. Cada operação gera evento de auditoria consultável.

**Gate mecânico**
```
pnpm --filter @eximia/web exec vitest run tests/lib/role-crud.test.ts
grep -rn "super_admin" apps/web/src/app/api/admin/roles/ | grep -i "reject\|forbid\|block"
pnpm --filter @eximia/web test
pnpm --filter @eximia/web typecheck
```

---

## 6. Resumo de dependências

```
AÇÃO 0 (#32 desbloqueada)
   |
   +--> ADM-4.2 (#32)
            ^
            |
JAG-1 --> JAG-2 --> ADM-4.2
   |
   +--> ADO-1

GRD-1 --> INS-1 --> INS-2
   |
   +--> CFG-3

CFG-1 (bloqueada por DECISÃO 1, sem dependência de código)
CFG-2 (sem dependência)
```

Três raízes independentes: JAG-1, GRD-1 e CFG-2. É por isso que existem três trilhas paralelas e
não mais do que três.

---

## 7. Riscos e o que os mata

### 7.1 RISCO PRINCIPAL, adoção de 1,3% da camada de jornada

**O dado.** Produção, medida em 14/08/2026: 184 usuários, 302 matrículas, 3 de 6 cursos com meta
de gestor configurada, e **4 `study_plans` para 4 alunos distintos**. Desde 23/07. Isso é
**1,3% de adoção**.

**Por que isto é o maior risco do bloco, e não o prazo.** Duas das frentes deste roadmap (a #32 e,
em setembro, a #22 inteira, 10 dias) são **camadas de leitura sobre esse dado**. Construir a
Jornada da Turma significa construir 5 sub-issues para instrutores lerem um plano de estudo que
98,7% dos alunos não têm. Pela diretriz da casa, valor não é declarado por quem constrói, é
confirmado por quem usa, e o gargalo não é construir, é fazer chegar. Aqui o gargalo está gritando.

**O que NÃO fazer:** silenciar o número e seguir construindo. Também não fazer: matar a jornada
por causa do número, porque 1,3% pode significar três coisas opostas e ainda não sabemos qual.

**A resposta, em três partes:**

**(a) A #32 vira instrumento de medição, não só tela.** É o motivo de ADM-4.2 ter como critério de
aceite explícito apresentar cobertura próxima de 1,3% e **não** inflar o número contando como
"coberto" aluno de curso sem meta configurada. Uma tela de cobertura que maquia a cobertura seria
o pior resultado possível deste bloco.

**(b) ADO-1 entra no escopo de agosto.** Instrumentar os 3 pontos do funil (vê o convite, abre
`/jornada`, salva o plano) custa 1 sessão e distingue as três causas possíveis:

| Padrão do funil | Causa | Remédio |
|:---|:---|:---|
| Poucos veem o convite | Descoberta | Porta, posição, momento. Barato. |
| Muitos veem, poucos abrem | Proposta de valor | Copy e contexto. Barato. |
| Muitos abrem, poucos salvam | Fricção do montador | Produto. Caro, mas dirigido. |
| Muitos salvam e não voltam | Desinteresse | Repensar a feature, não a tela. |

Sem esses números, qualquer decisão sobre a #22 em setembro é palpite.

**(c) Recomendação ao dono, com critério de morte declarado.** Registro aqui, para revisão em
**30/09/2026**:

> Se, em 30/09/2026, a cobertura de jornada medida pela #32 não passar de **15%** das matrículas
> ativas em cursos com meta configurada, a Jornada da Turma (#22, 5 sub-issues, 10 dias) **não
> deve ser construída**. Deve ser substituída por trabalho de ativação: gerar plano padrão no ato
> da matrícula, ou dar ao gestor e ao instrutor a ação de montar a jornada pelo aluno.

Isto é uma bala antes do canhão. Ativação custa uma fração dos 10 dias da #22 e ataca a causa, não
o sintoma. Construir a tela de leitura primeiro é otimizar o relatório de um processo que não
acontece.

### 7.2 Demais riscos

| Risco | Impacto | Probabilidade | O que o mata |
|:---|:---|:---|:---|
| As 3 decisões do dono (secao 8) não saem em 14/08 | Alto, atrasa CFG-1 e trava o paralelismo da Trilha C | Média | Decidir hoje. As três estão formuladas como sim ou não, e nenhuma exige investigação nova. |
| JAG-2 revela N+1 caro com 184 usuários | Médio, empurra ADM-4.2 para fora do bloco | Média | Critério de aceite 2 de JAG-2 é asserção de chamadas constantes. Se falhar, o ponto de não retorno da secao 3.3 corta a #32 e preserva a espinha. |
| GRD-1 quebra acesso de alguém em produção | Alto, é camada de autorização em cliente ativo | Baixa | Teste vermelho primeiro, suíte inteira no gate, e a política de precedência é copiada de `aggregate/route.ts`, que já roda em produção. |
| CFG-2 grava preferência que o Engagement Center ignora | Médio, entrega um toggle mentiroso | Média | Critério de aceite 2 exige o teste de disparo suprimido. Sem ele a story não fecha. |
| CFG-3 permite escalada de privilégio | Alto | Baixa | Duas travas duras com teste próprio: sem `super_admin` atribuível, sem auto-revogação do último Admin. |
| Deploy de sexta 28/08 falha e não há dia útil sobrando | Alto | Baixa | Congelamento na quarta 26, QA gate na quinta 27, e 29 e 30/08 existem como contingência que não deve ser usada. |
| Escopo novo entrar depois do congelamento | Alto, é o modo clássico de estourar prazo fixo | Média | 26/08 é congelamento declarado. Depois disso, só correção de defeito. Qualquer item novo vai para setembro por definição, não por negociação. |

### 7.3 Pré-mortem, uma linha

Se este bloco falhar em 28/08, a causa mais provável não será complexidade técnica, será **as 3
decisões do dono ficarem paradas até a semana do dia 24**, colapsando três trilhas paralelas numa
fila sequencial na última semana.

---

## 8. Decisões pendentes do dono, todas para 14/08

Formuladas como sim ou não. Nenhuma exige investigação nova.

**DECISÃO 1, religar APIs, Integrações e Webhooks no menu?**
As 3 telas estão completas e funcionais, escondidas por decisão registrada em
`registry.ts:401-410` ("vão ser retrabalhados"). Hoje elas têm adoção estruturalmente zero.
*Recomendação:* religar. O retrabalho, se acontecer, é epic próprio, e nada impede que uma tela
disponível seja melhorada depois. Manter escondido é pagar o custo de ter construído e não
receber nada em troca.
*Bloqueia:* CFG-1.

**DECISÃO 2, o escopo do instrutor é curso x unidade, confirmado para INS-2?**
A decisão já foi tomada para "turma". INS-2 aplica o mesmo recorte ao escopo de alunos do
analytics, que é onde ele muda comportamento hoje, e não só em setembro.
*Recomendação:* confirmar. Usar dois recortes diferentes para o mesmo instrutor seria pior que o
defeito atual.
*Bloqueia:* INS-2.

**DECISÃO 3, aceita o critério de morte da #22 registrado em 7.1(c)?**
Cobertura abaixo de 15% em 30/09 troca a Jornada da Turma por trabalho de ativação.
*Recomendação:* aceitar. Um critério de saída definido antes de rodar é o que separa decisão de
sunk cost. Se recusado, registrar o motivo, porque a #22 então será construída por convicção e
não por evidência, o que é uma escolha legítima mas deve ser consciente.
*Bloqueia:* nada em agosto. Define setembro.

---

## 9. Governança da execução

| Item | Definição |
|:---|:---|
| Classificação | Tier 1 (`sdc-mandatory.md`): cria e modifica código de aplicação, afeta mais de 3 arquivos, tem impacto em usuários |
| POP aplicável | `POP-BUILD-001` para JAG, ADO, CFG-2, CFG-3, ADM-4.2. `POP-FIX-001` para GRD-1, INS-2 (existem e não fazem o que deveriam) |
| First-move rule | GRD-1, INS-2 e CFG-2 são correções: **teste vermelho primeiro**, antes de qualquer linha de código de correção |
| Autoridade de push | @devops (Gage), exclusiva. Nenhum outro agente faz `git push`, `gh pr create` ou `gh pr merge` |
| QA gate | 7 checks, quinta 27/08, veredito PASS obrigatório antes do deploy de sexta 28/08 |
| Branch | Trabalho em branch de feature, merge em `deploy/cory` apenas após QA gate PASS |

---

## 10. Change log deste documento

| Data | Mudança | Autor |
|:---|:---|:---|
| 2026-08-14 | Documento criado. Roadmap "Em andamento" corrigido contra reconhecimento de código verificado, escopo cortado para caber em 11 dias úteis, 5 frentes definidas, risco de adoção de 1,3% endereçado com item de trabalho e critério de morte. | @pm (Morgan) |
