# Meu ritmo — plano de arquitetura para um painel de configuração futuro

**Tipo:** Documento de arquitetura (planejamento, NÃO implementação).
**Repo:** `eximia-academy-v2`, branch `deploy/cory`.
**Autor:** Régua (Planejador, terminal Maestri).
**Data:** 2026-07-19.
**Depende de leitura (não edição):** `comparison-insights-table.tsx`, `student-home-indicators.ts`, `ritmo-summary.ts`, `area-gestor.ts`, `docs/stories/epic-student-home/SH-1.5.story.md`, `SH-2.1` a `SH-2.4.story.md`.
**Status:** proposta para revisão do Hugo. Nenhum código foi alterado para produzir este documento — os 4 arquivos-fonte listados acima estão hoje sendo editados em paralelo por outro terminal Maestri ("Bússola"); este documento é uma FOTOGRAFIA do estado lido em 2026-07-19 e pode precisar de um re-scan leve antes da Fase 1 começar, caso a Bússola tenha alterado nomes/linhas.

## 1. Contexto e objetivo

A tabela "Meu ritmo" (`ComparisonInsightsTable`, story `SH-1.5`, já em produção, 26 rounds de calibração visual) e o parágrafo-resumo que a acompanha (`ritmo-summary.ts`) comparam um aluno à média da turma em 5 indicadores, coloridos por severidade (verde/âmbar/vermelho) e acompanhados de um texto de leitura por tom. As stories `SH-2.1`/`SH-2.2`/`SH-2.3` (2026-07-19, motivadas pelo caso real do aluno Angelo) acabaram de corrigir 3 bugs de honestidade nesse sistema: quem conta como "Turma", o que conta como "última atividade", e a coerência da abertura do parágrafo-resumo.

Hoje, TODO o comportamento acima (limiares numéricos, critério de população, pesos de fórmula, textos por tom) é uma constante nomeada no código-fonte, hardcoded e idêntica para todos os tenants. O Hugo declarou a intenção: **"deixe margem para que tudo isso seja configurável (futuramente faremos um painel completo de configurações, inclusive dessas métricas)."**

Este documento faz 3 coisas, nesta ordem:
1. Inventaria TODO parâmetro numérico/textual/de critério hoje hardcoded nos 4 arquivos nomeados, com localização exata em código.
2. Classifica cada um por tipo e por risco de virar configurável por tenant.
3. Propõe uma arquitetura de configuração (schema + camada de injeção + UI futura) e um caminho de migração em 3 fases, sem implementar nenhuma delas agora.

## 2. Inventário completo de parâmetros

### 2.1 Recência (bandas de tempo)

| # | Parâmetro | Local (arquivo:linha) | Tipo | O que controla |
|---|---|---|---|---|
| A1 | `THIRTY_DAYS_MS = 30 * 86400000` | `area-gestor.ts:63` | número (ms) | Janela de "aluno ativo recentemente" usada por `computeMetricBlock` para o card `activeStudents` da visão do gestor (a mesma função também alimenta `computeUnitReferenceStats`/`computeCourseStats`). Não é usada pelos 5 indicadores de "Meu ritmo" diretamente, mas é a MESMA família de "banda de recência" que o Hugo citou (7/30 dias). |
| A2 | `CURRENT_VISIT_WINDOW_MS = 3_600_000` (60 min) | `student-home-indicators.ts:236` | número (ms) | Janela de "visita atual" (AJUSTE 2): qualquer stamp de atividade do próprio aluno dentro da última 1h é tratado como "a visita de agora" e ignorado ao calcular a PENÚLTIMA visita exibida na célula "Você" da linha "Última sessão de estudo". Evita a tautologia "última atividade: hoje" num self-view. |

