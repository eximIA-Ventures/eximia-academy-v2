// ---------------------------------------------------------------------------
// ComparisonInsightsTable — "Meu ritmo": formato TRANSPOSTO (Hugo 2026-07-14,
// redesenhado em SH-1.5 2026-07-18)
// ---------------------------------------------------------------------------
// Redesign aprovado: uma linha POR INDICADOR, colunas fixas
//   | Indicador | Você (Eu {nome}) | Turma | Como estou |
// 5 linhas, na ordem exata do mockup do Hugo (SH-1.5): Última atividade ·
// Progresso - conclusão · Interações realizadas · Reflexões realizadas ·
// Engajamento. (Engajamento voltou a ser LINHA PRÓPRIA em SH-1.5, como score
// absoluto comparável Você vs Turma; antes de SH-1.5 ele ficava fora da tabela.)
//
// FRAÇÃO GRACIOSA X/Y (SH-1.5, Round 2 Hugo 2026-07-18: nos DOIS lados agora):
//   • Interações realizadas → Você "{interactions}/{interactionsMax}" (Y = capítulos
//     da trilha do aluno); Turma "{interactionsAvg}/{interactionsMaxAvg}" (Y = média
//     dos tetos da org).
//   • Reflexões realizadas  → Você "{reflections}/{reflectionsMax}" (Y = slides com
//     reflexão possível da trilha); Turma "{reflectionsAvg}/{reflectionsMaxAvg}".
//   Cada lado degrada ao absoluto "X" quando o denominador vem ausente/0, sem
//   NaN/crash (formatFraction).
//   Engajamento é ASSIMÉTRICO (Round 2 + Round 6): a célula VOCÊ mostra o RANKING
//   (formatRank), e a célula TURMA mostra a média de pontos em texto. Round 6 (Hugo
//   2026-07-18, feedback por áudio olhando o app ao vivo) fez QUATRO ajustes nesta
//   linha e no ranking:
//     (a) [aplicado por agente anterior] a célula TURMA perdeu o DENOMINADOR: passou
//         do "13/57" para o número absoluto "13" (o "/57", teto engagementMaxAvg,
//         confundia ao vivo);
//     (b) [aplicado por agente anterior] o BOTÃO acionável virou UNIVERSAL (ver bloco
//         próprio abaixo);
//     (c) o RANKING da célula VOCÊ perdeu o "de N": mostra SÓ a posição "3º", não mais
//         "3º de 15" (o Hugo tirou o total de alunos — "tira o 46" no app real; a
//         posição importa, o tamanho da população não). formatRank ainda RECEBE e
//         VALIDA `total` (rank tem de ser ≤ total p/ ser válido), só não o exibe;
//     (d) a célula TURMA de Engajamento foi CONSOLIDADA numa ÚNICA frase "a turma fez,
//         em média, {N} pontos". Antes tinha o número solto "13" (ValueCell) MAIS a
//         legenda-espelho "Turma fez {N} pontos, em média" (Round 5) embaixo — dois
//         elementos redundantes. Agora é só a frase, sem número isolado acima, e sem a
//         legenda `-raw` separada. Interações/Reflexões seguem com fração X/Y nos dois
//         lados (não mudaram no Round 6). O vencedor/cor/leitura da linha continuam
//         sobre os SCORES brutos (s.engagement vs r.engagementAvg), só o texto muda.
//
// COMO ESTOU — a 4ª coluna (renomeada de "Leitura" em SH-1.5) traduz o vencedor
// de cada indicador (winnerOf) em um CHIP TONAL compacto, com frases mais longas.
// (Round 2, Hugo 2026-07-18: o prefixo "…" foi REMOVIDO de todas as frases; o
// texto começa direto pela palavra.)
//   • aluno acima  → reforço, verde suave + TrendingUp ("acima da média",
//     "ritmo acima da média", "ativo acima da média");
//   • empate       → neutro + Minus ("no ritmo da turma");
//   • aluno abaixo → NUNCA punitivo, sempre acionável, tom cerrado (convite) +
//     seta ("vamos retomar?", "1 sessão te recoloca no ritmo"). Jamais vermelho.
//     [HISTÓRICO SH-1.5/Round 2 — a COR desta regra foi REVERTIDA no Round 3, ver
//     o bloco datado 2026-07-18 logo abaixo. A copy do convite permanece; o que
//     mudou é a temperatura da cor (agora amarelo/vermelho por severidade).]
//   A linha Engajamento tem tratamento ESPECIAL: a frase "1º da turma –
//   Parabéns!" só aparece quando o backend confirma rank real = 1 (sem empate),
//   via `subject.isTopEngagement === true` (AC7). Nunca hardcoded, nunca
//   aproximado — qualquer outro caso cai no fallback padrão win/tie/behind.
//
// SEVERIDADE QUANDO ATRÁS — REVERSÃO EXPLÍCITA DO HUGO (Round 3, 2026-07-18):
//   O comentário histórico logo acima dizia "Jamais vermelho" — essa era a regra
//   de SH-1.5/Round 2: aluno atrás → SEMPRE o tom cerrado (laranja/terroso),
//   nunca vermelho, para não ser punitivo. **O Hugo REVERTEU essa decisão nesta
//   rodada, por escolha própria, olhando o app rodando ao vivo.** Passa a haver
//   DOIS graus de severidade quando o aluno está atrás (winner === "reference"):
//     • "behind-mild"   → AMARELO  (atrás moderado): bg-semantic-warning/10 text-semantic-warning
//     • "behind-severe" → VERMELHO (atrás forte):    bg-semantic-error/10   text-semantic-error
//   O grau vem de `behindSeverityOf` (função pura, direction-aware, ver abaixo),
//   comparado ao SEVERE_BEHIND_THRESHOLD. Vale para as 5 linhas (mudança central,
//   não by-linha). O comentário "Jamais vermelho" foi PRESERVADO de propósito
//   logo acima: documentar a mudança de rumo importa mais que apagar o rastro.
//
//   [HISTÓRICO SH-2.5 (Hugo 2026-07-19) — a distinção mild/severe deste bloco foi
//   REMOVIDA. `behindSeverityOf`/`SEVERE_BEHIND_THRESHOLD` não existem mais;
//   `winnerOf` passou a usar uma FAIXA DE TOLERÂNCIA (`TONE_THRESHOLDS`, 5%) para
//   decidir tie vs win/behind — fora da faixa já É "behind" (vermelho direto, sem
//   gradiente). Ver o comentário de `winnerOf`/`TONE_THRESHOLDS` para a regra
//   atual. Preservado aqui pelo mesmo motivo do parágrafo acima: o rastro importa.]
//
// DESTAQUE DO VALOR VENCEDOR (Hugo, iterado 2026-07-14; estendido Round 3
// 2026-07-18): quando o ALUNO vence o indicador, o VALOR da coluna Eu veste o
// PILL original (cápsula semantic-success + texto branco). Round 3: quando o
// aluno está ATRÁS, o valor Eu TAMBÉM vira pill — mas na cor da severidade
// (amarelo ou vermelho), no lugar do texto neutro de antes. Empate continua
// neutro/sem pill. O valor destaca, o chip interpreta. A coluna Turma nunca
// destaca, em nenhum caso.
//
// SEM setas de ordenação (não se ordena uma tabela transposta) e SEM a coluna
// "Onde você está" (removida no formato transposto).
//
// WINNER-PER-INDICATOR (direction-aware, alimenta a Como estou e o destaque acima):
//   • Progresso / Interações / Reflexões / Engajamento → MAIOR vence.
//   • Última atividade → MENOR vence (recência invertida).
// Empate ou valor ausente não gera leitura de vitória/convite.
//
// PARÁGRAFO-RESUMO (SH-1.5): a frase pessoal abaixo da tabela é composta pela
// função pura `buildRitmoSummary` (ritmo-summary.ts), fora deste arquivo — o
// container (StudentHomeCard) chama e renderiza. Ver aquele módulo.
//
// BOTÃO ACIONÁVEL UNIVERSAL (Round 4 → generalizado no Round 6, Hugo 2026-07-18,
// feedback por áudio ao vivo): ao lado do chip "Como estou" aparece um LINK
// COMPACTO que leva o aluno de volta à ação (retomar a trilha, registrar uma
// reflexão, etc.).
//   • Round 4 (histórico): o botão só aparecia quando o aluno estava ATRÁS naquele
//     indicador (winnerOf === "reference"), como convite condicional para quem
//     estava mal. Em win/tie/none não aparecia.
//   • Round 6 (MUDANÇA): o gate `winner === "reference"` foi REMOVIDO. O botão passa
//     a ser UNIVERSAL — renderizado em TODAS as 5 linhas, independentemente de o
//     aluno estar ganhando, empatado ou atrás. Deixou de ser "convite para quem está
//     mal" e virou um CTA de "continue melhorando" (o Hugo, olhando o app ao vivo:
//     "mesmo para o Rinaldo, tem que ter os botões para melhorar ainda mais a
//     performance dele"). A COR é sempre a mesma (cerrado/laranja) para todas as
//     linhas — NÃO varia por severidade (o Hugo pediu só presença universal). A
//     severidade amarelo/vermelho do CHIP e do PILL do valor (Round 3) segue
//     intocada, ainda condicionada a winner === "reference".
// A copy do botão é por indicador (ACTION_LABEL, paralela a LEITURA_COPY) — os
// labels já são neutros/genéricos o suficiente para servir tanto a quem está atrás
// quanto a quem está ganhando, sem reescrita. O destino é SEMPRE o mesmo
// `continueHref` recebido (o link de continuação da trilha que o card já tem): HOJE
// NÃO EXISTE deep-link para uma reflexão ou interação ESPECÍFICA no app, então
// continuar a trilha naturalmente leva o aluno a mais interações/reflexões. Decisão
// pragmática — se o Hugo pedir deep-link específico depois, é só trocar o href por
// linha. `continueHref` é threaded do StudentHomeCard (que já o tem como prop);
// default seguro DEFAULT_CONTINUE_HREF para não obrigar todos os call sites.
//
// COR DO BOTÃO RELATIVA AO "COMO ESTOU" (Round 7, Hugo 2026-07-18, feedback por
// áudio olhando o app ao vivo): "faça uma melhoria nos botões de ação e faça com que
// eles sejam relativos ao 'Como estou', de cores e relação." Até a Round 6 o
// ActionButton era SEMPRE cerrado/laranja (`bg-cerrado-600`), uma cor fixa
// desconectada do status da linha. Agora a cor de FUNDO do botão ESPELHA o tom da
// leitura da MESMA linha (`leitura.tone`), criando uma relação visual coerente entre
// o chip "Como estou" e o botão logo ao lado. A paleta vive em `ACTION_BUTTON_STYLE`
// (paralela a `LEITURA_CHIP`), indexada pelos 5 tons possíveis:
//   • win          → VERDE sólido (bg-semantic-success text-white): CTA positivo de
//     "continue assim", suave, não gritante.
//   • tie          → NEUTRO (mesma família cinza/muted do LEITURA_CHIP.tie).
//   • behind-mild  → ÂMBAR/AMARELO (bg-semantic-warning), espelhando o chip mild. O
//     token warning é claro (oklch 0.8 de lightness), então o par de texto é
//     text-black/80 — NÃO branco. Este par (fundo warning sólido + texto escuro) é o
//     MESMO padrão de contraste já validado no app (analytics-dashboard.tsx usa
//     `bg-semantic-warning/70 text-black/70`), reusado aqui em vez de inventar novo.
//   • behind-severe→ VERMELHO sólido (bg-semantic-error text-white), espelhando o
//     chip severe, forte para comunicar urgência real. O token error é oklch 0.6
//     (escuro), então texto branco tem contraste OK (mesmo par de
//     trails-list-client.tsx `bg-semantic-success text-white`).
//   • none         → o CERRADO/laranja ORIGINAL (bg-cerrado-600 text-white), mantido
//     como fallback neutro-padrão quando não há leitura possível (dado ausente).
// A relação chip↔botão é DIRETA: mesma fonte de verdade (`leitura.tone`), nenhuma
// conta paralela. [HISTÓRICO — na Round 7 o BOTÃO ficava no tom SÓLIDO (fundo cheio
// + texto de contraste); o Round 8 abaixo trocou o botão para o MESMO tom SUAVE /10
// do chip, ver o bloco datado logo a seguir.] O botão segue UNIVERSAL (Round 6):
// aparece nas 5 linhas sempre, ganhando/empatando/atrás.
//
// ROUND 8 — ALINHAMENTO EM COLUNAS + HIERARQUIA DE COR (Hugo 2026-07-18, feedback ao
// vivo olhando o app + 2 screenshots: "esse visual ta bem ruim, tudo muito igual,
// desalinhado e etc."). Três correções, cada uma de uma causa raiz concreta:
//   (1) DESALINHAMENTO (estrutural): o chip "Como estou" e o botão viviam numa ÚNICA
//       <td> com `<div className="flex flex-wrap">`. Como o chip varia de largura entre
//       linhas ("ativo acima da média" vs "no ritmo da turma"), o botão ao lado começava
//       em X diferente por linha — parecia desalinhado porque NÃO era uma coluna de
//       verdade, era flexbox dentro de uma célula. AGORA são DUAS <td>s reais (chip |
//       ação): o <thead> ganhou uma 5ª <th> (rótulo sr-only "Ação") e cada <tr> tem 2
//       <td> no lugar de 1. Colunas nativas de <table> alinham sozinhas em todas as
//       linhas — a ferramenta certa p/ "alinhar em coluna", não flex. testids
//       `leitura-*`/`action-*` INTACTOS, só mudou o contêiner.
//   (2) TEXTO PEQUENO (explícito, screenshot 2): a frase "a turma fez, em média, {N}
//       pontos" (célula Turma da linha Engajamento) usava `text-xs text-text-muted`
//       (12px, tamanho de legenda secundária) — mas desde o Round 6 essa frase é o
//       ÚNICO conteúdo primário daquela célula. Passou p/ `text-sm font-medium
//       text-text-muted`, o MESMO peso tipográfico que ValueCell usa nas outras células
//       Turma (dim=true), alinhando essa célula às demais da coluna em vez de inventar
//       um tamanho novo.
//   (3) MONOTONIA DE COR ("tudo muito igual"): num aluno vencendo, cada linha repetia
//       VERDE SÓLIDO 3x — o pill do valor Você (win), o chip (win /10) e o BOTÃO (win
//       sólido, decisão do Round 7). Três blocos fortes idênticos apagavam a hierarquia.
//       O `ACTION_BUTTON_STYLE` trocou de fundo SÓLIDO para TINTADO /10 (mesma família do
//       LEITURA_CHIP), texto na cor semântica sólida (não branco). Preserva a RELAÇÃO de
//       cor por tom do Round 7 (o botão ainda espelha `leitura.tone`), mas com peso leve:
//       agora só o PILL do valor (o dado numérico real) é SÓLIDO por linha; o chip e o
//       botão ficam ambos suaves /10 (mesma família entre si) — hierarquia clara de 1
//       elemento forte (o número) + 2 leves de apoio (explicação + ação), em vez de 3
//       fortes competindo. NÃO reverte a decisão do Round 7 de "cor relativa ao Como
//       estou" (o Hugo pediu isso na rodada anterior); só baixa o PESO visual do botão.
//
// ROUND 9 — CÉLULA TURMA/ENGAJAMENTO EM 2 LINHAS, ESPELHANDO O LADO VOCÊ (Hugo
// 2026-07-18, feedback ao vivo + screenshot da célula que o Round 8 acabou de tocar):
// a célula Você da linha Engajamento já tem 2 linhas (pill de ranking "11º" em cima +
// legenda muted "Você fez N pontos" embaixo). O Hugo quis a MESMA estrutura do lado
// Turma: a POSIÇÃO fica no Você, o TAMANHO DA POPULAÇÃO no Turma — juntas, as duas
// células reconstroem "11 de 46". O "de 46" tinha sido tirado do texto do rank no
// Round 6 (por um pedido ANTERIOR do Hugo); agora ele quer a informação de volta, só
// que do lado Turma em vez de colada no rank. A célula Turma passou de UMA frase
// ("a turma fez, em média, {N} pontos") para DUAS linhas:
//   • TOPO (valor principal, `text-sm font-medium`, peso das demais células Turma):
//     o total de pessoas via `formatPopulation(subject.engagementTotalStudents)` — o
//     MESMO campo que já alimenta `formatRank`, NENHUM cálculo novo.
//   • BAIXO (legenda muted `text-xs text-text-muted`, mesmo estilo da legenda "Você
//     fez N pontos"): "Média da turma: {N} pontos" (`reference.engagementAvg`, a MESMA
//     fonte de sempre; a unidade "pontos" foi acrescentada no Round 11, screenshot #2 do
//     Hugo — antes ficava só "Média da turma: {N}", sem a unidade).
// Degradação graciosa: total ausente/malformado → `formatPopulation` devolve null e a
// linha de topo é OMITIDA (sem "undefined pessoas"), a legenda da média segue sozinha —
// mesmo espírito defensivo de `formatRank`/`formatFraction`. `data-testid`
// `cell-reference-engagement` migrou para o valor principal (linha de topo); a legenda
// da média ganhou `cell-reference-engagement-avg`.
//
// ROUND 10 — ÍCONES SEMÂNTICOS POR AÇÃO + DIFERENCIAÇÃO BOTÃO↔CHIP (Hugo 2026-07-18,
// feedback ao vivo com screenshot dos Rounds 8/9 aplicados: "precisamos melhorar o
// visual dos botões agora, ta tudo muito igual. precisamos dos botões com alguns ícones
// e etc"). Dois problemas, duas correções:
//   (1) ÍCONE GENÉRICO REPETIDO: até a Round 9 os 5 botões terminavam todos no MESMO
//       `ArrowRight` — visualmente idênticos entre si. Agora cada linha ganha um ícone
//       SEMÂNTICO próprio (`ACTION_ICON`, paralelo a `ACTION_LABEL`), à ESQUERDA do
//       texto (posição de liderança): RotateCcw (retomar), Play (continuar sessão),
//       MessageSquare (interação), Pencil (registrar reflexão), Zap (continuar agora).
//       Os 5 glifos são visualmente distintos e TODOS já pertencem ao vocabulário do
//       app (reuso comprovado por grep em src, não invenção). O `ArrowRight` menor e
//       esmaecido fica ao final como affordance de clique.
//   (2) BOTÃO PARECIDO DEMAIS COM O CHIP: desde o Round 8 o botão e o chip "Como estou"
//       ao lado ficaram ambos em pill tintado /10, competindo por serem iguais um ao
//       outro (parte do "ta tudo muito igual"). Diferenciação incremental (NÃO reverte o
//       tom /10 do Round 8): o botão ganhou um ANEL sutil na cor do tom
//       (`ring-1 ring-{tone}/25`) — silhueta de elemento clicável que o chip não tem —
//       e o peso da fonte subiu de `font-semibold` para `font-bold`. O chip segue só
//       fundo /10 sem anel; o olho passa a distinguir "ação" (contorno + bold + ícone
//       de liderança) de "status" (chip liso).
//
// ROUND 11 — BOTÃO DE AÇÃO ADOTA O DESIGN SYSTEM REAL (Uma / @ux-design-expert, Hugo
// 2026-07-18, com screenshot da tabela renderizada: "coloca os botões em outro estilo,
// não tá legal ainda" — sem dizer QUAL estilo, só que o atual não funciona). Depois de 3
// rodadas de ajuste de cor DENTRO da pill inventada (Round 7 cor sólida por tom, Round 8
// tintado /10, Round 10 anel + ícone), o botão ainda não convencia. Diagnóstico de design:
// o sintoma se repetia porque a CAUSA era estrutural, não de paleta. O `ActionButton`
// nasceu no Round 4 como uma PILL desenhada à mão (rounded-full, cor tintada por tom,
// reinventada rodada a rodada) e NUNCA usou o design system do app. O app inteiro fala
// `buttonVariants` de `@eximia/ui` (cva-based, dezenas de call sites: trails, assessments,
// workspace, brandbook, not-found) — inclusive o padrão IGUAL ao nosso, `<Link href
// className={buttonVariants({ variant })}>` em `not-found.tsx`. O botão "não parecia certo"
// porque estava FORA da linguagem visual do resto do app.
//   CORREÇÃO: base = `buttonVariants({ variant: "outline", size: "sm" })` (a variante
//   outline do DS é a certa para um CTA compacto e discreto numa célula de tabela densa:
//   contorno + hover que revela a marca cerrado, sem competir com o pill de valor sólido).
//   Ganha os estados que a pill não tinha (foco visível, hover/active reais, rounded-xl,
//   tipografia e transições da casa). A RELAÇÃO cor↔tom do Round 7 é PRESERVADA (requisito
//   ativo do Hugo, não descartado): o tom da leitura tinge a base outline por cima via
//   `ACTION_TONE` (cor do texto + do anel de contorno na família semântica do tom). Chip e
//   botão seguem a MESMA fonte de verdade (`leitura.tone`), coerentes — mas o botão é agora
//   o Button do DS vestido pelo tom, não uma cápsula paralela. Universalidade (Round 6),
//   ícone semântico + iconTestid (Round 10), ArrowRight de affordance, href e testids
//   `action-*`/`action-icon-*` INTACTOS. Ação #2 desta rodada: a legenda da célula
//   Turma/Engajamento corrigida de "Média da turma: {N}" para "Média da turma: {N} pontos"
//   (faltava a unidade). `ACTION_BUTTON_STYLE` (a paleta da pill) foi SUBSTITUÍDO por
//   `ACTION_TONE`; o rastro histórico dos Rounds 7/8/10 fica preservado neste cabeçalho.
//
// ROUND 12 — PILL SÓLIDA SATURADA POR TOM (Uma / @ux-design-expert, Hugo 2026-07-18, com
// screenshot de referência: "o que acha de usar outras cores? ou usa esse estilo de botão").
// A referência mostra pills SÓLIDAS/SATURADAS (fundo cheio na cor do tom, texto branco em
// negrito, ícone forte à esquerda, formato rounded-full) — peso visual bem mais forte que o
// outline do Round 11 e que o tintado /10 do Round 8. O Hugo confirmou EXPLICITAMENTE:
// manter os 5 RÓTULOS específicos por métrica que já temos (Retomar atividade, Continuar
// sessão, Fazer uma interação, Registrar uma reflexão, Continuar agora), adotar SÓ o peso/
// saturação da referência (não os rótulos genéricos por status "Lembrar"/"No ritmo"/
// "Acionar" da imagem).
//   REAVALIAÇÃO DO PRECEDENTE DO ROUND 8 (o sólido foi abandonado lá por monotonia): no
//   Round 8 os botões eram idênticos entre si (mesmo ArrowRight, sem rótulo forte
//   diferenciado), então 4 fundos verdes viravam "tudo igual". Desde o Round 10 cada linha
//   tem ícone semântico próprio (RotateCcw/Play/MessageSquare/Pencil/Zap) + rótulo específico
//   por métrica — a monotonia que motivou o Round 8 já está quebrada por ícone + texto
//   distintos por linha. O sólido volta com segurança; decisão consciente, precedente
//   reavaliado à luz do que mudou, não ignorado.
//   FORMA: rounded-full (fiel à referência e coerente com o chip "Como estou" vizinho, que
//   já é rounded-full), à mão em vez de buttonVariants (cujo outline + rounded-xl conflita
//   com o fundo sólido pedido). Os estados de acessibilidade que o Round 11 ganhava do DS
//   (foco visível, hover, active, transição) são reproduzidos à mão para não regredir.
//   CONTRASTE POR TOM (WCAG): win/severe/none → texto branco (tokens escuros o bastante);
//   behind-mild/warning (oklch L 0.8, claro) → texto PRETO (text-black/80), mesmo cuidado
//   já validado no app; tie → neutro sólido do DS (bg-elevated + border) com texto primário.
//   FAMÍLIA DE COR INTACTA (verde=win, âmbar/vermelho=atrás, neutro=empate, cerrado=fallback,
//   lógica central de leitura desde o Round 3): muda só a SATURAÇÃO (/10 → sólido), não a
//   família. `ACTION_TONE` reescrito de tintado para sólido; relação cor↔tom (Round 7),
//   universalidade (Round 6), ícone + affordance (Round 10), href e testids intactos.
//
// ROUND 13 — MAGREZA IDÊNTICA AO BOTÃO DO GESTOR (Uma / @ux-design-expert, Hugo 2026-07-18):
// "os botões estão muito gordos, coloca exatamente do mesmo jeito que tá lá no gestor". O
// Round 12 acertou a cor sólida/saturada, mas errou o TAMANHO: forçava `h-8` (altura fixa
// 32px) + `justify-center` + `font-bold`, engordando a pill vs a magreza do gestor. FONTE
// EXATA replicada: o botão de ação do card do gestor (`student-insights-table.tsx` linhas
// 854-899), literalmente de onde veio a imagem de referência do Round 12 ("No ritmo"/
// "Lembrar"/"Acionar"). Classe base agora IDÊNTICA: `inline-flex items-center gap-1.5
// rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all
// hover:brightness-110` — removidos `h-8`/`justify-center`/`whitespace-nowrap`/`duration-200`,
// `font-bold`→`font-semibold`, ícone `size={13}`→`size={14}` (o exato do gestor). Acréscimos
// nossos que o gestor não tem, justificados: `shrink-0` (coluna densa) e o foco visível
// (o gestor é <button>, o nosso é <a>/Link navegável, que precisa de indicador de foco).
// SÓ o TAMANHO/PESO muda — cor sólida por tom (Round 12), 5 rótulos específicos (Round 12),
// 5 ícones semânticos (Round 10), ArrowRight de affordance permanecem. A réplica é do
// TAMANHO/PESO/FORMA, não da semântica dos ícones do gestor (que são de outro contexto).
//
// ROUND 14 — EMPATE EM AMARELO CLARO/SUAVE (Uma / @ux-design-expert, Hugo 2026-07-18, com
// screenshot da linha "Progresso - conclusão" em empate 50%=50%): "ao invés de cinza, para
// os neutros vamos usar o amarelo". Levantei que o âmbar já é a cor de `behind-mild` desde o
// Round 3; o Hugo confirmou que o amarelo do empate deve ser MAIS CLARO/SUAVE, distinto do
// amarelo mais forte de `behind-mild` — família amarela nos dois, visualmente distinguíveis.
// SOLUÇÃO (uma única variável, não cor nova): reusar o MESMO token `semantic-warning` em
// OPACIDADE MENOR. No CHIP: `tie` foi de `bg-black/5 text-text-secondary` (cinza) para
// `bg-semantic-warning/5 text-semantic-warning/70` — mais fraco que o `/10 + texto pleno` do
// behind-mild. No BOTÃO: `tie` foi de `bg-bg-elevated + border` (neutro) para
// `bg-semantic-warning/40 text-black/70` — fundo âmbar PÁLIDO vs o `bg-semantic-warning`
// SÓLIDO 100% do behind-mild. A distinção empate↔atrás-moderado é a opacidade do mesmo token
// (/5 vs /10 no chip, /40 vs /100 no botão), mantendo a família coerente. O ícone `Minus` do
// chip tie PERMANECE (parity/no-change continua a leitura certa para empate; o pedido foi cor,
// não ícone). Os outros 4 tons (win verde, behind-mild âmbar forte, behind-severe vermelho,
// none cerrado), a magreza do gestor (Round 13), rótulos, ícones semânticos, testids e href
// intactos.
//
// ROUND 15 — O AMARELO DO EMPATE ESTAVA ABAIXO DO LIMIAR DE PERCEPÇÃO (Uma /
// @ux-design-expert, Hugo 2026-07-18, "cadê o amarelo?"): o Round 14 escolheu `/5` no chip e
// `/40` no botão — matematicamente mais claros que behind-mild, mas contra o fundo BRANCO da
// tabela (bg-card oklch 1.0) uma opacidade tão baixa some. O token warning é oklch(0.8 0.15
// 70); a 5% de opacidade a chroma efetiva cai para ≈ 0.0075 (imperceptível, o olho vê branco
// sujo). ERRO DE PROCESSO do Round 14: confiei na matemática "número menor = mais claro" sem
// verificar a cor PERCEBIDA sobre branco. Round 15 sobe a intensidade absoluta mantendo a
// hierarquia: CHIP `bg-semantic-warning/15 text-semantic-warning` (âmbar inequívoco, valor já
// PROVADO legível no app — skill-badge "Reflexão", badge "PUT"); BOTÃO `bg-semantic-warning/60
// text-black/80` (âmbar claramente amarelo, chroma efetiva ≈ 0.09, ainda mais suave que o
// sólido /100 do behind-mild). A distinção empate↔behind-mild continua: no BOTÃO pela
// opacidade (/60 vs /100); no CHIP sobretudo pelo ÍCONE (Minus parity vs ArrowRight acionável)
// e copy, já que ambos os chips são fill fraco. Demais 4 tons, magreza do Round 13, rótulos,
// ícones, testids e href intactos.
//
// ROUND 16 — DOIS PONTOS (Uma / @ux-design-expert, Hugo 2026-07-18, novo screenshot):
// (1) "O BOTÃO NÃO TÁ AMARELO" (o chip do Round 15 pegou, o botão não). CAUSA RAIZ (não era
//     reaplicar): o Tailwind v4 SÓ gera a regra CSS de uma opacidade `bg-semantic-warning/NN`
//     se aquela string EXATA for encontrada no scan. O `/60` que escolhi no Round 15 não
//     existia em NENHUM outro ponto do app, então a classe ia pro HTML SEM regra CSS
//     correspondente → fundo transparente → o botão parecia branco/outline (o `/15` do chip
//     funcionava porque `/15` já é usado no app — skill-badge). Prova: `grep` no CSS gerado
//     (`.next/static/css`) mostrava `/5 /10 /15 /20 /70` mas NÃO `/60`. CORREÇÃO: botão tie
//     usa `bg-semantic-warning/70 text-black/70`, o valor JÁ PRESENTE no CSS (o par exato de
//     `analytics-dashboard.tsx`, já citado neste cabeçalho). Reusar uma opacidade já no CSS
//     gerado GARANTE que renderiza. `.next` também foi limpo e o dev reiniciado para eliminar
//     cache stale. Lição: opacidade nova de token depende do scanner do Tailwind gerar a
//     regra; preferir valores já presentes no CSS ou verificar o CSS gerado.
// (2) "COLOCA DESTAQUE AMARELO NA COMPARAÇÃO TAMBÉM": o valor Você da linha em EMPATE (ex.:
//     "50%" na linha Progresso) ficava em texto neutro puro, sem pill — inconsistente com
//     win (pill verde) e behind (pill âmbar/vermelho), que sempre destacam o valor. Agora
//     `subjectPillFor` retorna `"tie"` quando `winner === null` E o tom é `"tie"` (empate
//     REAL: ambos os valores presentes e iguais — distinto de `"none"`/dado ausente, que
//     segue sem pill), e `VALUE_PILL.tie` = `bg-semantic-warning/15 text-semantic-warning`
//     (o MESMO amarelo suave já calibrado do chip, não um terceiro tom). Resultado: na linha
//     empatada, VALOR + chip + botão ficam todos na família amarela coerente.
//
// ROUND 17 — NO EMPATE, AS DUAS CÉLULAS DE VALOR DESTACAM (Uma / @ux-design-expert, Hugo
// 2026-07-18): reagindo ao pill amarelo que o Round 16 pôs na célula Você, o Hugo pediu
// "coloca o amarelo nos dois pois estão empatados". A lógica dele é direta: em win/behind só
// UM lado venceu, então só ele destaca; mas no EMPATE os dois têm o MESMO valor e por isso os
// DOIS merecem o mesmo destaque. Isto é uma EXCEÇÃO deliberada e datada à regra "a coluna
// Turma NUNCA destaca" que existe desde o Round 3 — a regra geral CONTINUA (win/behind: Turma
// neutra), só o empate real abre a exceção. Implementação sem duplicar lógica: computo
// `subjectPill = subjectPillFor(winner, leitura.tone)` UMA vez e derivo `isRealTie =
// subjectPill === "tie"`; a célula Você usa `subjectPill`, a Turma usa `isRealTie ? "tie" :
// null`. Mesma fonte de verdade de "empate real vs sem dado" do Round 16, reusada — não
// re-derivo o empate a partir de valores brutos. Amarelo idêntico (`VALUE_PILL.tie` /15).
//
// ROUND 21 — WIN: VERDE → LARANJA DE MARCA, HISTÓRICO (Hugo 2026-07-18, screenshot: "tem
// muito verde, então coloca por padrão no laranja da academy"): num aluno vencendo quase tudo,
// o verde (`semantic-success`) dominava a tela inteira — chip, pill do valor, botão. O Round 21
// trocou os 4 pontos (aqui NA TABELA + o cartão de resumo) para `cerrado`, interpretando o
// pedido como "o componente inteiro". Onde win colidiria visualmente com `none` (que já é
// laranja `cerrado-600` desde o Round 12/13) — só no botão de ação (`ACTION_TONE`) — win usou
// o degrau mais claro `cerrado-500`.
//
// ROUND 22 — CORREÇÃO DE ESCOPO (Hugo 2026-07-18, "cara, o laranja era só na frase. o resto
// era para manter verde"): o Round 21 interpretou LARGO DEMAIS — o pedido original era só
// sobre o CARTÃO de resumo (a manchete/glow do Round 20), não sobre a TABELA inteira. Isto é
// uma correção de INTERPRETAÇÃO do orquestrador, não um novo pedido do Hugo revertendo uma
// decisão de design sua (documentado com essa honestidade — ver Change Log). NESTA TABELA, win
// VOLTA a ser verde (`semantic-success`) em TODOS os 4 pontos que o Round 21 tinha mudado aqui
// (`WIN_BG`/`BAR_WIN_FILL`, `LEITURA_CHIP.win`, `ACTION_TONE.win`) — idêntico ao estado
// pré-Round-21. O laranja cerrado PERMANECE, mas SÓ no cartão de resumo
// (`RITMO_TONE_STYLE.win` em student-home-card.tsx), a única peça que o Hugo realmente pediu.
// A distinção de degrau `cerrado-500`/`cerrado-600` (criada no Round 21 para win/none não
// colidirem no botão de ação) deixa de existir NESTA TABELA — win não é mais cerrado aqui, e
// `none` nunca teve chip/pill, então não havia colisão nenhuma antes do Round 21 (o "problema"
// que o degrau resolveu só existiu porque o Round 21 introduziu win-cerrado onde não devia).
//
// Pure presentation. Card-less: o container (StudentHomeCard) é dono do Card,
// do subtítulo e do toggle Visão detalhada/Gráficos. Labels parametrizáveis:
// `studentFirstName` vira o cabeçalho da coluna do sujeito ("Eu (Rinaldo)";
// num drill de gestor, o nome do aluno), degradando para "Você".
// ---------------------------------------------------------------------------

