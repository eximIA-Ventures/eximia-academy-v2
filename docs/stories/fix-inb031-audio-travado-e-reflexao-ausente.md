# Story: Player de áudio travado e caixa de reflexão ausente no fim de módulo (INB-031)

**Version:** 1.0
**Created:** 2026-07-30
**Author:** Dex (@dev)
**Status:** Ready for Review
**Priority:** P2
**Branch:** `deploy/cory`
**Type:** Bug fix (brownfield) + achado de conteúdo
**Tier:** 2 (story leve, sem epic)

---

## User Story

**As a** aluno da eximIA Academy assistindo a um capítulo com slides,
**I want** que o player de áudio continue marcando o tempo depois de eu alternar
entre as abas Podcast e Audiobook,
**so that** eu consiga acompanhar e navegar o áudio da aula sem que a barra
congele em 0:00.

---

## Contexto do incidente

Reportado ao vivo pelo Hugo em **2026-07-29**, durante ensaio pré-mastermind, no
tenant demo **Vértice Indústria** (`ec814e94-0a84-48ec-ae2a-4f46c8ef21c4`),
curso **Análise e Solução de Problemas**
(`b1ea89e7-4947-4c80-8958-e8edfaa4a95e`). Dois sintomas foram relatados juntos:

1. **Player de áudio travado** — clicar em play não avançava o tempo; o visor
   ficava em `0:00 / 0:24`.
2. **Caixa de reflexão socrática ausente** — ao concluir um módulo, aparecia
   apenas o botão "Módulo Concluído", sem a caixa "Agora reflita por um
   momento...".

A investigação separou os dois: **o primeiro é bug de código** (corrigido
aqui); **o segundo é condição de conteúdo**, não de código (relatado, sem fix).

---

## Sintoma 1 — Player travado (BUG DE CÓDIGO, corrigido)

### Causa-raiz

`apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/present/_components/presentation-viewer.tsx:255`

O efeito que registra os listeners do `<audio>` (`timeupdate`, `durationchange`,
`play`, `pause`, `ended`) declarava dependência **apenas** de `activeAudioUrl`:

```ts
}, [activeAudioUrl])
```

Mas o elemento é montado com `key={audioMode}` (linha 702):

```tsx
<audio key={audioMode} ref={audioRef} src={activeAudioUrl} preload="metadata" className="hidden" />
```

Trocar a aba **Podcast ↔ Audiobook** muda a `key` e portanto **remonta** o
elemento. Quando as duas fontes apontam para a **mesma URL**, `activeAudioUrl`
não muda e o efeito **não re-roda**: os listeners permanecem presos ao nó
desmontado, enquanto `audioRef.current` já aponta para o `<audio>` novo, sem
nenhum listener.

Consequência exata do relato: `timeupdate` do elemento novo nunca chega ao
state → `currentTime` congela em `0:00`; `isPlaying` nunca vira `true`; e a
duração exibida (`0:24`) é o resíduo do estado do áudio anterior.

### Por que o cenário se materializou no tenant demo

O seed do curso demo gravou a **mesma URL** nos dois campos do capítulo:

| Campo | Valor |
|-------|-------|
| `chapters.slide_audio_url` | `.../chapter-assets/.../podcast-28537f54-....mp3` |
| `chapters.audio_url` | `.../chapter-assets/.../podcast-28537f54-....mp3` (idêntico) |

Verificado nos 8 capítulos do curso via REST (`chapters?course_id=eq.b1ea89e7...`).

Isso satisfaz `hasBothAudios = !!(podcastUrl && (narrationUrl || audioUrl))`
(linha 159) — as abas Podcast/Audiobook **aparecem** — sem que a URL ativa mude
entre elas. É a combinação exata que expõe o defeito.

### Fix

`presentation-viewer.tsx:255` — `audioMode` passa a ser dependência do efeito,
com comentário explicando que **não é redundância** de `activeAudioUrl`:

```ts
}, [activeAudioUrl, audioMode])
```

Mudança mínima e cirúrgica: uma dependência. Nenhum outro comportamento tocado.

### Evidência (teste vermelho → verde)

Teste novo:
`apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/present/_components/__tests__/presentation-viewer-audio.test.tsx`

**Antes do fix** (`npx vitest run <teste>`):

```
 ✓ acompanha o tempo no primeiro áudio montado
 × continua acompanhando o tempo depois de trocar Podcast → Audiobook com a MESMA url
   → expect(screen.getAllByText("0:07")) — Unable to find an element with the text: 0:07

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)
```

O primeiro caso passando é parte da prova: na montagem inicial os listeners
funcionam; o defeito só se manifesta na remontagem por troca de aba.

**Depois do fix:**

```
 ✓ src/app/(platform)/.../__tests__/presentation-viewer-audio.test.tsx (2 tests) 96ms

 Test Files  1 passed (1)
      Tests  2 passed (2)
```

---

## Sintoma 2 — Reflexão ausente (CONDIÇÃO DE CONTEÚDO, sem fix)

### O mecanismo

