/**
 * Nome do cookie que implementa "um modal de cada vez" (story
 * `docs/stories/feat-onboarding-novidades-lancamento.md` §Fase 3).
 *
 * Mora num módulo NEUTRO (sem `"use client"`) de propósito: quem escreve é o
 * cliente (`lib/onboarding/client.ts`) e quem lê é o servidor
 * (`dashboard/_components/student-dashboard-page.tsx`). Se a constante
 * morasse no módulo cliente, o server component que a importasse arrastaria
 * uma fronteira de cliente junto só para ler uma string.
 */
export const MODAL_SESSION_COOKIE = "onboarding-modal-shown"

/**
 * Validade do cookie, em segundos.
 *
 * NASCEU sem `max-age` ("morre quando o navegador fecha, que é a definição de
 * sessão"). A definição estava certa e a consequência estava errada: com dois
 * anúncios na fila (N1 `priority` 10 e N2 `priority` 20, janelas sobrepostas
 * por 21 e 28 dias), `resolveOnboarding()` devolve UM por vez, e o segundo só
 * sai quando o cookie morre. Navegador que não fecha — Chrome com "continuar
 * de onde parou", Chrome no Android — não mata cookie de sessão por semanas.
 * Ou seja: "um por sessão" virava, na prática, "um por vida do navegador", e a
 * janela de 28 dias de N2 podia fechar inteira sem ele ter aparecido uma vez.
 * Como N2 é quem ARMA `jornada-builder-tour` (`announcement-host.tsx`), o tour
 * do construtor morria junto, sem sintoma nenhum.
 *
 * Uma hora é o meio-termo deliberado: continua impedindo o dano que a regra
 * existe para impedir (dois modais empilhados na mesma visita, que é o acúmulo
 * em miniatura), e garante que a fila ANDA — o próximo anúncio aparece na
 * próxima visita de verdade, não na próxima reinicialização do navegador.
 */
export const MODAL_SESSION_MAX_AGE_SECONDS = 60 * 60