import type { StudentHomeIndicators } from "@/types/analytics"
import { cn } from "@eximia/ui"
import type { LucideIcon } from "lucide-react"
import {
  ArrowRight,
  MessageSquare,
  Minus,
  Pencil,
  Play,
  RotateCcw,
  TrendingUp,
  Zap,
} from "lucide-react"
import Link from "next/link"
import { DEFAULT_CONTINUE_HREF } from "./student-comparison-view"

// ROUND 21 (histórico) — `win` virou `--color-cerrado-600` (laranja) aqui, interpretando o
// pedido do Hugo como "o componente inteiro". ROUND 22 — CORREÇÃO DE ESCOPO ("o laranja era
// só na frase, o resto era para manter verde"): revertido para `--color-semantic-success`
// (verde), o estado ORIGINAL de antes do Round 21. O laranja cerrado sobrevive só no cartão
// de resumo (`RITMO_TONE_STYLE.win`, student-home-card.tsx) — ver comentário datado acima.
const WIN_BG = "var(--color-semantic-success)"
const WIN_TEXT = "#ffffff"
const BAR_TRACK = "var(--color-bg-hover)"
const BAR_FILL = "rgba(0, 0, 0, 0.25)"
const BAR_WIN_FILL = "var(--color-semantic-success)" // ROUND 22 — revertido do laranja (Round 21)

