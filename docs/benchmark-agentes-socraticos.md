# Benchmark: Agentes Socraticos exímIA Academy

**Data:** 2026-02-07
**Autor:** Atlas (Analyst Agent)
**Fonte:** `Benchmarks/Agentes/` — 6 agentes validados
**Origem:** Agentes criados para a **universidade parceira** como sistema de IA socrática integrado ao Moodle
**Objetivo:** Mapear capacidades, arquitetura e contratos dos agentes para **produtizar** como plataforma corporativa SaaS (exímIA Academy)

---

## 1. Visao Geral do Sistema Multi-Agente

### Arquitetura de Pipeline

```
                          ┌─────────────┐
                          │ CEO         │  (Orquestrador - NAO incluso no benchmark)
                          │ (a construir│
                          │  na plataforma)
                          └──────┬──────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
          v                      v                      v
   ┌─────────────┐     ┌─────────────┐        ┌─────────────┐
   │  CREATOR    │     │  ANALYST    │        │  ORGANIZER  │
   │  (CreatorOS)│     │ (AnalystOS) │        │(OrganizerOS)│
   │  Score: 9.4 │     │  Observador │        │ Persistencia│
   └──────┬──────┘     └──────┬──────┘        └──────┬──────┘
          │                   │                      │
          │ Perguntas         │ Metricas + Flags     │ Save/Export
          v                   │                      │
   ┌─────────────┐           │                      │
   │  SOCRATES   │◄──────────┘                      │
   │  (SocratOS) │  Analisa msg do aluno            │
   │  Score: 9.2 │                                  │
   └──────┬──────┘                                  │
          │                                         │
          │ Resposta bruta                          │
          v                                         │
   ┌─────────────┐                                  │
   │   EDITOR    │                                  │
   │  (EditorOS) │                                  │
   │  Score: 9.3 │                                  │
   └──────┬──────┘                                  │
          │                                         │
          │ Resposta polida                         │
          v                                         │
   ┌─────────────┐                                  │
   │   TESTER    │                                  │
   │  (TesterOS) │                                  │
   └──────┬──────┘                                  │
          │                                         │
          ├── APPROVED ──► Aluno ──────────────────►│
          │                                         │
          └── REJECTED ──► Loop back ao SOCRATES    │
```

### Dois Fluxos Distintos

| Fluxo | Trigger | Pipeline | Resultado |
|-------|---------|----------|-----------|
| **Geracao de Perguntas** | Professor publica conteudo | Conteudo → CREATOR → Banco de Perguntas | Ate 3 perguntas socraticas por capitulo |
| **Dialogo Socratico** | Aluno responde pergunta | Msg → ANALYST → SOCRATES → EDITOR → TESTER → Aluno | Resposta socratica validada |

---

## 2. Benchmark Individual dos Agentes

### 2.1 CreatorOS — Gerador de Perguntas

| Atributo | Valor |
|----------|-------|
| **Score de Validacao** | 9.4/10 (mais alto) |
| **Tier** | 3 |
| **Dominio** | Geracao de Perguntas Socraticas |
| **Mentores** | Socrates, Benjamin Bloom, Grant Wiggins |

**O que faz:**
- Analisa conteudo educacional de um capitulo
- Identifica conceitos-chave e relacoes
- Gera ate 3 perguntas socraticas de alta qualidade
- Enriquece com metadados: `skill`, `intention`, `expected_depth`, `citations`
- Rejeita automaticamente perguntas genericas

**Skills das perguntas geradas:**

| Skill | Tipo Cognitivo | Exemplo |
|-------|---------------|---------|
| `analise` | Decomposicao, causa-efeito | "Como se relaciona...", "Por que..." |
| `sintese` | Combinacao, criacao | "Que solucao voce proporia..." |
| `aplicacao` | Uso em contexto novo | "Imagine que voce e um..." |
| `reflexao` | Avaliacao, julgamento | "Que criterios voce usaria..." |

**Antipadroes (NUNCA gera):**

