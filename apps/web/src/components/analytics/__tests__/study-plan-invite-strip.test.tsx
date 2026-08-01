import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StudyPlanInviteStrip } from "../study-plan-invite-strip"

// ---------------------------------------------------------------------------
// SH-3.3 R5 (2026-07-21) — reconstrução defensiva da direção "Claro com
// tingimento de bioma" (aprovada por Hugo no mockup de 5 direções, acento
// pantanal→cerrado). O ícone chegou a renderizar como "listras" (SVG
// estourando o quadrado); a reconstrução trava o tamanho do ícone em
// múltiplas camadas (atributos + classes + style inline + [&_svg] no
// wrapper). Ver study-plan-invite-strip.tsx para o histórico completo.
// ---------------------------------------------------------------------------

describe("StudyPlanInviteStrip — Claro com tingimento de bioma (R5 blindado)", () => {
  // EPIC-JORNADA (JRN-C.1, Decisão 3): entrypoint da home passou a apontar para
  // /jornada e a copy adotou o termo canônico "jornada" (rename round 16).
  it("é um link inteiro (não só um ícone) apontando para /jornada", () => {
    render(<StudyPlanInviteStrip />)
    const link = screen.getByRole("link", { name: /Monte ou revise sua jornada/ })
    expect(link).toBeInTheDocument()
    expect(link.getAttribute("href")).toBe("/jornada")
  })

  it("mostra a copy do termo canônico jornada (título + subtítulo)", () => {
    render(<StudyPlanInviteStrip />)
    expect(screen.getByText("Monte ou revise sua jornada")).toBeInTheDocument()
    expect(screen.getByText("Veja seu ritmo e ajuste quando quiser")).toBeInTheDocument()
  })

  it("usa a cor de acento da marca (cerrado-600), não o pantanal do mockup de descoberta", () => {
    render(<StudyPlanInviteStrip />)
    const link = screen.getByRole("link", { name: /Monte ou revise sua jornada/ })
    expect(link.innerHTML).toContain("cerrado-600")
    expect(link.innerHTML).not.toContain("pantanal")
  })

  it("ícone de calendário está num quadrado arredondado sólido cerrado-600 com ícone branco", () => {
    render(<StudyPlanInviteStrip />)
    const link = screen.getByRole("link", { name: /Monte ou revise sua jornada/ })
    const iconSquare = link.querySelector("span.bg-cerrado-600")
    expect(iconSquare).not.toBeNull()
    expect(iconSquare?.className).toContain("rounded-md")
    const icon = iconSquare?.querySelector("svg")
    expect(icon?.getAttribute("class")).toContain("text-white")
  })

  it("REGRESSÃO (R5): SVG do calendário tem tamanho travado em múltiplas camadas", () => {
    render(<StudyPlanInviteStrip />)
    const link = screen.getByRole("link", { name: /Monte ou revise sua jornada/ })
    const iconSquare = link.querySelector("span.bg-cerrado-600")
    const icon = iconSquare?.querySelector("svg") as SVGSVGElement | null
    expect(icon).not.toBeNull()
    // Camada 1: atributos width/height do próprio SVG (prop `size` do lucide)
    expect(icon?.getAttribute("width")).toBe("24")
    expect(icon?.getAttribute("height")).toBe("24")
    // Camada 2: classes Tailwind explícitas no SVG
    expect(icon?.getAttribute("class")).toContain("h-6")
    expect(icon?.getAttribute("class")).toContain("w-6")
    // Camada 3: style inline — vence qualquer regra CSS global sem !important
    expect(icon?.style.width).toBe("24px")
    expect(icon?.style.height).toBe("24px")
    // Camada 4: cinto de segurança [&_svg] no wrapper
    expect(iconSquare?.className).toContain("[&_svg]:h-6")
    expect(iconSquare?.className).toContain("[&_svg]:w-6")
  })

  it("R5: sem classes de valor arbitrário (size-[46px]/gap-[18px]) — só escala padrão", () => {
    render(<StudyPlanInviteStrip />)
    const link = screen.getByRole("link", { name: /Monte ou revise sua jornada/ })
    expect(link.className).toContain("gap-4")
    expect(link.innerHTML).not.toContain("size-[46px]")
    expect(link.innerHTML).not.toContain("gap-[18px]")
    // O quadrado não clipa o ícone: overflow-hidden esconderia o bug, não o corrige.
    const iconSquare = link.querySelector("span.bg-cerrado-600")
    expect(iconSquare?.className).toContain("h-11")
    expect(iconSquare?.className).toContain("w-11")
    expect(iconSquare?.className).not.toContain("overflow-hidden")
  })

  it("seta está dentro de um círculo com fundo tingido de cerrado, ícone cerrado e tamanho travado", () => {
    render(<StudyPlanInviteStrip />)
    const link = screen.getByRole("link", { name: /Monte ou revise sua jornada/ })
    const spans = link.querySelectorAll("span")
    const arrowCircle = spans[spans.length - 1]
    expect(arrowCircle.className).toContain("rounded-full")
    const arrowIcon = arrowCircle.querySelector("svg") as SVGSVGElement | null
    expect(arrowIcon?.getAttribute("class")).toContain("text-cerrado-600")
    expect(arrowIcon?.getAttribute("width")).toBe("16")
    expect(arrowIcon?.style.width).toBe("16px")
  })

  it("card é claro (bg-card do design system), não mais o fundo escuro neutral-900", () => {
    render(<StudyPlanInviteStrip />)
    const link = screen.getByRole("link", { name: /Monte ou revise sua jornada/ })
    expect(link.className).not.toContain("bg-neutral-900")
    expect(link.className).toContain("shadow-card")
    // O gradiente/borda tingidos usam color-mix via style inline (sem
    // utility Tailwind direta para gradiente tingido), preservado 1:1 do
    // mockup aprovado por Hugo.
    expect(link.style.background).toContain("color-mix")
    expect(link.style.borderColor).toContain("color-mix")
  })

  it("título e subtítulo usam as cores de texto do design system (não mais branco fixo)", () => {
    render(<StudyPlanInviteStrip />)
    const title = screen.getByText("Monte ou revise sua jornada")
    const sub = screen.getByText("Veja seu ritmo e ajuste quando quiser")
    expect(title.className).toContain("text-text-primary")
    expect(sub.className).toContain("text-text-secondary")
  })
})

