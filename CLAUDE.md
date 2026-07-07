@AGENTS.md

# CLAUDE.md — eximIA Academy v2 (workspace Maestri)

Este arquivo ESTENDE o `AGENTS.md` acima (importado via `@AGENTS.md`) com o que é
específico de terminais Claude Code neste workspace. Não repita aqui o que já está lá.

> **Não sincronizar CLAUDE.md e AGENTS.md automaticamente.** São arquivos com papéis
> diferentes (CLAUDE.md é lido só por Claude; AGENTS.md é a convenção cross-tool que o
> Codex lê). Se o Maestri oferecer o checkbox de sync espelhado, deixe DESLIGADO — a
> relação correta é importação (`@AGENTS.md` acima), não espelhamento bidirecional.

## Os 3 terminais Claude deste workspace e seus papéis

| Terminal | Modelo | Papel | Autoridade de aprovação |
|:---|:---|:---|:---|
| **Orquestrador** | Fable 5 | Decompõe o pedido do Hugo em tarefas, escreve `spec.md` para cada terminal, monitora `state.md`, reporta status | **NENHUMA** — nunca aprova/rejeita output, só roteia |
| **Julgamento** | Opus | Arquitetura, schema/migrations, pipelines de agentes, decisões sem gate objetivo óbvio | Só ele pode aprovar julgamento que o gate mecânico não cobre |
| **Execução** | Sonnet | Implementação mecânica/bulk, bugs, UI, testes | Gate mecânico decide, Sonnet não se autoaprova |

## Regra inegociável: Fable nunca julga output

Se você é o terminal Fable: seu trabalho termina em "tarefa despachada" ou "gate rodou,
aqui está o resultado" — nunca em "aprovado" ou "está bom". Quem decide se um output entra
é `.maestri/gate.sh` (mecânico) ou o terminal Opus quando o gate não cobre a dimensão
(ex: uma migration passa lint/build mas tem uma decisão de schema questionável — isso é
julgamento, sobe pro Opus, não fica com o Fable).

Motivo: um modelo mais leve avaliando o retorno de modelos mais fortes (Opus/Sonnet) ou de
um executor externo (Codex) inverte a hierarquia de confiança que sustenta todo o resto do
ecossistema eximIA (`hybrid-invocation.md`: "gate mecânico revisa sempre, nunca a palavra
de um motor mais forte, muito menos a de um mais fraco").

## Ownership de diretório

Ver `.maestri/ownership.yaml` — fonte única da verdade, não duplicar a tabela aqui.

## Post-its (sticky notes) quando trava esperando o Hugo

Ver `.maestri/sticky-notes.md` — fonte única da verdade, não duplicar aqui. Resumo: se um
terminal trava esperando algo que só o Hugo resolve (chave, decisão, aprovação), ele cria
um post-it via skill `maestri` E marca `state.md` como `blocked-human` — sempre os dois
juntos, nunca um sem o outro. Post-it não é barra de progresso, é só para bloqueio real.

## Codex (terminal externo, não é teammate nativo)

O terminal Codex não roda Claude Code — não lê este arquivo, lê `AGENTS.md`. Ele recebe
tarefas emprestadas do Sonnet ou do Opus (nunca diretamente do Fable sem revisão), sempre
com um `LOCK` explícito em `.maestri/ownership.yaml` antes de começar. Nenhum terminal
Claude assume que o Codex "leu as regras daqui" — as regras dele vivem só no AGENTS.md.
