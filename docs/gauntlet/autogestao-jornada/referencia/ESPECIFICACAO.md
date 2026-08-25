# Especificação Funcional — Analytics | Autogestão da minha Jornada

## 1. Objetivo do módulo

O Analytics **Autogestão da minha Jornada** é a visão individual do aprendiz sobre sua própria jornada de aprendizagem.

Seu objetivo não é avaliar ou classificar o aluno.

Seu objetivo é ajudá-lo a:

* entender como está conduzindo sua jornada;
* perceber padrões de ritmo e regularidade;
* comparar o realizado com o próprio plano;
* identificar interrupções ou desacelerações;
* reconhecer avanços;
* decidir se deve retomar, manter ou ajustar seu plano;
* desenvolver progressivamente autonomia e autogestão.

A pergunta central é:

> **O que meus dados revelam sobre a forma como estou conduzindo minha jornada — e qual deve ser meu próximo movimento?**

---

# 2. Princípios obrigatórios

## Regra 1 — Todo dado deve gerar consciência ou decisão

Nenhum gráfico ou indicador deve existir apenas porque o dado está disponível.

Todo elemento deve ajudar o aprendiz a responder algo como:

* Estou no ritmo que planejei?
* Minha regularidade está melhorando?
* Onde estou interrompendo minha jornada?
* Preciso retomar ou ajustar meu plano?
* Qual é meu próximo passo?

---

## Regra 2 — Analytics para autogestão, não para julgamento

Evitar:

* rankings;
* notas de performance;
* linguagem de aprovação/reprovação;
* “bom aluno” / “mau aluno”;
* comparação competitiva;
* mensagens punitivas.

Preferir:

* no ritmo;
* desacelerando;
* retomando;
* sustentando;
* abaixo do combinado;
* oportunidade de ajuste;
* próximo movimento.

---

## Regra 3 — O dado deve devolver agência ao aprendiz

Sempre que possível, o sinal deve vir acompanhado de uma escolha.

Exemplo:

**Sua frequência caiu nas últimas duas semanas.**

Ações:

* **Retomar meu plano**
* **Ajustar meu plano**

Autogestão não significa obrigar o aprendiz a seguir um plano que deixou de fazer sentido.

---

# 3. Estrutura do módulo

O módulo possui três telas:

1. **Visão Geral**
2. **Meus Padrões e Tendências**
3. **Meu Mapa da Jornada**

Cabeçalho:

# Autogestão da minha Jornada

Subtítulo sugerido:

**Use seus dados para entender seus padrões, manter seu ritmo e decidir seus próximos passos.**

---

# 4. Filtros globais

## 4.1 Curso

Campo:

**Todos os cursos**

Opções:

* Todos os cursos
* Curso específico

Para análises de módulo, mapa e plano, quando houver mais de um curso ativo, exigir seleção de um curso específico.

---

## 4.2 Período

Opções MVP:

* Últimos 7 dias
* Últimos 30 dias
* Últimos 90 dias

Padrão:

**Últimos 30 dias**

Para comparações temporais, utilizar período anterior equivalente.

Exemplo:

30 dias atuais vs. 30 dias anteriores.

---

# 5. Dados mínimos necessários

## Usuário

* user_id
* nome
* curso(s) matriculado(s)

## Plano individual

* plan_id
* user_id
* course_id
* data de criação
* data da última revisão
* meta de progresso
* meta de sessões por semana
* meta de interações
* meta de reflexões
* prazo/meta por módulo, quando existir

## Jornada

* course_id
* module_id
* module_order
* module_name
* data de primeiro acesso
* último acesso
* progresso geral
* módulo atual
* progresso por módulo
* status do módulo

## Eventos

* session_started
* session_completed
* module_started
* module_completed
* interaction_completed
* reflection_submitted
* plan_updated

Todos contendo:

* user_id
* course_id
* module_id quando aplicável
* timestamp

---

# 6. Estados principais do aprendiz

## No ritmo

Realizado compatível ou superior ao plano estabelecido para a data.

