import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react"
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
  ModalClose,
  ModalOverlay,
} from "../components/modal"
import { Button } from "../components/button"

const meta: Meta<typeof Modal> = {
  title: "Molecules/Modal",
  component: Modal,
}

export default meta
type Story = StoryObj<typeof Modal>

export const Default: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Abrir Modal</Button>
        <Modal open={open} onOpenChange={setOpen}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Confirmar acao</ModalTitle>
              <ModalDescription>
                Tem certeza de que deseja prosseguir com esta operacao? Esta acao nao podera ser desfeita.
              </ModalDescription>
            </ModalHeader>
            <ModalFooter>
              <ModalClose>
                <Button variant="outline">Cancelar</Button>
              </ModalClose>
              <Button onClick={() => setOpen(false)}>Confirmar</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </>
    )
  },
}

export const Small: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Modal Pequeno</Button>
        <Modal open={open} onOpenChange={setOpen}>
          <ModalOverlay />
          <ModalContent size="sm">
            <ModalHeader>
              <ModalTitle>Aviso</ModalTitle>
              <ModalDescription>Esta e uma mensagem breve de confirmacao.</ModalDescription>
            </ModalHeader>
            <ModalFooter>
              <Button onClick={() => setOpen(false)}>Entendido</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </>
    )
  },
}

export const Medium: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Modal Medio</Button>
        <Modal open={open} onOpenChange={setOpen}>
          <ModalOverlay />
          <ModalContent size="md">
            <ModalHeader>
              <ModalTitle>Detalhes do item</ModalTitle>
              <ModalDescription>
                Revise as informacoes abaixo antes de continuar. Certifique-se de que todos os dados estao corretos.
              </ModalDescription>
            </ModalHeader>
            <ModalFooter>
              <ModalClose>
                <Button variant="outline">Cancelar</Button>
              </ModalClose>
              <Button onClick={() => setOpen(false)}>Salvar</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </>
    )
  },
}

export const Large: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Modal Grande</Button>
        <Modal open={open} onOpenChange={setOpen}>
          <ModalOverlay />
          <ModalContent size="lg">
            <ModalHeader>
              <ModalTitle>Termos de uso</ModalTitle>
              <ModalDescription>
                Leia atentamente os termos abaixo antes de aceitar. Ao continuar, voce concorda com todas as condicoes
                descritas neste documento.
              </ModalDescription>
            </ModalHeader>
            <div style={{ marginTop: "16px", fontSize: "14px", lineHeight: "1.6" }}>
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
                dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip
                ex ea commodo consequat.
              </p>
            </div>
            <ModalFooter>
              <ModalClose>
                <Button variant="outline">Recusar</Button>
              </ModalClose>
              <Button onClick={() => setOpen(false)}>Aceitar</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </>
    )
  },
}

export const ExtraLarge: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Modal Extra Grande</Button>
        <Modal open={open} onOpenChange={setOpen}>
          <ModalOverlay />
          <ModalContent size="xl">
            <ModalHeader>
              <ModalTitle>Relatorio completo</ModalTitle>
              <ModalDescription>
                Visualize o relatorio detalhado com todas as metricas e indicadores do periodo selecionado.
              </ModalDescription>
            </ModalHeader>
            <div style={{ marginTop: "16px", fontSize: "14px", lineHeight: "1.6" }}>
              <p>
                Este relatorio apresenta os principais indicadores de desempenho referentes ao ultimo trimestre.
                Os dados foram consolidados a partir de multiplas fontes e validados pela equipe de analise.
              </p>
              <p style={{ marginTop: "12px" }}>
                Recomenda-se a revisao dos pontos destacados antes de compartilhar com stakeholders externos.
              </p>
            </div>
            <ModalFooter>
              <ModalClose>
                <Button variant="outline">Fechar</Button>
              </ModalClose>
              <Button variant="secondary" onClick={() => setOpen(false)}>Exportar PDF</Button>
              <Button onClick={() => setOpen(false)}>Compartilhar</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </>
    )
  },
}

export const WithForm: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Abrir Formulario</Button>
        <Modal open={open} onOpenChange={setOpen}>
          <ModalOverlay />
          <ModalContent size="md">
            <ModalHeader>
              <ModalTitle>Novo cadastro</ModalTitle>
              <ModalDescription>Preencha os campos abaixo para criar um novo registro.</ModalDescription>
            </ModalHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setOpen(false)
              }}
              style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label htmlFor="name" style={{ fontSize: "14px", fontWeight: 500 }}>
                  Nome
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="Digite o nome completo"
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-subtle, #333)",
                    background: "transparent",
                    fontSize: "14px",
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label htmlFor="email" style={{ fontSize: "14px", fontWeight: 500 }}>
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="exemplo@email.com"
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-subtle, #333)",
                    background: "transparent",
                    fontSize: "14px",
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label htmlFor="role" style={{ fontSize: "14px", fontWeight: 500 }}>
                  Funcao
                </label>
                <select
                  id="role"
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-subtle, #333)",
                    background: "transparent",
                    fontSize: "14px",
                  }}
                >
                  <option value="">Selecione uma funcao</option>
                  <option value="admin">Administrador</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Visualizador</option>
                </select>
              </div>
              <ModalFooter>
                <ModalClose>
                  <Button type="button" variant="outline">Cancelar</Button>
                </ModalClose>
                <Button type="submit">Cadastrar</Button>
              </ModalFooter>
            </form>
          </ModalContent>
        </Modal>
      </>
    )
  },
}

export const AllSizes: Story = {
  render: function Render() {
    const [openSm, setOpenSm] = useState(false)
    const [openMd, setOpenMd] = useState(false)
    const [openLg, setOpenLg] = useState(false)
    const [openXl, setOpenXl] = useState(false)

    const sizes = [
      { label: "Small", size: "sm" as const, open: openSm, setOpen: setOpenSm },
      { label: "Medium", size: "md" as const, open: openMd, setOpen: setOpenMd },
      { label: "Large", size: "lg" as const, open: openLg, setOpen: setOpenLg },
      { label: "Extra Large", size: "xl" as const, open: openXl, setOpen: setOpenXl },
    ]

    return (
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        {sizes.map(({ label, size, open, setOpen }) => (
          <div key={size}>
            <Button variant="outline" onClick={() => setOpen(true)}>
              {label} ({size})
            </Button>
            <Modal open={open} onOpenChange={setOpen}>
              <ModalOverlay />
              <ModalContent size={size}>
                <ModalHeader>
                  <ModalTitle>Modal {label}</ModalTitle>
                  <ModalDescription>
                    Este modal usa o tamanho <strong>{size}</strong>.
                  </ModalDescription>
                </ModalHeader>
                <ModalFooter>
                  <Button onClick={() => setOpen(false)}>Fechar</Button>
                </ModalFooter>
              </ModalContent>
            </Modal>
          </div>
        ))}
      </div>
    )
  },
}
