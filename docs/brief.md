# Project Brief: exímIA Academy

**Versão:** 1.0
**Data:** 2026-02-07
**Autor:** Atlas (Analyst Agent)
**Status:** Draft — Aguardando input da Socratic Engine

---

## Executive Summary

**exímIA Academy** é uma plataforma LMS (Learning Management System) para universidades e academias empresariais que se diferencia pela integração nativa de **IA Socrática** — agentes de inteligência artificial que, através de perguntas provocativas e diálogos guiados, ajudam os alunos a **aplicarem** o conhecimento, não apenas consumi-lo.

**Origem:** O sistema de IA socrática foi criado e validado na **universidade parceira**, com 6 agentes especializados em pipeline (Creator, Socrates, Editor, Tester, Analyst, Organizer) atingindo score médio de 9.3/10 em validação. A missão agora é **produtizar** essa solução como plataforma corporativa SaaS.

**Problema central:** LMS tradicionais medem conclusão de módulos e acerto em provas, mas não garantem que o aluno saiba aplicar o que aprendeu no mundo real.

**Proposta de valor:** Uma plataforma onde aprender é fazer — com IA que desafia, questiona e guia o aluno até a aplicação prática demonstrável. Diferente de competidores, a exímIA Academy já possui **tecnologia de IA socrática validada em produção** numa universidade real.

---

## Problem Statement

### Estado Atual

O mercado de LMS é dominado por plataformas focadas em **entrega de conteúdo** (Moodle, Canvas, Blackboard, Coursera). O ciclo típico é:

1. Aluno assiste aula / lê material
2. Aluno faz prova / quiz de múltipla escolha
3. Plataforma emite certificado baseado em nota

### Problemas Identificados

- **Aprendizado passivo:** 70%+ do tempo é consumo de conteúdo sem aplicação
- **Avaliação rasa:** Provas medem memorização, não competência real
- **Baixo engajamento:** Taxas de conclusão em e-learning corporativo ficam entre 20-30%
- **ROI invisível para gestores:** Empresas investem em treinamento sem métricas de aplicação real
- **Desconexão teoria-prática:** Alunos concluem cursos mas não sabem aplicar no trabalho/profissão

### Por que Soluções Existentes Falham

- Moodle/Canvas: Robustos mas sem inteligência — são repositórios de conteúdo
- Coursera/Udemy: Escala massiva mas experiência genérica, sem personalização
- Plataformas com "IA": Geralmente usam IA para recomendação de conteúdo, não para ensino ativo
- Nenhum concorrente mainstream implementa **método socrático via IA** como núcleo pedagógico

---

## Proposed Solution

### Conceito Core

Plataforma LMS que integra nativamente uma **Socratic Engine** (já desenvolvida) composta por agentes de IA que:

- Fazem perguntas provocativas ao invés de dar respostas prontas
- Adaptam o diálogo ao nível e contexto do aluno
- Guiam para a aplicação prática do conhecimento
- Avaliam competência real através de interação, não provas estáticas

### Diferenciadores-Chave

1. **Socratic Micro-Loops:** Ciclos curtos (aprender → desafio → diálogo socrático → reflexão) integrados ao longo de toda a jornada
2. **"Prove que Aprendeu":** Aluno demonstra domínio ensinando o conceito para a IA, que faz papel de "aluno difícil"
3. **Certificação por Aplicação:** Certificados baseados em evidência de aplicação real, não notas de prova
4. **Dual-Mode (Universidade / Empresa):** UX e fluxos distintos para os dois segmentos
5. **Analytics de Aplicação:** Métricas de ROI para gestores baseadas em competências demonstradas

### Origem e Validação

O sistema de IA socrática foi **criado e validado na universidade parceira**, operando com integração Moodle. Os 6 agentes (Creator 9.4, Socrates 9.2, Editor 9.3, Tester, Analyst, Organizer) foram aprovados em auditoria com score médio 9.3/10. A missão agora é **extrair essa engine do contexto original** e transformá-la numa plataforma corporativa independente.

### O que já existe vs. O que precisa ser construído

