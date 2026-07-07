# EPIC-MANAGER-UX / S9, Tabela simplificada da visão gestor (variant manager, coluna Ritmo, Engajamento explicado, LGPD do clique)

> Status: DRAFT PARA REVISÃO, NÃO IMPLEMENTAR até GO de Hugo.
> Onda: 2 · Data: 2026-07-07 · Executor: @dev · Tipo: feature + hard guard de segurança
> Referências de design (em `docs/stories/epic-manager-ux/design/`): R1 `01-diagnostico-detalhes-alunos.pdf`, R2 `02-proposta-detalhes-alunos.pdf`, R3 `03-mockup-tela-principal.png`

## User Story

Como gestor olhando a tabela "Detalhes dos Alunos" no dashboard Meu Time, quero uma tabela enxuta com as colunas que respondem "quem precisa de mim agora" (Aluno, Time, Email, Último acesso, Ritmo, Progresso, Engajamento), sem Sessões e Cursos que conflitam entre si e não geram decisão, e com o Engajamento explicado no header, para ler a lista em segundos sem nunca esbarrar em conteúdo bruto escrito por aluno (decisão D-C, LGPD).

## Referência de design

- R3 (mockup da tela principal): a tabela inferior mostra as colunas Aluno, Time, Último acesso, Ritmo (badges "No ritmo" verde, "Atrasado" vermelho, "Não iniciado" cinza), Progresso, Engajamento e Ação. Esta spec entrega tudo menos a coluna Ação (S10). O mockup não traz a coluna Email; a variant manager a preserva (divergência deliberada, ver E2).
- R2 (proposta, bloco 3 "tabela simplificada"): remover colunas sem decisão (Sessões, Cursos), introduzir Ritmo por aluno, explicar o Engajamento. Bloco 5 "detalhe futuro" entra aqui só em Fora de escopo.
- R1 (diagnóstico): resolve os problemas #3 indicadores conflitantes, #4 coluna Cursos sem valor de decisão, #5 coluna Sessões ambígua, #6 engajamento opaco, #7 Progressão conflitando com Cursos.

## Estado atual (recon arquivo:linha)

Fonte de verdade lida integralmente em 2026-07-07. Ponteiros conferidos no código real.

1. `apps/web/src/components/analytics/student-insights-table.tsx` (client, "use client"):
   - L37-53: `StudentInsightRow`. NÃO existe campo `ritmo` hoje.
   - L55-60: props `{ students, showSubteam?, expandable? }`. `expandable` default `true` (L131), comentário L58 já documenta o uso `false` na visão gestor por LGPD.
   - L62-68: `SortKey = "full_name" | "lastSessionDate" | "totalSessions" | "coursesEnrolled" | "courseProgressPct" | "engagement"`. L70-72: `getEngagementScore(s) = completedSessions * 2 + reflectionsCount`.
   - L145: `const columnCount = showSubteam ? 8 : 7` (usado no `colSpan` do empty state L382 e da linha expandida L526).
   - L322-376: headers na ordem Nome, Time (condicional showSubteam, funil de filtro L331-353), Email, Último Acesso, Sessões (L365-367), Engajamento (L368-370), Cursos (L371-373), Progressão (L374-376).
   - L396-399: `hasDetails = expandable && (recentSessions ou recentReflections não vazios)`, controla o chevron. L420-432: quando `expandable`, o NOME do aluno é `<button>` que expande; senão `<span>`.
   - Células: Sessões L452-457; Engajamento L459-497 (score, barra, badge "Inativo" quando score 0, sublabel `sess · refl` L490-493); Cursos L498-503; Progressão L505-522 (`courseProgressPct%` + barra `bg-varzea`).
   - L524-542: linha expandida com `StudentExpandedContent` (texto bruto de sessões/reflexões) + Link "Ver perfil completo" para `/analytics/students/${student.id}` (L533-538). Tudo gated por `expandable`.
2. `apps/web/src/components/dashboard/manager-dashboard.tsx`:
   - L152-154: call-site do gestor, `<StudentInsightsTable students={studentDetails} showSubteam={showSubteam} expandable={false} />`. Hoje a fronteira do clique depende SÓ desta prop no call-site.