/** Which side wins an indicator. null = tie, missing, or a no-winner column. */
type Winner = "subject" | "reference" | null

/**
 * SH-2.5 (Hugo 2026-07-19, feedback ao vivo olhando o app) — o Hugo viu Progresso
 * 50% vs Turma 67% (gap relativo ~25%) sair âmbar ("atrás moderado") e achou que
 * devia ser vermelho. Pergunta direta, resposta literal do Hugo: "ambar é quando
 * está igual em numeros, considerando um desvio padrao para mais ou para menos de
 * 5%. Se for mais que 5% muda para verde ou para vermelho." Isso substitui o
 * modelo antigo (win/tie/behind-mild/behind-severe, tie = igualdade EXATA) por um
 * modelo mais simples: tie vira uma FAIXA DE TOLERÂNCIA em torno da referência, e
 * a distinção mild/severe deixa de existir (fora da faixa = "behind", vermelho
 * direto, sem gradiente).
 *
 * CONFIGURÁVEL, NÃO HARDCODED: 1 constante nomeada, candidata a virar ajustável
 * num painel de administração futuro (o Hugo mencionou explicitamente que vai
 * construir um painel de configurações completo depois, incluindo essas
 * métricas — não construímos o painel agora, só evitamos espalhar o número).
 */
export const TONE_THRESHOLDS = {
  /** Faixa de tolerância ao redor da referência (Turma) que ainda lê como "tie". 0.05 = 5%. */
  tolerancePct: 0.05,
}

/**
 * The winning side of an indicator, DIRECTION-AWARE (Hugo): "higher" → larger
 * value wins (progresso, sessões, reflexões); "lower" → smaller wins (recência
 * invertida — hoje só usado fora da linha "Última sessão de estudo", que ganhou
 * leitura própria decoupled, ver `recencyReadingFor`).
 *
 * SH-2.5 — tie deixou de ser igualdade EXATA (`subject === reference`) e virou
 * uma FAIXA DE TOLERÂNCIA relativa (`TONE_THRESHOLDS.tolerancePct`). O sinal do
 * gap relativo decide o lado (positivo = subject melhor, negativo = subject
 * pior); a MAGNITUDE decide se é tie (dentro da faixa) ou um vencedor real (fora
 * dela). A fórmula de gap é a mesma direction-aware que `behindSeverityOf` usava
 * (removida nesta story — a distinção mild/severe não existe mais).
 */
export function winnerOf(
  subject: number | null,
  reference: number | null,
  direction: "higher" | "lower",
): Winner {
  if (subject === null || reference === null) return null
  const signedGap =
    direction === "higher"
      ? (subject - reference) / Math.max(reference, 1)
      : (reference - subject) / Math.max(reference, 1)
  if (Math.abs(signedGap) <= TONE_THRESHOLDS.tolerancePct) return null
  return signedGap > 0 ? "subject" : "reference"
}

/**
 * PONTO 1 acréscimo (Hugo 2026-07-14) — a label da coluna do sujeito: 1ª pessoa
 * + o PRIMEIRO nome real do aluno logado, "Eu (Rinaldo)". Recebendo o nome
 * completo, usa só o primeiro token; sem nome utilizável degrada para "Você"
 * (o cabeçalho aprovado do formato transposto). Pure.
 */
export function subjectColumnLabel(firstName: string | null | undefined): string {
  const first = firstName?.trim().split(/\s+/)[0]
  return first ? `Eu (${first})` : "Você"
}

/** "há X dias" / "hoje" — for the Último acesso cells. null → placeholder. */
function formatDays(days: number | null, whenNull: string): string {
  if (days === null) return whenNull
  if (days <= 0) return "hoje"
  if (days === 1) return "há 1 dia"
  return `há ${days} dias`
}

// SH-1.5 — a 5ª linha "Engajamento" (score absoluto Você vs Turma). A ordem/labels
// mudam (mockup do Hugo), mas as CHAVES internas preservam os nomes já testados de
// SH-F.5 e agregam `engagement`. `winnerOf`/`leituraFor` seguem intocados.
type RowKey = "lastAccess" | "progress" | "sessions" | "reflections" | "engagement"

/**
 * A coluna "Como estou" (SH-1.5, renomeada de "Leitura") — copy por indicador ×
 * resultado, frases mais longas que o chip antigo (Round 2, Hugo 2026-07-18: sem
 * o prefixo "…", o texto começa direto pela palavra). Regra de tom
 * (Hugo, PRESERVADA): acima = reforço; empate = neutro; abaixo = acionável, nunca
 * punitivo. A linha `engagement` tem tratamento ESPECIAL (rank real, ver
 * `leituraFor`): o `win` genérico aqui só entra quando o aluno vence a média mas
 * NÃO é o #1 real da turma.
 */
/**
 * SH-2.7 (histórico) — `progress`/`sessions`/`reflections` tinham um campo
 * `capped` fixo aqui para o FREIO absoluto de ritmo esperado. SH-2.7.1 (Hugo
 * 2026-07-20) — REMOVIDO: a copy do freio deixou de ser um texto genérico fixo e
 * passou a citar o NÚMERO REAL ("Acima da turma, mas apenas {N}% do seu
 * potencial"), calculada por `ownPaceCappedText` a partir de `ownPace.actualPct`
 * (ver `leituraFor`), não mais um texto estático por `RowKey`.
 */
const LEITURA_COPY: Record<RowKey, { win: string; tie: string; behind: string }> = {
  // SH-2.2 (histórico) — copy nomeando ESTUDO explicitamente. RETIRADA na SH-2.5
  // (item 3): a linha "lastAccess" ganhou leitura própria por faixa absoluta de
  // recência (`recencyReadingFor`), que tem seu PRÓPRIO texto embutido e nunca
  // mais chama `leituraFor("lastAccess", ...)` — este bloco fica morto/não lido
  // (o `Record<RowKey, ...>` exige uma entrada por chave; não removida para não
  // ter que estreitar o tipo `RowKey`/`leituraFor` por uma linha que já não o usa).
  lastAccess: {
    win: "estudando acima da média",
    tie: "no ritmo da turma",
    behind: "vamos retomar os estudos?",
  },
  progress: {
    win: "ritmo acima da média",
    tie: "no ritmo da turma",
    behind: "1 sessão te recoloca no ritmo",
  },
  sessions: {
    win: "acima da média",
    tie: "no ritmo da turma",
    behind: "que tal mais uma hoje?",
  },
  reflections: {
    win: "acima da média",
    tie: "no ritmo da turma",
    behind: "suas reflexões contam, registre uma",
  },
  engagement: {
    win: "acima da média",
    tie: "no ritmo da turma",
    behind: "vamos engajar mais?",
  },
}

