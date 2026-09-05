# FIX-FUROS — as três réguas que faltavam

> Fecha os três achados de `VERIFICACAO-CRUZADA.md`. **Nenhuma linha de código de
> produção foi alterada**: o objeto desta rodada é a rede de testes, não o produto.
> Cada régua nova foi provada por mutação — defeito injetado, vermelho colado,
> revertido, reversão conferida por `shasum -a 256 -c` (nunca por `git diff`:
> vários artefatos desta rodada nunca foram commitados e o diff sobre eles é vazio
> por construção).

## Placar

| Furo | O que faltava | Régua nova | Mutações que agora reprovam |
|:--|:---|:---|:--:|
| 1 | matriz de papéis em `chapters`/`courses`/`jobs` | 3 arquivos de teste convertidos de amostra para matriz | **6** |
| 2 | `\|\| true` desligava o gate da marca em silêncio | 4 casos novos em `dockerfile-roda-os-dois-gates.test.ts` | **7** (+1 controle que fica verde) |
| 3 | 3º estado presente nos 6 sítios invisíveis, sem rede | arquivo novo `terceiro-estado-nos-sitios-invisiveis.test.ts` | **8** |

Total: **21 mutações vermelhas**, mais **1 controle deliberadamente verde** (§Furo 2),
mais os controles positivos que já existiam e continuam verdes.

---

## Furo 1 — a régua vira matriz, e `admin` passa a discriminar

### O que estava errado

`chapters`, `courses` e `jobs` enumeravam `student` fora e `instructor`/`manager`
dentro. Isso não é uma régua da lista de papéis, é uma régua de **dois pontos**
dela. As duas pontas que faltavam:

- **`admin` é ACEITO pelas 12 rotas e nunca era afirmado.** Remover `admin`
  deixava a suíte verde — e estreitar é *o defeito que esta auditoria existe para
  corrigir*: negar acesso a quem tem direito.
- **`super_admin` é RECUSADO pelas 12 e nunca era afirmado.** Acrescentá-lo
  também deixava verde.

### O cuidado que decidiu o valor do trabalho

**`student` não discrimina nada.** Ele é recusado por todas as listas do produto;
uma matriz que só o use como papel de fora mede o vazio, e era exatamente o que
estava acontecendo. Quem discrimina, por família, foi apurado antes de escrever
qualquer asserção:

| Papel | Situação nas 12 rotas | Discrimina? |
|:---|:---|:---|
| `student` | recusado | **não** — recusado por toda lista do produto |
| `leader` | recusado | **sim** — existe no domínio de `users.role` (ver correção abaixo) |
| `manager` | aceito | sim (já era afirmado) |
| `instructor` | aceito | sim (já era afirmado) |
| **`admin`** | **aceito** | **sim, e é o que pega o ESTREITAMENTO** |
| **`super_admin`** | **recusado** | **sim, e é o que pega o ALARGAMENTO alcançável** |

Sobre `leader`: a migration `20260803000000_onboarding_novidades.sql` (linha 460)
registra a medição de que os papéis reais em `users.role` neste banco são
`admin, instructor, manager, student, super_admin`. ~~`leader` é peso morto.~~

