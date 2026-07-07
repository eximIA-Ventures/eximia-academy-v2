# EPIC-MANAGER-UX / S6, Recorte "Quem estou analisando?" e filtro de times elevado ao recorte

> Status: DRAFT PARA REVISÃO
> Onda: 2
> Data: 2026-07-07
> Referências de design (em `docs/stories/epic-manager-ux/design/`): R1 `01-diagnostico-detalhes-alunos.pdf`, R2 `02-proposta-detalhes-alunos.pdf`, R3 `03-mockup-tela-principal.png`

## User Story

Como gestor na visão Meu Time, quero um recorte com título explícito "Quem estou analisando?" e, em Hierarquia, um filtro de times visível NESSE bloco (não escondido num funil de coluna), para entender em 2 segundos qual universo de alunos a tela mostra e refinar por time. O filtro vive na URL (padrão do `?focus=`); o funil da coluna TIME permanece como atalho, lendo/escrevendo o MESMO estado.

Resolve os problemas #1 (recorte pouco evidente) e #2 (filtro de time invisível/acoplado ao modo) de R1. NÃO cria cards de triagem (S7), NÃO mexe nos destaques (S8), NÃO simplifica colunas nem cria a coluna Ação (S9/S10).

## Referência de design

- **R3 (mockup):** bloco "Quem estou analisando?" no topo, pills Diretos / Hierarquia / Todos os times. Leitura correta: "Todos os times" NÃO é um terceiro modo; é o estado default (nada filtrado) do dropdown que esta spec cria. Os modos continuam 2.
- **R2 (proposta):** bloco 1 ("recortes") das "Possíveis mudanças".
- **R1 (diagnóstico):** problemas #1 e #2.

## Estado atual (recon arquivo:linha)

Paths abaixo relativos a `apps/web/src/`.

- `app/(platform)/dashboard/_components/team-scope-control.tsx:23-54`, `TeamScopeControl` (client): eyebrow "Recorte da equipe" (:43-45), resumo dinâmico (:31-38), `OrgDrilldownBreadcrumb` + `TeamViewSwitch` à direita (:49-50). Sem título forte.
- `app/(platform)/dashboard/_components/manager-team-dashboard-page.tsx:71-115`: `nav` via `resolveDrilldownNav` (:71), `teamViewMode` via `getTeamViewMode()` (:82), slot `teamRecortePanel` (:102-115) com `TeamScopeControl` (:104-111); `nav.subteams` já traz `studentCount` (:100).
- `lib/org-tree.ts:35-53`: `SubteamNode { id, fullName, studentCount }` e `DrilldownNav { trail, subteams, focusUserId, focusFellBack }`; `subteams` ordenado por nome (:254); ids = user ids dos donos de sub-time.
- `components/analytics/student-insights-table.tsx` (client, compartilhada gestor/instrutor): estado interno `selectedTeams`/`teamFilterOpen`/`menuPos` (:141-144); `DIRECT_KEY = "__direct__"` (:165); `teamOptions` derivado das rows (:170-205); filtro em :234-237 (set vazio = todos); funil no header TIME só quando `showSubteam && teamOptions.length > 1` (:331); menu `fixed` no trigger (:147-151, :557-614), fecha em scroll/resize (:154-163), "Todos os times" limpa (:576-585).
- `app/(platform)/dashboard/_components/manager-dashboard-page.tsx:103`: `showSubteam = resolvedTeamViewMode === "hierarchy"`; `subteam` via `getStudentSubteamMap` (:104-111, :151-172); `showSubteamColumn` (:178); tabela em `manager-dashboard.tsx:152-154`, `expandable={false}`.
- `lib/area-context.ts:278-363`, `getStudentSubteamMap(db, tenantId, managerId)`: o `subteamId` de CADA aluno é o user id do sub-time direto de PRIMEIRO NÍVEL abaixo do `managerId` (:318-323, :344-357), independente de `?focus=`. Fato crítico para o alinhamento de ids (item b).
- `app/(platform)/dashboard/_components/org-drilldown-breadcrumb.tsx:43-55`: `navigateTo` copia os search params e só altera `focus` (`router.push(..., { scroll: false })`): um `?teams=` sobrevive ao drill sem código novo.
- `app/(platform)/dashboard/_components/team-view-switch.tsx:40-46`: `handleSelect` grava o cookie `x-team-view` via action `setTeamView` + `router.refresh()`. Não toca na URL hoje.
- `app/(platform)/dashboard/page.tsx:25,35`: lê `searchParams.focus`; nenhuma leitura de `teams` existe no repo (param novo). `app/(platform)/instructor/page.tsx:314`: MESMA tabela sem `showSubteam` (funil nunca aparece), `expandable` default true.
- Testes: `dashboard/_components/__tests__/team-scope-control.test.tsx` existe. Precedente de import `components/` -> `app/(platform)/`: `components/layout/role-lens-switcher.tsx:3`.

