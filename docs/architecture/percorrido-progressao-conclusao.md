# Arquitetura: Percorrido, Progressão e Conclusão (três medidas, não duas)

**Version:** 1.0
**Created:** 2026-07-31
**Author:** Aria (@architect)
**Status:** Proposto
**Antecessor:** `docs/architecture/medicao-percorrido-vs-elaborado.md` (percorrido, já implementado)
**Escopo:** Desenho. Sem DDL, sem código.

---

## 1. O erro de base

Estamos tentando espremer **três** conceitos em **duas** colunas, e o terceiro
ocupou o nome do segundo.

| Conceito | O que é | Onde está hoje |
|----------|---------|----------------|
| **Percorrido** | Passou pelos slides | Implementado (`chapter_view_progress`) |
| **Progressão** | Interagiu com TODOS os pontos de interação | **NÃO EXISTE** |
| **Conclusão declarada** | Clicou em "Módulo Concluído" ou encerrou uma socrática | Ocupa o nome "Progressão" |

O RPC `update_enrollment_progress` conta, literalmente, *"chapters with at least
one completed session"*. Isso é **conclusão declarada**, não progressão. Uma
socrática num capítulo de 25 slides com 12 reflexões marca o capítulo inteiro
como completo.

Consequência: hoje é possível ter 100% de "progressão" e 0% de percorrido, o que
o dono do produto declarou impossível por definição.

## 2. Modelo conceitual e a invariante de continência

**Requisito de Hugo (2026-07-31), não negociável:**

```
progressão ≤ percorrido        (sempre, para todo aluno, todo curso)
```

Para interagir com todos os pontos é preciso ter passado por todos. O inverso é
livre: percorrer sem interagir é o caso comum e é exatamente o que se quer expor.

| Medida | PROVA | NÃO prova |
|--------|-------|-----------|
| **Percorrido** | A pessoa alcançou os slides | Que leu, entendeu ou elaborou |
| **Progressão** | A pessoa respondeu a todos os pontos de interação | Que a resposta tem qualidade |
| **Conclusão** | Existe registro de encerramento do capítulo | Nada sobre o conteúdo |

### 2.1 A continência precisa ser ESTRUTURAL, não verificada depois

Este é o ponto central do desenho, e ele simplifica tudo:

> **Todo ponto de interação vive num slide. Interagir com ele PROVA presença
> naquele slide.**

Portanto a captura de percorrido deve ser alimentada **também pela interação**,
não só pela navegação. Quando o aluno salva uma reflexão do slide 12, a marca
d'água daquele capítulo sobe para pelo menos 12, pela mesma porta que a
navegação usa.

Com isso, `progressão ≤ percorrido` deixa de ser uma regra a validar e passa a
ser **impossível de violar**: não existe caminho de código que registre
interação sem registrar presença. É o mesmo princípio poka-yoke que o trigger de
invariantes já aplica no banco.

**Bônus:** o backfill retroativo (§7) passa a ser coerente com o modelo em vez de
uma exceção, porque ele deriva presença exatamente de interação.

## 3. Como calcular PROGRESSÃO

### 3.1 O denominador: pontos de interação de um capítulo

| Fonte | Como se descobre | Uso real hoje |
|-------|------------------|--------------:|
| Reflexão de slide | Blockquote no `text_content` que casa com a heurística | 541 registros |
| Interação socrática | `questions` com `status='active'` no capítulo | em uso |
| Quiz | `questions` de tipo quiz | **0** |
| Atividade | `assignment_submissions` | **0** |
| Cenário | `scenario_attempts` | **0** |

**Só dois pontos têm uso real.** Isso torna a primeira versão viável: o
denominador precisa cobrir reflexões e socráticas; quiz, atividade e cenário
entram como extensão prevista, com peso zero enquanto não existirem.

### 3.2 A heurística de reflexão precisa virar DADO