| Proibido | Exemplo | Motivo |
|----------|---------|--------|
| Definicao | "O que e X?" | Exige memoria, nao raciocinio |
| Lista | "Quais sao os tipos?" | Memorizacao |
| Sim/Nao | "A tecnologia e importante?" | Fecha dialogo |
| Transcricao | "O que o texto diz?" | Copia, nao compreensao |

**Contrato I/O:**

```json
// INPUT
{
    "chapter_title": "string",
    "chapter_content": "string (conteudo completo)",
    "learning_objective": "string",
    "max_questions": 3
}

// OUTPUT
{
    "analysis": {
        "main_concepts": ["string"],
        "potential_angles": ["string"]
    },
    "questions": [{
        "text": "string (pergunta socratica)",
        "skill": "analise | sintese | aplicacao | reflexao",
        "intention": "string (objetivo pedagogico)",
        "expected_depth": "string (resposta esperada)",
        "common_shallow_answer": "string (resposta rasa tipica)",
        "followup_prompts": ["string"],
        "citations": ["string (bloco de origem)"]
    }],
    "metadata": {
        "questions_generated": "number (1-3)",
        "skills_covered": ["string"],
        "has_practical_scenario": "boolean"
    }
}
```

**KPIs:**
- Perguntas nao-genericas: 100%
- Diversidade de skills: min 2/3 diferentes por batch
- Cenarios praticos: >= 50%
- Metadados completos: >= 95%

**Implicacao para a Plataforma:**
- Precisa de interface para professor fazer upload de conteudo de capitulo
- Precisa de tela de revisao das perguntas geradas antes de ativar
- Banco de dados para armazenar perguntas com todos os metadados
- Gatilho automatico ou manual para geracao de perguntas

---

### 2.2 SocratOS — Orientador Socratico

| Atributo | Valor |
|----------|-------|
| **Score de Validacao** | 9.2/10 |
| **Tier** | 3 |
| **Dominio** | Educacao Socratica e Dialogo Maieutico |
| **Mentores** | Socrates, Paulo Freire, John Dewey |

**O que faz:**
- Conduz dialogos socraticos interativos com alunos
- Fornece feedback construtivo sem dar respostas diretas
- Aprofunda progressivamente o raciocinio
- Conecta teoria a pratica com cenarios reais
- Limitado a 3 interacoes por sessao

**Invariantes (INQUEBRAVEIS):**
1. Nunca da resposta direta
2. Sempre termina com pergunta aberta
3. Sem rotulos artificiais ([Feedback], etc.)
4. Maximo 1 pergunta por resposta
5. Sempre conectado ao tema do capitulo
6. Sempre referencia algo que o aluno disse

**Contrato I/O:**

```json
// INPUT
{
    "session_context": {
        "chapter_content": "string",
        "initial_question": {"text": "string"},
        "interactions_remaining": 3
    },
    "student_message": {
        "content": "string (resposta do aluno)"
    }
}

// OUTPUT
{
    "response": {
        "content": "string (1-2 paragrafos fluidos)",
        "structure": {
            "feedback_paragraph": "string",
            "question_paragraph": "string"
        }
    }
}
```

**Restricoes tecnicas:**
- Max 3 interacoes por sessao
- Formato: 1-2 paragrafos fluidos
- Estrutura: Paragrafo 1 = Feedback | Paragrafo 2 = Pergunta
- Idioma: PT-BR

**Limitacoes declaradas:**
- NAO da respostas diretas
- NAO avalia com notas
- NAO cria conteudo original
- NAO continua alem de 3 interacoes
- NAO substitui professor humano

**Implicacao para a Plataforma:**
- Interface de chat com max 3 turnos por sessao
- Exibir contador de interacoes restantes ao aluno
- Persistir contexto completo da sessao entre turnos
- Passar conteudo do capitulo + pergunta inicial no contexto

---

### 2.3 AnalystOS — Analista de Metricas