## Escopo decidido

a) **Título forte no recorte.** `TeamScopeControl` ganha um `h3` "Quem estou analisando?" abaixo do eyebrow "Recorte da equipe". Resumo dinâmico, breadcrumb e `TeamViewSwitch` permanecem intactos.

b) **Filtro de times elevado ao recorte.** Um dropdown multi-select "Todos os times" (mesmo conteúdo do menu do funil atual) aparece no recorte ao lado do `TeamViewSwitch`, SOMENTE quando `mode === "hierarchy"` E `isRoot` E `nav.subteams.length > 0`. Em Diretos não renderiza (não há coluna TIME nem `subteam` nas rows, `manager-dashboard-page.tsx:103`). A condição `isRoot` é refinamento necessário: `getStudentSubteamMap` atribui `subteam.id` SEMPRE relativo aos diretos de primeiro nível do gestor (`area-context.ts:344-357`), enquanto `nav.subteams` é relativo ao node focado; os ids só coincidem na raiz. Com drill ativo, o drill JÁ É o recorte fino; o funil da coluna (derivado das rows) segue disponível.

c) **Estado do filtro na URL.** O `useState` `selectedTeams` da tabela é substituído pelo search param `?teams=` (ids separados por vírgula; `__direct__` = "Direto"; ausente/vazio = todos). Ambos os controles leem/escrevem o MESMO param via `useSearchParams` + shallow routing nativo (`window.history.replaceState`, sem disparar request RSC, ver `useTeamFilterParam`). É o único canal possível: `TeamScopeControl` é client num slot server (`teamRecortePanel`) e a tabela é outro client em outra subárvore, sem parent client comum; o param de URL é o mecanismo já provado pelo `?focus=`.

d) **Coexistência e higiene.** `?focus=` e `?teams=` coexistem (o breadcrumb já preserva params alheios, `org-drilldown-breadcrumb.tsx:45`). Trocar para `direct` limpa `?teams`. Defesa contra ids obsoletos: a tabela aplica a **seleção efetiva** = interseção entre o set do param e as keys de `teamOptions`; interseção vazia = sem filtro (nunca trava a tabela em vazio).

e) **Textos exatos (pt-BR).** Título: `Quem estou analisando?`. Trigger: `Todos os times` quando nada filtrado; `1 time` / `N times` quando filtrado (contagem efetiva). Item de limpeza: `Todos os times`. Aria-label: `Filtrar por time`.

f) **Componente novo reutilizável.** `dashboard/_components/team-filter-dropdown.tsx`, consumido pelos DOIS pontos, recebendo `options`. Como o recorte (slot server) não tem as rows, suas opções vêm de `nav.subteams` mais a opção fixa "Direto"; as da tabela seguem derivadas das rows (`teamOptions` atual).

## Fora de escopo

- Fazer `?teams=` afetar cards, destaques ou dados server-side. **Decisão registrada:** S7 e S8 definem seus universos pelo RECORTE (modo + focus, resolvido server-side pelas RPCs), NÃO pelo filtro fino de times, client-side e cosmético sobre a tabela.
- Terceiro modo de recorte. Não existe: "Todos os times" do mockup (R3) é o estado default do dropdown.
- Colunas Ritmo/Ação e taxonomia por aluno (S9/S10, `lib/student-triage.ts`); nudges, buckets de engajamento, LGPD strip, gates de detalhe (D-C intacta); qualquer mudança em RPCs, `resolveDrilldownNav`, `getStudentSubteamMap` ou caminho de dados.

## Mudanças de código (POR ARQUIVO)

### 1. `apps/web/src/app/(platform)/dashboard/_components/team-filter-dropdown.tsx` (NOVO)

