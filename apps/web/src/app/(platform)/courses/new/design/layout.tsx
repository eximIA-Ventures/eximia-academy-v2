import { ModuleGate } from "@/components/module-gate"

export default function CourseDesignerLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="course-designer">{children}</ModuleGate>
}
