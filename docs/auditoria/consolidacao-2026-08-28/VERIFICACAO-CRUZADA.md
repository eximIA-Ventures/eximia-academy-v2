# Verificação adversarial cruzada

> **Duas rodadas.** A primeira cobriu 5 frentes com 13 mutações. Depois dela o escopo foi
> dividido: `FIX-B2/B3/B4/B8` (rotas) passaram para outro verificador, e esta ficou com
> **FIX-A, FIX-C e FIX-D**, em profundidade. A segunda rodada está na §Segunda rodada, ao
> final, junto com um **incidente que eu causei** e que precisa de ação da FIX-C.

## Rodada 1 — 5 frentes, 13 mutações

> Executada por quem **não escreveu nenhuma** das correções abaixo. Método: assumir cada
> afirmação falsa até uma mutação injetada provar o contrário. Toda mutação foi revertida
> e a reversão conferida por **hash de conteúdo**, nunca por `git diff` — vários artefatos
> desta rodada são untracked e `git diff` sobre eles não prova nada.

## Placar

| # | Afirmação | Frente | Veredito |
|:--|:---|:---|:---|
| 1 | 47 rotas distinguem 403 de 503 | B2/B3/B4 | **CONFIRMADA** |
| 2 | 47 rotas não alargaram acesso | B2/B3/B4 | **CONFIRMADA**, régua **PARCIAL** |
| 3 | Gate 2 da marca existe e **é chamado** | C | **CONFIRMADA**, com um furo: `\|\| true` |
| 4 | Erro de leitura de `users` não vira "zero pessoas" | C | **CONFIRMADA** |
| 5 | Rota nunca responde `ok:true` com zero gravações | A | **CONFIRMADA** |
| 6 | `/perfil` alcançável pela navegação | D | **CONFIRMADA** |
| 7 | 3º estado do `requireCourseManager` chega aos 24 | B8 | **PRESENTE, NÃO GUARDADO** |

Nada foi refutado no sentido de "a correção não funciona". **Três achados** dizem respeito
ao que *protege* as correções, não às correções em si — e é aí que a próxima regressão entra.

---

## Achado 1 — a régua das rotas é uma AMOSTRA em três famílias, e ambas as direções passam

**A afirmação "não alargamos acesso" é verdadeira.** Conferi estaticamente contra `HEAD` o
recorte de maior privilégio e as listas batem:

| Rota | `HEAD` | Agora |
|:---|:---|:---|
| `admin/sso` | `["admin","super_admin"]` | `PAPEIS_DE_ADMINISTRACAO` = idem |
| `admin/users` (GET e POST) | `["admin","super_admin"]` | idem |
| `integrations/keys` | `["admin","super_admin"]` | `PAPEIS_CHAVES_INTEGRACAO` = idem |
| `integrations/keys/[id]` | `["admin","super_admin"]` | idem |

E a régua **acusa** um alargamento, em três mecanismos diferentes de declaração de lista:

| # | Mutação | Resultado |
|:--|:---|:---|
| M1 | `PAPEIS_CHAVES_INTEGRACAO` ganha `manager` (constante compartilhada) | **3 falhas** |
| M2 | `PAPEIS_CONTEUDO` ganha `super_admin` (constante compartilhada) | **10 falhas** |
| M3 | `PAPEIS_DE_ADMINISTRACAO` ganha `manager` (constante **local**) | **2 falhas** |
| M4 | `chapters/generate-audio` ganha `student` (literal **inline**) | **1 falha** |

**O furo aparece quando o papel mutado não está entre os que o CP enumera.** Censo dos
papéis citados em cada arquivo de teste:

| Arquivo de teste | student | leader | manager | instructor | admin | super_admin |
|:---|:--:|:--:|:--:|:--:|:--:|:--:|
| `...-chapters.test.ts` | ✓ | — | ✓ | ✓ | **—** | **—** |
| `...-courses.test.ts` | ✓ | — | ✓ | ✓ | **—** | **—** |
| `...-jobs.test.ts` | ✓ | — | ✓ | ✓ | **—** | **—** |
| `...-nao-e-negacao.test.ts` | ✓ | — | ✓ | — | — | — |
| `...-ingestion.test.ts` | ✓ | **—** | ✓ | ✓ | ✓ | ✓ |
| `...-admin.test.ts` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `...-analytics.test.ts` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

As rotas de `chapters`, `courses` e `jobs` aceitam `["manager","admin","instructor"]`, e
**`admin` nunca é afirmado**. Consequência medida:

| # | Mutação | Subconjunto rodado | Resultado |
|:--|:---|:---|:---|
| M5 | `chapters/generate-audio` **ganha `leader`** (alargamento) | suíte inteira de `api` | **912/912 VERDE** |
| M6 | `chapters/generate-audio` **perde `admin`** (estreitamento) | `src/app/api/chapters` | **31/31 VERDE** |
| M9 | `generation-jobs/[jobId]/status` perde `admin` | teste `jobs` | **21/21 VERDE** |
| M10 | `courses/[courseId]/generation-jobs` perde `admin` | `src/app/api/courses` | **21/21 VERDE** |

Controle sem mutação: `chapters` 31/31, idênticos. Mesma contagem nos dois estados —
STILL GREEN, não "teste ausente".

