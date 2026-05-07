"use client"

import { useEffect, useRef, useState } from "react"
import {
  Button,
  Input,
  Badge,
  Label,
  Textarea,
  Toggle,
  ProgressBar,
  Avatar,
  Separator,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Checkbox,
  RadioGroup,
  RadioItem,
  Select,
  Skeleton,
  Switch,
  Alert,
  AlertTitle,
  AlertDescription,
  Kbd,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  ScrollArea,
  StatCard,
  EmptyState,
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
  ModalClose,
} from "@eximia/ui"
import {
  Lock,
  ArrowRight,
  Search,
  Hexagon,
  Palette,
  Type,
  Grid3X3,
  Sparkles,
  Box,
  Layers,
  Zap,
  Settings,
  Copy,
  Check,
  Home,
  BookOpen,
  Users,
  BarChart3,
  GraduationCap,
  MessageSquare,
  Eye,
  ChevronRight,
  Plus,
  Monitor,
} from "lucide-react"

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const ACCESS_CODE = process.env.NEXT_PUBLIC_BRANDBOOK_CODE || "eximia2026"
const DS_VERSION = "1.2.2"
const BB_VERSION = "2.0.0"

type NavItem = { id: string; label: string; icon: React.ElementType }

const NAV_ITEMS: NavItem[] = [
  { id: "identity", label: "Identidade", icon: Hexagon },
  { id: "login", label: "Login Standard", icon: Lock },
  { id: "colors", label: "Cores", icon: Palette },
  { id: "typography", label: "Tipografia", icon: Type },
  { id: "spacing", label: "Espaçamento", icon: Grid3X3 },
  { id: "effects", label: "Efeitos", icon: Sparkles },
  { id: "atoms", label: "Atoms", icon: Box },
  { id: "molecules", label: "Molecules", icon: Layers },
  { id: "organisms", label: "Organisms", icon: Zap },
  { id: "patterns", label: "Padrões", icon: Settings },
]

// ═══════════════════════════════════════════════════════════════════════════════
// ACCESS GATE
// ═══════════════════════════════════════════════════════════════════════════════