A caixa de reflexão **não é um campo do capítulo**. Ela é derivada do conteúdo:
`presentation-viewer.tsx:581-599` intercepta cada `blockquote` do
`slide.text_content` e, se `isReflectionBlock(texto)` (heurística de
`presentation-viewer.tsx:133-144`) casar, troca o blockquote comum pelo
componente interativo `ReflectionPrompt`.

Ou seja: **slide sem blockquote de reflexão → nenhuma caixa**, por desenho.

### Evidência no dado

Varredura dos 8 capítulos do curso demo, olhando o **último slide** de cada um
(o slide onde o botão "Módulo Concluído" aparece):

| Cap | Título | Slides | Último slide tem bloco de reflexão? |
|----:|--------|-------:|-------------------------------------|
| 0 | Introdução à Análise e Solução de Problemas | 22 | SIM |
| 1 | Definir o Problema | 11 | SIM |
| 2 | Identificar o Problema | 25 | **NÃO** |
| 3 | Análise de Causa | 11 | SIM |
| 4 | Ações Corretivas | 6 | **NÃO** |
| 5 | Executar as Ações Corretivas | 4 | **NÃO** |
| 6 | Monitoramento dos Resultados | 4 | SIM |
| 7 | Padronização | 9 | SIM |

Em **3 dos 8 capítulos** o último slide não tem bloco de reflexão — nesses, ao
chegar ao fim, o aluno vê exatamente o que o Hugo relatou: só o botão "Módulo
Concluído". O capítulo "Ações Corretivas" não tem **nenhum** blockquote em
nenhum dos seus 6 slides.

Descartadas as hipóteses de código:

- `tenantId` chega preenchido — `hugocapitelli+demo@gmail.com` tem
  `users.tenant_id = ec814e94...`, e o select de `chapter_slides`
  (`page.tsx:169`) traz `tenant_id` como fallback.
- A heurística casa com o texto usado no curso (`> **🔎 Agora reflita por um
  momento...**`) via `/agora\s+(refli[tj]a|...)/i`.
- O painel de notas estava aberto — o botão que o Hugo viu vive **dentro** dele
  (`presentation-viewer.tsx:628`).

**Conclusão:** não há bug a corrigir aqui. É decisão de conteúdo — se a
reflexão deve fechar todo módulo, os slides finais dos capítulos 2, 4 e 5
precisam ganhar o bloco. Decisão do dono do produto, fora do escopo deste fix.

### Achado lateral (registrado, NÃO corrigido)

`presentation-viewer.tsx:610` e `:628` são mutuamente exclusivos por
`interaction?.type === "socratic"` e `!interaction`. Se algum dia `interaction`
existir com um `type` diferente de `"socratic"`, o aluno fica **sem os dois**:
sem sessão socrática e sem botão de concluir o módulo. Hoje inalcançável
(`page.tsx:264` só produz `type: "socratic"`), mas é um buraco latente que vale
uma condição mais explícita quando um segundo tipo de interação nascer.

---

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/present/_components/presentation-viewer.tsx` | Fix: `audioMode` na dep do efeito de listeners + comentário |
| `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/present/_components/__tests__/presentation-viewer-audio.test.tsx` | Novo: teste de regressão (2 casos) |
| `docs/stories/fix-inb031-audio-travado-e-reflexao-ausente.md` | Novo: esta story |

---

## Validações

| Gate | Resultado |
|------|-----------|
| Teste novo (vermelho → verde) | 2/2 passam; falhava antes do fix |
| Suíte completa (`npx vitest run`) | **7 falhas** / 1980 passam — abaixo do baseline herdado de 23 (`docs/qa/triagem-falhas-2026-07-28.md`) |
| Typecheck (`tsc --noEmit`) | exit 0, limpo |
| Lint (biome, arquivos tocados) | Teste novo limpo. `presentation-viewer.tsx`: 6 erros + 1 warning **idênticos ao HEAD** (dívida de CRLF pré-existente, comparada contra `git show HEAD:`) — zero erro novo |

As 7 falhas restantes são dívida herdada, sem relação com áudio:
`login-form-google-oauth.test.tsx` (6, botão do Google desativado no código —
precisa de decisão, não de conserto) e `manager-dashboard.test.tsx` (1,
"Competencias Ativas").

---

## Pendências

1. **Push** — não executado. Autoridade exclusiva do @devops.
2. **Deploy não é automático** — após o push, é preciso clicar **Rebuild** no
   EasyPanel (`docs/DEPLOY-GUIDE.md`). Sonda: `/jornada`, `/meu-plano`,
   `/super-admin` devolvem 307 quando o build está no ar (404 = build antigo);
   nunca usar `/admin/*` como sonda.
3. **Decisão de conteúdo** — blocos de reflexão nos capítulos 2, 4 e 5.
4. **Higiene de dado** — vale avaliar se `slide_audio_url` e `audio_url` devem
   mesmo receber a mesma URL no seed de demo: o fix torna o caso inofensivo,
   mas as abas Podcast/Audiobook ficam oferecendo duas escolhas que tocam
   exatamente o mesmo arquivo.