> **CORRIGIDO em 2026-08-31 (FIX-C).** O parágrafo acima está errado sobre
> `leader`, e o erro é o mesmo em toda a cadeia: ele confunde a **população** de
> hoje com o **domínio** aceito. A migration citada não cataloga papéis — ela
> semeia `audience_roles` de anúncios, um `TEXT[]` que a própria migration
> declara **sem CHECK fechado**, e duas das três linhas semeadas listam `teacher`
> **e** `leader`.
>
> Quem autoriza uma escrita é a restrição, e a vigente é
> `20260518000000_leader_role.sql` — a **última** das quatro migrations que
> definem `users_role_check` (`20260209` → `20260210` → `20260228100000` →
> `20260518000000`) — e ela **inclui `leader`**. Uma linha com esse papel é
> inserível hoje. Mais: `20260604140000_fix_area_gestor_rls.sql` ainda estava
> **estreitando a RLS do `leader`** em junho de 2026, descrevendo-o como
> "read-only learning companion". É papel vivo.
>
> Portanto `leader` **discrimina**: uma lista que o ganhasse seria alargamento
> **alcançável**, da mesma classe do `super_admin`. O caso fica, e os comentários
> dos três arquivos (`chapters`, `courses`, `jobs`) foram reescritos para dizer
> **NÃO REMOVA ESTE CASO**, com a razão — porque a versão anterior instruía o
> próximo leitor a fazer a limpeza óbvia e reabrir o furo.
>
> Na mesma frase da migration de origem há **dois valores com vereditos
> opostos**: sobre `teacher` ela está **certa** (saiu da restrição em
> `20260210000000_areas_role_unification.sql` e não voltou em nenhuma das
> definições seguintes — não é inserível). Sobre `leader`, errada. A frase que
> junta os dois é a origem do engano, e ela vive numa migration **já aplicada**
> (`20260803000000_onboarding_novidades.sql`, ~linha 460), que esta frente não
> edita: fica registrado aqui para decisão de quem tem autoridade sobre
> migrations aplicadas.

`super_admin` é o oposto: existe no banco, está fora da lista destas 12 rotas, e
por isso é a ameaça de alargamento que era alcançável e passava.

### Prova por mutação

Baselines antes: `chapters` 31/31, `courses` 21/21, `jobs` 21/21.

| # | Mutação | Suíte | Antes | Agora |
|:--|:---|:---|:---|:---|
| M6 | `chapters/generate-audio` **perde `admin`** | `src/app/api/chapters` | 31/31 VERDE | **1 failed \| 48 passed (49)** |
| — | `chapters/generate-audio` **ganha `super_admin`** | idem | (não medido antes) | **1 failed \| 48 passed (49)** |
| M5 | `chapters/generate-audio` **ganha `leader`** | idem | 912/912 VERDE | **1 failed \| 48 passed (49)** |
| — | `chapters/slides/upload` **perde `admin`** (lista **multilinha**) | idem | — | **1 failed \| 48 passed (49)** |
| M9 | `generation-jobs/[jobId]/status` **perde `admin`** | teste `jobs` | 21/21 VERDE | **1 failed \| 32 passed (33)** |
| M10 | `courses/[courseId]/generation-jobs` **perde `admin`** | `src/app/api/courses` | 21/21 VERDE | **1 failed \| 26 passed (27)** |

A quarta linha existe de propósito: três das seis rotas de `chapters` declaram a
lista em **multilinha**, e uma régua que só pegasse a literal em linha seria a
mesma varredura-pela-forma-do-texto que já custou caro nesta auditoria. A matriz
não olha o texto da lista — ela chama a rota com cada papel e lê o status.

**Reconferido depois do formatador** (o `biome check --write` removeu uma linha em
branco dos três arquivos): M6 reproduzido, **1 failed | 48 passed (49)**.

### Contagens finais

| Arquivo | Antes | Agora |
|:---|:--:|:--:|
| `api/chapters/__tests__/perfil-ilegivel-nao-e-negacao-chapters.test.ts` | 31 | **49** |
| `api/courses/__tests__/perfil-ilegivel-nao-e-negacao-courses.test.ts` | 11 | **17** |
| `api/__tests__/perfil-ilegivel-nao-e-negacao-jobs.test.ts` | 21 | **33** |

### Registrado, não alterado — uma divergência de RBAC

As 12 rotas aceitam `["manager","admin","instructor"]` e **excluem
`super_admin`**, enquanto `PAPEIS_COURSE_DESIGNER`, no mesmo
`lib/api-role-guard.ts`, o **inclui**. É a mesma família de trabalho com duas
respostas diferentes para a mesma pergunta.

