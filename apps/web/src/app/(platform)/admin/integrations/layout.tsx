import { ModuleGate } from "@/components/module-gate"

export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="integrations">{children}</ModuleGate>
}