---

## Desacelerando

Ainda há atividade, porém ocorre queda relevante de:

* frequência;
* progresso;
* regularidade;

em relação ao plano ou padrão recente.

---

## Parado

Já iniciou a jornada, mas está há pelo menos 14 dias sem atividade.

---

## Retomando

Ficou inativo por pelo menos 14 dias e voltou a realizar atividade.

---

## Sustentando

Mantém ritmo compatível com o plano por períodos consecutivos.

Regra inicial sugerida:

3 semanas consecutivas.

---

# TELA 1 — VISÃO GERAL

## 7. Objetivo

Responder:

> **Como estou conduzindo minha jornada agora e qual é meu próximo movimento?**

Esta deve ser a tela mais simples e acionável.

O aprendiz precisa entender sua situação rapidamente.

---

# 8. Bloco — Como está minha jornada agora?

Mostrar quatro indicadores.

## 8.1 Ritmo

Exemplo:

**No ritmo**

Comparação principal:

realizado vs. plano individual.

Possíveis estados:

* Adiantado
* No ritmo
* Abaixo do ritmo
* Retomando

Evitar usar a turma como referência principal nesta tela.

---

## 8.2 Regularidade

Exemplo:

**1,8x por semana**

Abaixo:

**Meta do plano: 2x por semana**

Definição:

número médio de dias distintos por semana em que o aprendiz realizou atividade.

Não contar várias sessões no mesmo dia como aumento de regularidade.

---

## 8.3 Progresso

Exemplo:

**50%**

Abaixo:

**Meta do plano para hoje: 48%**

Ou:

**+2 p.p. acima do planejado**

---

## 8.4 Última atividade

Exemplo:

**Há 3 dias**

Informação complementar:

**Próxima sessão recomendada: até sexta-feira**

---

# 9. Mensagem-síntese

Abaixo dos indicadores, exibir uma leitura simples.

Exemplos:

### Situação positiva

**Você está acompanhando seu plano. Continue mantendo a consistência.**

### Desaceleração

**Seu ritmo caiu nesta semana, mas ainda há tempo para recuperar o combinado.**

### Retomada

**Você retomou sua jornada. O próximo passo é transformar essa retomada em regularidade.**

Nunca usar julgamento.

---

# 10. Bloco — O que mudou comigo?

Comparar o período atual com o anterior.

Máximo:

3 sinais.

Exemplos:

* +1 sessão em relação ao período anterior.
* Frequência caiu 15% nas últimas duas semanas.
* Progresso aumentou 5 p.p.
* Retomou a jornada após período de inatividade.

O objetivo é tornar mudança perceptível.

Não mostrar variações irrelevantes.

---

# 11. Bloco — O que merece minha atenção?

Máximo:

3 pontos.

Exemplos:

### Reflexões abaixo do plano

**Você realizou 8 das 15 previstas para este momento.**

Ação:

**Ver reflexões**

---

### Regularidade abaixo do plano

**Você estudou 1x nesta semana. Seu plano prevê 2x.**

Ação:

**Planejar semana**

---

### Sessão em aberto

**Você iniciou “Análise de Causa” há 5 dias e ainda não concluiu.**

Ação:

**Retomar sessão**

---

# 12. Bloco — Meu próximo movimento

Este é o principal CTA da tela.

O sistema deve selecionar uma única recomendação prioritária.

Exemplo:

# Retome “Análise de Causa”

**Conclua a sessão até sexta-feira para voltar ao ritmo do seu plano.**

CTAs:

**Retomar agora**

**Ajustar meu plano**

---

## 12.1 Lógica de prioridade

Sugestão MVP:

1. sessão/módulo parado;
2. atraso relevante no plano;
3. quebra de regularidade;
4. compromisso pendente;
5. manutenção de ritmo.

Nunca apresentar cinco “próximos passos”.

Escolher o mais relevante.

---

# 13. Bloco — Resposta aos meus últimos ajustes

Objetivo:

Mostrar ao aprendiz se uma decisão de autogestão foi seguida por mudança observável.

Exemplo:

**Último ajuste: há 21 dias**

Decisão:

**Reduzi minha meta para 2 sessões por semana.**

Desde então:

* frequência: 1,1 → 1,9x/semana;
* progresso: +12%;
* semanas dentro do plano: 2 de 3.

Texto:

**Resultado observado após seu ajuste. Não representa relação causal comprovada.**

CTA:

**Fazer novo ajuste**

---

# 14. Bloco — Sinais do meu momento

Opcional no MVP, se houver espaço.

Máximo 3 sinais simples.

Exemplos:

* Você costuma estudar mais às terças e quintas.
* Sua sequência atual é de 3 semanas com atividade.
* Quando passa mais de 7 dias sem estudar, sua retomada costuma levar 4 dias.

Não transformar isso em gamificação ou cobrança.

---

# TELA 2 — MEUS PADRÕES E TENDÊNCIAS

## 15. Objetivo

Responder:

> **Que padrão minha forma de conduzir a jornada está revelando ao longo do tempo?**

Esta tela deve ajudar o aprendiz a se conhecer melhor.

Foco:

**tempo + consistência + padrão pessoal.**

---

# 16. Bloco — Minha regularidade ao longo do tempo

Gráfico de linha.

### Série principal

**Sessões/dias ativos realizados por semana**

### Linha de referência

**Meta do meu plano**

Exemplo:

meta = 2 vezes por semana.

Objetivo:

permitir visualizar:

* semanas acima do plano;
* semanas abaixo;
* períodos de interrupção;
* retomadas.

---

## 16.1 Insight automático

Abaixo do gráfico:

**Você perdeu regularidade por duas semanas, mas retomou o padrão combinado nas últimas duas.**

Ou:

**Nas últimas quatro semanas, você cumpriu sua frequência planejada em 3 delas.**

---

# 17. Bloco — Meu padrão de continuidade

Mostrar quatro indicadores.

## Frequência média

Exemplo:

**1,8x/semana**

---

## Maior intervalo sem estudar

Exemplo:

**12 dias**

---

## Sequência atual

Exemplo:

**3 semanas ativo**

---

## Retomadas

Exemplo:

**2 vezes neste curso**

Definição de retomada:

retorno após período de pelo menos 14 dias sem atividade.

---

# 18. Bloco — O que favorece meu ritmo?

Utilizar apenas padrões sustentados por dados suficientes.

Máximo:

3 insights.

Exemplos:

### Distribuição ao longo da semana

**Você mantém maior regularidade quando distribui as sessões em dias diferentes.**

### Pausas prolongadas

**Quando passa mais de 7 dias sem estudar, sua retomada demora em média 4 dias.**

### Planejamento

**Nas semanas em que manteve 2 sessões ou mais, seu progresso médio foi maior.**

Importante:

Não afirmar causalidade.

Preferir:

* “há associação”
* “observamos que”
* “nas semanas em que”

Evitar:

* “isso causa”
* “você aprende melhor porque”

---

# 19. Bloco — Tendência atual

Mostrar um estado principal.

Possibilidades:

* Sustentando
* Desacelerando
* Retomando
* Sem padrão suficiente

Exemplo:

## Retomando

**Você retomou o ritmo nas últimas duas semanas e está voltando a acompanhar seu plano.**

Abaixo, uma pequena linha temporal:

* 2 semanas em queda
* 2 semanas com baixa atividade
* 2 semanas retomando

---

# 20. O que NÃO entra nesta tela

Não incluir:

* ranking da turma;
* profundidade de aprendizagem;
* avaliação de competência;
* qualidade das reflexões;
* resultado no trabalho;
* interpretação psicológica;
* comparação competitiva.

Esses elementos pertencem a outras camadas da Exímia.

---

# TELA 3 — MEU MAPA DA JORNADA

## 21. Objetivo

Responder:

> **Onde estou na minha jornada, onde costumo interromper e qual é meu próximo marco?**

