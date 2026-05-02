# WS1: Arquitetura — Novo Motor Socrático exímIA

> Status: **Ready** (Arquitetura completa — 19 seções, 6 gaps resolvidos, pronta para epic/story creation)
> Data: 2026-02-15
> Agente: @architect (Aria)
> Referências:
> - `Benchmarks/IA-Socrática/IA de Conversa Socráica.md`
> - `Benchmarks/IA-Socrática/Output analítico Avançado`
> - `Benchmarks/Agentes/Harven_Socrates/` (referência teórica apenas — não reutilizar código)

---

## 1. Princípio Fundamental

**Reconstrução total.** Novos nomes, novas identidades, novos prompts, novos schemas, novo pipeline. Zero reaproveitamento dos agentes anteriores (Harven) por questões de propriedade intelectual. Os benchmarks são a base teórica, a implementação é 100% original exímIA.

---

## 2. Decisões Arquiteturais

| Decisão | Escolha | Justificativa |
|---|---|---|
| Modelo padrão | `gpt-4.1` | Validado no sistema, configurável por sessão |
| Geração de questões | **Fora do WS1** — responsabilidade exclusiva do Course Creator (WS2) | Separação de responsabilidades: Socrático = diálogo, Creator = conteúdo |
| Agentes anteriores | **Deletar completamente** | Propriedade intelectual — sem reaproveitamento |
| Nomenclatura | Mestre, Polidor, Guardião, Detector, Perfilador | Nomes em português, identidade exímIA |
| Kolb Learning Styles | **4 estilos clássicos como vetor contínuo** (2 eixos) | Simples, mapeia direto com DISC, evoluível para 9 |
| Output Analítico | **Visível para Gestor/Instrutor + Dashboard** (não para aluno na v1) | UC2 + UC3 na v1; navegação híbrida (Dashboard KPI + /analytics/*) |
| Fontes de perfil | **Dual: Testes explícitos (WS3) + Detecção implícita (WS1)** | "Como ele se vê" vs "Como a IA o vê" |
| Camadas de profundidade | **7 camadas híbridas Bloom + Socrático** (Opção 2) | Cognitivo + reflexivo, funciona para hard e soft skills |
| Course Designer (WS2) | **Múltiplas metodologias** (instrutor escolhe) | Camadas do Mestre são independentes da metodologia do curso |
| Limite de interações | **Híbrido: Limite base + Fechamento inteligente** | Instrutor define teto (default 20), Mestre sugere encerrar quando faz sentido |
| Tipos de interação | **4 tipos explícitos via `interaction_type`** | WS2 envia o tipo, Mestre adapta comportamento |
| Seleção de modelo | **Model Router híbrido** (OpenAI + DeepSeek V3) | Premium no Mestre/Guardião, DeepSeek no suporte |
| Guardião | **Sempre gpt-4.1** (independente do plano) | Quality gate não pode usar modelo econômico — custo marginal |
| Planos por tenant | **Essencial + Standard + Premium** (3 tiers) | Essencial: mini+DeepSeek (~$0.11), Standard: gpt-4.1+DeepSeek (~$0.29), Premium: all OpenAI (~$0.34) |
| Avaliação de qualidade | **3 fases: Benchmark → Shadow A/B → Monitoramento** | Validar antes de trocar modelos |
| Estratégia de testes | **3 camadas: Unit (Vitest) + E2E (Playwright + MSW multi-handler)** | MSW intercepta OpenAI + DeepSeek; identifiers `Eximia_*`; ~82 testes |

---

## 3. Arquitetura Dual: Superfície + Análise Profunda

Baseado no conceito "Output Analítico Avançado" dos benchmarks:

```
                    ┌──────────────────────────────────┐
                    │         STUDENT MESSAGE           │
                    └──────────────┬───────────────────┘
                                   │
                    ┌──────────────▼───────────────────┐
                    │         ORQUESTRADOR v2           │
                    │    (Pipeline Controller)          │
                    └──┬───────────────────────────┬───┘
                       │                           │
            ┌──────────▼──────────┐    ┌───────────▼──────────┐
            │   SUPERFÍCIE        │    │   ANÁLISE SOMBRA     │
            │   (Visível)         │    │   (Invisível)        │
            └──────────┬──────────┘    └───────────┬──────────┘
                       │                           │
         ┌─────────────▼──────┐        ┌───────────▼──────────┐
         │  1. MESTRE          │        │  4. DETECTOR         │
         │     (Diálogo)       │        │     (Padrões)        │
         ├─────────────────────┤        ├──────────────────────┤
         │  2. POLIDOR          │        │  5. PERFILADOR       │
         │     (Refinamento)   │        │     (Aprendizado)    │
         ├─────────────────────┤        └──────────────────────┘
         │  3. GUARDIÃO        │
         │     (Qualidade)     │
         └─────────────────────┘
```

**Superfície (síncrona)**: Mestre → Polidor → Guardião — responde ao aluno em tempo real.
**Análise Sombra (pode ser assíncrona)**: Detector + Perfilador — processam em paralelo, resultados salvos no DB para dashboards e adaptação futura.

---

## 4. Agentes — Visão Geral

| # | Agent | ID | Papel | Visível ao Aluno? | Modelo |
|---|-------|----|-------|-------------------|--------|
| 1 | **Mestre** | `mestre` | Diálogo socrático puro | Sim (output final via Polidor) | Via Model Router (gpt-4.1-mini ou gpt-4.1) |
| 2 | **Polidor** | `polidor` | Refinamento de linguagem | Não | Via Model Router (DeepSeek V3 ou gpt-4.1) |
| 3 | **Guardião** | `guardiao` | Validação de qualidade | Não | **Sempre gpt-4.1** (quality gate) |
| 4 | **Detector** | `detector` | Padrões cognitivos + detecção IA + linguística | Não | Via Model Router (DeepSeek V3 ou gpt-4.1-mini) |
| 5 | **Perfilador** | `perfilador` | Perfil de aprendizado incremental | Não | Via Model Router (DeepSeek V3 ou gpt-4.1-mini) |
| — | **Orquestrador** | `orquestrador` | Pipeline controller + Model Router | Não | — |

**Nota**: Modelo por agente é determinado pelo **Model Router** (Seção 9). O Guardião sempre roda no modelo premium por ser o quality gate. Demais agentes de suporte usam modelo econômico sem perda perceptível de qualidade.

---

## 5. Pipeline Principal (Superfície)

```
┌──────────────────────────────────────────────────────────┐
│  RETRY LOOP (max 2x)                                     │
│                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐ │
│  │   MESTRE     │──▶│   POLIDOR    │──▶│  GUARDIÃO    │ │
│  │              │   │              │   │              │ │
│  │ • 7 camadas  │   │ • 2 parágrafos│   │ • 7 critérios│ │
│  │ • 6 tipos Q  │   │ • Sem labels │   │ • Score 0-1  │ │
│  │ • 5 técnicas │   │ • 80-200 words│   │ • Verdict    │ │
│  │ • Resistência│   │ • Naturalidade│   │              │ │
│  │ • Fechamento │   │              │   │              │ │
│  └──────────────┘   └──────────────┘   └──────┬───────┘ │
│                                               │          │
│                              REJECTED ◄───────┤          │
│                              (feedback loop)  │          │
│                                          APPROVED        │
└──────────────────────────────────────────┬───────────────┘
                                           │
                                     BEST RESPONSE
```

**Retry Logic**:
- Se Guardião retorna REJECTED, o feedback vai de volta ao Mestre
- Máximo 2 retries (configurável)
- Mantém melhor resposta (maior score) entre tentativas
- Warning se max retries excedido (nunca falha silenciosamente)

---

## 6. Detalhamento por Agente

### 6.1 — MESTRE (Diálogo Socrático)

**Filosofia base** (derivada dos benchmarks, implementação original):
- NUNCA dá respostas, APENAS perguntas calibradas
- Detecta padrões de pensamento e os desafia
- Guia através de camadas de profundidade
- Celebra insights autogerados

#### Sistema de 7 Camadas de Profundidade (Híbrido Bloom + Socrático)

Modelo adaptado para contexto educacional corporativo. Funde progressão cognitiva (Bloom) com elementos reflexivos do método socrático. Funciona tanto para conteúdo técnico (hard skills) quanto comportamental (soft skills).

> **Nota**: O benchmark original usava camadas emocionais/psicológicas (Origem, Identidade, Transcendência) adequadas para coaching. Adaptamos para o contexto educacional mantendo rigor cognitivo e espírito socrático.

```
Camada 1: FATOS                   → "O que você entende sobre isso?"
                                     Estabelecer base factual, verificar compreensão literal

Camada 2: COMPREENSÃO             → "Como explicaria isso com suas palavras?"
                                     Reformulação, interpretação, conexão com conhecimento prévio

Camada 3: APLICAÇÃO               → "Em que situação real usaria isso?"
                                     Cenários práticos, transferência para contexto profissional

Camada 4: ANÁLISE                 → "Que conexões ou contradições percebe?"
                                     Decomposição, relações causa-efeito, padrões

Camada 5: PERSPECTIVA             → "Como alguém com visão oposta argumentaria?"
                                     Múltiplos pontos de vista, desafio de pressupostos (espírito socrático)

Camada 6: AVALIAÇÃO               → "Que critérios usaria para julgar essa abordagem?"
                                     Julgamento crítico, trade-offs, tomada de decisão fundamentada

Camada 7: SÍNTESE                 → "Que ideia nova surge ao combinar tudo isso?"
                                     Criação, integração, insight original do aluno
```

**Progressão Socrática por Interação**:
- Nível 1 (Base): Trocas 1-3 → Fatos + Compreensão (camadas 1-2)
- Nível 2 (Intermediário): Trocas 4-7 → Aplicação + Análise + Perspectiva (camadas 3-5)
- Nível 3 (Avançado): Trocas 8+ → Avaliação + Síntese (camadas 6-7)

> **Sobre o Course Designer (WS2)**: O WS2 suportará múltiplas metodologias pedagógicas (Bloom, Kolb ELC+, Action Mapping, etc.) com escolha pelo instrutor. As 7 camadas do Mestre são independentes da metodologia do curso — elas guiam a PROFUNDIDADE DO DIÁLOGO, não a estrutura do conteúdo.

#### 6 Tipos de Perguntas Socráticas

1. **Clarificação** — "O que você quer dizer quando diz X?"
2. **Pressupostos** — "Que suposições você está fazendo aqui?"
3. **Perspectiva** — "Como alguém que discorda veria isso?"
4. **Evidência** — "Que evidências sustentam essa crença?"
5. **Consequências** — "Se isso for verdade, o que mais deve ser verdade?"
6. **Metacognição** — "Por que essa pergunta é importante para você?"

#### 5 Técnicas Avançadas de Pergunta

1. **Paradoxal** — "Como o seu maior problema poderia ser sua maior solução?"
2. **Temporal** — "O que o você de 80 anos diria sobre isso?"
3. **Inversão** — "E se o problema fosse não mudar nada?"
4. **Essência** — "Se tirássemos todas as camadas, o que sobraria?"
5. **Permissão** — "O que você se permitiria se soubesse que não pode falhar?"

#### Calibração Emocional

| Estado do Aluno | Resposta do Mestre |
|---|---|
| Confuso | Perguntas de clarificação simples |
| Defensivo | Perguntas abertas e curiosas, sem julgamento |
| Frustrado | "O que tornaria essa conversa mais útil para você?" |
| Tendo insights | "O que mais isso te mostra?" |

#### 5 Tipos de Resistência (com tratamento)

1. **Intelectualização** (respostas longas, teóricas, sem emoção) → "Como isso aparece na sua experiência direta?"
2. **Deflexão** (muda de assunto, fala de outros) → "Notei que mudamos de foco. O que estava difícil ali?"
3. **Minimização** ("não é grande coisa", "tanto faz") → "Se fosse grande coisa, o que mudaria?"
4. **Agressão** ("essas perguntas são idiotas") → "O que tornaria essa conversa mais útil para você?"
5. **Desistência** ("não sei", respostas curtas) → "Se soubesse, qual seria sua melhor hipótese?"

**Princípio**: Resistência é informação, não obstáculo.

#### Fechamento Socrático (quando `interactions_remaining <= 1`)

**Detectar momento de encerrar**:
- 3+ insights significativos
- Energia emocional baixando
- Tempo limite atingido

**Perguntas de fechamento**:
- Integração: "O que você está levando daqui?"
- Ação: "Qual o menor próximo passo possível?"
- Apreciação: "Que sabedoria já estava em você?"

**Regras de fechamento**:
- Nunca resumir a conversa
- Nunca dar homework
- Sempre honrar a jornada do aluno
- Sempre reforçar autoria dos insights
- Terminar com pergunta poderosa

#### Regras Invioláveis do Mestre

1. Se aluno pede resposta direta → reformular como pergunta guia
2. Se resposta errada → perguntas que exponham inconsistência (nunca corrigir)
3. Se resposta correta → aprofundar com nuances/exceções/aplicações
4. Se resposta superficial → pedir exemplos/contraargumentos/mecanismos
5. NUNCA mais de 1 pergunta por resposta
6. NUNCA usar labels artificiais
7. NUNCA dar resposta direta/completa
8. NUNCA desviar do tema do capítulo
9. SEMPRE terminar com pergunta aberta
10. SEMPRE referenciar algo específico que o aluno disse

#### Output Schema do Mestre

```typescript
{
  response: {
    content: string              // 50-1500 chars
    question_type: enum          // 6 tipos (clarificacao, pressupostos, perspectiva, evidencia, consequencias, metacognicao)
    question_technique?: enum    // 5 técnicas (paradoxal, temporal, inversao, essencia, permissao)
    depth_layer: 1-7             // camada de profundidade atingida
    is_closing: boolean          // se é interação de fechamento
    resistance_detected?: enum   // tipo de resistência (se detectada)
    emotional_calibration?: enum // estado emocional do aluno (confuso, defensivo, frustrado, insight)
  }
  quality_checks: {
    no_direct_answer: boolean
    no_labels: boolean
    ends_with_question: boolean
    single_question: boolean
    connected_to_chapter: boolean
    references_student_input: boolean
    within_length_limit: boolean
  }
}
```

---

### 6.2 — POLIDOR (Refinamento)

**Função**: Camada invisível de refinamento. Garante que o output do Mestre seja natural, sem artefatos de IA.

**Processo de Edição**:
1. Identificar & marcar labels para remoção
2. Remover todos os labels (manter conteúdo)
3. Reestruturar em exatamente 2 parágrafos
4. Ajustar fluência & simplificar linguagem robótica
5. Validar (contar parágrafos, verificar pergunta, contagem de palavras, significado preservado)

**Regras**:
- Exatamente 2 parágrafos (parágrafo 1: feedback + parágrafo 2: pergunta)
- Separados por linha em branco
- 80-200 palavras total
- Remove qualquer label artificial ([Feedback], [Pergunta], **Feedback:**, etc.)
- Simplifica linguagem robótica ("É importante ressaltar que..." → direto)
- Preserva 100% do significado
- Nunca adiciona conteúdo novo
- Nunca muda o foco da pergunta
- Sempre termina com ?

**Output Schema**:
```typescript
{
  edited_response: {
    content: string            // 80-1500 chars
    paragraph_count: 2         // literal: sempre 2
    word_count?: number        // 80-200
    ends_with_question: true   // literal: sempre true
  }
  changes_made?: {
    labels_removed?: string[]
    formatting_removed?: string[]
    paragraphs_restructured?: boolean
    content_condensed?: boolean
  }
  quality_checks?: {
    no_labels: boolean
    two_paragraphs: boolean
    ends_with_question: boolean
    within_word_limit: boolean
    meaning_preserved: boolean
  }
}
```

---

### 6.3 — GUARDIÃO (Validação de Qualidade)

**Função**: Valida a resposta final contra critérios de qualidade pedagógica socrática.

**7 Critérios de Validação**:
1. **Sem resposta direta** — não deu conselho/solução
2. **Sem labels artificiais** — texto limpo e natural
3. **Termina com pergunta aberta** — não sim/não
4. **Apenas 1 pergunta** — foco claro
5. **Conectada ao capítulo** — não divagou
6. **Referencia o aluno** — mencionou algo específico da resposta do aluno
7. **Dentro do limite** — 80-200 palavras, 2 parágrafos

**Output Schema**:
```typescript
{
  verdict: "APPROVED" | "REJECTED"
  score: number                    // 0.0-1.0
  criteria_results: {
    no_direct_answer: { pass: boolean, score: number, note?: string }
    no_labels: { pass: boolean, score: number, note?: string }
    ends_with_question: { pass: boolean, score: number, note?: string }
    single_question: { pass: boolean, score: number, note?: string }
    connected_to_chapter: { pass: boolean, score: number, note?: string }
    references_student: { pass: boolean, score: number, note?: string }
    within_limits: { pass: boolean, score: number, note?: string }
  }
  recommendation?: string         // feedback para retry (se REJECTED)
}
```

---

### 6.4 — DETECTOR (Análise Paralela — Shadow Analysis)

**Função**: Processa em paralelo (pipeline sombra). Analisa padrões cognitivos do aluno, detecta uso de IA, e faz análise linguística profunda. O aluno NUNCA vê esta análise.

#### Camada A — Padrões Cognitivos

**Distorções cognitivas**:
- Pensamento dicotômico ("Sempre/Nunca", "Tudo/Nada")
- Catastrofização (imaginar pior cenário)
- Leitura mental ("Sei que ele pensa...")
- Filtro mental (focar só no negativo)
- Personalização ("É tudo culpa minha")

**Loops de pensamento**:
- Análise circular (volta ao mesmo ponto)
- Paralisia por análise (excesso de opções)
- Ruminação (reviver o passado)
- Preocupação antecipatória (futuro catastrófico)

**Mecanismos de defesa**:
- Racionalização (justificativas elaboradas)
- Projeção (atribuir a outros)
- Negação (recusar evidências)
- Intelectualização (evitar emoções)

**Valores implícitos**:
- Segurança vs Crescimento
- Aprovação vs Autenticidade
- Controle vs Fluxo
- Perfeição vs Progresso

**Estratégias baseadas em padrões**:
- Se dicotômico → perguntas sobre nuances e espectros
- Se catastrofizando → perguntas sobre probabilidades e evidências
- Se em loop → perguntas que quebram o padrão
- Se defendendo → perguntas curiosas sem julgamento
- Se racionalizando → perguntas sobre sentimentos

#### Camada B — Detecção de IA

**Indicadores de IA** (alto peso):
- Fluência excessiva (coerência perfeita)
- Ausência de erros (500+ chars, zero typos)
- Tom impessoal (nunca "eu acho")
- Vocabulário obscuro formal ("outrossim", "destarte")
- Conectores artificiais ("Nesse sentido", "Diante do exposto")

**Indicadores HUMANOS** (reduzem probabilidade):
- Erros ortográficos
- Linguagem informal
- Gírias e expressões
- Hesitações ("tipo", "bom")
- Emojis

**Escala de probabilidade**:
| Faixa | Interpretação | Flag |
|---|---|---|
| 0.0 - 0.30 | Provavelmente humano | Nenhum |
| 0.31 - 0.50 | Provavelmente humano | Nenhum |
| 0.51 - 0.70 | Incerto | Nenhum |
| 0.71 - 0.85 | Provavelmente IA | `alta_probabilidade_texto_IA` |
| 0.86 - 1.0 | Muito provavelmente IA | `alta_probabilidade_texto_IA` |

**Regras**: Nunca bloqueia submissão. Nunca penaliza automaticamente. Dados são fatos, não julgamentos. Professor tem a palavra final.

#### Camada C — Linguística Profunda

- Comprimento das respostas ao longo do tempo
- Palavras de poder vs submissão
- Pronomes (eu/nós/eles — foco atencional)
- Tempos verbais (passado/presente/futuro)
- Valência emocional (positiva/negativa/neutra)
- Intensidade emocional (0-10)
- Nível de abstração (concreto ↔ abstrato)
- Certeza vs exploração

#### Output Schema do Detector

```typescript
{
  cognitive_patterns: {
    dominant_patterns: Array<{
      pattern: string        // tipo de distorção/loop/defesa
      evidence: string       // evidência textual
      frequency: "low"|"medium"|"high"
    }>
    implicit_values: string[]
    cognitive_loops: string[]
    readiness_level: "defensive"|"exploring"|"integrating"
    suggested_question_type: string
  }
  ai_detection: {
    probability: number      // 0.0-1.0
    confidence: "high"|"medium"|"low"
    verdict: "likely_human"|"uncertain"|"likely_ai"
    indicators: Array<{ type: string, description: string, weight: number }>
    flag: string | null
  }
  linguistic_analysis: {
    emotional_density: number       // 0-1
    abstraction_level: number       // 1-10
    certainty_vs_exploration: number // -1 (exploração) a +1 (certeza)
    defense_active: boolean
  }
  session_journey: {
    emotional_arc: string[]                    // acumulado na sessão
    depth_progression: number[]                // acumulado na sessão
    breakthrough_candidates: Array<{
      trigger: string
      marker: string
    }>
  }
}
```

---

### 6.5 — PERFILADOR (Perfil de Aprendizado)

**Função**: Analisa padrões de aprendizado ao longo de múltiplas sessões. Incremental — merge com perfil existente.

**Foco**: COMO o aluno aprende, não QUEM o aluno é.

#### Análises Gerais
- Estilo de engajamento: reflexivo | impulsivo | equilibrado
- Profundidade atingida: 1-7 (escala das 7 camadas)
- Preferência de resposta: conciso | verboso | equilibrado
- Estilo de raciocínio: analítico | criativo | sistemático | intuitivo
- Melhores tipos de pergunta por engajamento
- Trend de compreensão: melhorando | estável | declinando

#### Kolb Learning Styles — Detecção Implícita via Diálogo

O Perfilador detecta o estilo de aprendizado Kolb do aluno **sem teste formal**, apenas pelo comportamento observado no diálogo socrático. Os dados são armazenados como **vetor contínuo** nos 2 eixos de Kolb, não como categorias rígidas.

**Modelo teórico: Ciclo de Aprendizagem Experiencial de Kolb**

```
        SENTIR (CE)
           │
    ┌──────┼──────┐
    │      │      │
OBSERVAR ──┼── FAZER
  (RO)     │    (AE)
    │      │      │
    └──────┼──────┘
           │
       PENSAR (AC)
```

**2 Eixos Dialéticos**:
- **Eixo vertical (grasping)**: Sentir (CE) ↔ Pensar (AC) — como o aluno **capta** experiência
- **Eixo horizontal (transforming)**: Observar (RO) ↔ Fazer (AE) — como o aluno **transforma** experiência

**4 Estilos derivados do quadrante**:

| Estilo | Combinação | Perfil | Como aprende melhor |
|---|---|---|---|
| **Divergente** | Sentir + Observar | Imaginativo, empático, múltiplas perspectivas | Brainstorming, discussão, histórias, conexão pessoal |
| **Assimilador** | Pensar + Observar | Analítico, lógico, organizado | Modelos teóricos, frameworks, dados, tempo para refletir |
| **Convergente** | Pensar + Fazer | Prático, decisivo, eficiente | Problemas concretos, soluções diretas, aplicação imediata |
| **Acomodador** | Sentir + Fazer | Ação, intuição, risco | Tentativa e erro, experiência direta, colaboração |

**Mapeamento DISC ↔ Kolb** (ponte direta quando dados DISC estiverem disponíveis via WS3):

| DISC | Kolb | Eixo compartilhado |
|---|---|---|
| D (Dominância) | Convergente | Task + Action |
| I (Influência) | Acomodador | People + Action |
| S (Estabilidade) | Divergente | People + Reflection |
| C (Conformidade) | Assimilador | Task + Reflection |

**Indicadores de detecção no diálogo**:

| Indicador | Divergente | Assimilador | Convergente | Acomodador |
|---|---|---|---|---|
| Linguagem | Emocional ("eu sinto que...") | Analítica ("logicamente...") | Direta ("a solução é...") | Experiencial ("vamos tentar...") |
| Perguntas que faz | "Por quê?", "E se...?" | "Quais os dados?" | "Como resolver?" | "O que fazer agora?" |
| Tamanho da resposta | Médio-longo, exploratório | Longo, estruturado | Curto, preciso | Médio, anedótico |
| Tempo de resposta | Médio | Longo (analisando) | Curto (decidindo) | Curto (agindo) |
| Palavras emocionais | Alta frequência | Baixa | Baixa | Média-alta |
| Abstrato vs Concreto | Concreto + múltiplas visões | Abstrato + sistemático | Abstrato + aplicado | Concreto + ação |
| Referências sociais | Alta | Baixa | Baixa | Alta |

**Algoritmo de detecção**:
```
Fase 1 (trocas 1-5): Classificação Inicial
  - Prior: DISC do aluno (se existir via WS3) OU uniforme 25% cada
  - Atualizar com cada troca usando indicadores acima
  - Threshold: 60% confiança mínima antes de adaptar

Fase 2 (sessão contínua): Refinamento
  - Janela rolante das últimas 20 interações
  - Permitir mudança de estilo (NÃO é traço fixo)
  - Vetor contínuo nos dois eixos (não categórico)

Fase 3 (cross-session): Evolução
  - Histórico de vetores por aluno
  - Detectar variação por tópico/hora/dificuldade
  - Calcular flexibility_score (variância dos vetores)
```

**Nota crítica**: Kolb Learning Styles como diagnóstico rígido é considerado "neuromito" (Hattie 2025, d=0.04). Usamos como **espectro contínuo para variar abordagem pedagógica**, não para engavetar alunos. O objetivo é ajudar o aluno a desenvolver todos os 4 modos ao longo do tempo.

#### Adaptação do Mestre baseada no Estilo Kolb

O Perfilador fornece hints ao Mestre para adaptar o tipo de pergunta socrática:

| Estilo Kolb | Tipo de Pergunta Preferido | Exemplo |
|---|---|---|
| Divergente | Perspectiva, conexão pessoal | "Como isso se conecta com sua experiência?", "Que outra forma de ver isso existe?" |
| Assimilador | Evidência, frameworks | "Que princípio explica isso?", "Como isso se encaixa no modelo?" |
| Convergente | Aplicação prática, problema | "Como você resolveria isso na prática?", "Qual a abordagem mais eficiente?" |
| Acomodador | Ação, experimentação | "O que você tentaria primeiro?", "O que aprendeu com essa experiência?" |

#### Arquitetura Dual de Fontes de Perfil

O sistema terá **duas fontes complementares** de dados de perfil:

| Fonte | Mecanismo | Dados | Implementação |
|---|---|---|---|
| **Página de Perfil** | Testes explícitos (DISC, MBTI, Kolb LSI, etc.) | Auto-reportado pelo aluno | WS3 (Feature de plataforma) |
| **Perfilador IA** | Detecção implícita no diálogo socrático | Observado pela IA ao longo das sessões | WS1 (Motor Socrático) |

Isso cria um insight poderoso: **"Como o aluno se vê" vs "Como a IA o vê"**. Divergências entre as duas fontes são dados valiosos para o gestor/instrutor. Exemplo: aluno se declara "Convergente" no teste, mas o Perfilador detecta comportamento "Divergente" — o gestor vê essa discrepância e pode orientar.

#### Merge Incremental (se perfil existente)
```
avg_depth_achieved = (old * sessionCount + new) / (sessionCount + 1)
avg_qa_score = (old * sessionCount + new) / (sessionCount + 1)
kolb_grasping_axis = (old * sessionCount + new) / (sessionCount + 1)
kolb_transforming_axis = (old * sessionCount + new) / (sessionCount + 1)
strengths: manter existentes + adicionar novos relevantes
growth_areas: atualizar baseado na sessão mais recente
adaptation_hints: atualizar com observações recentes
confidence: cresce com mais sessões (cap em 0.9)
```

**Regras de confiança**:
- < 3 sessões: confidence < 0.3 (ser conservador)
- 3-10 sessões: confidence 0.3-0.7
- > 10 sessões: confidence até 0.9 (nunca 1.0)
- Primeira sessão: max confidence 0.15

**Regras invioláveis**:
1. Nunca fazer diagnósticos psicológicos
2. Sempre basear análise em evidências da conversa
3. Ser conservador com poucas sessões
4. Sempre escrever em português (Brasil)
5. Respeitar limites: max 5 pontos fortes, max 3 áreas de crescimento
6. Nunca comparar com outros alunos
7. Sempre fazer merge incremental se perfil anterior existe
8. Tratar Kolb como espectro contínuo, nunca como categoria fixa

**Output Schema**:
```typescript
{
  // Análises gerais
  preferred_question_types: Array<
    "clarificacao"|"pressupostos"|"perspectiva"|"evidencia"|
    "consequencias"|"metacognicao"
  >                                  // max 4
  engagement_style: "reflective"|"impulsive"|"balanced"
  detail_orientation: "verbose"|"concise"|"balanced"
  reasoning_style: "analytical"|"creative"|"systematic"|"intuitive"
  avg_depth_achieved: number         // 1-7
  comprehension_trend: "improving"|"stable"|"declining"
  avg_qa_score: number               // 0-1
  strengths: string[]                // max 5, each max 100 chars
  growth_areas: string[]             // max 3, each max 100 chars
  adaptation_hints: string[]         // max 5, each max 200 chars
  summary: string                    // max 500 chars
  confidence: number                 // 0-1, nunca > 1.0

  // Kolb Learning Style (vetor contínuo)
  kolb_profile: {
    grasping_axis: number            // -1.0 (Sentir/CE) a +1.0 (Pensar/AC)
    transforming_axis: number        // -1.0 (Observar/RO) a +1.0 (Fazer/AE)
    dominant_style: "divergente"|"assimilador"|"convergente"|"acomodador"
    style_confidence: number         // 0-1 (independente da confidence geral)
    indicators_observed: Array<{
      indicator: string              // ex: "linguagem_emocional", "resposta_curta_direta"
      weight: number                 // contribuição para a classificação
      evidence: string               // trecho ou comportamento observado
    }>
  }
}
```

---

## 7. Tipos de Interação — Comportamento Adaptativo do Mestre

O Mestre não gera interações — recebe do Course Creator (WS2). O WS2 envia um campo explícito `interaction_type` e o Mestre adapta seu comportamento conforme o tipo. A filosofia socrática (nunca dar resposta, sempre questionar) é constante em todos os tipos.

### 4 Tipos Suportados

#### Tipo 1: `socratic_dialogue` — Diálogo Socrático (aberto)

**O que é**: Pergunta aberta sobre o conteúdo do capítulo.
**Exemplo**: *"Considerando o framework SCRUM, qual o papel do Product Owner quando há conflito de prioridades entre stakeholders?"*

| Aspecto | Valor |
|---|---|
| Profundidade | Progressão completa (7 camadas) |
| Técnicas | Todas disponíveis (6 tipos + 5 avançadas) |
| Fechamento inteligente | Ativo |
| Default interações | 15-20 |

#### Tipo 2: `quiz` — Quiz com Justificativa

**O que é**: Múltipla escolha onde o aluno deve justificar a resposta.
**Exemplo**: *"Qual prática NÃO é parte do SCRUM? A) Daily B) Sprint Review C) Gantt Chart D) Retrospectiva"*

| Aspecto | Valor |
|---|---|
| Profundidade | Camadas 1-4 (Fatos → Análise) |
| Técnicas | Clarificação, Pressupostos, Evidência |
| Comportamento especial | Não confirma certo/errado imediatamente; foca no "por quê" da escolha |
| Se errou | Perguntas que exponham a inconsistência sem corrigir |
| Se acertou | Aprofunda para verificar compreensão real vs chute |
| Default interações | 5-8 |

#### Tipo 3: `scenario` — Cenário Prático

**O que é**: Situação profissional realista que exige análise e tomada de decisão.
**Exemplo**: *"Você é PM de um projeto 3 sprints atrasado. O CEO quer demo na sexta. O tech lead diz que precisa de mais 2 semanas. O que você faz?"*

| Aspecto | Valor |
|---|---|
| Profundidade | Camadas 3-6 (Aplicação → Avaliação) |
| Técnicas | Perspectiva, Inversão, Consequências |
| Comportamento especial | Não existe resposta certa — guia para posição fundamentada |
| Foco | Trade-offs, múltiplos stakeholders, consequências de cada decisão |
| Default interações | 8-12 |

#### Tipo 4: `assignment` — Tarefa/Trabalho Avaliativo

**O que é**: Entrega estruturada que o aluno constrói ao longo da conversa.
**Exemplo**: *"Construa um plano de comunicação para migração de sistema legado. Considere: stakeholders, riscos, timeline."*

| Aspecto | Valor |
|---|---|
| Profundidade | Camadas 3-7 (Aplicação → Síntese) |
| Técnicas | Todas, com foco em Aplicação e Síntese |
| Comportamento especial | Guia construção passo a passo; desafia cada etapa |
| Fechamento | "Olhando o plano completo, o que mudaria?" |
| Default interações | 10-15 |

### Input Schema (recebido do WS2)

```typescript
interface InteractionInput {
  type: "socratic_dialogue" | "quiz" | "scenario" | "assignment"
  content: string              // a pergunta/cenário/tarefa
  metadata?: {
    alternatives?: string[]    // para quiz (opções A, B, C, D)
    rubric?: string[]          // para assignment (critérios de avaliação)
    context?: string           // contexto adicional do cenário
    expected_depth?: number    // camada de profundidade esperada (override do default)
  }
}
```

### Adaptação no Prompt do Mestre

O prompt do Mestre contém uma seção condicional por tipo:
```
SE type = "socratic_dialogue" → progressão completa 7 camadas, todas as técnicas
SE type = "quiz"              → foco em justificativa, não confirmar certo/errado
SE type = "scenario"          → foco em trade-offs, perspectivas e consequências
SE type = "assignment"        → guiar construção passo a passo, desafiar cada etapa
```

> **Nota**: Até o WS2 ser implementado, o sistema assume `socratic_dialogue` como default para manter compatibilidade.

---

## 8. Gestão de Interações — Limite Base + Fechamento Inteligente

### Conceito

O sistema combina um **limite máximo configurável** (trava de segurança) com **fechamento inteligente** (o Mestre sugere encerrar quando a sessão atinge maturidade pedagógica).

### Fluxo

```
┌─────────────────────────────────────────────────────────┐
│  CADA INTERAÇÃO DO ALUNO                                │
│                                                         │
│  1. Verificar interactions_remaining > 0                │
│     └─ Se 0 → forçar Fechamento Socrático final        │
│                                                         │
│  2. Executar pipeline normal (Mestre → Polidor → ...)   │
│                                                         │
│  3. Avaliar sinais de maturidade (dados do Detector):   │
│     ├─ Aluno atingiu camada 6-7 de profundidade?        │
│     ├─ 2+ insights detectados (breakthrough_candidates)?│
│     ├─ Aluno expressando satisfação/conclusão?          │
│     └─ Tendência de profundidade estagnada?             │
│                                                         │
│  4. Se sinais detectados E remaining <= threshold:      │
│     └─ Mestre ativa modo Fechamento Socrático           │
│        (SUGERE encerrar, não FORÇA)                     │
│                                                         │
│  5. Aluno pode:                                         │
│     ├─ Aceitar → sessão encerra com resumo analítico    │
│     └─ Continuar → sessão prossegue até limite máximo   │
└─────────────────────────────────────────────────────────┘
```

### Configuração

```typescript
interface InteractionConfig {
  // Limite máximo (trava de segurança)
  max_interactions: number          // range: 5-30, configurado pelo instrutor ou default por tipo
  configured_by: "instructor" | "default"

  // Defaults por tipo de interação (usado quando instrutor não configura)
  type_defaults: {
    socratic_dialogue: 20
    quiz: 8
    scenario: 12
    assignment: 15
  }

  // Fechamento inteligente
  smart_closing: {
    enabled: boolean                // default: true
    min_interactions_before: number // default: 5 (nunca sugerir fechar antes disso)
    depth_threshold: number         // default: 6 (camada mínima para considerar fechamento)
    insights_threshold: number      // default: 2 (breakthroughs mínimos)
    remaining_threshold: number     // default: 5 (só sugere se remaining <= este valor)
  }
}
```

### Regras

1. **Limite máximo é inviolável** — quando chega a 0, sessão encerra com Fechamento Socrático obrigatório
2. **Fechamento inteligente nunca força** — apenas muda o modo do Mestre para perguntas de integração/ação
3. **Mínimo de 5 interações** — nunca sugerir fechamento antes de 5 trocas (evita sessões superficiais)
4. **O instrutor define o teto** — ao criar o curso/capítulo no WS2 (ou usa default 20)
5. **Futuramente**: defaults diferentes por tipo de interação (quando WS2 implementar tipos)

---

## 9. Model Router — Seleção Híbrida de LLM

### Conceito

O Motor Socrático utiliza um **Model Router** que seleciona o LLM ideal por agente, tipo de interação e plano do tenant. Isso permite otimizar custo sem sacrificar qualidade onde importa.

```
┌─────────────────────────────────────────────────┐
│                 MODEL ROUTER                     │
│                                                  │
│  Inputs:                                         │
│  ├─ agent_id (mestre, polidor, detector...)      │
│  ├─ interaction_type (socratic, quiz...)         │
│  ├─ tenant_plan (standard, premium)              │
│  └─ fallback_config                              │
│                                                  │
│  Output: LanguageModelV1 (AI SDK provider)       │
└──────────┬──────────────┬──────────────┬────────┘
           │              │              │
         OpenAI              DeepSeek
     gpt-4.1 / mini        DeepSeek V3
```

### Princípio: Criticidade Determina Modelo

| Agente | Criticidade | Razão | Modelo Mínimo |
|---|---|---|---|
| **Mestre** | **ALTA** | Diálogo visível ao aluno, nuance socrática, empatia | gpt-4.1-mini (Essencial) / gpt-4.1 (Standard+) |
| **Polidor** | Média | Edição estrutural, reformatação | DeepSeek V3 |
| **Guardião** | **MÁXIMA** | Quality gate — se falha, lixo chega ao aluno | **Sempre gpt-4.1** |
| **Detector** | Média | Análise cognitiva, invisível ao aluno | DeepSeek V3 |
| **Perfilador** | Baixa | A cada 5 msgs, merge incremental | DeepSeek V3 |

> **Regra inviolável**: O Guardião **nunca** usa modelo econômico. Custo marginal (~3-5% do total da sessão) não justifica risco de degradação do quality gate.

### Planos por Tenant — Monetização da Qualidade IA

O sistema oferece **3 planos** com 2 providers principais: **OpenAI** (Mestre + Guardião) e **DeepSeek** (agentes de suporte). O Premium usa **apenas OpenAI** em toda a stack (gpt-4.1 para Mestre/Guardião, gpt-4.1-mini para suporte).

| Plano | Mestre | Polidor | Guardião | Detector | Perfilador | Custo/Sessão |
|---|---|---|---|---|---|---|
| **Essencial** | gpt-4.1-mini | DeepSeek V3 | gpt-4.1 | DeepSeek V3 | DeepSeek V3 | **~$0.11** |
| **Standard** | gpt-4.1 | DeepSeek V3 | gpt-4.1 | DeepSeek V3 | DeepSeek V3 | **~$0.29** |
| **Premium** | gpt-4.1 | gpt-4.1-mini | gpt-4.1 | gpt-4.1-mini | gpt-4.1-mini | **~$0.34** |

**Diferença prática por plano**:

| Aspecto | Essencial | Standard | Premium |
|---|---|---|---|
| Mestre (diálogo visível) | gpt-4.1-mini | gpt-4.1 | gpt-4.1 |
| Guardião (quality gate) | gpt-4.1 (sempre) | gpt-4.1 (sempre) | gpt-4.1 (sempre) |
| Suporte (Polidor, Detector, Perfilador) | DeepSeek V3 | DeepSeek V3 | gpt-4.1-mini (all) |
| Nuance socrática do Mestre | Boa | Avançada | Avançada |
| Providers | OpenAI + DeepSeek | OpenAI + DeepSeek | OpenAI only |
| Caso de uso ideal | Free/Trial, alto volume | Padrão da plataforma | Enterprise, alta exigência |

> **Arquitetura de providers simplificada**: Apenas 2 providers (OpenAI + DeepSeek) para Essencial e Standard. Premium usa apenas OpenAI. DeepSeek V3 é acessado via API OpenAI-compatible, simplificando a integração.

**Projeção de custo mensal** (base: 20 interações/sessão, Perfilador a cada 5):

| Volume | Essencial | Standard | Premium |
|---|---|---|---|
| 1.000 sessões/mês | $110 | $290 | $340 |
| 5.000 sessões/mês | $550 | $1.450 | $1.700 |
| 10.000 sessões/mês | $1.100 | $2.900 | $3.400 |

**Salto de custo entre planos**:

| De → Para | Multiplicador | Custo adicional/sessão | O que muda |
|---|---|---|---|
| Essencial → Standard | **2.6x** | +$0.18 | Mestre: mini → gpt-4.1 (nuance socrática avançada) |
| Standard → Premium | **1.2x** | +$0.05 | Suporte: DeepSeek → gpt-4.1-mini (single provider OpenAI) |
| Essencial → Premium | **3.1x** | +$0.23 | Mestre + suporte tudo OpenAI |

### Roteamento por Tipo de Interação (dentro dos planos Standard e Essencial)

| `interaction_type` | Mestre (Standard) | Mestre (Essencial) | Razão |
|---|---|---|---|
| `socratic_dialogue` | gpt-4.1 | gpt-4.1-mini | Máxima criatividade e nuance |
| `scenario` | gpt-4.1 | gpt-4.1-mini | Trade-offs complexos |
| `assignment` | gpt-4.1 | gpt-4.1-mini | Guiar construção passo-a-passo |
| `quiz` | gpt-4.1-mini | gpt-4.1-mini | Menor complexidade — "por que escolheu B?" |

> **Nota**: No plano Premium, o Mestre usa gpt-4.1 para todos os tipos. No Standard, quiz usa mini para economizar. No Essencial, todos os tipos usam mini.

### Fallback Chain (Resiliência)

Se o provider primário estiver indisponível:

```
Primário gpt-4.1       → Fallback: DeepSeek V3     → Fallback: Gemini 2.5 Pro
Primário gpt-4.1-mini  → Fallback: DeepSeek V3     → Fallback: Gemini 2.5 Flash
Primário DeepSeek V3   → Fallback: gpt-4.1-nano    → Fallback: Gemini 2.0 Flash
```

O Orquestrador implementa retry com fallback automático (max 2 tentativas antes de escalar).

### Interface TypeScript

```typescript
interface ModelRouterConfig {
  // Modelo por agente (roteamento estático por plano)
  plans: Record<TenantPlan, {
    mestre: ModelSpec
    polidor: ModelSpec
    guardiao: ModelSpec        // SEMPRE premium
    detector: ModelSpec
    perfilador: ModelSpec
  }>

  // Override por tipo de interação (só afeta Mestre no plano Standard)
  interaction_overrides?: Partial<Record<InteractionType, {
    mestre?: ModelSpec
  }>>

  // Fallback chain (resiliência)
  fallback_chains: Record<string, ModelSpec[]>
}

interface ModelSpec {
  provider: "openai" | "deepseek"
  model: string                // "gpt-4.1", "gemini-2.5-flash", etc.
  api_key_env: string          // nome da env var com a API key
  max_retries?: number         // default: 2
  timeout_ms?: number          // default: 30000
}

type TenantPlan = "essencial" | "standard" | "premium"
```

### Implementação no AI SDK

```typescript
import { openai } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

// DeepSeek usa API OpenAI-compatible — integração simplificada
const deepseek = createOpenAICompatible({
  name: 'deepseek',
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY,
})

function getModel(agentId: AgentId, context: RoutingContext): LanguageModelV1 {
  const planConfig = MODEL_ROUTER_CONFIG.plans[context.tenantPlan]
  let modelSpec = planConfig[agentId]

  // Override por interaction_type (só para Mestre no Standard — quiz usa mini)
  if (agentId === 'mestre' && context.tenantPlan === 'standard' && context.interactionType) {
    const override = MODEL_ROUTER_CONFIG.interaction_overrides?.[context.interactionType]
    if (override?.mestre) modelSpec = override.mestre
  }

  return createModel(modelSpec)
}

function createModel(spec: ModelSpec): LanguageModelV1 {
  switch (spec.provider) {
    case 'openai': return openai(spec.model)
    case 'deepseek': return deepseek(spec.model)
  }
}
```

---

## 10. Framework de Avaliação de Qualidade

O sistema implementa avaliação de qualidade em **3 fases** para garantir que a troca de modelos não degrade a experiência do aluno.

```
FASE 1: BENCHMARK          FASE 2: SHADOW A/B      FASE 3: PRODUÇÃO
(pré-lançamento)           (soft launch)           (contínuo)

Golden Dataset 50-100  →   10-20% dual pipeline →  Quality Dashboard
Human Blind Eval       →   Comparador automático → Model Degradation Alert
Quality Scorecard      →   200+ comparações      → Monthly Human Sample

GO/NO-GO decision      →   Confirma/Reverte      → Manutenção contínua
```

### Fase 1: BENCHMARK (Pré-lançamento)

Executada **antes** de colocar qualquer combo de modelos em produção.

#### 1.1 — Golden Dataset

50-100 conversas de teste cobrindo todas as dimensões:

| Dimensão | Variações |
|---|---|
| Tipo de interação | socratic_dialogue, quiz, scenario, assignment |
| Tema | Hard skill (SCRUM, finanças) + Soft skill (liderança, comunicação) |
| Perfil do aluno | Reflexivo longo, Impulsivo curto, Resistente, Usando IA |
| Profundidade | Superficial (1-2), Média (3-5), Avançada (6-7) |
| Casos-limite | "não sei", ofensivo, resposta perfeita, off-topic |

#### 1.2 — Execução Multi-Modelo

Rodar o mesmo golden dataset em todos os combos + referência (all gpt-4.1):

```
Golden Input → Pipeline Standard  → Output Standard
Golden Input → Pipeline Premium   → Output Premium (referência)
```

#### 1.3 — Avaliação Cega (Human-in-the-Loop)

3-5 avaliadores recebem pares de respostas **sem saber qual modelo gerou**:

| Dimensão | Peso | O que avalia | Escala |
|---|---|---|---|
| Aderência Socrática | 25% | Não deu resposta direta? Terminou com pergunta? | 1-5 |
| Naturalidade | 20% | Parece humano? Sem labels? Fluido? | 1-5 |
| Profundidade | 20% | Pergunta avançou o raciocínio? Calibrada? | 1-5 |
| Empatia/Calibração | 15% | Respeitou estado emocional? Adaptou tom? | 1-5 |
| Relevância | 20% | Conectada ao tema? Referenciou o aluno? | 1-5 |

**Critério de aprovação**:
- Score médio >= 4.0/5.0
- Delta vs referência (Premium) <= -0.3
- Schema compliance >= 98%

#### 1.4 — Quality Scorecard

```typescript
interface BenchmarkMetrics {
  human_eval_avg: number              // média avaliação humana (1-5)
  guardian_avg_score: number           // média score do Guardião (0-1)
  guardian_rejection_rate: number      // % de respostas rejeitadas
  guardian_false_positive_rate: number // % que passou mas humano reprovou
  guardian_false_negative_rate: number // % que rejeitou mas humano aprovaria
  schema_compliance_rate: number       // % de JSONs válidos
  p95_latency_ms: number              // latência P95
  quality_delta_vs_premium: number    // diferença vs all gpt-4.1
}
```

### Fase 2: SHADOW A/B (Soft Launch)

Após aprovação no benchmark, validação com tráfego real por 2-4 semanas.

```
┌──────────────────────────────────────────┐
│  TRÁFEGO REAL (100% dos alunos)          │
│                                           │
│  Pipeline Principal (Standard) ──▶ Aluno │
│                                           │
│  Shadow Pipeline (Premium) ──▶ DB only   │
│  (10-20% das sessões, async)             │
│                                           │
│  COMPARADOR                               │
│  ├─ Guardião score A vs B                │
│  └─ Alerta se delta > threshold          │
└──────────────────────────────────────────┘
```

**Threshold de alerta**: Média rolante de 50 comparações com delta < -0.10 → escalar para review humano.

**Duração**: 2-4 semanas, ou até atingir 200+ comparações.

```typescript
interface ShadowComparison {
  session_id: string
  interaction_number: number
  primary_guardian_score: number    // combo Standard
  shadow_guardian_score: number     // combo Premium
  quality_delta: number            // primary - shadow
  alert_triggered: boolean         // true se delta < -0.15
}
```

### Fase 3: MONITORAMENTO CONTÍNUO (Produção)

#### Dashboard de Qualidade (para o time)

| Métrica | Frequência | Alerta se |
|---|---|---|
| Guardião avg score (7 dias) | Diário | < 0.75 |
| Guardião rejection rate | Diário | > 25% |
| Schema compliance | Diário | < 98% |
| Latência P95 | Horário | > 5s |
| Profundidade média | Semanal | < 3.5 (de 7) |
| Detecção IA rate | Semanal | > 30% |
| Student satisfaction (se coletar) | Semanal | < 4.0/5 |

#### Detecção de Degradação de Modelo

LLMs mudam silenciosamente ao longo do tempo. O sistema detecta degradação via:

```
score_atual < média_30d - 2 * desvio_padrão → ALERTA DE DEGRADAÇÃO
```

#### Sampling Mensal

20 sessões aleatórias avaliadas por humanos (mesmas 5 dimensões da Fase 1) para manter calibração e detectar problemas que métricas automáticas não captam.

---

## 11. Dados & Schema de Sessão (Enriquecido)

Novos dados capturados por sessão, baseado no benchmark "Estrutura de Dados":

```typescript
interface SocraticSessionAnalytics {
  // Journey tracking
  emotional_journey: string[]          // ["confused", "defensive", "curious", "insightful"]
  depth_reached: number                // 1-7 (max layer touched)
  breakthrough_moments: number         // count of breakthroughs

  // Cognitive analysis (do Detector)
  dominant_theme?: string
  cognitive_patterns: string[]
  defense_mechanisms: string[]
  values_revealed: string[]
  contradictions_explored: number

  // Socratic metrics
  depth_progression: number[]          // [1, 2, 2, 3, 4, 5, 4, 6]
  resistance_moments: number
  insight_moments: number

  // AI performance metrics
  question_relevance: number           // 0-1
  depth_calibration: number            // 0-1
  resistance_navigation: number        // 0-1

  // Clarity metrics (do Output Analítico)
  initial_confusion_level?: number     // 0-10
  final_clarity_level?: number         // 0-10
  clarity_gain?: number                // diferença

  // Linguistic evolution
  response_lengths: number[]           // comprimento de cada resposta
  emotional_density_progression: number[] // densidade emocional ao longo da sessão

  // Kolb style tracking (per session)
  kolb_session_vector: {
    grasping_axis: number              // CE ↔ AC para esta sessão
    transforming_axis: number          // RO ↔ AE para esta sessão
    indicators_count: number           // quantos indicadores observados
  }
}
```

**Impacto DB**: Nova tabela `session_analytics` ou campo JSONB `analytics` na tabela `sessions`.

---

## 12. Contexto de Perfil do Aluno (Input para o Mestre)

O Orquestrador constrói um contexto de personalização a partir de:
- **Big Five**: Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism
- **Enneagram**: Tipo 1-9 com dicas personalizadas
- **DISC**: Perfil dominante (D/I/S/C) com estilo de ensino
- **Inteligências Múltiplas**: Top 2 inteligências + sugestões
- **Estilo de Aprendizado**: Texto livre (sanitizado)
- **Perfil de Aprendizado IA** (do Perfilador): Hints de adaptação, tipos preferidos de pergunta, estilo de engajamento

Este contexto é embedado no system prompt do Mestre para personalização.

---

## 13. Stack Técnico

| Componente | Tecnologia | Justificativa |
|---|---|---|
| LLM Premium | `gpt-4.1` (Mestre Standard/Premium + Guardião sempre) | Diálogo socrático avançado + quality gate inviolável |
| LLM Intermediário | `gpt-4.1-mini` (Mestre no plano Essencial) | Diálogo socrático com custo reduzido |
| LLM Econômico | `DeepSeek V3` (Polidor, Detector, Perfilador) | API OpenAI-compatible, custo ~7x menor que gpt-4.1 |
| Model Router | Multi-provider via AI SDK (OpenAI + DeepSeek) | 3 planos: Essencial ($0.11) / Standard ($0.29) / Premium ($0.34) |
| Structured Output | AI SDK `generateObject` + Zod | Pattern existente no monorepo |
| Observability | Sentry spans por agente | Já integrado |
| DB | Supabase (JSONB enriquecido) | Infra existente |
| Package | `@eximia/agents` | Mesmo package, código novo |
| Sanitização | Regex + length limits | Prevenção de prompt injection |

---

## 14. Estrutura de Arquivos (Nova)

```
packages/agents/src/
├── orchestrator.ts          # REESCREVER: Orquestrador v2
├── types.ts                 # ATUALIZAR: novos tipos
├── prompts/
│   ├── mestre.ts            # NOVO
│   ├── polidor.ts           # NOVO
│   ├── guardiao.ts          # NOVO
│   ├── detector.ts          # NOVO
│   └── perfilador.ts        # NOVO
├── schemas/
│   ├── mestre.ts            # NOVO
│   ├── polidor.ts           # NOVO
│   ├── guardiao.ts          # NOVO
│   ├── detector.ts          # NOVO
│   └── perfilador.ts        # NOVO
└── [DELETAR: socrates.ts, editor.ts, analyst.ts, profiler.ts, creator.ts, tester.ts]
```

---

## 15. Migration Plan

| Passo | Ação | Risco |
|---|---|---|
| 1 | Criar novos arquivos (mestre, polidor, guardiao, detector, perfilador) | Baixo |
| 2 | Criar novo orchestrator v2 | Médio |
| 3 | Criar novos schemas Zod | Baixo |
| 4 | Criar migration DB para session_analytics | Baixo |
| 5 | Migrar API routes para usar novo pipeline | Alto |
| 6 | **Deletar** todos os arquivos antigos | Baixo (após migração) |
| 7 | Testes E2E com novo pipeline | Médio |
| 8 | A/B testing (se possível) | Opcional |

---

## 16. Output Analítico Avançado — Relatório de Sessão

O benchmark define 3 tipos de relatório. Na v1, implementamos **UC2 + UC3** (gestor/instrutor + dashboard).

### UC1: Para o Aluno (Auto-conhecimento) — FUTURO (v2)
- Principais descobertas da sessão
- Padrões identificados
- Próximos passos sugeridos (autogerados pelo aluno, não pela IA)

### UC2: Para Gestor/Instrutor (Supervisão) — V1
Relatório individual por aluno, visível na área do gestor/instrutor:
- **Perfil de aprendizado IA**: Estilo Kolb detectado (com vetor e confiança), estilo de engajamento, raciocínio
- **Divergência teste vs IA**: Comparação entre perfil auto-reportado (testes WS3) e perfil observado (Perfilador)
- **Padrões comportamentais**: Distorções cognitivas recorrentes, mecanismos de defesa, valores implícitos
- **Evolução**: Trend de profundidade, progressão de engajamento, áreas de crescimento
- **Alertas**: Detecção de IA, estagnação, resistência persistente
- **Recomendações**: Hints de acompanhamento baseados nos dados

### UC3: Para Análise Agregada (Dashboard) — V1
Dashboard de turma/área, visível para gestor/instrutor:
- **Métricas de engajamento**: Sessões ativas, duração média, taxa de retorno
- **Profundidade média**: Score 1-7 da turma com distribuição
- **Mapa Kolb da turma**: Distribuição dos estilos de aprendizado (scatter plot nos 2 eixos)
- **Padrões cognitivos mais frequentes**: Top distorções/loops na turma
- **Alertas de atenção**: Alunos com baixo acesso, estagnação, queda de engajamento
- **Comparativo teste vs IA**: Visão agregada das divergências de perfil

### UX Architecture — Onde e Como Exibir

#### Decisão D1: Navegação Híbrida

Dashboard existente (`/dashboard`) mantém KPIs resumidos com links para área Analytics dedicada (`/analytics/*`).

```
/dashboard (existente)
├── Summary Cards (existente) + novos KPIs socrático
├── Engagement Chart (existente)
├── Course Analytics Table (existente, expandir com colunas socrático)
└── Links → /analytics/* para deep dive

/analytics (nova área, sidebar "Analytics" deixa de redirecionar)
├── /analytics                        → Dashboard agregado (UC3)
├── /analytics/students/[studentId]   → Perfil individual (UC2)
└── /analytics/sessions/[sessionId]   → Análise de sessão (Detector pontual)
```

**Sidebar Navigation** (role: `manager`):

```
Dashboard        → /dashboard (KPIs resumidos)
Analytics        → /analytics (dashboard agregado UC3)
  └── [deep link]  → /analytics/students/[id]
  └── [deep link]  → /analytics/sessions/[id]
```

#### Decisão D2: Perfil Individual — Página Dedicada (`/analytics/students/[studentId]`)

URL compartilhável, espaço completo para dados UC2.

```
┌─────────────────────────────────────────────────────────────────┐
│  /analytics/students/[studentId]                                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  HEADER: Avatar + Nome + Badge de plano                 │    │
│  │  Última sessão: 12/02/2026 · 47 sessões total          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌──────── Tabs ───────────────────────────────────────────┐    │
│  │ [Perfil IA] [Padrões Cognitivos] [Evolução] [Sessões]  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  TAB 1 — Perfil IA (Perfilador)                                 │
│  ┌──────────────┐ ┌──────────────────────────────────────┐      │
│  │ Kolb Scatter  │ │ Estilo de engajamento: Reflexivo     │      │
│  │ (ponto no    │ │ Raciocínio: Analítico                │      │
│  │  plano 2D)   │ │ Orientação: Verboso                  │      │
│  │              │ │ Profundidade média: 5.2 / 7           │      │
│  │  + Overlay   │ │ Trend: Melhorando ↑                  │      │
│  │  teste vs IA │ │ Confiança do perfil: 72% (8 sessões) │      │
│  └──────────────┘ │ QA Score médio: 0.82                 │      │
│                    └──────────────────────────────────────┘      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Divergência Teste vs IA                                  │    │
│  │ ┌──────────────┬────────────────┬────────────────────┐  │    │
│  │ │ Dimensão     │ Teste (WS3)    │ IA (Perfilador)    │  │    │
│  │ │ Kolb         │ Convergente    │ Divergente (68%)   │  │    │
│  │ │ DISC         │ D (Dominância) │ I (Influência) ⚠️  │  │    │
│  │ └──────────────┴────────────────┴────────────────────┘  │    │
│  │ ⚠️ = divergência significativa (atenção do gestor)      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  TAB 2 — Padrões Cognitivos (Detector agregado)                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Top Padrões Recorrentes (últimas 10 sessões)            │    │
│  │ ████████████ Pensamento dicotômico (7 sessões)          │    │
│  │ █████████    Generalização (5 sessões)                  │    │
│  │ ██████       Loop de justificação (4 sessões)           │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │ Valores Implícitos: autonomia, justiça, pragmatismo     │    │
│  │ Mecanismos de defesa: intelectualização (frequente)     │    │
│  │ Readiness médio: exploring → integrating (progredindo)  │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Alertas                                                  │    │
│  │ 🔴 Detecção IA: 2 sessões com verdict "likely_ai"       │    │
│  │ 🟡 Resistência persistente: 3 sessões consecutivas      │    │
│  │ 🟢 Breakthrough: 2 momentos na última sessão            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  TAB 3 — Evolução (Trend longitudinal)                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Profundidade ao longo do tempo (LineChart)               │    │
│  │   7│            ╱╲                                       │    │
│  │   5│      ╱╲╱╲╱  ╲╱╲                                    │    │
│  │   3│  ╱╲╱                                                │    │
│  │   1│╱                                                    │    │
│  │    └──────────────────────────────                       │    │
│  │    S1  S3  S5  S7  S9  S11  S13                          │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │ Kolb Vector ao longo do tempo (scatter trail)            │    │
│  │ Clareza: 3.2 → 7.1 (ganho: +3.9)                        │    │
│  │ Densidade emocional: crescente (0.3 → 0.6)              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  TAB 4 — Sessões (lista com link para detalhe)                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Data       │ Curso        │ Prof. │ AI Det. │ Score │ → │    │
│  │ 12/02/2026 │ Liderança    │ 6/7   │ Human   │ 0.91  │ → │    │
│  │ 10/02/2026 │ SCRUM        │ 4/7   │ Human   │ 0.85  │ → │    │
│  │ 08/02/2026 │ Liderança    │ 5/7   │ ⚠️ AI   │ 0.72  │ → │    │
│  │ → clica → /analytics/sessions/[sessionId]               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Recomendações para o Gestor                              │    │
│  │ • Abordar divergência Kolb teste vs IA em 1:1            │    │
│  │ • Monitorar detecção IA — padrão em 2 sessões            │    │
│  │ • Forte em pensamento analítico, desafiar com cenários   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

**Componentes necessários**:

| Componente | Tipo | Base |
|---|---|---|
| `StudentProfileHeader` | Organism | Card + Avatar + Badge |
| `KolbScatterPlot` | Molecule | recharts ScatterChart (2D) |
| `DivergenceTable` | Molecule | DataTable + Badge (⚠️ para divergências) |
| `CognitivePatternBars` | Molecule | recharts BarChart horizontal |
| `AlertCards` | Molecule | StatCard + Badge severidade |
| `DepthProgressionChart` | Molecule | recharts LineChart |
| `SessionHistoryTable` | Molecule | DataTable com link |
| `GestorRecommendations` | Molecule | Card com lista |

#### Decisão D3: Dashboard Agregado UC3 (`/analytics`)

```
┌─────────────────────────────────────────────────────────────────┐
│  /analytics                                                     │
│                                                                 │
│  ┌───────────────────────── Filtros ───────────────────────┐    │
│  │ [Período: 30d ▾] [Curso: Todos ▾] [Área: Todas ▾]      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─── Summary Cards (1ª linha) ────────────────────────────┐    │
│  │ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────┐│    │
│  │ │ Sessões    │ │ Prof.Média │ │ Breakthru  │ │ AI Det ││    │
│  │ │ Ativas     │ │ 4.3 / 7   │ │ 2.1/sessão │ │ 3.2%   ││    │
│  │ │ 847        │ │   ↑ 0.4   │ │   ↑ 0.3    │ │  ↓ 1.1 ││    │
│  │ └────────────┘ └────────────┘ └────────────┘ └────────┘│    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─── Gráficos (2ª linha) ────────────────────────────────┐     │
│  │ ┌────────────────────────┐ ┌──────────────────────────┐│     │
│  │ │ Profundidade da Turma  │ │ Mapa Kolb da Turma       ││     │
│  │ │                        │ │                          ││     │
│  │ │ ProgressBar 4.3/7     │ │    CE                    ││     │
│  │ │                        │ │  ·  · ·                  ││     │
│  │ │ Distribuição:          │ │ RO ·····  AE             ││     │
│  │ │ ██ 1-2 (12%)          │ │    · · ··                ││     │
│  │ │ ████ 3-4 (45%)        │ │    AC                    ││     │
│  │ │ ██████ 5-6 (35%)      │ │                          ││     │
│  │ │ ██ 7 (8%)             │ │ (cada ponto = 1 aluno)   ││     │
│  │ └────────────────────────┘ └──────────────────────────┘│     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌─── Gráficos (3ª linha) ────────────────────────────────┐     │
│  │ ┌────────────────────────┐ ┌──────────────────────────┐│     │
│  │ │ Padrões Cognitivos Top │ │ Jornada Emocional Média  ││     │
│  │ │ (Bar horizontal)       │ │ (AreaChart)              ││     │
│  │ │                        │ │                          ││     │
│  │ │ Dicotômico     ██████ │ │ confused ─╲              ││     │
│  │ │ Generalização  █████  │ │ defensive ─╲             ││     │
│  │ │ Justificação   ████   │ │ curious ────╲            ││     │
│  │ │ Catastrofismo  ███    │ │ insightful ──────        ││     │
│  │ │ Personalização ██     │ │                          ││     │
│  │ └────────────────────────┘ └──────────────────────────┘│     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌─── Engajamento (existente, migrado) ───────────────────┐     │
│  │ LineChart sessões/semana (12 semanas) — já implementado │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌─── Alertas de Atenção ─────────────────────────────────┐     │
│  │ 🔴 João Silva — 0 sessões em 14 dias (estagnação)       │     │
│  │ 🔴 Maria Santos — 3 sessões "likely_ai" consecutivas    │     │
│  │ 🟡 Pedro Costa — profundidade caindo (5→3→2)             │     │
│  │ 🟡 Ana Lima — resistência persistente (4 sessões)        │     │
│  │ 🟢 Carlos Souza — breakthrough em 3 sessões seguidas    │     │
│  │                                     [Ver todos →]        │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌─── Divergência Teste vs IA (agregada) ─────────────────┐     │
│  │ Aluno         │ Kolb Teste │ Kolb IA    │ Divergência   │     │
│  │ João Silva    │ Convergente│ Divergente │ ⚠️ Alta        │     │
│  │ Maria Santos  │ Assimilador│ Assimilador│ ✓ Alinhado    │     │
│  │ Pedro Costa   │ —          │ Acomodador │ 📋 Sem teste   │     │
│  │                                     [CSV Export ↓]       │     │
│  └─────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

**Visualizações recharts confirmadas**:

| Dado | Componente recharts | Props principais |
|---|---|---|
| Profundidade média + distribuição | `BarChart` vertical | 7 barras (camadas 1-7), cores por faixa |
| Mapa Kolb da turma | `ScatterChart` | 2 eixos (-1 a +1), cada ponto = aluno, tooltip com nome |
| Padrões cognitivos top 5 | `BarChart` horizontal (layout="vertical") | Ordenado por frequência, top 5 |
| Jornada emocional média | `AreaChart` | Eixo X = etapa da sessão, Y = densidade emocional |
| Engajamento semanal | `LineChart` (existente) | Migrar do dashboard atual |
| Profundidade longitudinal (UC2) | `LineChart` | Eixo X = sessões, Y = profundidade 1-7 |
| Kolb vector trail (UC2) | `ScatterChart` com linha | Trail de pontos conectados mostrando evolução |

#### Decisão D4: Análise de Sessão — Detalhe Pontual (`/analytics/sessions/[sessionId]`)

```
┌─────────────────────────────────────────────────────────────────┐
│  /analytics/sessions/[sessionId]                                │
│                                                                 │
│  ┌─── Header ─────────────────────────────────────────────┐     │
│  │ Sessão #482 · João Silva · Liderança Cap.3             │     │
│  │ 12/02/2026 · 18 interações · Profundidade: 6/7         │     │
│  │ AI Detection: likely_human (92%) · QA Score: 0.91      │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌──────── Tabs ───────────────────────────────────────────┐     │
│  │ [Análise Cognitiva] [Jornada] [Métricas] [Conversa]    │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                 │
│  TAB 1 — Análise Cognitiva (Detector desta sessão)              │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ Padrões detectados:                                      │     │
│  │ • Pensamento dicotômico (high) — "ou é X ou é Y"        │     │
│  │ • Loop de justificação (medium) — 3 ocorrências          │     │
│  │                                                          │     │
│  │ Valores implícitos: autonomia, eficiência                │     │
│  │ Readiness: exploring                                     │     │
│  │ Suggested question type: perspectiva                     │     │
│  │                                                          │     │
│  │ AI Detection Indicators:                                 │     │
│  │ • Vocabulary diversity: 0.82 (human range)               │     │
│  │ • Response time pattern: natural                         │     │
│  │ • Emotional markers: present (0.71)                      │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                 │
│  TAB 2 — Jornada da Sessão                                      │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ Depth Progression (LineChart):                           │     │
│  │ 7│                  ╱╲                                   │     │
│  │ 5│            ╱╲╱╲╱  ╲                                   │     │
│  │ 3│      ╱╲╱╲╱                                            │     │
│  │ 1│  ╱╲╱                                                  │     │
│  │  └──────────────────                                     │     │
│  │  T1  T3  T5  T7  T9  T11 T13 T15 T17                    │     │
│  │                                                          │     │
│  │ Arco Emocional: confused → defensive → curious →         │     │
│  │                  insightful → integrating                 │     │
│  │                                                          │     │
│  │ ⭐ Breakthrough moment: Turno 11                         │     │
│  │    Trigger: "pergunta sobre paradoxo de liderança"       │     │
│  │    Marker: "mudança de perspectiva autoiniciada"         │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                 │
│  TAB 3 — Métricas                                               │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ Clareza: 3 → 7 (ganho: +4)                              │     │
│  │ Densidade emocional: 0.31 → 0.68 (crescente)            │     │
│  │ Abstração: 4.2 → 7.1 (crescente)                        │     │
│  │ Certeza vs Exploração: +0.3 → -0.4 (mais exploratório)  │     │
│  │ Resistência: 2 momentos (turnos 4 e 7, superados)       │     │
│  │                                                          │     │
│  │ Kolb desta sessão: grasping=-0.3 transforming=+0.4      │     │
│  │ → Tendência Acomodador nesta sessão                      │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                 │
│  TAB 4 — Conversa (transcript read-only)                        │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ Aluno: "Eu acho que liderança é sobre controle..."       │     │
│  │ Mestre: "O que acontece quando o controle não é          │     │
│  │         possível?"                                       │     │
│  │ [+ depth marker: camada 3 → 4]                           │     │
│  │ [+ pattern: pensamento dicotômico]                       │     │
│  │ ...                                                      │     │
│  └─────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

**Nota**: Tab "Conversa" mostra o transcript com **anotações inline do Detector** (depth markers, padrões detectados) como badges discretos entre as mensagens. Útil para o gestor entender o contexto das análises.

#### Resumo de Rotas e Componentes

**Novas rotas**:

| Rota | Tipo | Dados | Acesso |
|---|---|---|---|
| `/analytics` | RSC + Client | Agregados da turma/área (UC3) | manager |
| `/analytics/students/[studentId]` | RSC + Client | Perfil individual (UC2) | manager |
| `/analytics/sessions/[sessionId]` | RSC + Client | Análise de sessão (Detector) | manager |

**Novos componentes** (todos em `apps/web/src/components/analytics/`):

| Componente | Tipo Atomic | Usa |
|---|---|---|
| `AnalyticsDashboard` | Template | Filtros + grid de gráficos |
| `SummaryCardsRow` | Organism | StatCard existente |
| `DepthDistributionChart` | Molecule | recharts BarChart |
| `KolbTeamScatter` | Molecule | recharts ScatterChart |
| `CognitivePatternsChart` | Molecule | recharts BarChart (horizontal) |
| `EmotionalJourneyChart` | Molecule | recharts AreaChart |
| `AlertAttentionList` | Organism | Card + Badge |
| `DivergenceComparisonTable` | Organism | DataTable + Badge |
| `StudentProfilePage` | Template | Tabs + subcomponentes |
| `StudentProfileHeader` | Organism | Card + Avatar + Badge |
| `KolbScatterPlot` | Molecule | recharts ScatterChart (individual) |
| `DivergenceTable` | Molecule | DataTable + Badge |
| `CognitivePatternBars` | Molecule | recharts BarChart |
| `DepthProgressionChart` | Molecule | recharts LineChart |
| `SessionHistoryTable` | Molecule | DataTable + link |
| `GestorRecommendations` | Molecule | Card + lista |
| `SessionAnalysisPage` | Template | Tabs + subcomponentes |
| `SessionHeader` | Organism | Card + badges |
| `CognitiveAnalysisPanel` | Organism | Card + listas |
| `SessionJourneyChart` | Molecule | recharts LineChart + anotações |
| `SessionMetricsPanel` | Organism | Card + métricas |
| `AnnotatedTranscript` | Organism | ChatMessageList + badges inline |

**Novos endpoints API**:

| Endpoint | Método | Retorno |
|---|---|---|
| `GET /api/analytics/aggregate` | RSC ou API | UC3 data (filtros: period, courseId, areaId) |
| `GET /api/analytics/students/[id]` | RSC ou API | UC2 data (perfil + detector agregado + sessões) |
| `GET /api/analytics/sessions/[id]` | RSC ou API | Detector + Perfilador + métricas da sessão |

**Dashboard existente (`/dashboard`) — alterações mínimas**:

| Alteração | Tipo |
|---|---|
| Adicionar 2 StatCards socrático (Prof. Média, Breakthroughs) | Estender `summary-cards` |
| Adicionar colunas socrático na `course-analytics-table` | Estender DataTable |
| Link "Ver análise completa →" para `/analytics` | Simples anchor |

> **Nota sobre reutilização**: O `EngagementChart` existente será **reutilizado** no `/analytics` (migrado, não duplicado). Os componentes `PeriodFilter` e `CsvExportButton` existentes serão reutilizados nas novas páginas.

---

## 17. Estratégia de Testes

### 17.1 — Visão Geral

O novo pipeline tem complexidade significativamente maior que o antigo (5 agentes, 2 providers, 3 planos, pipeline paralelo). A estratégia de testes cobre 3 camadas:

```
┌─────────────────────────────────────────────────────┐
│  CAMADA 3: E2E (Playwright + MSW multi-handler)     │
│  Fluxo completo: login → sessão → analytics          │
│  Mock: OpenAI + DeepSeek via MSW server-side         │
├─────────────────────────────────────────────────────┤
│  CAMADA 2: Integração (Vitest)                       │
│  Orchestrator v2, Model Router, pipeline completo    │
│  Mock: generateObject do AI SDK                      │
├─────────────────────────────────────────────────────┤
│  CAMADA 1: Unit (Vitest)                             │
│  Schemas Zod, prompts, fixtures, pure functions      │
│  Sem mocks externos                                  │
└─────────────────────────────────────────────────────┘
```

### 17.2 — Identificadores MSW para Novos Agentes

Padrão: prefixo `Eximia_` no system prompt de cada agente (segue convenção `Harven_` existente).

| Agente | Identificador MSW | Fixture |
|---|---|---|
| Mestre | `Eximia_Mestre` | `mestreFixture` |
| Polidor | `Eximia_Polidor` | `polidorFixture` |
| Guardião | `Eximia_Guardiao` | `guardiaoFixture` |
| Detector | `Eximia_Detector` | `detectorFixture` |
| Perfilador | `Eximia_Perfilador` | `perfiladorFixture` |

**Coexistência**: Durante a migração, ambos os conjuntos (`Harven_*` e `Eximia_*`) coexistem no MSW handler. Após migração completa, `Harven_*` são removidos.

```typescript
// apps/web/src/mocks/handlers.ts
function detectAgent(system: string): Record<string, unknown> {
  // Novo pipeline (Eximia)
  if (system.includes("Eximia_Mestre")) return mestreFixture
  if (system.includes("Eximia_Polidor")) return polidorFixture
  if (system.includes("Eximia_Guardiao")) return guardiaoFixture
  if (system.includes("Eximia_Detector")) return detectorFixture
  if (system.includes("Eximia_Perfilador")) return perfiladorFixture

  // Pipeline legado (Harven) — remover após migração
  if (system.includes("Harven_Socrates")) return socratesFixture
  if (system.includes("Harven_Editor")) return editorFixture
  if (system.includes("Harven_Tester")) return testerFixture
  if (system.includes("Harven_Analyst")) return analystFixture
  if (system.includes("Harven_Creator")) return creatorFixture

  return creatorFixture // fallback
}
```

### 17.3 — Mock Multi-Provider (MSW)

O MSW intercepta **2 endpoints** (OpenAI + DeepSeek), ambos usando a mesma lógica de detecção por system prompt:

```typescript
// apps/web/src/mocks/handlers.ts
import { http, HttpResponse } from "msw"

const anthropicLikeHandler = (request: Request) => {
  const body = await request.json()
  const system = extractSystemPrompt(body)
  const fixture = detectAgent(system)

  // Formato OpenAI Chat Completions (usado por ambos providers)
  return HttpResponse.json({
    id: "mock-completion",
    object: "chat.completion",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: JSON.stringify(fixture),
      },
      finish_reason: "stop",
    }],
    usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
  })
}

export const handlers = [
  // OpenAI (Mestre, Guardião, Polidor em planos premium)
  http.post("https://api.openai.com/v1/chat/completions", anthropicLikeHandler),

  // DeepSeek (Polidor, Detector, Perfilador em planos essencial/standard)
  http.post("https://api.deepseek.com/v1/chat/completions", anthropicLikeHandler),

  // Manter handler Anthropic durante migração
  http.post("https://api.anthropic.com/v1/messages", legacyAnthropicHandler),
]
```

**Env vars adicionais** no `playwright.config.ts`:

```typescript
webServer: {
  env: {
    E2E_TESTING: "true",
    ANTHROPIC_API_KEY: "sk-ant-e2e-mock-key-not-real",  // legado
    OPENAI_API_KEY: "sk-e2e-mock-openai-not-real",      // novo
    DEEPSEEK_API_KEY: "sk-e2e-mock-deepseek-not-real",  // novo
  }
}
```

> **Nota**: DeepSeek usa formato OpenAI-compatible (mesmo schema de request/response), então o mesmo handler funciona para ambos. A diferença é apenas a URL interceptada.

### 17.4 — Unit Tests: Model Router (Tabela de Decisão + Fallback)

#### Tabela de Decisão Exaustiva

Testa `getModel(agentId, context)` para cada combinação:

```typescript
// packages/agents/tests/model-router.test.ts
describe("Model Router - Routing Table", () => {
  const cases: Array<[TenantPlan, AgentId, string, string]> = [
    // [plano, agente, provider esperado, modelo esperado]

    // Essencial
    ["essencial", "mestre",     "openai",   "gpt-4.1-mini"],
    ["essencial", "polidor",    "deepseek", "deepseek-chat"],
    ["essencial", "guardiao",   "openai",   "gpt-4.1"],
    ["essencial", "detector",   "deepseek", "deepseek-chat"],
    ["essencial", "perfilador", "deepseek", "deepseek-chat"],

    // Standard
    ["standard", "mestre",     "openai",   "gpt-4.1"],
    ["standard", "polidor",    "deepseek", "deepseek-chat"],
    ["standard", "guardiao",   "openai",   "gpt-4.1"],
    ["standard", "detector",   "deepseek", "deepseek-chat"],
    ["standard", "perfilador", "deepseek", "deepseek-chat"],

    // Premium
    ["premium", "mestre",     "openai", "gpt-4.1"],
    ["premium", "polidor",    "openai", "gpt-4.1-mini"],
    ["premium", "guardiao",   "openai", "gpt-4.1"],
    ["premium", "detector",   "openai", "gpt-4.1-mini"],
    ["premium", "perfilador", "openai", "gpt-4.1-mini"],
  ]

  it.each(cases)(
    "plan=%s agent=%s → provider=%s model=%s",
    (plan, agent, expectedProvider, expectedModel) => {
      const result = getModelSpec(agent, { tenantPlan: plan })
      expect(result.provider).toBe(expectedProvider)
      expect(result.model).toBe(expectedModel)
    }
  )
})

describe("Model Router - Interaction Type Override", () => {
  it("Standard quiz → Mestre uses gpt-4.1-mini", () => {
    const result = getModelSpec("mestre", {
      tenantPlan: "standard",
      interactionType: "quiz",
    })
    expect(result.model).toBe("gpt-4.1-mini")
  })

  it("Standard socratic_dialogue → Mestre keeps gpt-4.1", () => {
    const result = getModelSpec("mestre", {
      tenantPlan: "standard",
      interactionType: "socratic_dialogue",
    })
    expect(result.model).toBe("gpt-4.1")
  })

  it("Premium quiz → Mestre stays gpt-4.1 (no override)", () => {
    const result = getModelSpec("mestre", {
      tenantPlan: "premium",
      interactionType: "quiz",
    })
    expect(result.model).toBe("gpt-4.1")
  })
})

describe("Model Router - Guardião Invariant", () => {
  it.each(["essencial", "standard", "premium"] as TenantPlan[])(
    "plan=%s → Guardião always gpt-4.1",
    (plan) => {
      const result = getModelSpec("guardiao", { tenantPlan: plan })
      expect(result.provider).toBe("openai")
      expect(result.model).toBe("gpt-4.1")
    }
  )
})
```

#### Fallback Chain

```typescript
describe("Model Router - Fallback", () => {
  it("OpenAI down → falls back to DeepSeek", async () => {
    mockOpenAIFailure()  // simula 503
    const result = await getModelWithFallback("mestre", {
      tenantPlan: "standard",
    })
    expect(result.provider).toBe("deepseek")
    expect(result.fallbackUsed).toBe(true)
  })

  it("DeepSeek down → falls back to gpt-4.1-nano", async () => {
    mockDeepSeekFailure()
    const result = await getModelWithFallback("polidor", {
      tenantPlan: "standard",
    })
    expect(result.provider).toBe("openai")
    expect(result.model).toBe("gpt-4.1-nano")
  })

  it("All providers down → throws after max retries", async () => {
    mockAllProvidersFailure()
    await expect(
      getModelWithFallback("mestre", { tenantPlan: "standard" })
    ).rejects.toThrow("AllProvidersUnavailable")
  })
})
```

### 17.5 — Unit Tests: Agentes e Schemas

```typescript
// packages/agents/tests/schemas/
├── mestre.test.ts        // MestreOutput schema validation
├── polidor.test.ts       // PolidorOutput schema validation
├── guardiao.test.ts      // GuardiaoOutput (verdict, score, criteria)
├── detector.test.ts      // DetectorOutput (cognitive_patterns, ai_detection)
└── perfilador.test.ts    // PerfiladorOutput (kolb, engagement, adaptation)

// packages/agents/tests/
├── orchestrator-v2.test.ts  // Pipeline completo: Surface + Shadow
├── model-router.test.ts     // Tabela de decisão + fallback (17.4)
└── prompts/
    ├── mestre-prompt.test.ts     // Prompt inclui Eximia_Mestre identifier
    ├── polidor-prompt.test.ts    // Prompt inclui Eximia_Polidor identifier
    └── ...
```

**Orchestrator v2 — cenários-chave**:

| Cenário | O que testa |
|---|---|
| Happy path (APPROVED) | Mestre → Polidor → Guardião APPROVED, Detector + Perfilador em paralelo |
| Retry 1x (REJECTED → APPROVED) | Guardião REJECTED, feedback loop, APPROVED na 2ª tentativa |
| Max retries (2x REJECTED) | Mantém best response, warning no resultado |
| Shadow parallel | Detector e Perfilador rodam em paralelo à superfície |
| Shadow failure tolerant | Detector falha → superfície continua normalmente |
| Fechamento inteligente | Mestre retorna `should_close: true` → Orquestrador finaliza |

### 17.6 — Fixtures para Novos Agentes

```
apps/web/src/mocks/fixtures/
├── socrates.ts          # legado (manter durante migração)
├── editor.ts            # legado
├── tester.ts            # legado
├── analyst.ts           # legado
├── creator.ts           # legado (WS2 usa)
├── mestre.ts            # NOVO — MestreOutput fixture
├── polidor.ts           # NOVO — PolidorOutput fixture
├── guardiao.ts          # NOVO — GuardiaoOutput (APPROVED)
├── guardiao-rejected.ts # NOVO — GuardiaoOutput (REJECTED, para retry test)
├── detector.ts          # NOVO — DetectorOutput fixture
└── perfilador.ts        # NOVO — PerfiladorOutput fixture
```

Cada fixture segue o schema Zod definido na Seção 6 do documento. Exemplo:

```typescript
// apps/web/src/mocks/fixtures/guardiao.ts
export const guardiaoFixture = {
  verdict: "APPROVED",
  overall_score: 0.88,
  criteria: {
    no_direct_answer: { passed: true, score: 1.0, evidence: "" },
    single_open_question: { passed: true, score: 0.9, evidence: "" },
    depth_appropriate: { passed: true, score: 0.85, evidence: "" },
    natural_language: { passed: true, score: 0.9, evidence: "" },
    respects_resistance: { passed: true, score: 0.8, evidence: "" },
    advances_depth: { passed: true, score: 0.85, evidence: "" },
    feedback_sandwich: { passed: true, score: 0.82, evidence: "" },
  },
  feedback_to_mestre: null,
  recommendation: "Resposta de alta qualidade socrática.",
}
```

### 17.7 — Cenários E2E (Playwright)

#### Onda 1 — Launch (v1)

| ID | Cenário | Spec File | O que valida |
|---|---|---|---|
| **E1** | Sessão socrática completa | `student-journey-v2.spec.ts` | Login → curso → capítulo → 3 mensagens com novo pipeline (5 agentes) → session complete |
| **E2** | Retry do Guardião | `guardian-retry.spec.ts` | 1ª resposta REJECTED (fixture `guardiao-rejected`) → 2ª APPROVED → aluno recebe resposta refinada |
| **E4** | Analytics dashboard UC3 | `manager-analytics.spec.ts` | Login manager → `/analytics` → verifica summary cards + gráficos renderizados + filtros funcionam |

#### Onda 2 — Fast Follow (v1.1)

| ID | Cenário | Spec File | O que valida |
|---|---|---|---|
| **E3** | Fechamento inteligente | `smart-closing.spec.ts` | Mestre retorna `should_close: true` → UI mostra resumo de encerramento |
| **E5** | Perfil do aluno UC2 | `student-profile-analytics.spec.ts` | Manager navega para `/analytics/students/[id]` → 4 tabs renderizam |
| **E6** | Detalhe de sessão | `session-detail-analytics.spec.ts` | Manager navega para `/analytics/sessions/[id]` → análise cognitiva + jornada |
| **E7** | Flag de detecção IA | `ai-detection-flag.spec.ts` | Sessão com `likely_ai` → badge visível no dashboard + perfil |

#### Não em E2E (coberto por unit test)

| ID | Cenário | Cobertura |
|---|---|---|
| **E8** | Multi-plano | Unit test do Model Router (Seção 17.4) — `getModelSpec()` por plano |

### 17.8 — Seed Data para E2E

Extensões ao `tests/e2e/helpers/seed.ts` existente:

```typescript
// Dados adicionais para testes do novo pipeline
const ANALYTICS_SEED = {
  // Sessões com analytics completos (para testar UC2/UC3)
  sessions: [
    {
      id: "00000000-0000-0000-0000-000000000040",
      studentId: TEST_USERS[0].id,  // student@test.com
      chapterId: "00000000-0000-0000-0000-000000000020",
      status: "completed",
      turnNumber: 15,
      analytics: {
        depth_reached: 5,
        breakthrough_moments: 2,
        emotional_journey: ["confused", "curious", "insightful"],
        depth_progression: [1, 2, 3, 3, 4, 5, 4, 5, 5, 5, 6, 5, 5, 5, 5],
        kolb_session_vector: {
          grasping_axis: -0.3,
          transforming_axis: 0.4,
          indicators_count: 8,
        },
      },
    },
  ],
  // Perfil do aluno com dados do Perfilador
  learnerProfile: {
    studentId: TEST_USERS[0].id,
    engagement_style: "reflective",
    reasoning_style: "analytical",
    avg_depth_achieved: 4.8,
    kolb_grasping_axis: -0.2,
    kolb_transforming_axis: 0.3,
    confidence: 0.65,
  },
  // Dados do Detector agregados (para top padrões cognitivos)
  detectorAggregates: [
    { pattern: "pensamento_dicotomico", frequency: 7 },
    { pattern: "generalizacao", frequency: 5 },
    { pattern: "loop_justificacao", frequency: 4 },
  ],
}
```

### 17.9 — Resumo de Cobertura

| Camada | Escopo | Qtd estimada de testes | Framework |
|---|---|---|---|
| Unit — Schemas | 5 schemas Zod (valid + invalid) | ~30 testes | Vitest |
| Unit — Model Router | Tabela 15 combos + override + Guardião invariant + fallback | ~25 testes | Vitest |
| Unit — Orchestrator v2 | 6 cenários pipeline | ~10 testes | Vitest |
| Unit — Prompts | Identifier present + context injection | ~10 testes | Vitest |
| E2E — Onda 1 | E1 + E2 + E4 | 3 specs | Playwright + MSW |
| E2E — Onda 2 | E3 + E5 + E6 + E7 | 4 specs | Playwright + MSW |
| **Total** | | **~82 testes** | |

---

## 18. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Reconstrução total = sem fallback | Alto | Manter branch com código antigo, migração gradual |
| Novo pipeline ter qualidade inferior | Alto | Testes extensivos antes de deletar antigo |
| Custo de API (5 agents por interação) | Médio | Model Router híbrido: -41% custo no plano Standard (Seção 9) |
| Multi-provider (várias API keys) | Baixo | Centralizar em env vars; fallback chain automático |
| Degradação silenciosa de modelo | Médio | Monitoramento contínuo + sampling mensal humano (Seção 10) |
| Qualidade inferior no plano Standard | Médio | Guardião sempre premium; Benchmark obrigatório antes do launch |
| Complexidade de prompts novos | Médio | Iterar prompts com testes A/B |
| Volume de dados analíticos sobrecarrega gestor | Médio | Progressive disclosure (summary → deep dive), filtros granulares |
| Fixtures MSW desincronizam dos schemas | Médio | Fixtures tipadas com Zod schemas; CI falha se schema muda sem atualizar fixture |
| Geração de questões ausente | — | Escopo de WS2 (Course Creator), não WS1 |

---

## 19. KPIs de Sucesso (do benchmark)

```yaml
Métricas de Engajamento:
  - Duração média da sessão: >15 minutos
  - Profundidade média atingida: >4 (de 7)
  - Taxa de retorno: >60% em 7 dias
  - Perguntas por sessão: 8-15

Métricas de Qualidade:
  - Insights autorreportados: >2 por sessão
  - Satisfação do aluno: >4.5/5
  - Progressão de profundidade: crescente
  - Resistência superada: >70%

Métricas de Impacto:
  - Decisões tomadas pós-sessão: 40%
  - Clareza reportada: aumento de 3x
  - Ações concretas geradas: 2-3 por sessão
```

---

*Documento gerado por @architect (Aria) — exímIA Academy*
*Referências teóricas: Benchmarks IA-Socrática (uso interno apenas)*
