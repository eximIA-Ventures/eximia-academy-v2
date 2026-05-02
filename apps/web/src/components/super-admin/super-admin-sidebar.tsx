"use client"

import { signOut } from "@/lib/actions/auth"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarItem, SidebarSection } from "@eximia/ui"
import { Building2, FileText, LayoutDashboard, LogOut, Plug, Shield } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
  { href: "/super-admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/super-admin/tenants", label: "Empresas", icon: Building2 },
  { href: "/super-admin/integrations", label: "Integrações", icon: Plug },
  { href: "/super-admin/audit", label: "Auditoria", icon: FileText },
]

export function SuperAdminSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsed={false} className="-translate-x-full md:relative md:translate-x-0">
      <SidebarHeader>
        <Link href="/super-admin/dashboard" className="flex items-center gap-3.5">
          {/* Symbol with glow */}
          <div className="relative">
            <div className="absolute inset-0 rounded-xl bg-purple-500/10 blur-lg" />
            <svg
              viewBox="0 0 120.4 136.01"
              xmlns="http://www.w3.org/2000/svg"
              className="relative h-8 w-8 shrink-0"
            >
              <path d="M58.88,132.06c0,2.84,2.96,4.72,5.53,3.5l51-24.09c3.04-1.44,4.99-4.51,4.98-7.89l-.02-23.87v-1.81s-.06-60.95-.06-60.95c0-3.57-2.31-6.73-5.72-7.81L87.3.46c-5.29-1.68-10.7,2.27-10.69,7.83l.04,38.51c.01,11.07,7.12,20.88,17.63,24.32l23.61,7.78-53.28,21.38c-3.48,1.39-5.75,4.77-5.75,8.51l.02,23.27Z" fill="white" />
              <path d="M61.33,3.85c-.02-2.84-2.99-4.7-5.56-3.47L4.93,24.8C1.9,26.27-.02,29.35,0,32.73l.18,23.87v1.81s.47,60.94.47,60.94c.03,3.57,2.36,6.71,5.77,7.77l27.35,8.51c5.3,1.65,10.68-2.34,10.64-7.89l-.29-38.51c-.08-11.07-7.26-20.83-17.79-24.21l-23.66-7.62,53.14-21.73c3.47-1.42,5.72-4.8,5.69-8.55l-.17-23.27Z" fill="white" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-bold leading-none tracking-tight text-white">exímIA</span>
            <div className="mt-1 flex items-center gap-0">
              <span className="text-[10px] font-black leading-none tracking-[0.25em] uppercase text-purple-400">Super Admin</span>
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarSection>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href}>
                <SidebarItem isActive={isActive}>
                  <Icon size={18} strokeWidth={isActive ? 2 : 1.5} className={isActive ? "text-accent-blue-light" : ""} />
                  <span>{item.label}</span>
                </SidebarItem>
              </Link>
            )
          })}
        </SidebarSection>
      </SidebarContent>

      <SidebarFooter>
        <div className="mb-3 h-px bg-white/[0.06]" />
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#777] rounded-lg transition-colors hover:bg-white/[0.06] hover:text-[#bbb]"
          >
            <LogOut size={18} strokeWidth={1.5} />
            <span>Sair</span>
          </button>
        </form>
      </SidebarFooter>
    </Sidebar>
  )
}
