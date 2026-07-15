// Fatia 9a (Apple-style pass, princípio 1 "1 dono canônico" + princípio 3 "1
// cor de ação só, zero cor nova por conceito"). Antes desta extração, a MESMA
// paleta semântica de triagem (no_ritmo/sem_acesso/atencao) existia copiada
// byte-a-byte em 3 arquivos: dashboard/triage-cards.tsx, engagement-shell.tsx
// (buildSummaryCards) e campaigns-tab.tsx (SEGMENTS) — confirmado idêntica,
// não havia drift, mas 3 fontes editáveis independentemente para 1 conceito.
// Esta é a fonte única; os 3 consumidores foram refatorados pra importar
// daqui, sem nenhuma mudança de valor (extração pura, resultado visual
// pixel-idêntico).

import type { StudentTriagem } from "./student-triage"

export const TRIAGE_COLORS: Record<StudentTriagem, { color: string; bg: string }> = {
  no_ritmo: { color: "#059669", bg: "rgba(16,185,129,0.14)" },
  sem_acesso: { color: "#d97706", bg: "rgba(245,158,11,0.15)" },
  atencao: { color: "#dc2626", bg: "rgba(239,68,68,0.13)" },
}
