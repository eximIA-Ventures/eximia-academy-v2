import { AuthHashRedirect } from "@/components/auth/auth-hash-redirect"
import { buttonVariants, cn } from "@eximia/ui"
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Check,
  GraduationCap,
  Layers,
  MessageCircle,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react"
import Link from "next/link"

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col bg-bg-app overflow-hidden">
      <AuthHashRedirect />

      {/* ───── NAVBAR ───── */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-4 py-3 sm:px-8 sm:py-4 md:px-12 bg-bg-app/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/eximia-symbol.svg" alt="exímIA" className="h-6 sm:h-7" />
          <div className="h-4 sm:h-5 w-px bg-white/20" />
          <span className="text-xs sm:text-sm font-bold tracking-wide text-accent-teal">Academy</span>
          <span className="hidden sm:inline text-[9px] text-text-muted/40 tracking-widest ml-1.5">by</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/eximia-horizontal-academy.svg" alt="exímIA" className="hidden sm:inline h-[11px] opacity-40" />
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          <a href="#como-funciona" className="hidden md:block text-sm text-text-muted hover:text-white transition-colors">Recursos</a>
          <a href="#diferenciais" className="hidden md:block text-sm text-text-muted hover:text-white transition-colors">Diferenciais</a>
          <a href="#resultados" className="hidden md:block text-sm text-text-muted hover:text-white transition-colors">Resultados</a>
          <Link
            href="/login"
            className="rounded-xl bg-accent-blue-mid px-4 py-2 text-xs sm:text-sm font-medium text-white transition-all hover:brightness-110"
          >
            Entrar
          </Link>
        </div>
      </nav>

      {/* ───── HERO ───── */}
      <section className="relative z-10 flex flex-col items-center px-4 sm:px-6 pb-20 sm:pb-32 pt-24 sm:pt-32 md:pt-40 text-center">
        {/* Background image — conference/training */}
        <div className="absolute inset-0 -z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1515168985652-8454bcc8fcaf?w=1800&q=80"
            alt=""
            className="h-full w-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-bg-app/40 via-bg-app/70 to-bg-app" />
        </div>

        {/* Badge */}
        <div className="mb-8 flex items-center gap-2 rounded-full border border-accent-blue-mid/25 bg-accent-blue-mid/8 px-5 py-2 backdrop-blur-sm">
          <Sparkles size={14} className="text-accent-blue-light" />
          <span className="text-xs font-semibold text-accent-blue-light tracking-wide">Educação corporativa potencializada por IA</span>
        </div>

        {/* Headline */}
        <h1 className="max-w-4xl text-3xl sm:text-4xl font-bold tracking-tight text-white leading-[1.12] md:text-6xl lg:text-[4.2rem]">
          Sua equipe aprende mais,{" "}
          <span className="bg-gradient-to-r from-accent-blue-light to-accent-teal bg-clip-text text-transparent">
            em menos tempo
          </span>
        </h1>

        <p className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-white/50 md:text-lg">
          A exímIA Academy usa inteligência artificial socrática para criar experiências de aprendizagem que se adaptam a cada colaborador. Menos conteúdo genérico. Mais resultado mensurável.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "px-8 h-13 text-[15px]")}>
            Começar agora
            <ArrowRight size={18} />
          </Link>
          <a
            href="#como-funciona"
            className="flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-white"
          >
            Entenda como funciona
            <ArrowRight size={14} />
          </a>
        </div>

        {/* Social proof */}
        <div className="mt-12 sm:mt-20 grid grid-cols-2 gap-6 sm:flex sm:items-center sm:gap-12">
          {[
            { value: "4", label: "Modos de Interação" },
            { value: "IA", label: "Socrática Adaptativa" },
            { value: "6", label: "Níveis de Bloom" },
            { value: "100%", label: "Progresso Rastreável" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold text-white md:text-4xl">{stat.value}</p>
              <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───── PROBLEMA / CONTEXTO ───── */}
      <section className="relative z-10 w-full px-4 sm:px-6 pb-16 sm:pb-28 md:px-12">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-accent-teal">O Problema</p>
          <h2 className="mt-4 text-2xl font-bold text-white md:text-3xl leading-tight">
            Treinamentos corporativos tradicionais<br className="hidden md:block" /> desperdiçam tempo e dinheiro
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] text-text-muted leading-relaxed">
            Conteúdo genérico que ignora o nível de cada colaborador. Avaliações que medem presença, não aprendizado.
            Gestores sem visibilidade do que realmente foi absorvido. A exímIA Academy resolve cada um desses problemas.
          </p>

          {/* Pain points */}
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              { icon: Users, label: "70%", desc: "dos colaboradores esquecem o conteúdo em 24h sem prática ativa" },
              { icon: TrendingUp, label: "3x", desc: "mais retenção com método socrático vs. aulas passivas" },
              { icon: Zap, label: "85%", desc: "dos gestores não sabem o real nível de competência da equipe" },
            ].map((pain) => (
              <div key={pain.desc} className="rounded-2xl bg-white/[0.03] p-6 ring-1 ring-white/[0.06]">
                <pain.icon size={22} className="mx-auto text-accent-blue-light" />
                <p className="mt-3 text-3xl font-bold text-white">{pain.label}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-text-muted">{pain.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── COMO FUNCIONA — 4 MODOS ───── */}
      <section id="como-funciona" className="relative z-10 w-full px-4 sm:px-6 pb-16 sm:pb-28 md:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-accent-blue-light">O Motor de Aprendizagem</p>
            <h2 className="mt-4 text-2xl font-bold text-white md:text-3xl">
              Quatro modos. Um sistema inteligente.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] text-text-muted leading-relaxed">
              A IA analisa o conteúdo de cada capítulo e escolhe automaticamente o modo de interação mais eficaz — baseado na Taxonomia de Bloom e no currículo espiral.
            </p>
          </div>

          <div className="grid gap-3 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: MessageCircle,
                color: "from-accent-blue-mid/25 to-accent-blue-deep/40",
                accent: "text-accent-blue-light",
                ring: "ring-accent-blue-mid/20",
                glow: "bg-accent-blue-mid/10",
                title: "Diálogo Socrático",
                desc: "A IA conduz o raciocínio por meio de perguntas progressivas. O aluno descobre a resposta — nunca recebe pronta.",
                bloom: "Analisar · Avaliar",
              },
              {
                icon: Target,
                color: "from-amber-500/20 to-amber-900/25",
                accent: "text-amber-400",
                ring: "ring-amber-500/15",
                glow: "bg-amber-500/10",
                title: "Cenários Práticos",
                desc: "Simulações de problemas reais da empresa, gerados por IA sob demanda. O aluno decide, a IA avalia.",
                bloom: "Avaliar · Criar",
              },
              {
                icon: BookOpen,
                color: "from-purple-500/20 to-purple-900/25",
                accent: "text-purple-400",
                ring: "ring-purple-500/15",
                glow: "bg-purple-500/10",
                title: "Quiz Adaptativo",
                desc: "Múltipla escolha, V/F e abertas. A dificuldade se calibra automaticamente conforme o desempenho.",
                bloom: "Lembrar · Compreender",
              },
              {
                icon: GraduationCap,
                color: "from-accent-teal/20 to-accent-teal-dark/30",
                accent: "text-accent-teal",
                ring: "ring-accent-teal/15",
                glow: "bg-accent-teal/10",
                title: "Atividades",
                desc: "Entregas práticas avaliadas por rubrica estruturada. Feedback qualitativo gerado pela IA.",
                bloom: "Aplicar · Criar",
              },
            ].map((mode) => (
              <div
                key={mode.title}
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${mode.color} p-6 ring-1 ${mode.ring} transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_16px_50px_rgba(0,0,0,0.35)]`}
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${mode.glow}`}>
                  <mode.icon size={24} className={mode.accent} />
                </div>
                <h3 className="mt-5 text-base font-semibold text-white">{mode.title}</h3>
                <p className="mt-2.5 text-[13px] leading-relaxed text-white/40">{mode.desc}</p>
                <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-white/20">{mode.bloom}</p>
                <div className={`absolute -bottom-10 -right-10 h-28 w-28 rounded-full ${mode.glow} blur-2xl opacity-50 group-hover:opacity-80 transition-opacity`} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── DIFERENCIAIS ───── */}
      <section id="diferenciais" className="relative z-10 w-full px-4 sm:px-6 pb-16 sm:pb-28 md:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-accent-teal">Diferenciais</p>
            <h2 className="mt-4 text-2xl font-bold text-white md:text-3xl">
              O que faz a exímIA Academy diferente
            </h2>
          </div>

          <div className="grid gap-3 sm:gap-5 grid-cols-1 md:grid-cols-2">
            {[
              {
                icon: BrainCircuit,
                title: "Taxonomia de Bloom integrada",
                desc: "Cada capítulo é mapeado automaticamente em 6 níveis cognitivos — do lembrar ao criar. A IA seleciona a interação ideal para cada nível, garantindo progressão real de competência.",
              },
              {
                icon: BarChart3,
                title: "Analytics que mostram aprendizado real",
                desc: "Dashboards para gestores que vão além de 'quem completou'. Medem profundidade de raciocínio, lacunas de competência por área e evolução individual ao longo do tempo.",
              },
              {
                icon: Layers,
                title: "Currículo espiral automatizado",
                desc: "O conteúdo retorna em ciclos de complexidade crescente. O aluno revê conceitos em contextos mais profundos — a IA garante que nada seja esquecido.",
              },
              {
                icon: Sparkles,
                title: "Course Creator com IA",
                desc: "Importe um PDF, vídeo ou áudio e a IA estrutura o curso inteiro — capítulos, objetivos de aprendizagem, perguntas e interações. Pronto para publicar em minutos.",
              },
            ].map((diff) => (
              <div key={diff.title} className="rounded-2xl bg-bg-card/50 p-7 ring-1 ring-white/[0.06] transition-all hover:ring-white/[0.1]">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.05]">
                  <diff.icon size={20} className="text-accent-blue-light" />
                </div>
                <h3 className="mt-5 text-[15px] font-semibold text-white">{diff.title}</h3>
                <p className="mt-2.5 text-[13px] leading-relaxed text-text-muted">{diff.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── RESULTADOS / PROVA SOCIAL ───── */}
      <section id="resultados" className="relative z-10 w-full px-4 sm:px-6 pb-16 sm:pb-28 md:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-accent-blue-light">Resultados</p>
            <h2 className="mt-4 text-2xl font-bold text-white md:text-3xl">
              O que muda quando a IA ensina de verdade
            </h2>
          </div>

          <div className="grid gap-3 sm:gap-5 grid-cols-1 sm:grid-cols-3">
            {[
              {
                metric: "3x",
                label: "mais retenção",
                desc: "Método socrático força recall ativo — o oposto de assistir slides passivamente.",
              },
              {
                metric: "60%",
                label: "menos tempo",
                desc: "Trilhas adaptativas eliminam conteúdo redundante. Cada aluno estuda só o que precisa.",
              },
              {
                metric: "Real-time",
                label: "visibilidade",
                desc: "Gestores sabem exatamente onde estão as lacunas da equipe — sem esperar avaliações trimestrais.",
              },
            ].map((result) => (
              <div key={result.label} className="rounded-2xl bg-gradient-to-br from-accent-blue-deep/50 to-bg-card p-8 ring-1 ring-accent-blue-mid/10 text-center">
                <p className="text-4xl font-bold text-accent-blue-light">{result.metric}</p>
                <p className="mt-1 text-sm font-semibold text-white">{result.label}</p>
                <p className="mt-3 text-[13px] leading-relaxed text-text-muted">{result.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── CHECKLIST ───── */}
      <section className="relative z-10 w-full px-4 sm:px-6 pb-16 sm:pb-28 md:px-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold text-white md:text-3xl">
            Tudo em uma plataforma
          </h2>
          <div className="mt-8 sm:mt-10 grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2">
            {[
              "Cursos com capítulos e conteúdo rico",
              "4 modos de interação com IA",
              "Trilhas de aprendizagem sequenciais",
              "Quiz com múltiplos formatos",
              "Cenários gerados por IA sob demanda",
              "Analytics por aluno, curso e área",
              "Gestão de competências (Bloom)",
              "Importação de conteúdo (PDF, vídeo, áudio)",
              "Multi-tenant com white-label",
              "API de integração (contrato eximIA v1)",
              "SSO e login com Google",
              "Diálogo socrático adaptativo",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl bg-white/[0.02] px-4 py-3 ring-1 ring-white/[0.04]">
                <Check size={15} className="shrink-0 text-accent-teal" />
                <span className="text-sm text-text-secondary">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── CTA FINAL ───── */}
      <section className="relative z-10 w-full px-4 sm:px-6 pb-16 sm:pb-28">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl ring-1 ring-white/[0.08]">
          <div className="relative px-8 py-16 text-center md:px-16">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-blue-deep via-bg-card to-accent-blue-deep/50" />
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }} />
            <div className="relative z-10">
              <Sparkles size={28} className="mx-auto text-accent-blue-light mb-6" />
              <h2 className="text-2xl font-bold text-white md:text-3xl">
                Pronto para transformar<br />o ensino da sua equipe?
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-sm text-white/40 leading-relaxed">
                Configure em minutos. Importe seu conteúdo, defina trilhas e deixe a IA personalizar a experiência de aprendizagem para cada colaborador.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "px-8")}>
                  Acessar a Plataforma
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── CO-BRANDING ───── */}
      <section className="relative z-10 w-full pb-10">
        <div className="mx-auto flex flex-col items-center gap-3">
          <p className="text-[9px] uppercase tracking-[0.2em] text-text-muted/30">Powered by</p>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/eximia-horizontal-academy.svg" alt="exímIA" style={{ height: 20 }} className="opacity-50" />
          </div>
        </div>
      </section>

      {/* ───── FOOTER ───── */}
      <footer className="relative z-10 w-full border-t border-white/[0.04] py-6">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/argos-academy-light.png" alt="exímIA Academy" style={{ height: 14 }} className="opacity-40" />
              <span className="text-xs text-text-muted/40">Academy</span>
              <span className="text-[9px] text-text-muted/25 ml-1">by</span>
              <img src="/logos/eximia-horizontal-academy.svg" alt="exímIA" style={{ height: 10 }} className="opacity-25" />
            </div>
            <p className="text-[11px] text-text-muted/30">
              &copy; {new Date().getFullYear()} exímIA Academy by exímIA. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}
