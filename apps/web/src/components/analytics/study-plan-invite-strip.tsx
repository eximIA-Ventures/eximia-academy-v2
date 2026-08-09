// ---------------------------------------------------------------------------
// StudyPlanInviteStrip — "Claro com tingimento de bioma" (SH-3.3 R5, 2026-07-21)
// ---------------------------------------------------------------------------
// 5ª iteração do CTA "Meu plano" na home do aluno. Direção visual aprovada
// por Hugo no mockup de 5 direções (apps/hub-discovery/meu-ritmo-cta-redesign
// .html, bloco `.v5`) com acento trocado de pantanal→cerrado-600 (laranja da
// marca): card claro com gradiente sutil tingido, quadrado sólido cerrado com
// calendário branco, título + subtítulo, seta à direita em círculo tingido,
// card inteiro clicável para /meu-plano.
//
// R5 = reconstrução DEFENSIVA após o ícone renderizar como "listras" (SVG
// estourando o quadrado e sendo cortado). A varredura de causa raiz não
// encontrou nenhuma regra CSS do app que dimensione svg (única regra global é
// o preflight do Tailwind, `svg { display: block }`, que não dimensiona;
// customCSS de tenant vazio nos 3 tenants), então o estouro só pode vir de
// CSS fora do build (extensão de browser / user stylesheet / estado HMR
// corrompido). A blindagem abaixo torna o componente imune a qualquer origem:
//
// 1. Tamanho do ícone travado em 4 camadas: prop `size` do lucide (atributos
//    width/height do SVG) + classes `h-6 w-6` + style inline width/height
//    (vence QUALQUER regra CSS sem !important, inclusive externa ao app) +
//    `[&_svg]:h-6 [&_svg]:w-6` no wrapper como cinto de segurança.
// 2. Sem classes de valor arbitrário (`size-[46px]`, `gap-[18px]`): só escala
//    padrão do Tailwind (h-11 w-11, gap-4), zero risco de purge.
// 3. Sem overflow-hidden no quadrado: clipar um SVG estourado esconderia o
//    bug em vez de corrigi-lo; se o ícone estourar, tem que ficar visível.
// ---------------------------------------------------------------------------

import { ArrowRight, Calendar } from "lucide-react"
import Link from "next/link"

import { ANCHORS, anchor } from "@/lib/onboarding/types"

export function StudyPlanInviteStrip() {
  return (
    <Link
      // EPIC-JORNADA (JRN-C.1, Decisão 3): o entrypoint da home aponta para a
      // rota nova /jornada (termo canônico da UI). A blindagem R5 do ícone e a
      // direção visual "Claro com tingimento de bioma" seguem intactas.
      href="/jornada"
      // Onboarding N2 — âncora do modal "Novidade: Jornada" (lib/onboarding/types.ts).
      {...anchor(ANCHORS.faixaJornada)}
      // SH-3.4 (responsividade) — SÓ abaixo de sm: padding/gap compactam
      // (max-sm:*) para o título/subtítulo quebrarem com graça sem estourar;
      // o quadrado do ícone (h-11 w-11, shrink-0, blindagem R5 em 4 camadas) e
      // a seta (h-8 w-8, shrink-0) NÃO mudam de tamanho em nenhum breakpoint.
      // Gradiente/cores/estrutura intocados; sm+ segue o aprovado (gap-4/px-6/py-5).
      className="group flex items-center gap-4 rounded-2xl border px-6 py-5 shadow-card transition-transform hover:-translate-y-0.5 max-sm:gap-3 max-sm:px-4 max-sm:py-4"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in oklch, var(--color-cerrado-600) 10%, white), var(--color-bg-card))",
        borderColor:
          "color-mix(in oklch, var(--color-cerrado-600) 22%, var(--color-border-subtle))",
      }}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-cerrado-600 [&_svg]:h-6 [&_svg]:w-6">
        <Calendar
          size={24}
          className="h-6 w-6 text-white"
          style={{ width: 24, height: 24 }}
          aria-hidden="true"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold tracking-tight text-text-primary">
          Monte ou revise sua jornada
        </span>
        <span className="mt-0.5 block text-sm font-medium text-text-secondary">
          Veja seu ritmo e ajuste quando quiser
        </span>
      </span>
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5 [&_svg]:h-4 [&_svg]:w-4"
        style={{ background: "color-mix(in oklch, var(--color-cerrado-600) 14%, white)" }}
      >
        <ArrowRight
          size={16}
          className="h-4 w-4 text-cerrado-600"
          style={{ width: 16, height: 16 }}
          aria-hidden="true"
        />
      </span>
    </Link>
  )
}
