"use client"

import { switchWorkspace } from "@/app/(platform)/workspace/actions"
import { signOut } from "@/lib/actions/auth"
import { buttonVariants, cn } from "@eximia/ui"
import {
  ArrowRight,
  Building2,
  GraduationCap,
  Loader2,
  LogOut,
  PencilRuler,
  ShieldCheck,
} from "lucide-react"
import { useState, useTransition } from "react"

interface Props {
  firstName: string
  canStudio: boolean
  canStandard: boolean
  /** Mundo do admin (W1). Concedido pelos chapéus `admin`/`super_admin`. */
  canAdmin?: boolean
  /** 4º mundo (rodada 9). Concedido SÓ pelo chapéu `super_admin`. */
  canSuper?: boolean
}

type WorkspaceTarget = "studio" | "standard" | "admin" | "super"

export function WorkspacePicker({
  firstName,
  canStudio,
  canStandard,
  canAdmin = false,
  canSuper = false,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [target, setTarget] = useState<WorkspaceTarget | null>(null)

  // ─────────────────────────────────────────────────────────────────────────
  // A GRADE É DERIVADA DO NÚMERO REAL DE CARTÕES.
  //
  // A regra é uma só, e vale para 2, 3 e 4 portas (acesso único não chega aqui —
  // `app/workspace/page.tsx` redireciona antes): **nunca existe fileira
  // parcial**. Ou seja, o número de colunas tem de DIVIDIR o número de cartões.
  //   • 2 cartões -> 2 colunas (1 fileira cheia)
  //   • 3 cartões -> 3 colunas (1 fileira cheia)
  //   • 4 cartões -> 2 colunas (2 fileiras cheias, 2+2)
  // Quatro colunas não entram na conta: em 1152px cada cartão cairia para
  // ~273px e o título "Plataforma de Aprendizagem" passaria de 2 linhas,
  // quebrando o alinhamento entre irmãos. 2+2 mantém o cartão na MESMA largura
  // do par já validado (~374px).
  //
  // O breakpoint em que a fileira começa acompanha a largura por cartão: 2
  // colunas cabem a partir de `sm` (640px); 3 colunas só a partir de `lg`
  // (1024px) — foi a correção da rodada 8, que matou o 2+1 órfão entre 640 e
  // 1023. Abaixo do breakpoint, coluna única: cartões idênticos, largura cheia,
  // zero vazio assimétrico.
  const cardCount = [canStandard, canStudio, canAdmin, canSuper].filter(Boolean).length
  const isTrio = cardCount === 3
  const gridCols = isTrio ? "lg:grid-cols-3" : "sm:grid-cols-2"
  // Abaixo de `lg` o trio empilha, então herda a MESMA caixa do par
  // (`max-w-3xl`); em `lg+` abre para 1152px, largura em que o cartão do trio
  // (~371px) empata com o do par (~374px) sem espremer nem quebrar título. O
  // quarteto usa a caixa do par nas duas fileiras, pela mesma razão.
  const shellWidth = isTrio ? "max-w-3xl lg:max-w-6xl" : "max-w-3xl"
  // Reserva de altura do título — ver comentário em `WorkspaceCard`. Ela só faz
  // sentido a partir do breakpoint em que os cartões dividem uma FILEIRA (é
  // exatamente ali que um título de 2 linhas desalinha o vizinho de 1 linha):
  // `sm` para o par e para o quarteto, `lg` para o trio. Empilhado, reserva
  // alguma seria vazio morto — foi o que criou o buraco de ~23px medido entre
  // 640 e 1023.
  const titleReserve = isTrio ? "lg:min-h-[2lh]" : "sm:min-h-[2lh]"

  function enter(ws: WorkspaceTarget) {
    setTarget(ws)
    startTransition(async () => {
      // Server action redirects on success; the transition keeps the clicked
      // card in loading state until the navigation replaces the tree.
      await switchWorkspace(ws)
    })
  }

  return (
    <main className="relative flex min-h-screen flex-col bg-bg-app">
      {/* Wash de marca no topo — pincelada creme->transparente que dá profundidade
          à página sem competir com os cartões. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-cerrado-500/[0.06] via-studio-600/[0.03] to-transparent"
      />

      {/* ── Barra superior: lockup ARGOS Academy à esquerda, Sair à direita ── */}
      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8 sm:py-6">
        {/* Lockup idêntico ao do produto (sidebar `BrandLogo`): asset colorido
            de marca + swap light/dark correto + script "Academy" laranja. Aqui os
            paths são fixos (o picker roda antes do BrandProvider, sem `useBrand`),
            resolvendo exatamente para o que o header renderiza neste tenant. */}
        <div className="flex items-end gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-color.png"
            alt="ARGOS Academy"
            className="block h-7 w-auto shrink-0 select-none dark:hidden"
            draggable={false}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo.png"
            alt="ARGOS Academy"
            className="hidden h-7 w-auto shrink-0 select-none dark:block"
            draggable={false}
          />
          <span
            className="mb-[1px] text-[20px] font-bold leading-none text-cerrado-600 dark:text-cerrado-400"
            style={{ fontFamily: "var(--font-caveat), cursive" }}
          >
            Academy
          </span>
        </div>

        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cerrado-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app"
          >
            <LogOut size={16} />
            Sair
          </button>
        </form>
      </header>

      {/* ── Corpo centralizado ── */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-20">
        <div className={cn("w-full", shellWidth)}>
          <header className="mb-12 text-center sm:mb-14">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-text-muted">
              {firstName ? `Olá, ${firstName}` : "Bem-vindo"}
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight text-text-primary sm:text-4xl">
              Onde você quer trabalhar hoje?
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-pretty text-sm leading-relaxed text-text-secondary sm:text-base">
              Escolha o espaço para esta sessão. Você troca de workspace a qualquer momento.
            </p>
          </header>

          <div className={cn("grid gap-5", gridCols)}>
            {canStandard && (
              <WorkspaceCard
                icon={<GraduationCap size={26} strokeWidth={2} />}
                accent="cerrado"
                eyebrow="Aprender"
                title="Plataforma de Aprendizagem"
                subtitle="Sua trilha de aprendizagem e a gestão do seu time."
                tags={["Aluno", "Gestor"]}
                titleReserve={titleReserve}
                loading={isPending && target === "standard"}
                disabled={isPending && target !== "standard"}
                onEnter={() => enter("standard")}
              />
            )}
            {canStudio && (
              <WorkspaceCard
                icon={<PencilRuler size={26} strokeWidth={2} />}
                accent="studio"
                eyebrow="Criar"
                title="Estúdio do Instrutor"
                subtitle="Crie cursos e acompanhe a aprendizagem dos seus alunos."
                tags={["Instrutor"]}
                titleReserve={titleReserve}
                loading={isPending && target === "studio"}
                disabled={isPending && target !== "studio"}
                onEnter={() => enter("studio")}
              />
            )}
            {canAdmin && (
              <WorkspaceCard
                icon={<ShieldCheck size={26} strokeWidth={2} />}
                accent="admin"
                eyebrow="Administrar"
                title="Administração"
                subtitle="Configure a plataforma, as pessoas e as unidades da sua empresa."
                tags={["Admin"]}
                titleReserve={titleReserve}
                loading={isPending && target === "admin"}
                disabled={isPending && target !== "admin"}
                onEnter={() => enter("admin")}
              />
            )}
            {/* 4º mundo (rodada 9). O chip "Super Admin" saiu do cartão de
                Administração e virou o cartão INTEIRO: administrar a própria
                empresa e administrar TODAS as empresas são trabalhos
                diferentes, e o desenho de mundos diz que cada trabalho tem a
                sua porta. */}
            {canSuper && (
              <WorkspaceCard
                icon={<Building2 size={26} strokeWidth={2} />}
                accent="super"
                eyebrow="Operar"
                title="Super Admin"
                subtitle="Painel global e a gestão de todas as empresas da plataforma."
                tags={["Super Admin"]}
                titleReserve={titleReserve}
                loading={isPending && target === "super"}
                disabled={isPending && target !== "super"}
                onEnter={() => enter("super")}
              />
            )}
          </div>

          <p className="mt-12 text-center text-xs text-text-muted sm:mt-14">
            Você pode trocar de workspace a qualquer momento pelo botão ao lado da logo.
          </p>
        </div>
      </div>
    </main>
  )
}

interface CardProps {
  icon: React.ReactNode
  accent: "cerrado" | "studio" | "admin" | "super"
  eyebrow: string
  title: string
  subtitle: string
  tags: string[]
  /** Classe de reserva de altura do título, resolvida pelo picker a partir do
   *  breakpoint em que os cartões dividem fileira (`sm` no par, `lg` no trio). */
  titleReserve: string
  loading: boolean
  disabled: boolean
  onEnter: () => void
}

/** Per-world token set. Each world owns its identity (accent wash on top, icon
 *  container, chips, CTA surface) while sharing one card skeleton so the two
 *  read as a pair. Cerrado = laranja do produto; Studio = azul-marinho ARGOS. */
const WORLDS = {
  cerrado: {
    topWash: "from-cerrado-500/[0.14] to-cerrado-500/0",
    hairline: "bg-cerrado-500/40",
    hoverRing: "group-hover:ring-cerrado-500/40",
    iconContainer: "bg-cerrado-600/12 text-cerrado-600 dark:text-cerrado-400",
    eyebrow: "text-cerrado-700 dark:text-cerrado-400",
    chip: "text-cerrado-700 ring-cerrado-600/20 dark:text-cerrado-300 dark:ring-cerrado-400/20",
    button: "", // canonical default variant already renders the cerrado world
  },
  studio: {
    topWash: "from-studio-600/[0.16] to-studio-600/0",
    hairline: "bg-studio-600/45",
    hoverRing: "group-hover:ring-studio-600/40",
    iconContainer: "bg-studio-600/12 text-studio-600 dark:text-studio-400",
    eyebrow: "text-studio-700 dark:text-studio-400",
    chip: "text-studio-700 ring-studio-600/20 dark:text-studio-300 dark:ring-studio-400/25",
    // Studio's only liberty over the canonical CTA: swap the cerrado surface for
    // navy. The default variant already carries shadow + hover:scale-[1.02] +
    // active:scale-[0.97]; we override just the surface, hover-surface and focus
    // ring so the button keeps identical anatomy to the product's primary CTA.
    button: "bg-studio-600 hover:bg-studio-700 focus-visible:ring-studio-500/50",
  },
  // Administração (3º mundo). RODADA 9 — o `accent-gold` emprestado SAIU.
  // Diagnóstico do dono, confirmado por medição: ouro (#8a6a20, hue ~90) é
  // VIZINHO do cerrado (hue 45), 45° de distância, e por isso o cartão lia como
  // primo do cartão da Plataforma; e o botão dourado, ao lado do laranja e do
  // azul vivos, parecia oliva apagado. A escala `--color-admin-*` (teal, hue
  // 195) é dedicada, fica a 150° do cerrado e 69° do studio, e cada parada está
  // DENTRO do gamut sRGB — é isso que tira o "apagado". Contraste medido parada
  // a parada em `styles/theme.css`; nenhum par de uso abaixo de 5.19:1.
  admin: {
    topWash: "from-admin-600/[0.16] to-admin-600/0",
    hairline: "bg-admin-600/45",
    hoverRing: "group-hover:ring-admin-600/40",
    iconContainer: "bg-admin-600/12 text-admin-600 dark:text-admin-300",
    eyebrow: "text-admin-700 dark:text-admin-300",
    // O chip é texto de 11px semibold sobre `bg-bg-elevated`, o par mais
    // apertado do cartão: 700 sobre o elevado claro mede 7.27:1 e 300 sobre o
    // elevado escuro mede 8.40:1 — o token de exceção que o ouro exigia
    // (`accent-gold-deep`, criado para vencer AA por 0.02) deixou de ser
    // necessário, a própria escala já passa com folga.
    chip: "text-admin-700 ring-admin-600/25 dark:text-admin-300 dark:ring-admin-400/25",
    button: "bg-admin-600 hover:bg-admin-700 focus-visible:ring-admin-500/50",
  },
  // Super Admin (4º mundo, rodada 9). Escala própria pelo MESMO motivo do teal:
  // dois cartões administrativos com o mesmo acento voltariam a ler como
  // duplicata. Violeta (hue 320) fica a 85° do cerrado, 56° do studio e 125° do
  // admin — o melhor espalhamento possível com dois matizes já ocupados.
  super: {
    topWash: "from-super-600/[0.16] to-super-600/0",
    hairline: "bg-super-600/45",
    hoverRing: "group-hover:ring-super-600/40",
    iconContainer: "bg-super-600/12 text-super-600 dark:text-super-300",
    eyebrow: "text-super-700 dark:text-super-300",
    chip: "text-super-700 ring-super-600/25 dark:text-super-300 dark:ring-super-400/25",
    button: "bg-super-600 hover:bg-super-700 focus-visible:ring-super-500/50",
  },
} as const

/** Anel de foco do CARTÃO por mundo (o cartão inteiro é o botão). */
const CARD_FOCUS_RING: Record<CardProps["accent"], string> = {
  cerrado: "focus-visible:ring-cerrado-500/60",
  studio: "focus-visible:ring-studio-500/60",
  admin: "focus-visible:ring-admin-500/60",
  super: "focus-visible:ring-super-500/60",
}

function WorkspaceCard({
  icon,
  accent,
  eyebrow,
  title,
  subtitle,
  tags,
  titleReserve,
  loading,
  disabled,
  onEnter,
}: CardProps) {
  const w = WORLDS[accent]

  return (
    <button
      type="button"
      onClick={onEnter}
      disabled={loading || disabled}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl bg-bg-card text-left shadow-card ring-1 ring-border-subtle transition-all duration-200",
        "hover:-translate-y-1 hover:shadow-elevated",
        w.hoverRing,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app",
        CARD_FOCUS_RING[accent],
        "disabled:pointer-events-none disabled:opacity-60",
      )}
    >
      {/* Wash da cor do mundo no topo + fio de cor na borda superior */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b",
          w.topWash,
        )}
      />
      <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-[3px]", w.hairline)} />

      <div className="relative flex flex-1 flex-col gap-5 p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105",
              w.iconContainer,
            )}
          >
            {icon}
          </div>
          <span className={cn("text-[11px] font-bold uppercase tracking-[0.16em]", w.eyebrow)}>
            {eyebrow}
          </span>
        </div>

        <div className="space-y-2">
          {/* Reserva de DUAS LINHAS REAIS do título, para subtítulo, chips e CTA
              ficarem alinhados quando um cartão da fileira quebra em 2 linhas e
              o outro fica em 1.

              CORREÇÃO DE AUDITORIA (rodada 8) — A RESERVA MENTIA. Era
              `sm:min-h-[3.5rem]` = 56px, enquanto duas linhas reais medem 66px
              (`text-xl` 24px x `leading-snug` 1.375 = 33px de line-height, x2).
              Resultado medido: o cartão de título longo empurrava subtítulo e
              chips 10px abaixo dos vizinhos. A reserva agora é `2lh` — duas
              vezes a line-height COMPUTADA do próprio elemento, então ela não
              pode divergir do que a fonte realmente ocupa nem se alguém mudar
              `text-xl`/`leading-snug` depois.

              E ela vale só a partir do breakpoint em que há fileira de fato
              (`titleReserve`): empilhado, todos os títulos são de 1 linha e a
              reserva viraria os ~23px de vazio morto que a auditoria mediu. */}
          <h2
            className={cn(
              "text-balance font-display text-xl font-bold leading-snug text-text-primary",
              titleReserve,
            )}
          >
            {title}
          </h2>
          <p className="text-sm leading-relaxed text-text-secondary">{subtitle}</p>
        </div>

        {/* BLOCO DE BASE — chips + CTA ancorados JUNTOS no pé do cartão.
            CORREÇÃO DE MEDIÇÃO (rodada 9). Só o CTA era ancorado (`mt-auto`), e
            os chips flutuavam logo abaixo do subtítulo. Enquanto todos os
            subtítulos ocupavam o mesmo nº de linhas isso não aparecia; com 4
            cartões em 640px a segunda fileira mediu 21px de desalinhamento entre
            os chips de "Administração" e os de "Super Admin", porque um
            subtítulo quebra numa linha a mais que o outro nessa largura.
            Encurtar a copy até casar seria conserto que a próxima edição de
            texto desfaz em silêncio. Ancorar os DOIS no pé torna o alinhamento
            independente do comprimento do texto: o topo do subtítulo já é
            garantido pela reserva do título, e a folga variável passa a ficar
            ENTRE subtítulo e chips, onde ela é espaço vazio e não desalinha
            nada. As distâncias internas são as mesmas de antes (o `gap-5` do
            cartão separava subtítulo/chips e chips/CTA; aqui o mesmo `gap-5`
            separa os dois filhos do bloco, e o `pt-2` do CTA continua). */}
        <div className="mt-auto flex flex-col gap-5">
          {/* Role chips = the canonical Badge anatomy (badgeVariants, badgeSize="sm"):
              `inline-flex items-center gap-1 rounded-lg font-semibold ring-1` +
              `text-2xs px-2 py-0.5`. The default Badge is neutral
              (bg-bg-elevated text-text-secondary ring-border-subtle); the only
              liberty here is the per-world tint applied over that same shape, the
              way Badge already accepts a className override in the product. */}
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg bg-bg-elevated px-2 py-0.5 text-2xs font-semibold ring-1",
                  w.chip,
                )}
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="pt-2">
            {/* The whole card is the <button>; the "Entrar" affordance is a <span>
              styled with the EXACT recipe the product uses for a primary CTA in
              a form/card: the canonical `buttonVariants()` (default variant, size
              default → rounded-xl 24px, font-semibold) plus the same
              `w-full h-11 text-sm font-semibold` overrides the login "Entrar"
              button carries (login-form.tsx:79). No pill, no oversized height —
              same anatomy as the rest of the app. The ONLY per-world liberty is
              the navy surface/hover/ring for studio; cerrado is the untouched
              default. Kept as a <span> to avoid a nested <button>. */}
            <span className={cn(buttonVariants(), "h-11 w-full text-sm font-semibold", w.button)}>
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight
                    size={16}
                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}