**Por que isto importa mais do que parece.** O estreitamento (M6/M9/M10) é *exatamente o
defeito que toda esta auditoria existe para corrigir*: negar acesso a quem tem direito.
Alguém que "limpe" a lista de `chapters` removendo `admin` derruba o acesso do admin em 14
rotas e a suíte aplaude.

**Recomendação:** trazer as três famílias para a forma de matriz que `admin`, `analytics` e
a família de união já usam — afirmar os **6 papéis do universo**, um a um, por rota.

---

## Achado 2 — o gate da marca é chamado, mas um `|| true` o desliga em silêncio

`Dockerfile` linha 108 tem `RUN node apps/web/scripts/verificar-marca-no-artefato.mjs`
depois do build, e `dockerfile-roda-os-dois-gates.test.ts` afirma presença e ordem.

Duas hipóteses minhas foram **refutadas por leitura**, e registro para ninguém repetir: o
teste exige `l.trim().startsWith("RUN")`, então comentar a linha (`# RUN node …`) **é**
pego; e o comportamento do script (aprova/reprova) é guardado à parte pelos 8 testes de
`verificar-marca-no-artefato.test.ts`. A composição é bem-feita.

O que passa:

| # | Mutação | Resultado |
|:--|:---|:---|
| MC4 | `RUN node …verificar-marca-no-artefato.mjs **\|\| true**` | **2/2 VERDE** |

O teste mede **a posição de um texto**, não que a falha **propague**. Um gate cuja falha é
engolida não é um gate, e `|| true` é o que uma pessoa escreve às onze da noite para
destravar um build. A afirmação "o gate é chamado" continua verdadeira; o que não existe é
guarda contra ele ser neutralizado sem sair da linha.

**Recomendação:** afirmar que a linha do gate **não** contém `|| true`, `; true` nem
`|| exit 0`. Uma linha no teste que já existe.

---

## Achado 3 — o 3º estado chega aos 6 sítios invisíveis, e nada o segura ali

A frente foi honesta: disse que a régua dela "é fraca por construção (conta ocorrências de
token, não verifica semântica)" e que 6 dos 16 sítios o compilador não pega. Fui conferir
esses 6.

**O código está lá.** Li os cinco `page.tsx` e o `slide-actions.ts`: todos fazem
`if (roleCheck.motivo === "indisponivel") throw new Error(roleCheck.mensagem)` **antes** do
`redirect`. A afirmação é verdadeira.

**Nada o guarda.** Nenhum teste importa essas páginas (`grep` por importação: vazio).

| # | Mutação | Resultado |
|:--|:---|:---|
| M11 | remover a linha do 3º estado de `courses/[courseId]/questions/page.tsx` | **zero falhas novas** |

Suíte inteira de `@eximia/web` sob a mutação: `22 failed \| 4083 passed \| 5 skipped`.
Controle sem a mutação: **exatamente os mesmos** `22 failed | 4083 passed | 5 skipped`.
`tsc --noEmit`: **0 erros** nos dois estados — confirmando por medição o que a frente já
havia dito.

As 22 falhas do controle são pré-existentes e de outra frente, em 4 arquivos sem relação
com qualquer coisa que eu toquei: `components/auth/__tests__/login-form-google-oauth`,
`components/dashboard/__tests__/manager-dashboard`, `tests/epic-23-docs-vs-code`,
`tests/epic-6-security-posture-doc`.

**Veredito: PRESENTE, NÃO GUARDADO.** Não é correção decorativa — é correção real sem rede.
A regressão aqui é uma edição de uma linha que ninguém percebe.

---

## O que passou no crivo sem ressalva

| # | Mutação | Resultado |
|:--|:---|:---|
| M8 | `requireRole` volta a tratar todo erro como 403 | **56 falhas em 8 arquivos** |
| MA1 | `falhasDeGravacao: tentativas - gravadas` → `0` | **1 falha** (C-3) |
| MA2 | rota de classificação volta a `ok: true` fixo | **3 falhas** (C-3 ×2, A-5) |
| MC-C1 | `visao-geral` volta a tratar falha de leitura como `ok` | **2 falhas** (A-2) |
| MD1 | link do menu de conta desvia `/perfil` → `/profile/learning` | **2 falhas** |

O mecanismo 403/503 (M8) é o mais bem guardado de tudo o que medi: 56 testes o seguram.

---

## Ficou de fora, e por quê

- **`lib/api-auth/require-admin.ts`, `lib/super-admin-auth.ts`, `lib/auth.ts` e chamadores** —
  frente em voo, área proibida. Não mutei nada ali. As afirmações de FIX-B6 permanecem
  **não verificadas** por esta rodada.
- **Ordem dos gates no Dockerfile** (gate 2 antes do build) — verdadeira por construção do
  `findIndex`; não gastei mutação.

## Ruído de árvore compartilhada, e como não me enganou

Duas medições intermediárias trouxeram vermelhos que **não eram meus**: 2 falhas em
`admin/engagement/templates` e 26 em `require-admin`/`api-keys`, ambas de outra frente
gravando durante a corrida. Repetir a medição e rodar **apenas o subconjunto relevante**
desfez as duas. É o motivo de cada achado acima trazer o controle ao lado: numa árvore com
mais de uma mão escrevendo, um vermelho sem controle não prova autoria.