**Risco A1:** baixo-médio. Afeta um card do gestor, não o ranking/LGPD-sensível. Bom candidato de Fase 1.
**Risco A2:** médio, por ACOPLAMENTO — este valor precisa ficar sincronizado com `LAST_SEEN_TTL_MS = 3_600_000` (`apps/web/src/lib/last-seen.ts:24`), a janela de throttle do bump de `users.last_seen_at`. Hoje as duas constantes têm o MESMO valor por coincidência de design, não por importação compartilhada — se um tenant configurar A2 sem also ajustar o TTL do last-seen, o "penúltima visita" pode voltar a mostrar a visita atual (se A2 ficar menor que o TTL real de bump) ou esconder visitas genuinamente distintas (se A2 ficar maior). Expor este parâmetro exige expor os DOIS juntos, ou derivar A2 do TTL de last-seen em vez de duplicá-lo.

### 2.2 Critério de "aluno ativo" / população comparável ("Turma")

| # | Parâmetro | Local | Tipo | O que controla |
|---|---|---|---|---|
| B1 | Sinais de atividade que definem `activeOrgStudentIds` (sessão OU reflexão OU `last_seen_at`) | `area-gestor.ts:1340-1344` (`loadOrgReference`) | conjunto/enum (quais sinais contam) | A população "Turma" usada em TODAS as médias e no rank de engajamento da tabela inteira (`orgBlock`, `referenceStats`, `orgTrailMaxAverages`, e por herança o rank real de `computeStudentComparison`/`buildStudentHomeIndicators`). É a correção da story `SH-2.1` (2026-07-19). |
| B2 | Exclusão explícita de `users.status` do critério acima | `area-gestor.ts` (comentário imediatamente acima de B1, AC4 de `SH-2.1`) | guardrail (NÃO é um número/texto) | Documenta que uma conta suspensa/administrativa NÃO deve ser removida da população só por causa de `status` — é um conceito diferente de "já tocou a plataforma". |

**Risco B1:** ALTO. Este é o parâmetro mais sensível do inventário inteiro — ele foi criado *ontem* (SH-2.1) exatamente para PARAR de contar "alunos-fantasma" na Turma. Se exposto como configuração livre por tenant, um admin poderia, sem querer, reintroduzir o próprio bug que a story acabou de corrigir (ex.: desmarcar "sessão" como sinal válido, ou remover o filtro inteiro). Se este parâmetro for exposto no painel futuro, recomenda-se um "piso" não removível (sessão E reflexão sempre contam) e só `last_seen_at`/navegação pura como toggle opcional — nunca a opção de desligar o filtro de atividade por completo.
**Risco B2:** não é uma configuração, é um invariante a PRESERVAR. Deve ficar fora do painel (nunca aparecer como checkbox "considerar status da conta").

### 2.3 Severidade (cor do indicador)

| # | Parâmetro | Local | Tipo | O que controla |
|---|---|---|---|---|
| C1 | `SEVERE_BEHIND_THRESHOLD = 0.3` (30%) | `comparison-insights-table.tsx:437` | número (fração 0-1) | O corte entre "atrás moderado" (âmbar) e "atrás forte" (vermelho) em `behindSeverityOf`, usado nas 5 linhas da tabela. É o próprio parâmetro que o Hugo, na conversa em paralelo com a "Bússola" nesta mesma sessão, pediu para virar uma FAIXA DE TOLERÂNCIA (±5% = empate; fora disso, direto verde ou vermelho, sem o gradiente âmbar) — ou seja, este valor está sendo redesenhado agora mesmo por outro terminal. Este documento NÃO assume o resultado dessa reforma; só registra que C1 é o parâmetro que ela vai alterar. |
| C2 | Hierarquia de precedência de `summaryToneOf` (win-top > behind-severe > behind-mild > win > tie > none) | `ritmo-summary.ts:154-169` (comentário Round 18) | regra/política (não é um escalar) | Decide o tom GERAL do painel-resumo a partir dos 5 tons de linha. É a correção central da `SH-2.3` (o bug do "Parabéns" isolado). |
| C3 | Regra de empate no topo (`isTopEngagementRank` trata empate como "ninguém é #1 exclusivo", `AC12` da `SH-1.5`) | `student-home-indicators.ts:160-175` | política booleana | Evita a alegação "você é O mais engajado" quando 2+ alunos empatam no topo. |