/**
 * SH-1.5 (AC7) — a leitura ESPECIAL da linha Engajamento quando o aluno é o #1 real
 * da turma (rank confirmado no backend, `subject.isTopEngagement === true`). Só esta
 * frase carrega a alegação de 1º lugar; qualquer outro caso cai no fallback padrão.
 */
const TOP_ENGAGEMENT_COPY = "1º da turma – Parabéns!"

/**
 * ROUND 4 (Hugo 2026-07-18) — a label do BOTÃO ACIONÁVEL que aparece ao lado do
 * chip "Como estou" SÓ quando o aluno está atrás naquele indicador. Paralela a
 * LEITURA_COPY: reaproveita o TOM do convite de `LEITURA_COPY[key].behind`, mas
 * como texto de BOTÃO curto e imperativo (o chip descreve o estado, o botão chama
 * à ação). Uma por RowKey.
 */
const ACTION_LABEL: Record<RowKey, string> = {
  // SH-2.2 — "os estudos", não "atividade" (mesma correção de nomenclatura de LEITURA_COPY).
  lastAccess: "Retomar os estudos",
  progress: "Continuar sessão",
  sessions: "Fazer uma interação",
  reflections: "Registrar uma reflexão",
  engagement: "Continuar agora",
}

/**
 * ROUND 25 (Hugo 2026-07-18, "os textos com tamanho variável, para manter os botões
 * padronizados") — o tamanho de fonte do RÓTULO, por linha (paralela a `ACTION_LABEL`),
 * calculado para cada texto caber numa única linha dentro da largura REAL fixa do botão
 * (`w-[205px]` desde o Round 26, ver o comentário de `ActionButton` acima com a conta
 * completa). Só o `<span>` do texto usa esta classe — ícone e `ArrowRight` continuam nos
 * mesmos `size={14}`/`size={11}` em todas as linhas, o tamanho fixo NÃO varia.
 *
 * ROUND 26 (Hugo 2026-07-18, "talvez pequeno demais em alguns, pode aumentar um pouco o
 * tamanho") — a simetria do Round 25 funcionou, mas o tier mais reduzido (8px, para
 * "Registrar uma reflexão") ficou apertado demais no screenshot. Toda a progressão SUBIU 2px
 * (a largura fixa também cresceu, ver `ActionButton`, dando o orçamento extra necessário para
 * subir a fonte sem perder a simetria): 12→11→10→9→8 virou 14→13→12→11→10. `text-sm` (14px) e
 * `text-xs` (12px) são degraus PADRÃO do Tailwind (não arbitrários) — `engagement` e
 * `lastAccess` migraram para eles porque os novos valores calculados bateram exatamente nos
 * degraus da escala default.
 */
const ACTION_LABEL_SIZE: Record<RowKey, string> = {
  engagement: "text-sm", // "Continuar agora" (15 caracteres) — 14px, degrau padrão do Tailwind
  progress: "text-[13px]", // "Continuar sessão" (16 caracteres)
  lastAccess: "text-xs", // SH-2.2: "Retomar os estudos" (18 caracteres) — 12px ainda cabe, ver comentário da ActionButton
  sessions: "text-[11px]", // "Fazer uma interação" (19 caracteres)
  reflections: "text-[10px]", // "Registrar uma reflexão" (22 caracteres, o mais longo)
}

/**
 * ROUND 10 (Hugo 2026-07-18) — o ÍCONE do BOTÃO ACIONÁVEL por indicador, paralelo a
 * `ACTION_LABEL` (uma entrada por RowKey). Até a Round 9 os 5 botões repetiam o MESMO
 * `ArrowRight` genérico ao final — visualmente idênticos entre si ("ta tudo muito
 * igual"). Agora cada linha ganha um ícone Lucide SEMANTICAMENTE ligado à sua ação,
 * como ícone de LIDERANÇA (à esquerda do texto). Os 5 glifos são visualmente distintos
 * (seta circular ≠ triângulo ≠ balão ≠ lápis ≠ raio) e TODOS já fazem parte do
 * vocabulário visual do app (grep em src: RotateCcw 37×, Play 40×, MessageSquare 36×,
 * Pencil 16×, Zap 14×) — reuso, não invenção de glifo novo:
 *   • lastAccess ("Retomar atividade")     → RotateCcw  (retomar/recomeçar)
 *   • progress ("Continuar sessão")        → Play       (continuar/dar play)
 *   • sessions ("Fazer uma interação")     → MessageSquare (interação/mensagem)
 *   • reflections ("Registrar uma reflexão") → Pencil   (registrar/escrever)
 *   • engagement ("Continuar agora")       → Zap        (energia/impulso/agora)
 */
const ACTION_ICON: Record<RowKey, LucideIcon> = {
  lastAccess: RotateCcw,
  progress: Play,
  sessions: MessageSquare,
  reflections: Pencil,
  engagement: Zap,
}

/**
 * Formata a célula de VALOR de uma métrica que pode ter fração "X/Y" (SH-1.5).
 * Denominador presente e > 0 → "X/Y" (ex.: "7/10"); ausente/0 → o absoluto "X"
 * (degradação graciosa, AC3/AC4/AC10 — sem NaN, sem Infinity, sem crash). Pure.
 */
export function formatFraction(value: number, max: number | undefined | null): string {
  if (max != null && max > 0) return `${value}/${max}`
  return String(value)
}

/**
 * SH-1.5 Round 2 (Hugo 2026-07-18) — formats the "Você" Engajamento cell as a
 * RANKING position instead of a raw score.
 *
 * Round 6 (Hugo 2026-07-18) — the notation DROPPED the "de {total}" suffix: the
 * cell now shows ONLY the position ("3º"), not "3º de 15". Looking at the live app,
 * the "de N" (the total headcount of the org) added noise without helping — the
 * student cares about their own position, not the population size. `total` is STILL
 * received and STILL validated defensively (rank must be ≥1, finite, and ≤ total for
 * the position to be meaningful — a rank above the population is malformed data), but
 * it no longer appears in the rendered TEXT. Both rank and total must be present,
 * finite and ≥1 with rank ≤ total; anything malformed/absent degrades to "—" (same
 * defensive style as formatFraction — never NaN, never a crash). Notation (Hugo can
 * retune): "{rank}º", pt-BR ordinal, position only. Pure.
 */
export function formatRank(
  rank: number | undefined | null,
  total: number | undefined | null,
): string {
  if (rank == null || total == null) return "—"
  if (!Number.isFinite(rank) || !Number.isFinite(total)) return "—"
  if (rank < 1 || total < 1 || rank > total) return "—"
  return `${rank}º`
}

/**
 * ROUND 9 (Hugo 2026-07-18) — o TAMANHO da população da turma como "valor principal"
 * da célula Turma da linha Engajamento (espelhando o peso do pill de ranking "11º" do
 * lado Você). Junto, as duas células reconstroem "11 de 46": Você mostra a POSIÇÃO,
 * Turma mostra o TOTAL. `total` é o MESMO `engagementTotalStudents` que já alimenta
 * `formatRank` — nenhum cálculo novo. Degrada a `null` (a célula omite a linha de topo,
 * sem "undefined pessoas") em qualquer entrada ausente/malformada, mesmo espírito
 * defensivo de `formatRank`/`formatFraction`. Pure.
 */
// SH-2.5 (Hugo 2026-07-19) — "ativas": deixa explícito que esta contagem já
// reflete o filtro de alunos ativos aplicado na Turma (SH-2.1, `activeOrgStudentIds`
// em `area-gestor.ts`) — sem o sufixo, "35 pessoas" lia como o total bruto da
// organização, que não é mais o que o número representa desde a SH-2.1.
export function formatPopulation(total: number | undefined | null): string | null {
  if (total == null || !Number.isFinite(total) || total < 1) return null
  return total === 1 ? "1 pessoa ativa" : `${total} pessoas ativas`
}

/**
 * Round 3 (Hugo 2026-07-18) — HISTÓRICO: `"behind"` chegou a ser separado em dois
 * tons de severidade, `"behind-mild"` (amarelo) e `"behind-severe"` (vermelho).
 * SH-2.5 (Hugo 2026-07-19) — REVERTIDO: a distinção mild/severe deixou de existir.
 * `winnerOf` agora usa uma FAIXA DE TOLERÂNCIA (`TONE_THRESHOLDS`) para decidir
 * tie vs win/behind (ver comentário de `winnerOf`), então "atrás" já significa
 * "fora da faixa de tolerância, na direção ruim" — um único tom `"behind"`
 * (vermelho, o visual que antes era só do `behind-severe`) basta.
 */
export interface Leitura {
  text: string
  tone: "win" | "tie" | "behind" | "none"
}

/**
 * SH-2.7 (Hugo 2026-07-19, caso Rinaldo) — o FREIO absoluto: `winnerOf` só compara
 * Você vs Turma (relativo). Um aluno pode vencer uma Turma fraca sem estar,
 * de fato, no PRÓPRIO ritmo esperado (ex.: Reflexões 8/41 do Rinaldo, ~19,5%,
 * vencia a Turma 4/41, mas 19,5% < ~33% do ritmo esperado dele mesmo àquela
 * altura da trilha). `ownPaceOk === false` REBAIXA um "subject" (venceu a Turma)
 * para `null` (nem vitória nem derrota) — nunca cria um "reference" (não piora
 * quem já está atrás da Turma; a regra só CONTÉM elogio indevido, nunca pune).
 * `ownPaceOk` ausente/`true` → comportamento intocado (100% relativo, como antes).
 */
export function effectiveWinnerFor(winner: Winner, ownPaceOk?: boolean): Winner {
  if (winner === "subject" && ownPaceOk === false) return null
  return winner
}

/**
 * Deriva a Leitura de um indicador dos vencedores que a tabela computa
 * (winnerOf) — nunca uma conta paralela. Valor ausente de qualquer lado → "—"
 * (sem leitura possível, não é empate). Pure, exported for tests.
 *
 * SH-2.5 — `winnerOf` já embute a faixa de tolerância de 5%; `leituraFor` só
 * traduz o resultado em texto/tom, sem recalcular severidade (`behindSeverityOf`
 * foi removida, não existe mais gradiente mild/severe).
 */
export function leituraFor(
  key: RowKey,
  subject: number | null,
  reference: number | null,
  direction: "higher" | "lower",
  /**
   * SH-1.5 (AC7) — REAL rank signal, consumed ONLY for the `engagement` row: when
   * TRUE and the student is winning that row, the reading becomes "1º da turma".
   * NEVER hardcoded, NEVER approximated — it reflects a backend rank of exactly 1
   * (no tie, AC12). Any other row, or `false`/absent, uses the standard copy.
   */
  isTopEngagement?: boolean,
  /**
   * SH-2.7 — o freio absoluto de ritmo esperado (ver `effectiveWinnerFor`). SÓ
   * `progress`/`sessions`/`reflections` recebem isto de `buildRows`; `lastAccess`
   * (leitura própria, `recencyReadingFor`) e `engagement` (derivado dos outros
   * dois) NUNCA passam este parâmetro — undefined aqui, freio nunca se aplica.
   * SH-2.7.1 (Hugo 2026-07-20) — carrega `actualPct` (não só o booleano `ok`)
   * para a copy citar o número real quando rebaixa o tom.
   */
  ownPace?: OwnPaceSignal,
): Leitura {
  if (subject === null || reference === null) return { text: "—", tone: "none" }
  const rawWinner = winnerOf(subject, reference, direction)
  const winner = effectiveWinnerFor(rawWinner, ownPace?.ok)
  const copy = LEITURA_COPY[key]
  if (winner === "subject") {
    // AC7 — the "1º da turma" claim is unlocked SOLELY by the real rank signal.
    if (key === "engagement" && isTopEngagement === true) {
      return { text: TOP_ENGAGEMENT_COPY, tone: "win" }
    }
    return { text: copy.win, tone: "win" }
  }
  if (winner === "reference") {
    return { text: copy.behind, tone: "behind" }
  }
  // SH-2.7.1 (Hugo 2026-07-20) — winner null por FREIO (venceu a Turma, mas não o
  // próprio ritmo) usa a copy QUANTIFICADA com o número real ("Acima da turma,
  // mas apenas {N}% do seu potencial"), nunca "no ritmo da turma" (seria falso —
  // ele está ACIMA da turma). Tie genuíno (rawWinner já era null) usa a copy padrão.
  if (rawWinner === "subject" && ownPace?.ok === false) {
    return { text: ownPaceCappedText(ownPace.actualPct), tone: "tie" }
  }
  return { text: copy.tie, tone: "tie" }
}

/**
 * SH-2.5 (Hugo 2026-07-19) — "no caso específico da última atividade, não temos
 * que tratar como acima e abaixo da média, temos que utilizar outra
 * nomenclatura." Recência (dias desde a última sessão de estudo real) NÃO é uma
 * métrica cumulativa comparável da mesma forma que progresso/interações/
 * reflexões/engajamento — comparar contra a média de dias da Turma usando a
 * linguagem "acima/abaixo da média" das outras 4 linhas não faz sentido
 * conceitual. A linha "Última sessão de estudo" (`lastAccess`) ganha uma leitura
 * PRÓPRIA, baseada em FAIXAS ABSOLUTAS de recência, DESACOPLADA de `winnerOf`/
 * comparação com a Turma — nem entra na faixa de tolerância de `TONE_THRESHOLDS`
 * (item 1 desta mesma story). A célula Turma continua mostrando "há N dias" como
 * contexto informativo (`buildRows`, inalterado); só a LEITURA/tom param de ser
 * uma comparação direta.
 *
 * CONFIGURÁVEL, mesmo espírito de `TONE_THRESHOLDS`: 1 objeto nomeado, candidato
 * a virar ajustável no painel de administração futuro do Hugo.
 */
