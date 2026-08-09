# EPIC-MANAGER-UX / S10, Coluna Ação: nudge individual na tabela do gestor

> Status: DRAFT PARA REVISÃO, NÃO IMPLEMENTAR até GO de Hugo.
> Onda: 2 · Data: 2026-07-07 · Executor: @dev · Tipo: feature (client-first, zero mudança de servidor)
> Referências de design: R1 `docs/stories/epic-manager-ux/design/01-diagnostico-detalhes-alunos.pdf`, R2 `docs/stories/epic-manager-ux/design/02-proposta-detalhes-alunos.pdf`, R3 `docs/stories/epic-manager-ux/design/03-mockup-tela-principal.png`
> Decisão do Senhor que esta spec implementa: D-B (Coluna Ação = ligação INDIVIDUAL com o sistema de nudges existente, endpoint rico, array de 1).

## User Story

Como gestor na visão Meu Time, quero uma coluna "Ação" na tabela de alunos que me diga, por aluno, se está tudo bem (badge "No ritmo") ou se devo agir agora ("Lembrar" para quem precisa de atenção, "Acionar" para quem está sem acesso), disparando o lembrete individual em 2 cliques direto da linha, para que a tabela deixe de ser só leitura e vire decisão, sem abrir a Central de Engajamento para um caso pontual.

## Referência de design

- R2, bloco 4 "Ações do Gestor": 3 estados por aluno, No ritmo (sem ação), Lembrar, Acionar. Esta spec implementa esse bloco.
- R3, mockup: última coluna da tabela ("Ação") com badge verde "No ritmo" e botões "Lembrar" (âmbar) e "Acionar" (vermelho). As colunas anteriores do mockup são escopo de S8/S9; S10 acrescenta somente a última.
- R1, diagnóstico: gestor vê o atraso mas não tem como agir dali (leitura sem ação). S10 fecha esse gap.

## Estado atual (recon arquivo:linha)

1. `apps/web/src/components/analytics/student-insights-table.tsx` (client, `"use client"`):
   - L55-60: props `{ students, showSubteam?, expandable? }`. Não existe `canNudge` nem coluna de ação.
   - L128-131: assinatura `export function StudentInsightsTable({ students, showSubteam = false, expandable = true })`.
   - L145: `const columnCount = showSubteam ? 8 : 7` (usado nos `colSpan` de empty state L382 e linha expandida L526).
   - L320-378 (thead): última coluna hoje é `<SortHeader label="Progressão" colKey="courseProgressPct" />` (~L374-377).
   - L504-522: última célula de dados é a de Progressão (barra `bg-varzea`); a linha fecha em `</tr>` (~L523).
   - L147-163 + L557-575: padrão de menu flutuante já existente (funil de filtro de time): posição via `getBoundingClientRect()`, backdrop `fixed inset-0 z-40`, painel com `style={{ position: "fixed", top, left, backgroundColor: "var(--color-bg-card, #ffffff)" }}` e `className="z-50 ... shadow-elevated ring-1 ring-inset ring-black/[0.08]"`. Padrão a reusar no popover (o comentário do arquivo avisa: utilities de cor do Tailwind v4 não são confiáveis neste tema, background vai inline via var). Nota: após S6, este padrão de menu `fixed` sai da tabela e passa a viver em `dashboard/_components/team-filter-dropdown.tsx`; replicar de lá (mesmo backdrop + `position: fixed` + var `--color-bg-card`), não das linhas antigas do arquivo se S6 já tiver landado.
