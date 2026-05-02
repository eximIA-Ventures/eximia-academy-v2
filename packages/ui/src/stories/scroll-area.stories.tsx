import type { Meta, StoryObj } from "@storybook/react"
import { ScrollArea } from "../components/scroll-area"

const meta: Meta<typeof ScrollArea> = {
  title: "Molecules/ScrollArea",
  component: ScrollArea,
}

export default meta
type Story = StoryObj<typeof ScrollArea>

export const Vertical: Story = {
  render: () => (
    <ScrollArea
      style={{
        height: "200px",
        width: "300px",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.06)",
        padding: "16px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={i}
            style={{
              padding: "12px",
              borderRadius: "8px",
              backgroundColor: "#1e1e1e",
              border: "1px solid rgba(255,255,255,0.06)",
              fontSize: "14px",
              color: "#a0a0a0",
            }}
          >
            Item {i + 1}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
}