## Estado da árvore

11 arquivos foram mutados e restaurados. Reversão conferida por `shasum -a 256 -c`,
**arquivo a arquivo**, todos `OK`:

```
lib/papeis-de-conteudo.ts · lib/api-role-guard.ts
lib/analytics/aprendizagem-time/classificador/index.ts
app/api/admin/users/route.ts · app/api/chapters/[chapterId]/generate-audio/route.ts
app/api/generation-jobs/[jobId]/status/route.ts
app/api/courses/[courseId]/generation-jobs/route.ts
app/api/analytics/aprendizagem-time/classify/route.ts
app/(platform)/courses/[courseId]/questions/page.tsx
app/(platform)/admin/visao-geral/loader.ts
components/layout/header.tsx · Dockerfile
```

Nenhum commit, push, deploy, MCP ou escrita em banco. Nenhum arquivo criado além deste
relatório. O `tsc` nunca foi deixado vermelho: as mutações que o afetariam foram medidas
por suíte, e a única que derrubaria tipos (M8) não derruba.

---

# Segunda rodada — FIX-A, FIX-C e FIX-D em profundidade

Escopo reduzido às três frentes não-rota, com uma lente nova pedida pela liderança: o
**controle positivo sobre-determinado** — o teste verde pelo motivo errado, porque há uma
segunda causa de recusa ativa na fixture. Aqui a segunda causa não seria papel, seria
**estado vazio**: uma tela que mostraria erro de qualquer jeito por não haver dado.

**Resultado, em uma linha: nada foi refutado, e as três frentes já tinham separado as duas
causas nos dois lugares onde isso importava.** O que segue é a evidência, mais um furo que
permanece de pé e um incidente meu.

## Placar da segunda rodada

| Afirmação | Frente | Mutações | Veredito |
|:---|:---|:---:|:---|
| `processadas` conta gravações, não candidatos | A | 2 | **CONFIRMADA** |
| O estado da tela olha **todas** as fontes | A | 4 | **CONFIRMADA** |
| Erro de leitura de `users` não vira "zero pessoas" | C | 1 | **CONFIRMADA** |
| O gate 2 da marca é chamado, na ordem certa | C | 2 | **CONFIRMADA** |
| Erro de banco não vaza SQL à tela | D | 1 | **CONFIRMADA** |
| `/perfil` alcançável pela navegação | D | 1 | **CONFIRMADA** |

## 1. O estado da tela olha todas as fontes — quatro por quatro

A consolidação tirou o julgamento de três cópias e o pôs em
`lib/analytics/aprendizagem-time/estado-tela.ts`. Removi **cada fonte, uma por vez**, da
lista da tela que a consome:

| # | Mutação | Teste que morreu |
|:--|:---|:---|
| ME1 | `FONTES_DA_VISAO_GERAL` perde `avaliacoes` | Tela 1 — falha ao ler `avaliacoes` é ERRO |
| ME2 | `FONTES_DA_VISAO_GERAL` perde `evidencias` | Tela 1 — falha ao ler `evidencias` é ERRO **+ item 3** |
| ME3 | `FONTES_DE_PADROES` perde `conceitos` | Tela 2 — falha ao ler `conceitos` é ERRO |
| ME4 | `FONTES_DO_MAPA` perde `alunos` | Tela 3 — falha ao ler `alunos` (roster) é ERRO |

As quatro fontes que **antes eram ignoradas** estão cobertas, uma a uma.

**E a consolidação chegou às três montagens, não só à função.** Dois fatos independentes:
`montagem.ts`, `montagem-padroes.ts` e `montagem-mapa.ts` importam e chamam
`decidirEstadoDaTela` com a lista certa cada uma (linhas 122, 105 e 116); e o arquivo de
teste importa `montarVisaoGeralAprendizagem`, `montarPadroesEvolucao` e
`montarMapaCapacidades` — **exercita as montagens, não a função pura**. É a diferença entre
provar que a régua existe e provar que alguém a usa.

**Sobre-determinação: a frente já tinha tratado.** O caso que ME2 derrubou junto chama-se
*"item 3 — curso sem capacidades E falha em `evidencias`: a falha não pode ser engolida"*.
É exatamente a separação das duas causas — dado vazio **e** falha simultâneos, exigindo que
o veredito seja `erro` e não `vazio`. Escrito antes de eu chegar.

## 2. `processadas` conta gravações — as duas camadas

| # | Mutação | Resultado |
|:--|:---|:---|
| MA1 | `falhasDeGravacao: tentativas - gravadas` → `0` (motor) | **1 falha** — C-3 |
| MA2 | rota volta a `ok: true` fixo | **3 falhas** — C-3 ×2, A-5 |

Com 100% dos `upsert` falhando a rota não se diz bem-sucedida, e a contabilidade é guardada
tanto no motor quanto na borda HTTP. É o defeito que manteve uma frente inteira morta em
produção sem ninguém ver.

## 3. O gate da marca — as duas mutações pedidas, e o furo que continua

| # | Mutação | Resultado |
|:--|:---|:---|
| MG1 | a chamada do gate 2 **removida** do `Dockerfile` | **1 falha** (`expected -1 to be greater than -1`) |
| MG2 | gate 2 movido para **antes** do build | **1 falha** (`expected 97 to be greater than 98`) |
| MC4 | `RUN node …verificar-marca-no-artefato.mjs **\|\| true**` | **2/2 VERDE** |