3. `apps/web/src/app/(platform)/instructor/page.tsx`:
   - L314: call-site do instrutor, `<StudentInsightsTable students={studentDetails} />` (default `expandable = true`, expansão + link de perfil ativos). INTOCADO por esta spec.
4. `apps/web/src/app/(platform)/dashboard/_components/manager-dashboard-page.tsx`:
   - L154-159: strip LGPD server-side, `const safe = { ...student, recentSessions: [], recentReflections: [] }` para TODO aluno da visão gestor. Counts permanecem. Esta defesa PERMANECE obrigatória.
   - L215-263: pace (paceHighlights): `expectedPct = min(100, round((elapsed / deadline_days) * 100))` (L244), `status` ahead/on_track/behind (L253). Base da taxonomia RitmoAluno da S7.
5. `apps/web/src/lib/engagement-helpers.ts`: L67 `INACTIVE_DAYS = 14`, L68 `AT_RISK_DAYS = 5`, limiares canônicos da Onda 2 (buckets inativos/devendo/accessed).
6. `apps/web/src/app/(platform)/analytics/students/[studentId]/page.tsx`: L25-26, `canSeeRawContent` = `roles.includes()` de instructor, admin ou super_admin, sobre a UNIÃO de chapéus. Manager NÃO passa; o perfil completo é território instrutor/admin.
7. `apps/web/src/lib/student-triage.ts`: NÃO existe hoje (grep vazio). É criado pela S7, que exporta `StudentRitmo`/`StudentTriagem` e enriquece cada row com `ritmo?: StudentRitmo` server-side em `manager-dashboard-page.tsx`. S9 CONSOME o campo, não o calcula.

Taxonomia canônica consumida (definida na S7, repetida para o agente frio): `type StudentRitmo = "no_ritmo" | "atrasado" | "nao_iniciado"`. Regras: `nao_iniciado` = `totalSessions === 0 && (courseProgressPct ?? 0) === 0`; `atrasado` = não nao_iniciado e existe enrollment ATIVO em curso com deadline com `pct < expectedPct` (fórmula do item 4); `no_ritmo` = caso contrário (inclui ahead, on_track e concluídos).

## Escopo decidido

E1. **Prop `variant`.** A tabela ganha `variant?: "instructor" | "manager"`, default `"instructor"` = comportamento atual 100% INTACTO (todas as colunas, expansão, link de perfil). `variant="manager"` ativa E2-E5.

E2. **Colunas da variant manager.** NÃO renderiza as colunas Sessões (completed/total) e Cursos (completed/enrolled), nem seus headers. Renderiza a nova coluna Ritmo. Ordem final manager (ordem do mockup R3, onde Progresso vem antes de Engajamento, MAIS a coluna Email preservada, divergência deliberada: o mockup não traz Email, mas ele permanece por utilidade de contato e para não mexer na identificação da row): Nome, Time (se showSubteam), Email, Último Acesso, **Ritmo**, **Progressão**, **Engajamento**. Na instructor a ordem atual não muda. `columnCount`: manager = 7 com showSubteam, 6 sem; instructor = 8 e 7 (inalterado). Esta base `(isManager ? 6 : 7) + (showSubteam ? 1 : 0)` é a que S10 soma ao acrescentar a coluna Ação.

Divergência registrada: a coluna Email não existe no mockup R3, mas é mantida na variant manager por utilidade operacional (contato direto do gestor com o aluno), decisão deliberada desta spec, não omissão do mockup.

E3. **Coluna Ritmo.** Badge (pill com dot, padrão visual dos badges existentes) a partir de `row.ritmo`: `"no_ritmo"` = "No ritmo" verde, `"atrasado"` = "Atrasado" vermelho, `"nao_iniciado"` = "Não iniciado" cinza. `ritmo` undefined (defensivo) renderiza `-` em `text-text-muted`, sem badge. Sortável: `SortKey` ganha `"ritmo"` com rank asc `atrasado(0) < nao_iniciado(1) < no_ritmo(2) < undefined(3)`, ordenar asc traz os atrasados primeiro (ordenação por atenção).