**Risco C1:** médio-alto, mas é o candidato mais "legítimo" para configuração — é um número simples, com um comentário no código já dizendo "número escolhido para ser fácil de reajustar... o Hugo pode subir/descer sem tocar a lógica" (`comparison-insights-table.tsx:434-436`). Ainda assim, um valor mal configurado (ex.: 0.01) tornaria quase todo aluno "severamente atrás", o que é uma falha de PRODUTO (tom punitivo indevido), não só um número errado — recomenda-se faixa validada (ex.: 0.10 a 0.60) se exposto.
**Risco C2/C3:** ALTO. São regras de precedência/política, não valores numéricos soltos — tornar isso "configurável" significa deixar um tenant redesenhar a própria lógica de honestidade que 3 stories (`SH-2.1`/`2.2`/`2.3`) acabaram de corrigir por bug real. Recomenda-se manter C2/C3 como invariantes de código, NUNCA expostos num painel, em qualquer fase.

### 2.4 Fórmula de engajamento

| # | Parâmetro | Local | Tipo | O que controla |
|---|---|---|---|---|
| D1 | Pesos da fórmula `engagementOf(id) = interactions(id)*2 + reflections(id)*1` | `student-home-indicators.ts:423` | par de números (peso interação, peso reflexão) | O score de "Engajamento" de cada aluno, a base do rank real (`isTopEngagementRank`/`engagementRankOf`) e da própria linha "Engajamento" da tabela. |
| D2 | `computeEngagementMax(trailChapterCount, reflectionPossibleSlides) = trailChapterCount*2 + reflectionPossibleSlides` | `student-home-indicators.ts:88-94` | fórmula-espelho de D1 | O TETO "N" da fração "X de N" (SH-F.5). Precisa usar os MESMOS pesos de D1 — a tabela hoje afirma a identidade "número = 2×interações + reflexões" como algo verificável a olho nu (comentário `student-home-indicators.ts:537-542`). |

**Risco D1/D2:** ALTO, por ACOPLAMENTO OBRIGATÓRIO. Estes dois NUNCA podem ser configurados de forma independente — se o peso de D1 mudar, D2 tem que mudar com ele, ou a fração "X de Y" exibida na tabela deixa de bater com a lógica que a gerou (quebra uma invariante testada, "a manchete identity", comentário verbatim em `student-home-indicators.ts:538-542`). Além disso, D1 alimenta o rank/#1 (LGPD-adjacent), então mudar o peso muda quem é "o mais engajado da turma" da noite para o dia. Se exposto, DEVE ser um único par de campos versionado junto (nunca dois controles soltos na UI).

### 2.5 Copy / textos por tom

| # | Parâmetro | Local | Tipo | O que controla |
|---|---|---|---|---|
| E1 | `LEITURA_COPY` (5 linhas × {win, tie, behind} = 15 strings) | `comparison-insights-table.tsx:501-531` | mapa de strings | O texto da coluna "Como estou" para cada indicador × resultado. |
| E2 | `TOP_ENGAGEMENT_COPY = "1º da turma – Parabéns!"` | `comparison-insights-table.tsx:538` | string única | A frase especial de "Como estou" quando `isTopEngagement === true` (gate real, não hardcoded — só o TEXTO é estático). |
| E3 | `ACTION_LABEL` (5 strings, um rótulo de botão por linha) | `comparison-insights-table.tsx:547-554` | mapa de strings | O texto do botão acionável ao lado do chip "Como estou". |
| E4 | Templates de abertura de `buildRitmoSummary` (5 ramos: top-engagement / behind-severe / behind-mild / acima-da-média / neutro) | `ritmo-summary.ts:108-126` | 5 strings-template (com interpolação de nome) | A frase de abertura do parágrafo-resumo. **Este é exatamente o "lembrete gentil" que está sendo discutido ao vivo nesta mesma sessão** (`ritmo-summary.ts:118`, ramo `behind-mild`: "{Nome}, um lembrete gentil para retomar o seu ritmo de estudos"). |
| E5 | Rótulos das 5 linhas (`buildRows`) — "Última sessão de estudo", "Progresso - conclusão", "Interações realizadas", "Reflexões realizadas", "Engajamento" | `comparison-insights-table.tsx:1020-1105` | 5 strings | Os nomes visíveis na coluna "Indicador". Passaram por renomeações deliberadas em `SH-1.5` e `SH-2.2` (ex.: "Última atividade" → "Última sessão de estudo", motivada pelo caso Angelo). |

