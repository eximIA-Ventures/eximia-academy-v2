import type { Meta, StoryObj } from "@storybook/react"
import { Badge } from "../components/badge"

const meta: Meta<typeof Badge> = {
  title: "Atoms/Badge",
  component: Badge,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "success", "warning", "error", "info", "draft", "archived"],
    },
    badgeSize: {
      control: "select",
      options: ["sm", "default"],
    },
  },
}

export default meta
type Story = StoryObj<typeof Badge>

export const Default: Story = {
  args: { children: "Default" },
}

export const Success: Story = {
  args: { children: "Success", variant: "success" },
}

export const Warning: Story = {
  args: { children: "Warning", variant: "warning" },
}

export const Error: Story = {
  args: { children: "Error", variant: "error" },
}

export const Info: Story = {
  args: { children: "Info", variant: "info" },
}

export const Draft: Story = {
  args: { children: "Draft", variant: "draft" },
}

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      <Badge>Default</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="error">Error</Badge>
      <Badge variant="info">Info</Badge>
      <Badge variant="draft">Draft</Badge>
      <Badge variant="archived">Archived</Badge>
    </div>
  ),
}