| Atributo | Valor |
|----------|-------|
| **Score de Validacao** | N/A (observador silencioso) |
| **Complexidade** | Medium |
| **Dominio** | Quality Analytics & AI Detection |
| **Mentores** | Data Scientist, Linguist, Ethics Advisor |

**O que faz:**
- Analisa CADA mensagem do aluno ANTES de salvar
- Calcula probabilidade de texto gerado por IA (0.0 a 1.0)
- Coleta metricas padronizadas de interacao
- Aplica flags de alerta quando necessario
- Gera relatorio de QA

**Escala de Deteccao de IA:**

| Faixa | Classificacao | Flag |
|-------|---------------|------|
| 0.0 - 0.50 | `likely_human` | Nenhuma |
| 0.51 - 0.70 | `uncertain` | Nenhuma |
| 0.71 - 1.0 | `likely_ai` | `alta_probabilidade_texto_IA` |

**Flags de Alerta:**

| Flag | Condicao |
|------|----------|
| `alta_probabilidade_texto_IA` | probability > 0.70 |
| `resposta_muito_rapida` | time < 10s E length > 200 chars |
| `resposta_muito_curta` | words < 10 |
| `off_topic` | relevance < 0.3 |

**O que NAO e indicador de IA:**
- Copy/paste do material (legitimo)
- Erros de ortografia (indica humano)
- Linguagem informal (indica humano)
- Girias e hesitacoes (indica humano)

**Contrato I/O:**

```json
// INPUT
{
    "student_message": "string",
    "context": {
        "chapter_id": "string",
        "turn_number": "number (1-3)"
    },
    "interaction_metadata": {
        "session_id": "string",
        "timestamp": "ISO 8601"
    }
}

// OUTPUT
{
    "analysis_id": "string",
    "timestamp": "ISO 8601",
    "ai_detection": {
        "probability": "float (0.0-1.0)",
        "confidence": "low | medium | high",
        "verdict": "likely_human | uncertain | likely_ai",
        "indicators": ["string"],
        "flag": "string | null"
    },
    "metrics": {
        "text": {
            "message_length_chars": "number",
            "message_length_words": "number",
            "sentence_count": "number",
            "has_question": "boolean"
        },
        "time": {
            "response_time_seconds": "number"
        },
        "quality": {
            "topic_relevance": "float (0.0-1.0)",
            "depth_of_thought": "float (0.0-1.0)"
        }
    },
    "flags": ["string"],
    "observations": ["string"],
    "recommendation": "string"
}
```

**KPIs:**
- Precisao de deteccao: > 80%
- Falsos positivos: < 10%
- Tempo de analise: < 1s
- ~500 tokens por chamada

**Principios eticos:**
- Dados, nao julgamentos
- Professor decide, nao o agente
- Ferramenta de apoio, nao sentenca
- Copy/paste NAO e fraude

**Implicacao para a Plataforma:**
- Dashboard de professor com metricas por aluno
- Exibicao de flags discretamente (nao para o aluno)
- Armazenar todas as metricas para analytics agregado
- Medir response_time no frontend e enviar ao backend
- Dashboard executivo agregando dados do Analyst

---

### 2.4 EditorOS — Refinador de Respostas

| Atributo | Valor |
|----------|-------|
| **Score de Validacao** | 9.3/10 |
| **Tier** | 2 |
| **Dominio** | Refinamento de Texto Educacional |
| **Mentores** | William Strunk (Elements of Style), George Orwell |

**O que faz:**
- Remove rotulos artificiais do output do Socrates
- Garante estrutura de exatamente 2 paragrafos
- Melhora fluidez e naturalidade
- Preserva 100% do significado original
- Mantem entre 80-200 palavras

**O que remove:**

| Tipo | Exemplos |
|------|----------|
| Rotulos colchetes | `[Feedback]`, `[Pergunta]`, `[Provocacao]` |
| Formatacao | `**Feedback:**`, `*Pergunta:*` |
| Numeracao | `1. Feedback:` `2. Pergunta:` |
| Headers | `## Feedback`, `### Pergunta` |
| Separadores | `---`, `***`, `===` |
| Prefixos | `Tutor:`, `IA:`, `Assistente:` |

