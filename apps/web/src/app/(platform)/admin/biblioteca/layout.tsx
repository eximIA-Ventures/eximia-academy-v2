import { ModuleGate } from "@/components/module-gate"

export default function AdminBibliotecaLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="biblioteca">{children}</ModuleGate>
}
