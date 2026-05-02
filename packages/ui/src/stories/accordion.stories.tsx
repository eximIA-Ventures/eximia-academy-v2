import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/accordion"

const meta: Meta<typeof Accordion> = {
  title: "Molecules/Accordion",
  component: Accordion,
}

export default meta
type Story = StoryObj<typeof Accordion>

export const Default: Story = {
  render: () => {
    const Wrapper = () => {
      const [open, setOpen] = useState<string | null>("item-1")
      return (
        <div style={{ width: "480px" }}>
          <Accordion value={open} onValueChange={setOpen} type="single" collapsible>
            <AccordionItem value="item-1">
              <AccordionTrigger>Como funciona a IA socrática?</AccordionTrigger>
              <AccordionContent>
                A IA socrática faz perguntas progressivas para guiar o aluno ao entendimento.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>Quais perfis de aprendizagem?</AccordionTrigger>
              <AccordionContent>
                Kolb, DISC, Eneagrama, Big Five, Inteligências Múltiplas e Âncoras de Carreira.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>Suporta multi-tenant?</AccordionTrigger>
              <AccordionContent>
                Sim. Cada tenant pode ter branding, SSO e área exclusiva customizados.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )
    }
    return <Wrapper />
  },
}
