import { type ModuleId, type NavContext, type Role, buildNavigation } from "@eximia/shared"
import {
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  ClipboardCheck,
  Compass,
  CreditCard,
  GraduationCap,
  HelpCircle,
  Key,
  LayoutDashboard,
  Library,
  type LucideIcon,
  Mail,
  MessageSquare,
  Play,
  Plug,
  Route,
  Settings,
  Shield,
  Sparkles,
  SquareStack,
  UserCircle,
  Users,
  UsersRound,
  Webhook,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Icon resolver — maps string names from module registry to Lucide components
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  MessageSquare,
  Compass,
  Play,
  SquareStack,
  UserCircle,
  BarChart3,
  GraduationCap,
  Route,
  BookOpen,
  Briefcase,
  Building2,
  ClipboardCheck,
  // Sem esta entrada o item "Plano & Cobrança" cairia SILENCIOSAMENTE no
  // LayoutDashboard (o fallback do resolver abaixo não quebra o build).
  CreditCard,
  HelpCircle,
  Key,
  Library,
  Mail,
  Plug,
  Settings,
  Shield,
  Sparkles,
  Users,
  UsersRound,
  Webhook,
}

// ---------------------------------------------------------------------------
// Nav types (consumed by Sidebar and other layout components)
// ---------------------------------------------------------------------------

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: string
  disabled?: boolean
  section?: undefined
}

export interface NavSection {
  section: string
  label?: undefined
  href?: undefined
  icon?: undefined
  badge?: undefined
  disabled?: undefined
}

export type NavEntry = NavItem | NavSection

export type NavRole = Role

// Re-export the canonical nav context type so layout components import it from
// a single place (E8: nav is driven by hats + active context, not a role).
export type { NavContext } from "@eximia/shared"

// ---------------------------------------------------------------------------
// Build navigation from module registry (replaces hardcoded navigationByRole)
// ---------------------------------------------------------------------------

/**
 * Builds resolved navigation entries for a nav context (hats + active context)
 * over a set of enabled modules. E8: replaces the previous single-`role`
 * signature — the active context decides which nav set renders among the ones
 * the person's capabilities allow (`personal` => student nav; `team`/`org` =>
 * highest management hat). Replaces the old `navigationByRole` static object.
 */
export function getNavigation(enabledModules: ModuleId[], navCtx: NavContext): NavEntry[] {
  const raw = buildNavigation(enabledModules, navCtx)

  return raw.map((entry): NavEntry => {
    if ("section" in entry && entry.section) {
      return { section: entry.section } as NavSection
    }
    const item = entry as { icon: string; label: string; href: string; badge?: string }
    return {
      label: item.label,
      href: item.href,
      icon: ICON_MAP[item.icon] || LayoutDashboard,
      badge: item.badge,
    } as NavItem
  })
}

// ---------------------------------------------------------------------------
// Bottom nav (static — always present)
// ---------------------------------------------------------------------------

export const bottomNav: NavItem[] = [{ label: "Central de ajuda", href: "/help", icon: HelpCircle }]