export const RECENCY_THRESHOLDS = {
  /** Estudou há <= N dias → lido como "recente" (tom win, verde). */
  recentDays: 7,
  /** Estudou há mais que `recentDays` mas <= N dias → grau intermediário (tom
   * tie, âmbar — reusa o tom "tie" já existente em vez de inventar um 5º tom,
   * mantendo a simplificação de 4 tons do item 1). Acima disso → "behind" (vermelho). */
  staleDays: 30,
}

/**
 * A leitura + o "vencedor sintético" da linha "Última sessão de estudo", a
 * partir SÓ da recência absoluta do sujeito (nunca da Turma). O `winner`
 * retornado é sintético — não vem de `winnerOf` — mas tem o MESMO shape
 * (`Winner`), então plugra sem adaptação no resto do pipeline de render já
 * existente (`ValueCell`, `subjectPillFor`, `ActionButton`, `PctBar` n/a aqui).
 * Pure, exported for tests.
 *
 * DECISÃO DE DESIGN (documentada no Change Log da SH-2.5): o estado "sem sessão
 * de estudo ainda" (`days === null`) usa o texto neutro "—" no CHIP "Como estou"
 * — o MESMO "—" que as outras 4 linhas já usam para "sem dado" — em vez de
 * repetir "Ainda sem sessão de estudo" (que já aparece na célula Você via
 * `formatDays`); mostrar a mesma frase duas vezes na mesma linha seria
 * redundante. O tom "none" é preservado (SH-2.2).
 */
export function recencyReadingFor(days: number | null): { leitura: Leitura; winner: Winner } {
  if (days === null) return { leitura: { text: "—", tone: "none" }, winner: null }
  if (days <= RECENCY_THRESHOLDS.recentDays) {
    return { leitura: { text: "estudando com frequência", tone: "win" }, winner: "subject" }
  }
  if (days <= RECENCY_THRESHOLDS.staleDays) {
    return { leitura: { text: "faz um tempo que não aparece", tone: "tie" }, winner: null }
  }
  return { leitura: { text: "sumiu da trilha", tone: "behind" }, winner: "reference" }
}

/**
 * O chip tonal da Leitura — fundo suave + texto na cor semântica + ícone
 * pequeno. Verde (reforço) / amarelo claro (no ritmo/empate).
 * Round 3 (Hugo 2026-07-18): o antigo `behind` cerrado único deu lugar a DOIS
 * tons de severidade — `behind-mild` AMARELO (bg/text-semantic-warning) e
 * `behind-severe` VERMELHO (bg/text-semantic-error). Tokens semânticos do design
 * system (theme.css `@theme`), já usados app-wide para warning/danger.
 * ROUND 14 (Hugo 2026-07-18): o `tie` (empate) saiu do CINZA/neutro para amarelo, mas
 * (ver Round 15) na opacidade errada.
 * ROUND 15 (Hugo 2026-07-18, "cadê o amarelo?"): o `/5` do Round 14 era matematicamente
 * mais claro que behind-mild, mas contra o fundo BRANCO da tabela (bg-card oklch 1.0) uma
 * opacidade tão baixa cai ABAIXO DO LIMIAR DE PERCEPÇÃO — o token warning é oklch(0.8 0.15
 * 70), e a 5% de opacidade sobra chroma efetiva ≈ 0.0075, imperceptível; o olho só via um
 * branco sujo. Subido para `bg-semantic-warning/15 text-semantic-warning` — o `/15` com
 * texto âmbar PLENO é um amarelo INEQUÍVOCO já PROVADO legível no app (skill-badge
 * "Reflexão", tenant-integrations badge "PUT", ambos `bg-semantic-warning/15
 * text-semantic-warning`). No CHIP a distinção empate↔behind-mild vem sobretudo do ÍCONE
 * (`Minus` parity vs `ArrowRight` acionável) e da copy, não da intensidade do fill (o chip
 * é fill fraco em ambos); a hierarquia de intensidade forte vive no BOTÃO (tie /60 vs
 * behind-mild sólido). Lição do Round 14: opacidade sobre fundo branco precisa ser
 * verificada como cor PERCEBIDA, não só comparada como número.
 */
const LEITURA_CHIP: Record<
  Exclude<Leitura["tone"], "none">,
  { className: string; Icon: LucideIcon }
> = {
  // ROUND 21 (histórico) → ROUND 22 (correção de escopo, "o laranja era só na frase"): win
  // volta a ser verde (`semantic-success`) NESTA TABELA — o laranja cerrado sobrevive só no
  // cartão de resumo (RITMO_TONE_STYLE.win, student-home-card.tsx).
  win: { className: "bg-semantic-success/10 text-semantic-success", Icon: TrendingUp },
  tie: { className: "bg-semantic-warning/15 text-semantic-warning", Icon: Minus },
  // SH-2.5 — `behind` único (consolidação de `behind-mild`+`behind-severe`), visual
  // do antigo `behind-severe` (vermelho), a pedido explícito do Hugo.
  behind: {
    className: "bg-semantic-error/10 text-semantic-error",
    Icon: ArrowRight,
  },
}