`isReflectionBlock` (`presentation-viewer.tsx:134`) é regex sobre texto, avaliada
**no cliente, em tempo de render**. Cinco padrões, incluindo emoji mais
interrogação. Isso é aceitável para decidir se renderiza um componente. É
**inaceitável** como denominador de uma métrica que define quem concluiu um
treinamento corporativo:

- Não é auditável: ninguém consegue responder "quantos pontos tem este capítulo?"
  sem renderizar a página.
- É instável: editar uma palavra do slide muda silenciosamente o denominador de
  todo mundo, retroativamente.
- Está duplicada: o backfill e a leitura do gestor precisariam reimplementá-la.

**Recomendação:** materializar. Um campo por slide marcando se ele é ponto de
interação e de que tipo, populado a partir do `text_content` pela MESMA
heurística, calculado na escrita do slide (não na leitura), e recalculável por
comando. A heurística continua sendo a fonte, mas o resultado vira fato
consultável e auditável.

### 3.3 Denominador desigual: capítulos sem pontos

Regra: **um capítulo sem nenhum ponto de interação NÃO entra no denominador da
progressão.** Não se pode exigir "interagir com tudo" onde não há nada.

Ele continua contando no **percorrido** (os slides existem e podem ser
percorridos). É por isso que as duas medidas têm denominadores diferentes, e isso
é correto, não uma inconsistência.

```
progressão = pontos de interação respondidos / pontos de interação EXISTENTES
percorrido = capítulos alcançados até o fim / capítulos do curso
```

Caso real: no curso principal, os capítulos 2, 4 e 5 não têm nenhum bloco de
reflexão (0 de 25, 0 de 6, 0 de 4 slides). Pela regra acima, a progressão do
Caio passa a ser medida sobre os 5 capítulos que têm pontos, não sobre 8, e a
distorção que fez ele aparecer com 62% desaparece.

**Efeito colateral importante e desejável:** a régua expõe desigualdade de
conteúdo. Um capítulo sem nenhum ponto de interação é um capítulo que não pede
nada do aluno. Isso é informação de produto, não ruído.

## 4. Substituir ou coexistir? — DECISÃO: coexistir, com renomeação

**Recomendo NÃO trocar o cálculo de `enrollments.progress`.**

### Por quê

| Fator | Peso |
|-------|------|
| `enrollments` é lido por **39 arquivos** | Alto |
| `update_enrollment_progress` é chamado de **4 pontos** | Médio |
| Bater 100% **dispara emissão automática de certificado** (`markChapterComplete` → `issueCertificate`) | **Crítico** |
| **25 de 27** perderiam o status "Concluído" | Alto, cliente pagante |
| `computeStudentRitmo` consome o progresso para decidir "Atrasado"/"No ritmo" | Médio |

Trocar o cálculo do RPC muda comportamento em 39 pontos **de uma vez**, incluindo
a regra de quem ganha certificado. É blast radius alto para uma mudança que não
precisa ser atômica.

### O desenho recomendado

1. **`enrollments.progress` permanece como está**, calculando o que sempre
   calculou. Ele deixa de ser apresentado como "Progressão" e passa a ser o que
   sempre foi: **Conclusão** — o motor do status, do ritmo e do certificado.
2. **Progressão nova é DERIVADA na leitura**, como o percorrido já é. Sem tabela
   nova de agregado, sem percentual armazenado, sem novo caminho de escrita.
3. A tela do gestor passa a mostrar **Percorrido** e **Progressão**, e o selo
   "Concluído" continua vindo da conclusão declarada.

**Resultado:** ninguém perde o "Concluído" da noite para o dia, nenhum
certificado é revogado, e a verdade aparece na coluna Progressão — que vai
mostrar 29% de cobertura média entre os 27 "Concluído". O contraste entre selo
verde e progressão baixa **é o produto**, exatamente como o contraste entre
declarado e percorrido foi na entrega anterior.

**Quando revisitar:** se o dono decidir que "Concluído" deve exigir progressão
completa, a mudança passa a ser de uma linha (a condição de status), com o
cálculo já pronto, medido e visível. Fazer isso **depois** de haver dado é
decidir com evidência; fazer agora é decidir no escuro.