**Risco E1/E2/E3/E5:** médio. São textos "soltos" (sem acoplamento numérico direto), mas carregam um CONTRATO DE TOM que 4 stories consecutivas calibraram a mão (nunca punitivo quando atrás; nunca "Parabéns" nos ramos honestos; nunca afirmar "1º lugar" sem o gate real). Se expostos a edição livre por tenant, o risco não é técnico, é de PRODUTO: um admin poderia digitar uma frase de tom punitivo sem querer, e nada no sistema hoje validaria "tom". Recomenda-se, se exposto, algum guia/validação leve (ex.: lista de palavras banidas tipo "falhou"/"ruim"/"fraco", ou pelo menos um aviso visível "este texto aparece quando o aluno está atrás — evite tom de repreensão").
**Risco E3 especificamente:** tem uma armadilha adicional de ACOPLAMENTO — `ACTION_LABEL_SIZE` (`comparison-insights-table.tsx:573-579`) calibra o tamanho de fonte do botão a partir da CONTAGEM DE CARACTERES exata do texto atual (documentado nos comentários "Round 25/26" como uma fórmula, `charCount × 0.58 × fontSizePx`, contra uma largura fixa de botão `w-[205px]`). Um texto customizado mais longo, sem recalcular o tamanho, estoura a largura fixa do botão ou fica desproporcional. Isso NÃO é um parâmetro configurável separado (ver F1 abaixo) — é uma razão para nunca deixar E3 configurável sem também derivar automaticamente o tamanho de fonte a partir do texto novo.
**Risco E4:** médio-alto. É o texto mais "vivo" agora (sendo mexido ao vivo pelo Hugo/Bússola nesta sessão). Mesma lógica de E1: tom é o que está em jogo, não sintaxe.

### 2.6 Explicitamente FORA do escopo de configuração (documentado para não ser reproposto por engano)

| # | Item | Por quê fica de fora |
|---|---|---|
| F1 | `ACTION_LABEL_SIZE` (`comparison-insights-table.tsx:573-579`) | Não é um parâmetro independente — é uma DERIVAÇÃO calculada do texto de E3. Se E3 virar configurável, o tamanho de fonte deve ser recalculado automaticamente pela mesma fórmula, nunca exposto como um segundo campo editável. |
| F2 | `ACTION_ICON` (`comparison-insights-table.tsx:596-602`), cores de design system (`WIN_BG`/`BAR_*`/`VALUE_PILL`, linhas 400-409 e 1115-1125) | Decisão de design visual, não de comportamento analítico — outro eixo de configuração (branding/whitelabel), já parcialmente coberto por `tenants.branding`/`whitelabel_config`, fora do escopo desta análise. |
| F3 | `PAGE_SIZE = 1000` (`area-gestor.ts:381`) | Constante de paginação de infraestrutura (tamanho de página de fetch do Supabase), não um parâmetro pedagógico. |
| F4 | Formatação "hoje"/"há 1 dia"/"há X dias" (`formatDays`, `comparison-insights-table.tsx:480-485`) | Questão de i18n/formatação de texto, eixo ortogonal a "configuração de métricas". |
| F5 (= C2/C3) | Hierarquia de precedência de tom + regra de empate no topo | Ver §2.3 — invariantes de honestidade, nunca devem virar toggle de tenant. |
| F6 (= B2) | Exclusão de `users.status` do critério de população ativa | Ver §2.2 — guardrail documentado no próprio código, nunca deve ser reintroduzido. |

### 2.7 Contagem e nota de escopo adjacente

**Total: 14 parâmetros/grupos de parâmetro catalogados** (A1, A2, B1, B2, C1, C2, C3, D1+D2 como par, E1-E5) mais **6 itens explicitamente marcados como fora de escopo** (F1-F6, dos quais F5/F6 duplicam B2/C2/C3 por serem guardrails, não itens novos — a contagem líquida de itens únicos é 14 configuráveis-candidatos + 4 exclusões genuinamente novas: F1, F2, F3, F4).

