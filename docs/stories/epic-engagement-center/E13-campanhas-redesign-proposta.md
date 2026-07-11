# E13 — Proposta de Arquitetura: Redesign da Aba Campanhas

**Epic:** [00-EPIC-OVERVIEW](./00-EPIC-OVERVIEW.md)
**Status:** PROPOSTA (aguardando aprovação do Hugo antes de qualquer código)
**Autor:** Aria (Architect)
**Data:** 2026-07-10
**Substitui conceitualmente:** [E7 — Aba Campanhas](./E7-aba-campanhas.md) (mantém a base de segurança, muda o modelo mental e a UI)
**Insumo:** painel real (Ulwick, Malouf, Taleb, Duke), não redescoberto aqui

> **Este é um documento de arquitetura, não código.** Nada é implementado. O objetivo é
> o Hugo aprovar o *modelo mental* e o *fluxo* antes de escrever uma linha. Onde eu digo
> "usa a coluna X" ou "reusa a função Y", é porque li o código e confirmei que X/Y já
> existe hoje — não estou inventando infraestrutura.

---

## 0. TL;DR (a resposta honesta primeiro)

**A base de segurança do E7 estava certa e permanece intacta.** O que muda é o modelo
mental (de "disparo em lote uniforme" para "conjunto de ações individuais revisáveis"), a
segmentação de entrada (herda o semáforo unificado em vez de ter tipos próprios), e o
fechamento do loop (a campanha passa a *mostrar quem voltou*, não só *quantas mensagens
saíram*).

**O achado mais importante desta análise:** os três dados que faltavam para fechar o loop
(Ulwick) **já existem no schema e já são computados por um cron**. A coluna
`notifications.returned_at` é preenchida por `/api/cron/notification-efficacy` toda vez que
um aluno tem uma sessão de estudo *depois* da mensagem. A aba Histórico (E8) já deriva
"Acessou depois da mensagem" e já conta "retornaram" a partir dessa coluna. **O loop não
está fechado na aba Campanhas simplesmente porque esse sinal vive na aba errada.** Fechar o
loop é 90% recomposição de primitivos existentes, ~10% infraestrutura nova (uma tabela leve
de "campanha" para agrupar as N notificações de um mesmo disparo).

**Sobre o alerta da Annie Duke (§7):** sim, a proposta reconverge parcialmente para a
arquitetura de segurança do E7 (grupos automáticos + revisão obrigatória + re-scope no
confirm). Isso é validação honesta, não falha — a trava AUTH→VALIDATE→RE-SCOPE→DISPATCH é
correta e seria irresponsável trocá-la. O que é *genuinamente diferente* é a camada acima
dela: o modelo de dados da campanha (variação por destinatário, estado de encerramento) e a
tela de resultado.

---

## 1. Diagnóstico do modelo mental atual (Taleb)

### 1.1 O que o E7 faz hoje

Lendo `campaigns-tab.tsx` + `campaign/route.ts`, o modelo atual é:

```
cohort (tipo único: never_accessed | inactive | behind_teaching_plan | no_reflection | top_performer)
  → wizard de 7 passos
  → 1 mensagem (template OU texto livre), IDÊNTICA para todos
  → preview server-side resolve a lista
  → revisão obrigatória (pode remover ids)
  → confirm dispara dispatchTeamNudge(studentIds, UMA mensagem)
  → tela "done": inAppCreated, emailsSent, emailsFailed, recipientsSkipped
```

### 1.2 Onde o paradigma está torto

Taleb tem razão no núcleo: **a UI trata como Extremistan (poucos disparos grandes e
uniformes, estilo e-commerce) um fenômeno que é Mediocristan** (o gestor cuida de ~40 alunos
um a um). Três sintomas concretos disso no código:

1. **Mensagem única para todos.** `runConfirm` monta `finalIds` e manda *uma* string
   `message` para o lote inteiro. A única "personalização" é `{{primeiro_nome}}`/`{{curso}}`
   substituídos pelo `renderTemplate`. Não existe espaço para "o Venilton nunca começou, mas
   o Artur sumiu há 54 dias estando em dia" — os dois recebem a mesma frase.
