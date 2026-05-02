import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"
import { Switch } from "../components/switch"

const meta: Meta<typeof Switch> = {
  title: "Atoms/Switch",
  component: Switch,
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "default", "lg"],
    },
    checked: { control: "boolean" },
    disabled: { control: "boolean" },
  },
}

export default meta
type Story = StoryObj<typeof Switch>

export const Default: Story = {
  args: { checked: false },
}

export const Checked: Story = {
  args: { checked: true },
}

export const Disabled: Story = {
  args: { checked: false, disabled: true },
}

export const AllSizes: Story = {
  render: () => {
    const Wrapper = () => {
      const [values, setValues] = useState({ sm: true, default: false, lg: true })
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Switch size="sm" checked={values.sm} onCheckedChange={(v) => setValues({ ...values, sm: v })} />
            <span style={{ fontSize: "14px", color: "#a0a0a0" }}>Small</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Switch checked={values.default} onCheckedChange={(v) => setValues({ ...values, default: v })} />
            <span style={{ fontSize: "14px", color: "#a0a0a0" }}>Default</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Switch size="lg" checked={values.lg} onCheckedChange={(v) => setValues({ ...values, lg: v })} />
            <span style={{ fontSize: "14px", color: "#a0a0a0" }}>Large</span>
          </div>
        </div>
      )
    }
    return <Wrapper />
  },
}