Client component + helpers puros + hook de URL:

```tsx
"use client"
import { SubteamChip } from "@/components/dashboard/subteam-chip"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

/** Token do param para alunos sem sub-time. Igual ao DIRECT_KEY da tabela. */
export const DIRECT_TEAM_KEY = "__direct__"

export interface TeamFilterOption {
  key: string    // user id do dono do sub-time, ou DIRECT_TEAM_KEY
  label: string  // path.join(" › ") || name || "Direto"
  count?: number // headcount quando conhecido
  subteam?: { id: string; name: string; colorIndex?: number; path?: string[] } // undefined => chip "Direto"
}

// Helpers puros (unit-testáveis sem DOM):
export function parseTeamsParam(raw: string | null): Set<string>
// "a,b" -> {a,b}; null/"" -> vazio; ignora tokens vazios; dedup.
export function serializeTeamsParam(selected: Set<string>): string | null
// vazio -> null (remove o param); senão ids ordenados unidos por ",".
export function effectiveTeamSelection(selected: Set<string>, options: TeamFilterOption[]): Set<string>
// interseção selected ∩ {option.key}; vazia -> Set vazio (= sem filtro).

/** Hook compartilhado: lê/escreve ?teams= (única fonte de verdade). */
export function useTeamFilterParam(): { selected: Set<string>; toggle: (key: string) => void; clearAll: () => void }
// useSearchParams().get("teams") -> parseTeamsParam; toggle/clearAll montam
// new URLSearchParams(searchParams), aplicam serializeTeamsParam e escrevem via
// shallow routing nativo: window.history.replaceState(null, "",
// qs ? `${pathname}?${qs}` : pathname). NÃO usar router.replace do App Router
// aqui: ele dispara um novo request RSC da página inteira a cada toggle, e o
// filtro de time é puramente client-side (useSearchParams sincroniza sozinho
// com a History API, sem precisar de round-trip ao servidor). router.replace
// continua sendo o mecanismo certo só onde precisa de re-render server (ver
// TeamViewSwitch, que troca o cookie x-team-view e por isso PRECISA de
// refresh). Nunca tocam em "focus" nem em outros params.

export interface TeamFilterDropdownProps {
  options: TeamFilterOption[]
  /** "select": pill com rótulo (recorte). "funnel": só-ícone (coluna TIME). */
  variant?: "select" | "funnel"
}
export function TeamFilterDropdown({ options, variant = "select" }: TeamFilterDropdownProps): JSX.Element | null
```

Comportamento:
- Retorna `null` se `options.length <= 1` (espelha `teamOptions.length > 1`, :331). Contagem exibida = `effectiveTeamSelection(selected, options).size`.
- Trigger `select`: pill no estilo do `TeamViewSwitch` (`bg-bg-surface`, `text-xs font-medium`), `ListFilter` 13 + rótulo (`Todos os times` quando efetivo vazio; `1 time`/`{n} times` em `text-cerrado-600` quando filtrado) + `ChevronDown` 12, `aria-label="Filtrar por time"`. Trigger `funnel`: idêntico ao botão atual (:332-353).
- Menu: MESMA estratégia da tabela, movida para o componente: `position: fixed` no rect do trigger (:147-151), backdrop (:559-565), fecha em scroll/resize (:154-163), `backgroundColor: "var(--color-bg-card, #ffffff)"` inline (Tailwind v4 oklch, :568-574). Conteúdo: `Todos os times` (chama `clearAll`, check quando efetivo vazio), divisor, um item por opção com checkbox (`border-cerrado-600 bg-cerrado-600` quando marcado), `SubteamChip subteam={opt.subteam}` e `opt.count` quando definido. O checkbox marca pelo `selected` cru, para o usuário desmarcar tokens obsoletos.

### 2. `apps/web/src/components/analytics/student-insights-table.tsx` (MODIFICAR)

