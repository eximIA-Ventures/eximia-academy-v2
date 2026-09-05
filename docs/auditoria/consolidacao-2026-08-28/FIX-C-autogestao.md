# FIX-C — Autogestão e gate de identidade de marca

> Executado em 2026-08-29 sobre `integra/main-cory`, a partir de `d2b8083`.
> Método: **teste vermelho primeiro, saída colada, correção depois, verde**. Nenhum commit,
> nenhum push, nenhuma escrita no banco. Onde o vermelho não podia vir "antes" (correção já
> aplicada, ou asserção acrescentada depois), o vínculo foi provado por **mutação** — o
> defeito é reintroduzido no código e a saída vermelha é colada igual.

## Placar

| Frente | Vermelho antes | Verde depois | Prova extra |
|---|---|---|---|
| 1. Erro de leitura de `users` vira "zero pessoas" (A-2) | 4 testes | 5 testes | 2 mutações |
| 2. Gate 2 da marca, que o código dizia existir (A-3) | 7 de 8 testes | 8 testes + 2 do Dockerfile | 1 mutação |
| 3. Falhas silenciosas da Autogestão / Jornada (LOOP-0c) | 3 testes | 6 testes | controles positivos pareados |

Suítes ao final: `analytics` **1059/1059**, `jornada` **181/181**, `admin/visao-geral` **10/10**,
`lib/__tests__` **349/349**. `tsc --noEmit` sai **0**.

---

## Frente 1 — "não consegui ler a população" deixou de se parecer com "a empresa não tem ninguém"

**Achado:** A-2 do `LOOP-1-tecnico.md` (o briefing o chamou de A-3; o achado com esse texto é o
A-2). Vive em `apps/web/src/lib/analytics/admin-overview.ts:216-227`, não sob
`lib/analytics/autogestao/**` — registro a divergência de path, mas o achado é o que o briefing
nomeia, então foi tratado.

`readTenantUsers` devolvia `TenantUserRow[]`. Não havia canal de falha: a informação de que a
leitura quebrou nascia dentro de `readAll` e morria na saída. Qualquer erro na primeira
projeção disparava um fallback desenhado para OUTRA coisa (a coluna `last_seen_at` poder não
existir antes da migration); se o soluço persistisse, a função devolvia `[]` e
`/admin/visao-geral` renderizava a empresa com **0 pessoas, funil vazio, engajamento zerado**,
sem erro, sem "—", sem retry.

### O vermelho (antes)

`apps/web/src/lib/analytics/__tests__/populacao-ilegivel.test.ts`

```
 ❯ src/lib/analytics/__tests__/populacao-ilegivel.test.ts (4 tests | 4 failed) 9ms
   × ... > leitura de `users` que falha na PRIMEIRA página é reportada como falha
     → expected undefined to be 'users' // Object.is equality
   × ... > empresa genuinamente vazia continua sendo 'vazia', nunca 'falha' (controle positivo)
     → expected undefined to be null
   × ... > leitura de `users` truncada na SEGUNDA página não passa por completa
     → expected undefined to be 'users' // Object.is equality
   × ... > coluna ausente (42703) continua caindo na projeção enxuta, sem virar falha
     → expected undefined to be null
```

E na superfície, `apps/web/src/app/(platform)/admin/visao-geral/__tests__/falha-de-leitura.test.tsx`:

```
 ❯ .../falha-de-leitura.test.tsx (3 tests | 2 failed) 123ms
   × ... > o loader devolve um estado de FALHA, não um 'ok' com zero pessoas
     → expected 'ok' to be 'read-failed' // Object.is equality
   × ... > a tela mostra que não conseguiu ler, e NÃO 'Pessoas na empresa: 0'
     → Unable to find an accessible element with the role "alert"
   ✓ ... > controle positivo — empresa sem gente continua mostrando os totais, sem aviso de falha
```

O terceiro caso já passava antes da correção — é o **controle positivo**, e é ele que impede
que a solução seja "banner permanente". A tela com a população ilegível renderizava
normalmente, com todos os zeros no lugar.

### O que mudou

