# SSO Setup — Okta

## Passo a Passo

### 1. Criar Application no Okta

1. Acesse o [Okta Admin Console](https://admin.okta.com)
2. Va para **Applications** > **Create App Integration**
3. Selecione **SAML 2.0**
4. Nome: "eximIA Academy" (ou nome do seu tenant)
5. Clique em **Next**

### 2. Configurar SAML Settings

Em **Configure SAML**:

| Campo | Valor |
|-------|-------|
| **Single sign-on URL** | `https://<seu-projeto>.supabase.co/auth/v1/sso/saml/acs` |
| **Audience URI (SP Entity ID)** | `https://<seu-projeto>.supabase.co/auth/v1/sso/saml/metadata` |
| **Name ID format** | `EmailAddress` |
| **Application username** | `Email` |

### 3. Configurar Attribute Statements

| Name | Value |
|------|-------|
| `email` | `user.email` |
| `displayName` | `user.displayName` |

### 4. Obter Metadata

1. Apos criar a aplicacao, va para a aba **Sign On**
2. Copie o **Metadata URL** (link "Identity Provider metadata")
   - Formato: `https://<org>.okta.com/app/<app-id>/sso/saml/metadata`
3. **Alternativa:** Faca download do Metadata XML e cole no formulario

### 5. Configurar na Plataforma

1. Acesse `/admin/settings` > aba **Autenticacao**
2. Selecione **Metadata URL (recomendado)** e cole o URL do Okta
   - Ou selecione **Metadata XML** e cole o conteudo do arquivo baixado
3. Atributo de Email: `email` (default)
4. Dominio SSO (opcional): `suaempresa.com`
5. Clique em **Configurar SAML SSO**

### 6. Atribuir Usuarios

1. No Okta Admin Console, va para a aplicacao criada
2. Aba **Assignments** > **Assign** > **Assign to People** ou **Assign to Groups**
3. Selecione os usuarios que terao acesso

## Google Workspace

A configuracao para Google Workspace segue padrao similar:

1. Acesse **Google Admin Console** > **Apps** > **Web and mobile apps**
2. **Add App** > **Add custom SAML app**
3. Configure os campos ACS URL e Entity ID conforme acima
4. Mapeie os atributos `email` e `displayName`
5. Copie o Metadata URL e configure na plataforma

## Notas

- Todos os usuarios provisionados via SAML recebem o role `student` por padrao
- O admin pode promover usuarios manualmente via painel de gerenciamento
- Session timeout configuravel na aba Autenticacao (default: 8 horas)
- SAML Single Logout (SLO) nao e suportado atualmente