- Remover todo o estado interno do filtro: `selectedTeams`/`teamFilterOpen`/`menuPos`/`filterBtnRef`/`openTeamFilter` + `useEffect` de scroll/resize (:141-163), `toggleTeam` (:207-214) e o bloco do menu fixed (:553-614).
- Importar do arquivo novo: `TeamFilterDropdown`, `useTeamFilterParam`, `effectiveTeamSelection`, `DIRECT_TEAM_KEY` (substitui a const local `DIRECT_KEY` :165; mesmo literal `"__direct__"`).
- `teamOptions` (:170-205) segue derivado das rows, retipado como `TeamFilterOption[]` (o shape já bate; `colorIndex` dentro de `subteam`).
- Header da coluna TIME (:325-356): substituir botão-funil + menu por `{showSubteam && <TeamFilterDropdown options={teamOptions} variant="funnel" />}`.
- Filtro em `filtered` (:234-237) passa a usar a seleção efetiva:

```tsx
const { selected } = useTeamFilterParam()
const effectiveTeams = useMemo(() => effectiveTeamSelection(selected, teamOptions), [selected, teamOptions])
// no useMemo de `filtered` (deps: + effectiveTeams, - selectedTeams):
if (effectiveTeams.size > 0) {
  result = result.filter((s) => effectiveTeams.has(s.subteam?.id ?? DIRECT_TEAM_KEY))
}
```

- Visão instrutor (`instructor/page.tsx:314`): sem `showSubteam` o funil não renderiza; rows sem `subteam` geram no máximo `__direct__`, então a interseção com qualquer `?teams=` estranho é vazia = sem filtro. Inalterada.

### 3. `dashboard/_components/team-scope-control.tsx` (MODIFICAR)

Novo prop opcional em `TeamScopeControlProps`:

```tsx
import type { TeamFilterOption } from "./team-filter-dropdown"
/** Opções do filtro elevado. Só passado pelo caller quando isRoot (os ids
 * só coincidem na raiz, ver getStudentSubteamMap). Renderiza só em
 * mode "hierarchy". */
teamFilterOptions?: TeamFilterOption[]
```

No JSX, entre o eyebrow (:43-45) e o resumo existente (:46), inserir:

```tsx
<h3 className="mt-1 text-base font-semibold text-text-primary">Quem estou analisando?</h3>
```

Na coluna direita (:48-51), num `div flex items-center gap-2` ao lado do `TeamViewSwitch`:

```tsx
{mode === "hierarchy" && teamFilterOptions && <TeamFilterDropdown options={teamFilterOptions} />}
<TeamViewSwitch mode={mode} />
```

(o próprio `TeamFilterDropdown` retorna `null` com `options.length <= 1`, então "só Direto" não renderiza nada.)

### 4. `dashboard/_components/manager-team-dashboard-page.tsx` (MODIFICAR)

Montar as opções de `nav.subteams`, gated por `isRoot` (após :74; já ordenado por nome, `org-tree.ts:254`; `colorIndex` = rank por nome, heurística de `getStudentSubteamMap`, `area-context.ts:344`):

```tsx
import { DIRECT_TEAM_KEY, type TeamFilterOption } from "./team-filter-dropdown"

const teamFilterOptions: TeamFilterOption[] | undefined =
  isRoot && nav.subteams.length > 0
    ? [
        ...nav.subteams.map((s, i) => ({
          key: s.id,
          label: s.fullName || "Sem nome",
          count: s.studentCount,
          subteam: { id: s.id, name: s.fullName, colorIndex: i },
        })),
        { key: DIRECT_TEAM_KEY, label: "Direto" },
      ]
    : undefined
```

No JSX do `teamRecortePanel` (:104-111): `<TeamScopeControl ... teamFilterOptions={teamFilterOptions} />`.

### 5. `dashboard/_components/team-view-switch.tsx` (MODIFICAR)

Limpar `?teams` ao trocar para Diretos (item d). Adicionar `usePathname`/`useSearchParams`; `handleSelect` (:40-46) vira:

```tsx
startTransition(async () => {
  await setTeamView(next)
  if (next === "direct" && searchParams.has("teams")) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("teams")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  } else {
    router.refresh()
  }
})
```

`router.replace` já dispara o re-render server (que lê o cookie novo, gravado antes pelo `await`), dispensando `refresh()` nesse ramo. `?focus` é preservado.

## Dados-RLS-Segurança

