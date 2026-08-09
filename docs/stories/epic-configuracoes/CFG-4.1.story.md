# CFG-4.1 — Marca & Aparência em fidelidade ao mockup (rebaixada ao delta real)

> **Status:** Ready · **Tier:** 3 (delta pequeno — a casca já entregou o essencial) · **Tamanho:** S (1 pílula visual na sidebar + 1 arquivo de teste novo) · **Depende de:** CFG-1.1 (já entregue)
> **Fonte:** `docs/architecture/configuracoes-publicacao-fase1.md` §3.2
> **Migrations:** NENHUMA.

## Rebaixamento de escopo (@sm, 2026-07-25) — fix F3 do @po

> A versão anterior desta story listava ACs 1, 2 e 5 como trabalho a fazer. Verificado em disco (`RESULT-casca-hub.md`, CFG-1.1 já executada): **esses três já estão entregues**. `apps/web/src/app/(platform)/admin/configuracoes/marca/page.tsx` já monta o `WhitelabelSettingsForm` original (zero reimplementação, o MESMO componente da aba antiga), já tem `SectionHeader` com descrição de 1 linha, e já renderiza o estado explícito "Recurso PRO" quando `whitelabelEnabled` é falso. Reescrever essas capacidades como ACs pendentes faria o dev reentregar o que está no disco — a "implementação paralela" que o plano §2 Passo 4 manda evitar. Esta reescrita rebaixa a story ao que sobra de verdade: 1 delta de produto (diferenciar o item na sidebar) + a prova de teste que nunca existiu.

## Contexto

Esta é a ÚNICA das 5 seções onde o produto real está À FRENTE do mockup, não atrás. Nenhum RESULT/SPEC de `JARVIS/apps/hub-discovery/` cobre "Marca & Aparência" separadamente — o esforço de fidelidade dos terminais Immersive Web focou Usuários/Cargos/Unidades. A fonte de verdade aqui é exclusivamente o plano executável §3.2 e o estado já construído pela casca.

## O que já está entregue (preservar, não retrabalhar)

Verificado em disco, não é trabalho desta story:
- `WhitelabelSettingsForm` com Nome do App (contador real `{appName.length}/100`), Tagline, Título/Subtítulo do login, Rodapé, Email de suporte, URL do favicon com preview e validação "URL deve usar HTTPS", preview do login reativo de verdade, "Resetar para Padrão" (`saveWhitelabelConfig({})`), audit log `settings.whitelabel_updated`.
- `admin/configuracoes/marca/page.tsx` monta o MESMO componente (não uma cópia), com `SectionHeader` (descrição de 1 linha) e o estado "Recurso PRO" quando `whitelabelEnabled` é falso — a seção **permanece sempre visível** na sidebar, nunca some, ao contrário da aba antiga que simplesmente desaparecia sem `whitelabelEnabled`.
- `custom_css` (existe no schema Drizzle de branding, sem UI em nenhum dos dois lados) permanece **fora de escopo** — não inventar UI para ele aqui.

## Acceptance Criteria (delta real)

1. **Diferenciar o item "Marca & Aparência" na sidebar do hub (`settings-hub-nav.tsx`) quando o plano não cobre whitelabel.** Hoje o item aparece idêntico esteja o plano habilitado ou não; a sub-rota já trata o caso (estado "Recurso PRO"), mas a sidebar não avisa antes do clique. Adicionar uma pílula "PRO" ao lado do label quando `whitelabelEnabled` é falso, espelhando visualmente a pílula "Em breve" já usada nos 11 itens bloqueados (mesmo padrão visual, semântica diferente: aqui o item continua clicável).
2. **Criar o teste que nunca existiu para o `WhitelabelSettingsForm`.** Hoje não há nenhum teste do componente (`find` confirma: só existem `branding-preview`, `color-picker` e `user-list` em `apps/web/src/components/admin/__tests__/`). Um AC de preservação sem teste de preservação é promessa sem gate. Criar `apps/web/src/components/admin/__tests__/whitelabel-settings-form.test.tsx` cobrindo, no mínimo: (a) contador reativo do nome do app atualiza ao digitar; (b) favicon com URL não-HTTPS é rejeitado com a mensagem de erro esperada; (c) "Resetar para Padrão" chama `saveWhitelabelConfig({})`.
3. **Nenhuma regressão** nas capacidades já entregues (lista em "O que já está entregue" acima) — o teste do AC2 serve de prova contínua disso daqui pra frente.

## Fica para depois

- `custom_css` — sem UI em nenhum dos dois lados, fora de escopo.

## Dev Notes

- Componentes reais: `apps/web/src/components/admin/whitelabel-settings-form.tsx`, `apps/web/src/components/admin/whitelabel-preview.tsx`, `apps/web/src/app/(platform)/admin/settings/whitelabel-actions.ts` (`saveWhitelabelConfig`).
- Gate de plano hoje: `apps/web/src/components/admin/settings-tabs-wrapper.tsx` (aba antiga, comportamento de sumiço, **inalterado**) vs. `admin/configuracoes/marca/page.tsx` (hub, comportamento de estado explícito, **já construído**). O AC1 desta story é só a sidebar, não a sub-rota.
- Sidebar: `apps/web/src/app/(platform)/admin/configuracoes/_components/settings-hub-nav.tsx`. O componente `HubItemSoon` já existe para os itens "Em breve" — a pílula "PRO" do AC1 é um estado visual novo e distinto (item continua `<Link>`, não vira `<span>` bloqueado).
- Esta seção não tem RESULT/SPEC de fidelidade porque o mockup nunca teve JS de comportamento aqui além do que o produto já supera — a especificação funcional é este Dev Notes + o plano executável §3.2.