| Componente | Status | Origem |
|-----------|--------|--------|
| 6 Agentes de IA Socrática | Validados (9.3/10) | Criados para universidade parceira |
| Contratos I/O (JSON schemas) | Definidos | Criados para universidade parceira |
| Knowledge Bases por agente | Completas | Criadas para universidade parceira |
| Prompts operacionais | Validados | Criados para universidade parceira |
| Plataforma LMS (frontend) | A construir | exímIA Academy |
| Plataforma LMS (backend + orquestrador) | A construir | exímIA Academy |
| Multi-tenant SaaS | A construir | exímIA Academy |
| Analytics & Dashboards corporativos | A construir | exímIA Academy |

> **Nota estratégica:** A universidade parceira pode se tornar o primeiro cliente/case study da plataforma, migrando do Moodle para a exímIA Academy.

---

## Target Users

### Segmento Primário: Alunos (End Users)

**Perfil A — Universitário:**
- Estudantes de graduação e pós-graduação
- 18-35 anos, nativos digitais
- Acostumados com plataformas de e-learning
- Precisam aplicar conhecimento em projetos, estágios e carreira
- Dor: "Passei na prova mas não sei fazer na prática"

**Perfil B — Profissional Corporativo:**
- Colaboradores em programas de treinamento empresarial
- 25-55 anos, variável em maturidade digital
- Tempo limitado, precisam de aprendizado eficiente e aplicável
- Dor: "Fiz o treinamento obrigatório mas não mudou nada no meu dia a dia"

### Segmento Secundário: Gestores (Buyers / Decision Makers)

**Perfil C — Gestor Acadêmico (Coordenador/Reitor):**
- Busca inovação pedagógica e diferenciação institucional
- Precisa de métricas de eficácia do ensino
- Sensível a regulamentações educacionais

**Perfil D — Gestor de RH / T&D Corporativo:**
- Precisa justificar ROI de treinamento
- Busca redução de gap de competências
- Precisa de relatórios executivos para diretoria

### Segmento Terciário: Criadores de Conteúdo

**Perfil E — Professor / Instrutor:**
- Cria e publica cursos na plataforma
- Precisa de ferramentas simples para configurar a IA socrática
- Quer acompanhar o progresso real dos alunos

---

## Goals & Success Metrics

### Business Objectives

- Lançar MVP funcional com 1 curso piloto integrado à Socratic Engine
- Onboardar pelo menos 1 universidade e 1 empresa como pilotos iniciais
- Validar que a IA socrática melhora métricas de aplicação prática vs LMS tradicional
- Estabelecer base técnica escalável (multi-tenant) para crescimento B2B

### User Success Metrics

- Taxa de conclusão de cursos > 60% (vs 20-30% da indústria)
- Alunos que completam pelo menos 3 Socratic Micro-Loops por módulo > 80%
- NPS dos alunos > 50
- Gestores classificam relatórios de ROI como "úteis" ou "muito úteis" > 70%

### Key Performance Indicators (KPIs)

- **Taxa de Engajamento Socrático:** % de alunos que interagem com a IA além do mínimo obrigatório
- **Depth of Reflection:** Qualidade das reflexões no Learning Journal (avaliada por IA)
- **Application Score:** Nota composta de desafios práticos + "Prove que Aprendeu"
- **Time-to-Competency:** Tempo médio para atingir competência demonstrada
- **Gestão — ROI Dashboard Usage:** Frequência de acesso ao dashboard executivo

---

## MVP Scope

### Core Features (Must Have)

- **Estrutura de Cursos:** Criação e organização de cursos com módulos, lições e conteúdo multimídia
- **Socratic Micro-Loops:** Ciclos integrados de conteúdo → desafio → diálogo socrático → reflexão
- **Chat Socrático:** Interface conversacional com a IA integrada ao conteúdo (sidebar ou inline)
- **Onboarding Personalizado:** Wizard que captura perfil, objetivos e estilo de aprendizagem do aluno
- **Multi-tenant Básico:** Isolamento por instituição com branding customizável (logo, cores)
- **Dual-Mode (Empresa/Universidade):** Fluxos distintos para cada segmento
- **Dashboard do Aluno:** Progresso, reflexões, desafios completados, interações com IA
- **Dashboard do Gestor:** Métricas de engajamento, aplicação e progresso por turma/equipe
- **Gestão de Usuários:** Registro, autenticação, roles (aluno, professor, admin, gestor)
- **Integração com Socratic Engine:** Conexão com os agentes e frameworks de IA já desenvolvidos