2. **O próprio pedido de "templates pessoais por gestor" já denuncia o paradigma errado.** Se
   o fenômeno fosse mesmo disparo de massa uniforme, ninguém pediria variação por gestor. O
   pedido é um sinal de que o gestor quer *falar diferente com cada aluno*, dentro de um
   mesmo ato de organização.
3. **"Done" é terminal e cego.** A tela final mostra contagens de *saída* e o wizard reseta.
   Não há noção de "essa campanha está rodando de X a Y, ainda vou ver se funcionou".

### 1.3 A vantagem que o E7 já tem (não jogar fora)

O E7 **já não usa "audiências salvas"** — ele monta grupos contextuais automáticos (kill
list, Seção 16 da E7). Isso já é meio-caminho para o modelo certo. O grupo automático é a
coisa correta; o que falta é (a) ele herdar o semáforo unificado como fonte, e (b) o
disparo permitir variação por destinatário e fechar o loop.

---

## 2. Novo modelo mental: a Campanha como "lote de ações individuais revisáveis"

### 2.1 A definição

> Uma **campanha** é um ato de organização em que o gestor pega um *segmento do semáforo*
> (ex.: "Sem acesso"), e prepara, de uma vez só, **N ações individuais pré-preenchidas** —
> uma por aluno — que ele revisa e pode ajustar individualmente antes de disparar tudo junto.
> Depois do disparo, a campanha **permanece aberta como um objeto observável** até que se
> possa dizer se funcionou (aluno voltou) e então ela é **encerrada com um resultado**.

Em uma frase: **não é "1 mensagem → N pessoas". É "N ações preparadas de uma vez → revisadas
individualmente → disparadas juntas → medidas juntas".**

### 2.2 Por que isso não vira "40 envios manuais um por um"

A chave é a **variação estruturada, não a redação do zero**. O gestor não escreve 40
mensagens. Ele:

1. Escolhe o segmento (herda o semáforo — §4).
2. O sistema pré-preenche **uma linha por aluno**, cada uma já com:
   - o texto do template renderizado com o contexto *daquele* aluno,
   - o "motivo de inclusão" *daquele* aluno (que hoje já existe: `nudgeTypeReason`),
   - uma sugestão de variação quando o sinal difere (ex.: "nunca acessou" vs "sumiu há 54d").
3. O gestor passa o olho na lista, **ajusta só as que quiser** (editar o texto de uma linha,
   remover um aluno), e o resto vai com o pré-preenchido.

O default é o lote pré-preenchido (velocidade de Extremistan quando serve); a *opção* é o
toque individual (fidelidade de Mediocristan quando importa). É o mesmo princípio do
"bulk-with-exceptions" — 90% do valor da personalização com 10% do trabalho.

### 2.3 Anatomia do objeto Campanha (modelo de dados)

Hoje uma "campanha" **não existe como entidade** — ela é implícita: N linhas em
`notifications` criadas no mesmo `dispatchTeamNudge`, sem nada que as amarre. Para o loop
fechar e a campanha ter estado, precisamos de uma amarração leve. Duas opções:

| Opção | Como | Trade-off |
|:---|:---|:---|
| **A — campaign_id em context** (mínimo) | Gravar um `campaign_id` (uuid gerado no confirm) dentro do `context` jsonb de cada notificação do lote. Zero tabela nova. | Barato, sem migração. Mas "estado da campanha" (aberta/encerrada, janela, resultado) fica sem lar — teria que ser recomputado toda vez agregando as notificações. Sem lugar para "nome da campanha" ou "encerrada pelo gestor". |
| **B — tabela `campaigns` leve** (recomendada) | Uma tabela `campaigns` (id, tenant_id, created_by, segment_type, focus_node, window_start, window_end, status, created_at) + `campaign_id` em `context` das notificações. | Uma migração pequena. Ganha: estado real (aberta/encerrada), janela de medição explícita, nome opcional, e a agregação de resultado vira um join simples. Mantém `notifications` como a fonte de verdade das mensagens individuais. |

**Recomendação: Opção B.** O custo (uma tabela de ~8 colunas, RLS espelhando o padrão de
`notifications`) é baixo, e sem ela o "estado de encerramento" que o Ulwick pede não tem
onde morar. A tabela `campaigns` **não** guarda mensagem nem destinatário — isso continua em
`notifications`, re-scopado como hoje. Ela só guarda o *cabeçalho* do lote e seu ciclo de
vida.

