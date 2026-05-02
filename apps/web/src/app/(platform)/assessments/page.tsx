import { tenantRedirect } from "@/lib/tenant-nav"

export default async function AssessmentsPage() {
  return tenantRedirect("/profile/learning")
}
