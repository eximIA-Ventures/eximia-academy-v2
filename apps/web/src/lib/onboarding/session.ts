/**
 * Nome do cookie de SESSÃO que implementa "um modal por sessão" (story
 * `docs/stories/feat-onboarding-novidades-lancamento.md` §Fase 3).
 *
 * Mora num módulo NEUTRO (sem `"use client"`) de propósito: quem escreve é o
 * cliente (`lib/onboarding/client.ts`) e quem lê é o servidor
 * (`dashboard/_components/student-dashboard-page.tsx`). Se a constante
 * morasse no módulo cliente, o server component que a importasse arrastaria
 * uma fronteira de cliente junto só para ler uma string.
 *
 * Sem `max-age`: o cookie morre quando o navegador fecha, que é exatamente a
 * definição de "sessão" que a regra usa.
 */
export const MODAL_SESSION_COOKIE = "onboarding-modal-shown"