// ---------------------------------------------------------------------------
// 2026-08-01 — A FAIXA E INCONDICIONAL, e isto e um teste de REGRESSAO com
// numero medido por tras.
//
// Ate esta data a faixa vivia DENTRO de `StudentComparison`, depois de tres
// early returns (NoScopeInvite / ErrorState / Skeleton). Como Skeleton e o
// primeiro paint de toda carga, o UNICO link para /jornada do repositorio
// inteiro sumia em 4 dos 5 estados de render, inclusive em qualquer falha da
// API de analytics. Adocao medida em producao naquele momento: 3 jornadas em
// 302 matriculas, 1%.
//
// Ela foi promovida para `student-dashboard.tsx`, fora do fetch. Estes testes
// guardam as duas propriedades que tornam isso verdade: o componente nao
// depende de dado nenhum, e nao aceita props que pudessem reintroduzir essa
// dependencia por engano.
// ---------------------------------------------------------------------------

describe("a faixa nao depende de dado, e por isso pode ser incondicional", () => {
  it("renderiza sem receber prop alguma", () => {
    render(<StudyPlanInviteStrip />)
    expect(screen.getByRole("link", { name: /Monte ou revise sua jornada/ })).toBeInTheDocument()
  })

  it("renderiza identica em duas montagens independentes, sem estado nem fetch", () => {
    const { unmount } = render(<StudyPlanInviteStrip />)
    const primeiro = screen.getByRole("link").getAttribute("href")
    unmount()

    render(<StudyPlanInviteStrip />)
    expect(screen.getByRole("link").getAttribute("href")).toBe(primeiro)
    expect(primeiro).toBe("/jornada")
  })

  it("NAO aceita props: a assinatura sem parametros e o que garante o item acima", () => {
    // Se alguem adicionar uma prop obrigatoria de dado, este teste continua
    // passando, mas a assinatura muda e o typecheck do dashboard quebra, que e
    // onde a faixa e montada sem argumento nenhum. O comentario existe para
    // quem for mexer entender que a ausencia de props e a feature, nao um
    // detalhe pendente.
    expect(StudyPlanInviteStrip.length).toBe(0)
  })
})