2. `apps/web/src/components/dashboard/manager-dashboard.tsx` L152-154: call-site do gestor `<StudentInsightsTable students={studentDetails} showSubteam={showSubteam} expandable={false} />`. Após S9 passa também `variant="manager"`.
3. Endpoint RICO (pronto, S10 não o altera): `apps/web/src/app/api/analytics/manager/nudge/route.ts`. L29-36: `NUDGE_TYPES` = `never_accessed | inactive | no_reflection | top_performer | announcement | custom`. L41: `MAX_RECIPIENTS = 200` (array de 1 é trivialmente válido). L44-51: `getAuthProfile()` + `hasRole({ roles }, "manager")` ESTRITO (403 é o gate de papel, sem o chapéu manager na união). L100-118: re-scope server-side com `getManagedTeamStudentIds(supabase, tenantId, user.id, { includeSubtree: true })`, ids fora do time viram `recipientsSkipped` (todos fora = 400 `{ error: "No recipients within your team" }`, não 403; 403 fica reservado ao gate de papel acima). L120-142: dispatch e resposta `{ inAppCreated, emailsSent, emailsFailed, emailRowsFailed, recipientsSkipped, total }`.
4. `apps/web/src/lib/notifications/engine.ts` L674: `dispatchTeamNudge(...)` grava in-app (tabela `notifications`, channel `inapp`, origin `nudge`), espelha por email via Resend e entra no funil de eficácia (cron `/api/cron/notification-efficacy` marca `returned_at`). O disparo individual ganha histórico e métrica de graça.
5. Padrão de fetch client a copiar: `apps/web/src/components/dashboard/team-engagement-header.tsx` L194 (`fetch("/api/analytics/manager/nudge", { method: "POST", ... })`), com `import type { NudgeType } from "@/types/notifications"` na L32.
6. Endpoint LEGADO, NÃO usar: `POST /api/notifications/nudge` (email hardcoded, sem in-app, sem histórico). Único caller: `apps/web/src/components/analytics/student-roster.tsx` L433 (fluxo do instrutor).
7. Taxonomia (S7): `apps/web/src/lib/student-triage.ts` exporta `StudentTriagem = "no_ritmo" | "atencao" | "sem_acesso"` e `computeStudentTriagem`; `StudentInsightRow` ganha `triagem?: StudentTriagem` preenchida server-side em `manager-dashboard-page.tsx`. S10 consome, não recalcula.
8. RLS de defesa já aplicada: `supabase/migrations/20260630000000_engagement_rls_group_scope.sql` (escopo de grupo nas escritas de engajamento) e `20260703010000_auth_team_engagement_signals.sql` (RPC SECURITY DEFINER dos sinais).

## Escopo decidido

1. Nova coluna final "Ação" na `StudentInsightsTable`, renderizada SOMENTE quando `variant === "manager" && canNudge` (nova prop `canNudge?: boolean`, default `false`).
2. Célula derivada de `row.triagem` (T3): `no_ritmo` = badge verde outline "No ritmo", sem ação; `atencao` = botão âmbar "Lembrar" (`BellRing`), `nudgeType: "inactive"`; `sem_acesso` = botão vermelho "Acionar" (`Send`), `nudgeType: row.totalSessions === 0 ? "never_accessed" : "inactive"`; `triagem` ausente = placeholder neutro, nunca quebra.
3. Clique abre confirmação inline leve: popover ancorado no botão, mesmo padrão `position: fixed` do menu de filtro (L557-575), com texto exato "Enviar lembrete para {nome}? O aluno recebe uma notificação no app e por email." e botões "Cancelar" / "Enviar".
4. Confirmado, `fetch` client-side de `POST /api/analytics/manager/nudge` com body `{ studentIds: [row.id], nudgeType }`. Sem `templateKey`, `message` ou `courseId` (o engine usa o template default do tipo).
5. Sucesso (`res.ok` e `recipientsSkipped === 0`): botão vira "Enviado" com `Check`, `disabled`, só na sessão (estado local `Map studentId -> status`). Erro, 403 ou `recipientsSkipped > 0`: mensagem inline "Não foi possível enviar", botão volta e permite retry.
6. `manager-dashboard.tsx` passa `canNudge={true}` no call-site do gestor (junto com o `variant="manager"` de S9). Instrutor (`instructor/page.tsx` L314) continua sem a coluna.
7. Acessibilidade: `aria-label` "Enviar lembrete para {nome}" nos botões, popover `role="dialog"` com foco inicial em "Cancelar"; `Escape` e backdrop fecham.

## Fora de escopo