function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [code, setCode] = useState("")
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (code === ACCESS_CODE) {
      sessionStorage.setItem("bb-auth", "1")
      onAuth()
    } else {
      setError(true)
      setCode("")
      inputRef.current?.focus()
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg-app px-4">
      {/* Ambient blurs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/3 top-1/4 h-64 w-64 rounded-full bg-varzea/[0.04] blur-3xl" />
        <div className="absolute right-1/4 bottom-1/3 h-48 w-48 rounded-full bg-cerrado-600/[0.03] blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm space-y-8 text-center">
        <div className="space-y-3">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-card bg-bg-surface/60 shadow-[0_0_30px_rgba(42,122,138,0.12)] backdrop-blur-xl">
            <Lock className="h-6 w-6 text-varzea" />
          </div>
          <h1 className="font-[var(--font-serif)] text-3xl tracking-tight">Design System</h1>
          <p className="text-sm text-text-secondary">Insira o código de acesso para visualizar o brandbook</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            ref={inputRef}
            type="password"
            placeholder="Código de acesso"
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(false) }}
            error={error}
            autoComplete="off"
          />
          {error && <p className="text-xs text-semantic-error">Código incorreto. Tente novamente.</p>}
          <Button type="submit" className="w-full gap-2">
            Acessar <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <p className="text-2xs text-text-muted">Argos Academy by exímIA — Confidencial</p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function GlassPanel({
  children,
  className = "",
  glow,
  padding = "md",
}: {
  children: React.ReactNode
  className?: string
  glow?: "blue" | "teal" | "gold"
  padding?: "sm" | "md" | "lg" | "none"
}) {
  const glowMap = {
    blue: "shadow-[0_0_30px_rgba(42,106,176,0.1)]",
    teal: "shadow-[0_0_30px_rgba(42,122,138,0.1)]",
    gold: "shadow-[0_0_30px_rgba(196,160,64,0.1)]",
  }
  const padMap = { none: "", sm: "p-4", md: "p-6", lg: "p-8" }

  return (
    <div className={`rounded-2xl shadow-card bg-bg-surface/60 backdrop-blur-xl ${glow ? glowMap[glow] : ""} ${padMap[padding]} ${className}`}>
      {children}
    </div>
  )
}

function Section({ id, number, title, description, children }: {
  id: string
  number: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-10">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-varzea">{number}</span>
          <div className="h-px flex-1 bg-gradient-to-r from-varzea/20 to-transparent" />
        </div>
        <h2 className="font-[var(--font-serif)] text-3xl tracking-tight">{title}</h2>
        {description && <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      {children}
    </div>
  )
}

function Demo({ label, children, className = "", padding }: { label?: string; children: React.ReactNode; className?: string; padding?: "sm" | "md" | "lg" | "none" }) {
  return (
    <GlassPanel className={className} padding={padding}>
      {label && <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">{label}</p>}
      {children}
    </GlassPanel>
  )
}

function ColorSwatch({ name, token, value, large }: { name: string; token?: string; value: string; large?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button type="button" onClick={copy} className="group text-left space-y-2.5">
      <div
        className={`w-full rounded-xl shadow-card transition-all duration-200 group-hover:scale-[1.03] group- ${large ? "h-24" : "h-16"}`}
        style={{ backgroundColor: value }}
      />
      <div>
        <p className="text-xs font-medium">{name}</p>
        {token && <p className="font-mono text-[10px] text-text-muted">{token}</p>}
        <p className="font-mono text-[10px] text-text-muted">
          {copied ? <span className="text-semantic-success">Copiado!</span> : value}
        </p>
      </div>
    </button>
  )
}

function Code({ children, copyable }: { children: string; copyable?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-xl shadow-card bg-bg-app p-5 font-mono text-xs leading-relaxed text-text-secondary">
        <code>{children}</code>
      </pre>
      {copyable !== false && (
        <button
          type="button"
          onClick={copy}
          className="absolute right-3 top-3 rounded-lg shadow-card bg-bg-surface p-1.5 text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-text-primary"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-semantic-success" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  )
}

function TokenTable({ rows }: { rows: { token: string; value: string; preview?: React.ReactNode }[] }) {
  return (
    <div className="overflow-x-auto rounded-xl shadow-card">
      <table className="w-full text-sm">
        <thead>
          <tr className=" bg-bg-app/50">
            <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-text-muted">Token</th>
            <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-text-muted">Value</th>
            {rows.some((r) => r.preview) && (
              <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-text-muted">Preview</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y ">
          {rows.map((r) => (
            <tr key={r.token} className="transition-colors hover:bg-bg-surface/30">
              <td className="px-4 py-2.5 font-mono text-xs text-varzea-light">{r.token}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">{r.value}</td>
              {rows.some((row) => row.preview) && <td className="px-4 py-2.5">{r.preview}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

function SideNav({ active }: { active: string }) {
  return (
    <nav className="fixed left-0 top-0 z-20 hidden h-screen w-60 flex-col border-r border-border-subtle bg-bg-sidebar/80 backdrop-blur-xl lg:flex">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3  px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-varzea/10 shadow-[0_0_12px_rgba(42,122,138,0.15)]">
          <Layers className="h-4 w-4 text-varzea" />
        </div>
        <div>
          <p className="text-sm font-semibold">Overlens</p>
          <p className="font-mono text-[10px] text-text-muted">v{DS_VERSION}</p>
        </div>
      </div>

      {/* Links */}
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pt-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = active === item.id
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
                isActive
                  ? "bg-varzea/10 font-medium text-varzea-light shadow-[0_0_20px_rgba(42,122,138,0.08)]"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              }`}
            >
              {isActive && <div className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-varzea" />}
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </a>
          )
        })}
      </div>

      {/* Footer */}
      <div className=" px-5 py-4">
        <p className="font-mono text-[10px] text-text-muted">Brandbook v{BB_VERSION}</p>
        <p className="font-mono text-[10px] text-text-muted">© Argos Academy by exímIA</p>
      </div>
    </nav>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CONTENT
// ═══════════════════════════════════════════════════════════════════════════════

function BrandbookContent() {
  const [activeSection, setActiveSection] = useState("identity")
  const [switchVal, setSwitchVal] = useState(true)
  const [toggleVal, setToggleVal] = useState(false)
  const [checkVal, setCheckVal] = useState(false)
  const [radioVal, setRadioVal] = useState("opt-1")
  const [progress, setProgress] = useState(65)
  const [tab, setTab] = useState("tab-1")
  const [accordion, setAccordion] = useState<string | string[]>("item-1")
  const [modalOpen, setModalOpen] = useState(false)

  // Scroll-spy
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        }
      },
      { rootMargin: "-20% 0px -70% 0px" },
    )
    for (const item of NAV_ITEMS) {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-bg-app">
      <SideNav active={activeSection} />

      {/* ═══ TOPBAR ═══ */}
      <header className="fixed right-0 left-0 top-0 z-30 flex h-16 items-center justify-between  bg-bg-app/80 px-6 backdrop-blur-xl lg:left-60">
        <div className="flex items-center gap-3">
          <img
            src="/logos/argos-academy-color.png"
            alt="Argos Academy"
            className="h-6"
            onError={(e) => {
              const t = e.target as HTMLImageElement
              t.style.display = "none"
            }}
          />
          <div className="hidden items-center gap-2 sm:flex">
            <div className="h-4 w-px bg-white/10" />
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">Design System</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="info" badgeSize="sm">Overlens v{DS_VERSION}</Badge>
        </div>
      </header>

      {/* ═══ MAIN ═══ */}
      <main className="px-6 pb-24 pt-28 lg:ml-60 lg:px-12">
        <div className="mx-auto max-w-5xl space-y-28">

          {/* ═══════════════════════════════════════════════════════════════
              01 · IDENTITY
              ═══════════════════════════════════════════════════════════════ */}
          <Section id="identity" number="01" title="Identidade" description="Fundamentos visuais da marca Argos Academy by exímIA — logos, naming e DNA cromático.">
            {/* Logo showcase */}
            <GlassPanel glow="teal" padding="lg">
              <div className="flex flex-col items-center gap-8 py-6">
                <img
                  src="/logos/argos-academy-color.png"
                  alt="Argos Academy"
                  className="h-12"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                />
                <div className="h-0.5 w-12 rounded-full bg-varzea shadow-[0_0_12px_rgba(42,122,138,0.5)]" />
                <div className="max-w-lg text-center space-y-2">
                  <p className="font-[var(--font-serif)] text-xl">Argos Academy by exímIA</p>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    Plataforma de ensino com IA socrática. <strong className="text-accent-gold">exímIA</strong> significa{" "}
                    <em className="text-text-primary">Execução eXtraordinária por Inteligência, Maestria e Inovação Autônoma</em>.
                  </p>
                </div>
              </div>
            </GlassPanel>

            <Sub title="Naming Convention">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { name: "Argos", role: "Marca-parceira (consultoria)", color: "text-cerrado-400", glow: "shadow-[0_0_20px_rgba(42,106,176,0.1)]" },
                  { name: "Academy", role: "Produto (plataforma LMS)", color: "text-varzea-light", glow: "shadow-[0_0_20px_rgba(42,122,138,0.1)]" },
                  { name: "Overlens", role: "Design System", color: "text-accent-gold-light", glow: "shadow-[0_0_20px_rgba(196,160,64,0.1)]" },
                ].map((item) => (
                  <GlassPanel key={item.name} className={item.glow}>
                    <div className="text-center space-y-1.5">
                      <p className={`text-lg font-semibold ${item.color}`}>{item.name}</p>
                      <p className="text-2xs text-text-muted">{item.role}</p>
                    </div>
                  </GlassPanel>
                ))}
              </div>
            </Sub>

            <Sub title="Color DNA">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { family: "Blue", desc: "Primário — CTAs, foco, links", colors: ["#0d2847", "#1a4a8a", "#2a6ab0", "#4a8ad0"] },
                  { family: "Gold", desc: "Destaque — conquistas, premium", colors: ["#8a6a20", "#c4a040", "#d4b860"] },
                  { family: "Teal", desc: "Academy — identidade do produto", colors: ["#1a4a5a", "#2a7a8a", "#3a9aaa"] },
                ].map((f) => (
                  <GlassPanel key={f.family}>
                    <p className="text-sm font-semibold mb-1">{f.family}</p>
                    <p className="text-2xs text-text-muted mb-3">{f.desc}</p>
                    <div className="flex gap-1.5">
                      {f.colors.map((c) => (
                        <div key={c} className="h-8 flex-1 rounded-lg shadow-card" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </GlassPanel>
                ))}
              </div>
            </Sub>
          </Section>

          {/* ═══════════════════════════════════════════════════════════════
              02 · LOGIN STANDARD
              ═══════════════════════════════════════════════════════════════ */}
          <Section id="login" number="02" title="Login Standard" description="Padrão unificado de login para produtos exímIA. Branding usa teal (#2a7a8a) no accent bar, formulários usam blue (#2a6ab0) como accent de interação.">
            {/* Live preview */}
            <Sub title="Preview">
              <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl shadow-card bg-bg-app shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
                {/* Ambient blurs */}
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute left-1/4 top-1/4 h-32 w-32 rounded-full bg-varzea/[0.05] blur-3xl" />
                  <div className="absolute right-1/3 bottom-1/4 h-24 w-24 rounded-full bg-cerrado-600/[0.03] blur-3xl" />
                  {/* Grid pattern */}
                  <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                      backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
                      backgroundSize: "40px 40px",
                    }}
                  />
                </div>

                {/* Content */}
                <div className="relative flex flex-col items-center px-8 py-10">
                  {/* Logo */}
                  <img
                    src="/logos/argos-academy-light.png"
                    alt="Argos Academy"
                    className="mb-2 h-8"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                  />
                  {/* Divider */}
                  <div className="mb-1 flex items-center gap-3">
                    <div className="h-px w-8 bg-white/10" />
                    <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-text-muted">Academy</span>
                    <div className="h-px w-8 bg-white/10" />
                  </div>
                  {/* Accent bar */}
                  <div className="mb-6 h-0.5 w-10 rounded-full bg-varzea shadow-[0_0_12px_rgba(42,122,138,0.5)]" />

                  {/* Glass card */}
                  <div className="w-full rounded-xl shadow-card bg-bg-sidebar/80 px-8 py-6 shadow-elevated backdrop-blur-sm">
                    {/* Icon header */}
                    <div className="mb-6 flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cerrado-600/10">
                        <Lock className="h-[18px] w-[18px] text-cerrado-600" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-white">Bem-vindo</p>
                        <p className="text-xs text-text-muted">Entre para acessar o dashboard</p>
                      </div>
                    </div>

                    {/* Form fields (static preview) */}
                    <div className="space-y-5">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-white/80">Email</label>
                        <div className="flex h-11 items-center rounded-sm shadow-card bg-bg-surface px-3 text-sm text-text-muted">
                          seu@email.com
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-white/80">Senha</label>
                        <div className="flex h-11 items-center rounded-sm shadow-card bg-bg-surface px-3 text-sm text-text-muted">
                          ••••••••
                        </div>
                      </div>
                      <div className="flex h-10 items-center justify-center gap-2 rounded-sm bg-cerrado-600 text-sm font-semibold text-white">
                        Entrar <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>

                    {/* Forgot password */}
                    <p className="mt-6 text-center text-xs text-text-muted/60">Esqueceu a senha?</p>
                  </div>

                  <p className="mt-6 text-[10px] text-text-muted">© Argos Academy by exímIA · AI-powered learning</p>
                </div>
              </div>
            </Sub>

            {/* Anatomy */}
            <Sub title="Anatomia — 7 Componentes">
              <TokenTable
                rows={[
                  { token: "01 Background Layer", value: "bg-app (#0f0f0f) + 3 radial blurs (blue-mid/5%) + dot-grid (3%)" },
                  { token: "02 Logo + Divider", value: "logo-horizontal.svg (38px), 'Academy' uppercase tracking-[0.25em]" },
                  { token: "03 Accent Bar", value: "h-1 w-16 bg-varzea + glow shadow (12px) — branding only" },
                  { token: "04 Glass Card", value: "rounded-xl, border-border-subtle, bg-sidebar/80, backdrop-blur-sm, px-8 py-6" },
                  { token: "05 Icon Header", value: "10×10 rounded-md, cerrado-600/10 bg, Lock 18px, title + subtitle (left-aligned)" },
                  { token: "06 Form Fields", value: "h-11 rounded-sm, border-border-subtle, bg-bg-surface, labels text-white/80" },
                  { token: "07 Action Button", value: "h-10 rounded-sm bg-cerrado-600, ArrowRight 16px, loading → 'Entrando...'" },
                ]}
              />
            </Sub>

            {/* Token reference */}
            <Sub title="Tokens de Referência">
              <TokenTable
                rows={[
                  { token: "--bg", value: "#0f0f0f", preview: <div className="h-5 w-10 rounded" style={{ backgroundColor: "#0f0f0f", outline: "1px solid rgba(255,255,255,0.1)" }} /> },
                  { token: "--card-surface", value: "#141416 @ 80%", preview: <div className="h-5 w-10 rounded" style={{ backgroundColor: "rgba(20,20,22,0.8)" }} /> },
                  { token: "--input-surface", value: "#1a1a1a", preview: <div className="h-5 w-10 rounded" style={{ backgroundColor: "#1a1a1a" }} /> },
                  { token: "--border", value: "rgba(255,255,255,0.06)", preview: <div className="h-5 w-10 rounded shadow-card" /> },
                  { token: "--accent-form", value: "#2a6ab0 (blue-mid)", preview: <div className="h-5 w-10 rounded" style={{ backgroundColor: "#2a6ab0" }} /> },
                  { token: "--accent-brand", value: "#2a7a8a (teal)", preview: <div className="h-5 w-10 rounded" style={{ backgroundColor: "#2a7a8a" }} /> },
                  { token: "--label", value: "text-white/80, text-sm font-medium" },
                  { token: "--radius-card", value: "12px (rounded-xl)" },
                  { token: "--radius-input", value: "2px (rounded-sm)" },
                  { token: "--blur", value: "backdrop-blur-sm" },
                  { token: "--max-width", value: "24rem (max-w-sm)" },
                ]}
              />
            </Sub>

            {/* Product variants */}
            <Sub title="Variantes por Produto">
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { product: "FORMS", color: "#2a6ab0", label: "Blue" },
                  { product: "OS", color: "#c4a040", label: "Gold" },
                  { product: "BIBLICAL", color: "#7c5cbf", label: "Purple" },
                  { product: "ACADEMY", color: "#2a7a8a", label: "Teal", active: true },
                ].map((p) => (
                  <GlassPanel key={p.product} className={p.active ? "ring-1 ring-varzea/30" : ""}>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: `${p.color}20` }}>
                        <div className="flex h-full items-center justify-center">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{p.product}</p>
                        <p className="font-mono text-[10px] text-text-muted">{p.color}</p>
                      </div>
                    </div>
                  </GlassPanel>
                ))}
              </div>
            </Sub>

            {/* Do / Don't */}
            <Sub title="Diretrizes">
              <div className="grid gap-4 sm:grid-cols-2">
                <GlassPanel>
                  <p className="mb-3 text-xs font-semibold text-semantic-success">✓ Faça</p>
                  <ul className="space-y-1.5 text-xs text-text-secondary">
                    <li>Centralizar o card de login</li>
                    <li>Usar logo-horizontal.svg</li>
                    <li>Manter divider com nome do produto</li>
                    <li>Glass card com backdrop blur</li>
                    <li>Ambient blurs no background</li>
                    <li>Footer com tagline do produto</li>
                  </ul>
                </GlassPanel>
                <GlassPanel>
                  <p className="mb-3 text-xs font-semibold text-semantic-error">✕ Não faça</p>
                  <ul className="space-y-1.5 text-xs text-text-secondary">
                    <li>Background claro / branco</li>
                    <li>Ilustrações ou imagens stock</li>
                    <li>Layout split (duas colunas)</li>
                    <li>Alterar border-radius ou blur do card</li>
                    <li>Usar fontes diferentes de Inter</li>
                    <li>Omitir divider com nome do produto</li>
                  </ul>
                </GlassPanel>
              </div>
            </Sub>
          </Section>

          {/* ═══════════════════════════════════════════════════════════════
              03 · COLORS
              ═══════════════════════════════════════════════════════════════ */}
          <Section id="colors" number="03" title="Cores" description="Paleta completa do Overlens Design System. Clique em qualquer swatch para copiar o hex.">
            <Sub title="Backgrounds">
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-7">
                <ColorSwatch name="App" token="bg-app" value="#0f0f0f" />
                <ColorSwatch name="Sidebar" token="bg-sidebar" value="#141416" />
                <ColorSwatch name="Surface" token="bg-surface" value="#1a1a1a" />
                <ColorSwatch name="Card" token="bg-card" value="#1e1e1e" />
                <ColorSwatch name="Elevated" token="bg-elevated" value="#242424" />
                <ColorSwatch name="Hover" token="bg-hover" value="#2a2a2a" />
                <ColorSwatch name="Dud" token="bg-dud" value="#1c1c1c" />
              </div>
            </Sub>

            <Sub title="Text">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <ColorSwatch name="Primary" token="text-primary" value="#ffffff" />
                <ColorSwatch name="Secondary" token="text-secondary" value="#a0a0a0" />
                <ColorSwatch name="Muted" token="text-muted" value="#737373" />
                <ColorSwatch name="Inactive" token="text-inactive" value="#888888" />
              </div>
            </Sub>

            <Sub title="Accent — Blue">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <ColorSwatch name="Deep" token="cerrado-800" value="#0d2847" large />
                <ColorSwatch name="Default" token="cerrado-500" value="#1a4a8a" large />
                <ColorSwatch name="Mid" token="cerrado-600" value="#2a6ab0" large />
                <ColorSwatch name="Light" token="cerrado-400" value="#4a8ad0" large />
              </div>
            </Sub>

            <Sub title="Accent — Gold">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <ColorSwatch name="Dark" token="accent-gold-dark" value="#8a6a20" large />
                <ColorSwatch name="Default" token="accent-gold" value="#c4a040" large />
                <ColorSwatch name="Light" token="accent-gold-light" value="#d4b860" large />
              </div>
            </Sub>

            <Sub title="Accent — Teal">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <ColorSwatch name="Dark" token="varzea-dark" value="#1a4a5a" large />
                <ColorSwatch name="Default" token="varzea" value="#2a7a8a" large />
                <ColorSwatch name="Light" token="varzea-light" value="#3a9aaa" large />
              </div>
            </Sub>

            <Sub title="Semantic">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <ColorSwatch name="Success" token="semantic-success" value="#4b9560" large />
                <ColorSwatch name="Error" token="semantic-error" value="#fe4338" large />
                <ColorSwatch name="Warning" token="semantic-warning" value="#f6a609" large />
                <ColorSwatch name="Info" token="semantic-info" value="#2a6ab0" large />
              </div>
            </Sub>

            <Sub title="Borders">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <GlassPanel>
                  <p className="text-xs font-medium mb-2">Subtle</p>
                  <div className="h-12 rounded-lg shadow-card" />
                  <p className="mt-2 font-mono text-[10px] text-text-muted">rgba(255,255,255,0.06)</p>
                </GlassPanel>
                <GlassPanel>
                  <p className="text-xs font-medium mb-2">Medium</p>
                  <div className="h-12 rounded-lg shadow-card" />
                  <p className="mt-2 font-mono text-[10px] text-text-muted">rgba(255,255,255,0.1)</p>
                </GlassPanel>
                <GlassPanel>
                  <p className="text-xs font-medium mb-2">Button</p>
                  <div className="h-12 rounded-lg border border-border-button" />
                  <p className="mt-2 font-mono text-[10px] text-text-muted">rgba(255,255,255,0.25)</p>
                </GlassPanel>
              </div>
            </Sub>

            <Sub title="Special">
              <div className="grid grid-cols-2 gap-4">
                <ColorSwatch name="Course Card" token="special-course-card" value="#f0ece4" large />
                <ColorSwatch name="Course Card Text" token="special-course-card-text" value="#2a2a2a" large />
              </div>
            </Sub>
          </Section>

          {/* ═══════════════════════════════════════════════════════════════
              04 · TYPOGRAPHY
              ═══════════════════════════════════════════════════════════════ */}
          <Section id="typography" number="04" title="Tipografia" description="Sistema tipográfico Inter (sans) + JetBrains Mono (mono) com 13 tamanhos e 6 pesos.">
            <Sub title="Escala de Tamanhos">
              <Demo>
                <div className="space-y-4">
                  {[
                    { label: "7xl", size: "text-7xl", rem: "3.2rem" },
                    { label: "6xl", size: "text-6xl", rem: "2.8rem" },
                    { label: "5xl", size: "text-5xl", rem: "2.5rem" },
                    { label: "4xl", size: "text-4xl", rem: "2.25rem" },
                    { label: "3xl", size: "text-3xl", rem: "2rem" },
                    { label: "2xl", size: "text-2xl", rem: "1.75rem" },
                    { label: "xl", size: "text-xl", rem: "1.5rem" },
                    { label: "lg", size: "text-lg", rem: "1.25rem" },
                    { label: "md", size: "text-md", rem: "1.125rem" },
                    { label: "base", size: "text-base", rem: "1rem" },
                    { label: "sm", size: "text-sm", rem: "0.875rem" },
                    { label: "xs", size: "text-xs", rem: "0.75rem" },
                    { label: "2xs", size: "text-2xs", rem: "0.6875rem" },
                  ].map((t) => (
                    <div key={t.label} className="flex items-baseline gap-4">
                      <span className="w-12 shrink-0 text-right font-mono text-[10px] text-text-muted">{t.label}</span>
                      <span className={`${t.size} truncate`}>Academy Design</span>
                      <span className="ml-auto shrink-0 font-mono text-[10px] text-text-muted">{t.rem}</span>
                    </div>
                  ))}
                </div>
              </Demo>
            </Sub>

            <Sub title="Pesos">
              <Demo>
                <div className="space-y-3">
                  {[
                    { label: "Light", cls: "font-light", val: "300" },
                    { label: "Normal", cls: "font-normal", val: "400" },
                    { label: "Medium", cls: "font-medium", val: "500" },
                    { label: "Semibold", cls: "font-semibold", val: "600" },
                    { label: "Bold", cls: "font-bold", val: "700" },
                    { label: "Extrabold", cls: "font-extrabold", val: "800" },
                  ].map((w) => (
                    <div key={w.val} className="flex items-center gap-4">
                      <span className="w-12 shrink-0 text-right font-mono text-[10px] text-text-muted">{w.val}</span>
                      <span className={`text-lg ${w.cls}`}>{w.label} — Plataforma de ensino</span>
                    </div>
                  ))}
                </div>
              </Demo>
            </Sub>

            <Sub title="Fontes">
              <div className="grid gap-4 sm:grid-cols-2">
                <Demo label="Sans (Inter)">
                  <p className="text-lg">The quick brown fox jumps over the lazy dog</p>
                  <p className="mt-2 text-sm text-text-secondary">UI, dados, labels, formulários, conteúdo técnico</p>
                </Demo>
                <Demo label="Mono (JetBrains Mono)">
                  <p className="font-mono text-lg">
                    <span className="text-cerrado-400">const</span>{" "}
                    <span className="text-accent-gold">academy</span> ={" "}
                    <span className="text-varzea-light">&quot;exímIA&quot;</span>
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">Código, tokens, valores técnicos</p>
                </Demo>
              </div>
            </Sub>

            <Sub title="Line Height & Letter Spacing">
              <TokenTable
                rows={[
                  { token: "--leading-tight", value: "1.1" },
                  { token: "--leading-normal", value: "1.3" },
                  { token: "--leading-relaxed", value: "1.5" },
                  { token: "--leading-loose", value: "1.6" },
                  { token: "--tracking-hero", value: "-1px" },
                ]}
              />
            </Sub>
          </Section>

          {/* ═══════════════════════════════════════════════════════════════
              05 · SPACING
              ═══════════════════════════════════════════════════════════════ */}
          <Section id="spacing" number="05" title="Espaçamento" description="Escala de 11 níveis baseada em múltiplos de 4px. Radius, breakpoints e constantes de layout.">
            <Demo>
              <div className="space-y-3">
                {[
                  { label: "0", rem: "0", px: "0" },
                  { label: "1", rem: "0.25rem", px: "4px" },
                  { label: "2", rem: "0.5rem", px: "8px" },
                  { label: "3", rem: "0.75rem", px: "12px" },
                  { label: "4", rem: "1rem", px: "16px" },
                  { label: "5", rem: "1.25rem", px: "20px" },
                  { label: "6", rem: "1.5rem", px: "24px" },
                  { label: "7", rem: "2rem", px: "32px" },
                  { label: "8", rem: "2.5rem", px: "40px" },
                  { label: "9", rem: "3rem", px: "48px" },
                  { label: "10", rem: "4rem", px: "64px" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-4">
                    <span className="w-6 shrink-0 text-right font-mono text-[10px] text-text-muted">{s.label}</span>
                    <div className="h-4 rounded bg-varzea/25" style={{ width: s.rem === "0" ? "2px" : s.rem }} />
                    <span className="font-mono text-[10px] text-text-muted">{s.px}</span>
                  </div>
                ))}
              </div>
            </Demo>

            <Sub title="Border Radius">
              <div className="flex flex-wrap gap-6">
                {[
                  { label: "sm", value: "6px" },
                  { label: "md", value: "12px" },
                  { label: "lg", value: "18px" },
                  { label: "xl", value: "24px" },
                  { label: "pill", value: "100px" },
                  { label: "circle", value: "50%" },
                ].map((r) => (
                  <div key={r.label} className="space-y-2 text-center">
                    <div className="h-16 w-16 bg-varzea/15 ring-1 ring-varzea/20" style={{ borderRadius: r.value }} />
                    <p className="font-mono text-[10px] text-text-muted">{r.label}</p>
                    <p className="font-mono text-[10px] text-text-muted">{r.value}</p>
                  </div>
                ))}
              </div>
            </Sub>

            <Sub title="Layout Constants">
              <TokenTable
                rows={[
                  { token: "--sidebar-width", value: "230px" },
                  { token: "--topbar-height", value: "56px" },
                  { token: "--breakpoint-sm", value: "640px" },
                  { token: "--breakpoint-md", value: "768px" },
                  { token: "--breakpoint-lg", value: "1024px" },
                  { token: "--breakpoint-xl", value: "1280px" },
                  { token: "--breakpoint-2xl", value: "1536px" },
                ]}
              />
            </Sub>
          </Section>

          {/* ═══════════════════════════════════════════════════════════════
              06 · EFFECTS
              ═══════════════════════════════════════════════════════════════ */}
          <Section id="effects" number="06" title="Efeitos" description="Sistema de elevação, focus rings, transições e glassmorfismo.">
            <Sub title="Sombras">
              <div className="grid gap-6 sm:grid-cols-3">
                {[
                  { label: "Card", val: "0 2px 8px rgba(0,0,0,0.4)" },
                  { label: "Elevated", val: "0 8px 24px rgba(0,0,0,0.5)" },
                  { label: "Hero", val: "0 16px 48px rgba(0,0,0,0.6)" },
                ].map((s) => (
                  <div key={s.label} className="space-y-3 text-center">
                    <div className="mx-auto h-24 w-full max-w-[200px] rounded-xl bg-bg-card" style={{ boxShadow: s.val }} />
                    <p className="text-xs font-medium">{s.label}</p>
                    <p className="font-mono text-[10px] text-text-muted">{s.val}</p>
                  </div>
                ))}
              </div>
            </Sub>

            <Sub title="Focus Ring">
              <Demo>
                <div className="flex items-center gap-6">
                  <button
                    type="button"
                    className="rounded-xl shadow-card bg-bg-card px-4 py-2 text-sm ring-2 ring-cerrado-600 ring-offset-2 ring-offset-bg-app"
                  >
                    Focus visible
                  </button>
                  <div className="text-xs text-text-muted">
                    <p>Color: <span className="font-mono text-cerrado-400">#2a6ab0</span></p>
                    <p>Width: 2px · Offset: 2px</p>
                  </div>
                </div>
              </Demo>
            </Sub>

            <Sub title="Z-Index">
              <div className="flex flex-wrap gap-3">
                {[
                  { label: "base", value: 0 },
                  { label: "sticky", value: 10 },
                  { label: "sidebar", value: 20 },
                  { label: "dropdown", value: 30 },
                  { label: "modal", value: 40 },
                  { label: "toast", value: 50 },
                ].map((z) => (
                  <GlassPanel key={z.label} padding="sm" className="min-w-[80px] text-center">
                    <p className="text-xs font-medium">{z.label}</p>
                    <p className="font-mono text-[10px] text-text-muted">{z.value}</p>
                  </GlassPanel>
                ))}
              </div>
            </Sub>

            <Sub title="Transições">
              <div className="flex flex-wrap gap-3">
                <Badge>Fast — 150ms</Badge>
                <Badge>Normal — 200ms</Badge>
                <Badge>Slow — 300ms</Badge>
              </div>
              <TokenTable
                rows={[
                  { token: "--ease-default", value: "ease" },
                  { token: "--ease-out", value: "ease-out" },
                  { token: "--ease-in-out", value: "ease-in-out" },
                ]}
              />
            </Sub>

            <Sub title="Glass Panel">
              <GlassPanel glow="teal" padding="lg">
                <div className="text-center space-y-2">
                  <p className="text-sm font-semibold">Glassmorfismo</p>
                  <p className="text-xs text-text-secondary max-w-md mx-auto">
                    Painéis com <code className="font-mono text-varzea-light">backdrop-blur-xl</code>,{" "}
                    <code className="font-mono text-varzea-light">bg-surface/60</code> e{" "}
                    <code className="font-mono text-varzea-light">border-border-subtle</code>.
                    Glow opcional via shadow com cor do accent.
                  </p>
                </div>
              </GlassPanel>
            </Sub>
          </Section>

          {/* ═══════════════════════════════════════════════════════════════
              07 · ATOMS
              ═══════════════════════════════════════════════════════════════ */}
          <Section id="atoms" number="07" title="Atoms" description="Elementos fundamentais e indivisíveis. Cada atom é um building block do design system.">
            {/* Button */}
            <Sub title="Button">
              <Demo label="Variants">
                <div className="flex flex-wrap gap-3">
                  <Button>Default</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="link">Link</Button>
                </div>
              </Demo>
              <Demo label="Sizes">
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm">Small</Button>
                  <Button>Default</Button>
                  <Button size="lg">Large</Button>
                  <Button size="icon"><Plus className="h-4 w-4" /></Button>
                </div>
              </Demo>
              <Demo label="States">
                <div className="flex flex-wrap items-center gap-3">
                  <Button>Normal</Button>
                  <Button disabled>Disabled</Button>
                  <Button isLoading>Loading</Button>
                </div>
              </Demo>
              <Code>{`<Button variant="default" size="default">Click me</Button>
