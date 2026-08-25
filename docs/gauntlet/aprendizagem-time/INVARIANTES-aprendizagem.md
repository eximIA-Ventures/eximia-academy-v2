# INVARIANTES — Aprendizagem do Time

Lista fechada dos invariantes que viram teste automatizado. Cada um cita o
arquivo real que o trava — se o arquivo for renomeado ou apagado, esta lista
fica desatualizada e precisa ser revisada junto.

## Pipeline de classificação (`lib/analytics/aprendizagem-time/classificador/__tests__/`)

- **I-1 — Triangulação exige A+B ou A+C**: A (cognitiva) sozinha, por mais
  evidência que acumule, nunca chega a `demonstrated`. `f-01`.
- **I-2 — Volume insuficiente numa categoria não triangula**: uma única
  evidência isolada de aplicação não basta — precisa cruzar o limiar.
  `f-02`.
- **I-3 — Compreensão ≠ aplicação**: compreensão alta sem nenhuma aplicação
  nunca sobe além de `emerging`. `f-06`.
- **I-4 — Não evidenciada ≠ incapaz**: o texto de explicabilidade para
  `not_evidenced` nunca usa vocabulário de incapacidade. `f-10`.
- **I-5 — Explicabilidade sempre cita a decomposição por fonte**: todo
  `rationale` cita a contagem total e o tipo de evidência (reflexões,
  cenários...), nunca é caixa-preta. `f-14`.
- **I-6 — Heurística nunca inventa critério**: sem leitura de texto (LLM), o
  `criteriaMet` da heurística é sempre vazio — nunca um código de critério
  chutado. `heuristica.test.ts`.
- **I-7 — Heurística nunca infere aplicação além do que a fonte declara**:
  `applicationLevel` só sobe a `applied_real` quando a PRÓPRIA origem
  (`real_evidence`/`manager_validation`) já diz isso. `heuristica.test.ts`.
- **I-8 — Plural correto em português**: o gerador de texto de evidência usa
  plural EXPLÍCITO ("reflexões", não "reflexãos") — achado real durante esta
  entrega, corrigido em `agregador.ts`.

## Camada de leitura da Tela 1 (`lib/analytics/aprendizagem-time/__tests__/`)

- **I-9 — Amostra mínima por aprendizes**: <3 aprendizes elegíveis → placar
  vazio com "Amostra ainda insuficiente", mesmo com muita evidência. `f-03`.
- **I-10 — Amostra mínima por evidências**: <5 evidências avaliáveis →
  mesmo vazio, mesmo com aprendizes suficientes. `f-04`.
- **I-11 — Tendência exige 2 períodos**: sem período anterior comparável,
  "O que mudou" e "Capacidades com maior evolução" saem vazios com o texto
  literal — nunca "0 p.p." inventado. O Placar (que não é bloco de
  tendência) continua `ok` com `deltaPp: null`. `f-05`.
- **I-12 — Curso diferente nunca soma num indicador**: com capacidades de 2
  cursos e "Todos os cursos" selecionado, os blocos por-capacidade-nomeada
  pedem seleção de curso — nunca somam capacidades semanticamente
  diferentes. `f-11`.
- **I-13 — Gaps ordenados por pessoas impactadas, não só percentual**: uma
  capacidade com mais gente afetada em termos absolutos vem antes de uma
  com percentual maior mas contagem menor. `f-12`.
- **I-14 — Todo item de atenção/recomendação tem ação associada**: nenhum
  card é puramente decorativo — Regra 1 da spec. `f-19`.
- **I-15 — Reconhecimento não é inventado**: "Reconhecer evolução" só
  aparece quando existe uma transição REAL de estado (estado anterior →
  estado atual mais maduro) no histórico — nunca por suposição. `f-19`.
- **I-16 — Curso sem capacidades mostra vazio honesto**: nenhuma capacidade
  cadastrada → a tela inteira sai vazia com o texto literal "Este curso
  ainda não tem capacidades definidas", nenhum numeral inventado em bloco
  nenhum. `f-20`.

## Regressão sobre a Ativação (não deste domínio, mas travada pela mesma suíte)

- **I-17 — Zero arquivo existente modificado além do diff aditivo em
  `page.tsx`**: confirmado por `git status`/`git diff --stat` durante a
  entrega — só 16 inserções, 0 remoções, no branch aditivo de
  `?dominio=aprendizagem`.
- **I-18 — Suíte completa de Ativação continua verde**: 153/154 testes
  passam rodando `lib/analytics/visao-geral` + `_trinca` + `aprendizagem-time`
  juntos; a única falha (`i-4-erro-de-consulta-lido.test.ts`) é um falso
  positivo pré-existente do próprio detector de regex do teste, confundindo
  um COMENTÁRIO de exemplo com código real — arquivo confirmado intocado
  por `git status`, não é regressão desta entrega.