function LeituraChip({ leitura, testid }: { leitura: Leitura; testid: string }) {
  if (leitura.tone === "none") {
    return (
      <span data-testid={testid} data-tone="none" className="text-xs text-text-muted">
        {leitura.text}
      </span>
    )
  }
  const { className, Icon } = LEITURA_CHIP[leitura.tone]
  return (
    <span
      data-testid={testid}
      data-tone={leitura.tone}
      // SH-3.4 — max-lg:whitespace-normal: a copy longa do freio ("Acima da
      // turma, mas apenas N% do seu potencial") quebra com graça no card mobile
      // em vez de estourar a largura; nowrap intacto em lg+ (desktop aprovado).
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold max-lg:whitespace-normal ${className}`}
    >
      <Icon size={12} aria-hidden="true" className="shrink-0" />
      {leitura.text}
    </span>
  )
}

/**
 * ROUND 11 (Uma / @ux-design-expert, Hugo 2026-07-18) — HISTÓRICO. O Round 11 adotou
 * `buttonVariants({ variant: "outline" })` do design system para resolver a CAUSA RAIZ do
 * "não tá legal ainda": o botão era uma pill inventada isolada, fora da linguagem visual
 * do app. Essa análise segue correta e continua sendo o motivo de o botão pertencer ao DS.
 * O Round 12 abaixo NÃO reverte esse diagnóstico — muda o PESO/SATURAÇÃO a pedido explícito
 * do Hugo (referência visual de pills sólidas), mantendo a coerência com o resto do app.
 *
 * ROUND 12 (Uma, Hugo 2026-07-18) — PILL SÓLIDA SATURADA POR TOM, a pedido direto do Hugo
 * com screenshot de referência ("o que acha de usar outras cores? ou usa esse estilo de
 * botão"). A referência mostra a coluna AÇÃO com pills SÓLIDAS e SATURADAS (fundo cheio na
 * cor do tom, texto branco em negrito, ícone forte à esquerda, formato pill rounded-full),
 * peso visual bem mais forte que o outline do Round 11 e que o tintado /10 do Round 8. O
 * Hugo confirmou: manter os RÓTULOS específicos por métrica que já temos (Retomar
 * atividade, etc.), adotar só o PESO/SATURAÇÃO da referência (não os rótulos genéricos por
 * status "Lembrar"/"No ritmo"/"Acionar" da imagem).
 *
 * POR QUE O SÓLIDO NÃO REPETE O ERRO DO ROUND 8 (reavaliação, não teimosia): o Round 8
 * abandonou o sólido porque, num aluno vencendo, 4 linhas verdes idênticas viravam "tudo
 * igual" — MAS naquele momento os botões eram visualmente idênticos entre si (mesmo
 * ArrowRight genérico, sem rótulo diferenciado forte). Desde o Round 10 cada linha tem um
 * ÍCONE SEMÂNTICO PRÓPRIO (RotateCcw/Play/MessageSquare/Pencil/Zap) + rótulo específico por
 * métrica. Mesmo com 4 fundos verdes, o ícone e o texto distintos por linha já quebram a
 * monotonia que motivou o Round 8. O risco de "tudo igual" hoje é baixo; o ganho de peso/
 * clareza de CTA que o Hugo quer supera. Decisão de design consciente, com o precedente do
 * Round 8 reavaliado à luz do que mudou (ícone + rótulo por linha), não ignorado.
 *
 * FORMA (rounded-full, não rounded-xl do DS): a referência do Hugo é pill rounded-full, e
 * o chip "Como estou" ao lado JÁ é rounded-full — uma pill de ação rounded-full fica
 * coerente com o chip vizinho e fiel à referência. O Round 11 usou o rounded-xl do
 * `buttonVariants` para "pertencer ao DS", mas o Hugo agora pede um peso/forma específicos
 * que o outline do DS não entrega; a pill sólida rounded-full é a resposta a esse pedido.
 * Mantenho as classes de estado que importam (foco visível para acessibilidade, hover,
 * active, transição) escritas à mão, para não perder o que o DS dava de graça no Round 11.
 *
 * CONTRASTE POR TOM (WCAG, lightness dos tokens em theme.css):
 *   • win     → ROUND 21 tinha trocado para cerrado-500 (laranja); ROUND 22 REVERTEU para
 *     semantic-success (oklch L 0.65, verde) — correção de escopo, ver bloco datado abaixo.
 *     → texto BRANCO (contraste OK).
 *   • behind-severe → semantic-error (oklch L 0.6) → texto BRANCO.
 *   • none    → cerrado-600 (oklch L 0.64) → texto BRANCO.
 *   • behind-mild → semantic-warning (oklch L 0.8, CLARO) → texto PRETO (text-black/80),
 *     o MESMO cuidado de contraste já documentado no Round 7 e validado no app
 *     (analytics-dashboard.tsx usa fundo warning + texto escuro). Nunca branco sobre âmbar.
 *   • tie     → neutro sólido do DS (bg-bg-elevated + border) com texto primário, para o
 *     empate não gritar cor semântica; ainda uma pill de peso, mas cromática-neutra.
 * FAMÍLIA DE COR (verde=win, âmbar/vermelho=atrás, neutro=empate, cerrado=fallback): é a
 * lógica central de leitura do produto desde o Round 3, não se toca. O que muda é só a
 * SATURAÇÃO/peso (tintado /10 → sólido 100%), não a família.
 *
 * ROUND 21→22 — WIN×NONE, HISTÓRICO DE UMA AMBIGUIDADE QUE NÃO EXISTE MAIS AQUI: o Round 21
 * tinha trocado `win` para laranja/cerrado NESTA TABELA, o que colidiria com `none` (também
 * cerrado desde o Round 12/13) — resolvido lá com um degrau mais claro (`cerrado-500` p/ win
 * vs `cerrado-600` p/ none). O Round 22 corrigiu o escopo (o Hugo só queria laranja no
 * CARTÃO de resumo, não na tabela — "o resto era para manter verde") e reverteu `win` para
 * verde AQUI. Com win verde de novo, a colisão nunca existiu de verdade nesta tabela — o
 * degrau `-500`/`-600` foi um remendo para um problema que o próprio Round 21 introduziu ao
 * interpretar largo demais; ele NÃO sobrevive aqui. A distinção de degrau permanece só onde
 * ainda é relevante: o cartão de resumo (`RITMO_TONE_STYLE`, student-home-card.tsx) nunca
 * teve essa colisão para começo de conversa (`none` lá é branco neutro, não cerrado).
 *
 * RELAÇÃO COR↔TOM (Round 7) PRESERVADA: `ACTION_TONE` indexado por `leitura.tone`, mesma
 * fonte de verdade que colore o chip. PRESERVADO: universalidade (Round 6), ícone semântico
 * à esquerda + `iconTestid` (Round 10), `ArrowRight` de affordance ao final, href/navegação,
 * testids `action-${key}`/`action-icon-${key}`, os 5 rótulos específicos por métrica.
 */
const ACTION_TONE: Record<Leitura["tone"], string> = {
  // Round 13 — só o FUNDO + a cor de texto por tom; o hover:brightness-110 mora na classe
  // base (idêntico ao gestor). win/severe/none = fundo escuro + texto branco; behind-mild =
  // âmbar SÓLIDO forte + texto preto (contraste WCAG).
  // Round 14→16 (Hugo 2026-07-18) — o `tie` (empate) é AMARELO CLARO/SUAVE, mesma família do
  // behind-mild mas em opacidade MENOR. Histórico: Round 14 `/40` (creme pálido, sumia), Round
  // 15 `/60` (código certo, MAS não renderizava — ver causa raiz abaixo).
  // ROUND 16 — CAUSA RAIZ do "botão não tá amarelo": o Tailwind v4 SÓ gera a regra CSS de uma
  // opacidade `bg-semantic-warning/NN` se aquela string EXATA aparecer no scan do projeto. O
  // `/60` do Round 15 não era usado em NENHUM outro lugar do app, então a classe ia pro HTML
  // SEM regra CSS correspondente → fundo transparente → o botão parecia branco/outline. O chip
  // `/15` funcionava porque `/15` JÁ existe no CSS (skill-badge). Correção: usar `/70`, o valor
  // JÁ PRESENTE no CSS gerado (analytics-dashboard.tsx usa `bg-semantic-warning/70 text-black/70`
  // — mesmo par, já citado no cabeçalho deste arquivo). `/70` é claramente amarelo (satProxy
  // ≈ 0.44 sobre branco) e ainda mais suave que o sólido `/100` do behind-mild (0.63). Reusar
  // um valor já no CSS gerado é a garantia de que renderiza — não depende de o scanner ter
  // pego uma opacidade nova. Texto `text-black/70` (o par exato do precedente).
  // ROUND 21 (histórico): win virou "bg-cerrado-500 text-white" (laranja, degrau mais claro
  // que o cerrado-600 do fallback `none`, para os dois não colidirem). ROUND 22 — CORREÇÃO DE
  // ESCOPO ("o laranja era só na frase, o resto era para manter verde"): revertido para
  // verde. Sem win-cerrado nesta tabela, a colisão com `none` deixa de existir — o degrau
  // `-500` não é mais necessário aqui.
  // SH-2.5 (Hugo 2026-07-19) — `behind-mild`/`behind-severe` consolidados num único
  // `behind`, visual do antigo `behind-severe` (vermelho sólido), a pedido explícito
  // do Hugo (a distinção mild/severe deixou de existir em toda a tabela).
  win: "bg-semantic-success text-white",
  tie: "bg-semantic-warning/70 text-black/70",
  behind: "bg-semantic-error text-white",
  none: "bg-cerrado-600 text-white",
}

/**
 * ROUND 4 (Hugo 2026-07-18) — o BOTÃO ACIONÁVEL ao lado do chip "Como estou".
 * Round 6: renderizado em TODAS as linhas incondicionalmente (CTA universal).
 * Round 7: a COR ESPELHA o `tone` da leitura da linha.
 * Round 10: ícone SEMÂNTICO por linha (`Icon`, de `ACTION_ICON`) à ESQUERDA do texto
 * (liderança) + `ArrowRight` de affordance ao final; `data-testid={iconTestid}` no ícone.
 * ROUND 11: a base virou `buttonVariants({ variant: "outline" })` do DS (causa raiz do
 * desalinhamento resolvida).
 * ROUND 12 (Uma, Hugo 2026-07-18): a base voltou à PILL rounded-full, agora SÓLIDA/saturada
 * por tom (fundo cheio na cor semântica do tom + texto de contraste), a pedido do Hugo com
 * referência visual. Peso visual forte de CTA.
 * ROUND 13 (Uma, Hugo 2026-07-18): "os botões estão muito gordos, coloca exatamente do mesmo
 * jeito que tá lá no gestor". REPLICAÇÃO EXATA do botão de ação do card do GESTOR
 * (`student-insights-table.tsx` linhas 854-899, a FONTE de onde veio a referência do Round
 * 12). A "gordura" era: o Round 12 forçava `h-8` (altura fixa 32px) + `justify-center` +
 * `font-bold`, engordando a pill verticalmente vs o `py-1.5` FLUIDO do gestor (~28px). A
 * classe base agora é IDÊNTICA à do gestor: `inline-flex items-center gap-1.5 rounded-full
 * px-3.5 py-1.5 text-xs font-semibold ... shadow-sm transition-all hover:brightness-110`
 * (removidos `h-8`, `justify-center`, `whitespace-nowrap`, `duration-200`; `font-bold` →
 * `font-semibold`; ícone `size={13}` → `size={14}`). Preservo os estados de foco visível
 * (que o gestor NÃO tem, mas não quero regredir acessibilidade ao replicar — o gestor é
 * <button>, o nosso é <a>/Link, e um link navegável precisa de foco visível). O
 * `hover:brightness-110` (que no gestor está na classe base) migrou de `ACTION_TONE` para a
 * base aqui também. SÓ o TAMANHO/PESO muda — a lógica de cor sólida por tom (Round 12), os 5
 * rótulos específicos (Round 12), os 5 ícones semânticos (Round 10) e o ArrowRight de
 * affordance permanecem (a réplica é do TAMANHO/PESO/FORMA do botão, não da semântica dos
 * ícones do gestor, que são de outro contexto de produto).
 */
/**
 * ROUND 24 (Hugo 2026-07-18, screenshot recortado da coluna "Ação"): "só não estou gostando
 * que isso aqui não está com os tamanhos padronizados e centralizados". Até aqui o botão era
 * `inline-flex` dimensionado pelo próprio texto — os 5 rótulos ("Retomar atividade",
 * "Continuar sessão", "Fazer uma interação", "Registrar uma reflexão", "Continuar agora") têm
 * comprimentos diferentes, então os 5 botões renderizavam com larguras diferentes,
 * encostados à esquerda da célula (herança do Round 8, que resolveu alinhamento de INÍCIO
 * entre linhas ao separar "Como estou"/"Ação" em 2 `<td>`s reais, mas não padronizou LARGURA
 * nem centralizou o conteúdo). Round 24 tentou `min-w-[220px]` — um PISO, não uma largura
 * real — então o rótulo mais longo continuava EXPANDINDO o botão além do mínimo, e o
 * screenshot seguinte do Hugo mostrou que os 5 botões continuavam com larguras diferentes.
 *
 * ROUND 25 (Hugo 2026-07-18, novo screenshot): "ainda não tá simétrico... faça com que os
 * textos sejam com tamanho variável, para manter o tamanho dos botões padronizados" — o
 * INVERSO do Round 24: largura REALMENTE fixa (`w-[180px]`, não `min-w`), e o TAMANHO DA
 * FONTE do rótulo varia por linha para cada texto caber numa única linha dentro dessa
 * largura, sem quebrar nem cortar. Ícone e `ArrowRight` mantêm o MESMO tamanho (`size={14}`/
 * `size={11}`, via prop `size` do lucide-react, que não é afetada por `font-size` CSS) —
 * SÓ o texto do rótulo (agora num `<span>` próprio, `labelClassName`) varia.
 *
 * CÁLCULO (mesma metodologia do Round 24, ~7px/caractere = 0.58em para sans-serif semibold
 * em UI, aplicada agora ao INVERSO — a largura deriva do rótulo mais CURTO, a fonte se ajusta
 * para os mais longos): "chrome" fixo (ícone 14px + gap 6px + seta 11px + gap 6px +
 * `px-3.5` 14px×2) = 65px, IGUAL em todos os botões, independente da fonte do texto.
 *   • `w-[180px]` derivado do rótulo mais CURTO, "Continuar agora" (15 caracteres) em
 *     `text-xs` (12px) normal: 15×0.58×12 ≈ 104px de texto + 65px de chrome ≈ 169px, mais
 *     ~10px de folga (para não cravar no limite exato) = 180px — largura NÃO exagerada para
 *     o rótulo mais curto (o requisito do Hugo), mas real e igual nos 5 botões.
 *   • Orçamento de texto disponível em `w-[180px]`: 180 − 65 (chrome) = 115px.
 *   • Fonte por rótulo, escolhida para caber no orçamento de 115px com folga real (≥10px,
 *     não apenas o limite matemático exato — a estimativa de 0.58em/char é uma média, não
 *     uma medição de pixel real, então uma folga pequena é insuficiente margem de erro):
 *     engagement "Continuar agora" (15) → text-xs/12px (104px, folga 11px);
 *     progress "Continuar sessão" (16) → text-[11px] (102px, folga 13px);
 *     lastAccess "Retomar atividade" (17) → text-[10px] (99px, folga 16px);
 *     sessions "Fazer uma interação" (19) → text-[9px] (99px, folga 16px);
 *     reflections "Registrar uma reflexão" (22, o mais longo) → text-[8px] (102px, folga 13px).
 *   Progressão limpa 12→11→10→9→8px, cada degrau com folga confortável — nenhum rótulo fica
 *   no limite exato do cálculo (o que seria arriscado sem medição real de renderização).
 *
 * ROUND 26 (Hugo 2026-07-18, novo screenshot da simetria já funcionando): "talvez pequeno
 * demais em alguns, pode aumentar um pouco o tamanho" — o degrau mais baixo (8px, para
 * "Registrar uma reflexão") ficou legível mas visivelmente apertado perto de "Continuar
 * agora". `w-[180px]` → `w-[205px]` (+25px, chrome inalterado a 65px, orçamento de texto
 * 115px→140px) para abrir espaço e subir TODA a progressão +2px (12→11→10→9→8 virou
 * 14→13→12→11→10), mantendo a MESMA folga confortável em cada degrau:
 *   engagement (15) → 14px, 15×0.58×14≈121.8px, folga 18.2px;
 *   progress (16) → 13px, 16×0.58×13≈120.6px, folga 19.4px;
 *   lastAccess (17) → 12px, 17×0.58×12≈118.3px, folga 21.7px;
 *   sessions (19) → 11px, 19×0.58×11≈121.2px, folga 18.8px;
 *   reflections (22, o mais longo) → 10px, 22×0.58×10≈127.6px, folga 12.4px.
 * `14px` e `12px` batem exatamente nos degraus PADRÃO do Tailwind (`text-sm`/`text-xs`, não
 * arbitrários) — ver `ACTION_LABEL_SIZE`. A largura `w-[205px]` continua deliberadamente
 * MENOR que o antigo piso `min-w-[220px]` do Round 24 (que nunca era a largura real de
 * nenhum botão, só um mínimo), preservando o espírito de "não exagerado" do Round 25.
 *
 * SH-2.2 (Hugo 2026-07-19) — `ACTION_LABEL.lastAccess` mudou de "Retomar atividade" (17
 * caracteres) para "Retomar os estudos" (18 caracteres), correção de nomenclatura (a linha
 * mede estudo, não login — ver Change Log da SH-2.2). Recalculando pela MESMA fórmula do
 * Round 26 no degrau já usado (12px, `text-xs`): 18×0.58×12 ≈ 125.3px, folga 14.7px dentro
 * do orçamento de 140px — acima da menor folga já aceita no Round 26 (reflections, 12.4px),
 * então o degrau `text-xs` PERMANECE sem mudança, sem risco de quebra de linha.
 */
function ActionButton({
  href,
  label,
  labelClassName,
  testid,
  tone,
  Icon,
  iconTestid,
}: {
  href: string
  label: string
  /** ROUND 25 — tamanho de fonte do RÓTULO (só do texto, não do ícone/seta), por linha. */
  labelClassName: string
  testid: string
  tone: Leitura["tone"]
  /** Ícone semântico da ação (Round 10), à esquerda do texto. */
  Icon: LucideIcon
  /** testid do ícone semântico, para os testes afirmarem o glifo certo por linha. */
  iconTestid: string
}) {
  return (
    <Link
      href={href}
      data-testid={testid}
      data-tone={tone}
      className={cn(
        // Round 13 — magreza IDÊNTICA ao botão do gestor (student-insights-table.tsx): mesmo
        // px-3.5 py-1.5, mesmo font-semibold, mesmo shadow-sm/transition/hover. Sem h-8 fixo
        // (a causa da "gordura"). shrink-0 (não encolher na coluna densa) e o foco visível
        // são acréscimos nossos: o gestor é <button>, o nosso é <a> navegável.
        // Round 24 — `justify-center` (centraliza ícone+texto+seta) e `whitespace-nowrap`
        // (garante 1 linha). Round 25 — largura REAL fixa (não mais `min-w`, ver comentário
        // acima); `text-xs` SAIU daqui — o tamanho do texto agora é por rótulo, aplicado no
        // `<span>` interno (`labelClassName`), não na classe base. Round 26 — `w-[180px]` →
        // `w-[205px]` (mais espaço, permitindo subir a progressão de fonte inteira).
        // SH-3.4 — mobile (abaixo de lg): o botão vira full-width no card
        // empilhado (max-lg:w-full) com alvo de toque ≥44px (max-lg:min-h-11).
        // O w-[205px]/simetria do Round 25/26 segue EXATO em lg+.
        "inline-flex w-[205px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 font-semibold shadow-sm transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cerrado-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app active:scale-[0.97] max-lg:min-h-11 max-lg:w-full",
        ACTION_TONE[tone],
      )}
    >
      <Icon data-testid={iconTestid} size={14} aria-hidden="true" className="shrink-0" />
      <span data-testid={`${testid}-label`} className={labelClassName}>
        {label}
      </span>
      <ArrowRight size={11} aria-hidden="true" className="shrink-0 opacity-60" />
    </Link>
  )
}

interface HomeRow {
  key: RowKey
  label: string
  direction: "higher" | "lower"
  /** Comparable numeric values (null → not comparable / missing). */
  subjectValue: number | null
  referenceValue: number | null
  /** Rendered cell content. */
  subjectNode: React.ReactNode
  referenceNode: React.ReactNode
  /** true → the % progress bar is drawn under the value. */
  isPct?: boolean
  /**
   * SH-2.7 (Hugo 2026-07-19, caso Rinaldo) — o freio absoluto de ritmo esperado
   * (ver `effectiveWinnerFor`/`leituraFor`). SÓ `progress`/`sessions`/`reflections`
   * o recebem; `undefined` nas outras 2 linhas (e nestas 3 quando falta dado de
   * trilha) faz o freio nunca se aplicar — comportamento 100% relativo, como antes.
   * SH-2.7.1 (Hugo 2026-07-20) — deixou de ser um `boolean` solto: agora carrega
   * também `actualPct` (o % real de "quanto da trilha já foi feito" nesta linha),
   * para a copy do chip citar o número exato quando o freio rebaixa o tom.
   */
  ownPace?: OwnPaceSignal
}

/**
 * SH-2.7 — o aluno está DENTRO/ACIMA do próprio ritmo esperado nesta métrica?
 * SH-2.7.1 (Hugo 2026-07-20) — passou a carregar `actualPct` junto (não só o
 * booleano `ok`): o chip "Como estou" precisa do número real quando rebaixa
 * win→tie ("Acima da turma, mas apenas {N}% do seu potencial"), não só do sinal.
 */
export interface OwnPaceSignal {
  /** true = aluno no ritmo esperado ou à frente dele. */
  ok: boolean
  /** % real de "quanto da trilha já foi feito" nesta linha (subject/subjectMax). */
  actualPct: number
}

/**
 * `actualPct` é a métrica expressa como % de "quanto da trilha já foi feito"
 * (progresso já é %; interações/reflexões viram % via `fractionPctOf`).
 * `expectedPct` ausente (sem trilha com deadline computável) ou `actualPct` nulo
 * (sem denominador) → `undefined`, degradação graciosa (freio não se aplica).
 * Exportada (SH-2.7.1) para `ritmo-summary.ts` reusar a MESMA régua na frase de
 * oportunidade (`behindMetricsOf`), sem duplicar a lógica de conversão/comparação.
 */
export function ownPaceSignalFor(
  actualPct: number | null,
  expectedPct: number | undefined,
): OwnPaceSignal | undefined {
  if (expectedPct === undefined || actualPct === null) return undefined
  return { ok: actualPct >= expectedPct, actualPct }
}

/**
 * SH-2.7 — `value/max` como %, ou `null` se o denominador for ausente/0 (sem
 * crash). Exportada (SH-2.7.1) pelo mesmo motivo de `ownPaceSignalFor`.
 */
export function fractionPctOf(value: number, max: number | undefined): number | null {
  if (!max || max <= 0) return null
  return (value / max) * 100
}

/**
 * SH-2.7.1 (Hugo 2026-07-20) — 1 casa decimal, formato brasileiro (vírgula, não
 * ponto). Exportada para `ritmo-summary.ts` reusar a MESMA formatação na frase
 * de oportunidade quantificada (`behindMetricsOf`), sem duplicar a regra.
 */
export function formatPctPtBR1(value: number): string {
  return value.toFixed(1).replace(".", ",")
}

/**
 * SH-2.7.1 (Hugo 2026-07-20, achado ao vivo) — a copy do freio ganhou o NÚMERO
 * REAL em vez do texto genérico fixo "acima da turma, mas abaixo do seu ritmo
 * esperado" (SH-2.7). Ex.: Reflexões do Rinaldo, 8/41 → "Acima da turma, mas
 * apenas 19,5% do seu potencial".
 */
function ownPaceCappedText(actualPct: number): string {
  return `Acima da turma, mas apenas ${formatPctPtBR1(actualPct)}% do seu potencial`
}

// SH-1.5 — ORDEM EXATA do mockup do Hugo (2026-07-18): Última atividade →
// Progresso - conclusão → Interações realizadas → Reflexões realizadas →
// Engajamento. Labels renomeados; frações X/Y em Interações/Reflexões (denominador
// da PRÓPRIA trilha, degrada ao absoluto); Engajamento é score ABSOLUTO (sem
// fração — a fração de SH-F.5 vive só na leitura "Como estou", via rank real).
function buildRows(indicators: StudentHomeIndicators): HomeRow[] {
  const s = indicators.subject
  const r = indicators.reference
  return [
    {
      key: "lastAccess",
      // SH-2.2 (Hugo 2026-07-19, caso Angelo) — renomeado de "Última atividade":
      // o rótulo antigo, combinado com um dado que até esta story incluía login
      // puro, convidava à leitura errada ("ativo" = abriu o app). O dado agora só
      // considera sessão/reflexão (ver student-home-indicators.ts); o rótulo
      // nomeia isso explicitamente.
      label: "Última sessão de estudo",
      direction: "lower", // menos dias = melhor (recência invertida)
      subjectValue: s.lastAccessDays,
      referenceValue: r.lastAccessAvgDays,
      // AJUSTE 2 (Hugo 2026-07-14): a célula Você mostra a PENÚLTIMA visita.
      // SH-2.2: null agora significa "nenhuma sessão de estudo real ainda" — pode
      // ser verdade mesmo após vários logins (login puro não conta mais), então o
      // antigo "Primeiro acesso" deixou de ser honesto; "Ainda sem sessão de
      // estudo" descreve o estado sem presumir que é o primeiro login.
      subjectNode: formatDays(s.lastAccessDays, "Ainda sem sessão de estudo"),
      referenceNode: formatDays(r.lastAccessAvgDays, "—"),
    },
    {
      key: "progress",
      label: "Progresso - conclusão",
      direction: "higher",
      subjectValue: s.progressPct,
      referenceValue: r.progressAvgPct,
      subjectNode: `${s.progressPct}%`,
      referenceNode: `${r.progressAvgPct}%`,
      isPct: true,
      // SH-2.7 — progresso já É uma % da trilha, comparação direta com o esperado.
      ownPace: ownPaceSignalFor(s.progressPct, s.expectedProgressPct),
    },
    {
      // `interactions` = sessões concluídas ("interações realizadas") no payload.
      // SH-1.5 — fração "X/Y" nos DOIS lados (Round 2, Hugo 2026-07-18): Você usa o
      // teto da PRÓPRIA trilha (interactionsMax); Turma usa a MÉDIA dos tetos da org
      // (interactionsMaxAvg). Cada lado degrada ao absoluto se o denominador vier
      // ausente/0 (formatFraction), sem crash.
      key: "sessions",
      label: "Interações realizadas",
      direction: "higher",
      subjectValue: s.interactions,
      referenceValue: r.interactionsAvg,
      subjectNode: formatFraction(s.interactions, s.interactionsMax),
      referenceNode: formatFraction(r.interactionsAvg, r.interactionsMaxAvg),
      // SH-2.7 — interações viram % da PRÓPRIA trilha (interactions/interactionsMax)
      // para comparar com o mesmo ritmo esperado do progresso.
      ownPace: ownPaceSignalFor(
        fractionPctOf(s.interactions, s.interactionsMax),
        s.expectedProgressPct,
      ),
    },
    {
      // SH-1.5 — fração "X/Y" nos DOIS lados (Round 2): Você usa reflectionsMax da
      // própria trilha; Turma usa reflectionsMaxAvg (média dos tetos da org).
      key: "reflections",
      label: "Reflexões realizadas",
      direction: "higher",
      subjectValue: s.reflections,
      referenceValue: r.reflectionsAvg,
      subjectNode: formatFraction(s.reflections, s.reflectionsMax),
      referenceNode: formatFraction(r.reflectionsAvg, r.reflectionsMaxAvg),
      // SH-2.7 (caso Rinaldo: 8/41 ≈19,5% < ritmo esperado ≈33% → freio) — mesma
      // lógica de `sessions`, com reflectionsMax.
      ownPace: ownPaceSignalFor(
        fractionPctOf(s.reflections, s.reflectionsMax),
        s.expectedProgressPct,
      ),
    },
    {
      // SH-1.5 Round 2 (Hugo 2026-07-18) — a linha Engajamento assimétrica por
      // decisão do Hugo: a célula VOCÊ mostra o RANKING (formatRank, "3º"), não
      // mais o score. A leitura "Como estou" e o vencedor/cor CONTINUAM baseados nos
      // scores brutos (subjectValue/referenceValue = s.engagement/r.engagementAvg),
      // SEM mudança — só o TEXTO exibido muda.
      // Round 6 (Hugo 2026-07-18) — a célula TURMA de Engajamento primeiro perdeu o
      // DENOMINADOR (número absoluto "13", não mais "13/57"), depois FOI CONSOLIDADA
      // numa ÚNICA frase. Olhando o app ao vivo, o Hugo achou o número solto "13" em
      // cima da legenda "Turma fez 13 pontos, em média" redundante — dois elementos
      // para dizer a mesma coisa. Agora a célula Turma DESTA LINHA é a frase inteira
      // "a turma fez, em média, {N} pontos", SEM o número isolado acima. Por isso o
      // `referenceNode` aqui deixa de ser um número (String(r.engagementAvg)) e passa
      // a NÃO renderizar um valor bruto na célula Turma da linha Engajamento — o
      // JSX abaixo detecta `row.key === "engagement"` e desenha a frase única no lugar
      // do ValueCell. As OUTRAS 4 linhas seguem com o valor bruto normal no ValueCell.
      // `referenceNode` fica como o número (fallback/semântica), mas NÃO é montado no
      // DOM da linha Engajamento (o JSX pula o ValueCell dela).
      key: "engagement",
      label: "Engajamento",
      direction: "higher",
      subjectValue: s.engagement,
      referenceValue: r.engagementAvg,
      subjectNode: formatRank(s.engagementRank, s.engagementTotalStudents),
      referenceNode: String(r.engagementAvg),
    },
  ]
}

/**
 * O pill do valor VENCEDOR (aluno acima) — cápsula verde original.
 * Round 3 (Hugo 2026-07-18): quando o aluno está ATRÁS, a célula Você também
 * ganha pill, mas na cor da severidade — amarelo (mild) ou vermelho (severe).
 * Tokens semânticos do design system (mesmos do chip da Leitura), aplicados como
 * fundo suave + texto na cor semântica (não texto branco: o fundo aqui é /10, não
 * sólido, para não competir em peso com o pill verde de vitória).
 */
const VALUE_PILL: Record<"tie" | "behind", string> = {
  // ROUND 16 (Hugo 2026-07-18) — o EMPATE ganhou pill no valor Você (antes caía em texto
  // neutro). Amarelo SUAVE, o MESMO par `/15` já calibrado/verificado do chip tie no Round 15.
  // SH-2.5 — `behind-mild`/`behind-severe` consolidados em `behind` (visual do antigo severe).
  tie: "bg-semantic-warning/15 text-semantic-warning",
  behind: "bg-semantic-error/10 text-semantic-error",
}

/**
 * One value cell. `pill` decide o destaque:
 *   • "win"    → pill verde sólido (o ALUNO venceu o indicador, estilo original);
 *   • "tie"    → pill amarelo suave (Round 16: EMPATE real — o valor Você da linha
 *                empatada também destaca, coerente com o chip/botão amarelo da mesma
 *                linha; antes caía em texto neutro, inconsistente com win/behind);
 *   • "behind" → pill vermelho suave (SH-2.5: consolidação de behind-mild/behind-severe,
 *                visual do antigo severe — a distinção mild/severe deixou de existir);
 *   • null     → texto neutro (SEM leitura possível/dado ausente, ou coluna Turma —
 *                que em geral NÃO destaca, EXCETO no empate real, Round 17). Empate
 *                REAL não é mais null desde o Round 16 (Você) / Round 17 (Turma também).
 * `data-win` permanece como semântica testável do vencedor direction-aware nos dois lados.
 */
function ValueCell({
  testid,
  win,
  pill,
  dim,
  children,
}: {
  testid: string
  win: boolean
  /** O tipo de destaque do valor, ou null para texto neutro. Turma sempre null. */
  pill: "win" | "tie" | "behind" | null
  dim: boolean
  children: React.ReactNode
}) {
  if (pill === "win") {
    return (
      <span
        data-testid={testid}
        data-win={win ? "true" : "false"}
        style={{ backgroundColor: WIN_BG, color: WIN_TEXT }}
        className="inline-flex items-center rounded-full px-3 py-1 text-sm font-bold tabular-nums shadow-sm"
      >
        {children}
      </span>
    )
  }
  if (pill === "tie" || pill === "behind") {
    return (
      <span
        data-testid={testid}
        data-win={win ? "true" : "false"}
        className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold tabular-nums ${VALUE_PILL[pill]}`}
      >
        {children}
      </span>
    )
  }
  return (
    <span
      data-testid={testid}
      data-win={win ? "true" : "false"}
      className={`text-sm tabular-nums ${dim ? "font-medium text-text-muted" : "font-semibold text-text-primary"}`}
    >
      {children}
    </span>
  )
}