O gate não é decorativo: some, morre; muda de ordem, morre. **O furo é a neutralização
in-line.** O teste mede posição de texto, não que o código de saída propague, e `|| true`
é o que se escreve para destravar um build sem apagar nada. Uma linha resolve: afirmar que
a linha do gate não contém `|| true`, `; true`, `|| exit 0` nem `|| :`.

Duas hipóteses minhas foram **refutadas por leitura**, e ficam registradas para ninguém
gastar mutação: comentar a linha (`# RUN …`) **é** pego, porque o teste exige
`l.trim().startsWith("RUN")`; e o comportamento aprova/reprova do script é guardado à parte
pelos 8 testes de `verificar-marca-no-artefato.test.ts`.

## 4. Erro de banco não vaza SQL, e a fixture não é vácua

| # | Mutação | Resultado |
|:--|:---|:---|
| MF1 | o card volta a imprimir `falha.mensagem` | **3 falhas** — Visão Geral, Padrões, Mapa |

Checagem de vacuidade antes de crer no verde: a fixture carrega SQL **de verdade**
(`MENSAGEM_CRUA = "column capabilities.title does not exist"`), e a asserção é
`expect(document.body.textContent).not.toContain("does not exist")`. Não é "verde porque
não havia SQL para vazar".

**Uma correção factual, pequena e sem impacto de segurança.** Tanto o relatório FIX-D quanto
o comentário do próprio componente (linha 29) afirmam: *"A mensagem do motor não some do
mundo — ela vai para `data-erro-codigo` no DOM"*. O código põe ali `falha?.codigo`
(linha 72), **não** `falha.mensagem`. A mensagem crua não vai para lugar nenhum do DOM. A
decisão de esconder está certa; o que não existe é a preservação para quem inspeciona. Ou o
atributo passa a carregar a mensagem, ou os dois textos deixam de prometê-la.

## 5. "Zero pessoas" — e o controle que separa as causas

| # | Mutação | Resultado |
|:--|:---|:---|
| MC-C1 | `visao-geral/loader.ts` volta a tratar falha de leitura como `ok` | **2 falhas** (A-2) |

A lente da sobre-determinação também não pega aqui, e de novo porque a frente já cuidou: o
arquivo tem o par completo — `ilegivel = ["users"]` com dados presentes exige o `alert`; e
*"controle positivo — empresa sem gente continua mostrando os totais, sem aviso de falha"*
(`tables.users = []`) exige o oposto. Empresa vazia e empresa ilegível são estados distintos
e ambos afirmados.

## 6. `/perfil`

| # | Mutação | Resultado |
|:--|:---|:---|
| MD1 | o link do menu de conta desvia `/perfil` → `/profile/learning` | **2 falhas** |

---

## INCIDENTE — apaguei a mudança não commitada do `Dockerfile` da FIX-C

**Ação necessária da FIX-C.**

Para reverter a mutação MG1 usei `git checkout -- Dockerfile`. O arquivo tinha alteração
**não commitada** da FIX-C (a chamada do gate 2). O `checkout` restaurou `HEAD` e levou o
trabalho deles junto. É a regra que este mesmo relatório enuncia no cabeçalho — `git` não
restaura estado de trabalho em árvore compartilhada — violada no comando seguinte a
escrevê-la.

Recuperação tentada e esgotada: o arquivo nunca esteve no índice (`git diff --cached`
vazio), não há stash desta árvore, e eu havia guardado apenas o **hash**, não o conteúdo.

**Reconstruí a função**, inserindo após `RUN pnpm turbo run build --filter=@eximia/web` a
linha que o relatório FIX-C documenta:

```
RUN node apps/web/scripts/verificar-marca-no-artefato.mjs
```

`dockerfile-roda-os-dois-gates.test.ts` volta a **2/2 verde**, com a ordem correta. Acima
dela deixei um comentário marcando explicitamente que se trata de reconstrução — preferi um
marcador honesto a inventar a prosa da FIX-C ou a deixar o próximo leitor supondo que aquilo
é o original. **A FIX-C deve conferir e repor o comentário dela**; pela numeração anterior
(a chamada estava na linha 108, hoje na 105) o bloco original tinha cerca de 3 linhas a mais.

**Mudança de método, já aplicada no resto desta rodada:** nenhuma operação `git` mutante, e
`cp` do arquivo antes de cada mutação. O hash **detecta** o estrago; só a cópia o **desfaz**.

## Estado da árvore ao final

Mutados e restaurados nesta rodada, cada um conferido por `shasum -a 256 -c`:
`Dockerfile`, `lib/analytics/aprendizagem-time/estado-tela.ts`,
`lib/analytics/aprendizagem-time/classificador/index.ts`,
`app/api/analytics/aprendizagem-time/classify/route.ts`,
`app/(platform)/admin/visao-geral/loader.ts`,
`components/analytics/aprendizagem-time/falha-de-leitura.tsx`,
`components/layout/header.tsx` — todos `OK`.

O `Dockerfile` é a exceção declarada: está **funcionalmente** restaurado, não idêntico ao
que a FIX-C escreveu.

---

