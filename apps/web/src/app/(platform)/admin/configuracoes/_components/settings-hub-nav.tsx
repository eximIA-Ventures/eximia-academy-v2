"use client"

import {
  Bell,
  Blocks,
  Briefcase,
  Building2,
  CreditCard,
  FileText,
  KeyRound,
  LayoutGrid,
  Lock,
  type LucideIcon,
  Mail,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  UsersRound,
  Webhook,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

/**
 * Sidebar do hub de Configurações.
 *
 * 16 seções em 4 grupos, espelhando os `data-panel` do mockup
 * (`JARVIS/apps/hub-discovery/configuracoes-hub.html`). Os itens ainda não
 * construídos são NÃO-clicáveis, em cinza, com a pílula de indisponibilidade —
 * nunca `<Link>`, e sem arquivo de rota (não gera 404 nem guard duplicado).
 *
 * Fase 1: 5 vivas, 11 em cinza.
 * Fase 2 (rodada 7, "ajuste vai para o hub"): +4 vivas — "Grupos de gestores",
 * "Segurança & Sessão", "Auditoria" e "Plano & Cobrança" saíram da barra do
 * mundo admin e viraram seções daqui. Total: **9 vivas, 7 em cinza**.
 */

/**
 * A pílula da direita, compartilhada pelas duas semânticas da coluna.
 *
 * CFG-4.1 (AC1) — "Marca & Aparência" precisa avisar ANTES do clique que o plano
 * não cobre whitelabel; a sub-rota já trata o caso, a barra não avisava. Extrair
 * a pílula em vez de copiá-la mantém geometria, raio e tipografia idênticos nas
 * duas: a folga de 8px conquistada na rodada 8 (`px-1.5`) vale para as duas sem
 * ninguém precisar lembrar de replicá-la.
 *
 * O que MUDA entre as duas é só a rampa do texto, e muda de propósito:
 * - `soon` fica em `text-text-muted` — ali o cinza baixo É a informação
 *   (indisponível), exatamente como o comentário do `HubGroup` registra.
 * - `plan` fica em `text-text-secondary` — este item continua CLICÁVEL, então
 *   herdar o cinza de "desabilitado" mentiria sobre o estado e ainda mediria
 *   2.96:1 no tema escuro. `text-text-secondary` é a parada imediatamente acima
 *   na MESMA rampa neutra (6.16:1 escuro / 9.23:1 claro), nenhuma cor nova.
 */
function HubPill({ label, tone }: { label: string; tone: "soon" | "plan" }) {
  return (
    <span
      className={`ml-auto shrink-0 rounded-full bg-bg-app px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        tone === "soon" ? "text-text-muted" : "text-text-secondary"
      }`}
    >
      {label}
    </span>
  )
}

function HubItem({
  icon: Icon,
  label,
  href,
  pill,
}: {
  icon: LucideIcon
  label: string
  href: string
  /** Selo de plano (CFG-4.1). O item permanece um `<Link>` real, nunca bloqueado. */
  pill?: string
}) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(`${href}/`)

  // `gap-2` (e não `gap-2.5`) para casar com o item em cinza, que precisou dos
  // 2px por folga para o rótulo mais longo caber — ver `HubItemSoon`. As duas
  // variantes se alternam na MESMA coluna, então o respiro ícone/rótulo tem de
  // ser o mesmo nas duas.
  //
  // RODADA 12 (E2) — o item ativo daqui saía com o laranja do mundo Padrão
  // chumbado em fundo, texto e ícone, medido em pixel `rgb(222,97,41)`: dentro
  // do hub, que só existe em `/admin/*` (mundo TEAL), conviviam DUAS barras na
  // mesma tela — a externa com item ativo teal e esta com item ativo LARANJA.
  // Agora o acento vem do mundo, como na barra de fora (`SidebarItem`, rodada
  // 10). O ícone é `currentColor`, então segue junto sem classe própria.
  // Medido depois: 6.91:1 (claro) e 5.66:1 (escuro).
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-[color-mix(in_oklab,var(--world-accent)_10%,transparent)] font-semibold text-[var(--world-accent)]"
          : "text-text-secondary hover:bg-bg-app hover:text-text-primary"
      }`}
    >
      <Icon size={15} className="shrink-0" />
      <span className="truncate">{label}</span>
      {pill && <HubPill label={pill} tone="plan" />}
    </Link>
  )
}

function HubItemSoon({
  icon: Icon,
  label,
  pill,
}: {
  icon: LucideIcon
  label: string
  /** Rótulo da pílula de indisponibilidade, declarado item a item. */
  pill: string
}) {
  return (
    <span
      aria-disabled="true"
      className="flex cursor-not-allowed items-center gap-2 rounded-xl px-3 py-2 text-sm text-text-muted/60"
    >
      <Icon size={15} className="shrink-0" />
      <span className="truncate">{label}</span>
      {/* CORREÇÃO DE AUDITORIA (rodada 8) — "Perfis & Permissões" truncava por
          3px (scrollWidth 132 x clientWidth 129) em 1440 e 1280: um item que
          deveria estar apenas cinza estava também cortado. A largura da coluna
          (`lg:w-72` no layout do hub) NÃO foi tocada de propósito — mexer nela
          reflui a coluna de conteúdo de TODAS as 16 seções. O espaço saiu de
          dentro da própria linha, onde o efeito colateral morre: `gap-2` no
          lugar de `gap-2.5` (2 folgas x 2px) e `px-1.5` na pílula (2 x 2px),
          somando 8px para o rótulo. A pílula "Em breve" continua com a mesma
          altura, mesmo raio e mesma tipografia. */}
      <HubPill label={pill} tone="soon" />
    </span>
  )
}

function HubGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      {/* RODADA 12 (E3) — o rótulo de grupo saía `text-text-muted`, que sobre o
          `bg-bg-card` da coluna mede 2.96:1 no tema escuro (#636363 sobre
          #1b1716) — abaixo do piso AA de 4.5:1. `text-text-secondary` é a
          parada imediatamente acima na MESMA rampa neutra (nenhuma cor nova,
          nenhum peso/tamanho alterado): mede 6.16:1 no escuro e 9.23:1 no
          claro. A pílula "Em breve" do `HubItemSoon` continua em `text-muted`
          de propósito: ali o cinza baixo É a informação (indisponível), e ela
          não é rótulo estrutural de navegação. */}
      <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-text-secondary">
        {label}
      </p>
      {children}
    </div>
  )
}

export function SettingsHubNav({
  /**
   * CFG-4.1 (AC1). Vem do MESMO gate de plano da sub-rota de marca
   * (`loadTenantSettings().tenant.whitelabelEnabled`), resolvido no `layout.tsx`
   * do hub — nenhum segundo mecanismo de gate foi inventado aqui.
   *
   * Default `true` (= sem selo) para que o item nunca ganhe uma pílula "PRO"
   * indevida quando o plano não pôde ser lido; anunciar bloqueio inexistente é
   * pior que não anunciar, e a sub-rota continua sendo a fonte de verdade.
   */
  whitelabelEnabled = true,
}: {
  whitelabelEnabled?: boolean
} = {}) {
  return (
    <nav aria-label="Seções de configurações" className="space-y-5">
      <HubGroup label="ORGANIZAÇÃO">
        <HubItem
          icon={Building2}
          label="Dados da organização"
          href="/admin/configuracoes/organizacao"
        />
        <HubItem
          icon={Palette}
          label="Marca & Aparência"
          href="/admin/configuracoes/marca"
          pill={whitelabelEnabled ? undefined : "PRO"}
        />
        <HubItem icon={LayoutGrid} label="Unidades & Áreas" href="/admin/configuracoes/unidades" />
        <HubItem icon={Briefcase} label="Cargos" href="/admin/configuracoes/cargos" />
      </HubGroup>

      <HubGroup label="PESSOAS">
        <HubItem icon={Users} label="Usuários" href="/admin/configuracoes/usuarios" />
        <HubItemSoon icon={Mail} label="Convites" pill="Em breve" />
        <HubItem icon={UsersRound} label="Grupos de gestores" href="/admin/configuracoes/grupos" />
        <HubItemSoon icon={ShieldCheck} label="Perfis & Permissões" pill="Em breve" />
      </HubGroup>

      <HubGroup label="PLATAFORMA">
        <HubItemSoon icon={SlidersHorizontal} label="Preferências" pill="Em breve" />
        <HubItemSoon icon={Bell} label="Notificações" pill="Em breve" />
        <HubItem icon={Lock} label="Segurança & Sessão" href="/admin/configuracoes/seguranca" />
        <HubItem icon={FileText} label="Auditoria" href="/admin/configuracoes/auditoria" />
      </HubGroup>

      <HubGroup label="AVANÇADO">
        <HubItemSoon icon={Blocks} label="Integrações" pill="Em breve" />
        <HubItemSoon icon={KeyRound} label="API Keys" pill="Em breve" />
        <HubItemSoon icon={Webhook} label="Webhooks" pill="Em breve" />
        <HubItem icon={CreditCard} label="Plano & Cobrança" href="/admin/configuracoes/plano" />
      </HubGroup>
    </nav>
  )
}