### Out of Scope for MVP

- Marketplace de conteúdo (professores publicando cursos abertos)
- Simulações imersivas com roleplay
- "Prove que Aprendeu" (v2 — requer rubrica complexa)
- Certificação por IA com validação regulatória
- Integrações com LMS externos (Moodle, Canvas)
- Integrações com RH (SAP SuccessFactors, Workday)
- App mobile nativo / offline-first
- Real-time collaboration (salas de estudo em grupo)
- Gamificação avançada (badges, rankings)
- Edge AI para latência zero

### MVP Success Criteria

O MVP é bem-sucedido quando:
1. Um aluno consegue completar um curso inteiro com Socratic Micro-Loops funcionais
2. A IA socrática mantém diálogos contextuais e provocativos durante toda a jornada
3. Um gestor consegue visualizar métricas de aplicação da sua turma/equipe
4. A plataforma funciona isoladamente para 2+ tenants simultâneos
5. Professor consegue publicar um curso e configurar parâmetros básicos da IA

---

## Post-MVP Vision

### Phase 2 Features

- **Socratic Learning Flow:** Chat + Learning Journal integrados com portfolio de reflexões
- **"Prove que Aprendeu" Challenge:** Inversão de papéis — aluno ensina, IA questiona
- **Certificação por IA:** Certificados baseados em competência demonstrada
- **Gamificação:** Badges e progressão baseados em qualidade de aplicação
- **SDK para Criadores:** Ferramentas para configurar comportamento da IA sem código
- **Templates de Curso:** Modelos pré-configurados por tipo de curso

### Long-term Vision (12-24 meses)

- **Marketplace de Conteúdo:** Ecossistema aberto para criadores com IA socrática acoplada
- **Simulações Imersivas:** Roleplay com IA para treinamentos corporativos (vendas, liderança)
- **Integration Hub:** Conectores com Moodle, Canvas, SAP, Workday
- **App Mobile + Offline:** Acesso universal incluindo contextos com conectividade limitada
- **IA Socrática entre Pares:** Mediação de debates estruturados entre alunos
- **Analytics Preditivos:** IA que prevê risco de abandono e sugere intervenções

### Expansion Opportunities

- **Vertical K-12:** Adaptação para ensino fundamental e médio
- **Vertical Saúde:** Treinamento médico com simulações clínicas via IA
- **Vertical Compliance:** Treinamentos regulatórios com certificação inteligente
- **API/SDK público:** Licenciamento da Socratic Engine para outros LMS
- **Internacionalização:** Suporte multilíngue (PT, EN, ES como prioridade)

---

## Technical Considerations

### Platform Requirements

- **Target Platforms:** Web (desktop e mobile responsive) — MVP web-first
- **Browser Support:** Chrome, Firefox, Safari, Edge (últimas 2 versões)
- **Performance Requirements:** Tempo de resposta da IA < 3s, carregamento de páginas < 2s
- **Disponibilidade:** 99.5% uptime (SLA para clientes B2B)

### Technology Preferences

- **Frontend:** A definir (guias serão fornecidos pelo usuário)
- **Backend:** A definir (guias serão fornecidos pelo usuário)
- **Database:** A definir
- **Hosting/Infrastructure:** A definir

> **Nota:** As decisões de stack técnico serão guiadas pelo usuário. Este brief captura requisitos de negócio; as escolhas técnicas virão nos próximos passos.

### Architecture Considerations

- **Multi-tenant:** Arquitetura que suporte isolamento por instituição desde o dia 1
- **Plugin Architecture:** A Socratic Engine deve se conectar como módulo plugável, não acoplado
- **Event-Driven Analytics:** Captura de eventos de interação aluno-IA para analytics em tempo real
- **API-First:** Backend expondo APIs para futuras integrações (mobile, outros LMS, RH)
- **Security:** Autenticação robusta, dados de alunos protegidos (LGPD compliance)

