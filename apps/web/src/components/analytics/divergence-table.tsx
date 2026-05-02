"use client"

import { Badge, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@eximia/ui"
import type { DivergenceRow } from "@/types/analytics"

interface DivergenceTableProps {
  divergence: DivergenceRow
}

export function DivergenceTable({ divergence }: DivergenceTableProps) {
  const hasDivergence = (divergence.kolbDivergence ?? 0) > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Divergencia Teste vs IA</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dimensao</TableHead>
              <TableHead>Teste</TableHead>
              <TableHead>IA (Perfilador)</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Kolb</TableCell>
              <TableCell className="text-text-secondary">
                {divergence.kolbTestStyle ?? "Sem dados"}
              </TableCell>
              <TableCell className="text-text-secondary">
                {divergence.kolbAiStyle ?? "Sem dados"}
              </TableCell>
              <TableCell>
                {hasDivergence ? (
                  <Badge variant="warning" badgeSize="sm">Divergente</Badge>
                ) : divergence.kolbTestStyle && divergence.kolbAiStyle ? (
                  <Badge variant="success" badgeSize="sm">Convergente</Badge>
                ) : (
                  <Badge variant="default" badgeSize="sm">Incompleto</Badge>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