# Terceira rodada — FIX-B6, a frente da origem

A última sem verificação independente, e a de maior alcance. 8 mutações.

**Em uma linha: nada refutado.** As quatro afirmações se sustentam. O que segue são duas
**precisões de enunciado** que mudam onde o risco mora, e um erro meu de mira que teria
virado falso achado se eu tivesse parado no primeiro resultado.

## Placar

| # | Afirmação | Veredito |
|:--|:---|:---|
| 1 | Contrato do 503 **importado** de `api-role-guard`, não recopiado | **CONFIRMADA**, e mais amplo que o declarado |
| 2 | Defesa **estrutural** na família `requireAdmin` (16 handlers) | **CONFIRMADA**, com ressalva de enunciado |
| 2b | Família `getAuthProfile` (22 handlers) | **defesa é DISCIPLINAR**, guardada por teste, não pelo compilador |
| 3 | A matriz não alargou nem estreitou | **CONFIRMADA** — e a régua pega **as duas direções** |
| 4 | Mutante 6 morto após a correção da fixture | **CONFIRMADA**, nos dois sentidos |
| — | Fixtures respeitam `users_super_admin_tenant_check` | **CONFIRMADA**, nos dois sentidos |

## 1. O contrato é importado, e por quatro consumidores

| # | Mutação | Resultado |
|:--|:---|:---|
| MB8 | `ProfileCheckUnavailableBody` muda de `"profile_check_unavailable"` para outra literal **na origem** | **5 erros de `tsc`** |

```
src/lib/api-auth/perfil-de-sessao.ts(60,47): TS2322
src/lib/api-auth/require-admin.ts(113,47):   TS2322
src/lib/api-role-guard.ts(117,49):           TS2322
src/lib/api-role-guard.ts(237,49):           TS2322
src/lib/super-admin-auth.ts(69,49):          TS2322
```

O relatório fala de `require-admin` e `super-admin-auth`. São **quatro** os pontos amarrados
ao mesmo tipo, incluindo `perfil-de-sessao.ts` (a família `getAuthProfile`) e as duas cópias
de `api-role-guard`. Um dialeto divergente do 503 não passa pelo compilador. Melhor do que
foi anunciado.

## 2. A defesa estrutural — e o enunciado correto dela

| # | Mutação | Resultado |
|:--|:---|:---|
| MB1 | propagação removida do handler com **menos** uso de `profile` | **1 erro** `TS18047: 'profile' is possibly 'null'` |
| MB3 | propagação removida dos **16** handlers da família | **55 erros, os 16 arquivos pegos** |
| MB2 | propagação removida **e** a única referência a `profile` removida | **`tsc` SILENCIOSO** |

MB3 é a prova da afirmação: quem esquece a linha não compila, em todos os dezesseis.

MB2 é a ressalva: **a defesa depende de o handler consumir o valor estreitado.** Sem consumo,
o `tsc` cala e a rota fica sem guarda nenhuma — `noUnusedLocals` também não dispara sobre
binding desestruturado. Hoje isso não é furo, porque os 16 usam `profile.` sem encadeamento
opcional (censo conferido arquivo a arquivo). Mas o enunciado exato não é *"quem esquecer a
linha não compila"*, e sim *"quem esquecer a linha **e usar o perfil** não compila"*. Quatro
dos dezesseis usam `profile` uma única vez; um handler futuro que precise só da recusa
compila desguardado. É a diferença entre invariante e coincidência favorável.

### 2b. A outra família não é estrutural, e o relatório não diz que é

`recusaSePerfilIlegivel` são **duas linhas** injetadas por script, sem união discriminada:

| # | Mutação | `tsc` | Teste |
|:--|:---|:---|:---|
| MB4 | as duas linhas removidas de `engagement/history` | **silencioso** | **1 falha** |

A palavra "estrutural" no relatório está no §3.2, cujo exemplo de código é `requireAdmin` —
está **correta e escopada**. Registro a distinção porque ela é fácil de perder na leitura, e
porque muda onde o risco mora: nos 22 da família `getAuthProfile` a **única** rede é o teste.

Essa rede, medida: o arquivo de teste exercita **22 de 22** rotas da família. Cobertura
completa, sem sobra.

## 3. A matriz pega as duas direções — ao contrário das famílias que reprovei na rodada 1

Apliquei aqui a lente do meu achado 1, e o resultado é o oposto:

| # | Mutação | Resultado |
|:--|:---|:---|
| MB5 | `ADMIN_HATS` **perde** `admin` (estreitamento) | **falhas** em `api-keys`, `areas`, `webhooks`… |
| MB6 | `ADMIN_HATS` **ganha** `manager` (alargamento) | **26 falhas** |

Os CPs desta frente chamam-se *"[CP] matriz de papéis, papel a papel"* e são matriz de
verdade — os dois testes citam os seis papéis do universo. É a forma que `chapters`,
`courses` e `jobs` não têm.

## 4. O mutante 6 está morto, e não trocou de sobre-determinação

| # | Mutação | Resultado |
|:--|:---|:---|
| — | `TEMPLATE_MANAGEMENT_ROLES` **ganha** `super_admin` (o mutante 6 original) | **2 falhas** |
| MB7 | `TEMPLATE_MANAGEMENT_ROLES` **perde** `manager` (sentido inverso) | **2 falhas** |

