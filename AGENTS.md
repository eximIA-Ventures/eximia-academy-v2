# AGENTS.md — eximIA Academy v2

> Mínimo denominador comum entre ferramentas (Claude, Codex, ou qualquer CLI futuro).
> Se sua ferramenta lê CLAUDE.md, este arquivo é a base — CLAUDE.md estende, não repete.

## O produto (o que você está construindo, não só como)

eximIA Academy v2 é uma **LMS (Learning Management System) B2B com IA socrática** — o
aluno pensa, a IA provoca com perguntas, nunca entrega resposta pronta. Não é tutoria
passiva, é o diferencial central do produto.

- **Multi-tenant isolado**: cada empresa cliente (tenant, ex: "Harven Agribusiness") tem
  dados isolados via Row Level Security no Supabase — nunca vazam entre tenants.
- **White-label**: cada tenant pode ter cores, logo e domínio próprios.
- **Hierarquia de acesso**: Super Admin (eximIA) → Tenant → Unidade Operacional → Usuários
  (admin gerencia o tenant / manager gerencia unidades e times / instructor cria e publica
  cursos / student consome conteúdo).
- **Planos de tenant**: essencial (cursos básicos, sem IA avançada) / standard (IA
  socrática inclusa) / premium (white-label completo, domínio próprio, analytics avançado).
- **Deploy**: Docker + EasyPanel numa VPS — **não usa Vercel**.

Antes de qualquer tarefa que toque regra de negócio, produto ou UX, releia esta seção —
uma feature tecnicamente correta mas que quebra o "a IA nunca entrega resposta pronta" é
bug de produto, mesmo passando no gate mecânico.

## O projeto

Monorepo turbo + pnpm. Next.js 15 em dois apps, um microserviço Python, Supabase como banco.

**Tabela de workspaces (path, o que é, comando dev): [README.md § Workspaces](./README.md#workspaces).**
Fonte única, não duplicar aqui. Cada workspace tem seu próprio README com o detalhe interno.

Dois paths que não são workspace e importam para quem executa tarefa:

| Path | O que é | Comando |
|:---|:---|:---|
| `supabase/migrations` | Schema do banco | `supabase db push` |
| `docs/stories`, `docs/epics`, `docs/qa` | SDC do projeto (fora do escopo dos terminais de execução) | — |

## Comandos de gate (a fonte da verdade, não invente outros)

```bash
pnpm typecheck   # tsc --noEmit em cada workspace
pnpm lint        # biome check
pnpm build       # turbo build
pnpm test        # turbo test
pnpm test:e2e    # playwright
```

Rode `.maestri/gate.sh` — ele executa typecheck+lint+build nessa ordem e para no primeiro erro.

## Regra de ouro: seu trabalho não está pronto até o gate passar

Nenhum agente (Claude ou Codex) declara uma tarefa concluída pela própria palavra.
`.maestri/gate.sh` é quem decide. Se falhar, o trabalho volta, não é aceito.

## Protocolo de handoff (arquivo, não conversa solta)

Cada terminal tem uma pasta em `.maestri/handoffs/{terminal}/`:
- `spec.md` — o briefing da tarefa. Escrito pelo Fable (orquestrador). Imutável durante a execução.
- `result-NNN.md` — o que você fez. Incremental, nunca sobrescreva um `result-NNN.md` existente.
- `state.md` — status: `pending` / `in-progress` / `gate-pass` / `gate-fail` / `done`.
- `LOCK` — se existir, contém os paths que você está tocando AGORA. Antes de editar qualquer
  arquivo, confirme que ele não está sob LOCK de outro terminal (ver `.maestri/ownership.yaml`).

## Regra de ouro: nunca dois terminais no mesmo arquivo ao mesmo tempo

Motivo real, não hipotético: em 2026-07-03, duas rodadas Codex diferentes (sem lock) editaram
o MESMO arquivo `apps/web/src/app/(platform)/dashboard/_components/manager-team-dashboard-page.tsx`
sem saber uma da outra. Ver `.maestri/ownership.yaml` para o mapa de dono por diretório.

## Caminhos intocáveis

`node_modules/`, `.next/`, `.turbo/`, `supabase/.branches/`, `supabase/.temp/`, `tsconfig.tsbuildinfo`, `pnpm-lock.yaml` (regenerar via `pnpm install`, nunca editar à mão).