---

## Constraints & Assumptions

### Constraints

- **Budget:** A definir
- **Timeline:** A definir
- **Resources:** Desenvolvimento guiado por IA (AIOS framework) com supervisão humana
- **Technical:** Socratic Engine já está pronta — a plataforma deve se integrar sem modificá-la

### Key Assumptions

- Os 6 agentes socraticos estão estáveis, validados (9.3/10) e com contratos I/O definidos
- Os agentes operam via system prompts em LLMs (GPT-4, Claude) — sem infraestrutura proprietária
- A universidade parceira pode ser o primeiro cliente/case study da plataforma produtizada
- O público inicial (pilotos) será selecionado e terá acompanhamento próximo
- As universidades brasileiras aceitam IA como ferramenta pedagógica complementar
- Empresas estão dispostas a pagar por LMS que demonstre ROI de treinamento

---

## Risks & Open Questions

### Key Risks

- **Integração com Socratic Engine:** Complexidade de integração pode ser maior que o previsto — mitigação: entender a Engine em detalhe antes de arquitetar
- **Adoção por Professores:** Criadores de conteúdo podem resistir a configurar IA — mitigação: SDK simples + templates pré-configurados
- **Latência da IA:** Diálogos socráticos lentos quebram o flow de aprendizado — mitigação: otimizar chamadas, considerar cache/edge
- **Regulamentação Educacional:** Universidades podem ter restrições para avaliação por IA — mitigação: validar com pilotos antes de escalar
- **Escala Multi-tenant:** Decisões erradas de arquitetura cedo podem impedir escala — mitigação: @architect definir desde o dia 1

### Open Questions

- Qual é a interface (API/SDK) da Socratic Engine? (Será apresentada em breve)
- Qual stack tecnológico será usado? (Guias serão fornecidos)
- Qual é o modelo de precificação (por aluno? por tenant? por feature?)
- Como será o fluxo de criação de conteúdo para o professor?
- Qual é o volume esperado de alunos simultâneos no MVP?
- Há preferência de hosting (cloud provider)?

### Areas Needing Further Research

- Detalhamento da API/interface da Socratic Engine
- Benchmarks de performance para diálogos de IA em tempo real
- Requisitos regulatórios para uso de IA em avaliação acadêmica (MEC)
- Modelos de precificação de concorrentes B2B no Brasil

---

## Appendices

### A. Research Summary — Brainstorming Session

**Data:** 2026-02-07
**Participantes:** PO (Pax), UX (Lumen), Architect (Aria), Dev (Dex), PM (Morgan)
**Resultado:** 33 ideias geradas, 7 categorias, Top 10 priorizadas por ROI

**Top 5 por ROI:**
1. Socratic Micro-Loops (ROI: 2.00)
2. Onboarding Personalizado (ROI: 2.00)
3. Diálogo Socrático em Chat (ROI: 1.67)
4. Multi-tenant com Isolamento (ROI: 1.50)
5. Analytics para Gestores (ROI: 1.50)

**Key Insight:** O diferencial não é ter IA, mas como ela é integrada em loops curtos e frequentes de aplicação prática.

---

## Next Steps

### Immediate Actions

1. **Apresentar a Socratic Engine** — Entender APIs, interfaces e capacidades dos agentes
2. **Receber guias técnicos** — Stack e padrões que o usuário definirá
3. **Handoff para @pm** — Criar PRD detalhado baseado neste brief
4. **Handoff para @architect** — Definir arquitetura técnica com base nos requisitos
5. **Definir curso piloto** — Selecionar conteúdo para o primeiro teste end-to-end

### PM Handoff

Este Project Brief fornece o contexto completo do **exímIA Academy**. O próximo passo é trabalhar com @pm (Morgan) para criar o PRD seção por seção, detalhando features, user stories e critérios de aceite com base neste documento.

---

*Gerado por Atlas (Analyst Agent) — exímIA Academy Project Brief v1.0*
