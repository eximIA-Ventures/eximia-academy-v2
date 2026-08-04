# Story: Lançamento do onboarding de novidades, com janela de validade e controle de quem viu

**Version:** 1.0
**Created:** 2026-08-01
**Author:** River (@sm)
**Status:** Draft, aguardando GO do Hugo
**Priority:** P1
**Branch:** `deploy/cory`
**Type:** Feature (brownfield) + infraestrutura nova
**Tier:** 1 (Epic-level: cria tabela, muda navegação, toca produção compartilhada)
**Predecessora:** `docs/stories/feat-percorrido-na-tela-do-aluno.md`
**Contratos de arquitetura:** `docs/architecture/onboarding-novidades-contrato-lancamento.md` e `...-contrato-janela.md`
(produzidos por 10 agentes que mediram o banco de produção; este documento os
consolida, não os substitui)

---

## User Story

**As a** aluno da eximIA Academy que já usava a plataforma antes de agosto,
**I want** ser avisado uma única vez sobre o que mudou, dentro de uma janela curta,
**so that** eu entenda as novidades sem receber um acúmulo de avisos velhos toda vez
que entro.

**As a** eximIA lançando features,
**I want** que o anúncio expire sozinho e nunca alcance quem chegou depois,
**so that** o aluno novo não herde o passivo histórico de tudo que já lançamos.

---

## O requisito, na voz do Hugo

Duas falas, em ordem, e a segunda reescreveu o modelo:

> "prepara para lançar a feature oficialmente. além disso, como você planeja
> controlar quem viu e quem não viu o tour?"

> "durante duas semanas, um mês no máximo... a pessoa que acabou de entrar em uma
> plataforma e não viu nenhum negócio de feature, vai ver todos? não, não pode,
> ela tem que ver só os atuais"

