import { QueryProvider } from "@/components/providers/query-provider"
import { SuperAdminSidebar } from "@/components/super-admin/super-admin-sidebar"
import { getAuthProfile } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile } = await getAuthProfile()

  if (!user) {
    redirect("/login")
  }

  if (!profile || profile.role !== "super_admin") {
    redirect("/login")
  }

  return (
    <QueryProvider>
      <div className="flex h-screen bg-bg-app font-sans text-text-primary">
        <SuperAdminSidebar />
        <div className="flex flex-1 flex-col">
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </QueryProvider>
  )
}