- **Zero mudança de dados, RPC, policy ou rota.** `?teams=` é 100% client-side sobre rows JÁ gated: roster resolvido por `teamScope` (RPCs SECURITY DEFINER fail-closed, `manager-dashboard-page.tsx:93-101,140`), strip LGPD server-side (:151-172) intocado. Um `?teams=` forjado filtra rows que o gestor já podia ver; na pior hipótese a interseção é vazia e NENHUM filtro se aplica (nunca alarga, vaza ou trava).
- **`?teams=` é UI-hint**, como o cookie `x-team-view` (`team-view-switch.tsx:15-17`): não participa de query. O universo de dados continua definido só pelo recorte (modo + `?focus=` gated por `auth_subtree_user_ids()`).
- **Opções do recorte vêm de `nav.subteams`**, já resolvido dentro do gate (`org-tree.ts:131-257`); nenhum node fora do subtree é nomeado ou contado.
- **D-C preservada:** nada toca expansão de linha, perfil ou texto escrito por aluno. `expandable={false}` na visão gestor (`manager-dashboard.tsx:153`) permanece.

## Acceptance Criteria

1. **AC1:** o recorte exibe o `h3` com texto exato `Quem estou analisando?` entre o eyebrow e o resumo dinâmico; eyebrow, resumo, breadcrumb e `TeamViewSwitch` permanecem como hoje.
2. **AC2:** `team-filter-dropdown.tsx` existe exportando `TeamFilterDropdown`, `TeamFilterOption`, `DIRECT_TEAM_KEY`, `parseTeamsParam`, `serializeTeamsParam`, `effectiveTeamSelection` e `useTeamFilterParam`, consumido pelo recorte (`select`) e pela coluna TIME (`funnel`).
3. **AC3:** o dropdown do recorte renderiza SOMENTE com `mode === "hierarchy"` E `isRoot` E `nav.subteams.length > 0`; em Diretos, com drill ativo (`?focus=`) ou sem sub-times, não renderiza.
4. **AC4:** trigger mostra `Todos os times` com seleção efetiva vazia e `1 time`/`N times` quando filtrado; menu contém `Todos os times` (limpa tudo), um item por time com chip colorido + contagem, e `Direto` com chip neutro.
5. **AC5:** o estado vive exclusivamente em `?teams=`; marcar/desmarcar em QUALQUER controle atualiza a URL via shallow routing nativo (`window.history.replaceState`, sem disparar request RSC) e reflete no outro controle e nas rows; o `useState` `selectedTeams` não existe mais.
6. **AC6:** o funil da coluna TIME continua como atalho, mesmo menu, agora URL-backed; na visão instrutor (`instructor/page.tsx:314`, sem `showSubteam`) nada muda.
7. **AC7:** a tabela filtra pela seleção EFETIVA (interseção com as keys de `teamOptions`); `?teams=` com ids desconhecidos/obsoletos resulta em tabela SEM filtro, nunca vazia por causa do param.
8. **AC8:** trocar para Diretos remove `?teams` preservando `?focus`; navegar pelo breadcrumb preserva `?teams` (coexistência, `org-drilldown-breadcrumb.tsx:45`).
9. **AC9:** `?teams=` NÃO altera cards, destaques, KPIs nem fetch server-side (universos de S7/S8 = recorte); nenhuma RPC, query ou policy tocada.
10. **AC10:** `pnpm --filter @eximia/web typecheck`, `pnpm --filter @eximia/web test` e `pnpm --filter @eximia/web lint` verdes.
11. **AC11:** toggles de `?teams=` não disparam novo request de RSC (shallow routing via `window.history.replaceState`); apenas a troca de modo em `TeamViewSwitch` (que grava o cookie `x-team-view`) segue usando `router.replace` com refresh server.

## Plano de testes (first-move rule)

Story de refactor + feature de UI: **first-move = confirmar a suíte verde ANTES de mexer** (`pnpm --filter @eximia/web test`) e mantê-la verde durante a migração (o refactor só move o estado do filtro para a URL).

