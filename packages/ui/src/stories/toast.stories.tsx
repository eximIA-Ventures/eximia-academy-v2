import type { Meta, StoryObj } from "@storybook/react"
import { Toast } from "../components/toast"

const meta: Meta<typeof Toast> = {
  title: "Atoms/Toast",
  component: Toast,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "success", "error", "warning", "info"],
    },
  },
}

export default meta
type Story = StoryObj<typeof Toast>

export const Default: Story = {
  render: () => (
    <Toast
      title="Notificacao"
      description="Uma mensagem neutra do sistema."
    />
  ),
}

export const Success: Story = {
  render: () => (
    <Toast
      variant="success"
      title="Salvo!"
      description="Progresso atualizado com sucesso."
    />
  ),
}

export const Error: Story = {
  render: () => (
    <Toast
      variant="error"
      title="Erro ao salvar"
      description="Nao foi possivel salvar o progresso. Tente novamente."
    />
  ),
}

export const Warning: Story = {
  render: () => (
    <Toast
      variant="warning"
      title="Atencao"
      description="Prazo de entrega em 2 dias."
    />
  ),
}

export const Info: Story = {
  render: () => (
    <Toast
      variant="info"
      title="Novo modulo disponivel"
      description="O modulo 5 foi liberado no seu curso."
    />
  ),
}

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "480px" }}>
      <Toast
        title="Default"
        description="Mensagem neutra do sistema."
      />
      <Toast
        variant="info"
        title="Informacao"
        description="Novo conteudo disponivel na plataforma."
      />
      <Toast
        variant="success"
        title="Sucesso"
        description="Operacao concluida com exito."
      />
      <Toast
        variant="warning"
        title="Aviso"
        description="Sua sessao expira em 5 minutos."
      />
      <Toast
        variant="error"
        title="Erro"
        description="Falha na conexao com o servidor."
      />
    </div>
  ),
}
