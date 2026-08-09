import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DepartmentsList } from "../_components/departments-list"
import { DepartmentsMap } from "../_components/departments-map"
import { deriveDepartments } from "../departments-model"
import type { DepartmentsSnapshot } from "../departments-model"

// =============================================================================
// Mapa e Lista — as duas leituras do MESMO estado.
//
// O que estes testes protegem não é o layout, é o SIGNIFICADO: que a área
// corporativa apareça nas unidades que ela cobre (e não numa faixa órfã), que o
// "também em" diga a verdade, e que a tela sem nenhum departamento — o estado
// literal da produção hoje — continue sendo útil em vez de um quadro em branco.
// =============================================================================

const RP = { id: "rp", name: "Ribeirão Preto", slug: "rp", description: "Unidade de SP" }
const MG = { id: "mg", name: "Minas Gerais", slug: "mg", description: null }

function snapshot(): DepartmentsSnapshot {
  return {
    unidades: [RP, MG],
    departments: [
      { id: "financeiro", name: "Finanças", slug: "financas", description: null },
      { id: "rh", name: "Recursos Humanos", slug: "rh", description: null },
    ],
    presences: [
      { departmentId: "financeiro", areaId: "rp" },
      { departmentId: "rh", areaId: "rp" },
      { departmentId: "rh", areaId: "mg" },
    ],
    memberships: [{ userId: "ana", departmentId: "financeiro" }],
    people: [{ id: "ana", name: "Ana Lima", email: "ana@cory.com", isManager: true, areaId: "rp" }],
  }
}

const noop = () => {}

function renderMap(s: DepartmentsSnapshot) {
  return render(
    <DepartmentsMap
      unidades={s.unidades}
      departments={deriveDepartments(s)}
      onOpenUnit={noop}
      onOpenDepartment={noop}
      onAddDepartment={noop}
      onCreateUnit={noop}
    />,
  )
}

function renderList(s: DepartmentsSnapshot, overrides: Record<string, () => void> = {}) {
  return render(
    <DepartmentsList
      unidades={s.unidades}
      departments={deriveDepartments(s)}
      onOpenUnit={noop}
      onOpenDepartment={noop}
      onAddDepartment={noop}
      onMove={noop}
      onManagePresence={noop}
      onRename={noop}
      onArchive={noop}
      onRestore={noop}
      {...overrides}
    />,
  )
}

/* ----------------------------------- Mapa --------------------------------- */