/**
 * Round 3 (Hugo 2026-07-18) — o pill do valor da célula VOCÊ a partir do vencedor
 * da linha + o tom da Leitura (fonte única de severidade). Vitória → verde;
 * aluno atrás → cor da severidade (amarelo mild / vermelho severe).
 * ROUND 16 (Hugo 2026-07-18) — EMPATE REAL também destaca: quando `winner === null` MAS o
 * tom é `"tie"` (leituraFor só emite `"tie"` com AMBOS os valores presentes e IGUAIS), o valor
 * Você ganha pill amarelo suave, coerente com o chip/botão amarelo da mesma linha. Antes o
 * empate caía no `return null` (texto neutro), inconsistente com win/behind que sempre
 * destacam o valor. CRÍTICO — distinguir "empatou de verdade" (`tone === "tie"`) de "SEM
 * dado" (`tone === "none"`, quando falta valor de um lado): só o empate real merece pill; a
 * ausência de dado continua em texto neutro (return null). Pure, exported for tests.
 * Round 17: o call site reusa este resultado (`=== "tie"`) para decidir se a coluna Turma
 * também destaca no empate real — a função descreve o lado Você, o call site a estende.
 */
export function subjectPillFor(
  winner: Winner,
  tone: Leitura["tone"],
): "win" | "tie" | "behind" | null {
  if (winner === "subject") return "win"
  // SH-2.5 — behind-mild/behind-severe consolidados: qualquer "reference" com tom
  // "behind" destaca vermelho, sem checar severidade (não existe mais).
  if (winner === "reference" && tone === "behind") return "behind"
  // Round 16 — empate REAL (winner null + tom "tie"): destaca. Ausência de dado (tom "none")
  // não destaca. Este é o ÚNICO caminho que agora retorna algo com winner === null.
  if (winner === null && tone === "tie") return "tie"
  return null
}