## 5. Blast radius de mexer no que existe

O que este desenho **NÃO** toca, e por decisão:

- `update_enrollment_progress` (RPC): intocado.
- `enrollments.progress`: intocado, 39 leitores preservados.
- `issueCertificate` e a regra de emissão: intocados.
- `computeStudentRitmo` e a coluna Ritmo: intocados.
- `markChapterComplete` e o botão "Módulo Concluído": intocados.

O que muda: acrescenta-se um campo derivado na leitura, e uma coluna na tela.
Aditivo, reversível removendo a coluna.

## 6. Riscos e o que NÃO fazer

| # | Risco | Mitigação |
|---|-------|-----------|
| R1 | Denominador instável: editar texto de slide muda a progressão de todos, retroativamente | Materializar o ponto de interação (§3.2) e versionar; mudança de denominador vira evento visível, não silencioso |
| R2 | Três colunas numéricas na mesma tela viram ruído | Percorrido e Progressão são o par; "Conclusão" fica no selo de Ritmo, não como número |
| R3 | Progressão baixa generalizada (29%) parecer erro do sistema | É o achado, não o defeito. A tela precisa deixar claro que mede resposta a pontos de interação |
| R4 | Capítulo sem ponto de interação sumir da conta e ninguém notar | Expor "N capítulos sem pontos de interação" como sinal de conteúdo, não esconder |

**NÃO fazer:**

1. **Não** trocar o cálculo do RPC nesta entrega. É a mudança de maior blast
   radius e a que menos precisa ser atômica.
2. **Não** revogar status "Concluído" de ninguém retroativamente.
3. **Não** manter a heurística de reflexão avaliada em tempo de render como
   denominador de métrica.
4. **Não** armazenar percentual de progressão. Deriva na leitura, pelo mesmo
   motivo do percorrido: percentual congelado diverge do conteúdo.
5. **Não** exibir progressão sem exibir percorrido ao lado. Separadas, uma
   engana; juntas, contam a história.

## 7. Destino dos 262 registros de backfill

**Manter, e a razão é estrutural:** o backfill deriva presença de interação, que
é exatamente a regra que §2.1 institui como fonte legítima de marca d'água. Ele
deixa de ser exceção e passa a ser um caso do modelo.

A distorção que ele produzia (Caio 62%) vinha do **denominador do percorrido**
contar capítulos onde nenhuma prova era possível — e a §3.3 corrige a origem.

**Recomendação adicional:** distinguir origem (`telemetry` vs `inferred`) no
registro. Não para exibir dois números, mas para que qualquer análise futura
saiba o que é medido e o que é inferido. Sem isso, daqui a seis meses ninguém
lembra que 262 das linhas são piso.

## 8. Sequência de implementação

| Ordem | Entrega | Por que nesta posição |
|:-----:|---------|----------------------|
| 1 | Interação passa a alimentar a marca d'água (§2.1) | Torna a continência estrutural antes de existir métrica que dependa dela |
| 2 | Materializar ponto de interação por slide (§3.2) | Denominador auditável antes de calcular qualquer coisa sobre ele |
| 3 | Cálculo derivado da progressão (§3.3), com testes | Puro, sem I/O, testável isoladamente |
| 4 | Leitura ligada em `getStudentDetails` | Ponto único que serve as três superfícies da tabela |
| 5 | Coluna Progressão ao lado de Percorrido | Só depois de haver número correto para mostrar |
| 6 | Marcar origem dos registros de backfill (§7) | Higiene, não bloqueia nada |

A ordem 1 antes de 3 não é preferência: sem ela, a progressão pode ultrapassar o
percorrido e a invariante quebra na primeira semana.

## 9. Pergunta que permanece de produto

Uma só, e não bloqueia a implementação: **quando "Concluído" passar a exigir
progressão completa?** O desenho acima deixa essa chave pronta para ser virada,
mas recomenda virá-la depois de existir uma série de dados, e não agora.