A segunda fala **não é um detalhe da primeira**. Ela troca o modelo de **fila de
pendências** ("esta pessoa deve N avisos") por **janela de validade** ("este aviso
está no ar até tal dia"). Na fila, o aluno novo herda o passivo inteiro. Na
janela, o acúmulo é **impossível por construção**, não por regra a lembrar.

---

## A regra, em uma frase

> **Um anúncio só aparece para quem já estava na plataforma antes de ele começar,
> só enquanto a janela dele estiver aberta, e só uma vez.**

---

## Produto x feature: a distinção que organiza tudo

Existem **três tipos de ensino in-app**, e misturá-los é o que gera acúmulo. O
tipo não é um rótulo escolhido por quem publica, é uma consequência do **gatilho**:

| Camada | Gatilho | Expira? | Onde vive |
|:---|:---|:---|:---|
| **Superfície permanente** | a pessoa perguntou | nunca | ícone "i" (`column-help-popover.tsx`, já em produção), estados vazios, `/help` |
| **Tour de tela** | primeira visita à rota | **nunca** | `kind = 'product_onboarding'`, janela PROIBIDA por CHECK |
| **Anúncio** | janela de data | **sempre** | `kind = 'announcement'`, janela OBRIGATÓRIA por CHECK |

**Por que o tipo não pode ser um campo livre:** no mesmo instante, "Jornada" é
*feature* para quem entrou em maio e é *produto* para quem entrou hoje. Um rótulo
manual estaria sempre errado para metade das pessoas, e todo mundo marcaria
"produto" na hora de publicar, porque soa mais importante e não expira. O acúmulo
voltaria pela porta do rótulo em três meses.

**Consequência aceita:** feature de 6 meses com adoção baixa **não** se corrige
reabrindo anúncio velho. Corrige-se com estado vazio, ajuda contextual, ou um
relançamento deliberado, que é linha nova, chave nova, janela nova.

---

## FASE 0 — Bloqueadores. Nada dispara antes disto.

> Os três foram **verificados no código**, não presumidos. Enquanto existirem, o
> onboarding aponta para o vazio.

### 0.1 A faixa some em toda carga fria

`StudyPlanInviteStrip` está na linha 251 de `student-comparison.tsx`, **depois de
três early returns** (linhas 237 a 239): `NoScopeInvite`, `ErrorState` e
`Skeleton`. E `Skeleton` é literalmente o primeiro paint de toda carga.

O passo final da novidade 2 **aponta para essa faixa**. Sem correção, ele aponta
para elemento inexistente, para todo usuário, em toda carga fria.

**Correção:** subir `<StudyPlanInviteStrip />` para
`components/dashboard/student-dashboard.tsx`, como irmã do bloco que contém
`<StudentComparison>` (linha 171), **fora do fetch**. O componente é um `<Link>`
estático, sem props e sem dependência de dado. Não há razão para estar atrás de
uma API de analytics.

**AC 0.1:** a faixa está no DOM com JavaScript desabilitado e com a API de
analytics retornando 500.
Verificação: teste de render com `fetch` mockado rejeitando.

### 0.2 O tour nunca dispararia onde foi projetado

A faixa aponta para `/jornada` **sem `?curso=`** (`study-plan-invite-strip.tsx:38`).
E `jornada/page.tsx:104-109` devolve `initialView="hub"` sempre que o param está
ausente, **inclusive para quem tem uma matrícula só**, por decisão registrada do
Hugo (JRN-D/D11, comentário no próprio arquivo).

Ou seja: **100% das entradas pela faixa caem no hub**, onde nenhum dos 6 controles
que o tour ensina existe.

**Correção, e ela é de desenho, não de código:** o gatilho do tour deixa de ser
"entrou em `/jornada`" e passa a ser **"o `JourneyBuilder` montou"**. A linha
nasce `armed` na resolução da novidade 2, e dispara no mount do construtor, seja
ele um minuto ou seis meses depois.

**AC 0.2:** aluno com 1 curso clica na faixa, cai no hub, e o tour **não** dispara.
O mesmo aluno escolhe o curso, o construtor monta, e o tour dispara.

### 0.3 Não existe infraestrutura de tour no repositório

`grep` negativo para `data-tour`, `data-onboarding`, `driver.js`, `reactour`,
`joyride`, `shepherd`. **Nenhuma âncora, nenhuma biblioteca.**

> **Custo honesto, e este é o item que estava fora do plano original:** isto é
> **construção**, não configuração. O protótipo em `app/dev/preview-feature-review`
> simula o tour com âncoras próprias, num mock da tela. No app real nada disso
> existe. Se este item for descoberto tarde, ele trava o cronograma sozinho.

**As 9 âncoras a criar**, todas por atributo estável, nunca por classe, posição ou
texto:

| Artefato | Elemento | Atributo |
|:---|:---|:---|
| novidade 1 | linha "Percorrido", `comparison-insights-table.tsx` (~1362) | `data-onboarding="ritmo-percorrido"` |
| novidade 1 | linha "Conclusão", idem (~1372) | `data-onboarding="ritmo-conclusao"` |
| novidade 2 | raiz do `<Link>`, `study-plan-invite-strip.tsx` | `data-onboarding="faixa-jornada"` |
| tour 1 | `deadlineChip` | `data-onboarding="jornada-prazo"` |
| tour 2 | `<AutoSwitch>` | `data-onboarding="jornada-auto"` |
| tour 3 | `<UnitSegmented>` | `data-onboarding="jornada-unidade"` |
| tour 4 | `<SuggestDropdown>` | `data-onboarding="jornada-sugestao"` |
| tour 5 | `<TimelineCanvas>` | `data-onboarding="jornada-linha"` |
| tour 6 | `<ModuleTable>` | `data-onboarding="jornada-modulos"` |

**AC 0.3:** existe teste que falha se qualquer uma das 9 âncoras sumir.

### 0.4 `/jornada` entra no menu

`components/layout/sidebar.tsx:105`, `navItems`. Hoje a tela **não está na
navegação** e a faixa é o único link do repositório inteiro para ela.

**Por que é bloqueador:** uma feature cuja única porta pode sumir não sustenta um
anúncio em massa. E o tour armado depende de a pessoa conseguir chegar ao
construtor por vontade própria, meses depois.

---

## FASE 1 — Modelo de dados

### 1.1 A divergência entre os dois contratos, e a decisão

Os contratos propuseram modelos diferentes, porque foram escritos antes e depois
do requisito de janela:

| | `contrato-lancamento` | `contrato-janela` |
|:---|:---|:---|
| Catálogo | TypeScript (`catalog.ts`) | Tabela `product_announcements` |
| Quem viu | `user_feature_intro` | `product_announcement_views` |
| Janela | não previa | `starts_at` / `ends_at` com CHECK |

**Decisão: prevalece o modelo do `contrato-janela`**, porque a janela precisa ser
avaliada **dentro da RLS**. Se ela vivesse só no TypeScript, um bug de cache do
front poderia ressuscitar um anúncio de 2026 em 2027. Com o predicado no banco, o
front pode errar e o dado simplesmente não aparece.

**O que se preserva do `contrato-lancamento`:** o estado `armed` do tour, as
decisões de RLS, o kill switch, a ordem de implantação e o funil de medição.

**Divisão final:**

| Parte | Onde vive | Por quê |
|:---|:---|:---|
| Conteúdo (modal, tour, imagens) | componente React, mapa `content_key → componente` | anúncio é interface, não parágrafo. HTML em coluna vira XSS e conteúdo que ninguém revisa em PR |
| Metadados (chave, janela, público, kind) | tabela | a janela precisa ser predicado de RLS |
| A linha em si | `INSERT` na migration do PR da feature | rollback da feature leva o anúncio junto |

### 1.2 A âncora de coorte: `users.announcements_since`

**Nem `users.created_at` nem `enrollments.created_at` servem.** Medido em produção
em 2026-08-01:

| Medição | Valor |
|:---|:---|
| Alunos de Vértice com atividade **anterior** ao próprio `users.created_at` | **120 de 120 (100%)** |
| Alunos com primeira matrícula criada antes da própria linha em `users` | 129 de 181 (71%) |
| Contas que **nunca fizeram login** | 133 de 185 |

`public.users.created_at == auth.users.created_at` em 184/184, mas isso **não
prova nada**: as duas tabelas foram recriadas juntas.

**A coluna nova é o carimbo do próprio sistema de anúncios**, e o backfill usa
**existência de linha** em `sessions` ou `chapter_view_progress`, nunca timestamp.
Por isso é imune à contaminação medida.

`enrollments` **não** conta como evidência: matrícula é ato do admin, não presença
da pessoa.

### 1.3 Decisões de chave, cada uma com a prova

**Sem `tenant_id` na chave.** `auth_tenant_id()` lê `users.tenant_id`, coluna
**mutável** (a troca de tenant faz UPDATE direto nela). Para conta com tenant
nulo, `WITH CHECK (... AND tenant_id = auth_tenant_id())` avalia **NULL, não
TRUE**, e devolve 42501: a pessoa lê, nunca escreve, e **toma o modal em todo page
load, para sempre**. Como `user_id = auth.uid()` já é mais estreito que qualquer
escopo de tenant, somar o tenant não ganha isolamento nenhum.

**`version` fora da chave.** Dentro dela, subir v1→v2 com um tour `armed` pendente
não avançaria a linha: inseriria uma nova e deixaria a `armed` **órfã para
sempre**. A contagem de tours armados passaria a contar fantasmas a cada bump.

**Policies POR COMANDO**, SELECT/INSERT/UPDATE separadas, **nunca `FOR ALL`**. O
padrão `FOR ALL` é o que produziu vazamento cross-tenant provado neste repo.

### 1.4 As três travas que tornam a janela uma garantia

1. `CONSTRAINT pa_window_by_kind` — anúncio **exige** `starts_at` e `ends_at`, tour
   **proíbe** os dois. Ninguém consegue escrever "anúncio eterno" nem "tour com
   validade".
2. `CONSTRAINT pa_window_max_35d` — teto duro. **Não existe janela eterna
   cadastrável.** Renovar exige `UPDATE` deliberado, que é decisão, não
   esquecimento.
3. `help_url TEXT NOT NULL` — o banco **recusa** publicar anúncio que não declare
   onde o conhecimento mora depois que a janela fechar. É o que impede o *anúncio
   órfão*: se o modal for a única coisa que já explicou o que é Percorrido,
   expirá-lo cria um buraco permanente.

---

## FASE 2 — Os três artefatos

| | `ritmo_percorrido` | `jornada_novidade` | `jornada_tour` |
|:---|:---|:---|:---|
| Tipo | anúncio | anúncio | **product_onboarding** |
| Expira | 21 dias | 28 dias | **nunca** |
| Gatilho | mount da tabela "Meu ritmo" | mount da home, após o anterior resolver | **mount do `JourneyBuilder`** |
| Como nasce | `armed` no primeiro render | idem | `armed` na resolução da novidade 2 |
| Reabre com | bump de versão | bump de versão | bump, ou a afordância "Ver o guia do construtor" |

### 2.1 O tour não expira, e o CHECK garante isso

**Justificativa que decide:** um gatilho por data erra nas duas direções ao mesmo
tempo. Com janela de 3 semanas, o tour dispararia para alunos que **nunca abrem o
construtor** (ruído para 181 pessoas) e **não** dispararia para quem abre o
construtor pela primeira vez em outubro, que é exatamente quem precisa.

Tour é disparado por **lugar**, nunca por tempo.

### 2.2 Regra dura: o tour não se resolve sem âncora

A transição `armed` → terminal só grava se **as 6 âncoras existirem no DOM**.
Âncora ausente mantém `armed` e registra diagnóstico.

**Por quê:** a mitigação genérica "âncora sumiu, mostra modal simples"
**consumiria** o artefato. O tour seria gasto na tela errada, uma vez, e a
invariante que protege contra reaparecimento impediria que ele voltasse quando a
pessoa finalmente chegasse ao construtor. A salvaguarda viraria o mecanismo de
destruição.

### 2.3 A afordância que fecha o buraco do armado órfão

Quem já tem jornada ativa cai no dashboard, e o construtor só monta por "Revisar
jornada". Hoje são 3 pessoas, mas o número **cresce com o sucesso da própria
feature**.

**Entra no escopo (~10 linhas):** link discreto "Ver o guia do construtor" no
`JourneyDashboard` e no `JourneyBuilder`, que regrava `armed` e leva ao construtor.
Transforma toda omissão do sistema, inclusive falha de escrita e âncora ausente,
de irrecuperável em autoatendível.

---

## FASE 3 — Precedência e supressão

| Regra | Comportamento |
|:---|:---|
| **Um modal por sessão** (`LIMIT 1`) | Ao dispensar, o próximo só na sessão seguinte. Três interrupções em fila viram parede a ser fechada, e a pessoa aprende a fechar antes de ler |
| **Modal vence tour** | Sem isso, o dia do lançamento entrega 3 telas de modal seguidas de 6 passos de tour: **9 interrupções antes de tocar em qualquer controle** |
| **Rotas silenciosas** | Nenhum modal em `/assessments/*` nem em `courses/*/chapters/*/present`. Interromper um quiz é o jeito mais rápido de o aluno passar a fechar tudo no reflexo |
| **Modo "ver como aluno"** | Anúncios suprimidos por completo, **nenhuma linha gravada**. O repo já queimou cinco tabelas com bugs de chapéu |
| **Preview** | Por query param, e **não grava linha** |
| **Só em carga nova da home** | Nunca sobre sessão ativa |
| **Só com `onboarding_completed = true`** | `(platform)/layout.tsx:265` redireciona quem não completou. Sem isto, a pessoa toma dois onboardings em sequência |

---

## FASE 4 — Kill switch

**Mecanismo:** `tenants.settings` JSONB, chave `features.onboarding_jornada_v1`,
**default OFF**. Desligar é um UPDATE em 4 linhas, sem deploy, executável do
Supabase Studio às 9h01 de uma segunda.

**Por que não deploy:** `.github/workflows/ci.yml` dispara só em `main` e
`develop`, o branch é `deploy/cory`, e produção é **rebuild manual no EasyPanel**.
Deploy não é mitigação, é build Docker mais humano disponível.

**Por que não PostHog:** é client-only e depende de `NEXT_PUBLIC_POSTHOG_KEY`, que
é ARG de build assado na imagem. **Mecanismo não verificado não é alavanca.**

Três condições sem as quais isto não é kill switch:

1. Extrair o helper de `manager-dashboard-page.tsx:681` para
   `lib/tenant-features.ts` e **ler server-side**. Flag lida no bundle do cliente
   não se mata.
2. Garantir que a rota não seja cacheada estaticamente.
3. **Ensaiar na onda 0**, desligando de fato e cronometrando. Kill switch nunca
   ensaiado é intenção, não alavanca.

**Limite aceito:** o flag corta exibições novas, não tira o modal de quem já está
com ele na tela.

---

## FASE 5 — Rollout

**Recusado o big-bang**, não por carga (181 modais é irrelevante para o servidor),
mas por **raio de explosão reputacional**: o erro chega por telefone do RH, não por
log.

**Recusada a data de corte** ("só quem entrar depois de X"): não resolve avalanche,
só adia, e exclui exatamente os 181 alunos que a feature existe para converter.

| Onda | Quando | Alvo | Portão para avançar |
|:---:|:---|:---|:---|
| 0 | D-3 | tenant demo | Hugo percorre como aluno real, em 3G throttled, com as 3 contas abaixo, e o kill switch é ensaiado de verdade |
| 1 | D0 | menor tenant real | 48h sem âncora órfã, gravação do "visto" próxima de 100% |
| 2 | D+3 | demais, exceto Cory | idem |
| 3 | D+7 | **Cory** | idem |

**As três contas do ensaio da onda 0** (percorrer, não olhar log — o defeito do
gatilho só aparece percorrendo):

1. Aluno com **1 curso**: a faixa leva ao hub, o tour **não** dispara ali.
2. Aluno com **2+ cursos**: o tour dispara após escolher o curso, com as 6 âncoras.
3. Aluno com **jornada ativa**: cai no dashboard, o tour **não** dispara, a linha
   permanece `armed`, e a afordância "Ver o guia" funciona.

**Um email de uma linha ao RH de cada tenant antes da respectiva onda.** A
avalanche real não é de servidor, é de suporte: mesmo funcionando, uma fração das
181 pessoas acha que quebrou.

---

## FASE 6 — Medição

> **Verdade incômoda de partida:** as 120 notificações em produção têm `cta_url` e
> `acted_at` nulos. O motor de engajamento **nunca mediu um clique**. Sem
> instrumentar antes, o lançamento é infalsificável.

| Nível | Métrica | O que prova |
|:---:|:---|:---|
| 0 | exibido / elegíveis que logaram | o gatilho funciona |
| 1 | chegou à última tela / exibido | o conteúdo prende |
| 2 | clicou na faixa / concluiu novidade 2 | a promessa converteu |
| 3 | entrou em `/jornada` | intenção |
| **3b** | **montou o construtor** | **chegou onde o tour mora** |
| 4 | **salvou jornada** | a que importa |
| 5 | voltou em 14 dias | não foi teatro |

O nível **3b existe porque foi a lacuna que quase queimou o tour**: sem ele,
"entrou em /jornada" seria lido como "viu o construtor".

**Alarme operacional:** razão de exibições por usuário **acima de 1,2** dispara
investigação imediata. É o detector do laço de modal.

### Meta

**De 3 para 25 jornadas salvas em 30 dias** (1% → ~14% dos 181 alunos). Ordem de
grandeza defensável: 119 dos 181 têm 2+ cursos, logo têm motivo real para
sequenciar. Se ~120 virem o guia e 20% agirem, dá 24.

Leituras em **D+7** e **D+14**, decisão em **D+30**. Nada decidido antes de D+7.

### Critérios de conclusão, definidos agora e não depois

| Sinal | Conclusão obrigatória |
|:---|:---|
| Nível 0 < 80% | O problema é o gatilho. **Não mexer no texto.** |
| Nível 1 < 60% | 4 telas + 6 passos é longo demais. Cortar. |
| 3b alto e nível 4 < 10% | O guia funcionou e **o construtor é que não presta** |
| Exibições/usuário > 1,2 | Laço. **Desligar o tenant no ato** |

**Critério de FRACASSO:** menos de 10 jornadas salvas em 30 dias. A conclusão
**não é "melhora o modal"**: é que montar jornada não é um problema que o aluno
tem. O onboarding só testa **descoberta**; descoberta resolvida com adoção parada
responde a pergunta. **O próximo passo passa a ser conversar com 5 alunos da Cory,
não iterar copy.** Isto precisa estar escrito antes, senão vira iteração infinita
de texto.

---

## O caso de hoje: o que cadastrar

Hoje é sábado, 01/08/2026. Início na segunda, **03/08, 09:00**, com fuso `-03`
explícito (data pura faria o anúncio sumir 3 horas antes no Brasil).

N1 e N2 começam **juntos**, serializados por `priority`, não por datas
escalonadas. Escalonar atrasaria o anúncio da Jornada em 3 semanas sem motivo.

| Chave | Tipo | Público | Janela | Prioridade |
|:---|:---|:---|:---|:---:|
| `percorrido-vs-conclusao` | anúncio | **`student` + gestores** | 21 dias | 10 |
| `jornada-intro` | anúncio | todos | 28 dias | 20 |
| `jornada-builder-tour` | product_onboarding | todos | **sem janela** | 50 |

### CORREÇÃO ao contrato: o público de N1 inclui `student`

> ⚠️ O `contrato-janela` §7 restringe N1 a `['admin','manager','instructor']`,
> argumentando que a tabela com Percorrido só existe em `/engagement`, gated por
> `ENGAGEMENT_ACCESS_ROLES`.
>
> **Isso está errado, e foi verificado.** Percorrido existe em **duas** tabelas:
> - `student-insights-table.tsx` — a do gestor, em `/engagement`
> - **`comparison-insights-table.tsx:1362`** — a do **ALUNO**, no card "Meu ritmo"
>   da home dele, entregue no commit `f5bf0a8` desta mesma sessão
>
> Restringir N1 a gestores **excluiria exatamente quem o onboarding mira**.
> Não "corrija de volta" sem antes abrir os dois arquivos.

---

## Casos de borda (os que mudam decisão)

| Caso | Comportamento | Por quê |
|:---|:---|:---|
| Aluno volta após 3 meses, 2 janelas abertas | Vê **um** modal. O segundo na sessão seguinte | Quem sumiu 3 meses tem problema de evasão, não de desatualização |
| Aluno entra no meio da janela | **Não vê** | Para ele "novidade" é literalmente falso. Recebe pela ajuda contextual |
| Copy mudou (vírgula, clareza) | **Não reabre, nunca** | Reexibir modal por revisão de copy é o acúmulo em câmera lenta |
| Esqueceram de fechar a janela | **Impossível** | `ends_at` NOT NULL + CHECK de 35 dias. Fecha por decurso de prazo |
| Operador erra o ano em `ends_at` | Nunca aparece, **falha silenciosa** | Modo de falha **mais provável**. Mitigação obrigatória: verificação em D+1 (`seen = 0` com janela aberta = data errada) |
| `starts_at` ≤ carimbo do backfill | **Ninguém vê** | Modo de falha **mais perigoso**: não gera erro, só silêncio. **Único que ganha teste de CI obrigatório** |
| 48 alunos que nunca logaram | Ficam NULL, cunham no primeiro acesso | Conta velha com experiência zero é recém-chegado, não veterano |
| Duas abas abertas | A que ganha o INSERT exibe, a outra cala | Ver duas vezes destrói a credibilidade mais rápido que qualquer outra falha |
| Tour abandonado no passo 3 | Retoma do 4, via `last_step` | Recomeçar do zero é punição por ter saído da tela |

---

## Ordem de implantação

1. **Faixa incondicional** (0.1) — sem isto o passo final aponta para o nada
2. **`/jornada` no menu** (0.4)
3. **Âncoras + mecanismo de tour** (0.3) — *o item cujo custo estava fora do plano*
4. **Migration**, via Management API, isolada e aditiva, com GO do Hugo
5. **Catálogo, gate server-side, hook de escrita**
6. **Kill switch, e o ensaio dele**
7. **Instrumentação do funil** — antes de qualquer exibição real
8. **LGPD no mesmo PR** (ver abaixo)
9. **Novidades ligadas na onda 0**
10. **Ondas 1 a 3**

### LGPD entra no mesmo PR, e é critério de aceite

`DELETE` em `lgpd_soft_delete_user`, mais bloco **nomeado** `feature_intro` em
`api/privacy/export/route.ts`, com teste.

**Por que no mesmo PR:** omitir tabela nova de dado pessoal de um export que já
existe cria **não conformidade nova em produção**, não herda uma antiga. E
follow-up de conformidade não volta.

**O PR não passa no QA gate sem isto.**

---

## O que NÃO entra nesta versão

1. **Coluna "viu o tour" para gestor, líder ou admin de tenant.** Quatro razões:
   muda a natureza jurídica do dado (preferência de interface vira **monitoramento
   de trabalhador**, exigindo base legal que ninguém constituiu, com consentimento
   inservível por assimetria de poder); não responde à pergunta que o gestor faria,
   porque "não viu" mede o defeito de navegação e **culpa a pessoa**; contamina o
   instrumento, porque no dia em que o aluno souber que o "pulei" chega ao chefe, o
   clique deixa de medir o que media; e o precedente deste repo é inequívoco, toda
   tabela que nasceu com leitura de gestor "porque pode ser útil depois" virou
   vazamento. **Alargar depois é uma migration de 5 linhas. Estreitar depois de
   vazar é um incidente com cliente pagante.**
2. **Histórico "quantos viram a v1"** dentro da tabela. Vai para evento
   append-only ou PostHog.
3. **Expiração automática do `armed`.** Durar é o ponto.
4. **Enum de `feature_key` no banco.** Lista fechada exigiria DDL em produção a
   cada novidade nova.
5. **Backfill para os 302 matriculados.** Ausência de linha **é** o estado inicial
   correto.
6. **Tour para quem nunca viu a novidade 2.** Aluno novo que entra no construtor
   sem passar pela novidade não recebe tour na v1.
7. **Correção do C6** (`jsonb_profile_merge` SECURITY DEFINER sem checagem de
   `p_user_id` e sem REVOKE). Pré-existente, é a razão decisiva para recusar
   `users.profile`. **Story própria.**
8. **Aplicação das 12 migrations remote-only não reconciliadas.** Esta migration
   sobe **sozinha**, via Management API, uma por vez.
9. **Frase de aviso de privacidade do tenant.** Fora do PR de código, mas **entra
   antes da onda 1**: uma linha dizendo que a plataforma registra quais avisos já
   foram vistos para não repeti-los. Sem ela é tratamento não informado.
10. **Purga por retenção.** Definir depois de o funil rodar.

---

## Riscos

| Risco | Mitigação |
|:---|:---|
| Alguém restringe N1 a gestores | Registrado com prova em "Correção ao contrato" |
| Alguém dá janela ao tour | CHECK no banco recusa |
| Alguém cria janela eterna | CHECK de 35 dias recusa |
| `starts_at` ≤ backfill e ninguém vê nada | Teste de CI obrigatório |
| Tour consumido na tela errada | A resolução exige as 6 âncoras presentes |
| Modal em laço | Alarme de exibições/usuário > 1,2, com desligamento no ato |
| Custo do tour descoberto tarde | Fase 0.3 explícita, com o `grep` negativo registrado |

---

## Resumo executável

> Não lance ainda. Conserte a faixa, coloque `/jornada` no menu, crie as 9 âncoras
> e o mecanismo de tour, suba a tabela sem `tenant_id` e com chave
> `(user_id, feature_key)`, amarre o tour ao **mount do construtor** e nunca à
> rota, ensaie o kill switch em `tenants.settings`, instrumente o funil até o
> nível 4, e só então rode 4 ondas com a Cory por último.

---

## Change Log

| Data | Versão | Mudança | Autor |
|:---|:---|:---|:---|
| 2026-08-01 | 1.0 | Story criada consolidando os dois contratos. Fase 0 dos bloqueadores, decisão da divergência de modelo (prevalece o do contrato-janela, pela RLS), correção do público de N1 com prova, custo honesto do tour. | River (@sm) |
| 2026-08-04 | 1.1 | **Defeito corrigido — a aterrissagem pousava sem destacar nada.** O anel existia apenas em `tour-host.tsx`; `announcement-host.tsx` renderizava o balão "É aqui que elas ficam" sem realce algum, e ancorado só em `ritmo-percorrido` pousava logo abaixo dela, cobrindo `ritmo-conclusao` — a linha irmã que o próprio texto cita. Duas correções: (1) o anel virou `anchor-spotlight.tsx`, componente ÚNICO usado pelos dois hosts (a cópia que faltava era o defeito; duas cópias divergiriam no primeiro ajuste de Tailwind); (2) `useAnchorRect` passa a aceitar LISTA de âncoras e devolver a UNIÃO dos retângulos, então o anel circula o PAR de linhas e o balão pousa abaixo do par. A união é o que o protótipo aprovado já fazia (fase `n1-app`: "as duas linhas ficam destacadas na tabela real", com o aviso "logo abaixo da tabela destacada, para não cobrir o que acabou de explicar"). Guarda em `__tests__/announcement-host.test.tsx`, com geometria injetada (o jsdom zera todo retângulo, e sem geometria "o balão cobre a linha" não é sequer expressável). | Dex (@dev) |

---

## CORREÇÃO 2 — as 6 âncoras do tour não são as que a §0.3 lista

> Registrada em 2026-08-03 por J.A.R.V.I.S., durante a implementação. Mesmo
> espírito da correção do público de N1: fica escrita **com a prova**, para
> ninguém "corrigir de volta" olhando só a tabela da §0.3.

A §0.3 lista, entre as 6 âncoras do tour, **`jornada-prazo`** (o chip de prazo) e
**`jornada-sugestao`** (o dropdown de presets).

**O protótipo que o Hugo aprovou não ensina nenhum dos dois.** O array `TOUR` em
`app/dev/preview-feature-review/page.tsx:150` tem seis passos, nesta ordem:
`timeline`, `auto`, `unidade`, `tabela`, **`reset`**, **`cta`**.

Prevalece o protótipo, por três razões:

1. Ele é o artefato que passou pela revisão de textos que o Hugo pediu ("bota um
   revisor em todos os textos") **e** pelo aceite dele depois disso. A §0.3 foi
   escrita antes, a partir de uma leitura do construtor, não do guia.
2. Uma âncora sem passo correspondente é peso morto protegido por teste: o teste
   da AC 0.3 passaria a defender um atributo que nada usa.
3. Um passo sem âncora é pior: o tour não resolve, e pela regra da §2.2 a linha
   fica `armed` para sempre.

**A lista correta**, que é a que vive em `lib/onboarding/types.ts` como
`TOUR_STEP_ORDER` e é a que o teste itera:

| Passo do guia | Âncora | Elemento |
|:---|:---|:---|
| "Cada bloco é um módulo" | `jornada-linha` | `<TimelineCanvas>` |
| "Auto-ajuste" | `jornada-auto` | `<AutoSwitch>` |
| "Semanas ou dias" | `jornada-unidade` | `<UnitSegmented>` |
| "Prefere sem arrastar?" | `jornada-modulos` | `<ModuleTable>` |
| "Voltar ao ponto de partida" | `jornada-reset` | botão de reset, `journey-builder.tsx:201` |
| "Começar minha jornada" | `jornada-cta` | botão de confirmar, `journey-builder.tsx:149` |

Todos os seis elementos foram **verificados no código** antes desta correção, não
presumidos. `deadlineChip` (linha 162) e `SuggestDropdown` (linha ~180) existem e
continuam existindo — eles simplesmente não são ensinados pelo guia aprovado.

## Modo demonstração, e por que ele não toca o banco

O Hugo confere o resultado por query param (`?onboarding=percorrido|jornada|tour`),
que **não consulta e não grava**. Isso não é conveniência de desenvolvimento, são
duas garantias:

1. A migration **não precisa estar aplicada** para o resultado ser conferível. O
   passo 4 da ordem de implantação continua exigindo GO explícito, e a conferência
   deixa de ser refém dele.
2. Enquanto o Senhor confere, **nenhuma pessoa real vê coisa alguma** — o kill
   switch continua OFF por default e nenhuma linha é gravada.

O gate server-side é **fail-open**: com as tabelas ausentes ele devolve `null` em
silêncio, e a home carrega normal. Um onboarding que derruba a home de 181 alunos
por causa de uma tabela que ainda não subiu seria pior que não ter onboarding.
