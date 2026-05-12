import { ModuleGate } from "@/components/module-gate"

export default function CourseIngestLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="course-designer">{children}</ModuleGate>
}