**Invariantes:**
1. SEMPRE 2 paragrafos
2. SEMPRE separados por linha em branco
3. SEMPRE termina com ?
4. NUNCA deixa rotulos visiveis
5. NUNCA muda significado do feedback
6. NUNCA troca a pergunta
7. NUNCA adiciona conteudo novo
8. SEMPRE entre 80-200 palavras

**Implicacao para a Plataforma:**
- Este agente e transparente para o aluno — a plataforma nao precisa de UI especifica
- Opera como middleware no pipeline de resposta
- A plataforma deve renderizar o texto final como 2 paragrafos (sem markdown/HTML extra)

---

### 2.5 TesterOS — Validador de Qualidade

| Atributo | Valor |
|----------|-------|
| **Score de Validacao** | N/A (ele valida outros) |
| **Tier** | 2 |
| **Dominio** | QA Socratico |
| **Mentores** | QA Engineer, Critical Thinker |

**O que faz:**
- Valida cada resposta contra 6 criterios rigorosos
- Emite veredicto APPROVED ou REJECTED
- Gera relatorio detalhado por criterio
- Rejeita automaticamente se criterio CRITICAL falha

**Os 6 Criterios:**

| Codigo | Criterio | Severidade | Descricao |
|--------|----------|------------|-----------|
| C1 | Sem Resposta Direta | **CRITICAL** | Nao "entrega" a resposta |
| C2 | Pergunta Aberta ao Final | **CRITICAL** | Termina com ? que exige raciocinio |
| C3 | Feedback Construtivo | MAJOR | P1 comenta resposta do aluno |
| C4 | Sem Rotulos Artificiais | MAJOR | Nenhum artefato visivel |
| C5 | Texto Fluido e Natural | MINOR | Soa como conversa humana |
| C6 | Conexao com Tema | MINOR | Relacionado ao capitulo |

**Regras de veredicto:**
- CRITICAL falhou → REJECT automatico (score = 0)
- MAJOR falhou → REJECT
- MINOR falhou → REJECT se score < 0.7
- Todos OK → APPROVED

**Contrato I/O:**

```json
// INPUT
{
    "edited_response": "string (do Editor)",
    "context": {
        "chapter_title": "string",
        "student_message": "string"
    }
}

// OUTPUT
{
    "verdict": "APPROVED | REJECTED",
    "score": "float (0.0-1.0)",
    "criteria_results": {
        "C1_no_direct_answer": {"passed": "bool", "severity": "CRITICAL", "notes": "string"},
        "C2_open_question": {"passed": "bool", "severity": "CRITICAL", "notes": "string"},
        "C3_constructive_feedback": {"passed": "bool", "severity": "MAJOR", "notes": "string"},
        "C4_no_labels": {"passed": "bool", "severity": "MAJOR", "notes": "string"},
        "C5_natural_flow": {"passed": "bool", "severity": "MINOR", "notes": "string"},
        "C6_topic_connection": {"passed": "bool", "severity": "MINOR", "notes": "string"}
    },
    "summary": {
        "passed_count": "number",
        "failed_count": "number",
        "critical_failures": ["string"],
        "major_failures": ["string"],
        "minor_issues": ["string"]
    },
    "recommendation": "string",
    "observations": ["string"]
}
```

**KPIs:**
- Taxa de aprovacao esperada: 70-85%
- Falsos negativos: < 1%
- Tempo de validacao: < 2s
- Consistencia: > 95%

**Implicacao para a Plataforma:**
- Se REJECTED: a plataforma deve reenviar ao Socrates para reprocessar (loop)
- Definir max retries para evitar loop infinito (sugestao: max 2 retries)
- Armazenar relatorios de QA para analytics de qualidade do sistema
- Dashboard admin mostrando taxa de aprovacao/rejeicao

---

### 2.6 OrganizerOS — Gerenciador de Persistencia

