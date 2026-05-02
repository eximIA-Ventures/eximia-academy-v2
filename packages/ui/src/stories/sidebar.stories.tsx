import type { Meta, StoryObj } from "@storybook/react"
import { Home, BookOpen, Users, BarChart3, Settings, GraduationCap } from "lucide-react"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarItem,
  SidebarSection,
  SidebarLabel,
} from "../components/sidebar"

const meta: Meta<typeof Sidebar> = {
  title: "Organisms/Sidebar",
  component: Sidebar,
  argTypes: {
    collapsed: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="h-[500px] relative bg-[#0a0a0a]">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof Sidebar>

export const Default: Story = {
  render: (args) => (
    <Sidebar {...args}>
      <SidebarHeader>
        <GraduationCap className="h-6 w-6 text-white shrink-0" />
        <span className="ml-2 text-sm font-semibold text-white">Academy</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarItem>
          <Home className="h-4 w-4 shrink-0" />
          Dashboard
        </SidebarItem>
        <SidebarItem>
          <BookOpen className="h-4 w-4 shrink-0" />
          Cursos
        </SidebarItem>
        <SidebarItem>
          <Users className="h-4 w-4 shrink-0" />
          Alunos
        </SidebarItem>
        <SidebarItem>
          <BarChart3 className="h-4 w-4 shrink-0" />
          Analytics
        </SidebarItem>
      </SidebarContent>
      <SidebarFooter>
        <SidebarItem>
          <Settings className="h-4 w-4 shrink-0" />
          Configurações
        </SidebarItem>
      </SidebarFooter>
    </Sidebar>
  ),
}

export const Collapsed: Story = {
  args: { collapsed: true },
  render: (args) => (
    <Sidebar {...args}>
      <SidebarHeader>
        <GraduationCap className="h-6 w-6 text-white shrink-0" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarItem>
          <Home className="h-4 w-4 shrink-0" />
        </SidebarItem>
        <SidebarItem>
          <BookOpen className="h-4 w-4 shrink-0" />
        </SidebarItem>
        <SidebarItem>
          <Users className="h-4 w-4 shrink-0" />
        </SidebarItem>
        <SidebarItem>
          <BarChart3 className="h-4 w-4 shrink-0" />
        </SidebarItem>
      </SidebarContent>
      <SidebarFooter>
        <SidebarItem>
          <Settings className="h-4 w-4 shrink-0" />
        </SidebarItem>
      </SidebarFooter>
    </Sidebar>
  ),
}

export const WithActiveItem: Story = {
  render: (args) => (
    <Sidebar {...args}>
      <SidebarHeader>
        <GraduationCap className="h-6 w-6 text-white shrink-0" />
        <span className="ml-2 text-sm font-semibold text-white">Academy</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarItem>
          <Home className="h-4 w-4 shrink-0" />
          Dashboard
        </SidebarItem>
        <SidebarItem isActive>
          <BookOpen className="h-4 w-4 shrink-0" />
          Cursos
        </SidebarItem>
        <SidebarItem>
          <Users className="h-4 w-4 shrink-0" />
          Alunos
        </SidebarItem>
        <SidebarItem>
          <BarChart3 className="h-4 w-4 shrink-0" />
          Analytics
        </SidebarItem>
      </SidebarContent>
      <SidebarFooter>
        <SidebarItem>
          <Settings className="h-4 w-4 shrink-0" />
        </SidebarItem>
      </SidebarFooter>
    </Sidebar>
  ),
}

export const WithSections: Story = {
  render: (args) => (
    <Sidebar {...args}>
      <SidebarHeader>
        <GraduationCap className="h-6 w-6 text-white shrink-0" />
        <span className="ml-2 text-sm font-semibold text-white">Academy</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection>
          <SidebarLabel>Principal</SidebarLabel>
          <SidebarItem isActive>
            <Home className="h-4 w-4 shrink-0" />
            Dashboard
          </SidebarItem>
          <SidebarItem>
            <BookOpen className="h-4 w-4 shrink-0" />
            Cursos
          </SidebarItem>
        </SidebarSection>
        <SidebarSection>
          <SidebarLabel>Gestão</SidebarLabel>
          <SidebarItem>
            <Users className="h-4 w-4 shrink-0" />
            Alunos
          </SidebarItem>
          <SidebarItem>
            <BarChart3 className="h-4 w-4 shrink-0" />
            Analytics
          </SidebarItem>
        </SidebarSection>
      </SidebarContent>
      <SidebarFooter>
        <SidebarItem>
          <Settings className="h-4 w-4 shrink-0" />
          Configurações
        </SidebarItem>
      </SidebarFooter>
    </Sidebar>
  ),
}