## Gate

```bash
npx tsc --noEmit -p apps/web/tsconfig.json ; echo "exit=$?"
cd apps/web && npx vitest run src/components/admin/__tests__/whitelabel-settings-form.test.tsx 2>&1 | tail -15
npx biome check apps/web/src/components/admin/whitelabel-settings-form.tsx apps/web/src/components/admin/whitelabel-preview.tsx "apps/web/src/app/(platform)/admin/configuracoes/_components/settings-hub-nav.tsx"
grep -n "PRO" "apps/web/src/app/(platform)/admin/configuracoes/_components/settings-hub-nav.tsx"   # AC1: pílula PRO presente
grep -n "whitelabelEnabled" "apps/web/src/app/(platform)/admin/configuracoes/marca/page.tsx"        # já entregue, guarda de não-regressão
```

## Change Log
| Data | Evento |
|:--|:--|
| 2026-07-25 | Story criada por River (@sm) a partir de `configuracoes-publicacao-fase1.md` §3.2. |
| 2026-07-25 | Validada por Pax (@po): NO-GO por escopo (6/10) — ACs 1, 2 e 5 já entregues pela casca; QUESTÃO ABERTA do AC3 antigo resolvida como (a) (item sempre visível, estado "Recurso PRO"), `[AUTO-DECISION]` do @po alinhada ao que o código já executa. |
| 2026-07-25 | **Rebaixada ao delta real por River (@sm), fix F3.** Removidos os ACs já entregues (preservados só como "O que já está entregue", não mais como trabalho pendente). Delta real: pílula "PRO" na sidebar quando o plano não cobre (AC1) + teste novo do `WhitelabelSettingsForm` que nunca existiu (AC2). Tier rebaixado de 2 para 3 e Status de Draft para Ready — não há mais decisão aberta nem trabalho de porte, só um ajuste visual pequeno e uma prova de teste. |
| 2026-07-28 | **Delta implementado por Dex (@dev).** AC1: pílula "PRO" no item "Marca & Aparência" quando o plano não cobre whitelabel. O gate NÃO foi reinventado — o `layout.tsx` do hub lê o MESMO `loadTenantSettings().tenant.whitelabelEnabled` que a sub-rota de marca já usa e passa por prop; a leitura entra em `try/catch` porque `loadTenantSettings` LANÇA e uma falha ali derrubaria as 9 seções por causa de um selo (degrada para "sem selo", o default). A pílula virou o componente compartilhado `HubPill`, preservando byte a byte a geometria da pílula "Em breve" (inclusive os 8px de folga da rodada 8); a ÚNICA divergência é a rampa do texto (`text-text-secondary` em vez de `text-text-muted`), porque o item continua CLICÁVEL e herdar o cinza de "desabilitado" mentiria sobre o estado, além de medir 2.96:1 no tema escuro. AC2: criado `whitelabel-settings-form.test.tsx` (9 casos) cobrindo contador reativo, rejeição de favicon não-HTTPS e reset chamando `saveWhitelabelConfig({})`, mais Salvar e erro do servidor. AC3: a suíte nova É a guarda de não-regressão. |
| 2026-07-28 | **AC já satisfeito, não refeito (@dev).** O estado "Recurso PRO" da sub-rota e o `SectionHeader` já estavam em disco e não foram tocados. Prova: `grep -n "whitelabelEnabled" "apps/web/src/app/(platform)/admin/configuracoes/marca/page.tsx"` → linha 38 (`{tenant.whitelabelEnabled ? … : bloco "Recurso PRO"}`). Único toque em `whitelabel-settings-form.tsx`: passada do formatador (o gate desta story roda `biome check` nele e ele estava vermelho por formatação PRÉ-EXISTENTE). Mudança de reflow puro, zero token alterado, com os 9 testes novos verdes antes e depois. |

## File List

| Arquivo | Ação |
|:--|:--|
| `apps/web/src/app/(platform)/admin/configuracoes/_components/settings-hub-nav.tsx` | Modificado — `HubPill` compartilhado + prop `whitelabelEnabled` + selo "PRO" no item de marca |
| `apps/web/src/app/(platform)/admin/configuracoes/layout.tsx` | Modificado — resolve o gate de plano (mesmo `loadTenantSettings` da sub-rota) e passa para a barra |
| `apps/web/src/app/(platform)/admin/configuracoes/_components/__tests__/settings-hub-nav.test.tsx` | Modificado — +4 casos do selo PRO (clicável, contagem 9/7 intacta, default sem selo) |
| `apps/web/src/components/admin/__tests__/whitelabel-settings-form.test.tsx` | **Criado** — 9 casos (AC2) |
| `apps/web/src/components/admin/whitelabel-settings-form.tsx` | Formatação apenas (biome), zero mudança de comportamento |
