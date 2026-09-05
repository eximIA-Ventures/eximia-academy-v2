# Course Designer

O Course Designer é a porta pela qual um curso nasce sem ninguém escrever um capítulo. O gestor responde seis passos sobre o que quer ("qual comportamento deve mudar", "quem é o aluno", "quantas horas eu tenho") e a IA devolve um **blueprint pedagógico**: módulos sequenciados, objetivos em formato ABCD, avaliações alinhadas 1:1 com os objetivos, tempo distribuído por etapa e um scorecard de qualidade que diz se aquilo presta.

O que ele entrega não é o curso, é a planta do curso. Existe um segundo movimento, explícito e separado, que transforma o blueprint aprovado em curso real com capítulos e questões. Essa separação é o desenho: a planta é barata de rejeitar, o curso não.

Esta feature é a única do produto que atravessa quatro fronteiras de código, incluindo uma fronteira de linguagem. Nenhum README técnico sozinho mostra o caminho inteiro, e é por isso que este documento existe.

---

## As quatro fronteiras

| Parte | Papel |
|---|---|
| `apps/web` | A superfície. O wizard de 6 passos em `courses/new/design`, as rotas `/api/course-designer/*` que autenticam, limitam taxa e persistem, e o visualizador do blueprint pronto. |
| `packages/course-designer` | O cérebro pedagógico. Os cinco agentes (Analyzer, Architect, Calculator, Validator, Generator), o registro de frameworks, as sete regras de neurociência e o mapeamento Bloom para tipo de interação. Não sabe nada de HTTP nem de banco. |
| `packages/agents` | O maestro. O `designCourse` que encadeia as cinco fases, aplica o quality gate, controla timeout e abort, mais o roteador de modelo que decide qual LLM atende cada papel. |
| `microservice/` | Um serviço FastAPI em Python que gera blueprints por conta própria. **Não participa do fluxo vivo.** A seção [O microserviço Python](#o-microserviço-python-o-que-ele-é-de-verdade) explica o que ele é de fato. |

---

## O fluxo real, ponta a ponta

A ordem importa aqui porque ela contraria a leitura natural da árvore de diretórios. Existe um microserviço Python com container próprio, healthcheck e URL injetada no ambiente do web, e mesmo assim **ele não é chamado em nenhum ponto da geração**. O pipeline roda inteiro em TypeScript, dentro do processo do Next.

```
/courses/new  (cartão "Designer de Blueprint")
      |
      v
/courses/new/design  ........................  wizard de 6 passos
      |                                        valida com courseDesignerInputSchema
      |                                        (o MESMO schema do package)
      v
POST /api/course-designer/generate  .........  auth + role + rate limit
      |                                        cria blueprint_generation_jobs
      |                                        abre stream SSE
      v
designCourse()  (packages/agents/.../orchestrator.ts)
      |
      +--> Fase 1  runAnalyzer    \
      +--> Fase 2  runArchitect    |  packages/course-designer
      +--> Fase 3  runCalculator   |  tudo em processo, sem rede interna
      +--> Fase 4  runValidator    |
      +--> Fase 5  runGenerator   /
      |
      v
grava course_blueprints + blueprint_modules  (Supabase, service role)
fecha o job, dispara webhook blueprint.generated
      |
      v
redirect  /courses/{blueprintId}/blueprint
```

Alguns pontos do caminho que só aparecem lendo o código:

**O schema é compartilhado literalmente.** O wizard importa `courseDesignerInputSchema` de `@eximia/course-designer` e usa como resolver do react-hook-form; a rota importa o mesmo schema e faz `.parse()` no corpo. A validação do cliente e a do servidor não são duas implementações que precisam ser mantidas em sincronia, são a mesma linha de código executada em dois lugares.

**O progresso vem por SSE, não por polling.** A rota devolve um `ReadableStream` com heartbeat de 15 segundos, e cada fase concluída emite um evento com `phase`, `status` e `progress_pct`. O wizard lê o stream e troca a tela pelo componente de progresso. Em paralelo, cada evento também atualiza a linha do job no banco, o que dá um segundo canal de leitura para quem fechou a aba.

**Fechar a aba cancela a geração.** O `cancel()` do stream dispara um `AbortController` que o orquestrador checa entre as fases. O job é marcado como cancelado com os resultados parciais preservados em `phase_results`, e o orquestrador aceita um `resumeFrom` que permitiria retomar de uma fase concluída. O teto duro é de 5 minutos para o pipeline inteiro.

**Existem dois limites de gasto empilhados.** Três gerações a cada dez minutos por tenant no rate limiter, e o timeout de 5 minutos por execução.

---

## As cinco fases

Cada fase é um agente com prompt próprio e saída validada por Zod. A saída de uma alimenta a seguinte, sem exceção.

| Fase | Agente | O que produz |
|---|---|---|
| 1 | **Analyzer** | Normaliza o input, escolhe o framework (ou aceita o do usuário) e faz o LLM inferir o perfil do aluno: ZPD, estilo Kolb, motivação, andragogia. |
| 2 | **Architect** | Objetivos em formato ABCD com nível de Bloom por módulo, avaliações desenhadas por Backward Design com alinhamento 1:1 e Kirkpatrick L1 a L4, sequência de módulos em Bloom ascendente com currículo espiral, e o Problema-Motor de cada módulo. |
| 3 | **Calculator** | Distribui as horas totais entre módulos e etapas, avalia carga cognitiva contra a CLT de Sweller e quebra os módulos em blocos de 5 a 30 minutos. Tem validação pós-LLM que confere se as somas de tempo fecham. |
| 4 | **Validator** | Checa alinhamento objetivo/avaliação, valida que a progressão de Bloom não cai mais de um nível, audita se todas as etapas do framework estão presentes e emite o Quality Scorecard. |
| 5 | **Generator** | Consolida tudo no JSON final do blueprint e recomenda atividades por etapa. |

### O quality gate

Se o Validator devolver veredito `needs_revision` ou `poor`, o orquestrador **re-executa silenciosamente as fases 2, 3 e 4**, uma única vez, passando as recomendações do Validator como `revisionFeedback` para o Architect. Se ainda assim reprovar, o blueprint sai com `requires_instructor_review = true` em vez de ser descartado. O sistema não insiste e também não esconde: ou corrige, ou entrega marcado.

### O que não é decidido pelo LLM

Vale destacar porque é o ponto mais fácil de errar ao ler o código de cima: o Quality Scorecard não é uma nota que o modelo se dá. A nota final é `framework_score` (70%) mais `neuroscience_score` (30%), e o segundo é **programático**, calculado por sete regras determinísticas em `neuroscience-rules.ts` com pesos que somam 100 (CLT com teto de 5 conceitos novos por módulo, AGES, efeito de espaçamento, prática de recuperação, dual coding). O LLM avalia a aderência ao framework; a camada de neurociência é código que passa ou reprova.

Na mesma linha, o registro de frameworks e o mapeamento de Bloom para tipo de interação (`framework-registry.ts` e `interaction-mapper.ts`) são tabelas fixas, não inferência. Quando um módulo em nível `applying` vira `socratic_dialogue` com 20 turnos, isso veio de uma tabela, e é o ponto onde o Course Designer encosta no [Motor Socrático](./motor-socratico.md).

---

## O microserviço Python: o que ele é de verdade

O diretório `microservice/` contém um serviço FastAPI completo e plausível: rotas `blueprint` e `health`, um `JobManager` com fallback de Supabase para memória, um `BlueprintGenerator` que roda em background task, testes passando e um `SPRINT2_NOTES.md` que descreve a arquitetura. Ele está declarado no `docker-compose.yml` como o serviço `blueprint`, com healthcheck, e o container `web` recebe `BLUEPRINT_MICROSERVICE_URL=http://blueprint:8000`. Do lado TypeScript existem três rotas de proxy em `/api/blueprint/*` e um cliente em `lib/blueprint-client.ts` com polling de job.

Nada disso está no caminho vivo, por dois motivos verificáveis no repositório:

1. **O único consumidor de interface não é renderizado.** `components/blueprint/blueprint-generator.tsx` é quem importa `generateBlueprint` e `pollJobStatus`. Nenhuma página, layout ou componente o referencia. Uma busca por `BlueprintGenerator` fora do próprio arquivo não retorna nada.

2. **O gerador chama um pacote que não existe.** `blueprint_generator.py` monta o input, escreve num arquivo temporário e roda `python -m dialectica` via subprocess, com `cwd` apontando para `microservice/dialectica`. Esse diretório não existe, e nenhum arquivo com "dialectica" no nome existe em lugar algum do repositório. O caminho terminaria em erro de subprocess.

O `SPRINT2_NOTES.md` fecha o argumento sem querer: ele lista como próximo passo "Test with Real DIALECTICA" e coloca a integração com Next.js num Sprint 4 futuro. O microserviço foi escrito, testado contra suas próprias fixtures, e a integração real nunca aconteceu antes de o pipeline ser reescrito em TypeScript. Todo o `microservice/` entrou neste repo num único commit de importação do Academy v1 pré-modular, junto com os packages que o substituíram.

### Por que existe um microserviço Python em vez de tudo em TypeScript

**Não há razão registrada.** Nenhum comentário no código, nenhum ADR, nenhuma seção do `SPRINT2_NOTES.md` justifica a escolha de linguagem. O documento descreve o que foi construído, nunca por quê.

A única razão que o código deixa **inferir** está no subprocess: DIALECTICA era um pacote Python, e o serviço existia para hospedá-lo e expô-lo por HTTP. A fronteira de linguagem não parece ter sido uma decisão de arquitetura, foi consequência de onde o gerador morava. Isso é inferência a partir de uma chamada de subprocess, não fato documentado, e vale tratar como tal.

Com DIALECTICA ausente do repositório e as cinco fases reimplementadas em TypeScript sobre o Vercel AI SDK, a razão implícita caducou. O que resta é infraestrutura viva (um container que sobe, um healthcheck que responde) servindo um caminho que ninguém percorre.

### A costura que sobrou no banco

Esta é a consequência prática da história acima, e a única que afeta o fluxo vivo.

O pipeline TypeScript grava em duas tabelas: `course_blueprints` e `blueprint_modules`. Mas existem outras duas, `blueprint_objectives` e `blueprint_assessments`, criadas pelas migrations e desnormalizadas para leitura rápida. No código TypeScript elas têm **quatro leitores e nenhum escritor**:

| Quem lê | Para quê |
|---|---|
| `courses/[courseId]/blueprint/page.tsx` | Montar o visualizador do blueprint |
| `/api/course-designer/blueprints/[blueprintId]` | Detalhe do blueprint |
| `.../[blueprintId]/export` | Exportação |
| `.../[blueprintId]/apply` | Converter blueprint em curso |

O único escritor dessas tabelas em todo o repositório é `blueprint_generator.py`, no microserviço órfão. Um blueprint gerado pelo caminho vivo nasce com as duas tabelas vazias.

O efeito não é uma quebra dura, e isso é importante: a rota `apply` exige módulos (`if (!modules?.length)` retorna 400) mas trata objetivos com `objectives || []`, então ela roda com a lista vazia e `bloomLevel` nulo. Os objetivos existem, apenas moram dentro do JSON de `blueprint_data` e nas linhas de `blueprint_modules`, não nas tabelas desnormalizadas que estes quatro leitores consultam.

---

## Depois do blueprint

Gerar é metade. O blueprint nasce com status `draft` e precisa de um segundo comando explícito:

- **`POST /api/course-designer/blueprints/[blueprintId]/apply`** transforma o blueprint em curso real com capítulos e questões, via `applyBlueprint` em `packages/agents`.
- **`GET .../export`** exporta o blueprint.
- **`GET /api/course-designer/jobs/[jobId]`** consulta um job de geração, o canal para quem fechou a aba durante o SSE.

Uma pegadinha de rota que vale registrar: o redirect após a geração é `/courses/{blueprintId}/blueprint`, e o segmento dinâmico se chama `[courseId]`. O parâmetro carrega um id de **blueprint**, e a página consulta `course_blueprints` por ele. O nome do segmento mente.

## As outras portas de entrada

O wizard de 6 passos é o caminho principal, mas a mesma maquinaria atende mais três entradas:

| Rota | O que faz |
|---|---|
| `POST /api/course-designer/ai-fill` | Preenche os campos do passo atual com IA, a partir do que já foi respondido. O botão "Preencher com IA" do wizard. |
| `POST /api/course-designer/analyze-content` | Recebe um arquivo (PDF, PPTX, DOCX, TXT), extrai o texto e analisa com LLM para extrair tópicos. Limite de 5 por hora por tenant. |
| `POST /api/course-designer/audit-course` | O Caminho B: audita um curso que já existe, em 7 passos, via o agente Auditor. |
| `GET /api/course-designer/frameworks` | Lista os frameworks disponíveis a partir do registro. |

O acesso ao Course Designer é restrito a `manager`, `admin`, `super_admin` e `instructor`, verificado tanto na página quanto na rota.

---

## Onde ler o código

| | |
|---|---|
| Orquestração e roteamento de modelo | [`packages/agents/README.md`](../../packages/agents/README.md) |
| Pipeline de agentes em geral | [`docs/architecture/ai-pipeline.md`](../architecture/ai-pipeline.md) |
| A feature vizinha que consome o `interaction_type` | [`docs/features/motor-socratico.md`](./motor-socratico.md) |
| O orquestrador das 5 fases | `packages/agents/src/course-designer/orchestrator.ts` |
| Os cinco agentes e as regras | `packages/course-designer/src/` |

`packages/course-designer` e `microservice/` não têm README próprio. Quando existirem, este documento deve apontar para eles em vez de descrever os módulos.