| Atributo | Valor |
|----------|-------|
| **Score de Validacao** | N/A (infraestrutura) |
| **Complexidade** | Medium |
| **Prioridade** | Critical |
| **Dominio** | Data Persistence & Integration |
| **Mentores** | Database Admin, Integration Engineer, DevOps |

**O que faz:**
- Persiste TODA mensagem (aluno e IA) no banco
- Gerencia ciclo de vida das sessoes
- Decrementa contador de interacoes apos cada turno
- Exporta automaticamente para LMS externo ao finalizar
- Gerencia fila de retry para exportacoes falhas

**Estados da Sessao:**

```
[active] ──► [completed] ──► [exported]
    │              │
    v              v
[abandoned]   [export_failed] ──► retry ──► [exported]
```

| Estado | Condicao |
|--------|----------|
| `active` | interactions_remaining > 0 |
| `completed` | 3 interacoes completas |
| `exported` | Enviado para LMS externo com sucesso |
| `export_failed` | Falha na exportacao, na fila de retry |
| `abandoned` | Timeout de inatividade |

**Acoes disponiveis:**

| Acao | Input | Output |
|------|-------|--------|
| `save_message` | session_id, role, content, turn, metadata | message_id, session_status, interactions_remaining |
| `finalize_session` | session_id | export_ready |
| `export_to_moodle` | session_id | success/failure |
| `retry_export` | session_id | success/failure |
| `get_session_status` | session_id | status, details |

**Estrategia de Retry (Backoff Exponencial):**

| Retry | Delay | Acao |
|-------|-------|------|
| 1 | 1 min | Retry automatico |
| 2 | 5 min | Retry automatico |
| 3 | 25 min | Retry + notificar admin |
| 4-10 | 30 min (max) | Retry |
| 10+ | - | Parar de tentar |
| > 7 dias | - | Expirar da fila |

**Dependencias externas:**
- PostgreSQL (persistencia)
- Moodle API (exportacao — a ser substituida pela propria plataforma)
- Redis (opcional, para filas)

**KPIs:**
- Integridade de dados: 100%
- Taxa de exportacao: > 95%
- Latencia de save: < 500ms

**Implicacao para a Plataforma:**
- O Organizer atualmente exporta para Moodle — na exímIA Academy, a persistencia sera NATIVA
- A logica de sessao (estados, contador, retry) deve ser implementada no backend da plataforma
- O agente Organizer pode ser parcialmente substituido por logica de backend, mantendo apenas a interface de persistencia
- O modelo de dados ja esta bem definido nos schemas

---

## 3. Analise Comparativa

### Complexidade e Criticidade

| Agente | Tier | Complexidade | Criticidade | Tokens/call |
|--------|------|-------------|-------------|-------------|
| Creator | 3 | Alta | Alta | ~2000-4000 |
| Socrates | 3 | Alta | Critica | ~1500-3000 |
| Editor | 2 | Media | Media | ~800-1500 |
| Tester | 2 | Media | Alta | ~1000-2000 |
| Analyst | - | Media | Alta | ~500 |
| Organizer | - | Media | Critica | N/A (logica) |

### Maturidade (Scores de Validacao)

| Agente | Score | Observacao |
|--------|-------|-----------|
| Creator | **9.4** | Mais maduro — perguntas de alta qualidade |
| Editor | **9.3** | Muito consistente — regras claras |
| Socrates | **9.2** | Core do sistema — robusto |
| Tester | N/A | Valida outros — implicito na qualidade dos demais |
| Analyst | N/A | Observador silencioso |
| Organizer | N/A | Infraestrutura |

### Interdependencias

```
Creator ──produces──► Questions ──consumed by──► Socrates
Socrates ──produces──► Raw Response ──consumed by──► Editor
Editor ──produces──► Polished Response ──consumed by──► Tester
Tester ──produces──► Verdict ──consumed by──► CEO/Platform
Analyst ──observes──► Student Messages ──produces──► Metrics
Organizer ──persists──► All Messages ──exports to──► LMS
```

---

## 4. Modelo de Dados Consolidado

### Entidades Principais (extraidas dos schemas)

