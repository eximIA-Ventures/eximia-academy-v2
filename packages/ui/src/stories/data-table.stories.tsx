import type { Meta, StoryObj } from "@storybook/react"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  TableFooter,
} from "../components/table"
import { Badge } from "../components/badge"
import { ProgressBar } from "../components/progress-bar"

const meta: Meta<typeof Table> = {
  title: "Atoms/DataTable",
  component: Table,
}

export default meta
type Story = StoryObj<typeof Table>

/* ----------------------------- Sample Data -------------------------------- */

const students = [
  { id: "1", nome: "Maria Silva", curso: "Fundamentos de IA", status: "Concluído", progresso: 100 },
  { id: "2", nome: "João Santos", curso: "Machine Learning", status: "Em progresso", progresso: 68 },
  { id: "3", nome: "Ana Oliveira", curso: "Deep Learning", status: "Ativo", progresso: 45 },
  { id: "4", nome: "Carlos Lima", curso: "NLP Avançado", status: "Iniciando", progresso: 12 },
  { id: "5", nome: "Paula Costa", curso: "Computer Vision", status: "Em progresso", progresso: 73 },
]

/* ----------------------------- Default ------------------------------------ */

export const Default: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Aluno</TableHead>
          <TableHead>Curso</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Progresso</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="font-medium">{s.nome}</TableCell>
            <TableCell>{s.curso}</TableCell>
            <TableCell>{s.status}</TableCell>
            <TableCell className="text-right">{s.progresso}%</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
}

/* ----------------------------- WithCaption -------------------------------- */

export const WithCaption: Story = {
  render: () => (
    <Table>
      <TableCaption>Relatório de progresso dos alunos - Turma 2026.1</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Aluno</TableHead>
          <TableHead>Curso</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Progresso</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="font-medium">{s.nome}</TableCell>
            <TableCell>{s.curso}</TableCell>
            <TableCell>{s.status}</TableCell>
            <TableCell className="text-right">{s.progresso}%</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
}

/* ----------------------------- Striped ------------------------------------ */

export const Striped: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Aluno</TableHead>
          <TableHead>Curso</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Progresso</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((s, i) => (
          <TableRow key={s.id} className={i % 2 === 1 ? "bg-white/[0.02]" : ""}>
            <TableCell className="font-medium">{s.nome}</TableCell>
            <TableCell>{s.curso}</TableCell>
            <TableCell>{s.status}</TableCell>
            <TableCell className="text-right">{s.progresso}%</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
}

/* ----------------------------- WithFooter --------------------------------- */

export const WithFooter: Story = {
  render: () => {
    const mediaProgresso = Math.round(
      students.reduce((acc, s) => acc + s.progresso, 0) / students.length,
    )
    const concluidos = students.filter((s) => s.status === "Concluído").length

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Aluno</TableHead>
            <TableHead>Curso</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Progresso</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.nome}</TableCell>
              <TableCell>{s.curso}</TableCell>
              <TableCell>{s.status}</TableCell>
              <TableCell className="text-right">{s.progresso}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-semibold">Total: {students.length} alunos</TableCell>
            <TableCell />
            <TableCell className="font-semibold">{concluidos} concluído(s)</TableCell>
            <TableCell className="text-right font-semibold">Média: {mediaProgresso}%</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    )
  },
}

/* ----------------------------- Dashboard ---------------------------------- */

const statusVariantMap: Record<string, "success" | "info" | "warning" | "draft"> = {
  Concluído: "success",
  "Em progresso": "info",
  Ativo: "warning",
  Iniciando: "draft",
}

const progressVariantMap: Record<string, "success" | "default" | "warning"> = {
  Concluído: "success",
  "Em progresso": "default",
  Ativo: "default",
  Iniciando: "warning",
}

const dashboardStudents = [
  { id: "1", nome: "Maria Silva", email: "maria@eximia.com", curso: "Fundamentos de IA", status: "Concluído", progresso: 100, nota: 9.2 },
  { id: "2", nome: "João Santos", email: "joao@eximia.com", curso: "Machine Learning", status: "Em progresso", progresso: 68, nota: 8.5 },
  { id: "3", nome: "Ana Oliveira", email: "ana@eximia.com", curso: "Deep Learning", status: "Ativo", progresso: 45, nota: 7.8 },
  { id: "4", nome: "Carlos Lima", email: "carlos@eximia.com", curso: "NLP Avançado", status: "Iniciando", progresso: 12, nota: null },
  { id: "5", nome: "Paula Costa", email: "paula@eximia.com", curso: "Computer Vision", status: "Em progresso", progresso: 73, nota: 8.9 },
]

export const Dashboard: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Aluno</TableHead>
          <TableHead>Curso</TableHead>
          <TableHead>Status</TableHead>
          <TableHead style={{ minWidth: "160px" }}>Progresso</TableHead>
          <TableHead className="text-right">Nota</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dashboardStudents.map((s) => (
          <TableRow key={s.id}>
            <TableCell>
              <div>
                <div className="font-medium">{s.nome}</div>
                <div className="text-xs text-text-muted">{s.email}</div>
              </div>
            </TableCell>
            <TableCell>{s.curso}</TableCell>
            <TableCell>
              <Badge variant={statusVariantMap[s.status] ?? "default"} badgeSize="sm">
                {s.status}
              </Badge>
            </TableCell>
            <TableCell>
              <ProgressBar
                value={s.progresso}
                size="sm"
                variant={progressVariantMap[s.status] ?? "default"}
                showValue
              />
            </TableCell>
            <TableCell className="text-right font-medium">
              {s.nota !== null ? s.nota.toFixed(1) : (
                <span className="text-text-muted">--</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
}
