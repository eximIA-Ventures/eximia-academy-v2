import type { Meta, StoryObj } from "@storybook/react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/card"
import { Button } from "../components/button"

const meta: Meta<typeof Card> = {
  title: "Atoms/Card",
  component: Card,
  argTypes: {
    interactive: { control: "boolean" },
  },
}

export default meta
type Story = StoryObj<typeof Card>

export const Default: Story = {
  render: () => (
    <Card style={{ width: "320px" }}>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description with supporting text.</CardDescription>
      </CardHeader>
      <CardContent>
        <p style={{ fontSize: "14px", color: "#a0a0a0" }}>Card body content goes here.</p>
      </CardContent>
      <CardFooter>
        <Button size="sm" variant="ghost">Action</Button>
      </CardFooter>
    </Card>
  ),
}

export const Interactive: Story = {
  render: () => (
    <Card interactive style={{ width: "320px" }}>
      <CardHeader>
        <CardTitle>Interactive Card</CardTitle>
        <CardDescription>Hover to see elevation effect.</CardDescription>
      </CardHeader>
      <CardContent>
        <p style={{ fontSize: "14px", color: "#a0a0a0" }}>Clickable card with hover animation.</p>
      </CardContent>
    </Card>
  ),
}

export const Minimal: Story = {
  render: () => (
    <Card style={{ width: "320px" }}>
      <CardContent className="p-6">
        <p style={{ fontSize: "14px", color: "#a0a0a0" }}>A card with only content, no header or footer.</p>
      </CardContent>
    </Card>
  ),
}