- `TolerantRead<T>` ganhou `error`, e `readAll` passou a devolver `{ rows: [], available: false }`
  em falha de **qualquer** página. Antes era `available: offset > 0` — uma leitura que quebrava
  na página 2 voltava marcada como completa (achado **A-1**, mesma função). Não é frente
  separada: sem fechar essa porta, qualquer sinal de falha continuaria contornável a partir da
  segunda página, e a frente 1 seria decorativa. Fica registrado que A-1 não estava na minha
  lista e foi corrigido por ser a precondição da minha.
- O fallback da projeção enxuta passou a ser **nomeado**: só dispara em `42703`
  (`undefined_column`), que é o único caso para o qual foi desenhado.
- `AdminOverview` ganhou `readFailure: { source, message } | null`. Só entra aqui a fonte cuja
  ausência corrompe a leitura inteira (`users`, denominador de tudo). `certificates` continua
  virando `null` → "—" na tela, que é a forma certa para ela.
- `loadAdminOverviewPage` ganhou `kind: "read-failed"` e a página passou a renderizar um
  `role="alert"` dizendo que não conseguiu ler, em vez dos zeros.

### As duas mutações

Prova de que os testes prendem as linhas certas, e não apenas a existência do campo novo.

**Mutação A** — `readAll` de volta ao `available: offset > 0`:

```
   ✓ ... > leitura de `users` que falha na PRIMEIRA página é reportada como falha
   ✓ ... > empresa genuinamente vazia continua sendo 'vazia', nunca 'falha' (controle positivo)
   × ... > leitura de `users` truncada na SEGUNDA página não passa por completa
   ✓ ... > coluna ausente (42703) continua caindo na projeção enxuta, sem virar falha
      Tests  1 failed | 3 passed (4)
```

**Mutação B** — remover o gate `if (!isMissingColumn(...)) return enriched` (fallback volta a
resgatar qualquer erro):

```
   × ... > erro QUALQUER não é resgatado pelo fallback: timeout vira falha, não projeção enxuta
      Tests  1 failed | 4 passed (5)
```

Essa quinta asserção foi acrescentada **depois** da correção, e é por isso que ela vem com
mutação: sem ela, o gate do `42703` só estava preso numa direção.

### Arquivos

| Arquivo | O que |
|---|---|
| `apps/web/src/lib/analytics/admin-overview.ts` | `readAll`, `readTenantUsers`, `readFailure` |
| `apps/web/src/app/(platform)/admin/visao-geral/loader.ts` | novo `kind: "read-failed"` |
| `apps/web/src/app/(platform)/admin/visao-geral/page.tsx` | ramo de falha com `role="alert"` |
| `apps/web/src/lib/analytics/__tests__/populacao-ilegivel.test.ts` | novo, 5 testes |
| `apps/web/src/app/(platform)/admin/visao-geral/__tests__/falha-de-leitura.test.tsx` | novo, 3 testes, banco → pixel |

> **Nota de escopo:** `page.tsx` é "componente de tela", área nominalmente de outro colega. A
> edição foi de um ramo novo isolado (`read-failed`), sem tocar nos existentes, porque o
> critério "falha precisa chegar à tela como falha" não é verificável sem ela.

---

## Frente 2 — o gate 2 da marca passou a existir e a ser chamado

**Achado A-3.** O cabeçalho de `apps/web/scripts/verificar-marca.mjs` afirma, textualmente:

> `GATE 1 DE 2 — ... O gate 2 é verificar-marca-no-artefato.mjs, que roda DEPOIS e mede o que o
> Next realmente inlinou. Este aqui só olha a DECLARAÇÃO; sozinho ele não prova nada sobre o
> produto, e é por isso que existem dois.`

O arquivo não existia. O único gate que rodava era aquele que o próprio autor declara não
provar nada sobre o produto.

### O vermelho (antes)

`apps/web/src/lib/__tests__/verificar-marca-no-artefato.test.ts`