```
Session {
    id: UUID
    student_id: UUID
    chapter_id: string
    question_id: UUID
    status: active | completed | exported | export_failed | abandoned
    interactions_remaining: number (0-3)
    created_at: timestamp
    completed_at: timestamp?
}

Question {
    id: UUID
    chapter_id: string
    text: string
    skill: analise | sintese | aplicacao | reflexao
    intention: string
    expected_depth: string
    common_shallow_answer: string
    followup_prompts: string[]
    citations: string[]
    created_by: "creator_agent"
}

Message {
    id: UUID
    session_id: UUID
    role: student | tutor
    content: string
    turn_number: number (1-3)
    timestamp: timestamp
}

AnalysisReport {
    id: string
    message_id: UUID
    ai_probability: float
    ai_verdict: likely_human | uncertain | likely_ai
    indicators: string[]
    flags: string[]
    metrics: {
        text: { chars, words, sentences, has_question }
        time: { response_time_seconds }
        quality: { topic_relevance, depth_of_thought }
    }
    observations: string[]
}

QAReport {
    id: UUID
    session_id: UUID
    message_id: UUID
    verdict: APPROVED | REJECTED
    score: float
    criteria_results: { C1..C6 }
    recommendation: string
}
```

---

## 5. Restricoes Tecnicas Consolidadas

| Restricao | Valor | Impacto |
|-----------|-------|---------|
| Max interacoes por sessao | **3** | Define UX do chat — nao e infinito |
| Max perguntas por capitulo | **3** | Limita geracao por chamada ao Creator |
| Formato resposta socratica | **2 paragrafos** (feedback + pergunta) | UI deve renderizar nesse formato |
| Tamanho da resposta | **80-200 palavras** | Resposta concisa, nao verbosa |
| Idioma | **PT-BR** | Todos os agentes em portugues |
| Estrutura obrigatoria | **Termina com ?** | Sempre pergunta aberta ao final |
| Score minimo aprovacao | **0.7** | Threshold do Tester |
| Taxa aprovacao esperada | **70-85%** | 15-30% das respostas sao reprocessadas |
| Latencia save | **< 500ms** | Backend performatico |
| Latencia analise | **< 1s** | Analyst nao pode bloquear UX |
| Latencia validacao | **< 2s** | Tester nao pode bloquear UX |

---

## 6. Implicacoes para a Plataforma exímIA Academy

### 6.1 O que a Plataforma PRECISA construir

| Componente | Motivo | Prioridade |
|-----------|--------|-----------|
| **Orquestrador (CEO)** | O CEO nao esta nos agentes — e a cola entre eles | CRITICA |
| **Chat Interface** | UI para o aluno interagir com Socrates (max 3 turnos) | CRITICA |
| **Session Manager** | Gerenciar estados (active→completed→exported), contador | CRITICA |
| **Question Bank** | Armazenar perguntas do Creator com metadados | ALTA |
| **Content Ingestion** | Interface para professor subir conteudo de capitulo | ALTA |
| **Analytics Dashboard** | Exibir metricas do Analyst (professor + gestor) | ALTA |
| **QA Dashboard** | Taxa de aprovacao/rejeicao do Tester para admin | MEDIA |
| **AI Detection UI** | Exibir flags para professor (discretamente) | MEDIA |
| **Retry Queue** | Fila de reprocessamento para respostas REJECTED | MEDIA |

### 6.2 O que a Plataforma SUBSTITUI

| Agente (benchmark) | Na exímIA Academy |
|--------------|-------------------|
| Organizer (export Moodle) | Persistencia nativa — sem exportacao externa |
| CEO (orquestrador) | Backend da plataforma orquestra os agentes |
| Organizer (save) | ORM/Repository da plataforma |

### 6.3 O que a Plataforma CONSOME diretamente