E4. **Engajamento explicado.** Ícone `Info` (lucide) no header Engajamento (ambas as variants, header compartilhado, não altera colunas da instructor), com tooltip nativo `title` e `aria-label`, texto EXATO: "Engajamento = sessões concluídas x2 + reflexões. Sessões são interações ao final dos módulos; reflexões são registros ao longo dos slides.". O sublabel `N sess · N refl` nas células permanece.

E5. **Fronteira LGPD do clique (D-C), hard guard estrutural.** Na variant manager, a expansão é FORÇADA off independente da prop: `const canExpand = expandable && variant !== "manager"`, aplicado a todos os usos de `expandable` no render (`hasDetails` L396-399, nome-como-botão L420, linha expandida L524). Resultado: nome nunca vira botão, chevron nunca aparece, nenhum `Link` para `/analytics/students/[id]` para gestor, mesmo que um call-site futuro passe `expandable={true}` por engano. O strip server-side (`manager-dashboard-page.tsx` L154-159) permanece obrigatório como primeira defesa; o hard guard é defesa em profundidade na UI.

E6. **Call-sites.** `manager-dashboard.tsx` L153 passa `variant="manager"` (mantém `expandable={false}`, agora redundante). `instructor/page.tsx` L314 fica SEM prop (default instructor, zero mudança).

## Fora de escopo

F1. Coluna Ação (botões "Lembrar"/"Acionar" ligados ao endpoint rico de nudge). PROPRIEDADE DA S10, que a acrescenta ao FINAL da variant manager (após Engajamento, ordem do mockup R3) reutilizando a `variant` desta spec.
F2. Mudar qualquer coluna, ordem ou comportamento da visão instrutor (o Info do header E4 é aditivo e compartilhado, não muda colunas). Expansão e "Ver perfil completo" do instrutor continuam como estão.
F3. Remover ou alterar o funil de filtro de Time no header. PROPRIEDADE DA S6 (mesma tabela, landa antes).
F4. Calcular `ritmo`/`triagem`. PROPRIEDADE DA S7 (`student-triage.ts`, helpers puros, enriquecimento server-side em `manager-dashboard-page.tsx`). S9 apenas consome `row.ritmo`.
F5. Detalhe futuro (R2, bloco 5): a futura visão detalhada de aprendizagem ao clicar no aluno será construída SÓ para instrutor/admin (decisão D-C). A `variant="manager"` desta spec é a garantia ESTRUTURAL de que o gestor não herda esse clique: ele nascerá no branch `canExpand`/instructor, que a variant manager nunca ativa. O gate `canSeeRawContent` (L25-26) segue como anel server-side.
F6. Cards de triagem, 3ª coluna dos destaques e KPIs do topo (S8 e demais specs da onda).

## Mudanças de código (POR ARQUIVO)

### A) `apps/web/src/components/analytics/student-insights-table.tsx`

1. Import do tipo da S7 e do ícone:

```ts
import type { StudentRitmo } from "@/lib/student-triage"
// lucide: adicionar Info ao import existente (L5-15)
```

2. `StudentInsightRow` (L37-53) ganha o campo opcional `ritmo?: StudentRitmo` (se a S7 já o tiver adicionado ao landar antes, este passo é no-op).

3. Props (L55-60):

```ts
interface StudentInsightsTableProps {
  students: StudentInsightRow[]
  showSubteam?: boolean
  /** When false, rows do not expand into raw interactions/reflections (manager view, LGPD). */
  expandable?: boolean
  /**
   * "manager" hides Sessões/Cursos, adds Ritmo, and HARD-DISABLES row expansion
   * and profile links regardless of `expandable` (LGPD, D-C). Default "instructor".
   */
  variant?: "instructor" | "manager"
}
```

4. `SortKey` (L62-68) ganha `| "ritmo"`. Rank de ordenação (módulo-level, junto de `getEngagementScore`):

```ts
const RITMO_SORT_RANK: Record<StudentRitmo, number> = {
  atrasado: 0,
  nao_iniciado: 1,
  no_ritmo: 2,
}
function getRitmoRank(s: StudentInsightRow): number {
  return s.ritmo ? RITMO_SORT_RANK[s.ritmo] : 3
}
```