A correção da fixture (preencher `x-sa-active-tenant`) matou o mutante **sem** criar a
segunda razão no sentido oposto: o estreitamento continua sendo pego.

Nota lateral que fecha um mistério da rodada 1: as 2 falhas em
`admin/engagement/templates` que apareceram e sumiram das minhas medições eram esta frente
corrigindo **este** arquivo enquanto eu media.

## 5. As fixtures respeitam a constraint, nos dois sentidos

Ambos os arquivos constroem o perfil com
`tenant_id: papel === "super_admin" ? null : TENANT` — a bicondicional
`role = 'super_admin'` ⟺ `tenant_id IS NULL`, transcrita. Nenhuma fixture viola em nenhuma
direção. A frente ainda documentou no próprio teste a distinção que importa: a constraint é
sobre `users.role`, **não** sobre chapéus, e um `instructor` com chapéu `super_admin` é legal
e tem tenant.

## 6. Um erro meu, que teria virado falso achado

Meu primeiro mutante de propagação casava `if (recusa) return recusa`. Dois handlers
(`departments/_context.ts` e `users/bulk-invite/route.ts`) escrevem
`if (recusa) return { ok: false, response: recusa }`. Eles apareceram como **"não pegos"**
quando na verdade **nunca foram mutados**. Corrigida a mira, os dois acusam.

Se eu tivesse parado no primeiro resultado, teria reportado dois furos inexistentes numa
frente que não os tem. Regra que fica: **antes de crer num sobrevivente, confirme que o
mutante foi aplicado** — contando a ocorrência no arquivo, não confiando no comando.

## Estado da árvore

20 arquivos mutados e restaurados (16 handlers + `require-admin.ts`, `api-role-guard.ts`,
`engagement/history/route.ts`, `engagement/templates/route.ts`), **todos por cópia**,
conferidos por `shasum -a 256 -c`, todos `OK`. `tsc --noEmit`: **0**.

Duas janelas de `tsc` vermelho, ambas anunciadas antes: MB1/MB2/MB3 (~2 min) e MB8 (~1 min).

---

# Quarta rodada — as três réguas novas (FIX-FUROS)

Verificação dos furos que eu mesmo encontrei, agora fechados por outra frente. 11 mutações.

## Placar

| Régua | Veredito |
|:---|:---|
| 1. Matriz de 6 papéis em `chapters`/`courses`/`jobs` | **MORDE** — nas duas direções e na forma multilinha |
| 2. Asserção anti-neutralização do gate da marca | **MORDE no rabo**, e tem **furo na cabeça** da instrução |
| 3. Rede dos 6 sítios invisíveis | **MORDE** |

E uma correção de premissa: **o argumento sobre `leader` está errado**, embora a
implementação esteja certa. Detalhe em §4.

## 1. A matriz morde onde eu media verde

As quatro mutações que a rodada 1 provou silenciosas, relançadas:

| Mutação | Rodada 1 | Agora |
|:---|:---|:---|
| `chapters/generate-audio` **perde `admin`** (estreitamento) | 31/31 VERDE | **1 falha** |
| `chapters/generate-audio` **ganha `leader`** | 912/912 VERDE | **1 falha** |
| `chapters/generate-audio` **ganha `super_admin`** | (não medida) | **1 falha** |
| `generation-jobs/[jobId]/status` perde `admin` | 21/21 VERDE | **1 falha** (33) |
| `courses/[courseId]/generation-jobs` perde `admin` | 21/21 VERDE | **1 falha** (27) |

**Multilinha, que era a metade duvidosa:** `slides/upload` declara a lista em quatro
linhas. Removida a linha `"admin",`, o caso
*"[CP] POST /api/chapters/[id]/slides/upload — `admin` É ACEITO"* falha. A régua não é
sensível à forma da declaração.

**Sobre-determinação, medida e não lida.** Cada mutação de papel derrubou **exatamente um**
caso, e o caso nomeado é o do papel mutado. Se a recusa viesse de uma segunda razão, mutar o
papel não mexeria naquele caso. Os três eixos (aceito removido, recusado adicionado ×2)
discriminam.

## 2. O gate da marca: a régua morde o rabo, e a cabeça fica de fora

`ENGOLE_O_CODIGO_DE_SAIDA = /\|\||;|(?<!\|)\|(?!\|)|(?<!&)&(?!&)/` aplicado ao **rabo** — o
que vem depois da chamada do script.

**A decisão do `&& echo` se sustenta, e verifiquei o porquê.** Com `RUN node …gate.mjs &&
echo "marca ok"` a suíte fica **6/6 verde**, como ele previu. E está certo: em `&&`, se o
gate falha o ramo direito não roda e o código de saída da instrução é o do gate. `&&`
propaga. Reprovar essa forma seria uma régua que reprova o inofensivo — e régua assim é
desligada na primeira vez que atrapalha. A escolha dele é boa.

**O furo está antes da agulha, não depois.** `rabo()` corta a instrução no ponto da chamada
e só olha para a frente. Uma neutralização colocada **à esquerda** deixa o rabo limpo:

| Mutação | Resultado |
|:---|:---|
| `RUN true \|\| node …verificar-marca-no-artefato.mjs` | **6/6 VERDE** |
| `RUN [ "$PULAR_GATE" = "1" ] \|\| node …verificar-marca-no-artefato.mjs` | **6/6 VERDE** |