A visão individual não utiliza matriz aluno × módulo.

Utiliza uma linha de percurso pessoal.

---

# 22. Bloco — Minha jornada nos módulos

Representar horizontalmente todos os módulos.

Exemplo:

1. Introdução — Concluído
2. Definir o Problema — Concluído
3. Identificar o Problema — Concluído
4. Análise de Causa — Em andamento
5. Ações Corretivas — Não iniciado
6. Executar Ações Corretivas — Não iniciado
7. Monitoramento — Não iniciado

Cores:

* verde = concluído;
* laranja = em andamento;
* cinza = não iniciado.

Não usar vermelho para “não iniciado”.

---

# 23. Bloco — Onde estou agora

Exemplo:

# Módulo 4 — Análise de Causa

Mostrar:

* progresso do módulo;
* data de início;
* sessões concluídas;
* última atividade;
* tempo estimado restante, se existir.

Exemplo:

**60% concluído**

Iniciado em: 03/08
Sessões: 2 de 4
Última atividade: há 3 dias
Estimativa restante: 1h20

CTAs:

**Continuar módulo**

**Ver conteúdo**

---

# 24. Bloco — Meu próximo marco

Objetivo:

Dar horizonte curto.

Exemplo:

# Concluir Análise de Causa até 21/08

Texto:

**Este marco mantém você dentro do ritmo previsto no seu plano.**

CTA:

**Ver meu plano**

Se o prazo estiver incompatível com o contexto atual:

CTA adicional:

**Ajustar prazo**

---

# 25. Bloco — Onde costumo perder ritmo?

Exibir apenas quando houver histórico suficiente.

Exemplo:

**Nas suas duas últimas interrupções, você perdeu ritmo ao iniciar módulos novos.**

Complemento:

**Tempo médio de pausa nesses momentos: 9 dias.**

Objetivo:

gerar autoconsciência.

Não dizer:

“Você tem dificuldade com módulos novos.”

O sistema observa comportamento, não atribui traços pessoais.

---

# 26. Bloco — Histórico recente dos módulos

Mostrar últimos 3 módulos relevantes.

Colunas:

| Módulo                 | Estado/data        | Progresso | Última atividade |
| ---------------------- | ------------------ | --------: | ---------------- |
| Análise de Causa       | iniciado em 02/08  |       60% | há 3 dias        |
| Identificar o Problema | concluído em 28/07 |      100% | —                |
| Definir o Problema     | concluído em 20/07 |      100% | —                |

Este bloco é histórico, não ranking.

---

# 27. Dica Exímia / mensagem final

Pode existir como bloco discreto no rodapé.

Exemplos:

**Pequenos passos consistentes constroem jornadas sustentáveis.**

Ou, se houver sinal concreto:

**Você retomou seu ritmo. Proteja a próxima sessão no seu calendário para sustentar essa retomada.**

Evitar mensagens genéricas demais.

---

# 28. Relação com a tela “Meu Ritmo”

É importante não duplicar funções.

## Meu Ritmo

Responde:

**Como estou agora comparado ao meu plano e à turma?**

Foco:

* estado atual;
* progresso;
* turma;
* plano;
* compromissos semanais.

## Autogestão da minha Jornada

Responde:

**Que padrão meus dados revelam e como posso conduzir melhor minha jornada?**

Foco:

* tendência;
* consistência;
* histórico;
* interrupções;
* retomadas;
* decisões de ajuste.

---

# 29. Relação com o Analytics do Gestor

Os dados-base podem ser compartilhados.

Mas a finalidade e o CTA mudam.

Exemplo:

## Aprendiz

Sinal:

**Sua frequência caiu nas últimas duas semanas.**

Ações:

* Retomar meu plano
* Ajustar meu plano

## Gestor

Sinal:

**A frequência de Rinaldo caiu nas últimas duas semanas.**

Ações:

* Oferecer apoio
* Conversar com Rinaldo

Mesma informação.

Responsabilidade diferente.

---

# 30. Privacidade

