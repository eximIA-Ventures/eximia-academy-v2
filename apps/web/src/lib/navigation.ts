import {
  BarChart3,
  BookOpen,
  Briefcase,
  ClipboardCheck,
  Compass,
  GraduationCap,
  HelpCircle,
  Key,
  LayoutDashboard,
  Library,
  MessageSquare,
  Play,
  Route,
  Settings,
  Shield,
  Sparkles,
  SquareStack,
  UserCircle,
  Users,
  Building2,
  Plug,
  Webhook,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: typeof LayoutDashboard
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

export const navigationByRole = {
  student: [
    { label: "Principal", href: "/dashboard", icon: LayoutDashboard },
    { label: "Minhas Sessões", href: "/sessions", icon: MessageSquare },
    { label: "Cursos e Trilhas", href: "/courses", icon: Compass },
    { label: "Lives", href: "/lives", icon: Play },
    { label: "Biblioteca", href: "/biblioteca", icon: Library },
    { label: "Materiais", href: "/materiais", icon: SquareStack },
    { label: "Meu Perfil", href: "/profile/learning", icon: UserCircle },
  ] satisfies NavEntry[],
  manager: [
    { section: "Aprendizado" },
    { label: "Principal", href: "/dashboard", icon: LayoutDashboard },
    { label: "Minhas Sessões", href: "/sessions", icon: MessageSquare },
    { label: "Cursos e Trilhas", href: "/courses", icon: Compass },
    { label: "Lives", href: "/lives", icon: Play },
    { label: "Biblioteca", href: "/biblioteca", icon: Library },
    { label: "Materiais", href: "/materiais", icon: SquareStack },
    { label: "Avaliações", href: "/assessments", icon: ClipboardCheck },
    { section: "Gestao" },
    { label: "Trilhas de Aprendizagem", href: "/trails", icon: Route },
    { label: "Unidades", href: "/admin/areas", icon: Building2 },
    { label: "Cargos", href: "/admin/job-roles", icon: Briefcase },
    { label: "Perfis da Equipe", href: "/team/profiles", icon: Users },
    { label: "Analytics", href: "/analytics", icon: BarChart3 },
    { label: "Usuários", href: "/admin/users", icon: Users },
  ] satisfies NavEntry[],
  admin: [
    { section: "Conteúdo" },
    { label: "Principal", href: "/dashboard", icon: LayoutDashboard },
    { label: "Cursos e Trilhas", href: "/courses", icon: GraduationCap },
    { label: "Trilhas de Aprendizagem", href: "/trails", icon: Route },
    { label: "Gerenciar Livros", href: "/admin/biblioteca", icon: BookOpen },
    { section: "Administração" },
    { label: "Unidades", href: "/admin/areas", icon: Building2 },
    { label: "Cargos", href: "/admin/job-roles", icon: Briefcase },
    { label: "Planos", href: "/admin/plans", icon: Shield },
    { label: "Analytics", href: "/analytics", icon: BarChart3 },
    { label: "Usuários", href: "/admin/users", icon: Users },
    { section: "Sistema" },
    { label: "API Keys", href: "/admin/api-keys", icon: Key },
    { label: "Integrações", href: "/admin/integrations", icon: Plug },
    { label: "Webhooks", href: "/admin/webhooks", icon: Webhook },
    { label: "Configurações", href: "/admin/settings", icon: Settings },
  ] satisfies NavEntry[],
  instructor: [
    { section: "Ensino" },
    { label: "Meu Painel", href: "/instructor", icon: LayoutDashboard },
    { label: "Cursos e Trilhas", href: "/courses", icon: GraduationCap },
    { label: "Trilhas de Aprendizagem", href: "/trails", icon: Route },
    { section: "Recursos" },
    { label: "Cargos", href: "/admin/job-roles", icon: Briefcase },
    { label: "Biblioteca", href: "/biblioteca", icon: Library },
    { label: "Analytics", href: "/analytics", icon: BarChart3 },
  ] satisfies NavEntry[],
  super_admin: [
    { section: "Conteúdo" },
    { label: "Principal", href: "/dashboard", icon: LayoutDashboard },
    { label: "Cursos e Trilhas", href: "/courses", icon: GraduationCap },
    { label: "Trilhas de Aprendizagem", href: "/trails", icon: Route },
    { label: "Gerenciar Livros", href: "/admin/biblioteca", icon: BookOpen },
    { section: "Administração" },
    { label: "Unidades", href: "/admin/areas", icon: Building2 },
    { label: "Planos", href: "/admin/plans", icon: Shield },
    { label: "Usuários", href: "/admin/users", icon: Users },
    { section: "Sistema" },
    { label: "API Keys", href: "/admin/api-keys", icon: Key },
    { label: "Integrações", href: "/admin/integrations", icon: Plug },
    { label: "Webhooks", href: "/admin/webhooks", icon: Webhook },
    { label: "Configurações", href: "/admin/settings", icon: Settings },
  ] satisfies NavEntry[],
} as const

export const bottomNav = [
  { label: "Comunidade", href: "/comunidade", icon: Sparkles },
  { label: "Central de ajuda", href: "/help", icon: HelpCircle },
] satisfies NavItem[]

export type NavRole = keyof typeof navigationByRole
