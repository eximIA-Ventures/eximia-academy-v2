"use client"

import {
  Badge,
  Button,
  DataTable,
  type DataTableColumn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  buttonVariants,
  useToast,
} from "@eximia/ui"
import { MoreVertical, Sparkles, Wand2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { archiveCourse } from "../actions"
import { CourseFormDialog } from "./course-form-dialog"
import { DeleteCourseDialog } from "./delete-course-dialog"

interface Course {
  id: string
  title: string
  description: string | null
  status: string
  type: string
  created_at: string
  chapter_count: number
}

interface CourseTableProps {
  courses: Course[]
  onCreateCourse: () => void
}

const STATUS_VARIANTS: Record<string, "warning" | "success" | "archived" | "draft"> = {
  draft: "draft",
  published: "success",
  archived: "archived",
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
}

export function CourseTable({ courses, onCreateCourse }: CourseTableProps) {
  const slug = useTenantSlug()
  const prefix = slug ? `/${slug}` : ""
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null)
  const [searchValue, setSearchValue] = useState("")
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  function handleArchive(courseId: string) {
    startTransition(async () => {
      const result = await archiveCourse(courseId)
      if (result.error) {
        toast({ variant: "error", title: result.error })
        return
      }
      toast({ variant: "success", title: "Curso arquivado com sucesso" })
      router.refresh()
    })
  }

  const filteredCourses = searchValue
    ? courses.filter((c) => c.title.toLowerCase().includes(searchValue.toLowerCase()))
    : courses

  const columns: DataTableColumn<Course>[] = [
    {
      key: "title",
      header: "Titulo",
      render: (row) => (
        <div className="flex items-center gap-2">
          <Link
            href={`${prefix}/courses/${row.id}`}
            className="font-medium text-text-primary hover:text-accent-blue-mid transition-colors"
          >
            {row.title}
          </Link>
          {row.type === "onboarding" && (
            <Badge variant="default" badgeSize="sm">
              Onboarding
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status] ?? "draft"} badgeSize="sm">
          {STATUS_LABELS[row.status] ?? row.status}
        </Badge>
      ),
    },
    {
      key: "chapters",
      header: "Capítulos",
      render: (row) => <span className="text-text-secondary">{row.chapter_count}</span>,
    },
    {
      key: "created_at",
      header: "Criado em",
      render: (row) => (
        <span className="text-text-muted text-xs">
          {new Date(row.created_at).toLocaleDateString("pt-BR")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-12",
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="ghost" size="sm" aria-label="Acoes">
              <MoreVertical size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="right-0 left-auto">
            <DropdownMenuItem onClick={() => setEditingCourse(row)}>Editar</DropdownMenuItem>
            {row.status === "draft" && (
              <DropdownMenuItem onClick={() => router.push(`/courses/${row.id}`)}>
                Publicar
              </DropdownMenuItem>
            )}
            {row.status === "published" && (
              <DropdownMenuItem onClick={() => handleArchive(row.id)} disabled={isPending}>
                Arquivar
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-semantic-error"
              onClick={() => setDeletingCourse(row)}
            >
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={filteredCourses}
        rowKey={(row) => row.id}
        searchPlaceholder="Buscar cursos..."
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        emptyMessage="Nenhum curso encontrado."
        actionSlot={
          <div className="flex gap-2">
            <Link href={`${prefix}/courses/new/design`} className={buttonVariants({ variant: "outline" })}>
              <Wand2 size={16} className="mr-1" />
              Criar Blueprint
            </Link>
            <Link href={`${prefix}/courses/new/ingest`} className={buttonVariants({ variant: "outline" })}>
              <Sparkles size={16} className="mr-1" />
              Importar com IA
            </Link>
            <Button onClick={onCreateCourse}>Criar Curso</Button>
          </div>
        }
      />

      {editingCourse && (
        <CourseFormDialog
          open
          onOpenChange={(open) => !open && setEditingCourse(null)}
          course={{
            id: editingCourse.id,
            title: editingCourse.title,
            description: editingCourse.description,
            type: editingCourse.type,
          }}
        />
      )}

      {deletingCourse && (
        <DeleteCourseDialog
          open
          onOpenChange={(open) => !open && setDeletingCourse(null)}
          courseId={deletingCourse.id}
          courseTitle={deletingCourse.title}
        />
      )}
    </>
  )
}
