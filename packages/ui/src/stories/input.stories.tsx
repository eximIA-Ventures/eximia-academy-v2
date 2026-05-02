import type { Meta, StoryObj } from "@storybook/react"
import { Input } from "../components/input"

const meta: Meta<typeof Input> = {
  title: "Atoms/Input",
  component: Input,
  argTypes: {
    inputSize: {
      control: "select",
      options: ["sm", "default", "lg"],
    },
    error: { control: "boolean" },
    disabled: { control: "boolean" },
    placeholder: { control: "text" },
  },
}

export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {
  args: { placeholder: "Digite algo..." },
}

export const Small: Story = {
  args: { placeholder: "Small input", inputSize: "sm" },
}

export const Large: Story = {
  args: { placeholder: "Large input", inputSize: "lg" },
}

export const WithError: Story = {
  args: { placeholder: "Campo com erro", error: true },
}

export const Disabled: Story = {
  args: { placeholder: "Disabled", disabled: true },
}

export const WithLeadingIcon: Story = {
  args: {
    placeholder: "Buscar...",
    leadingIcon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    ),
  },
}

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "320px" }}>
      <Input inputSize="sm" placeholder="Small" />
      <Input inputSize="default" placeholder="Default" />
      <Input inputSize="lg" placeholder="Large" />
    </div>
  ),
}
