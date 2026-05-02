import type { Meta, StoryObj } from "@storybook/react"
import { Avatar } from "../components/avatar"
import { AvatarGroup } from "../components/avatar-group"

const meta: Meta<typeof AvatarGroup> = {
  title: "Molecules/AvatarGroup",
  component: AvatarGroup,
  argTypes: {
    max: { control: { type: "number", min: 1, max: 10 } },
  },
}

export default meta
type Story = StoryObj<typeof AvatarGroup>

/* -------------------------------- Helpers -------------------------------- */

const dicebear = (seed: string) =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${seed}`

const allAvatars = [
  { fallback: "HC", seed: "HC", alt: "Hugo Capitelli" },
  { fallback: "MS", seed: "MS", alt: "Marcos Silva" },
  { fallback: "JS", seed: "JS", alt: "Julia Santos" },
  { fallback: "AO", seed: "AO", alt: "Ana Oliveira" },
  { fallback: "CL", seed: "CL", alt: "Carlos Lima" },
  { fallback: "PC", seed: "PC", alt: "Paula Costa" },
  { fallback: "RF", seed: "RF", alt: "Rafael Ferreira" },
]

/* -------------------------------- Stories -------------------------------- */

export const Default: Story = {
  render: (args) => (
    <AvatarGroup {...args}>
      {allAvatars.slice(0, 4).map((a) => (
        <Avatar key={a.seed} src={dicebear(a.seed)} alt={a.alt} fallback={a.fallback} />
      ))}
    </AvatarGroup>
  ),
  args: { max: 4 },
}

export const WithOverflow: Story = {
  render: (args) => (
    <AvatarGroup {...args}>
      {allAvatars.map((a) => (
        <Avatar key={a.seed} src={dicebear(a.seed)} alt={a.alt} fallback={a.fallback} />
      ))}
    </AvatarGroup>
  ),
  args: { max: 3 },
}

export const SmallGroup: Story = {
  render: (args) => (
    <AvatarGroup {...args}>
      {allAvatars.slice(0, 4).map((a) => (
        <Avatar key={a.seed} src={dicebear(a.seed)} alt={a.alt} fallback={a.fallback} size="sm" />
      ))}
    </AvatarGroup>
  ),
  args: { max: 4 },
}

export const LargeGroup: Story = {
  render: (args) => (
    <AvatarGroup {...args}>
      {allAvatars.slice(0, 4).map((a) => (
        <Avatar key={a.seed} src={dicebear(a.seed)} alt={a.alt} fallback={a.fallback} size="lg" />
      ))}
    </AvatarGroup>
  ),
  args: { max: 4 },
}
