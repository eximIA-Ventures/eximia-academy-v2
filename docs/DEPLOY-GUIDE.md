# eximIA Academy v2 — Deploy Guide

## Arquitetura

```
main                  → Plataforma limpa (codebase canônico)
deploy/central        → Central de gestão (super admin)
deploy/{client}       → Deploy por cliente (branding + módulos)
```

## Novo Cliente — Passo a Passo

### 1. Criar Supabase project
- Criar projeto no Supabase Dashboard
- Rodar migrations: `pnpm db:push`
- Provisionar admin user

### 2. Criar branch de deploy
```bash
git checkout main
git checkout -b deploy/{client-slug}
```

### 3. Configurar branding
```bash
# Adicionar logos
mkdir -p apps/web/public/brand/
cp {logo}.png apps/web/public/brand/logo.png
cp {favicon}.ico apps/web/public/brand/favicon.ico
```

### 4. Configurar tenant.config.ts
Editar `apps/web/tenant.config.ts`:
```ts
const config: TenantConfig = {
  brand: {
    name: "Nome do Cliente",
    slug: "client-slug",
    logo: "/brand/logo.png",
    primaryColor: "#HEX",
    accentColor: "#HEX",
  },
  modules: [
    "assessments",      // Avaliações comportamentais
    "biblioteca",       // Biblioteca de livros
    "units",            // Unidades Gerenciais (R$)
    "integrations",     // API Keys + Webhooks (R$)
    "course-designer",  // IA Course Designer (R$)
    "community",        // Comunidade (R$)
  ],
}
```

### 5. Criar app no EasyPanel
- Image: build da branch `deploy/{client-slug}`
- Env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ANTHROPIC_API_KEY`
  - `NEXT_PUBLIC_APP_URL`
- Domain: `{slug}.academy.eximiaventures.com.br`

### 6. Commit e push
```bash
git add -A
git commit -m "deploy: {client-name} — branding + modules config"
git push -u origin deploy/{client-slug}
```

## Atualizar Cliente Existente

```bash
git checkout deploy/{client-slug}
git merge main
# Resolver conflitos em tenant.config.ts se houver (raro)
git push
# Rebuild no EasyPanel
```

## Módulos Disponíveis

| ID | Nome | Core? | Cobrável? |
|:---|:---|:---|:---|
| `academy` | Academy | Sim | Incluso |
| `analytics` | Analytics | Sim | Incluso |
| `admin` | Administração | Sim | Incluso |
| `assessments` | Avaliações | Não | Add-on |
| `biblioteca` | Biblioteca | Não | Add-on |
| `community` | Comunidade | Não | Add-on |
| `course-designer` | Course Designer | Não | Add-on |
| `units` | Unidades Gerenciais | Não | Add-on |
| `integrations` | Integrações | Não | Add-on |
