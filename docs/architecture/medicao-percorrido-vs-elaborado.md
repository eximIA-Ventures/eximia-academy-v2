# Arquitetura: Percorrido x Elaborado (medição de exposição por módulo)

**Version:** 1.0
**Created:** 2026-07-30
**Author:** Aria (@architect)
**Status:** Proposto (aguarda decisões de produto na §7)
**Escopo:** Desenho. Não contém DDL (é do @data-engineer) nem código de aplicação (é do @dev).

---

## 1. Problema

A coluna "Progresso %" da tabela do gestor não mede leitura nem interação. Ela é
autodeclaração: `markChapterComplete`
(`apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/actions.ts:69`)
insere uma linha em `sessions` com `status:"completed"` e chama o RPC
`update_enrollment_progress`. Quem clica no botão sem ler nada fica com 100%,
indistinguível de quem estudou.

Consequência visível hoje: Caio Pinheiro (100%, engaj. 85, 41 reflexões) e Neusa
Jorge (100%, engaj. 16, 0 reflexões) recebem o mesmo selo "Concluído".

Não existe telemetria de slide. **O dado não é reconstruível retroativamente** —
a duração de `sessions` foi testada como proxy e é inservível (sessões "com
pergunta": mediana 276s mas 47% abaixo de 5s; "sem pergunta": mediana 4831s).
Qualquer medição de exposição começa vazia e só produz série daqui para frente.

## 2. Decisão de produto que baliza o desenho

Definido por Hugo, ponto de partida e não objeto de reavaliação aqui:

- Granularidade: **módulo (capítulo)**, não slide nem curso.
- Um módulo conta como percorrido quando o aluno **alcança o último slide**, não
  quando abre o primeiro. Escolhido por ser resistente a gaming, diferente de
  tempo de tela.
- **Não** criar uma 6ª coluna. Desdobrar a célula "Progresso" em duas leituras:
  **PERCORRIDO** (exposição, dado novo) e **ELABORADO** (engajamento, dado que já
  existe via interações e reflexões).

Restrições herdadas do painel consultado:

| Origem | Restrição |
|--------|-----------|
| Kolb | Exposição mede só o 1º estágio do ciclo. Nunca exibir como sinônimo de conclusão. Nunca virar selo fixo na pessoa. |
| Duke | Toda métrica exibida vira alvo. Tempo de tela é o vetor mais fácil de burlar. Evitar. |
| Ulwick | Outcome crítico: minimizar a probabilidade de tratar como concluído quem não adquiriu a competência. |

---

## 3. ADR-1 — Ponto e mecanismo de captura

### 3.1 Onde o evento nasce

**Decisão: um `useEffect` observando `currentIndex` em `presentation-viewer.tsx`,
não um gancho dentro de `goToSlide`.**

Motivo, verificado no código: existem **dois** caminhos que mudam o slide.

| Caminho | Linha | Natureza |
|---------|-------|----------|
| `goToSlide` | `presentation-viewer.tsx:190` | Navegação deliberada do aluno |
| Auto-advance por timestamp de áudio | `presentation-viewer.tsx:273` (`setCurrentIndex(i)`) | Automático, sem ação do aluno |

Um gancho em `goToSlide` perderia todo o avanço automático. Observar o estado
cobre os dois caminhos por construção, e é imune a novos caminhos que venham a
existir.

### 3.2 O que é gravado: marca d'água, não trilha

**Decisão: gravar apenas o MAIOR índice já alcançado (high-water mark) por par
(aluno, capítulo). Não gravar cada slide visto.**

A pergunta de produto é "ele chegou ao fim do módulo?". Uma trilha slide a slide
responderia perguntas que ninguém fez, ao custo de duas ordens de grandeza a mais
em volume. Com marca d'água, a escrita só acontece quando o índice **avança além**
do máximo já registrado: revisitar slides anteriores não escreve nada.

### 3.3 Transporte

**Decisão: route handler `POST`, com coalescing no cliente e flush garantido.**

Regras do cliente:

1. Escreve só quando o índice supera a marca d'água local.
2. Debounce de ~3s, coalescendo avanços rápidos numa única requisição (folhear
   20 slides em 5 segundos gera 1 escrita, não 20).
3. **Flush imediato e sem debounce** ao atingir o último slide. Esse é o evento
   que define o percorrido; não pode depender de timer.
4. Flush no `visibilitychange`/`pagehide` via `navigator.sendBeacon`, para não
   perder progresso quando a aba fecha.
5. Falha de rede é silenciosa e não bloqueia a navegação. Telemetria nunca
   degrada a aula.

### 3.4 Alternativas descartadas

| Alternativa | Por que não |
|-------------|-------------|
| Server action a cada troca de slide | Server actions são serializadas e revalidam a árvore React. Uma escrita por slide num folhear rápido causaria fila e re-render perceptível no meio da aula. |
| Uma linha por slide visto (`slide_views`) | Volume 25x maior sem responder nenhuma pergunta adicional do produto. Se um dia houver pergunta por slide, a marca d'água não impede criar a trilha depois. |
| Gravar só ao atingir o último slide | Perde quem está no meio do módulo, que é justamente o aluno sobre quem o gestor precisa agir. |
| `sendBeacon` como único mecanismo | Frágil: aba morta, crash de browser ou bateria acabando perdem a sessão inteira. Serve como rede de segurança, não como caminho principal. |
| Medir tempo de permanência | Vetor de gaming apontado pelo painel (basta deixar a aba aberta). Também não distingue leitura de ausência. |

---

## 4. Contrato de dado (para o @data-engineer implementar)

Entidade única, **sem DDL aqui**.

**`chapter_view_progress`** — uma linha por par (aluno, capítulo).

| Campo | Tipo conceitual | Papel |
|-------|-----------------|-------|
| `student_id` | ref → users | Parte da identidade da linha |
| `chapter_id` | ref → chapters | Parte da identidade da linha |
| `tenant_id` | ref → tenants | **Escopo obrigatório**, ver §6 |
| `max_slide_index` | inteiro ≥ 0 | Marca d'água: maior índice alcançado |
| `slides_total_at_last_view` | inteiro > 0 | Snapshot do denominador no momento da escrita. Permite detectar denominador móvel (§5.3) |
| `reached_last_slide_at` | timestamp, nulo | **O sinal que importa.** Nulo até o aluno alcançar o último slide. Uma vez gravado, nunca é apagado |
| `first_viewed_at` | timestamp | Primeira passagem |
| `last_viewed_at` | timestamp | Última escrita |

**Cardinalidade:** unicidade em (`student_id`, `chapter_id`). Escrita é upsert
com avanço monotônico: `max_slide_index` **nunca decresce** (regra no banco, não
só no cliente, porque requisições podem chegar fora de ordem).

**Volume estimado:** 129 usuários × 8 capítulos ≈ 1.000 linhas no tenant demo.
Ordem de grandeza trivial para Postgres.

**Derivado, NÃO armazenar:** percentual percorrido do módulo, percorrido do
curso, e qualquer classificação do aluno. Derivar na leitura evita o problema
clássico de percentual congelado divergindo do conteúdo (que é exatamente a
doença do `enrollments.progress` atual).

---

## 5. Fórmulas

### 5.1 Percorrido do módulo

```
se reached_last_slide_at != null  →  100%
senão                             →  min(100, (max_slide_index + 1) / slides_total_atual × 100)
```

O curto-circuito no `reached_last_slide_at` é o que torna a métrica estável: uma
vez que o aluno chegou ao fim, o módulo está percorrido, independentemente de o
capítulo crescer depois.

### 5.2 Percorrido do curso

```
percorrido_curso = capítulos com reached_last_slide_at != null / total de capítulos do curso
```

Contagem por módulo, coerente com a granularidade que Hugo definiu. Deliberadamente
**não** é a média dos percentuais por módulo: meio-caminho em oito módulos não é
equivalente a quatro módulos percorridos, e tratar como equivalente esconderia
exatamente o padrão que se quer enxergar.

### 5.3 Denominador móvel

O caso real: um capítulo ganha ou perde slides depois que o aluno já passou.

| Situação | Comportamento |
|----------|---------------|
| Capítulo **ganha** slides, aluno já tinha `reached_last_slide_at` | Permanece 100%. O módulo estava completo à época. Rebaixar retroativamente puniria o aluno por uma edição do instrutor. **Ver pergunta aberta P2.** |
| Capítulo **ganha** slides, aluno estava no meio | Percentual cai naturalmente, porque o denominador cresceu. Correto: há mais conteúdo a percorrer. |
| Capítulo **perde** slides | `max_slide_index` pode exceder o total. O `min(100, ...)` da fórmula absorve. |
| Detecção de mudança | `slides_total_at_last_view ≠ slides_total_atual` identifica quem passou por uma versão diferente do capítulo, sem precisar de histórico de versões. |

---

## 6. RLS e multi-tenant

Este repositório tem **histórico real de vazamento cross-tenant** por policies
`FOR ALL` sem recorte de `tenant_id` (`jr_super_admin`, `lt_super_admin`,
`super_admin_all_users`; o @qa provou a escalação apagando cargo de empresa
alheia). A tabela nova nasce escopada, sem exceção.

**Regras não negociáveis:**

1. **Uma policy por comando** (`SELECT`, `INSERT`, `UPDATE`). **Nunca `FOR ALL`.**
   Não existe caso de uso para `DELETE` pelo aluno.
2. **Aluno escreve apenas a própria linha**, e apenas com o próprio `tenant_id`.
   O `tenant_id` do payload **não é confiável**: deve ser resolvido no servidor a
   partir da sessão autenticada, nunca aceito do cliente.
3. **Nunca usar service client** nesta escrita. É escrita do próprio usuário sobre
   o próprio dado; RLS deve valer integralmente. Uso de service client aqui
   reintroduziria a classe de bug que já custou caro neste repo.
4. **Gestor tem apenas `SELECT`**, restrito ao mesmo `tenant_id` e ao próprio
   escopo hierárquico. Reusar o resolver de escopo que já existe
   (`resolveAudienceScoped` e vizinhos em `lib/analytics/`), **não** reimplementar.
5. Validar no servidor que o `chapter_id` pertence ao `tenant_id` da sessão, senão
   um aluno poderia semear linhas apontando para capítulos de outra empresa.
6. Índice de leitura por (`tenant_id`, `chapter_id`) para a consulta do gestor,
   além da unicidade por (`student_id`, `chapter_id`).

---

## 7. Riscos e o que NÃO fazer

### 7.1 Riscos

| # | Risco | Severidade | Mitigação |
|---|-------|:----------:|-----------|
| R1 | **Auto-advance por áudio marca o módulo sem o aluno presente.** O áudio toca sozinho e avança slides por timestamp; a aba pode estar em segundo plano. É o gaming mais provável, e o mais perigoso porque é *acidental*. | Alta | **ACEITO conscientemente** por decisão de Hugo (§8, P1: conta sempre). Mitigação NÃO aplicada. O risco permanece aberto e monitorável pelo gatilho de reabertura descrito em §8. |
| R2 | Métrica começa vazia. Todo aluno aparece com 0% percorrido até voltar a estudar, inclusive quem legitimamente concluiu. | Alta | Decisão de apresentação: exibir "sem dado" e não "0%". Um zero mente; "sem dado" é honesto. |
| R3 | "Percorrido" prova passagem, não leitura. Não medimos tempo por decisão anti-gaming. | Média | Rótulo honesto na UI. Nunca chamar de "estudou" nem de "concluiu". |
| R4 | Quatro sinais quase sinônimos na mesma tela (Ritmo, Progresso, Percorrido, Engajamento) aumentam a carga sem aumentar a decisão. | Média | Por isso a decisão de **não** criar 6ª coluna. Se a célula desdobrada não couber com clareza, o problema é de informação, não de espaço. |
| R5 | Requisições fora de ordem regridem a marca d'água. | Baixa | Monotonicidade garantida **no banco**, não no cliente. |

### 7.2 NÃO fazer

1. **Não** medir tempo de tela ou permanência. Vetor de gaming trivial, e não
   distingue leitura de aba esquecida.
2. **Não** criar linha por slide visto. Volume sem pergunta correspondente.
3. **Não** usar service client na escrita do aluno.
4. **Não** exibir selo, badge ou rótulo classificando a pessoa ("superficial",
   "passivo"). Restrição do Kolb: vira estigma organizacional, não instrumento
   pedagógico. Mostre os dois números e deixe o gestor concluir.
5. **Não** armazenar percentual calculado. Deriva na leitura.
6. **Não** alterar o significado de `enrollments.progress` nesta entrega. É
   trabalho maior e separado (mexe em certificado, relatório e histórico) e
   misturá-lo aqui impediria medir o efeito de qualquer um dos dois.
7. **Não** rebaixar histórico de quem já tem `reached_last_slide_at` sem decisão
   explícita de produto (P2).

---

## 8. Decisões de produto (Hugo, 2026-07-30)

**P1 — Avanço automático por áudio conta como percorrido? → CONTA SEMPRE.**

Decisão de Hugo, **contrária à recomendação da arquitetura** (que era contar apenas
com a aba visível). Registrada aqui como decisão consciente, não como omissão.

Consequência que o desenho assume: o avanço por timestamp de áudio marca o módulo
independentemente de o aluno estar diante da tela. Um aluno que dá play e se ausenta
termina o módulo como percorrido. Isso significa que **"percorrido" mede exposição
oferecida, não atenção comprovada** — e o rótulo na UI precisa refletir isso com
honestidade (ver R3). Implementação fica mais simples: nenhum uso da Page Visibility
API, nenhuma ramificação por origem do avanço.

Gatilho para reabrir: se a série mostrar módulos percorridos com duração de áudio
integral e zero elaboração de forma recorrente, o furo se materializou e vale
reavaliar o recorte por visibilidade.

**P2 — Conteúdo novo rebaixa quem já percorreu? → MANTÉM COMPLETO E SINALIZA.**

Quem tem `reached_last_slide_at` permanece completo. O campo
`slides_total_at_last_view` passa a ter uso funcional, não apenas diagnóstico:
quando diferente do total atual, a leitura expõe "há conteúdo novo desde a passagem
deste aluno". O aluno não é punido por uma edição do instrutor, e o gestor não fica
cego para a novidade.

**P3 — "Percorrido" influencia certificado? (segue em aberto)**
Hoje o certificado é emitido a partir de `enrollments.progress` (autodeclarado).
Se percorrido virar pré-requisito, muda a regra de emissão e afeta quem já tem
certificado emitido. Recomendação: **não acoplar nesta entrega**, tratar como
decisão separada depois de haver série de dados.

---

## 9. Sequência recomendada de implementação

| Ordem | Entrega | Responsável |
|:-----:|---------|-------------|
| 1 | Schema + RLS escopada + índices + regra de monotonicidade | @data-engineer |
| 2 | Route handler de escrita, com resolução de `tenant_id` no servidor | @dev |
| 3 | Captura no viewer (efeito sobre `currentIndex`, debounce, flush, beacon) | @dev |
| 4 | Leitura derivada e desdobramento da célula na tabela do gestor | @dev |
| 5 | Gate adversarial, com prova explícita de isolamento cross-tenant | @qa |

A ordem importa: 1 e 2 antes de 3 significa que a captura começa a colher dado
assim que sobe, mesmo antes de a leitura existir. Como a métrica só vale
prospectivamente (§1), **cada dia de atraso na captura é um dia de série perdido**.