- Cooldown persistente por aluno (anti-spam além do estado de sessão). Follow-up anotado, shape sugerido: `manager-dashboard-page.tsx` consulta `notifications` (service client, escopo do time) por `recipient_id, max(created_at)` com `origin = 'nudge'`, enriquece a row com `lastNudgeAt?: string`, e a célula troca o botão por "Enviado há Xh" quando `now - lastNudgeAt < 24h`.
- Escolha de template ou mensagem custom na tabela: a Central de Engajamento (`admin/notifications/page.tsx`) já cobre.
- Nudge em massa: já existe na strip de buckets (`team-engagement-header.tsx`), não duplicar.
- Instrutor/admin nudgar da tabela: o endpoint rico é manager-only. O instrutor hoje usa o fluxo legado do roster (`student-roster.tsx` L433); unificar no endpoint rico é follow-up separado.
- Qualquer mudança em `route.ts`, `engine.ts`, RPCs ou migrations. O servidor já está pronto.

## Mudanças de código

### 1. `apps/web/src/lib/student-triage.ts` (helper de S7, adição pura)

Adicionar a derivação Ação->nudgeType como função pura exportada, para teste unitário e para a tabela não conter regra de negócio:

```ts
import type { NudgeType } from "@/types/notifications"

export type StudentAction =
  | { kind: "none" }                          // no_ritmo: badge estática
  | { kind: "lembrar"; nudgeType: NudgeType } // atencao
  | { kind: "acionar"; nudgeType: NudgeType } // sem_acesso

export function computeStudentAction(
  triagem: StudentTriagem | undefined,
  totalSessions: number
): StudentAction | null {
  if (!triagem) return null // chamador não enriqueceu
  if (triagem === "no_ritmo") return { kind: "none" }
  if (triagem === "atencao") return { kind: "lembrar", nudgeType: "inactive" }
  return { kind: "acionar", nudgeType: totalSessions === 0 ? "never_accessed" : "inactive" }
}
```

### 2. `apps/web/src/components/analytics/student-insights-table.tsx`

a) Props (L55-60), aditivo e retrocompatível:

```ts
interface StudentInsightsTableProps {
  students: StudentInsightRow[]
  showSubteam?: boolean
  expandable?: boolean
  variant?: "instructor" | "manager" // introduzida por S9 (default "instructor")
  /** Habilita a coluna Ação (nudge individual). Só tem efeito com variant="manager". */
  canNudge?: boolean // default false
}
```

Destructuring (L130-131): `canNudge = false`. Flag derivada uma vez: `const showAction = variant === "manager" && canNudge`.

b) `columnCount`: aditivo sobre a base que S9 já estabeleceu (`(isManager ? 6 : 7) + (showSubteam ? 1 : 0)`), somando a coluna condicional:

```ts
const columnCount = (isManager ? 6 : 7) + (showSubteam ? 1 : 0) + (showAction ? 1 : 0)
```

Valores resultantes de `colSpan`: manager com `showSubteam` e `canNudge` = 8 (Nome, Time, Email, Último Acesso, Ritmo, Progressão, Engajamento, Ação); manager sem `showSubteam` = 7; instructor inalterado (8 com `showSubteam`, 7 sem, pois `showAction` é sempre false nessa variant).

c) Estado novo no componente (client, sessão local):

```ts
type NudgeUiStatus = "sending" | "sent" | "error"
const [nudgeStatus, setNudgeStatus] = useState<Map<string, NudgeUiStatus>>(new Map())
const [confirmNudge, setConfirmNudge] = useState<{
  studentId: string
  studentName: string
  nudgeType: NudgeType
  pos: { top: number; left: number }
} | null>(null)
```

`import type { NudgeType } from "@/types/notifications"` (mesmo import de `team-engagement-header.tsx` L32). Ícones: adicionar `BellRing`, `Send`, `Check` ao import lucide existente (L5; `Check` já está importado, verificar antes de duplicar).

d) Header (thead): o `<th>` de Ação entra após a ÚLTIMA coluna da variant manager, ou seja, após o par reordenado `{progress}{engagement}` de S9 (na manager, Engajamento é a última coluna antes da Ação). Não ordenável:

```tsx
{showAction && (
  <th className="px-4 py-3 text-center">
    <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Ação</span>
  </th>
)}
```

e) Célula por linha: idem ao header, a `<td>` de Ação entra após a última célula de dados da variant manager (Engajamento, já reordenada por S9), imediatamente antes do `</tr>`. Pseudocódigo do render:

