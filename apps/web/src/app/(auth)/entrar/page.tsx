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
    // Sem grid/painel próprios: esta página renderiza como `children` dentro do
    // slot de `(auth)/layout.tsx` (que já provê o painel decorativo esquerdo
    // "Aprenda com inteligência" e contém o conteúdo a `max-w-[380px]`). Um
    // wrapper de grid `min-h-dvh` aqui duplicava esse shell e vazava — ver
    // relatório de causa raiz. Este arquivo segue o mesmo padrão de
    // `(auth)/login/page.tsx`, que já se encaixa sem conflito.
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
            eximIA{" "}
            <span
              style={{ fontFamily: "var(--font-caveat), cursive" }}
              className="text-cerrado-600"
            >
              Academy
            </span>
          </span>
        </div>

        <h1 className="font-display text-2xl font-semibold text-foreground leading-tight">
          Bem-vindo de volta
        </h1>
        <p className="text-sm text-muted-foreground">Acesse sua conta para continuar aprendendo.</p>
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

      <p className="pt-4 text-xs text-muted-foreground text-center">
        © {new Date().getFullYear()} eximIA Ventures. Todos os direitos reservados.
      </p>
    </div>
  )
}
