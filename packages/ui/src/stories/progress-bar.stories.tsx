import type { Meta, StoryObj } from "@storybook/react"
import { ProgressBar } from "../components/progress-bar"

const meta: Meta<typeof ProgressBar> = {
  title: "Atoms/ProgressBar",
  component: ProgressBar,
  argTypes: {
    value: { control: { type: "range", min: 0, max: 100, step: 1 } },
  },
}

export default meta
type Story = StoryObj<typeof ProgressBar>

export const Default: Story = {
  args: { value: 65 },
  decorators: [(Story) => <div style={{ width: "300px" }}><Story /></div>],
}

export const Empty: Story = {
  args: { value: 0 },
  decorators: [(Story) => <div style={{ width: "300px" }}><Story /></div>],
}

export const Full: Story = {
  args: { value: 100 },
  decorators: [(Story) => <div style={{ width: "300px" }}><Story /></div>],
}

export const AllStates: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "300px" }}>
      <div>
        <p style={{ fontSize: "12px", color: "#a0a0a0", marginBottom: "4px" }}>0%</p>
        <ProgressBar value={0} />
      </div>
      <div>
        <p style={{ fontSize: "12px", color: "#a0a0a0", marginBottom: "4px" }}>25%</p>
        <ProgressBar value={25} />
      </div>
      <div>
        <p style={{ fontSize: "12px", color: "#a0a0a0", marginBottom: "4px" }}>50%</p>
        <ProgressBar value={50} />
      </div>
      <div>
        <p style={{ fontSize: "12px", color: "#a0a0a0", marginBottom: "4px" }}>75%</p>
        <ProgressBar value={75} />
      </div>
      <div>
        <p style={{ fontSize: "12px", color: "#a0a0a0", marginBottom: "4px" }}>100%</p>
        <ProgressBar value={100} />
      </div>
    </div>
  ),
}
