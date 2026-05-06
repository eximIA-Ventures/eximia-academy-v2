# eximIA Academy v2 — Roadmap

## Engagement Features (Prioridade Alta)

| # | Feature | Descrição | Esforço |
|:--|:---|:---|:---|
| 1 | **Certificado automático** | PDF com QR code validável ao completar curso/trilha. RH pode exigir. | ~2h |
| 2 | **Ranking por setor/área** | Competição entre unidades gerenciais. Gestor cobra equipe. | ~3h |
| 3 | **Notificação WhatsApp** | Push via Twilio/WA Business API. Canal certo para chão de fábrica. | ~4h |

## Engagement Features (Prioridade Média)

| # | Feature | Descrição | Esforço |
|:--|:---|:---|:---|
| 4 | **Streak diário/semanal** | Micro-metas com badges visuais. Gamificação leve. | ~3h |
| 5 | **Desafio semanal do gestor** | Gestor publica desafio prático, alunos respondem via reflexão. | ~3h |
| 6 | **Resumo semanal por email** | Social proof + FOMO ("5 colegas completaram, você está no módulo 1"). | ~2h |

## Engagement Features (Incremental)

| # | Feature | Descrição | Esforço |
|:--|:---|:---|:---|
| 7 | **Onboarding gamificado** | Tour guiado no primeiro acesso com vitória rápida. | ~2h |
| 8 | **Modo "5 minutos"** | Botão "tenho 5 min" puxa próximo slide/reflexão pendente. | ~2h |

## Central (Super Admin)

| # | Feature | Descrição | Esforço |
|:--|:---|:---|:---|
| 1 | **CRUD de tenants** | Criar/editar clientes, ver status de deploy | ~4h |
| 2 | **Toggle de módulos** | Habilitar/desabilitar módulos por tenant | ~2h |
| 3 | **Billing/licenças** | Controle do que cada tenant paga, histórico | ~4h |
| 4 | **Health dashboard** | Status de cada deploy, uptime, métricas | ~3h |
| 5 | **Magic link cross-tenant** | Admin acessa qualquer tenant como gestor | ~2h |

## Já Implementado (v2)

- [x] Arquitetura modular (9 módulos toggle)
- [x] Single-tenant per deploy (branch model)
- [x] Notificações por email (Resend)
- [x] Revisão de curso concluído (sem refazer)
- [x] Central app scaffold
- [x] Rate limiting (Upstash Redis)
- [x] Reflexões interativas inline
- [x] "Aprofundar com IA" — sessão socrática
- [x] Analytics por aluno e por curso
- [x] Assessments (Big Five, DISC, Enneagram, Kolb, etc.)
- [x] Teaching plan com deadlines
- [x] Unidades Gerenciais (módulo)
- [x] Restart course
- [x] Slide viewer imersivo