<Button variant="outline" isLoading>Saving...</Button>
<Button size="icon"><Plus className="h-4 w-4" /></Button>`}</Code>
            </Sub>

            {/* Input */}
            <Sub title="Input">
              <Demo label="Sizes & States">
                <div className="max-w-md space-y-3">
                  <Input inputSize="sm" placeholder="Small input" />
                  <Input placeholder="Default input" />
                  <Input inputSize="lg" placeholder="Large input" />
                  <Input placeholder="With error" error />
                  <Input placeholder="Disabled" disabled />
                  <Input placeholder="Search..." leadingIcon={<Search className="h-4 w-4" />} />
                </div>
              </Demo>
            </Sub>

            {/* Badge */}
            <Sub title="Badge">
              <Demo>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge>Default</Badge>
                    <Badge variant="success">Success</Badge>
                    <Badge variant="warning">Warning</Badge>
                    <Badge variant="error">Error</Badge>
                    <Badge variant="info">Info</Badge>
                    <Badge variant="draft">Draft</Badge>
                    <Badge variant="archived">Archived</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge badgeSize="sm">Small</Badge>
                    <Badge>Default</Badge>
                  </div>
                </div>
              </Demo>
            </Sub>

            {/* Label & Textarea */}
            <Sub title="Label & Textarea">
              <Demo>
                <div className="max-w-md space-y-2">
                  <Label>Descrição do curso</Label>
                  <Textarea placeholder="Descreva o conteúdo do curso..." />
                </div>
              </Demo>
            </Sub>

            {/* Toggle & Switch */}
            <Sub title="Toggle & Switch">
              <Demo>
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-3">
                    <Toggle checked={toggleVal} onCheckedChange={setToggleVal} />
                    <Label>Toggle {toggleVal ? "on" : "off"}</Label>
                  </div>
                  <Separator orientation="vertical" className="h-6" />
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Switch size="sm" checked={switchVal} onCheckedChange={setSwitchVal} />
                      <Label>Small</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={switchVal} onCheckedChange={setSwitchVal} />
                      <Label>Default</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch size="lg" checked={switchVal} onCheckedChange={setSwitchVal} />
                      <Label>Large</Label>
                    </div>
                  </div>
                </div>
              </Demo>
            </Sub>

            {/* Checkbox & Radio */}
            <Sub title="Checkbox & RadioGroup">
              <Demo>
                <div className="flex flex-wrap gap-12">
                  <div className="space-y-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">Checkbox</p>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={checkVal} onCheckedChange={setCheckVal} />
                      <Label>Aceito os termos</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked disabled />
                      <Label>Checked disabled</Label>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">RadioGroup</p>
                    <RadioGroup value={radioVal} onValueChange={setRadioVal}>
                      <div className="flex items-center gap-2"><RadioItem value="opt-1" /><Label>Opção 1</Label></div>
                      <div className="flex items-center gap-2"><RadioItem value="opt-2" /><Label>Opção 2</Label></div>
                      <div className="flex items-center gap-2"><RadioItem value="opt-3" /><Label>Opção 3</Label></div>
                    </RadioGroup>
                  </div>
                </div>
              </Demo>
            </Sub>

            {/* Select */}
            <Sub title="Select">
              <Demo>
                <div className="max-w-xs">
                  <Select>
                    <option value="">Selecione um curso...</option>
                    <option value="1">Fundamentos de IA</option>
                    <option value="2">Machine Learning</option>
                    <option value="3">Deep Learning</option>
                  </Select>
                </div>
              </Demo>
            </Sub>

            {/* ProgressBar */}
            <Sub title="ProgressBar">
              <Demo>
                <div className="max-w-md space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-text-secondary">
                      <span>Progresso do módulo</span>
                      <span>{progress}%</span>
                    </div>
                    <ProgressBar value={progress} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setProgress(Math.max(0, progress - 10))}>−10</Button>
                    <Button size="sm" variant="ghost" onClick={() => setProgress(Math.min(100, progress + 10))}>+10</Button>
                  </div>
                </div>
              </Demo>
            </Sub>

            {/* Avatar */}
            <Sub title="Avatar">
              <Demo>
                <div className="flex items-center gap-4">
                  <Avatar src="https://api.dicebear.com/9.x/initials/svg?seed=HC" alt="Hugo" size="sm" fallback="HC" />
                  <Avatar src="https://api.dicebear.com/9.x/initials/svg?seed=HC" alt="Hugo" fallback="HC" />
                  <Avatar src="https://api.dicebear.com/9.x/initials/svg?seed=HC" alt="Hugo" size="lg" fallback="HC" />
                  <Avatar fallback="HC" />
                  <Avatar fallback="?" size="lg" />
                </div>
              </Demo>
            </Sub>

            {/* Separator, Skeleton, Kbd */}
            <Sub title="Separator">
              <Demo>
                <div className="space-y-4">
                  <p className="text-sm text-text-secondary">Acima do separador</p>
                  <Separator />
                  <p className="text-sm text-text-secondary">Abaixo do separador</p>
                </div>
              </Demo>
            </Sub>

            <Sub title="Skeleton">
              <Demo>
                <div className="max-w-sm space-y-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="mt-4 flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-1/3" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                </div>
              </Demo>
            </Sub>

            {/* Alert */}
            <Sub title="Alert">
              <Demo>
                <div className="max-w-lg space-y-3">
                  <Alert>
                    <AlertTitle>Default</AlertTitle>
                    <AlertDescription>Informação neutra para o usuário.</AlertDescription>
                  </Alert>
                  <Alert variant="info">
                    <AlertTitle>Info</AlertTitle>
                    <AlertDescription>Novo módulo disponível no seu curso.</AlertDescription>
                  </Alert>
                  <Alert variant="success">
                    <AlertTitle>Sucesso</AlertTitle>
                    <AlertDescription>Módulo concluído com 95% de aproveitamento.</AlertDescription>
                  </Alert>
                  <Alert variant="warning">
                    <AlertTitle>Atenção</AlertTitle>
                    <AlertDescription>Prazo de entrega em 2 dias.</AlertDescription>
                  </Alert>
                  <Alert variant="error">
                    <AlertTitle>Erro</AlertTitle>
                    <AlertDescription>Falha ao salvar progresso. Tente novamente.</AlertDescription>
                  </Alert>
                </div>
              </Demo>
            </Sub>

            <Sub title="Kbd">
              <Demo>
                <div className="flex flex-wrap items-center gap-2">
                  <Kbd>⌘</Kbd><Kbd>K</Kbd>
                  <span className="mx-2 text-sm text-text-muted">—</span>
                  <Kbd>Ctrl</Kbd><span className="text-text-muted">+</span><Kbd>S</Kbd>
                  <span className="mx-2 text-sm text-text-muted">—</span>
                  <Kbd>Esc</Kbd>
                  <span className="mx-2 text-sm text-text-muted">—</span>
                  <Kbd>↑</Kbd><Kbd>↓</Kbd><Kbd>←</Kbd><Kbd>→</Kbd>
                </div>
              </Demo>
            </Sub>
          </Section>

          {/* ═══════════════════════════════════════════════════════════════
              08 · MOLECULES
              ═══════════════════════════════════════════════════════════════ */}
          <Section id="molecules" number="08" title="Molecules" description="Composições funcionais de atoms que formam blocos de interface reutilizáveis.">
            <Sub title="Tabs">
              <Demo>
                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList>
                    <TabsTrigger value="tab-1">Visão Geral</TabsTrigger>
                    <TabsTrigger value="tab-2">Conteúdo</TabsTrigger>
                    <TabsTrigger value="tab-3">Alunos</TabsTrigger>
                  </TabsList>
                  <TabsContent value="tab-1">
                    <p className="pt-4 text-sm text-text-secondary">Resumo do curso com métricas principais.</p>
                  </TabsContent>
                  <TabsContent value="tab-2">
                    <p className="pt-4 text-sm text-text-secondary">Módulos, aulas e materiais do curso.</p>
                  </TabsContent>
                  <TabsContent value="tab-3">
                    <p className="pt-4 text-sm text-text-secondary">Lista de alunos matriculados e progresso.</p>
                  </TabsContent>
                </Tabs>
              </Demo>
            </Sub>

            <Sub title="Accordion">
              <Demo>
                <div className="max-w-lg">
                  <Accordion value={accordion} onValueChange={setAccordion} type="single">
                    <AccordionItem value="item-1">
                      <AccordionTrigger>Como funciona a IA socrática?</AccordionTrigger>
                      <AccordionContent>
                        A IA socrática faz perguntas progressivas para guiar o aluno ao entendimento, em vez de fornecer respostas diretas.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                      <AccordionTrigger>Quais perfis de aprendizagem são suportados?</AccordionTrigger>
                      <AccordionContent>
                        Kolb, DISC, Eneagrama, Big Five, Inteligências Múltiplas e Âncoras de Carreira.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-3">
                      <AccordionTrigger>O sistema suporta multi-tenant?</AccordionTrigger>
                      <AccordionContent>
                        Sim. Cada tenant pode ter branding customizado, configurações de SSO e área exclusiva.
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </Demo>
            </Sub>

            <Sub title="FormField">
              <Demo>
                <div className="max-w-md space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bb-name">Nome completo</Label>
                    <Input id="bb-name" placeholder="Digite seu nome" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bb-email">Email</Label>
                    <Input id="bb-email" type="email" placeholder="seu@email.com" />
                    <p className="text-2xs text-text-muted">Será usado para login na plataforma.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bb-bio">Bio</Label>
                    <Textarea id="bb-bio" placeholder="Conte um pouco sobre você..." />
                  </div>
                </div>
              </Demo>
            </Sub>

            <Sub title="ScrollArea">
              <Demo>
                <ScrollArea className="h-48 rounded-xl shadow-card p-4">
                  <div className="space-y-3">
                    {Array.from({ length: 15 }, (_, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg bg-bg-card p-3 shadow-card">
                        <Avatar fallback={String(i + 1)} size="sm" />
                        <div>
                          <p className="text-sm font-medium">Item {i + 1}</p>
                          <p className="text-2xs text-text-muted">Descrição do item na lista scrollável</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </Demo>
            </Sub>

            <Sub title="Card">
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Card Estático</CardTitle>
                    <CardDescription>Usado para exibir informações</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-text-secondary">Conteúdo do card sem interação de hover.</p>
                  </CardContent>
                  <CardFooter>
                    <Button size="sm" variant="ghost">Ação</Button>
                  </CardFooter>
                </Card>
                <Card interactive>
                  <CardHeader>
                    <CardTitle>Card Interativo</CardTitle>
                    <CardDescription>Hover para ver o efeito de elevação</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-text-secondary">Card clicável com elevação, translate e ring no hover.</p>
                  </CardContent>
                </Card>
              </div>
            </Sub>
          </Section>

          {/* ═══════════════════════════════════════════════════════════════
              09 · ORGANISMS
              ═══════════════════════════════════════════════════════════════ */}
          <Section id="organisms" number="09" title="Organisms" description="Seções complexas de interface compostas por atoms e molecules. Inclui componentes de overlay interativos.">
            {/* StatCard */}
            <Sub title="StatCard">
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Alunos ativos" value="1.247" trend="up" trendValue="+12%" />
                <StatCard label="Taxa de conclusão" value="73%" trend="up" trendValue="+5%" />
                <StatCard label="NPS" value="87" trend="down" trendValue="-2%" />
              </div>
            </Sub>

            {/* EmptyState */}
            <Sub title="EmptyState">
              <Demo>
                <EmptyState
                  title="Nenhum curso encontrado"
                  description="Crie seu primeiro curso para começar."
                  actionLabel="Criar curso"
                  onAction={() => {}}
                />
              </Demo>
            </Sub>

            {/* Table */}
            <Sub title="Table">
              <Demo padding="none" className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className=" bg-bg-app/50 text-left">
                        <th className="px-6 py-3 font-mono text-[10px] uppercase tracking-wider text-text-muted">Aluno</th>
                        <th className="px-6 py-3 font-mono text-[10px] uppercase tracking-wider text-text-muted">Curso</th>
                        <th className="px-6 py-3 font-mono text-[10px] uppercase tracking-wider text-text-muted">Progresso</th>
                        <th className="px-6 py-3 font-mono text-[10px] uppercase tracking-wider text-text-muted">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y ">
                      {[
                        { name: "Maria Silva", course: "Fundamentos de IA", progress: 85, status: "Ativo", variant: "success" as const },
                        { name: "João Santos", course: "Machine Learning", progress: 42, status: "Em progresso", variant: "info" as const },
                        { name: "Ana Oliveira", course: "Deep Learning", progress: 100, status: "Concluído", variant: "success" as const },
                        { name: "Carlos Lima", course: "NLP Avançado", progress: 15, status: "Iniciando", variant: "draft" as const },
                      ].map((row) => (
                        <tr key={row.name} className="transition-colors hover:bg-bg-surface/30">
                          <td className="px-6 py-3 font-medium">{row.name}</td>
                          <td className="px-6 py-3 text-text-secondary">{row.course}</td>
                          <td className="px-6 py-3"><ProgressBar value={row.progress} className="w-24" /></td>
                          <td className="px-6 py-3"><Badge variant={row.variant} badgeSize="sm">{row.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Demo>
            </Sub>

            {/* Modal */}
            <Sub title="Modal">
              <Demo>
                <div className="flex items-center gap-4">
                  <Button onClick={() => setModalOpen(true)}>Abrir Modal</Button>
                  <p className="text-xs text-text-muted">Tamanhos: sm · md · lg · xl</p>
                </div>
              </Demo>

              <Modal open={modalOpen} onOpenChange={setModalOpen}>
                <ModalContent>
                  <ModalHeader>
                    <ModalTitle>Confirmar ação</ModalTitle>
                    <ModalDescription>
                      Tem certeza que deseja prosseguir? Esta ação pode ser revertida.
                    </ModalDescription>
                  </ModalHeader>
                  <ModalFooter>
                    <ModalClose>Cancelar</ModalClose>
                    <Button onClick={() => setModalOpen(false)}>Confirmar</Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            </Sub>

            {/* Overlay descriptions */}
            <Sub title="Sheet & Toast">
              <div className="grid gap-4 sm:grid-cols-2">
                <GlassPanel>
                  <p className="text-sm font-semibold mb-2">Sheet</p>
                  <p className="text-2xs text-text-secondary mb-3">Painel lateral deslizante com overlay. Suporta posições: left, right, top, bottom.</p>
                  <Code copyable={false}>{`<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>Título</SheetTitle>
    </SheetHeader>
    {/* conteúdo */}
  </SheetContent>
