# SSO Setup — Azure AD (Microsoft Entra ID)

## Passo a Passo

### 1. Criar Enterprise Application

1. Acesse o [Azure Portal](https://portal.azure.com)
2. Navegue para **Azure Active Directory** > **Enterprise Applications**
3. Clique em **New Application** > **Create your own application**
4. Nome: "eximIA Academy" (ou nome do seu tenant)
5. Selecione **Integrate any other application you don't find in the gallery (Non-gallery)**
6. Clique em **Create**

### 2. Configurar SAML SSO

1. Na pagina da aplicacao, va para **Single sign-on** > **SAML**
2. Em **Basic SAML Configuration**, configure:
   - **Identifier (Entity ID):** `https://<seu-projeto>.supabase.co/auth/v1/sso/saml/metadata`
   - **Reply URL (ACS):** `https://<seu-projeto>.supabase.co/auth/v1/sso/saml/acs`
   - **Sign-on URL:** `https://<seu-dominio>/login`
3. Clique em **Save**

### 3. Configurar Attribute Mapping

Em **Attributes & Claims**:

| Claim | Value |
|-------|-------|
| `email` | `user.mail` ou `user.userprincipalname` |
| `displayName` | `user.displayname` |

### 4. Copiar Federation Metadata URL

1. Na secao **SAML Certificates**, copie o link **App Federation Metadata Url**
   - Formato: `https://login.microsoftonline.com/<tenant-id>/federationmetadata/2007-06/federationmetadata.xml`
2. Este e o **Metadata URL** que voce usara na plataforma

### 5. Configurar na Plataforma

1. Acesse `/admin/settings` > aba **Autenticacao**
2. Selecione **Metadata URL (recomendado)**
3. Cole o **App Federation Metadata URL** copiado no passo anterior
4. Atributo de Email: `email` (default)
5. Dominio SSO (opcional): `suaempresa.com`
6. Clique em **Configurar SAML SSO**

### 6. Atribuir Usuarios

1. No Azure Portal, va para a Enterprise Application
2. **Users and groups** > **Add user/group**
3. Selecione os usuarios ou grupos que terao acesso

## Notas

- Todos os usuarios provisionados via SAML recebem o role `student` por padrao
- O admin pode promover usuarios manualmente via painel de gerenciamento
- Session timeout configuravel na aba Autenticacao (default: 8 horas)