> **Decisão para o Hugo (D1):** aprovar a tabela `campaigns` (Opção B) ou ficar no mínimo
> sem estado persistente (Opção A)? Minha recomendação técnica é B, mas é a única peça de
> infra nova de toda a proposta, então é a decisão que mais merece o seu aval.

---

## 3. Fechamento do loop (Ulwick) — e o dado já existe

### 3.1 A descoberta

Ulwick está certíssimo: o E7 resolve EXECUTAR bem e falha em MONITORAR/CONCLUIR. Mas o dado
para consertar isso **já está no sistema, sem tracking novo**:

- **`notifications.returned_at`** (coluna existente) é preenchida por
  `/api/cron/notification-efficacy` → `markReturnedForSentNudges()`, que carimba a linha
  quando o aluno teve **uma sessão de estudo com `created_at > sent_at`** ("o aluno voltou
  depois da mensagem").
- **`notifications.read_at`** já registra se o aluno *leu* a notificação in-app.
- **`notifications.acted_at`** já existe para "agiu".
- A aba **Histórico (E8) já deriva** `"Acessou depois da mensagem"` (via `resultLabel`, com
  janela conservadora de 3 dias para declarar "Sem resposta") e **já conta `retornaram`** no
  agregado.

**Conclusão:** o loop não está fechado na aba Campanhas porque o sinal de eficácia mora na
aba Histórico. Fechar o loop = trazer esse mesmo cálculo para o cabeçalho da campanha,
agregado sobre as notificações daquele `campaign_id`.

### 3.2 O que a campanha passa a mostrar depois do envio

Em vez de terminar em contagens de saída, a campanha vira um objeto com **três estados de
vida**:

```
ABERTA (recém-disparada)
  → métrica visível: "12 enviadas · 5 lidas · aguardando retorno (janela até 13/07)"
ENCERRADA (janela cumprida ou gestor encerra)
  → resultado: "Rodou de 10/07 a 13/07 · 12 alunos · 7 voltaram a estudar (58%) · 5 sem resposta"
```

O cálculo de "voltaram" é **exatamente** o `returned_at IS NOT NULL` que o cron já preenche
e o Histórico já usa — só que agrupado por `campaign_id` em vez de por linha solta. **Zero
tracking novo. Zero query nova de comportamento.** O único trabalho é o join/agregação e a
UI que mostra o resultado.

### 3.3 Estado de encerramento explícito (o "CONCLUIR" do Ulwick)

- **Janela de medição:** a campanha nasce com uma `window_end` default (sugestão: 7 dias
  após o disparo, alinhado ao horizonte de `SEM_ACESSO_DAYS`=14 mas mais curto para dar
  feedback rápido — decisão de valor, ver D2). Enquanto dentro da janela, status = `open`.
- **Encerramento:** automático quando a janela expira (o mesmo cron de eficácia, ou um passo
  a mais nele, pode virar o status), OU manual pelo gestor ("encerrar campanha agora").
- **Resultado congelado:** ao encerrar, a campanha exibe o retrato final. Não precisa
  materializar (pode ser derivado on-read do join), mas o `status` e a `window_end` moram na
  tabela `campaigns` para a UI saber o que renderizar.

> **Decisão para o Hugo (D2):** qual a janela default de medição de retorno? 7 dias
> (feedback rápido) ou 14 (alinhado ao limiar "sem acesso")? Recomendo 7 com opção de o
> gestor ver "ainda em janela".

---

## 4. Segmentação herdada do semáforo (Malouf)

### 4.1 O problema atual

Hoje a aba Campanhas parte de `initialCohorts` (o bloco `suggestions` do overview), com os
cinco tipos de nudge (`never_accessed`, `inactive`, `behind_teaching_plan`, `no_reflection`,
`top_performer`). Malouf tem razão: isso é um **critério paralelo** ao semáforo unificado
(`No ritmo` / `Sem acesso` / `Atenção`) que `student-triage.ts` agora produz e que o resto
da tela (dashboard + engagement) já usa como fonte única.

### 4.2 A correção: "quem entra" nasce do semáforo

O ponto de partida da campanha deixa de ser "os 5 tipos de nudge" e passa a ser **os 3
estados do semáforo**, exatamente como `computeStudentTriagem` os define:

| Estado do semáforo | Cor | Definição (verbatim de `student-triage.ts`) | Ação de campanha natural |
|:---|:---|:---|:---|
| **Atenção** | 🔴 vermelho | ritmo `atrasado` OU `nao_iniciado` (atrasado no plano ou nunca começou) | "Acionar" — o alvo mais urgente |
| **Sem acesso** | 🟡 amarelo | não-atenção && `daysSince(lastSession) > 14` (sumido, mas em dia) | "Lembrar" |
| **No ritmo** | 🟢 verde | resto (inclui concluídos) | reconhecimento (opcional) |

Isso **reusa** `computeStudentTriagem` / `computeStudentAction` como fonte de "quem entra",
em vez de reinventar critério. O gestor pensa "quero acionar meus alunos em vermelho" — a
mesma linguagem do resto da tela — não "quero um cohort never_accessed".

### 4.3 Como isso convive com os tipos de nudge (não jogar fora)

O `nudgeType` **não some** — ele continua sendo o que decide o *template* e o *motivo de
inclusão* por aluno. A mudança é de *ordem de raciocínio*:

```
ANTES:  gestor escolhe nudgeType (never_accessed) → vira o grupo inteiro
DEPOIS: gestor escolhe estado do semáforo (Atenção) → o sistema, POR ALUNO, deriva o
        nudgeType certo (never_accessed se totalSessions===0, senão inactive — que é
        EXATAMENTE o que computeStudentAction já faz na linha 121) → cada aluno recebe a
        variação apropriada ao SEU sinal
```

Ou seja, a variação-por-destinatário do §2 **cai de graça** da adoção do semáforo: dentro de
"Atenção", o Venilton (nunca acessou) já mapeia para `never_accessed` e o aluno atrasado
para `inactive`, porque `computeStudentAction` já faz esse desempate. A segmentação
unificada e a personalização individual são **a mesma decisão de design**.

> **Decisão para o Hugo (D3):** manter o estado 🟢 "No ritmo" como origem possível de
> campanha (reconhecimento/`top_performer`) ou restringir campanhas aos dois estados de
> risco (🔴🟡)? O E7 hoje inclui `top_performer`. Recomendo manter, mas como segmento
> separado e opcional.

### 4.4 Onde o semáforo é resolvido (segurança preservada)

Crítico: a resolução de *quem está em cada estado* continua **server-side e re-scopada**. O
`resolveEngagementScope` (mesma função que overview/action/history/campaign já usam) define
o universo de alunos do recorte; a triagem roda sobre esse universo. A campanha nunca recebe
uma lista pronta do client — o preview server-side (§5) resolve o segmento do semáforo com o
client autenticado, idêntico à trava de hoje.

---

## 5. Fluxo proposto (o que muda vs. o que permanece)

### 5.1 Fluxo novo (revisão individual em vez de wizard de 7 passos)

```
1. ENTRAR PELO SEMÁFORO    gestor abre Campanhas → vê os 3 estados com contagem do recorte
                           ("🔴 Atenção: 5  ·  🟡 Sem acesso: 8  ·  🟢 No ritmo: 27")
2. ESCOLHER SEGMENTO       clica em "Atenção (5)" → inicia uma campanha para esse segmento
3. PREPARAR (server)       preview mode resolve os 5 alunos re-scopados; para CADA um,
                           pré-preenche: nome, motivo individual, nudgeType derivado por
                           aluno, texto do template renderizado com o contexto dele
4. REVISAR INDIVIDUALMENTE tabela de N linhas; por linha o gestor pode: editar o texto
        (obrigatória)      daquela mensagem, trocar o template daquela linha, remover o aluno.
                           Origem (gestor/plataforma) e canal (in-app/email) no cabeçalho.
                           Cap de 200 comunicado ANTES, botão travado se exceder.
5. DISPARAR (confirm)      um clique dispara o lote; servidor re-scopa DE NOVO e cria N
                           notificações, todas com o mesmo campaign_id
6. ACOMPANHAR (aberta)     a campanha aparece como objeto ABERTO: "12 enviadas · 5 lidas ·
                           aguardando retorno até 13/07"
7. ENCERRAR (resultado)    na janela cumprida (ou manual): "Rodou de X a Y · 7 de 12
                           voltaram a estudar (58%)"
```

### 5.2 Tabela: permanece vs. muda

| Elemento | E7 atual | E13 proposto | Veredito |
|:---|:---|:---|:---|
| **Trava AUTH→VALIDATE→RE-SCOPE→DISPATCH** | ✅ | ✅ idêntica | **PERMANECE** (inegociável) |
| **Preview server-side (nunca lista do client)** | ✅ | ✅ | **PERMANECE** (inegociável) |
| **Re-scope no confirm** | ✅ | ✅ | **PERMANECE** (inegociável) |
| **Revisão obrigatória antes do envio** | ✅ (tela) | ✅ (tela, agora por-linha) | **PERMANECE, evolui** |
| **Cap de 200 destinatários** | ✅ | ✅ | **PERMANECE** (inegociável) |
| **Grupos automáticos (não audiências salvas)** | ✅ (5 nudgeTypes) | ✅ (3 estados do semáforo) | **MUDA a fonte** |
| **Wizard de 7 passos lineares** | ✅ | ❌ vira tabela de revisão individual | **MUDA** (menos passos, mais controle) |
| **Mensagem única para todos** | ✅ | ❌ variação por destinatário | **MUDA** (o coração da proposta) |
| **Loop fechado (retorno do aluno)** | ❌ (só contagens de saída) | ✅ via `returned_at` agregado | **NOVO** (dado já existe) |
| **Estado de campanha (aberta/encerrada)** | ❌ | ✅ tabela `campaigns` | **NOVO** (única infra nova) |

### 5.3 O que o backend precisa (delta honesto)

- `POST /api/engagement/campaign` **preview**: além da lista, retornar por aluno o
  `nudgeType` derivado (via `computeStudentAction`) e o texto pré-renderizado. Mudança
  aditiva no payload, não quebra a trava.
- `POST /api/engagement/campaign` **confirm**: aceitar, em vez de uma `message` única, um
  array de `{ studentId, message?, templateKey? }` (a variação por linha). O re-scope
  continua filtrando os `studentId` exatamente como hoje (`safeIds`). Gerar `campaign_id`,
  gravá-lo no `context` de cada notificação, e (Opção B) inserir a linha em `campaigns`.
- Nova leitura: `GET /api/engagement/campaign/:id` (ou um bloco no overview) que agrega
  `read_at`/`returned_at` das notificações daquele `campaign_id` para o cabeçalho de
  resultado. Reusa a lógica de `resultLabel`/`retornaram` já escrita no Histórico.
- O cron de eficácia **não muda** — ele já carimba `returned_at` por notificação,
  independentemente de estarem agrupadas. Opcionalmente ganha um passo para virar
  `campaigns.status` de `open`→`closed` quando `window_end` passa.

---

## 6. Restrições de segurança (INEGOCIÁVEIS, verbatim do E7)

Reafirmando, para que qualquer implementação futura saiba que estes são requisitos duros e
**não** estão em discussão nesta proposta:

1. **Cap de 200 destinatários** (`MAX_RECIPIENTS`) por campanha, comunicado ANTES de
   qualquer tentativa de envio, botão travado se a lista final exceder. Mantido.
2. **Revisão obrigatória** antes do disparo. O confirm só é alcançável a partir da tela de
   revisão. Mantido (e reforçado: agora a revisão é por-linha).
3. **Re-validação de escopo no confirm.** A lista revisada é filtrada DE NOVO no servidor
   contra o alcance do gestor (`resolveEngagementScope` + `?focus=`); um id
   removido/estrangeiro nunca reentra. Mantido byte-a-byte.
4. **Preview server-side.** A UI nunca fabrica destinatários; preview e confirm são ambos
   re-scopados no servidor. Mantido.
5. **Nada disso é reaberto.** A auditoria de segurança linha-a-linha do E7 continua válida;
   esta proposta *adiciona* uma camada de modelo mental acima da trava, sem tocar na trava.

---

## 7. Reconvergência de segurança — a resposta franca à Annie Duke

Duke alertou que reconstruir do zero corre o risco de reconvergir para a mesma arquitetura
de segurança (grupos automáticos + wizard + revisão obrigatória) com nomes diferentes.
**Resposta honesta: sim, reconverge — e isso é o resultado certo, não uma falha.**

Separando o que reconverge do que é genuinamente novo:

| Camada | Reconverge? | Por quê |
|:---|:---|:---|
| **Trava de segurança** (AUTH→VALIDATE→RE-SCOPE→DISPATCH) | ✅ reconverge, deliberadamente | Está correta. Trocá-la por "algo diferente" seria trocar segurança comprovada por novidade sem lastro. Reconvergir aqui é a validação de que o E7 acertou o alicerce. |
| **Grupos automáticos (não audiências salvas)** | ✅ reconverge | Também estava certo. A única mudança é a *fonte* do grupo (semáforo unificado em vez de 5 nudgeTypes soltos) — evolução, não reinvenção. |
| **Revisão obrigatória** | ✅ reconverge o princípio | Muda a granularidade (por-linha em vez de lista), mas o princípio "nada dispara sem revisão" é mantido de propósito. |
| **Modelo de dados da campanha** | ❌ genuinamente novo | Hoje campanha não existe como entidade. A tabela `campaigns` + `campaign_id` + estado aberta/encerrada é infra nova. |
| **Variação por destinatário** | ❌ genuinamente novo | Hoje é 1 mensagem → N. O array `{studentId, message}` no confirm é um contrato novo. |
| **Fechamento do loop na campanha** | ❌ genuinamente novo (com dado velho) | O cálculo de retorno já existe (`returned_at`), mas trazê-lo para o cabeçalho da campanha agregado por `campaign_id` é uma superfície nova. |

**Síntese para o Hugo:** ~60% da arquitetura reconverge para o E7 (a parte de segurança e
grupos automáticos), e isso é a prova de que a base estava certa. Os ~40% genuinamente novos
são exatamente as três dores que o painel apontou: paradigma individual-contínuo (variação
por linha), loop fechado (retorno agregado) e estado de encerramento (tabela `campaigns`).
Reconstruir do zero, na prática, é **reescrever a UI e o modelo mental por cima de uma trava
de segurança que se mantém**.

---

## 8. Decisões abertas para aprovação (antes de qualquer código)

| ID | Decisão | Recomendação Aria | Impacto |
|:---|:---|:---|:---|
| **D1** | Tabela `campaigns` (Opção B) vs. só `campaign_id` em context (Opção A) | **B** — única infra nova, mas é o que dá lar ao estado de encerramento | Migração pequena |
| **D2** | Janela default de medição de retorno: 7d vs 14d | **7d** (feedback rápido; gestor vê "ainda em janela") | Só valor default |
| **D3** | 🟢 "No ritmo" pode originar campanha (reconhecimento) ou só 🔴🟡? | **Manter** como segmento separado opcional | Escopo de UI |
| **D4** | Variação por linha: editar texto livre por aluno OU só escolher entre templates por aluno? | **Ambos** — template como default, texto livre como override (espelha o `message` livre de hoje) | Contrato do confirm |
| **D5** | Encerramento: só automático (cron) ou também manual pelo gestor? | **Ambos** | Passo no cron + botão |

---

## 9. O que esta proposta NÃO faz (escopo negativo)

- Não implementa nada — é documento para aprovação.
- Não reabre a auditoria de segurança do E7 (§6 são requisitos herdados, não em revisão).
- Não altera o cron de eficácia nem a aba Histórico (reusa, não modifica).
- Não introduz "audiências salvas" — o kill da Seção 16 do E7 permanece de pé.
- Não decide a estética/layout final (isso é do @ux-design-expert depois do GO do modelo).

---

## 10. Próximo passo

Aprovação do Hugo sobre (a) o modelo mental "campanha = lote de ações individuais revisáveis
com loop fechado" e (b) as decisões D1–D5. Com o GO, o caminho SDC é: @po valida esta
proposta como base de story(ies) → @data-engineer desenha a migração `campaigns` (se D1=B) →
@dev implementa por trás da trava de segurança intacta → @qa re-verifica que a trava não
regrediu (o `routes-leak.test.ts` do E7 deve continuar verde) → @devops.