```tsx
{showAction && (
  <td className="px-4 py-3 text-center">
    {(() => {
      const action = computeStudentAction(student.triagem, student.totalSessions)
      if (!action) return <span aria-hidden className="text-text-muted">–</span>
      if (action.kind === "none")
        return <span className="... text-semantic-success ring-1 ring-inset ring-semantic-success/40">No ritmo</span>
      const status = nudgeStatus.get(student.id)
      if (status === "sent")
        return <span className="... text-text-muted"><Check size={12} /> Enviado</span>
      const isLembrar = action.kind === "lembrar"
      return (
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            disabled={status === "sending"}
            aria-label={`Enviar lembrete para ${student.full_name}`}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              setConfirmNudge({
                studentId: student.id,
                studentName: student.full_name,
                nudgeType: action.nudgeType,
                pos: { top: r.bottom + 6, left: Math.max(8, r.right - 288) },
              })
            }}
            className={isLembrar
              ? "... text-accent-gold ring-1 ring-inset ring-accent-gold/50 hover:bg-accent-gold/10"
              : "... text-semantic-error ring-1 ring-inset ring-semantic-error/50 hover:bg-semantic-error/10"}
          >
            {isLembrar ? <BellRing size={13} /> : <Send size={13} />}
            {isLembrar ? "Lembrar" : "Acionar"}
          </button>
          {status === "error" && (
            <span className="text-[10px] font-medium text-semantic-error">Não foi possível enviar</span>
          )}
        </div>
      )
    })()}
  </td>
)}
```

Badge e botões seguem o shape visual dos pills existentes no arquivo (rounded-full/rounded-lg, text-xs, padding px-2.5/px-3). Cores (T4): "Lembrar" usa `accent-gold`, "Acionar" usa `semantic-error`, badge usa `semantic-success`. Se alguma utility de cor não resolver no tema oklch (caveat documentado no próprio arquivo L555-557), aplicar via `style` inline com a var equivalente, exatamente como o menu de filtro faz com `--color-bg-card`.

f) Popover de confirmação (novo bloco no fim do JSX, irmão do menu de filtro L557-575, mesmo padrão backdrop + painel fixed):

```tsx
{confirmNudge && (
  <>
    <button type="button" aria-hidden="true" tabIndex={-1}
      className="fixed inset-0 z-40 cursor-default"
      onClick={() => setConfirmNudge(null)} />
    <div
      role="dialog"
      aria-label={`Confirmar lembrete para ${confirmNudge.studentName}`}
      style={{ position: "fixed", top: confirmNudge.pos.top, left: confirmNudge.pos.left,
               backgroundColor: "var(--color-bg-card, #ffffff)" }}
      className="z-50 w-72 rounded-xl p-3 shadow-elevated ring-1 ring-inset ring-black/[0.08]"
    >
      <p className="text-sm text-text-primary">
        Enviar lembrete para <span className="font-semibold">{confirmNudge.studentName}</span>?
        O aluno recebe uma notificação no app e por email.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => setConfirmNudge(null)} className="...">Cancelar</button>
        <button type="button" onClick={() => void sendNudge(confirmNudge)} className="..."
          style={{ backgroundColor: "var(--color-cerrado-600, #16a34a)" }}>Enviar</button>
      </div>
    </div>
  </>
)}
```

Ao abrir, focar o botão "Cancelar" (`ref` + `useEffect`); listener de `keydown` para `Escape` fechar (mesma vida útil do popover). Estilo dos botões: "Cancelar" neutro (`text-text-muted hover:bg-bg-hover`), "Enviar" primário (`text-white` sobre `cerrado-600` via var inline).

g) Função de envio (mesmo padrão de `team-engagement-header.tsx` L194):

```ts
async function sendNudge(c: NonNullable<typeof confirmNudge>) {
  setConfirmNudge(null)
  setNudgeStatus((m) => new Map(m).set(c.studentId, "sending"))
  try {
    const res = await fetch("/api/analytics/manager/nudge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIds: [c.studentId], nudgeType: c.nudgeType }),
    })
    const json = await res.json().catch(() => null)
    const ok = res.ok && json && (json.recipientsSkipped ?? 0) === 0
    setNudgeStatus((m) => new Map(m).set(c.studentId, ok ? "sent" : "error"))
  } catch {
    setNudgeStatus((m) => new Map(m).set(c.studentId, "error"))
  }
}
```

