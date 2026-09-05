"use client"

import { BrandingPreview } from "@/components/admin/branding-preview"
import { ColorPicker } from "@/components/admin/color-picker"
import { LogoUpload } from "@/components/admin/logo-upload"
import { hostCanonico } from "@/lib/admin/host-canonico"
import {
  CONTRACTABLE_MODULE_IDS,
  MODULE_DEFINITIONS,
  type ModuleId,
  isReservedSlug,
} from "@eximia/shared"
import {
  Badge,
  Button,
  Checkbox,
  FormField,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Select,
  useToast,
} from "@eximia/ui"
import { AlertTriangle, Check, Globe, Mail, RefreshCw } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { UploadDeArquivoDaMarca } from "./upload-de-arquivo-da-marca"

// ===========================================================================
// O CADASTRO DE UMA EMPRESA, EM 3 PASSOS (§3 do plano)
//
// O modal que este componente substitui tinha DOIS campos (nome e slug) e criava
// uma empresa sem marca, sem módulos e sem ninguém dentro — o super_admin ainda
// tinha que trocar de empresa no seletor e convidar o primeiro admin por outra
// tela. Três passos manuais, cada um esquecível.
//
// O UUID É GERADO AQUI, ANTES DO POST, e vai no corpo. Não é capricho: o upload
// do logo grava em `tenant-assets/{tenantId}/`, e as policies do bucket (D12)
// amarram a PASTA ao tenant. Sem o id antes, ou a marca sobe para uma pasta
// órfã, ou a empresa nasce em `status='draft'` e aparece meio-criada na lista.
// ===========================================================================

type Plano = "essencial" | "standard" | "premium"

/**
 * Pré-marcação dos módulos por plano. É SUGESTÃO DE TELA, não regra de negócio
 * gravada: o que vai para `tenants.modules` é o que ficar marcado. O banco não
 * tem hoje um mapa plano→módulos (`plan_features` fala de FEATURES, outro eixo),
 * então cravar isto como verdade em código seria inventar contrato.
 *
 * Módulo é exposição de UI, nunca permissão (AGENTS.md): marcar um aqui não dá
 * acesso a dado nenhum — quem autoriza é a RLS.
 */
const MODULOS_POR_PLANO: Record<Plano, ModuleId[]> = {
  essencial: ["biblioteca"],
  standard: ["biblioteca", "assessments", "units"],
  premium: [...CONTRACTABLE_MODULE_IDS],
}

const COR_PRIMARIA_PADRAO = "#2a6ab0"
const COR_DESTAQUE_PADRAO = "#C4A882"

interface RespostaDeCadastro {
  tenant: {
    id: string
    name: string
    slug: string
    host: string | null
    customHost: string | null
    modules: string[]
  }
  adminInvite: { status: "sent" | "failed"; error?: string; stage?: string }
}

interface TenantWizardProps {
  open: boolean
  onOpenChange: (aberto: boolean) => void
  /** Chamado quando a empresa foi criada (a lista precisa se atualizar). */
  onCriado: () => void
}

