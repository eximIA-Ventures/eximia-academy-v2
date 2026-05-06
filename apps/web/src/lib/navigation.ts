import {
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  ClipboardCheck,
  Compass,
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
  Webhook,
} from "lucide-react"
import {
  type ModuleId,
  type ModuleNavEntry,
  type Role,
  buildNavigation,
} from "@eximia/shared"

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
  HelpCircle,
  Key,
  Library,
  Mail,
  Plug,
  Settings,
  Shield,
  Sparkles,
  Users,
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

// ---------------------------------------------------------------------------
// Build navigation from module registry (replaces hardcoded navigationByRole)
// ---------------------------------------------------------------------------

/**
 * Builds resolved navigation entries for a role + set of enabled modules.
 * Replaces the old `navigationByRole` static object.
 */
export function getNavigation(enabledModules: ModuleId[], role: NavRole): NavEntry[] {
  const raw = buildNavigation(enabledModules, role)

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

export const bottomNav: NavItem[] = [
  { label: "Central de ajuda", href: "/help", icon: HelpCircle },
]
