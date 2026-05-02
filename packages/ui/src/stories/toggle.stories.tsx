import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"
import { Toggle } from "../components/toggle"

const meta: Meta<typeof Toggle> = {
  title: "Atoms/Toggle",
  component: Toggle,
  argTypes: {
    checked: { control: "boolean" },
    disabled: { control: "boolean" },
  },
}

export default meta
type Story = StoryObj<typeof Toggle>

export const Default: Story = {
  render: () => {
    const Wrapper = () => {
      const [on, setOn] = useState(false)
      return (
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Toggle checked={on} onCheckedChange={setOn} />
          <span style={{ fontSize: "14px", color: "#a0a0a0" }}>{on ? "On" : "Off"}</span>
        </div>
      )
    }
    return <Wrapper />
  },
}

export const Checked: Story = {
  args: { checked: true },
}

export const Disabled: Story = {
  args: { checked: false, disabled: true },
}