**Nota de escopo adjacente (transparência, não investigação):** `student-home-indicators.ts` importa `computeBehindAndProgress` de `apps/web/src/lib/notifications/engagement-triage.ts` (fora dos 4 arquivos lidos nesta tarefa). A auditoria `SH-2.4` (já concluída por outro terminal) registrou que essa função computa um `expectedPct` (progresso esperado = dias decorridos / prazo do curso) que hoje é DESCARTADO antes de chegar à linha "Progresso" da tabela. Esse arquivo não foi lido em profundidade aqui — só citado porque a `SH-2.4` já o mapeou e ele contém, muito provavelmente, mais parâmetros candidatos (ex.: a própria noção de "prazo esperado"). Recomenda-se incluir `engagement-triage.ts` num inventário de config FUTURO, se/quando as 3 propostas da `SH-2.4` forem priorizadas.

## 3. Arquitetura proposta

### 3.1 Onde os valores morariam — schema de banco

Segue o precedente já existente no schema (`tenants.settings JSONB DEFAULT '{}'`, `supabase/migrations/20260207000000_initial_schema.sql:20`, já usado por `apps/web/src/app/(platform)/admin/settings/page.tsx` para feature flags e branding). Em vez de reaproveitar a coluna `tenants.settings` (que já mistura branding/features/plano), propõe-se uma tabela DEDICADA — os parâmetros de analytics têm volume, tipos variados (número/string/enum/mapa) e um ciclo de mudança diferente do resto do settings:

```sql
-- Proposta de nome: analytics_config (schema conceitual, NÃO uma migration real)
CREATE TABLE analytics_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,   -- só os campos que o tenant OVERRIDOU
  config_version INT NOT NULL DEFAULT 1,        -- versionamento do SHAPE do config, não do valor
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);
```

**Por que JSONB parcial, não colunas tipadas por parâmetro:** os 14 itens do inventário têm tipos heterogêneos (número, string, mapa de 5 strings, par acoplado de números). Uma tabela com 1 coluna por parâmetro exigiria uma migration a cada novo parâmetro futuro (alto atrito) e não modela bem os pares acoplados (D1/D2) nem os grupos (E1 é um mapa de 15 strings). O JSONB parcial + fallback (abaixo) já é o padrão do próprio repo (`tenants.settings`), então esta escolha é reuso, não invenção.

**Por que "parcial" (só overrides) e não "sempre completo":** um tenant que nunca configurou nada tem uma linha VAZIA (ou nenhuma linha), e o sistema usa 100% dos defaults do código. Isso é o que torna a Fase 2 (abaixo) segura — nenhuma migração de dado é necessária no dia em que a tabela for criada.

### 3.2 Camada de fallback — como o cálculo consumiria os valores

Hoje, todas as funções puras dos 4 arquivos (`behindSeverityOf`, `buildStudentHomeIndicators`, `buildRitmoSummary`, `loadOrgReference`, etc.) leem constantes por IMPORTAÇÃO DE MÓDULO (`const SEVERE_BEHIND_THRESHOLD = 0.3` no topo do arquivo, fechado sobre o escopo léxico). Esse padrão precisa mudar para **injeção de parâmetro explícito**, não leitura de global.

O próprio código-fonte já usa esse padrão repetidas vezes para dados opcionais (`engagementMax?`, `perRowMax?`, `orgTrailMaxAverages?` em `buildStudentHomeIndicators`, todos "aditivos, ausência degrada ao comportamento anterior, sem quebrar call sites existentes" — comentários explícitos em `student-home-indicators.ts:251-286`). A proposta de config REUSA exatamente essa convenção, já provada 3 vezes nesta mesma base de código:

1. Um objeto central `DEFAULT_ANALYTICS_CONFIG` (novo arquivo, ex. `apps/web/src/lib/analytics/analytics-config.ts`), tipado por uma interface `AnalyticsConfig`, contendo os 14 itens do inventário com os valores ATUAIS (0.3, 3_600_000, os mapas de copy, etc.) como default.
2. Cada função consumidora ganha um parâmetro adicional `config: AnalyticsConfig = DEFAULT_ANALYTICS_CONFIG` — sempre o ÚLTIMO parâmetro, sempre com default, para não quebrar nenhuma chamada/teste existente (mesmo padrão "APPENDED at the end of the signature... byte-for-byte unaffected" já usado, comentário verbatim em `student-home-indicators.ts:271-272`).
3. Uma função de carregamento, `getAnalyticsConfig(tenantId)`, faz o DEEP MERGE entre `DEFAULT_ANALYTICS_CONFIG` e o JSONB parcial do tenant (se existir linha em `analytics_config`), e devolve um `AnalyticsConfig` completo e tipado.
4. `getAnalyticsConfig` é chamada UMA VEZ por request, no MESMO ponto que já orquestra o carregamento tenant-wide hoje (`loadOrgReference`/`getOrgReference`, `area-gestor.ts`) — o config viaja de cima para baixo como um parâmetro explícito através de `OrgReference` até `computeStudentComparison`, `buildStudentHomeIndicators`, e é passado para as funções puras de `comparison-insights-table.tsx`/`ritmo-summary.ts` que hoje são chamadas a partir do componente/container. NENHUMA função pura importa o config sozinha de um módulo global — isso preservaria a propriedade de PUREZA/testabilidade que os comentários do código já valorizam explicitamente ("PURE, deterministic... testable by exact equality", `ritmo-summary.ts:4`).
5. Cache: o mesmo mecanismo de TTL já usado para `OrgReference` (`SH-F.3`, "cached per tenant, TTL") é reaproveitado para `getAnalyticsConfig` — configuração muda raramente, então uma tenant-wide cache curta é apropriada e evita 1 query extra por request.

### 3.3 Preparação para a UI de admin (sem construí-la agora)

O scaffold já existe: `apps/web/src/app/(platform)/admin/settings/page.tsx` + `SettingsTabsWrapper` (usado hoje para branding/features/plano). A Fase 3 (futura) adicionaria uma aba nova ("Métricas & Analytics") nesse MESMO wrapper, que:
- Lê `analytics_config` do tenant via Server Action.
- Renderiza um formulário por GRUPO do inventário (§2), respeitando as classificações de risco: campos de risco baixo-médio (A1, C1) como inputs numéricos com faixa validada; grupos acoplados (D1/D2, E3+F1) como uma ÚNICA unidade editável (nunca dois controles independentes); grupos de risco alto (B1) com um "piso" não removível na própria UI (checkboxes desabilitados para sessão/reflexão, só `last_seen_at` togglável); itens F5/F6/C2/C3 **NUNCA aparecem na UI** — são invariantes de código, não de configuração.
- Grava via upsert em `analytics_config` (nunca sobrescreve o JSONB inteiro sem necessidade — grava só os campos que o admin de fato alterou, preservando o "parcial" do §3.1).

Nenhuma tela, componente ou Server Action é construída nesta entrega — este parágrafo é a ESPECIFICAÇÃO da Fase 3, para quando o Hugo priorizar.

## 4. Plano de migração em 3 fases

### Fase 1 — Extração para objeto central (ainda hardcoded, forma certa)

- Criar `analytics-config.ts` com `AnalyticsConfig` (interface) + `DEFAULT_ANALYTICS_CONFIG` (valores atuais, idênticos ao código hoje).
- Trocar as referências diretas às constantes (`SEVERE_BEHIND_THRESHOLD`, `THIRTY_DAYS_MS`, `CURRENT_VISIT_WINDOW_MS`, `LEITURA_COPY`, `ACTION_LABEL`, os pesos de `engagementOf`/`computeEngagementMax`, os templates de `buildRitmoSummary`, o conjunto de sinais de `activeOrgStudentIds`) por leituras de `config.xxx`, com `config` como parâmetro aditivo-com-default em cada função tocada.
- **Resultado esperado:** ZERO mudança de comportamento (mesmos valores, agora nomeados/agrupados). Toda a suíte de testes das 4 áreas (`comparison-insights-table.test.tsx`, `student-home-indicators.test.ts`, `ritmo-summary.test.ts`, `area-gestor.test.ts`) deve passar SEM alteração de expectativa — só o defaults sendo lidos de outro lugar.
- **Risco desta fase:** baixo. É refactor puro, mesmo padrão aditivo já usado 3x nestes arquivos.