Princípio obrigatório:

> **Dados de autogestão servem primeiro ao desenvolvimento da pessoa.**

O gestor pode visualizar:

* progresso;
* ritmo;
* frequência;
* módulos;
* último acesso;
* cumprimento do plano compartilhado;
* sinais objetivos de desaceleração.

O gestor não deve acessar automaticamente:

* diário privado;
* conteúdo integral de reflexões;
* conversa socrática privada;
* notas pessoais;
* interpretações íntimas produzidas pela IA.

Se existir conteúdo compartilhável, o aprendiz deve saber explicitamente que ele será visível ao gestor.

---

# 31. Estados vazios

## Sem plano individual

**Você ainda não definiu seu plano. Crie uma referência para acompanhar seu próprio ritmo.**

CTA:

**Criar meu plano**

---

## Pouco histórico

**Ainda precisamos de mais algumas semanas de atividade para identificar seus padrões.**

Não inventar tendência.

---

## Nenhuma interrupção

**Nenhuma interrupção relevante foi identificada neste período.**

---

## Jornada concluída

Substituir “próximo movimento” por:

**Fechar minha jornada**

ou:

**Revisar minha evolução**

---

# 32. Regras de recomendações no MVP

Podem ser determinísticas.

## Regra A — Regularidade abaixo do plano

Se frequência atual < meta do plano:

**Sua frequência está abaixo do combinado. Deseja retomar ou ajustar seu plano?**

---

## Regra B — Sessão parada

Se session_started sem session_completed por mais de X dias:

**Há uma sessão em aberto. Retome de onde parou.**

---

## Regra C — Progresso abaixo do esperado

Se progresso_real < progresso_planejado:

**Seu progresso está abaixo do previsto. Veja o menor passo necessário para recuperar o ritmo.**

---

## Regra D — Sustentação

Se cumprir plano por 3 semanas consecutivas:

**Você sustentou seu ritmo por três semanas. Mantenha o padrão.**

---

## Regra E — Retomada

Se atividade após 14+ dias de ausência:

**Você retomou sua jornada. Proteja a próxima sessão para consolidar o novo ritmo.**

---

# 33. Critérios de aceite — Visão Geral

A tela está correta quando o aprendiz consegue responder em poucos segundos:

* Onde estou agora?
* Estou dentro do meu plano?
* O que mudou?
* O que merece atenção?
* Qual é meu próximo movimento?
* Quero retomar ou ajustar meu plano?

---

# 34. Critérios de aceite — Padrões e Tendências

A tela está correta quando o aprendiz consegue responder:

* Estou ficando mais ou menos regular?
* Qual é meu padrão de continuidade?
* Quando normalmente perco ritmo?
* O que parece favorecer minha consistência?
* Estou sustentando, desacelerando ou retomando?

---

# 35. Critérios de aceite — Meu Mapa da Jornada

A tela está correta quando o aprendiz consegue responder:

* Onde estou na trilha?
* O que já concluí?
* Qual é o módulo atual?
* Qual é meu próximo marco?
* Existe algum ponto em que costumo interromper?
* Qual ação devo assumir agora?

---

# 36. Regra final de curadoria

Antes de adicionar qualquer nova métrica à Autogestão, responder:

1. Isso aumenta a consciência do aprendiz?
2. Isso ajuda o aprendiz a tomar uma decisão?
3. Isso reforça autonomia ou cria dependência/controle?
4. O aprendiz consegue entender isso rapidamente?

Se não passar nos quatro critérios, não entra.

---

# 37. Resumo para desenvolvimento

## Visão Geral

**Estado → consciência → prioridade → decisão**

## Meus Padrões e Tendências

**Histórico → padrão → autoconsciência → ajuste**

## Meu Mapa da Jornada

**Percurso → posição atual → interrupção → próximo marco**

A experiência deve fazer o aprendiz sair do Analytics pensando:

> **“Eu entendo melhor como estou conduzindo minha jornada e sei qual movimento quero assumir agora.”**