| Agente | Consumo | Interface |
|--------|---------|-----------|
| Creator | Enviar conteudo → receber perguntas JSON | API call com chapter_content |
| Socrates | Enviar contexto + msg aluno → receber resposta | API call com session_context |
| Editor | Enviar resposta bruta → receber polida | API call com raw response |
| Tester | Enviar resposta editada → receber veredicto | API call com edited_response |
| Analyst | Enviar msg aluno → receber metricas | API call com student_message |

### 6.4 Fluxo Completo na Plataforma

```
[Professor sobe conteudo]
    │
    v
Platform ──► Creator API ──► Perguntas (salvas no banco)
    │
    v
[Aluno inicia sessao]
    │
    v
Platform cria Session (status: active, interactions: 3)
    │
    v
Platform seleciona Pergunta do banco ──► Exibe ao aluno
    │
    v
[Aluno responde]
    │
    ├──► Analyst API (paralelo) ──► Metricas (salvas)
    │
    v
Platform envia contexto ──► Socrates API ──► Resposta bruta
    │
    v
Platform envia resposta ──► Editor API ──► Resposta polida
    │
    v
Platform envia resposta ──► Tester API ──► Veredicto
    │
    ├── APPROVED: Exibe ao aluno, decrementa contador
    │                 │
    │                 ├── interactions > 0: Aluno responde novamente (loop)
    │                 └── interactions = 0: Sessao completa
    │
    └── REJECTED: Reenvia ao Socrates (max 2 retries)
```

---

## 7. Gaps e Oportunidades Identificados

### Gaps nos Agentes Atuais (para evoluir na plataforma)

| Gap | Descricao | Oportunidade |
|-----|-----------|-------------|
| **Sessao fixa em 3 turnos** | Limitacao rigida — alguns temas precisam de mais | Configuravel por curso/capitulo |
| **Sem memoria entre sessoes** | Cada sessao e independente | Learning Journal conectando sessoes |
| **Sem adaptacao de nivel** | Mesma profundidade para todos | Onboarding calibra profundidade |
| **Sem multimidia** | Apenas texto | Suportar imagens, diagramas no conteudo |
| **Sem colaboracao** | Apenas 1:1 (aluno:IA) | Futuramente: IA mediando grupos |
| **Sem gamificacao** | Nenhum mecanismo de engajamento | Badges por qualidade de reflexao |
| **Export apenas Moodle** | Integracao fixa | Plataforma nativa = sem export |

### Oportunidades de Extensao

| Oportunidade | Base no Agente | Complexidade |
|-------------|----------------|-------------|
| "Prove que Aprendeu" | Socrates (inversao de papeis) | Alta |
| Certificacao por IA | Analyst + Tester (composicao de scores) | Alta |
| Dashboard preditivo | Analyst (metricas agregadas) | Media |
| Auto-tuning de perguntas | Creator + Analytics de respostas | Media |
| Deteccao de frustacao | Analyst (metricas + NLP) | Media |

---

## 8. Resumo Executivo

### Numeros-Chave

| Metrica | Valor |
|---------|-------|
| Total de agentes | 6 |
| Agentes de dialogo (LLM) | 4 (Creator, Socrates, Editor, Tester) |
| Agentes de analise (LLM) | 1 (Analyst) |
| Agentes de infra (logica) | 1 (Organizer) |
| Score medio de validacao | 9.3/10 |
| Max interacoes/sessao | 3 |
| Max perguntas/capitulo | 3 |
| Chamadas LLM por turno do aluno | 4 (Analyst + Socrates + Editor + Tester) |
| Chamadas LLM na geracao de perguntas | 1 (Creator) |

### Insight Principal

Os agentes sao **especializados e composiveis** — cada um tem responsabilidade unica com contratos I/O bem definidos. A plataforma exímIA Academy precisa ser o **orquestrador** (substituindo o CEO do sistema legado) e o **repositorio** (substituindo o Organizer + Moodle), consumindo os 4 agentes de LLM via API.

O modelo de **3 turnos por sessao** e uma restricao de design dos agentes, nao da plataforma — e pode ser parametrizavel no futuro.

---

*Benchmark gerado por Atlas (Analyst Agent) — exímIA Academy v1.0*
