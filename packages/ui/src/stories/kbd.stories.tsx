import type { Meta, StoryObj } from "@storybook/react"
import { Kbd } from "../components/kbd"

const meta: Meta<typeof Kbd> = {
  title: "Atoms/Kbd",
  component: Kbd,
}

export default meta
type Story = StoryObj<typeof Kbd>

export const Default: Story = {
  args: { children: "K" },
}

export const Shortcut: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
    </div>
  ),
}

export const AllKeys: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
      <Kbd>⌘</Kbd>
      <Kbd>Ctrl</Kbd>
      <Kbd>Alt</Kbd>
      <Kbd>Shift</Kbd>
      <Kbd>Enter</Kbd>
      <Kbd>Esc</Kbd>
      <Kbd>Tab</Kbd>
      <Kbd>↑</Kbd>
      <Kbd>↓</Kbd>
      <Kbd>←</Kbd>
      <Kbd>→</Kbd>
    </div>
  ),
}