5. Corpo do componente (L128-145):

```ts
export function StudentInsightsTable({
  students,
  showSubteam = false,
  expandable = true,
  variant = "instructor",
}: StudentInsightsTableProps) {
  const isManager = variant === "manager"
  // LGPD hard guard (D-C): manager NEVER expands, whatever the prop says.
  const canExpand = expandable && !isManager
  const columnCount = (isManager ? 6 : 7) + (showSubteam ? 1 : 0)
```

Substituir TODOS os usos de `expandable` no render por `canExpand`: no cálculo de `hasDetails` (L396-399), no branch nome-como-botão vs span (L420), no render da linha expandida (L524). A prop `expandable` continua existindo para a visão instrutor.

6. Case novo no sort (switch L239-260):

```ts
case "ritmo":
  return dir * (getRitmoRank(a) - getRitmoRank(b))
```

Além do case, alterar `toggleSort` para a direção inicial de Ritmo ser ascendente: `setSortDir(key === "full_name" || key === "ritmo" ? "asc" : "desc")` (hoje toda coluna exceto `full_name` inicia em `desc`; sem essa mudança o PRIMEIRO clique em Ritmo listaria no_ritmo/sem-ritmo primeiro, o oposto da ordenação por atenção). Não afeta a visão instrutor: a coluna Ritmo só existe na variant manager.

7. Headers (L322-376). Envolver os headers Sessões e Cursos em `{!isManager && (...)}`. Na posição logo após Último Acesso, quando `isManager`, inserir:

```tsx
{isManager && (
  <th className="px-4 py-3 text-center">
    <SortHeader label="Ritmo" colKey="ritmo" />
  </th>
)}
```

Ordem de `<th>` na manager: Nome, [Time], Email, Último Acesso, Ritmo, Progressão, Engajamento. Como a instructor mantém Engajamento antes de Progressão e a manager inverte (mockup R3), extrair o `<th>` e o `<td>` de Engajamento e Progressão para variáveis locais JSX e renderizar `{isManager ? <>{progress}{engagement}</> : <>{engagement}{progress}</>}` nos dois lugares. Nenhum estilo interno dessas células muda.

8. Header Engajamento ganha o Info (dentro do `<th>`, ao lado do `SortHeader`):

```tsx
<span className="inline-flex items-center gap-1">
  <SortHeader label="Engajamento" colKey="engagement" />
  <Info
    size={12}
    className="text-text-muted/60 hover:text-text-muted cursor-help"
    title={ENGAGEMENT_HELP}
    aria-label={ENGAGEMENT_HELP}
  />
</span>
```

Com a constante módulo-level `const ENGAGEMENT_HELP = "Engajamento = sessões concluídas x2 + reflexões. Sessões são interações ao final dos módulos; reflexões são registros ao longo dos slides."`. (Se o `title` no SVG não exibir tooltip em algum browser alvo, envolver o ícone num `<span title={ENGAGEMENT_HELP} aria-label={ENGAGEMENT_HELP}>`; ver Riscos item 5.)

9. Célula Ritmo (só quando `isManager`, após a célula Último Acesso). Badge pill com dot, padrão dos badges existentes (ex.: "Inativo" L466-468):

```tsx
const RITMO_BADGE: Record<StudentRitmo, { label: string; dot: string; text: string; bg: string }> = {
  no_ritmo: { label: "No ritmo", dot: "bg-semantic-success", text: "text-semantic-success", bg: "bg-semantic-success/10" },
  atrasado: { label: "Atrasado", dot: "bg-semantic-error", text: "text-semantic-error", bg: "bg-semantic-error/10" },
  nao_iniciado: { label: "Não iniciado", dot: "bg-neutral-500", text: "text-text-muted", bg: "bg-black/[0.04]" },
}

function RitmoBadge({ ritmo }: { ritmo?: StudentRitmo }) {
  if (!ritmo) return <span className="text-xs text-text-muted">-</span>
  const cfg = RITMO_BADGE[ritmo]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}
```