Nota: `recipientsSkipped > 0` com array de 1 significa que o único aluno caiu fora do alcance do gestor no re-scope do servidor (tela mais antiga que o time real). Tratar como erro é o correto.

### 3. `apps/web/src/components/dashboard/manager-dashboard.tsx` (L152-154)

```tsx
<StudentInsightsTable
  students={studentDetails}
  showSubteam={showSubteam}
  expandable={false}
  variant="manager"   // S9
  canNudge={true}     // S10
/>
```

Nenhum outro call-site é tocado (`instructor/page.tsx` L314 fica como está: `canNudge` default `false`).

## Dados-RLS-Segurança

- Zero mudança de servidor. A segurança já existe e vale como contrato:
  1. Gate de papel: `hasRole({ roles }, "manager")` estrito em `route.ts` L49 (403 sem o chapéu manager na união).
  2. Re-scope server-side: `getManagedTeamStudentIds(includeSubtree: true)` em `route.ts` L108; id forjado ou fora do time NUNCA recebe nudge, vira `recipientsSkipped` (ou 403 se todos caírem). A UI é conveniência, a trava é o servidor.
  3. Defesa em profundidade no banco: `20260630000000_engagement_rls_group_scope.sql` (escritas de engajamento escopadas por grupo) e `20260703010000_auth_team_engagement_signals.sql` (RPC SECURITY DEFINER fail-closed).
  4. FinOps: `MAX_RECIPIENTS = 200` em `route.ts` L41; aqui é sempre array de 1.
- LGPD (D-C): a coluna Ação opera só sobre `triagem`, `totalSessions` e `full_name`, já visíveis na tabela; zero conteúdo escrito por aluno. O strip server-side (`recentSessions`/`recentReflections = []` em `manager-dashboard-page.tsx`) permanece intocado e `expandable={false}` continua no call-site do gestor.
- Anti-spam mínimo: estado local "Enviado" impede duplo disparo na sessão. Cooldown persistente é follow-up (Fora de escopo).

## Acceptance Criteria

- AC1: Na visão gestor (`variant="manager"` e `canNudge={true}`) a tabela exibe a coluna final "Ação"; na visão instrutor (sem as props) a coluna NÃO existe e o layout atual de colunas permanece intacto.
- AC2: `triagem === "no_ritmo"` mostra badge estática verde "No ritmo", sem elemento clicável na célula.
- AC3: `triagem === "atencao"` mostra botão âmbar "Lembrar" com `BellRing`; o disparo usa `nudgeType: "inactive"`.
- AC4: `triagem === "sem_acesso"` mostra botão vermelho "Acionar" com `Send`; `nudgeType` é `"never_accessed"` quando `totalSessions === 0` e `"inactive"` caso contrário (verificável no payload da request ou no teste unitário de `computeStudentAction`).
- AC5: Clique NÃO dispara direto: abre popover com o texto "Enviar lembrete para {nome}? O aluno recebe uma notificação no app e por email." e botões "Cancelar"/"Enviar". Cancelar, backdrop e `Escape` fecham sem request.
- AC6: Confirmar envia `POST /api/analytics/manager/nudge` com body exatamente `{ studentIds: ["<uuid>"], nudgeType: "<tipo>" }`; resposta ok com `recipientsSkipped === 0` vira "Enviado" com check, `disabled` pelo resto da sessão.
- AC7: Resposta não-ok (403, 500) OU `recipientsSkipped > 0` exibe "Não foi possível enviar" sob o botão, que volta ao estado clicável (retry permitido).
- AC8: O disparo aparece no histórico da Central de Engajamento (linha em `notifications` com origin `nudge`, channel `inapp`) e o aluno recebe o espelho por email: prova de que o endpoint RICO foi usado, não o legado.
- AC9: Botões têm `aria-label` "Enviar lembrete para {nome}"; popover tem `role="dialog"` com foco inicial em "Cancelar".
- AC10: Linha com `triagem === undefined` renderiza célula neutra sem crash (`computeStudentAction` retorna `null`, célula mostra placeholder).
- AC11: `pnpm --filter @eximia/web typecheck` e `pnpm --filter @eximia/web lint` passam; nenhum arquivo de servidor (`route.ts`, `engine.ts`, migrations) aparece no diff.
- AC12: `colSpan` (empty state e linha expandida) correto por variant: manager com `showSubteam` e `canNudge` = 8; manager sem `showSubteam` = 7; instructor inalterado (8 com `showSubteam`, 7 sem).