</Sheet>`}</Code>
                </GlassPanel>
                <GlassPanel>
                  <p className="text-sm font-semibold mb-2">Toast</p>
                  <p className="text-2xs text-text-secondary mb-3">Notificação temporária com auto-dismiss (5s default). Variantes: default, success, error, warning, info.</p>
                  <Code copyable={false}>{`const { toast } = useToast()

toast({
  variant: "success",
  title: "Salvo!",
  description: "Progresso atualizado.",
})`}</Code>
                </GlassPanel>
              </div>
            </Sub>

            {/* Sidebar & TopBar */}
            <Sub title="Sidebar & TopBar">
              <div className="grid gap-4 sm:grid-cols-2">
                <GlassPanel>
                  <p className="text-sm font-semibold mb-2">Sidebar</p>
                  <p className="text-2xs text-text-muted mb-3">Navegação lateral com seções, items e labels. Largura: 230px. Suporta collapse.</p>
                  <div className="rounded-lg bg-bg-sidebar p-3 shadow-card">
                    <div className="space-y-0.5">
                      {[
                        { label: "Dashboard", icon: Home, active: true },
                        { label: "Cursos", icon: BookOpen, active: false },
                        { label: "Alunos", icon: Users, active: false },
                        { label: "Analytics", icon: BarChart3, active: false },
                        { label: "Configurações", icon: Settings, active: false },
                      ].map((item) => {
                        const Icon = item.icon
                        return (
                          <div key={item.label} className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors ${item.active ? "bg-cerrado-600/15 font-medium text-cerrado-400" : "text-text-secondary"}`}>
                            {item.active && <div className="absolute left-0 h-4 w-[3px] rounded-r-full bg-cerrado-400" />}
                            <Icon className="h-3.5 w-3.5" />
                            {item.label}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </GlassPanel>
                <GlassPanel>
                  <p className="text-sm font-semibold mb-2">TopBar</p>
                  <p className="text-2xs text-text-muted mb-3">Barra superior com áreas left, center, right. Altura: 56px.</p>
                  <div className="flex items-center justify-between rounded-lg bg-bg-surface p-3 shadow-card">
                    <div className="flex items-center gap-1.5 text-2xs text-text-muted">
                      <Home className="h-3 w-3" />
                      <ChevronRight className="h-3 w-3" />
                      <span>Cursos</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-bg-card px-2.5 py-1.5 shadow-card">
                      <Search className="h-3 w-3 text-text-muted" />
                      <span className="text-2xs text-text-muted">Buscar...</span>
                      <Kbd>⌘K</Kbd>
                    </div>
                    <Avatar fallback="HC" size="sm" />
                  </div>
                </GlassPanel>
              </div>
            </Sub>

            {/* Chat */}
            <Sub title="Chat (IA Socrática)">
              <Demo>
                <div className="mx-auto max-w-lg space-y-3">
                  <div className="flex gap-3">
                    <Avatar fallback="IA" size="sm" />
                    <div className="rounded-xl rounded-tl-sm bg-bg-surface p-3 shadow-card">
                      <p className="text-sm text-text-secondary">
                        O que você entende por &quot;gradient descent&quot; no contexto de redes neurais?
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-row-reverse gap-3">
                    <Avatar fallback="HC" size="sm" />
                    <div className="rounded-xl rounded-tr-sm bg-cerrado-800 p-3 ring-1 ring-cerrado-500/20">
                      <p className="text-sm">É o algoritmo que ajusta os pesos da rede para minimizar o erro, certo?</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Avatar fallback="IA" size="sm" />
                    <div className="rounded-xl rounded-tl-sm bg-bg-surface p-3 shadow-card">
                      <p className="text-sm text-text-secondary">
                        Exatamente! E como ele &quot;sabe&quot; para qual direção ajustar os pesos?
                      </p>
                    </div>
                  </div>
                </div>
              </Demo>
            </Sub>
          </Section>

          {/* ═══════════════════════════════════════════════════════════════
              10 · PATTERNS
              ═══════════════════════════════════════════════════════════════ */}
          <Section id="patterns" number="10" title="Padrões" description="Arquitetura atômica, convenções de código e stack tecnológico.">
            <Sub title="Arquitetura Atômica (Brad Frost)">
              <div className="grid gap-4 sm:grid-cols-5">
                {[
                  { level: "Atoms", count: 20, desc: "Indivisíveis", color: "bg-cerrado-600/10 text-cerrado-400 ring-cerrado-600/20" },
                  { level: "Molecules", count: 8, desc: "Composições", color: "bg-varzea/10 text-varzea-light ring-varzea/20" },
                  { level: "Organisms", count: 14, desc: "Seções", color: "bg-accent-gold/10 text-accent-gold-light ring-accent-gold/20" },
                  { level: "Templates", count: 3, desc: "Layouts", color: "bg-accent-purple/10 text-accent-purple ring-accent-purple/20" },
                  { level: "Pages", count: 22, desc: "Instâncias", color: "bg-accent-green/10 text-accent-green ring-accent-green/20" },
                ].map((l) => (
                  <GlassPanel key={l.level} className={`text-center ring-1 ${l.color}`}>
                    <p className="text-2xl font-bold">{l.count}</p>
                    <p className="text-sm font-semibold">{l.level}</p>
                    <p className="mt-1 text-2xs opacity-70">{l.desc}</p>
                  </GlassPanel>
                ))}
              </div>
            </Sub>

            <Sub title="Padrão de Componente">
              <Code>{`// 1. CVA variant definition
const buttonVariants = cva("base-styles", {
  variants: {
    variant: { default: "...", outline: "..." },
    size: { sm: "h-8", default: "h-10", lg: "h-12" },
  },
  defaultVariants: { variant: "default", size: "default" },
})

// 2. Interface extends HTML + CVA
interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

// 3. forwardRef implementation
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
)

// 4. Export component + variants
export { Button, buttonVariants, type ButtonProps }`}</Code>
            </Sub>

            <Sub title="Importação">
              <Code>{`// Componentes
import { Button, Input, Badge, Card } from "@eximia/ui"

// Tokens (TypeScript)
import { tokens, colors } from "@eximia/ui"

// Utilitários
import { cn } from "@eximia/ui"`}</Code>
            </Sub>

            <Sub title="Stack Tecnológico">
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {[
                  { name: "Next.js 15", desc: "Framework React", icon: Monitor },
                  { name: "React 19", desc: "UI Library", icon: Zap },
                  { name: "TypeScript 5.7", desc: "Type safety", icon: Settings },
                  { name: "Tailwind CSS v4", desc: "@theme CSS-first", icon: Palette },
                  { name: "CVA", desc: "Class Variance Authority", icon: Layers },
                  { name: "pnpm", desc: "Package manager", icon: Box },
                ].map((tech) => {
                  const Icon = tech.icon
                  return (
                    <GlassPanel key={tech.name}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-varzea/10">
                          <Icon className="h-4 w-4 text-varzea" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{tech.name}</p>
                          <p className="text-2xs text-text-muted">{tech.desc}</p>
                        </div>
                      </div>
                    </GlassPanel>
                  )
                })}
              </div>
            </Sub>
          </Section>

          {/* ═══ FOOTER ═══ */}
          <div className=" pt-12">
            <div className="text-center space-y-3">
              <img
                src="/logos/argos-academy-color.png"
                alt="Argos Academy"
                className="mx-auto h-8 opacity-40"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
              />
              <div className="h-0.5 mx-auto w-8 rounded-full bg-varzea/30" />
              <p className="text-sm text-text-secondary">
                Argos Academy by exímIA — Design System <span className="text-text-muted">v{DS_VERSION}</span>
              </p>
              <p className="font-mono text-[10px] text-text-muted">
                Overlens · Brandbook v{BB_VERSION} · Brad Frost Atomic Design · {new Date().getFullYear()}
              </p>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export default function BrandbookPage() {
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem("bb-auth") === "1") {
      setAuthenticated(true)
    }
  }, [])

  if (!authenticated) {
    return <PasswordGate onAuth={() => setAuthenticated(true)} />
  }

  return <BrandbookContent />
}