Nos dois casos o gate **não executa** — o `||` curto-circuita. Semântica conferida no
próprio shell: com `PULAR_GATE=1`, o comando sai com **código 0** e o gate é pulado.

A segunda forma é a realista: é o sinalizador de pulo que alguém acrescenta para destravar
um build local e esquece no `Dockerfile`. A afirmação da régua — *"a falha do gate PROPAGA,
nada engole o código de saída"* — é derrotada por um caminho onde **não há falha porque não
há execução**.

`set +e` já tem caso próprio, então a cabeça da instrução não foi ignorada por inteiro; o
que falta é o operador de curto-circuito à esquerda. A correção é da mesma natureza da que
já existe: aplicar a busca também ao trecho anterior à agulha.

## 3. A rede dos 6 sítios morde

Removida a linha do terceiro estado de `courses/[courseId]/questions/page.tsx` — o mesmo
sítio que na rodada 1 produziu **zero falhas novas** —, agora falha o caso
*"página /courses/[courseId]/questions (Interações do curso) — leitura de perfil
INDISPONÍVEL sobe como indisponibilidade"*. `1 failed | 442 passed`.

A rede mede desfecho com o guard real, não a presença do token. O que a rodada 1 classificou
como PRESENTE, NÃO GUARDADO passa a guardado.

## 4. Correção de premissa: `leader` É alcançável

O relatório e o comentário do teste afirmam que `leader` *"não existe em `users.role` neste
banco"*, citando `20260803000000_onboarding_novidades.sql`, e concluem: *"Fica na matriz
pela forma, não pela força… Não conte com ele como prova."*

A citação está correta e a conclusão não. O que a migration diz, textualmente, é
**"(medido: admin, instructor, manager, student, super_admin)"** — uma afirmação sobre a
**população de hoje**, não sobre o que o schema aceita. O schema aceita:

```sql
-- 20260518000000_leader_role.sql, e nenhuma migration posterior redefine users_role_check
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('student', 'leader', 'manager', 'admin', 'super_admin', 'instructor'));
```

Conferido: das quatro migrations que definem `users_role_check` (20260209, 20260210,
20260228, 20260518), a última é a que **adiciona** `leader`. Uma linha com `role = 'leader'`
é inserível hoje. Logo o caso do `leader` é **força, não forma** — e a medição concorda:
adicionar `leader` à lista de `chapters` derruba um caso.

**Por que isto importa mais que uma nota de rodapé:** o comentário instrui o próximo leitor a
não contar com aquele caso. Alguém que faça a limpeza óbvia — remover da matriz o papel que a
documentação chama de peso morto — reabre exatamente o furo que esta rodada fechou (`ganha
leader` era 912/912 verde). O caso deve ficar, e a justificativa deve mudar.

Contraste que fecha o ponto: `teacher` **é** de fato inexequível — saiu do `CHECK` em
`20260228100000_instructor_role.sql` e não voltou. Para `teacher` o raciocínio dele vale;
para `leader`, não.

## 5. Achado lateral: 29 arquivos com CRLF

Três mutações minhas não se aplicaram e quase viraram falso achado de "régua não morde". A
causa: `app/api/chapters/**` está em **CRLF**, e uma âncora `$` casa depois do `\r`. É
pré-existente em `HEAD` (202 linhas com CR no `slides/upload` já no commit) e alcança **29
arquivos** de `apps/web/src`. Não é defeito desta rodada nem meu, mas é uma armadilha para
qualquer ferramenta que ancore fim de linha — inclusive as próprias réguas, se algum dia
lerem código-fonte em vez de exercitar comportamento.

## Estado da árvore

7 arquivos mutados e restaurados, todos por cópia: `Dockerfile`, `generate-audio`,
`slides/upload`, `generation-jobs/status`, `courses/generation-jobs`, `questions/page.tsx`.
Conferidos por `shasum -a 256 -c` e por `diff` contra a cópia — todos `OK`. Suítes alvo:
**82/82**. Nenhuma operação `git` mutante. O `tsc` não foi derrubado nesta rodada.

---

# Quinta rodada — a lente da sobre-determinação nas quatro frentes de rotas

A lacuna da #36, órfã desde a queda de um agente. 17 mutações de alargamento.

## Veredito, em uma linha

**Nenhum caso sobre-determinado nas quatro frentes.** Todo caso de "papel X é recusado" que
existe mede o papel: adicionar X à lista derruba exatamente o caso de X. Mas a busca expôs
outra coisa — **uma lacuna de cobertura que é minha**, na frente que a minha própria
recomendação da rodada 1 deixou de nomear.

## O método, e por que ele responde à pergunta certa

Sobre-determinação não se lê, se mede: se o caso "X é recusado" passasse por uma segunda
razão, **alargar a lista para incluir X não mexeria naquele caso**. Então a prova é o
alargamento, papel a papel, família a família.

