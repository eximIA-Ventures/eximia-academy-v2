import { buttonVariants } from "@eximia/ui"
import Link from "next/link"

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-bg-app overflow-hidden px-6 text-center">
      {/* Ambient accent blurs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cerrado-600/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-cerrado-600/5 blur-3xl" />
      </div>

      {/* Dot-grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10">
        {/* Logo — uses /brand/logo.png which varies per deploy */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo.png"
          alt="Academy"
          className="mx-auto h-10"
        />
        <p className="mt-2 text-lg font-bold text-cerrado-600" style={{ fontFamily: "var(--font-caveat), cursive" }}>Academy</p>

        <div className="mt-12">
          <p className="text-7xl font-extrabold text-text-primary">404</p>
          <h1 className="mt-4 text-xl font-semibold text-text-primary">
            Página não encontrada
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-text-secondary">
            O endereço que você acessou não existe ou foi movido.
            Verifique a URL ou volte para o início.
          </p>
        </div>

        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/dashboard" className={buttonVariants({ variant: "default" })}>
            Ir para o Dashboard
          </Link>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Página Inicial
          </Link>
        </div>
      </div>
    </div>
  )
}