describe("Mapa", () => {
  it("desenha uma coluna por unidade", () => {
    renderMap(snapshot())

    expect(screen.getByLabelText("Unidade Ribeirão Preto")).toBeInTheDocument()
    expect(screen.getByLabelText("Unidade Minas Gerais")).toBeInTheDocument()
  })

  it("a área corporativa é UMA barra que atravessa as colunas cobertas", () => {
    renderMap(snapshot())

    // Uma única ocorrência do nome: a barra existe uma vez e se estende — não é
    // um cartão duplicado por coluna, nem uma faixa separada.
    const barras = screen.getAllByText("Recursos Humanos")
    expect(barras).toHaveLength(1)

    const barra = barras[0].closest("button")
    expect(barra).toBeTruthy()
    expect(barra?.style.gridColumn).toBe("1 / 3")
    expect(within(barra as HTMLElement).getByText("Corporativa")).toBeInTheDocument()
    // Os chips dizem exatamente quais unidades ela cobre.
    expect(within(barra as HTMLElement).getByText("Ribeirão Preto")).toBeInTheDocument()
    expect(within(barra as HTMLElement).getByText("Minas Gerais")).toBeInTheDocument()
  })

  it("a área local fica na pilha da unidade dela, com o gestor", () => {
    renderMap(snapshot())

    expect(screen.getByText("Finanças")).toBeInTheDocument()
    expect(screen.getByText("gestor: Ana Lima")).toBeInTheDocument()
  })

  it("coluna sem nenhuma área convida a criar, em vez de ficar em branco", () => {
    const s = snapshot()
    s.presences = [{ departmentId: "rh", areaId: "rp" }]

    renderMap(s)

    // RH virou local em RP; MG fica sem nada.
    expect(screen.getAllByText("Nenhuma área ainda").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Adicionar área").length).toBe(2)
  })

  it("sem nenhuma unidade, explica o que é unidade e oferece criar a primeira", () => {
    const onCreateUnit = vi.fn()
    render(
      <DepartmentsMap
        unidades={[]}
        departments={[]}
        onOpenUnit={noop}
        onOpenDepartment={noop}
        onAddDepartment={noop}
        onCreateUnit={onCreateUnit}
      />,
    )

    expect(screen.getByText("Nenhuma unidade ainda")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Criar a primeira unidade"))
    expect(onCreateUnit).toHaveBeenCalled()
  })
})

/* ----------------------------------- Lista -------------------------------- */

describe("Lista v2", () => {
  it("agrupa por unidade e repete a corporativa em cada unidade que ela cobre", () => {
    renderList(snapshot())

    // A corporativa aparece sob RP e sob MG — é assim que ela existe para quem
    // trabalha em cada uma delas.
    expect(screen.getAllByText("Recursos Humanos")).toHaveLength(2)
    expect(screen.getByText("também em Minas Gerais")).toBeInTheDocument()
    expect(screen.getByText("também em Ribeirão Preto")).toBeInTheDocument()
  })

  it("busca filtra por nome da área", () => {
    renderList(snapshot())

    fireEvent.change(screen.getByLabelText("Buscar área ou gestor"), {
      target: { value: "recursos" },
    })

    expect(screen.queryByText("Finanças")).not.toBeInTheDocument()
    expect(screen.getAllByText("Recursos Humanos").length).toBeGreaterThan(0)
  })

  it("busca encontra a área pelo nome do GESTOR", () => {
    renderList(snapshot())

    fireEvent.change(screen.getByLabelText("Buscar área ou gestor"), {
      target: { value: "Ana" },
    })

    expect(screen.getByText("Finanças")).toBeInTheDocument()
    expect(screen.queryByText("Recursos Humanos")).not.toBeInTheDocument()
  })

  it("busca sem resultado oferece limpar, em vez de sumir com a tela", () => {
    renderList(snapshot())

    fireEvent.change(screen.getByLabelText("Buscar área ou gestor"), {
      target: { value: "zzz" },
    })

    expect(screen.getByText("Nenhuma área encontrada para essa busca.")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Limpar busca"))
    expect(screen.getByText("Finanças")).toBeInTheDocument()
  })

  it("filtro segmentado separa locais de corporativas", () => {
    renderList(snapshot())

    fireEvent.click(screen.getByText("Corporativas"))
    expect(screen.queryByText("Finanças")).not.toBeInTheDocument()
    expect(screen.getAllByText("Recursos Humanos").length).toBeGreaterThan(0)

    fireEvent.click(screen.getByText("Locais"))
    expect(screen.getByText("Finanças")).toBeInTheDocument()
    expect(screen.queryByText("Recursos Humanos")).not.toBeInTheDocument()
  })

  it("arquivada aparece no rodapé próprio, com Restaurar — nunca some da tela", () => {
    const s = snapshot()
    s.presences = s.presences.filter((p) => p.departmentId !== "financeiro")
    const onRestore = vi.fn()

    renderList(s, { onRestore })

    expect(screen.getByText("Arquivadas (1)")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Restaurar"))
    expect(onRestore).toHaveBeenCalled()
  })

  it("grupo de unidade colapsa e expande", () => {
    renderList(snapshot())

    fireEvent.click(screen.getByLabelText("Recolher Ribeirão Preto"))
    expect(screen.queryByText("Finanças")).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText("Expandir Ribeirão Preto"))
    expect(screen.getByText("Finanças")).toBeInTheDocument()
  })

  it("o menu ⋯ oferece Mover e Gerir unidades como ações DIFERENTES", () => {
    const onMove = vi.fn()
    renderList(snapshot(), { onMove })

    fireEvent.click(screen.getByLabelText("Ações de Finanças"))
    expect(screen.getByText("Mover para unidade…")).toBeInTheDocument()
    expect(screen.getByText("Gerir unidades…")).toBeInTheDocument()

    fireEvent.click(screen.getByText("Mover para unidade…"))
    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: "financeiro" }), "rp")
  })
})