### Fase 2 — Tabela no banco + fallback

- Migration criando `analytics_config` (schema §3.1).
- Implementar `getAnalyticsConfig(tenantId)`: busca a linha do tenant, faz merge parcial sobre `DEFAULT_ANALYTICS_CONFIG`, cacheia por TTL (mesmo padrão de `getOrgReference`).
- Fiar `getAnalyticsConfig` no ponto de entrada tenant-wide (`loadOrgReference`/`computeStudentComparison`), propagando o `config` resolvido como parâmetro explícito até as funções puras.
- **Teste crítico desta fase:** "tenant sem linha em `analytics_config`" deve produzir um comportamento IDÊNTICO ao da Fase 1 (prova de que o fallback é honesto, não uma migração disfarçada de mudança de produto).
- **Risco desta fase:** médio — é a primeira vez que o comportamento pode DIVERGIR entre tenants; a superfície de teste cresce (defaults vs. tenant customizado vs. tenant parcialmente customizado).

### Fase 3 — UI de admin

- Aba nova em `SettingsTabsWrapper` (§3.3), Server Action de leitura/escrita, validação por grupo de risco.
- **Risco desta fase:** depende inteiramente de quais dos 14 itens o Hugo decidir realmente expor (este documento recomenda começar por A1/C1, os de risco mais baixo, e deixar B1/D1+D2/E4 para uma rodada 2, com validação de produto explícita — o mesmo padrão de cautela que a própria `SH-2.4` já usou ao recomendar, não implementar, suas 3 propostas).

Nenhuma fase é implementada nesta entrega — as 3 ficam registradas para o Hugo priorizar quando quiser.

## 5. Riscos transversais

1. **Divergência entre tenants vira um novo eixo de suporte/QA.** Assim que a Fase 2 entrar em produção, "o dashboard do tenant X se comporta diferente do tenant Y" deixa de ser um bug — passa a ser esperado. Isso muda a superfície de testes e de investigação de bugs futuros (um "achado do Espelho" futuro precisará primeiro perguntar "este tenant customizou o config?").
2. **Os itens de risco ALTO (B1, C2, C3, D1+D2) são os que mais valeriam a pena configurar do ponto de vista de produto (branding pedagógico por tenant) e são exatamente os que mais podem reintroduzir os bugs reais que `SH-2.1`/`2.2`/`2.3` acabaram de corrigir.** Recomenda-se, se/quando a Fase 3 for construída, uma revisão explícita do Hugo especificamente nesses 4 itens antes de expô-los na UI — não é uma decisão puramente técnica.
3. **Concorrência com o trabalho em andamento.** Os 4 arquivos-fonte deste inventário estão sendo editados ao vivo por outro terminal Maestri ("Bússola") no momento em que este documento foi escrito — em particular, `SEVERE_BEHIND_THRESHOLD`/`behindSeverityOf` (C1) está sendo redesenhado para uma faixa de tolerância ±5% durante esta mesma sessão. Antes de iniciar a Fase 1, um dev deve re-confirmar em código (não neste documento) os valores/nomes exatos, exatamente como a própria `SH-2.4` fez ("confirmar em código antes de editar" é o primeiro passo-padrão de toda story deste epic).

## 6. Fora de escopo desta entrega

- Nenhum arquivo de `apps/web/src` foi editado.
- `engagement-triage.ts` não foi lido em profundidade (§2.7) — só citado via o achado já registrado pela `SH-2.4`.
- A reforma em andamento de C1 (faixa de tolerância ±5%) não foi assumida nem antecipada — este documento descreve o parâmetro como ele EXISTE hoje, não como ele vai ficar depois da mudança em curso pela Bússola.
- Nenhuma migration, nenhuma Server Action, nenhum componente de UI foi criado.
