import type { Meta, StoryObj } from "@storybook/react"
import { StatCard } from "../components/stat-card"

const meta: Meta<typeof StatCard> = {
  title: "Organisms/StatCard",
  component: StatCard,
  argTypes: {
    trend: {
      control: "select",
      options: ["up", "down", "neutral"],
    },
  },
}

export default meta
type Story = StoryObj<typeof StatCard>

export const Default: Story = {
  args: {
    label: "Alunos ativos",
    value: "1.247",
    trend: "up",
    trendValue: "+12%",
  },
}

export const TrendDown: Story = {
  args: {
    label: "Taxa de evasão",
    value: "3.2%",
    trend: "down",
    trendValue: "-0.8%",
  },
}

export const NoTrend: Story = {
  args: {
    label: "Total de cursos",
    value: "42",
  },
}

export const Dashboard: Story = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", width: "600px" }}>
      <StatCard label="Alunos" value="1.247" trend="up" trendValue="+12%" />
      <StatCard label="Conclusão" value="73%" trend="up" trendValue="+5%" />
      <StatCard label="NPS" value="87" trend="down" trendValue="-2%" />
    </div>
  ),
}