export function TenantWizard({ open, onOpenChange, onCriado }: TenantWizardProps) {
  const { toast } = useToast()

  const [tenantId, setTenantId] = useState(() => crypto.randomUUID())
  const [passo, setPasso] = useState<1 | 2 | 3>(1)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<RespostaDeCadastro | null>(null)
  const [reenviando, setReenviando] = useState(false)

  // Passo 1 — identidade
  const [nome, setNome] = useState("")
  const [slug, setSlug] = useState("")
  const [dominioProprio, setDominioProprio] = useState("")
  const [plano, setPlano] = useState<Plano>("standard")

  // Passo 2 — marca
  const [logo, setLogo] = useState("")
  const [logoClaro, setLogoClaro] = useState("")
  const [favicon, setFavicon] = useState("")
  const [corPrimaria, setCorPrimaria] = useState(COR_PRIMARIA_PADRAO)
  const [corDestaque, setCorDestaque] = useState(COR_DESTAQUE_PADRAO)
  const [rodape, setRodape] = useState("")
  const [emailDeSuporte, setEmailDeSuporte] = useState("")

  // Passo 3 — acesso
  const [adminNome, setAdminNome] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [modulos, setModulos] = useState<ModuleId[]>(MODULOS_POR_PLANO.standard)

  const host = hostCanonico(slug)
  const slugReservado = slug !== "" && isReservedSlug(slug)

  const identidadeCompleta = nome.trim() !== "" && slug.trim().length >= 3 && !slugReservado
  const acessoCompleto = adminNome.trim() !== "" && /.+@.+\..+/.test(adminEmail)

  const modulosVisiveis = useMemo(
    () => CONTRACTABLE_MODULE_IDS.map((id) => MODULE_DEFINITIONS[id]),
    [],
  )

  const gerarSlug = useCallback(
    (valor: string) =>
      valor
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    [],
  )

  function limpar() {
    setTenantId(crypto.randomUUID())
    setPasso(1)
    setResultado(null)
    setNome("")
    setSlug("")
    setDominioProprio("")
    setPlano("standard")
    setLogo("")
    setLogoClaro("")
    setFavicon("")
    setCorPrimaria(COR_PRIMARIA_PADRAO)
    setCorDestaque(COR_DESTAQUE_PADRAO)
    setRodape("")
    setEmailDeSuporte("")
    setAdminNome("")
    setAdminEmail("")
    setModulos(MODULOS_POR_PLANO.standard)
  }

  function trocarPlano(novo: Plano) {
    setPlano(novo)
    // Re-aplica a pré-marcação do plano. Determinístico e visível: o texto
    // abaixo dos checkboxes diz que é sugestão e que dá para ajustar.
    setModulos(MODULOS_POR_PLANO[novo])
  }

  function alternarModulo(id: ModuleId, marcado: boolean) {
    setModulos((atuais) =>
      marcado ? [...new Set([...atuais, id])] : atuais.filter((m) => m !== id),
    )
  }

  async function cadastrar() {
    setEnviando(true)
    try {
      const corpo = {
        id: tenantId,
        name: nome.trim(),
        slug: slug.trim(),
        plan: plano,
        brand: {
          name: nome.trim(),
          ...(logo ? { logo } : {}),
          ...(logoClaro ? { logoLight: logoClaro } : {}),
          ...(favicon ? { favicon } : {}),
          primaryColor: corPrimaria,
          accentColor: corDestaque,
        },
        modules: modulos,
        settings: {
          ...(rodape.trim() ? { footerText: rodape.trim() } : {}),
          ...(emailDeSuporte.trim() ? { supportEmail: emailDeSuporte.trim() } : {}),
        },
        ...(dominioProprio.trim() ? { customHost: dominioProprio.trim().toLowerCase() } : {}),
        admin: { email: adminEmail.trim(), fullName: adminNome.trim() },
      }

      const resposta = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      })
      const json = await resposta.json()

      if (!resposta.ok) {
        toast({ variant: "error", title: json.error ?? "Erro ao cadastrar empresa" })
        return
      }

      setResultado(json as RespostaDeCadastro)
      onCriado()
    } finally {
      setEnviando(false)
    }
  }

  async function reenviarConvite() {
    if (!resultado) return
    setReenviando(true)
    try {
      const resposta = await fetch(`/api/admin/tenants/${resultado.tenant.id}/convidar-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail.trim(), fullName: adminNome.trim() }),
      })
      const json = await resposta.json()
      if (!resposta.ok) {
        toast({ variant: "error", title: json.error ?? "Falha ao reenviar convite" })
        return
      }
      setResultado({ ...resultado, adminInvite: { status: "sent" } })
      toast({ variant: "success", title: "Convite reenviado." })
    } finally {
      setReenviando(false)
    }
  }

  function fechar() {
    onOpenChange(false)
    limpar()
  }

  return (
    <Modal
      open={open}
      onOpenChange={(aberto) => {
        onOpenChange(aberto)
        if (!aberto) limpar()
      }}
    >
      <ModalOverlay />
      <ModalContent className="max-w-2xl">
        {resultado ? (
          <>
            <ModalHeader>
              <ModalTitle>Empresa cadastrada</ModalTitle>
              <ModalDescription>
                {resultado.tenant.name} já existe na plataforma, com unidades e templates de
                notificação semeados.
              </ModalDescription>
            </ModalHeader>

            <div className="space-y-4 py-4">
              <div className="rounded-xl bg-bg-surface p-4 space-y-2">
                <p className="flex items-center gap-2 text-sm text-text-primary">
                  <Globe size={14} className="text-text-muted" />
                  <span className="font-mono">{resultado.tenant.host ?? "—"}</span>
                </p>
                {resultado.tenant.customHost && (
                  <p className="text-xs text-text-muted">
                    Domínio próprio:{" "}
                    <span className="font-mono">{resultado.tenant.customHost}</span> — só responde
                    depois do CNAME e do certificado.
                  </p>
                )}
                {!resultado.tenant.host && (
                  <p className="text-xs text-semantic-warning">
                    NEXT_PUBLIC_APP_BASE_DOMAIN não está definido neste serviço — sem ele o endereço
                    canônico da empresa não existe.
                  </p>
                )}
              </div>

              {resultado.adminInvite.status === "sent" ? (
                <p className="flex items-center gap-2 text-sm text-semantic-success">
                  <Check size={14} />
                  Convite enviado para {adminEmail}.
                </p>
              ) : (
                <div className="rounded-xl bg-semantic-error/10 p-4 space-y-2">
                  <p className="flex items-center gap-2 text-sm text-semantic-error">
                    <AlertTriangle size={14} />A empresa foi criada, mas o convite para {adminEmail}{" "}
                    falhou.
                  </p>
                  {resultado.adminInvite.error && (
                    <p className="text-xs text-text-muted">{resultado.adminInvite.error}</p>
                  )}
                  <Button size="sm" onClick={reenviarConvite} disabled={reenviando}>
                    <RefreshCw size={14} />
                    {reenviando ? "Reenviando..." : "Reenviar convite"}
                  </Button>
                </div>
              )}
            </div>

            <ModalFooter>
              <Button onClick={fechar}>Concluir</Button>
            </ModalFooter>
          </>
        ) : (
          <>
            <ModalHeader>
              <ModalTitle>Nova Empresa</ModalTitle>
              <ModalDescription>
                Passo {passo} de 3 — {passo === 1 ? "Identidade" : passo === 2 ? "Marca" : "Acesso"}
              </ModalDescription>
            </ModalHeader>

            <div className="max-h-[60vh] space-y-4 overflow-y-auto py-4">
              {passo === 1 && (
                <>
                  <FormField label="Nome da empresa" htmlFor="empresa-nome" required>
                    <Input
                      value={nome}
                      onChange={(e) => {
                        setNome(e.target.value)
                        if (!slug || slug === gerarSlug(nome)) setSlug(gerarSlug(e.target.value))
                      }}
                      id="empresa-nome"
                      placeholder="Ex: Cory Alimentos"
                    />
                  </FormField>

                  <FormField
                    label="Slug"
                    htmlFor="empresa-slug"
                    required
                    error={slugReservado ? "Slug reservado pela plataforma." : undefined}
                  >
                    <Input
                      value={slug}
                      onChange={(e) => setSlug(gerarSlug(e.target.value))}
                      id="empresa-slug"
                      placeholder="Ex: cory-alimentos"
                      error={slugReservado}
                    />
                  </FormField>

                  <div className="rounded-xl bg-bg-surface p-3">
                    <p className="text-xs text-text-muted">Endereço da empresa</p>
                    <p className="font-mono text-sm text-text-primary">
                      {host ?? "defina NEXT_PUBLIC_APP_BASE_DOMAIN no serviço"}
                    </p>
                  </div>

                  <FormField label="Domínio próprio (opcional)" htmlFor="empresa-dominio">
                    <Input
                      value={dominioProprio}
                      onChange={(e) => setDominioProprio(e.target.value)}
                      id="empresa-dominio"
                      placeholder="academy.suaempresa.com.br"
                    />
                  </FormField>

                  <FormField label="Plano" htmlFor="empresa-plano" required>
                    <Select
                      id="empresa-plano"
                      value={plano}
                      onChange={(e) => trocarPlano(e.target.value as Plano)}
                    >
                      <option value="essencial">Essencial</option>
                      <option value="standard">Standard</option>
                      <option value="premium">Premium</option>
                    </Select>
                  </FormField>
                </>
              )}

              {passo === 2 && (
                <>
                  <LogoUpload tenantId={tenantId} currentUrl={logo} onUpload={setLogo} />
                  <UploadDeArquivoDaMarca
                    label="Logo para tema claro"
                    tenantId={tenantId}
                    nomeDoArquivo="logo-light.png"
                    valorAtual={logoClaro}
                    ajuda="Usado no tema claro, que é o default. Sem ele, o logo acima é reutilizado."
                    onUpload={setLogoClaro}
                  />
                  <UploadDeArquivoDaMarca
                    label="Favicon"
                    tenantId={tenantId}
                    nomeDoArquivo="favicon.png"
                    valorAtual={favicon}
                    onUpload={setFavicon}
                  />
                  <ColorPicker label="Cor primária" value={corPrimaria} onChange={setCorPrimaria} />
                  <ColorPicker
                    label="Cor de destaque"
                    value={corDestaque}
                    onChange={setCorDestaque}
                  />
                  <FormField label="Texto do rodapé" htmlFor="empresa-rodape">
                    <Input
                      value={rodape}
                      onChange={(e) => setRodape(e.target.value)}
                      id="empresa-rodape"
                      placeholder="© 2026 Empresa"
                    />
                  </FormField>
                  <FormField label="E-mail de suporte" htmlFor="empresa-suporte">
                    <Input
                      type="email"
                      value={emailDeSuporte}
                      onChange={(e) => setEmailDeSuporte(e.target.value)}
                      id="empresa-suporte"
                      placeholder="suporte@empresa.com.br"
                    />
                  </FormField>
                  <BrandingPreview
                    primaryColor={corPrimaria}
                    secondaryColor={corDestaque}
                    logoUrl={logo || undefined}
                    tenantName={nome || "Empresa"}
                  />
                </>
              )}

              {passo === 3 && (
                <>
                  <FormField label="Nome do primeiro admin" htmlFor="admin-nome" required>
                    <Input
                      value={adminNome}
                      onChange={(e) => setAdminNome(e.target.value)}
                      id="admin-nome"
                      placeholder="Ex: Maria Silva"
                    />
                  </FormField>
                  <FormField label="E-mail do primeiro admin" htmlFor="admin-email" required>
                    <Input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      id="admin-email"
                      placeholder="maria@empresa.com.br"
                    />
                  </FormField>
                  <p className="flex items-center gap-2 text-xs text-text-muted">
                    <Mail size={12} />
                    Ele recebe o convite por e-mail assim que a empresa for criada.
                  </p>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-text-secondary">Módulos contratados</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {modulosVisiveis.map((modulo) => (
                        <Checkbox
                          key={modulo.id}
                          checked={modulos.includes(modulo.id)}
                          onCheckedChange={(marcado) => alternarModulo(modulo.id, marcado)}
                        >
                          {modulo.name}
                        </Checkbox>
                      ))}
                    </div>
                    <p className="text-xs text-text-muted">
                      Pré-marcados pelo plano {plano}. Ajuste à vontade — trocar o plano refaz a
                      marcação.
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-xs text-text-muted">Sempre inclusos:</span>
                      <Badge badgeSize="sm" variant="default">
                        Academy
                      </Badge>
                      <Badge badgeSize="sm" variant="default">
                        Analytics
                      </Badge>
                      <Badge badgeSize="sm" variant="default">
                        Admin
                      </Badge>
                    </div>
                  </div>
                </>
              )}
            </div>

            <ModalFooter>
              {passo > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setPasso((p) => (p === 3 ? 2 : 1))}
                  disabled={enviando}
                >
                  Voltar
                </Button>
              )}
              {passo < 3 ? (
                <Button
                  onClick={() => setPasso((p) => (p === 1 ? 2 : 3))}
                  disabled={passo === 1 && !identidadeCompleta}
                >
                  Próximo
                </Button>
              ) : (
                <Button
                  onClick={cadastrar}
                  disabled={enviando || !identidadeCompleta || !acessoCompleto}
                >
                  {enviando ? "Cadastrando..." : "Cadastrar empresa"}
                </Button>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