1. **Helpers puros (novo `dashboard/_components/__tests__/team-filter-dropdown.test.tsx`):** `parseTeamsParam` (`null`/`""` -> vazio; `"a,b"` -> {a,b}; `"a,,a"` -> {a}); `serializeTeamsParam` (vazio -> `null`; {b,a} -> `"a,b"`); `effectiveTeamSelection` (interseção parcial mantém só keys existentes; vazia -> sem filtro; `__direct__` respeitado). Componente com `next/navigation` mockado: `options.length <= 1` -> `null`; trigger mostra `Todos os times` sem seleção e `2 times` com 2 keys válidas; clique chama `window.history.replaceState` com o param serializado (shallow, sem `router.replace`/request RSC).
2. **`__tests__/team-scope-control.test.tsx` (estender):** com `mode="hierarchy"` + `teamFilterOptions` (2+) o dropdown renderiza; com `mode="direct"` não, mesmo com opções; `h3` "Quem estou analisando?" nos dois modos; eyebrow e resumo preservados.
3. **Tabela (novo teste):** com `?teams=<idA>` mockado, só rows do time A; com `?teams=<id-desconhecido>`, todas (AC7); sem `showSubteam` o funil não renderiza e o param é ignorado (AC6).
4. **`team-view-switch`:** selecionar Diretos com `?teams=x&focus=y` mockado chama `router.replace` com `focus=y` mantido e sem `teams` (AC8).
5. Comandos, nesta ordem: `pnpm --filter @eximia/web test`, `pnpm --filter @eximia/web typecheck`, `pnpm --filter @eximia/web lint`.

## Dependências (de outras specs da onda)

- **Nenhuma para landar.** S6 não depende de S7/S8/S9/S10 nem de `student-triage.ts`.
- **S9 deve landar DEPOIS de S6:** ambas tocam `student-insights-table.tsx`; S6 estabelece o filtro URL-backed e o `TeamFilterDropdown` que a coluna TIME (mantida na S9) usa.
- **S7/S8:** consomem o RECORTE (modo + focus), não o `?teams=` (Fora de escopo + AC9).
- Infra reusada: `resolveDrilldownNav`, `getTeamViewMode`/`setTeamView`, `OrgDrilldownBreadcrumb`, `SubteamChip`, padrão `?focus=`.

## Riscos

- **Desalinhamento de ids entre recorte e rows com drill ativo.** `getStudentSubteamMap` é relativo à raiz; `nav.subteams`, ao foco. Mitigação dupla: dropdown do recorte só em `isRoot` (item b) e seleção efetiva na tabela (AC7); um `?teams=` preservado através de um drill nunca zera a tabela.
- **Paridade de cor dos chips.** `colorIndex` do recorte = rank por nome de `nav.subteams`; o da tabela vem de `getStudentSubteamMap` (rank nome+id). Cosmético (a key de filtro é o id).
- **Times group-owner-only viram opção morta no recorte (risco FUNCIONAL, não cosmético).** Os dois universos divergem: `resolveDrilldownNav` inclui em `nav.subteams` filhos que possuem APENAS manager_group (via `resolveDirectGroupOwningNodes`, `org-tree.ts:66-118` e `:212-224`), enquanto `getStudentSubteamMap` (`area-context.ts:316-324`) só atribui `subteam.id` a donos de time via `reports_to`. Um time group-only aparece como opção no dropdown do recorte, mas NENHUMA row carrega essa key: a seleção efetiva (interseção, AC7) descarta a escolha silenciosamente, o gestor seleciona o time e nada filtra (e os alunos desse grupo aparecem como "Direto"). Mitigação obrigatória, escolher uma na implementação: (a) excluir de `teamFilterOptions` os nós de `nav.subteams` que são group-owner-only (exige expor essa distinção em `SubteamNode`); ou (b) derivar as opções do recorte do MESMO universo das rows (keys de `getStudentSubteamMap`, calculado em `manager-dashboard-page.tsx` e passado ao painel), garantindo que toda option-key exista em pelo menos uma row (option-keys contidas nos subteam-ids das rows).
- **`useSearchParams` em client component.** Exige Suspense só em prerender estático; dashboard e instrutor são dinâmicos e `OrgDrilldownBreadcrumb` já o usa na mesma árvore. Se o build acusar, `<Suspense>` local no consumidor.
- **Corrida cookie vs URL no `TeamViewSwitch`.** O `await setTeamView` completa antes do `router.replace`; validar manualmente a troca rápida de modo.
- **Import cruzado `components/analytics` -> `app/(platform)/dashboard/_components`.** Precedente amplo (`role-lens-switcher.tsx:3`); alternativa: mover o arquivo novo para `components/dashboard/`.
- **Menu `fixed` no recorte.** Estratégia idêntica à do funil atual (um único code path), já validada.