**Não toquei em nenhuma lista** — RBAC é decisão do dono do produto, e a matriz
transcreve 1:1 o que `HEAD` faz. O efeito colateral honesto de trancar isso é que
a matriz agora afirma `super_admin` RECUSADO: se a decisão do dono for que ele
deveria entrar, a mudança fica **visível** (3 arquivos de teste ficam vermelhos e
pedem edição explícita) em vez de silenciosa. Era esse o objetivo — que a
divergência não mude de lado sem ninguém ver, em nenhuma das duas direções.

---

## Furo 2 — a asserção que mede a propagação, não a posição

### O que estava errado

Os dois casos existentes mediam **posição** (a linha está lá; antes/depois do
build). Verdadeiros, e cegos para o modo de falha mais provável:
`RUN node …verificar-marca-no-artefato.mjs || true` deixava **2/2 VERDE**.

Não repeti as duas hipóteses já refutadas por leitura no laudo (comentar a linha
**é** pego pelo `startsWith("RUN")`; o comportamento aprova/reprova do script tem
8 testes próprios).

### Como a asserção foi escrita para não ser um grep

Não procura a literal `|| true`. Reconstrói a **instrução `RUN` inteira** (colando
continuações `\`, senão um `\` esconderia o `|| true` na linha seguinte) e afirma
que o **rabo** — tudo depois da chamada do script — não contém separador que troque
o código de saída:

| Forma | Por que engole |
|:---|:---|
| `cmd \|\| true`, `cmd \|\| exit 0`, `cmd \|\| :` | o ramo alternativo roda e o status passa a ser o **dele** |
| `cmd ; true` | em `sh`, o status é o do **último** comando |
| `cmd \| tee log` | pipe sem `pipefail`: idem, vale o último |
| `cmd &` | segundo plano: status sempre 0 |

`&&` é **deliberadamente excluído** — ele não engole nada (se o gate falha, o ramo
direito nem roda). Por isso o `&` só conta quando não acompanhado de outro `&`, e
o `|` só quando não é `||`. Um caso separado cobre o irmão silencioso `set +e`,
que deixa o rabo limpo e a falha igualmente inofensiva.

A guarda vale para os **dois** gates: o gate 1 tem exatamente a mesma exposição.

### Prova por mutação

| # | Mutação | Resultado |
|:--|:---|:---|
| MC4 | gate 2 `\|\| true` | **1 failed \| 5 passed (6)** |
| — | gate 2 `; true` | **1 failed \| 5 passed (6)** |
| — | gate 2 `\|\| exit 0` | **1 failed \| 5 passed (6)** |
| — | gate 2 `\| tee /tmp/marca.log` | **1 failed \| 5 passed (6)** |
| — | gate 2 `&` | **1 failed \| 5 passed (6)** |
| — | gate 2 `RUN set +e; node …` | **1 failed \| 5 passed (6)** (pelo caso do `set +e`) |
| — | **gate 1** `\|\| true` | **1 failed \| 5 passed (6)** (e o caso do gate 2 fica verde — sem casamento cruzado de substring) |
| **CP** | gate 2 `&& echo 'marca conferida'` | **6 passed (6)** — não é falso-positivo |

O último é o controle que decide se a régua é usável: uma régua que reprovasse
`&&` seria uma régua que alguém desligaria na primeira vez que quisesse logar o
sucesso do gate.

`Dockerfile` restaurado: `shasum -a 256 -c` → `Dockerfile: OK`. Contagem: 2 → **6**.

---

## Furo 3 — a rede para os 6 sítios invisíveis ao compilador

### O que estava errado

O 3º estado **está** nos 6 sítios (5 páginas RSC que só fazem `redirect`, e o
`slide-actions` que só faz `throw`), e nada o segura ali: remover a linha de
`courses/[courseId]/questions/page.tsx` produzia **zero falhas novas**.

### O corte escolhido, e por que não foi o mais barato

O corte mais barato seria contar ocorrências do token `"indisponivel"` por
arquivo. Foi **recusado**: é a régua fraca que a própria frente admitiu ter, e
morre contra um `if` invertido, um `motivo` trocado ou um `throw` que virou
`redirect` — em todos esses o token continua no arquivo.

O corte escolhido mede o **desfecho** de cada sítio nos três estados do guard. O
`requireCourseManager` usado é o **real**; quem é duplado é o cliente Supabase
abaixo dele. Os componentes de tela são stubs (o veredito é sempre anterior ao
JSX), `next/navigation` é dublê com sentinelas distintas para `redirect` e
`notFound` — sem isso, "foi embora para a lista" e "subiu a indisponibilidade"
seriam ambos "lançou algo", e a mutação passaria.

Quatro casos por sítio, 24 no total:

1. leitura indisponível → **sobe a indisponibilidade** (o que a mutação quebra);
2. `[CP]` sem o chapéu → **continua recusado** no destino de cada sítio (impede a
   correção degenerada "lança indisponibilidade sempre", que destruiria o gate de
   privacidade);
3. `[CP]` a recusa legítima **não** carrega a mensagem "tente de novo" (a ponta que
   o caso 2 não cobre: sem ela, o usuário sem direito retentaria para sempre);
4. `[CP]` com o chapéu → atravessa.

**Nenhum dos 6 foi inviável de guardar.** Não houve exclusão a declarar.

### Prova por mutação

Remoção da linha `if (roleCheck.motivo === "indisponivel") throw new Error(roleCheck.mensagem)`,
um sítio por vez:

| Sítio | Resultado |
|:---|:---|
| `courses/[courseId]/questions/page.tsx` | **1 failed \| 23 passed (24)** |
| `chapters/new/page.tsx` | **1 failed \| 23 passed (24)** |
| `chapters/new/ingest/page.tsx` | **1 failed \| 23 passed (24)** |
| `chapters/[chapterId]/edit/page.tsx` | **1 failed \| 23 passed (24)** |
| `chapters/[chapterId]/questions/page.tsx` | **1 failed \| 23 passed (24)** |
| `chapters/[chapterId]/edit/slide-actions.ts` | **1 failed \| 23 passed (24)** |

E as duas que uma régua por token **não** pegaria, porque o token continua no
arquivo:

| # | Mutação | Resultado |
|:--|:---|:---|
| MUT-T1 | `motivo === "indisponivel"` → `motivo === "sem-permissao"` | **2 failed \| 22 passed (24)** |
| MUT-T2 | o `throw` do 3º estado vira `return redirect("/courses")` | **1 failed \| 23 passed (24)** |

MUT-T1 mata **dois** casos — o do 3º estado e o `[CP]` de quem não tem o chapéu —
porque a troca inverte os dois desfechos de uma vez. É o sinal de que os dois lados
estão amarrados, não só um.

Reversão dos 6: `shasum -a 256 -c` → todos `OK`.

---

## Um erro meu, e como foi pego

O mutador da primeira rodada do Furo 1 era Python em **modo texto**. Ele
normalizou **CRLF → LF** em dois arquivos de produção
(`chapters/[chapterId]/generate-audio/route.ts` e
`chapters/[chapterId]/slides/upload/route.ts`), que neste repositório são CRLF.

O conteúdo semântico voltou idêntico e o `git diff` teria parecido plausível — mas
a conferência por `shasum` acusou `FAILED` nos dois. Diagnóstico: `git diff
--numstat` mostrou **121/122** e **201/202** (o arquivo inteiro reescrito) para uma
mudança de uma linha, e `grep -c $'\r'` mostrou 0 CRs onde o irmão
`slides/sync-audio/route.ts` tem 84. `git show HEAD:` confirmou 122/122 e 202/202
CRs — uniformemente CRLF. Restauração byte a byte, e `shasum -a 256 -c` → `OK` nos
quatro.

**A lição, e é a do próprio laudo:** conferir reversão por `git diff` teria
aprovado uma reescrita de arquivo inteiro. Todas as mutações seguintes usaram
mutador em **modo binário**, com o separador de linha escolhido por arquivo.

---

## Estado da árvore

**Arquivos modificados (todos são teste, mais o formatador):**

- `apps/web/src/app/api/chapters/__tests__/perfil-ilegivel-nao-e-negacao-chapters.test.ts`
- `apps/web/src/app/api/courses/__tests__/perfil-ilegivel-nao-e-negacao-courses.test.ts`
- `apps/web/src/app/api/__tests__/perfil-ilegivel-nao-e-negacao-jobs.test.ts`
- `apps/web/src/lib/__tests__/dockerfile-roda-os-dois-gates.test.ts`

**Arquivo novo:**

- `apps/web/src/app/(platform)/courses/[courseId]/__tests__/terceiro-estado-nos-sitios-invisiveis.test.ts`

**Não alterados:** nenhuma rota, nenhum guard, nenhuma lista de papéis, nenhuma
página, nenhuma server action, e o `Dockerfile` (a asserção do Furo 2 coube inteira
no teste — o `Dockerfile` foi apenas mutado e restaurado, `shasum` `OK`).

**Verificações finais:**

| Comando | Resultado |
|:---|:---|
| `pnpm --filter @eximia/web test src/app/api` | **43 arquivos, 948 testes, todos verdes** (baseline era 43/912; +36 da matriz) |
| `pnpm --filter @eximia/web exec tsc --noEmit` | **limpo, exit 0** |
| `pnpm --filter @eximia/web test` (suíte inteira) | `22 failed \| 4156 passed \| 5 skipped` |
| `biome check` nos 5 arquivos tocados | limpo |

Os 22 vermelhos são os **mesmos 4 arquivos** do controle registrado no laudo, sem
relação com esta rodada: `components/auth/__tests__/login-form-google-oauth`,
`components/dashboard/__tests__/manager-dashboard`, `tests/epic-23-docs-vs-code`,
`tests/epic-6-security-posture-doc`. O laudo mediu `22 failed | 4083 passed | 5
skipped`; a diferença de 73 nos verdes é minha (+64) mais o que outras frentes
acrescentaram no meio do caminho — árvore compartilhada, com mais de uma mão
escrevendo.

Nenhum commit, push, PR, deploy, MCP ou escrita em banco.

---

# Apenso FIX-C — furo na cabeça da régua do gate, e o comentário do `leader`

> 2026-08-31. Método idêntico ao do resto deste documento: cada asserção nova é
> provada injetando a forma que ela deve pegar, com a saída vermelha colada, e
> revertida por **cópia de arquivo** (nenhuma operação `git` mutante).

## Furo 1 — a régua do gate media o rabo e era cega à cabeça

A asserção existente mede tudo que vem **depois** da chamada (`|| true`, `; true`,
`|| exit 0`, `| tee`, `&`, `set +e`). Com o operador à **esquerda**, o rabo fica
limpo, a linha continua na posição certa, e o gate **não executa**:

```
RUN true || node apps/web/scripts/verificar-marca-no-artefato.mjs                    → 6/6 VERDE
RUN [ "$PULAR_GATE" = "1" ] || node apps/web/scripts/verificar-marca-no-artefato.mjs → 6/6 VERDE
```

Ambas medidas antes de escrever qualquer linha. A segunda é a forma realista: o
sinalizador de pulo que alguém liga para destravar um build local e esquece no
arquivo.

### O vermelho da régua nova

Com `[ "$PULAR_GATE" = "1" ] ||` antes do **gate 2**:

```
 ❯ dockerfile-roda-os-dois-gates.test.ts (10 tests | 1 failed) 4ms
   × ... > o gate 2 (artefato) EXECUTA — nada à esquerda o curto-circuita
     → a chamada do gate 2 (artefato) tem um `||` antes dela: quando o lado
       esquerdo dá certo, o gate NAO RODA e a instrucao sai 0 mesmo assim:
       RUN [ "$PULAR_GATE" = "1" ] || node apps/web/scripts/verificar-marca-no-artefato.mjs
     expected 'RUN [ "$PULAR_GATE" = "1" ] || node a…' not to match /\|\|/
```

Com `true ||` antes do **gate 1** (a régua vale para os dois):

```
   × ... > o gate 1 (declaração) EXECUTA — nada à esquerda o curto-circuita
      Tests  1 failed | 9 passed (10)
```

### O controle que mantém a régua usável

`&&` **não** é reprovado, e isso é afirmado por um caso próprio. Medido com
`RUN echo "medindo a marca declarada" && node …verificar-marca.mjs` no
`Dockerfile` real: **10/10 VERDE**. A razão é semântica, não estética — se o lado
esquerdo falha, o gate não roda **e a instrução falha junto**, ruidosamente. Uma
régua que barrasse `&&` seria desligada na primeira sexta-feira, e uma régua
desligada não protege nada.

### O que eu decidi NÃO acrescentar, e por quê

Cogitei estender a régua para a forma condicional (`RUN if …; then node gate; fi`,
que pula em silêncio quando a condição é falsa). **Medi antes de escrever**, e a
asserção do rabo já a reprova:

```
RUN if [ "$PULAR_GATE" != "1" ]; then node …verificar-marca-no-artefato.mjs; fi
   × ... > a falha do gate 2 (artefato) PROPAGA — nada engole o código de saída
      Tests  1 failed | 5 passed (6)
```

O `; fi` cai no rabo. Acrescentar `if` à régua nova seria régua redundante se
fazendo de nova — o tipo de linha que engorda a suíte e não move o veredito.

Placar final: `dockerfile-roda-os-dois-gates` **10/10**, com `Dockerfile`
restaurado por cópia e conferido (`RUN node …verificar-marca.mjs` na 96,
`RUN node …verificar-marca-no-artefato.mjs` na 123).

## Furo 2 — o comentário do `leader` (corrigido acima, na seção da matriz)

A correção substantiva está na seção "**CORRIGIDO em 2026-08-31 (FIX-C)**" acima.
Três pontos operacionais que pertencem a este apenso:

1. **Três sítios de código**, não um: `api/chapters/__tests__/…-chapters.test.ts`,
   `api/courses/__tests__/…-courses.test.ts` e
   `api/__tests__/…-jobs.test.ts`. Após a reescrita,
   `grep -rn "não existe em \`users.role\`" apps/web` volta **vazio**. Suítes:
   **353/353 verde** nas três famílias.
2. **A implementação não mudou.** `leader` continua na matriz e o caso continua
   mordendo; o que mudou foi a justificativa, que instruía a remoção.
3. **Uma correção de data, para quem for conferir:** `teacher` saiu da restrição
   em **`20260210000000_areas_role_unification.sql`**, não em `20260228100000`
   (esta última é a que ACRESCENTA `instructor`, e já não tinha `teacher`). As
   quatro definições de `users_role_check`, em ordem:

   | Migration | Domínio de `users.role` |
   |:---|:---|
   | `20260209000000_epic11_super_admin_whitelabel` | student, **teacher**, admin, manager, super_admin |
   | `20260210000000_areas_role_unification` | student, manager, admin, super_admin |
   | `20260228100000_instructor_role` | + instructor |
   | `20260518000000_leader_role` **(vigente)** | + **leader** |

## Instrumento

`file Dockerfile` e os três arquivos de teste tocados: **LF**, não CRLF — conferido
antes das mutações, justamente por causa do aviso dos 29 arquivos em CRLF sob
`apps/web/src`. Nenhuma das minhas mutações usou padrão ancorado em `$`, e cada
uma foi confirmada por `grep` da linha injetada antes de rodar a suíte.

Nenhum commit, push, PR, deploy, MCP, escrita em banco ou operação `git` mutante.
