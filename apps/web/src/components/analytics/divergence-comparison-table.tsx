"use client"

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@eximia/ui"
import Link from "next/link"
import type { DivergenceRow } from "@/types/analytics"

interface DivergenceComparisonTableProps {
  data: DivergenceRow[]
}

export function DivergenceComparisonTable({ data }: DivergenceComparisonTableProps) {
  const handleExportCsv = () => {
    const header = "Aluno,Kolb Teste,Kolb IA,Divergencia"
    const rows = data.map(
      (r) =>
        `"${r.studentName}","${r.kolbTestStyle ?? ""}","${r.kolbAiStyle ?? ""}","${(r.kolbDivergence ?? 0) > 0 ? "Alta" : r.kolbTestStyle && r.kolbAiStyle ? "Alinhado" : "Sem teste"}"`,
    )
    const csv = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "divergencia-kolb.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Divergencia Teste vs IA</CardTitle>
        {data.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            Exportar CSV
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Kolb Teste</TableHead>
                <TableHead>Kolb IA</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => {
                const hasDivergence = (row.kolbDivergence ?? 0) > 0
                const hasTest = !!row.kolbTestStyle
                const hasAi = !!row.kolbAiStyle
                return (
                  <TableRow key={row.studentId}>
                    <TableCell>
                      <Link
                        href={`/analytics/students/${row.studentId}`}
                        className="text-text-primary hover:underline"
                      >
                        {row.studentName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-text-secondary">
                      {row.kolbTestStyle ?? "—"}
                    </TableCell>
                    <TableCell className="text-text-secondary">
                      {row.kolbAiStyle ?? "—"}
                    </TableCell>
                    <TableCell>
                      {hasDivergence ? (
                        <Badge variant="warning" badgeSize="sm">Alta</Badge>
                      ) : hasTest && hasAi ? (
                        <Badge variant="success" badgeSize="sm">Alinhado</Badge>
                      ) : (
                        <Badge variant="default" badgeSize="sm">Sem teste</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="py-4 text-center text-sm text-text-muted">
            Nenhum dado de divergencia disponivel.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
