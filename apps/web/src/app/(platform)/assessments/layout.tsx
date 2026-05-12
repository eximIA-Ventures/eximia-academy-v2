import { ModuleGate } from "@/components/module-gate"

export default function AssessmentsLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="assessments">{children}</ModuleGate>
}