```
 ❯ src/lib/__tests__/verificar-marca-no-artefato.test.ts (8 tests | 7 failed) 356ms
   × gate 2 — build de cliente > APROVA quando a identidade declarada está de fato inlinada
     → expected 1 to be +0 // Object.is equality
   × gate 2 — build de cliente > REPROVA o build que declara o cliente e entrega o bundle NEUTRO
     → expected 'node:internal/modules/cjs/loader:1456…' to match /NEXT_PUBLIC_TENANT_SLUG|cory-alimentos/
   × gate 2 — build de cliente > REPROVA quando só PARTE da identidade foi inlinada (marca pela metade)
     → expected 'node:internal/modules/cjs/loader:1456…' to match /LOGO_LIGHT/
   × gate 2 — build neutro declarado > APROVA o neutro declarado cujo artefato é de fato o neutro
     → expected 1 to be +0 // Object.is equality
   × gate 2 — build neutro declarado > REPROVA o neutro declarado cujo artefato saiu com marca de cliente
     → expected 'node:internal/modules/cjs/loader:1456…' to match /neutro/i
   × gate 2 — ausência de informação REPROVA > sem MARCA_ESPERADA_SLUG, reprova — igual ao gate 1
     → expected 'node:internal/modules/cjs/loader:1456…' to match /MARCA_ESPERADA_SLUG/
   ✓ gate 2 — ausência de informação REPROVA > artefato inexistente reprova
   × gate 2 — ausência de informação REPROVA > artefato sem nenhum arquivo .js reprova
     → expected 'node:internal/modules/cjs/loader:1456…' to match /nenhum/i
```

O `MODULE_NOT_FOUND` no lugar da mensagem **é** o achado: o binário que o cabeçalho anuncia não
existe. Registro que o caso "artefato inexistente" passou por vacuidade nesse vermelho (o
script não existia, então o exit era ≠ 0 pelo motivo errado); depois da implementação ele passa
pelo motivo certo, com a mensagem sobre o artefato.

### O gate implementado

`apps/web/scripts/verificar-marca-no-artefato.mjs` abre os `.js` do artefato e procura os
**bytes** da identidade. Segue o princípio já estabelecido nesta casa (commits `13f090d` e
`9618c32`): **ausência de informação reprova, nunca vira OK**.

| Situação | Veredito |
|---|---|
| `MARCA_ESPERADA_SLUG` ausente | REPROVA (Regra 0, idêntica à do gate 1) |
| Diretório do artefato inexistente | REPROVA — "não achei o que medir" nunca é OK |
| Artefato sem um único `.js` | REPROVA |
| Cliente declarado, identidade visível inlinada | aprova |
| Cliente declarado, bundle saiu neutro | REPROVA, nomeando a variável que sumiu |
| Cliente declarado, **parte** da identidade inlinada | REPROVA (marca pela metade) |
| `neutro` declarado, artefato de fato neutro | aprova |
| `neutro` declarado, artefato com marca de cliente | REPROVA |

Dois cuidados deliberados, escritos no cabeçalho do próprio script para o próximo leitor não
presumir cobertura que não há — que é exatamente o pecado que o gate 1 cometeu ao anunciar este
arquivo antes dele existir:

1. **Ele prova presença dos bytes certos, não ausência dos errados.** Um bundle de cliente pode
   carregar literais neutros como sobra do `??` não dobrado pelo minificador; afirmar que isso
   fosse sintoma produziria reprovação falsa, e reprovação falsa mata um gate mais rápido que
   falso-OK.
2. **O neutro é lido da FONTE** (`tenant.config.ts`), nunca copiado — mesma doutrina do
   `idsDeModuloValidos()` do gate 1. Uma segunda cópia envelheceria em silêncio.

Rodapé, e-mail de suporte e módulos ficaram **fora** da lista medida: o gate 1 já exige a
declaração deles e eles não têm presença garantida no bundle do navegador.

### O gate está sendo chamado (a segunda metade do A-3)

Um gate que ninguém chama não é um gate. `Dockerfile` ganhou, **depois** do
`pnpm turbo run build`, a linha `RUN node apps/web/scripts/verificar-marca-no-artefato.mjs`.

Vermelho capturado por mutação (a chamada removida do Dockerfile), em
`apps/web/src/lib/__tests__/dockerfile-roda-os-dois-gates.test.ts`:

```
   ✓ Dockerfile — os dois gates da marca são de fato chamados > chama o gate 1 (declaração) antes do build
   × Dockerfile — os dois gates da marca são de fato chamados > chama o gate 2 (artefato) DEPOIS do build
     → expected -1 to be greater than -1
```

A ordem faz parte do contrato e está afirmada: gate 1 antes do build, gate 2 depois. Um gate 2
colocado antes mediria o artefato da imagem anterior, ou nada.

---

## Frente 3 — falhas silenciosas da Autogestão e da Jornada

### 3a. O teto de paginação era um truncamento sem marca (LOOP-0c, E→PARCIAL #2 / E→ENGOLIDO #2)

`apps/web/src/lib/analytics/autogestao/fonte-supabase.ts`. A função `ler()` paginava até
`MAX_PAGINAS = 50`. Sair do laço **por esgotar o teto** devolvia `{ linhas, falha: null }`:
50.000 linhas de um conjunto maior, entregues como se fossem o total. Nenhum erro acontece
nesse caminho, então nada nesta camada sabia que faltou dado.

**Vermelho:**

```
 ❯ .../teto-de-paginacao-nao-vira-fim-do-dado.test.ts (2 tests | 1 failed) 6ms
   × ... > esgotar o teto de páginas vira FALHA, não um conjunto completo menor
     → expected null not to be null
   ✓ ... > controle positivo — leitura que termina numa página curta continua sem falha
```

**Correção:** só existe um jeito honesto de sair do laço com `falha: null` — uma página CURTA,
que prova que o banco acabou. Esgotar o teto passa a devolver `{ linhas: [], falha }` com
mensagem própria (não é mensagem crua do banco). A rota já converte `falhas` em 500
(`respostaDeFalhaDaFonte`), então o sinal chega ao consumidor sem mudança adicional.

### 3b. Falha de leitura da matrícula dizia ao aluno que a matrícula não existe (E→NEGA)

`apps/web/src/app/(platform)/jornada/actions.ts`, `resolveEnrollmentContext`. Achado **meu**,
não da tabela do LOOP-0c — mesma classe, dentro da minha área. A leitura de `enrollments` usava
`const { data: enrollment } = ...`, sem desestruturar o erro. Timeout, RLS ou blip de rede
deixavam `enrollment` nulo e a action respondia **"Matrícula não encontrada"** — a frase idêntica
à de quem realmente não tem matrícula. O aluno conclui que perdeu o curso.

### 3c. Contagem de capítulos ilegível virava "curso com zero módulos" (E→VAZIO)

Mesma função. `const { count } = ...` seguido de `count ?? 0`: uma contagem que falhou passava a
ser um curso sem módulos, e a jornada era validada contra esse vazio.

**Vermelho das duas (3b e 3c), com os controles positivos já verdes:**

```
 ❯ .../leitura-que-falha-nao-vira-ausencia.test.ts (4 tests | 2 failed) 7ms
   × Jornada — falha de leitura não pode virar 'não existe' > `enrollments` ilegível NÃO diz ao aluno que a matrícula não foi encontrada
     → expected 'Matrícula não encontrada' not to match /não encontrada/i
   ✓ Jornada — falha de leitura não pode virar 'não existe' > controle positivo — matrícula que de fato não existe continua dizendo isso
   × Jornada — contagem de módulos ilegível não pode virar 'curso com zero módulos' > falha ao contar `chapters` interrompe o salvamento em vez de assumir zero
     → expected true to be false // Object.is equality
   ✓ Jornada — contagem de módulos ilegível não pode virar 'curso com zero módulos' > controle positivo — contagem legível salva normalmente
```

