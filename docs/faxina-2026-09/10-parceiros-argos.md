# 10 — Parceiros: a Argos precisa de empresas dentro dela (2026-09-08)

> Esclarecimento do Hugo durante o deploy: `argos.eximiaacademy.com.br` **não é a Cory**. É a eximIA Academy usada pela **Argos**, que vai dar treinamentos em várias empresas. A Cory é uma dessas empresas.

## O que isso muda

O modelo atual tem dois níveis: **eximIA (super_admin) → empresas (tenants)**. A Argos exige um terceiro nível no meio:

```
eximIA (super_admin)
  └── Parceiro (ex.: Argos) — admin de parceiro cadastra e gerencia as empresas dele
        └── Empresa (tenant, ex.: Cory) — isolada por RLS como hoje
              └── Áreas / usuários
```

## Consequências imediatas (já tratadas nesta rodada)

- O backfill de `tenant_domains` que apontava `argos.eximiaacademy.com.br` para o tenant `cory-alimentos` estava **errado**. No projeto novo (`eximia-academy-multi`) ele não tem efeito porque esse tenant não existe lá. Em produção **não deve ser aplicado** sem revisão.
- `brand.partnerName` / `brand.partnerLogo` já existem no shape da marca e servem para "Academy by Argos" na tela da empresa, mas não dão à Argos nenhum poder de cadastrar empresas.

## O que precisa ser desenhado (próxima feature, fora do deploy de hoje)

| Peça | Proposta inicial |
|---|---|
| Tabela `partners` | `id, name, slug, brand jsonb, host text` (ex.: `argos.eximiaacademy.com.br`) |
| `tenants.partner_id` | nullable; empresas da eximIA direta ficam `NULL` |
| Papel `partner_admin` | novo chapéu em `user_roles`; alcança só tenants com o mesmo `partner_id` |
| Cadastro | o wizard atual ganha o campo "parceiro"; o `partner_admin` vê o mesmo wizard com o parceiro travado |
| Host do parceiro | `argos.eximiaacademy.com.br` resolve para o **parceiro** (portal/login da Argos), não para uma empresa; as empresas da Argos continuam em `{slug}.eximiaacademy.com.br` |
| Marca | empresa sem `brand` herda a marca do parceiro antes de cair no NEUTRO |
| RLS | `partner_admin` lê/escreve `tenants` onde `partner_id` = o dele; dados de aluno continuam isolados por `users.tenant_id` |

Decisões abertas para o Hugo: subdomínio de dois níveis (`cory.argos.eximiaacademy.com.br`) ou um nível só com parceiro como atributo (recomendo um nível só: o wildcard e o certificado continuam os mesmos).
