import type { Meta, StoryObj } from "@storybook/react"
import { Skeleton } from "../components/skeleton"

const meta: Meta<typeof Skeleton> = {
  title: "Atoms/Skeleton",
  component: Skeleton,
}

export default meta
type Story = StoryObj<typeof Skeleton>

export const Default: Story = {
  render: () => <Skeleton style={{ width: "200px", height: "16px" }} />,
}

export const TextBlock: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "300px" }}>
      <Skeleton style={{ height: "16px", width: "75%" }} />
      <Skeleton style={{ height: "16px", width: "100%" }} />
      <Skeleton style={{ height: "16px", width: "50%" }} />
    </div>
  ),
}

export const CardSkeleton: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "300px" }}>
      <Skeleton style={{ height: "40px", width: "40px", borderRadius: "50%" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
        <Skeleton style={{ height: "12px", width: "33%" }} />
        <Skeleton style={{ height: "12px", width: "66%" }} />
      </div>
    </div>
  ),
}
