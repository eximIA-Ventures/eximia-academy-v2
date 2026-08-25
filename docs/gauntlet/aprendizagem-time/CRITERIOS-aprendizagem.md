# CRITÉRIOS — Aprendizagem do Time (régua ESTRUTURAL, não pixel-exata)

Não existe PNG de referência na resolução real do app (1672×941) para este
domínio — só os 3 screenshots conceituais que o Senhor anexou na conversa
(Visão Geral, Padrões e Evolução, Mapa de Capacidades). Por isso esta régua
mede **presença, ordem, vocabulário e correspondência estrutural**, nunca
diff de pixel. Onde existe medição mecânica sem depender de referência
nenhuma (colisão de tinta, corte de conteúdo, ritmo vertical), quem mede é
`scripts/gauntlet-medir.mjs`, já genérico por rota.

Escopo desta rodada (Entrega 2): **só a Tela 1 — Visão Geral**. Telas 2
(Padrões e Evolução) e 3 (Mapa de Capacidades) apareciam nos screenshots 2 e
3, mas não foram construídas ainda — ficam para as Entregas 3 e 4. A seção F
abaixo cobre só o que existe.

---

## E — Estrutura (presença/ordem de bloco)

- **E-01**: A Tela 1 tem, nesta ordem, os blocos: Placar da aprendizagem →
  (O que mudou | O que merece atenção agora?) → (O que fazer agora |
  Capacidades com maior evolução) → Gaps prioritários. Confere com §9-§15 da
  especificação funcional.
- **E-02**: O Placar tem exatamente 4 indicadores: Compreensão, Profundidade,
  Aplicação, Evolução (§9.1-§9.4) — nunca um 5º indicador solto.
- **E-03**: "O que mudou" mostra no máximo 3 sinais (§10 literal: "máximo 3
  sinais"); "O que merece atenção agora?" e "O que fazer agora" mostram no
  máximo 3 itens cada (§11, §13); "Capacidades com maior evolução" mostra no
  máximo 4 linhas (§14); "Gaps prioritários" mostra no máximo 3 (§15).
- **E-04**: A barra de domínio (Ativação da Jornada ⇄ Aprendizagem do Time)
  aparece acima da trinca de vistas, e a trinca de vistas (Visão geral /
  Padrões e evolução / Mapa de capacidades) aparece abaixo do cabeçalho —
  mesma posição relativa dos 3 screenshots.

## V — Vocabulário e cor (nunca herdado de Ativação)

- **V-01**: nenhum texto usa "melhor"/"pior"/ranking de pessoa nomeada
  (Regra 2 da spec) — a Tela 1 não nomeia pessoas em lugar nenhum, só
  capacidades e contagens agregadas.
- **V-02**: os estados de maturidade (quando aparecerem, Tela 3) usam
  cinza/azul/laranja/verde — `TOM_MATURIDADE` em `design.tsx` — nunca
  vermelho (§33). A Tela 1 não usa esses estados diretamente, mas o token já
  está fixado para as telas seguintes não inventarem paleta nova.
- **V-03**: "Amostra ainda insuficiente" (texto literal §7) aparece quando
  `elegiveis < 3` ou `evidenciasAvaliaveis < 5` — nunca um percentual
  calculado sobre poucos casos. Verificado em `f-03`/`f-04`.
- **V-04**: "Ainda não há histórico suficiente para identificar uma
  tendência." aparece quando não há período anterior comparável — nunca
  "0 p.p." inventado. Verificado em `f-05`.
- **V-05**: nenhum texto de "O que mudou" usa "causou" para uma correlação —
  a leitura de mudança é sempre descritiva ("aumentou", "perdeu"), nunca
  causal.

## C — Contraste e legibilidade (mecânico, não de referência)

- **C-01**: tinta de `TOM_ICONE`/`VARIACAO` sobre o próprio fundo ≥ 4.5:1
  (herdado — os mesmos tokens medidos de Ativação, não recalibrados aqui).
- **C-02**: sem colisão de rótulo nem corte de conteúdo nas 3 larguras do
  dono (1366/1440/1512) — medido por `gauntlet-medir.mjs`.

## F — Fidelidade estrutural aos 3 screenshots (Tela 1 apenas)

Observado diretamente nos screenshots anexados pelo Senhor na conversa
original (não inferido de segunda mão):

- **F-01**: o screenshot 1 (Visão Geral) mostra a fileira do Placar como 4
  cards lado a lado, cada um com rótulo + valor grande em % + descrição
  curta abaixo + variação (seta colorida + "pp"). A Tela 1 construída segue
  essa mesma composição por indicador (`IndicadorPlacar` em
  `visao-geral-tab.tsx`).
- **F-02**: "O que mudou" e "O que merece atenção agora?" aparecem lado a
  lado na mesma fileira, logo abaixo do Placar — mesma posição na tela
  construída.
- **F-03**: "O que fazer agora" e "Capacidades com maior evolução" aparecem
  lado a lado, na fileira seguinte — mesma posição na tela construída.
- **F-04**: "Gaps prioritários" ocupa a largura inteira, na última fileira —
  mesma posição na tela construída.
- **F-05**: o cabeçalho do screenshot 1 tem o seletor de escopo ("Meu time"),
  curso e período alinhados à direita do título, na mesma fileira do H1 — a
  moldura construída (`MolduraAprendizagem`) replica essa disposição via
  `FiltrosEscopo` reusado da Ativação.

**Não verificado nesta rodada** (declarado, não omitido): a régua F acima é
uma leitura de memória de quem compôs a tela durante a mesma conversa em que
os screenshots foram anexados — não uma comparação automatizada byte a byte.
O crítico cego formal (Fase 5 do método, comparação A/B por um agente sem
contexto do build) **não rodou**: exige o dev server servindo a rota, e este
ambiente não tem credenciais Supabase configuradas (`.env.local` ausente) —
o middleware global da aplicação bloqueia toda rota com HTTP 500 antes de
qualquer coisa renderizar, mesmo em `?fonte=fixture`. Ver fechamento em
`docs/gauntlet/aprendizagem-time/FECHAMENTO-entrega-2.md`.