/** The % progress bar — verde quando o ALUNO vence a linha; neutra no resto. */
function PctBar({ pct, win }: { pct: number | null; win: boolean }) {
  if (pct === null) return null
  return (
    <div
      style={{ backgroundColor: BAR_TRACK }}
      className="mx-auto mt-2 h-1.5 w-16 overflow-hidden rounded-full"
    >
      {pct > 0 && (
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(100, Math.max(0, pct))}%`,
            backgroundColor: win ? BAR_WIN_FILL : BAR_FILL,
          }}
        />
      )}
    </div>
  )
}

export function ComparisonInsightsTable({
  indicators,
  studentFirstName,
  continueHref = DEFAULT_CONTINUE_HREF,
  interactionHref,
  reflectionHref,
}: {
  indicators: StudentHomeIndicators
  /**
   * A label da coluna do sujeito: no aluno logado, "Eu (Nome)"; num drill de
   * gestor, o primeiro nome do aluno visto. Ausente → "Você".
   */
  studentFirstName?: string | null
  /**
   * ROUND 4 (Hugo 2026-07-18) — o destino do BOTÃO ACIONÁVEL que aparece ao lado
   * do chip "Como estou" quando o aluno está atrás. É o mesmo link de continuação
   * da trilha que o StudentHomeCard já tem (threaded a partir dele). Opcional com
   * default seguro (DEFAULT_CONTINUE_HREF) para não quebrar call sites/testes que
   * renderizam a tabela sem passar o href — o único uso real (student-home-card)
   * sempre passa o valor concreto.
   *
   * SH-3.3 (Hugo 2026-07-21) — deixou de ser o destino ÚNICO das 5 linhas: agora
   * é o FALLBACK genérico quando `interactionHref`/`reflectionHref` estão
   * ausentes (sem pendência real, ou trilha vazia).
   */
  continueHref?: string
  /**
   * SH-3.3 — deep-link para a PRÓXIMA interação socrática pendente (capítulo com
   * sessão em aberto ou sem sessão concluída ainda). Alimenta as linhas
   * "progress" ("Continuar sessão"), "sessions" ("Fazer uma interação") e
   * "engagement" ("Continuar agora" — mesmo destino de "Continuar sessão").
   * Ausente/null → essas 3 linhas caem no `continueHref` genérico.
   */
  interactionHref?: string | null
  /**
   * SH-3.3 — deep-link para a PRÓXIMA reflexão pendente (slide com prompt de
   * reflexão ainda não respondido). Alimenta SÓ a linha "reflections"
   * ("Registrar uma reflexão"). Ausente/null → cai no `continueHref` genérico.
   */
  reflectionHref?: string | null
}) {
  const rows = buildRows(indicators)
  // SH-3.3 — resolução de href POR LINHA: "lastAccess" mantém o continueHref
  // genérico (a leitura da linha não é acionável por um deep-link específico);
  // as demais preferem o deep-link real e degradam para continueHref na ausência.
  const rowHref: Record<RowKey, string> = {
    lastAccess: continueHref,
    progress: interactionHref ?? continueHref,
    sessions: interactionHref ?? continueHref,
    reflections: reflectionHref ?? continueHref,
    engagement: interactionHref ?? continueHref,
  }

  return (
    // Framed "micro-table" — the manager finish (bordered, rounded, light header
    // row, row dividers). Same grammar as the gestor "Tabela simplificada",
    // agora SEM setas de ordenação (tabela transposta não ordena).
    <div
      className="overflow-hidden rounded-xl"
      style={{ border: "1px solid var(--color-border-subtle)" }}
      data-testid="comparison-insights-table"
    >
      {/* SH-3.4 (responsividade) — colapso CSS-ONLY abaixo de lg: os MESMOS nós
          <table>/<tr>/<td> mudam de display via variantes max-lg:* (tabela →
          cards empilhados por indicador), SEM duplicar DOM. Duplicar o markup
          (tabela hidden + cards lg:hidden) quebraria os getByTestId/getByText
          estritos dos 131 testes deste arquivo (jsdom não aplica CSS, os dois
          layouts coexistiriam nas queries). Em lg+ nenhuma variante max-lg se
          aplica — o desktop aprovado fica intacto, classe por classe. */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm max-lg:block">
          <thead className="max-lg:hidden">
            <tr
              style={{
                backgroundColor: "var(--color-bg-elevated)",
                borderBottom: "1px solid var(--color-border-subtle)",
              }}
            >
              <th className="px-4 py-3 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Indicador
                </span>
              </th>
              <th className="px-4 py-3 text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                  {subjectColumnLabel(studentFirstName)}
                </span>
              </th>
              <th className="px-4 py-3 text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Turma
                </span>
              </th>
              {/* ROUND 8 (Hugo 2026-07-18) — "Como estou" e a ação viraram DUAS
                  colunas REAIS de tabela (antes: 1 <td> com flex interno, o que
                  desalinhava o botão entre linhas porque o chip varia de largura).
                  Colunas nativas de <table> alinham automaticamente. A 2ª coluna
                  é a AÇÃO (o botão); o rótulo fica sr-only (o chip já é a explicação
                  visível, o botão é só o CTA). */}
              <th className="px-4 py-3 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Como estou
                </span>
              </th>
              {/* Round 24 — text-center (não mais text-left): os botões da coluna abaixo
                  ganharam largura padronizada e centralização própria. O header em si não
                  tem texto visível (sr-only), mas o alinhamento acompanha a coluna real. */}
              <th className="px-4 py-3 text-center">
                <span className="sr-only">Ação</span>
              </th>
            </tr>
          </thead>
          <tbody className="max-lg:block">
            {rows.map((row, i) => {
              // SH-2.5 (item 3) — "Última sessão de estudo" usa a leitura própria por
              // faixa absoluta de recência (recencyReadingFor), DESACOPLADA de
              // winnerOf/comparação com a Turma. As outras 4 linhas seguem o caminho
              // comparativo padrão (winnerOf + leituraFor, agora com a faixa de
              // tolerância de 5% do item 1 E o freio absoluto de ritmo esperado da
              // SH-2.7 — `effectiveWinnerFor` rebaixa "subject" p/ null quando
              // `row.ownPace?.ok === false`, ANTES de subjectPillFor decidir o pill).
              const { winner, leitura } =
                row.key === "lastAccess"
                  ? recencyReadingFor(row.subjectValue)
                  : {
                      winner: effectiveWinnerFor(
                        winnerOf(row.subjectValue, row.referenceValue, row.direction),
                        row.ownPace?.ok,
                      ),
                      leitura: leituraFor(
                        row.key,
                        row.subjectValue,
                        row.referenceValue,
                        row.direction,
                        // AC7 — the real rank signal only affects the Engajamento row; any
                        // other row ignores it. Absent → treated as not-#1 (standard copy).
                        indicators.subject.isTopEngagement,
                        row.ownPace,
                      ),
                    }
              // Round 16/17 — o destaque do valor Você (win/tie/behind) computado UMA vez.
              // Round 17 reusa `=== "tie"` (empate REAL) para decidir se a Turma também
              // destaca — a MESMA fonte de verdade, sem re-derivar o empate por valores brutos.
              const subjectPill = subjectPillFor(winner, leitura.tone)
              const isRealTie = subjectPill === "tie"
              return (
                <tr
                  key={row.key}
                  data-testid={`row-${row.key}`}
                  // SH-3.4 — abaixo de lg a linha vira um CARD (grid 2 colunas):
                  // nome (span 2) / Você | Turma lado a lado / chip (span 2) /
                  // botão full-width (span 2). O borderTop inline vira o divisor
                  // entre cards. Em lg+, table-row nativo, layout intocado.
                  className="transition-colors hover:bg-bg-hover max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-3 max-lg:gap-y-3 max-lg:p-4"
                  style={i > 0 ? { borderTop: "1px solid var(--color-border-subtle)" } : undefined}
                >
                  <td className="px-4 py-4 text-left max-lg:col-span-2 max-lg:p-0">
                    <span className="text-sm font-semibold text-text-primary">{row.label}</span>
                  </td>
                  <td className="px-4 py-4 text-center max-lg:p-0">
                    {/* SH-3.4 — mini-cabeçalho por célula no mobile (o <thead> está
                        display:none abaixo de lg). Minúsculas no texto + uppercase
                        via CSS: "Você"/"Eu (Nome)"/"Turma" do thead precisam seguir
                        ÚNICOS nas queries getByText dos testes. */}
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted lg:hidden">
                      você
                    </div>
                    <ValueCell
                      testid={`cell-subject-${row.key}`}
                      win={winner === "subject"}
                      // Round 3 (Hugo 2026-07-18) — o pill do valor Você segue o
                      // resultado: vitória → verde; atrás → cor da severidade
                      // (amarelo/vermelho, mesma fonte de verdade da Leitura).
                      // Round 16 — empate REAL → pill amarelo "tie"; ausência de dado → null.
                      pill={subjectPill}
                      dim={false}
                    >
                      {row.subjectNode}
                    </ValueCell>
                    {/* Round 3 (Hugo 2026-07-18) — SÓ na linha Engajamento a célula
                        Você ganha uma 2ª linha muted com a pontuação bruta que
                        vivia aqui antes. As outras 4 linhas NÃO têm esta legenda. */}
                    {row.key === "engagement" && (
                      <div
                        data-testid="cell-subject-engagement-raw"
                        className="mt-1 text-xs text-text-muted"
                      >
                        {`Você fez ${indicators.subject.engagement} pontos`}
                      </div>
                    )}
                    {row.isPct && <PctBar pct={row.subjectValue} win={winner === "subject"} />}
                  </td>
                  <td className="px-4 py-4 text-center max-lg:p-0">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted lg:hidden">
                      turma
                    </div>
                    {/* ROUND 9 (Hugo 2026-07-18) — a célula Turma da linha Engajamento
                        virou DUAS linhas, espelhando a estrutura da célula Você do mesmo
                        indicador (pill "11º" em cima + legenda muted "Você fez N pontos"
                        embaixo). Enquanto Você mostra a POSIÇÃO (11º), a Turma mostra o
                        TAMANHO da população ("46 pessoas") — juntas, as duas células
                        reconstroem "11 de 46" (o "de 46" que o Round 6 tirou do texto do
                        rank, agora de volta do lado Turma por pedido do Hugo). A linha de
                        TOPO é o total de pessoas (`engagementTotalStudents`, o MESMO campo
                        que alimenta `formatRank`, via `formatPopulation` — sem cálculo
                        novo), com o peso das demais células Turma (`text-sm font-medium`).
                        A linha de BAIXO é a legenda muted "Média da turma: {N} pontos"
                        (`reference.engagementAvg`, a MESMA fonte da frase de antes; a
                        unidade "pontos" foi acrescentada no Round 11), mesmo estilo da
                        legenda "Você fez N pontos" do lado
                        Você (`text-xs text-text-muted`). Degradação graciosa: se o total
                        vier ausente/malformado, `formatPopulation` devolve null e a linha
                        de topo é OMITIDA (sem "undefined pessoas") — a legenda da média
                        segue sozinha. `data-testid` `cell-reference-engagement` fica no
                        valor principal (linha de topo); a legenda ganha
                        `cell-reference-engagement-avg`. */}
                    {row.key === "engagement" ? (
                      <>
                        {formatPopulation(indicators.subject.engagementTotalStudents) !== null && (
                          <div
                            data-testid={`cell-reference-${row.key}`}
                            className="text-sm font-medium text-text-muted"
                          >
                            {formatPopulation(indicators.subject.engagementTotalStudents)}
                          </div>
                        )}
                        <div
                          data-testid="cell-reference-engagement-avg"
                          className="mt-1 text-xs text-text-muted"
                        >
                          {`Média da turma: ${indicators.reference.engagementAvg} pontos`}
                        </div>
                      </>
                    ) : (
                      <ValueCell
                        testid={`cell-reference-${row.key}`}
                        win={winner === "reference"}
                        // A coluna Turma NUNCA destaca (regra desde o Round 3) — EXCETO no
                        // EMPATE REAL (ROUND 17, Hugo 2026-07-18: "coloca o amarelo nos dois
                        // pois estão empatados"). A lógica do Hugo: em win/behind só UM lado
                        // "venceu", então só ele destaca; mas no empate os dois têm o MESMO
                        // valor e por isso os DOIS merecem o mesmo destaque amarelo. Reusa
                        // `isRealTie` (o mesmo `subjectPill === "tie"` da célula Você, empate
                        // REAL, não "sem dado") — sem duplicar a decisão. Fora do empate, a
                        // regra geral de "Turma nunca destaca" segue intacta (null).
                        pill={isRealTie ? "tie" : null}
                        dim={true}
                      >
                        {row.referenceNode}
                      </ValueCell>
                    )}
                    {row.isPct && <PctBar pct={row.referenceValue} win={false} />}
                  </td>
                  {/* ROUND 4 (Hugo 2026-07-18) — chip + botão acionável.
                      ROUND 6 (Hugo 2026-07-18) — o botão passa a ser UNIVERSAL: o
                      gate `winner === "reference"` foi REMOVIDO, o ActionButton é
                      renderizado INCONDICIONALMENTE em TODAS as 5 linhas. Deixou de
                      ser um convite condicional só para quem está mal e virou um CTA
                      de "continue melhorando" que aparece ganhando, empatando ou
                      atrás (o Hugo, olhando o app ao vivo: "mesmo para o Rinaldo, tem
                      que ter os botões para melhorar ainda mais a performance dele").
                      Os labels por linha (ACTION_LABEL) já são neutros/genéricos o
                      suficiente para servir aos dois casos, sem reescrita.
                      ROUND 7 (Hugo 2026-07-18) — a COR do botão deixou de ser fixa
                      (cerrado) e passou a ESPELHAR o `leitura.tone` da MESMA linha
                      (via ACTION_BUTTON_STYLE): win=verde, tie=neutro, behind-mild=
                      âmbar, behind-severe=vermelho, none=cerrado fallback. Fonte única
                      de verdade = `leitura.tone` (o mesmo que colore o chip), então o
                      chip e o botão da linha ficam visualmente coerentes. O botão
                      segue UNIVERSAL (presente nas 5 linhas). A severidade amarelo/
                      vermelho do CHIP e do PILL do valor (Round 3) segue intocada.
                      ROUND 8 (Hugo 2026-07-18) — o chip e o botão saíram de uma ÚNICA
                      <td> com flex interno e viraram DUAS <td>s REAIS (chip | ação). O
                      flex desalinhava o botão entre linhas: o chip varia de largura
                      ("ativo acima da média" vs "no ritmo da turma"), então o botão ao
                      lado começava em X diferente em cada linha. Com 2 colunas nativas
                      de <table>, o navegador alinha a coluna de ações automaticamente
                      em todas as linhas. data-testid `leitura-*`/`action-*` PRESERVADOS,
                      só mudou o contêiner (de <div> numa <td> para 2 <td>s). */}
                  <td className="px-4 py-4 text-left max-lg:col-span-2 max-lg:p-0">
                    <LeituraChip leitura={leitura} testid={`leitura-${row.key}`} />
                  </td>
                  {/* Round 24 — text-center (não mais text-left): com o botão agora em
                      largura padronizada, centralizar a célula alinha os 5 botões entre si
                      visualmente, em vez de ficarem encostados à esquerda com larguras
                      naturalmente diferentes por rótulo. Round 25 — a largura virou REAL
                      fixa, com fonte do rótulo variável por linha (ACTION_LABEL_SIZE) para
                      os 5 botões ficarem genuinamente simétricos. Round 26 — w-[205px]
                      (mais espaço) + progressão de fonte inteira +2px, sem perder a
                      simetria. */}
                  <td className="px-4 py-4 text-center max-lg:col-span-2 max-lg:p-0">
                    <ActionButton
                      href={rowHref[row.key]}
                      label={ACTION_LABEL[row.key]}
                      labelClassName={ACTION_LABEL_SIZE[row.key]}
                      testid={`action-${row.key}`}
                      tone={leitura.tone}
                      // Round 10 — ícone semântico por linha (à esquerda, liderança).
                      Icon={ACTION_ICON[row.key]}
                      iconTestid={`action-icon-${row.key}`}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