## Plano de testes

First-move rule: feature nova, então o primeiro movimento é confirmar a suíte existente VERDE antes de tocar na tabela (proteção do refactor implícito no `columnCount` e no JSX compartilhado com o instrutor): `pnpm --filter @eximia/web test` e `pnpm --filter @eximia/web typecheck`.

1. Teste unitário novo (escrever ANTES da célula, vermelho até o helper existir): `apps/web/src/lib/__tests__/student-triage.test.ts` (ou estender o de S7) cobrindo `computeStudentAction`:
   - `("no_ritmo", 5)` retorna `{ kind: "none" }`.
   - `("atencao", 3)` retorna `{ kind: "lembrar", nudgeType: "inactive" }`.
   - `("sem_acesso", 0)` retorna `{ kind: "acionar", nudgeType: "never_accessed" }`.
   - `("sem_acesso", 7)` retorna `{ kind: "acionar", nudgeType: "inactive" }`.
   - `(undefined, 0)` retorna `null`.
2. Verificações estáticas literais:
   - `grep -n "canNudge" apps/web/src/components/analytics/student-insights-table.tsx apps/web/src/components/dashboard/manager-dashboard.tsx` (prop declarada + passada só no call-site do gestor).
   - `grep -n "api/notifications/nudge" apps/web/src/components/analytics/student-insights-table.tsx` retorna VAZIO (legado proibido); `grep -n "api/analytics/manager/nudge"` no mesmo arquivo retorna 1 ocorrência.
   - `git diff --stat` não contém `route.ts`, `engine.ts` nem `supabase/migrations`.
3. Manual (dev server, gestor logado): fluxo feliz (Lembrar -> popover -> Enviar -> "Enviado", linha nova no histórico da Central e email no Resend sandbox); fluxo de erro (forçar 403 com chapéu sem manager, ver "Não foi possível enviar" + retry); instrutor em `/instructor` sem a coluna.
4. Suíte final verde: `pnpm --filter @eximia/web test && pnpm --filter @eximia/web typecheck && pnpm --filter @eximia/web lint`.

## Dependências

- S7 (taxonomia/triagem): fornece `student-triage.ts`, `StudentTriagem` e o campo `triagem?` enriquecido server-side nas rows. Sem S7 a coluna renderiza só placeholders.
- S9 (variant manager da tabela): fornece a prop `variant` e o call-site do gestor com `variant="manager"`. A coluna Ação só liga com `variant === "manager" && canNudge`.
- Ordem de landing: S10 é a ÚLTIMA das specs da tabela (S8 -> S9 -> S10), para o diff da coluna nascer sobre o layout final.

## Riscos

1. `recipientsSkipped > 0` com dado de tela desatualizado (aluno saiu do time entre o load e o clique): o gestor vê "Não foi possível enviar" sem o porquê. Aceito nesta story; refinamento de copy fica para o follow-up do cooldown.
2. Spam por sessão nova: o estado "Enviado" morre no reload, permitindo reenvio. Mitigação parcial: o engine registra tudo no histórico e no funil de eficácia (auditável); solução real é o cooldown do Fora de escopo.
3. Popover `position: fixed` vs scroll: mesmo trade-off já aceito pelo menu de filtro (L557-575). Fechar o popover em scroll da janela é hardening opcional.
4. Cores Tailwind v4/oklch: utilities de ring/text podem não resolver no tema; fallback definido (style inline com var), mesmo padrão do arquivo.
5. Merge: se S9 mudar a assinatura de `variant`, rebasear antes de implementar; contrato confirmado com S9: `variant?: "instructor" | "manager"`, default `"instructor"`.
