import type { Meta, StoryObj } from "@storybook/react"
import { Separator } from "../components/separator"

const meta: Meta<typeof Separator> = {
  title: "Atoms/Separator",
  component: Separator,
}

export default meta
type Story = StoryObj<typeof Separator>

export const Horizontal: Story = {
  render: () => (
    <div style={{ width: "300px" }}>
      <p style={{ fontSize: "14px", color: "#a0a0a0", marginBottom: "12px" }}>Above</p>
      <Separator />
      <p style={{ fontSize: "14px", color: "#a0a0a0", marginTop: "12px" }}>Below</p>
    </div>
  ),
}

export const Vertical: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", height: "40px" }}>
      <span style={{ fontSize: "14px", color: "#a0a0a0" }}>Left</span>
      <Separator orientation="vertical" style={{ height: "100%" }} />
      <span style={{ fontSize: "14px", color: "#a0a0a0" }}>Right</span>
    </div>
  ),
}
