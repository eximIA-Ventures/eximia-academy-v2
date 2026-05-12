import { ModuleGate } from "@/components/module-gate"

export default function ComunidadeLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="community">{children}</ModuleGate>
}
