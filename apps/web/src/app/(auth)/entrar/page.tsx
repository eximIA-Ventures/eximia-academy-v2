import type { Metadata } from "next"
import { LoginForm } from "./_components/login-form"

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse sua conta eximIA Academy",
}

interface PageProps {
  searchParams: Promise<{ redirect?: string }>
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { redirect } = await searchParams

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.15fr]">
      {/* ── Painel esquerdo: formulário ─────────────────────────────── */}
      <div className="flex flex-col items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo */}
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5 text-primary-foreground"
                  aria-hidden="true"
                >
                  <path
                    d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="font-display font-bold text-xl text-foreground tracking-tight">
                eximIA <span style={{ fontFamily: "var(--font-caveat), cursive" }} className="text-cerrado-600">Academy</span>
              </span>
            </div>

            <h1 className="font-display text-2xl font-semibold text-foreground leading-tight">
              Bem-vindo de volta
            </h1>
            <p className="text-sm text-muted-foreground">
              Acesse sua conta para continuar aprendendo.
            </p>
          </div>

          {/* Form */}
          <LoginForm redirectTo={redirect} />

          {/* Footer */}
          <p className="text-xs text-muted-foreground text-center">
            Ao entrar, você concorda com nossos{" "}
            <a
              href="/termos"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Termos de Uso
            </a>{" "}
            e{" "}
            <a
              href="/privacidade"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Política de Privacidade
            </a>
            .
          </p>
        </div>

        <p className="mt-auto pt-8 text-xs text-muted-foreground">
          © {new Date().getFullYear()} eximIA Ventures. Todos os direitos
          reservados.
        </p>
      </div>

      {/* ── Painel direito: visual ──────────────────────────────────── */}
      <div className="hidden lg:flex relative flex-col items-center justify-center overflow-hidden bg-gradient-cerrado p-12">
        {/* Anéis decorativos */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <div className="h-[700px] w-[700px] rounded-full border border-white/[0.07]" />
          <div className="absolute h-[500px] w-[500px] rounded-full border border-white/[0.09]" />
          <div className="absolute h-[300px] w-[300px] rounded-full border border-white/[0.12]" />
          <div className="absolute h-[140px] w-[140px] rounded-full bg-white/[0.04]" />
        </div>

        {/* Conteúdo */}
        <div className="relative z-10 text-center space-y-7 max-w-md">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-white/70 animate-pulse" />
            <span className="text-sm text-white/80 font-medium">
              IA Socrática ativa
            </span>
          </div>

          {/* Headline */}
          <h2 className="font-display text-[2.75rem] font-bold text-white leading-[1.1] tracking-tight">
            Conhecimento
            <br />
            que transforma.
          </h2>

          <p className="text-white/70 text-lg leading-relaxed">
            A primeira plataforma que debate com você, desafia seu raciocínio
            e acelera sua evolução com IA socrática.
          </p>

          {/* Divisor */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/20" />
            <span className="text-white/40 text-xs uppercase tracking-widest">
              resultados reais
            </span>
            <div className="h-px flex-1 bg-white/20" />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6">
            {[
              { value: "200+", label: "Cursos" },
              { value: "10K+", label: "Alunos ativos" },
              { value: "98%", label: "Satisfação" },
            ].map(({ value, label }) => (
              <div key={label} className="text-center space-y-1">
                <p className="font-display text-2xl font-bold text-white">
                  {value}
                </p>
                <p className="text-white/55 text-sm">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Glare sutil no canto superior */}
        <div
          className="pointer-events-none absolute -top-32 -right-32 h-72 w-72 rounded-full bg-white/[0.04] blur-3xl"
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
