import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/tabs"

const meta: Meta<typeof Tabs> = {
  title: "Molecules/Tabs",
  component: Tabs,
}

export default meta
type Story = StoryObj<typeof Tabs>

export const Default: Story = {
  render: () => {
    const Wrapper = () => {
      const [value, setValue] = useState("overview")
      return (
        <Tabs value={value} onValueChange={setValue} style={{ width: "400px" }}>
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="content">Conteúdo</TabsTrigger>
            <TabsTrigger value="students">Alunos</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <p style={{ fontSize: "14px", color: "#a0a0a0", paddingTop: "16px" }}>
              Resumo do curso com métricas principais.
            </p>
          </TabsContent>
          <TabsContent value="content">
            <p style={{ fontSize: "14px", color: "#a0a0a0", paddingTop: "16px" }}>
              Módulos, aulas e materiais do curso.
            </p>
          </TabsContent>
          <TabsContent value="students">
            <p style={{ fontSize: "14px", color: "#a0a0a0", paddingTop: "16px" }}>
              Lista de alunos matriculados e progresso.
            </p>
          </TabsContent>
        </Tabs>
      )
    }
    return <Wrapper />
  },
}