A célula é `{isManager && (<td className="px-4 py-3 text-center"><RitmoBadge ritmo={student.ritmo} /></td>)}`.

10. Células Sessões (L452-457) e Cursos (L498-503) envolvidas em `{!isManager && (...)}`, espelhando os headers.

### B) `apps/web/src/components/dashboard/manager-dashboard.tsx`

L152-154, call-site do gestor, vira:

```tsx
<StudentInsightsTable students={studentDetails} showSubteam={showSubteam} expandable={false} variant="manager" />
```

`expandable={false}` fica mantido por clareza (documentação viva), mas deixa de ser a única trava: o hard guard E5 garante o mesmo resultado mesmo sem ele.

### C) `apps/web/src/app/(platform)/instructor/page.tsx`

NENHUMA mudança. L314 continua `<StudentInsightsTable students={studentDetails} />` (default `variant="instructor"`, `expandable=true`).

## Dados-RLS-Segurança

1. Zero mudança de dados, queries, RLS ou rotas. Esta spec é presentacional: consome `row.ritmo` já computado server-side pela S7 dentro do `teamScope` gated pelas RPCs SECURITY DEFINER (`apps/web/src/lib/area-context.ts`, fail-closed).
2. Defesa em profundidade LGPD (D-C), três anéis independentes: (a) strip server-side em `manager-dashboard-page.tsx` L154-159, texto bruto nunca chega ao payload do gestor, PERMANECE OBRIGATÓRIO; (b) hard guard `canExpand` no componente, gestor nunca expande nem linka mesmo com prop errada; (c) gate `canSeeRawContent` sobre a união de chapéus na página de perfil (L25-26), que barra o texto bruto server-side caso a URL seja digitada na mão.
3. O campo `ritmo` é métrica derivada (status agregado), não conteúdo escrito por aluno: sem implicação LGPD nova.
4. Nenhum endpoint de escrita é tocado (a ligação com nudges é S10).

## Acceptance Criteria

- AC1. Sem a prop `variant` (call-site do instrutor intocado), a tabela renderiza EXATAMENTE como hoje: headers Nome, [Time], Email, Último Acesso, Sessões, Engajamento, Cursos, Progressão; expansão de linha e link "Ver perfil completo" funcionando com `expandable` default true.
- AC2. Com `variant="manager"`, os headers e células Sessões e Cursos NÃO existem no DOM.
- AC3. Com `variant="manager"`, existe a coluna Ritmo entre Último Acesso e Progressão, com badges: `"no_ritmo"` mostra "No ritmo" (semantic-success), `"atrasado"` mostra "Atrasado" (semantic-error), `"nao_iniciado"` mostra "Não iniciado" (text-muted); `ritmo` undefined mostra `-` sem badge.
- AC4. O PRIMEIRO clique no header Ritmo ordena asc (direção inicial da coluna) e lista atrasado primeiro, depois nao_iniciado, depois no_ritmo, depois linhas sem ritmo; o segundo clique (desc) inverte.
- AC5. `columnCount` (e o `colSpan` do empty state) vale 7 na manager com `showSubteam`, 6 sem; 8 e 7 na instructor (inalterado).
- AC6. O header Engajamento (ambas as variants) tem ícone Info com `title` e `aria-label` contendo o texto exato de E4 (`ENGAGEMENT_HELP`). O sublabel "N sess · N refl" das células permanece.
- AC7. HARD GUARD LGPD: com `variant="manager"` e `expandable={true}` FORÇADO e rows com `recentSessions`/`recentReflections` não vazios, o DOM não contém chevron, o nome NÃO é `<button>`, e não existe `href` começando com `/analytics/students/`.
- AC8. `manager-dashboard.tsx` passa `variant="manager"` no call-site L152-154; `instructor/page.tsx:314` permanece sem a prop (diff vazio no arquivo).
- AC9. `pnpm --filter @eximia/web typecheck`, `pnpm --filter @eximia/web lint` e `pnpm --filter @eximia/web test` verdes.

## Plano de testes

