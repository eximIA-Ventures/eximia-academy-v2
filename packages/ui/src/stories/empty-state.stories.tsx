import type { Meta, StoryObj } from "@storybook/react"
import { EmptyState } from "../components/empty-state"

const meta: Meta<typeof EmptyState> = {
  title: "Organisms/EmptyState",
  component: EmptyState,
}

export default meta
type Story = StoryObj<typeof EmptyState>

export const Default: Story = {
  args: {
    title: "Nenhum curso encontrado",
    description: "Crie seu primeiro curso para começar.",
    actionLabel: "Criar curso",
    onAction: () => alert("Criar curso"),
  },
}

export const WithLink: Story = {
  args: {
    title: "Biblioteca vazia",
    description: "Adicione materiais à biblioteca.",
    actionLabel: "Ir para materiais",
    actionHref: "#",
  },
}

export const NoAction: Story = {
  args: {
    title: "Sem resultados",
    description: "Tente ajustar os filtros de busca.",
  },
}