**Correção:** os dois erros passam a ser desestruturados, logados por `logInfraError` e
devolvidos como `SAFE_JOURNEY_SAVE_ERROR` ("Não foi possível salvar sua jornada agora. Tente
novamente em instantes."), que é o canal de degradação graciosa que a Jornada já tinha para
erro de infraestrutura. A ausência real continua dizendo "Matrícula não encontrada", e o curso
com zero capítulos publicados continua sendo zero legítimo.

---

## O que deixei intocado por ser legítimo, e por quê

O laudo `LOOP-0c` separou 11 casos legítimos. Os que caem na minha área foram lidos um a um e
**não foram mexidos**:

| Local | Por que continua certo |
|---|---|
| `autogestao/fonte-supabase.ts`, função `ler` (erro na 1ª página) | Aborta e devolve `{ linhas: [], falha }`. Nunca confunde "zero linhas" com "erro". Era o único ponto certo da função; o teto era o furo, e só o teto foi mexido. |
| `autogestao/fonte-supabase.ts:236` (`erroPlano`) | Propagado como `falhas.plano`, nunca descartado. |
| `autogestao/fonte-supabase.ts:258-263` (`erroTenant`, fuso horário) | Cai num default **nomeado** (Brasília) com `console.error`. Ausência de configuração de fuso é o caminho majoritário hoje — nenhum tenant configura. É fail-safe declarado, não fail-silent, e o comentário no código já diz isso. |
| `app/gauntlet-preview/autogestao-{mapa,padroes,visao-geral}/leitura-real.ts` | As três checam `erroTenant`/`erroUser`/`erroEnroll` e devolvem `{ erroMotivo }`, forma distinta de "não encontrado". (São as três **irmãs** das de `aprendizagem-*`, que sim são achado — e são de outro dono.) |
| `app/(platform)/jornada/page.tsx:348-350` (catch do tour do builder) | Degrada para "sem tour". Cosmético, sem custo de decisão: não é dado que alguém lê para decidir algo. |
| `montagem.ts` da Autogestão (3 montadores) | Ao contrário dos três de `aprendizagem-time`, estes **usam** `primeiraFalha(...)` para decidir o estado da tela, não só para preencher um campo. É o comportamento certo, e é a razão de a Autogestão ter passado na régua de mutação de estado vazio. |
| "Vazio como caminho principal" na Autogestão inteira | Deliberado e correto. A tarefa era distinguir vazio legítimo de erro disfarçado de vazio, não eliminar o vazio — e nenhum estado vazio foi removido. |

Um caso lido e **deixado de lado por outro motivo**, registrado para não parecer omissão:
`loadJourneyPlan` (`jornada/actions.ts:452`) faz `if (error || !data) return null`, colapsando
erro e ausência. É a mesma classe — mas `grep -rn "loadJourneyPlan" src` não encontra **nenhum
chamador**. Mexer em código sem consumidor é inflar a correção com risco e sem ganho; fica
anotado como candidato a poda, não a conserto.

---

## Verificação

```
pnpm --filter @eximia/web test src/lib/analytics/autogestao     → 8 arquivos, 140 testes, verde
pnpm --filter @eximia/web test src/lib/analytics                → 147 arquivos, 1059 testes, verde
pnpm --filter @eximia/web test "src/app/(platform)/jornada"     → 18 arquivos, 181 testes, verde
pnpm --filter @eximia/web test "src/app/(platform)/admin/visao-geral" → 2 arquivos, 10 testes, verde
pnpm --filter @eximia/web test src/lib/__tests__                → 28 arquivos, 349 testes, verde
npx tsc --noEmit -p apps/web/tsconfig.json                      → exit 0
```

`biome check` nos arquivos tocados: formatação aplicada; restam 7 avisos `lint/style/useTemplate`
no gate 2, o mesmo padrão de concatenação (e a mesma quantidade proporcional de avisos) que o
gate 1 já carrega — mantido para o novo arquivo ler igual ao irmão.

### Diff, e o que é de colega

Meu diff: `Dockerfile`, `apps/web/src/lib/analytics/admin-overview.ts`,
`apps/web/src/lib/analytics/autogestao/fonte-supabase.ts`,
`apps/web/src/app/(platform)/jornada/actions.ts`,
`apps/web/src/app/(platform)/admin/visao-geral/{loader.ts,page.tsx}`,
`apps/web/scripts/verificar-marca-no-artefato.mjs` e 5 arquivos de teste novos.

Aparecem no `git status` mudanças em `jornada/_autogestao/**` e
`components/analytics/autogestao/**` que **não são minhas** (frente de componentes de tela).
Registrado, não revertido, conforme instruído. `lib/analytics/**/__tests__/isolamento-*` não foi
tocado.