First-move rule: AC7 é fronteira de segurança (LGPD), então o PRIMEIRO movimento é escrever o teste vermelho do hard guard ANTES de tocar o componente; o restante é feature coberta por testes novos, e a suíte existente (ex.: `apps/web/src/components/dashboard/__tests__/manager-dashboard.test.tsx`) deve permanecer verde do início ao fim.

1. Teste vermelho primeiro (novo arquivo `apps/web/src/components/analytics/__tests__/student-insights-table.test.tsx`, vitest + testing-library, padrão de `components/dashboard/__tests__/`):
   - "manager variant never expands nor links (LGPD hard guard)": render com `variant="manager"` e `expandable={true}` (proposital) e um aluno com `recentSessions`/`recentReflections` populados; assert: nenhum chevron, nome NÃO é `button`, sem texto "Ver perfil completo", `querySelector('a[href^="/analytics/students/"]')` null. FALHA antes do guard, passa depois.
2. Testes de feature (mesmo arquivo):
   - "manager variant hides Sessões and Cursos, shows Ritmo": headers "Sessões"/"Cursos" ausentes, "Ritmo" presente; badges "No ritmo"/"Atrasado"/"Não iniciado" por valor de `ritmo`; `-` para row sem `ritmo`.
   - "ritmo sort asc puts atrasado first": PRIMEIRO click no header Ritmo (direção inicial asc via `toggleSort`), assert da ordem (atrasado, nao_iniciado, no_ritmo, sem ritmo).
   - "instructor default unchanged": render SEM `variant`; Sessões/Cursos presentes, nome é botão quando há detalhes, link de perfil aparece ao expandir.
   - "engagement header explains the score": query por `[aria-label]` contendo "Engajamento = sessões concluídas x2 + reflexões".
   - "empty state colSpan matches variant": render manager sem rows, com e sem `showSubteam`, assert `colSpan` 7 e 6.
3. Comandos literais, na ordem:
   - `pnpm --filter @eximia/web test` (vermelho no passo 1, verde ao final)
   - `pnpm --filter @eximia/web typecheck`
   - `pnpm --filter @eximia/web lint`
4. Verificação manual (testbed): como gestor, conferir a tabela do Meu Time com as colunas novas e badges; como instrutor em `/instructor`, conferir que NADA mudou (expansão e perfil completo funcionando).

## Dependências

- **S6** (filtro da tabela): mexe no MESMO arquivo `student-insights-table.tsx`; landa ANTES para evitar conflito de merge. S9 rebaseia sobre S6.
- **S7** (helper `apps/web/src/lib/student-triage.ts` + enriquecimento `ritmo?: StudentRitmo` nas rows): dependência DURA do tipo e do dado; ordem obrigatória S7 antes de S9 (sem S7 o import do tipo quebra o typecheck; o fallback `-` cobre apenas dado ausente em runtime).
- **S10** (coluna Ação): consome a `variant="manager"` desta spec para acrescentar a coluna Ação ao final; não bloqueia S9.

## Riscos

1. **S7 atrasar**: `ritmo` undefined renderiza `-` em toda a coluna (fallback E3), tabela funcional porém sem o sinal principal. Mitigação: merge S7 antes de S9; o fallback evita crash.
2. **Conflito com S6 no mesmo arquivo**: ambos tocam headers/estado da tabela. Mitigação: sequenciamento (S6 primeiro) e mudanças de S9 concentradas em blocos condicionais `isManager`.
3. **Regressão silenciosa na visão instrutor**: o refactor de ordenar Engajamento/Progressão por variant toca JSX compartilhado. Mitigação: teste "instructor default unchanged" + suíte existente verde do início ao fim.
4. **Vocabulário duplo na célula Engajamento**: o badge "Inativo" (score 0, L466-468) convive com a taxonomia da onda ("Sem acesso"). Não é contradição de dado; registrado para a S10 harmonizar quando a coluna Ação entrar. S9 não mexe.
5. **Tooltip nativo em SVG**: `title` em componente lucide vira attribute do `<svg>`, cujo tooltip varia por browser. Mitigação no item 8 das mudanças (wrapper `<span title>`), texto idêntico.