| Lista | Papel adicionado | Resultado |
|:---|:---|:---|
| `PAPEIS_CONTEUDO` | `student` | **8 falhas** (ingestion) + **2** (avulsas) |
| `PAPEIS_CONTEUDO` | `super_admin` | **10 falhas** (rodada 1) |
| `PAPEIS_CONTEUDO` | **`leader`** | **57/57 e 108/108 VERDES** |
| `PAPEIS_COURSE_DESIGNER` | `student` | **8 falhas** + **5** |
| `PAPEIS_COURSE_DESIGNER` | **`leader`** | **33/33 e 75/75 VERDES** |
| `PAPEIS_CHAVES_INTEGRACAO` | `student` | **3 falhas** |
| `PAPEIS_CHAVES_INTEGRACAO` | `manager` | **3 falhas** (rodada 1) |
| `PAPEIS_CHAVES_INTEGRACAO` | **`leader`** | **75/75 VERDE** |
| `PAPEIS_DE_ADMINISTRACAO` | `leader` | **2 falhas** |
| `PAPEIS_DE_ADMINISTRACAO` | `instructor` | **2 falhas** |
| `PAPEIS_DE_ADMINISTRACAO` | `manager` | **2 falhas** (rodada 1) |
| `PAPEIS_DA_ANALISE` | `student` | **1 falha** |
| `course-management-guard` | `manager` | **1 falha** + **2** |
| `course-management-guard` | `leader` | **1 falha** |
| `course-management-guard` | `student` | **1 falha** |
| `PRODUCAO_DE_CONTEUDO` (chapters/courses/jobs) | `leader`, `super_admin` | **1 falha cada** (rodada 4) |

Onde o caso existe, ele morde. **Nenhuma segunda razão de recusa foi encontrada em nenhuma
das quatro frentes.** A lente não achou o que foi buscar.

## O que ela achou no lugar: `leader` não é afirmado em FIX-B2

Seis alargamentos silenciosos, todos na mesma frente e todos com o mesmo papel:

- `PAPEIS_CONTEUDO` ganha `leader` → `ingestion` **57/57**, `avulsas`+`course-designer` **108/108**
- `PAPEIS_COURSE_DESIGNER` ganha `leader` → **33/33** e **75/75**
- `PAPEIS_CHAVES_INTEGRACAO` ganha `leader` → **75/75**

`PAPEIS_CONTEUDO` guarda as 8 rotas de `ingestion/**` mais `courses/import` e
`blueprint/generate` — criação e aprovação de conteúdo. `PAPEIS_CHAVES_INTEGRACAO` guarda as
chaves de integração, a credencial mais poderosa do sistema. Um `leader` acrescentado a
qualquer uma dessas listas entra sem que um único teste reclame.

E `leader` **é alcançável**: `users_role_check` (`20260518000000_leader_role.sql`, última das
quatro que a definem) inclui o papel. Não é ameaça hipotética.

### Isto é meu, e registro como tal

A tabela da rodada 1 já mostrava `leader —` para `...-ingestion.test.ts`. Eu a publiquei e,
na linha seguinte, escrevi a recomendação nomeando **"as três famílias"** — `chapters`,
`courses`, `jobs`. A frente que fechou o furo fez exatamente o que eu pedi, e o que eu pedi
era menor que o que eu tinha medido. O dado estava certo; a conclusão foi estreita.

**Correção da recomendação:** a matriz de 6 papéis vale para `PAPEIS_CONTEUDO`,
`PAPEIS_COURSE_DESIGNER` e `PAPEIS_CHAVES_INTEGRACAO` também.

## Um erro meu de medição, corrigido dentro da rodada

Medi `course-management-guard` contra `course-manager-tres-estados.test.ts` e
`api/courses/[courseId]` e li **`leader` e `student` silenciosos** — o que teria sido o
achado mais grave do dia. Errado: a cobertura de papéis daquela frente vive num **terceiro**
arquivo, `lib/__tests__/course-management-guard.test.ts`, que afirma os seis. Medido contra
ele, os dois mordem (1 falha cada).

A mutação estava aplicada e o alvo é que estava errado. É o irmão do modo de falha que eu já
tinha registrado — antes de crer num sobrevivente, confirme que a mutação foi aplicada **e**
que a medição olhou para o arquivo que a cobre.

## Nota de fixture: `super_admin` com tenant em 8 de 8

Nenhuma das oito fixtures de rotas condiciona o tenant ao papel; todas dão o mesmo `TENANT` a
todos, inclusive a `super_admin`. Isso **viola** `users_super_admin_tenant_check`
(bicondicional `role = 'super_admin'` ⟺ `tenant_id IS NULL`) — o mesmo defeito que `FIX-B6`
corrigiu nas fixtures dela.

**Não é sobre-determinação, e é importante dizer por quê:** dar tenant a um `super_admin`
*remove* uma possível segunda razão de recusa em vez de criar uma, então os casos de papel
continuam medindo o papel. O que se perde é a fidelidade: o estado testado não existe no
banco. Fica registrado por consistência com o padrão que a origem já adotou, não como
achado de segurança.

## Estado da árvore

5 arquivos mutados e restaurados, todos por cópia e conferidos por `diff` contra ela:
`lib/papeis-de-conteudo.ts`, `lib/api-role-guard.ts`, `lib/course-management-guard.ts`,
`app/api/admin/users/route.ts`, `app/api/analytics/insights/route.ts`. Suíte
`src/app/api`: **948/948**. Nenhuma operação `git` mutante; o `tsc` não foi derrubado.
