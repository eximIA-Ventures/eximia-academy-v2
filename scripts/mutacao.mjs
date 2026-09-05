// USO: node scripts/mutacao.mjs [--tudo] [--somente=ROTULO,ROTULO] [--suite=caminho,...]
//
//      sem argumento   → só os mutantes ORIGINAIS de "Padrões e tendências"
//                        (compatibilidade preservada — ver ROTULOS_PADRAO). ~6 min.
//      --somente=A5,A6 → só os rótulos pedidos. **`--suite=` NÃO é mais
//                        necessário**: a suíte é derivada do arquivo alvo por
//                        `SUITE_DO_ARQUIVO`, e mutantes de áreas diferentes na
//                        mesma invocação são agrupados, com um baseline cada.
//      --tudo          → TODOS os mutantes, cada grupo contra a própria suíte.
//                        ~8 min medidos nesta máquina (2026-08-29).
//      --suite=...     → escape explícito do operador, sobrepõe a derivação.
//
//      TEMPO POR SUÍTE (medido, 2026-08-29): padrões ~11s · aprendizagem ~4s ·
//      autogestão ~3s · gate da trinca ~2s · jornada ~3s. Custa 1 baseline por
//      grupo + 1 execução por mutante.
//
//      POR QUE OS NOVOS NÃO ENTRARAM NO CONJUNTO PADRÃO: ver a nota de decisão
//      junto a `SUITE_DO_ARQUIVO`. Em resumo — um default achatado rodaria UMA
//      suíte contra mutantes de cinco áreas, e o resultado disso não é lento, é
//      FALSO. O que faz a régua rodar é `--tudo` ser um comando só.
//
// ---------------------------------------------------------------------------
// mutacao — a varredura que pega o que teste de invariância NÃO pega.
// ---------------------------------------------------------------------------
// O QUE ELA FAZ: para cada constante ou trecho estrutural da lista `MUTANTES`,
// perturba o código, roda a suíte, REVERTE, e compara o conjunto de testes
// vermelhos com o do baseline. Constante cuja perturbação não vira nada é
// achado, e o relatório tem que dizer QUAL dos dois casos é, porque a ação é
// oposta: a MORTA (não chega à saída) some do código; a NÃO COBERTA (chega, e
// nenhum teste olha) ganha teste.
//
// POR QUE ELA EXISTE. Três detectores comuns são cegos para a mesma família:
//
//   • `tsc --noUnusedLocals --noUnusedParameters` pega declarado-e-nunca-lido,
//     e NÃO pega valor lido e depois aniquilado (`x * 0 + 1` devolvendo sempre 1);
//   • contar ocorrência do identificador pega local morto, e NÃO pega constante
//     lida cuja variação não muda saída nenhuma;
//   • teste de invariância NÃO pega nada disso por construção — a função
//     constante satisfaz TODA invariância.
//
// O CASO QUE ORIGINOU ISTO (2026-08-20, §17 "Evolução do ritmo"): três asserções
// escritas de boa-fé eram TAUTOLÓGICAS —
//
//     expect(marcador.cy).toBe(BASE)   // BASE importado do MÓDULO SOB TESTE
//
// Mutar `BASE` de 162 para 120 movia o `cy` e movia a expectativa JUNTO. Verde
// sempre. Uma asserção que não pode falhar é pior que asserção nenhuma, porque
// ocupa a vaga: um buraco declarado se fecha, um buraco com carimbo de PASS por
// cima dorme até a produção. A correção não foi somar asserção, foi TROCAR A
// ÂNCORA — comparar com um fato EXTERNO (lido do DOM, do contrato, da camada de
// dados) em vez de comparar o módulo consigo mesmo.
//
// E o critério "importa constante do módulo" NÃO serve para achar tautologia:
// no mesmo arquivo, `PASSO_DE_DESLOCAMENTO` e `RAIO_MARCA` são importados e
// usados em asserção, e os dois ACUSAM. O que decide é se os dois lados da
// comparação se movem juntos, e só a mutação responde isso. Ler não responde.
//
// ═══ DUAS REGRAS DE OPERAÇÃO, E NENHUMA É OPCIONAL ═════════════════════════
//
//   1. INJEÇÃO NUNCA ACONTECE EM ÁRVORE COMPARTILHADA SEM AVISO. Um defeito
//      injetado e um defeito real são o mesmo byte no disco: quem lê de fora não
//      tem como distinguir. Ou clone isolado, ou uma janela ANUNCIADA — avisada
//      ao abrir e ao fechar, com ninguém commitando nem lendo a árvore como
//      verdade enquanto ela estiver aberta. Nesta casa um verificador quase
//      julgou uma injeção em voo como defeito esquecido.
//
//   2. BASELINE COM ZERO FALHA. Com baseline sujo a leitura vira ambígua; com
//      zero, todo vermelho depois de uma mutação É a mutação. O script recusa
//      rodar se o baseline tiver falha.
//
// SEGURANÇA: cada arquivo alvo é copiado para `.mutacao-backup` antes da
// primeira injeção e restaurado ao final, com conferência de sha256. Se o
// processo morrer no meio, o backup fica em disco e a restauração é
// `cp arquivo.mutacao-backup arquivo`.
//
// CLONE ISOLADO E BARATO (o caminho preferido): não copie o repo inteiro.
//   ORIG=$PWD; CL=/tmp/mut-alvo
//   rsync -a --exclude node_modules --exclude .next "$ORIG/apps/web/src/" "$CL/apps/web/src/"
//   for f in package.json tsconfig.json vitest.config.ts; do cp "$ORIG/apps/web/$f" "$CL/apps/web/$f"; done
//   ln -s "$ORIG/node_modules" "$CL/node_modules"; ln -s "$ORIG/apps/web/node_modules" "$CL/apps/web/node_modules"
// O alias `@` do vitest.config.ts resolve para o `src` do CLONE.
// ---------------------------------------------------------------------------

import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { copyFileSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const RAIZ_REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const APP = `${RAIZ_REPO}/apps/web`

const GRAFICO = `${APP}/src/components/analytics/padroes-tendencias/grafico-ritmo.tsx`
const BASE = `${APP}/src/lib/analytics/padroes-tendencias/base.ts`
const SERIE = `${APP}/src/lib/analytics/padroes-tendencias/serie.ts`

// --- alvos das duas frentes novas (LOOP-2/LOOP-0c, 2026-08-28) --------------
// Aprendizagem do Time (analytics do gestor) e Autogestão da Jornada (aluno).
const AUTOGESTAO_FONTE = `${APP}/src/lib/analytics/autogestao/fonte-supabase.ts`
const APRENDIZAGEM_FONTE = `${APP}/src/lib/analytics/aprendizagem-time/fonte-supabase.ts`
const TRINCA_RECORTE = `${APP}/src/app/(platform)/analytics/_trinca/recorte.ts`
const ANALYTICS_PAGE = `${APP}/src/app/(platform)/analytics/page.tsx`
const JORNADA_RECORTE = `${APP}/src/app/(platform)/jornada/_autogestao/recorte.ts`
const LIMIARES = `${APP}/src/lib/analytics/aprendizagem-time/classificador/limiares.ts`
const APRENDIZAGEM_BASE = `${APP}/src/lib/analytics/aprendizagem-time/base.ts`
const AGREGADOR = `${APP}/src/lib/analytics/aprendizagem-time/classificador/agregador.ts`
const HEURISTICA = `${APP}/src/lib/analytics/aprendizagem-time/classificador/heuristica.ts`
const CAPACIDADES_EVOLUCAO = `${APP}/src/lib/analytics/aprendizagem-time/capacidades-evolucao.ts`
const SEMANAS = `${APP}/src/lib/analytics/aprendizagem-time/semanas.ts`
const ESTADO_BLOCO = `${APP}/src/lib/analytics/aprendizagem-time/estado-bloco.ts`
const SERIE_PROFUNDIDADE = `${APP}/src/lib/analytics/aprendizagem-time/serie-profundidade.ts`
const MAPA_DE_CALOR = `${APP}/src/lib/analytics/autogestao/mapa-de-calor.ts`
const PARAMETROS_AUTOGESTAO = `${APP}/src/lib/analytics/autogestao/parametros.ts`
// --- alvos da amostra de LOOP-0c (falha silenciosa, 1 por forma) -----------
const APPLY_ROUTE = `${APP}/src/app/api/course-designer/blueprints/[blueprintId]/apply/route.ts`
const MONTAGEM_APRENDIZAGEM = `${APP}/src/lib/analytics/aprendizagem-time/montagem.ts`
const GENERATE_ROUTE = `${APP}/src/app/api/course-designer/generate/route.ts`
const AGGREGATE_ROUTE = `${APP}/src/app/api/analytics/aggregate/route.ts`
const COURSES_ROUTE = `${APP}/src/app/api/courses/route.ts`

const SUITE_PADRAO = [
  "src/lib/analytics/padroes-tendencias",
  "src/components/analytics/padroes-tendencias",
]

const SUITE_APRENDIZAGEM_TIME = [
  "src/lib/analytics/aprendizagem-time",
  "src/components/analytics/aprendizagem-time",
]
const SUITE_AUTOGESTAO = ["src/lib/analytics/autogestao", "src/components/analytics/autogestao"]
const SUITE_TRINCA_GATE = ["src/components/dashboard/__tests__/analytics-redirect.test.ts"]
const SUITE_JORNADA_GATE = ["src/app/(platform)/jornada"]
const SUITE_ROTAS_API = ["src/app/api"]

/**
 * A SUÍTE É PROPRIEDADE DO ALVO, NÃO ARGUMENTO DO OPERADOR (2026-08-29).
 *
 * O QUE ISTO CORRIGE. Até aqui `--suite=` era um argumento do PROCESSO INTEIRO,
 * e o pareamento com `--somente=` vivia numa tabela em prosa neste comentário.
 * O próprio cabeçalho avisava o risco: "sem isso a suíte errada roda em
 * silêncio". Esse é o pior modo de falha possível NESTE script em particular —
 * o resultado de um mutante não executado é `SILENCIO`, byte a byte igual ao de
 * um mutante executado e não coberto. Ou seja: errar o `--suite=` não dá erro,
 * dá **um achado falso**, na exata confusão morto × não-coberto que este script
 * existe para não cometer.
 *
 * Pedir disciplina ao operador não resolve — o mapa abaixo resolve. Cada arquivo
 * alvo tem UMA suíte que o exercita, e o motor a deriva sozinha, agrupando os
 * mutantes escolhidos por suíte e rodando um baseline por grupo. Não há mais
 * combinação inválida a acertar: poka-yoke, não bula.
 *
 * `--suite=` continua existindo como escape explícito do operador (medir um
 * alvo contra outra suíte de propósito), mas deixou de ser obrigatório e deixou
 * de ser a única coisa entre o operador e um número falso.
 *
 * Alvo novo sem entrada aqui é ERRO DURO na partida (ver `suiteDoArquivo`) —
 * preferível a rodar contra a suíte errada e produzir um `SILENCIO` mentiroso.
 */
const SUITE_DO_ARQUIVO = new Map([
  [GRAFICO, SUITE_PADRAO],
  [BASE, SUITE_PADRAO],
  [SERIE, SUITE_PADRAO],
  [AUTOGESTAO_FONTE, SUITE_AUTOGESTAO],
  [MAPA_DE_CALOR, SUITE_AUTOGESTAO],
  [PARAMETROS_AUTOGESTAO, SUITE_AUTOGESTAO],
  [APRENDIZAGEM_FONTE, SUITE_APRENDIZAGEM_TIME],
  [LIMIARES, SUITE_APRENDIZAGEM_TIME],
  [APRENDIZAGEM_BASE, SUITE_APRENDIZAGEM_TIME],
  [AGREGADOR, SUITE_APRENDIZAGEM_TIME],
  [HEURISTICA, SUITE_APRENDIZAGEM_TIME],
  [CAPACIDADES_EVOLUCAO, SUITE_APRENDIZAGEM_TIME],
  [SEMANAS, SUITE_APRENDIZAGEM_TIME],
  [ESTADO_BLOCO, SUITE_APRENDIZAGEM_TIME],
  [SERIE_PROFUNDIDADE, SUITE_APRENDIZAGEM_TIME],
  [MONTAGEM_APRENDIZAGEM, SUITE_APRENDIZAGEM_TIME],
  [TRINCA_RECORTE, SUITE_TRINCA_GATE],
  [ANALYTICS_PAGE, SUITE_TRINCA_GATE],
  [JORNADA_RECORTE, SUITE_JORNADA_GATE],
  // A amostra do LOOP-0c (F*) mora em rotas; quem as exercita é `src/app/api`.
  // O catálogo anterior não pareava suíte alguma para o eixo F — a tabela em
  // prosa ia só até E, e rodar F sem `--suite=` batia na SUITE_PADRAO e dava
  // SILENCIO em todos, por não-execução. Era o modo de falha descrito acima,
  // acontecendo por omissão em vez de por engano.
  [APPLY_ROUTE, SUITE_ROTAS_API],
  [GENERATE_ROUTE, SUITE_ROTAS_API],
  [AGGREGATE_ROUTE, SUITE_ROTAS_API],
  [COURSES_ROUTE, SUITE_ROTAS_API],
])

/**
 * [rótulo, arquivo, trecho original, trecho mutado].
 *
 * É a ÚNICA coisa a trocar para apontar a varredura a outro alvo. O motor não
 * muda. Os 30 abaixo são os da rodada de origem, e servem de exemplo de calibre:
 * há mutante por constante numérica, por cor, por estrutura de mapa (trocar as
 * duas séries) e por ramo de função (degenerar o passo, remover a contenção).
 */
const MUTANTES = [
  ["LARGURA", GRAFICO, "export const LARGURA = 432", "export const LARGURA = 999"],
  ["ALTURA", GRAFICO, "const ALTURA = 190", "const ALTURA = 260"],
  ["TOPO", GRAFICO, "const TOPO = 12", "const TOPO = 60"],
  ["BASE", GRAFICO, "export const BASE = 162", "export const BASE = 120"],
  ["EIXO_X", GRAFICO, "export const EIXO_X = 30", "export const EIXO_X = 90"],
  ["FIM_X", GRAFICO, "export const FIM_X = 430", "export const FIM_X = 300"],
  ["GRADE", GRAFICO, 'const GRADE = "#EDE8E5"', 'const GRADE = "#112233"'],
  ["GRADE_ZERO", GRAFICO, 'const GRADE_ZERO = "#DCD5D1"', 'const GRADE_ZERO = "#445566"'],
  [
    "TINTA_ATIVOS",
    GRAFICO,
    'const TINTA_ATIVOS = TINTA_FAIXA["2x-ou-mais"]',
    'const TINTA_ATIVOS = "#123456"',
  ],
  [
    "TINTA_SESSOES",
    GRAFICO,
    'const TINTA_SESSOES = TINTA_FAIXA["1x"]',
    'const TINTA_SESSOES = "#654321"',
  ],
  [
    "TINTA_DA_SERIE",
    GRAFICO,
    "  ativos: TINTA_ATIVOS,\n  sessoes: TINTA_SESSOES,",
    "  ativos: TINTA_SESSOES,\n  sessoes: TINTA_ATIVOS,",
  ],
  ["VALOR_DA_SERIE", GRAFICO, "  sessoes: (p) => p.sessoes,", "  sessoes: (p) => p.ativos,"],
  [
    "PASSO_DE_DESLOCAMENTO",
    GRAFICO,
    "export const PASSO_DE_DESLOCAMENTO = 8",
    "export const PASSO_DE_DESLOCAMENTO = 0",
  ],
  ["RAIO_MARCA", GRAFICO, "export const RAIO_MARCA = 3.2", "export const RAIO_MARCA = 9"],
  [
    "ORDEM_DE_PINTURA",
    GRAFICO,
    'const ORDEM_DE_PINTURA: readonly IdSerie[] = ["sessoes", "ativos"]',
    'const ORDEM_DE_PINTURA: readonly IdSerie[] = ["ativos", "sessoes"]',
  ],
  ["ESPESSURA_DA_SERIE", GRAFICO, "{ ativos: 1.6, sessoes: 2.2 }", "{ ativos: 2.2, sessoes: 2.2 }"],
  [
    "TRACEJADO_DA_SERIE",
    GRAFICO,
    '{ ativos: "5 3.4", sessoes: null }',
    "{ ativos: null, sessoes: null }",
  ],
  ["FONTE_EIXO_Y", GRAFICO, "const FONTE_EIXO_Y = 9", "const FONTE_EIXO_Y = 22"],
  ["FONTE_ROTULO_X", GRAFICO, "const FONTE_ROTULO_X = 8.6", "const FONTE_ROTULO_X = 4"],
  ["FONTE_VALOR", GRAFICO, "const FONTE_VALOR = 8", "const FONTE_VALOR = 2"],
  [
    "LARGURA_CARACTERE",
    GRAFICO,
    "const LARGURA_CARACTERE = 0.56",
    "const LARGURA_CARACTERE = 0.05",
  ],
  ["VAO_ROTULO", GRAFICO, "const VAO_ROTULO = 6", "const VAO_ROTULO = 600"],
  ["VAO_VALOR", GRAFICO, "const VAO_VALOR = 2.5", "const VAO_VALOR = 40"],
  [
    "SEPARADOR_DE_INTERVALO",
    GRAFICO,
    "const SEPARADOR_DE_INTERVALO = /\\s[^\\p{L}\\p{N}]+\\s/u",
    "const SEPARADOR_DE_INTERVALO = /ZZZNUNCACASA/u",
  ],
  [
    "passoDosRotulos",
    GRAFICO,
    "  return Math.max(1, Math.ceil((maior + VAO_ROTULO) / fatia))",
    "  return Math.max(1, Math.ceil((maior + VAO_ROTULO) / fatia)) * 0 + 1",
  ],
  [
    "xDoRotulo",
    GRAFICO,
    "  return Math.min(Math.max(centro, meia + 1), LARGURA - meia - 1)",
    "  return centro + meia * 0",
  ],
  [
    "rotulosDoEixo",
    GRAFICO,
    'textos: usados.map((t, i) => ((n - 1 - i) % passo === 0 ? t : "")),',
    'textos: usados.map((t, i) => (i % passo === 0 ? t : "")),',
  ],
  [
    "base:so-created_at",
    BASE,
    "      if (i >= 0) semanasDaSessao.add(i)",
    "      if (i >= 0 && iso === s.created_at) semanasDaSessao.add(i)",
  ],
  [
    "base:sem-dedupe",
    BASE,
    "    for (const i of semanasDaSessao) sessoesPorSemana[i] = (sessoesPorSemana[i] ?? 0) + 1",
    "    for (const i of semanasDaSessao) sessoesPorSemana[i] = (sessoesPorSemana[i] ?? 0) + 2",
  ],
  [
    "base:ativos-sem-updated_at",
    BASE,
    "      lista.push(t)\n      const i = indiceDoBalde(semanas, t)",
    "      if (iso === s.created_at) lista.push(t)\n      const i = indiceDoBalde(semanas, t)",
  ],
  [
    "serie:eixo-no-pico",
    SERIE,
    "  if (pico > totalRecorte) return eixoY(pico)\n  return eixoAncorado(totalRecorte)",
    "  if (pico > totalRecorte) return eixoY(pico)\n  return eixoAncorado(Math.max(1, pico))",
  ],

  // =========================================================================
  // Duas frentes novas — Aprendizagem do Time + Autogestão da Jornada.
  // Catalogados em 2026-08-28 (LOOP-0d) a partir de:
  //   - LOOP-2-funcional.md — 49 mutações já aplicadas em CLONE isolado e
  //     medidas contra a suíte real (23 PEGOU / 26 NÃO PEGOU). Os rótulos e o
  //     placar "hoje" abaixo reproduzem aquela medição; NÃO foram re-rodados
  //     contra a árvore (Eixo A é alvo de outro agente agora, ver aviso no
  //     topo do arquivo — os demais eixos não foram re-executados por
  //     disciplina de escopo desta catalogação, não por impedimento técnico).
  //   - LOOP-0c-falha-silenciosa.md — 37 ocorrências de falha silenciosa
  //     (E→VAZIO/E→SUCESSO/E→ENGOLIDO/E→PARCIAL/E→NEGA), zero cobertas.
  //
  // PLACAR HOJE (herdado de LOOP-2, não re-medido nesta catalogação):
  //   PEGA hoje  → SILENCIO esperado é o BOM sinal (mutante já morto/coberto)
  //   NÃO PEGA   → SILENCIO esperado é o achado (o motivo de existir aqui)
  // Ver tabela completa em LOOP-0d-catalogo-mutantes.md.
  // =========================================================================

  // --- Eixo A — isolamento por tenant/aluno (7, LOOP-2 §Eixo A) -------------
  // PLACAR MEDIDO EM 2026-08-29 (clone isolado, HEAD d2b8083): as 7 ACUSAM.
  //   A1→3 vermelhos · A2→2 · A3→2 · A4→3 · A5→3 · A6→2 · A7→3
  //
  // Isto REVOGA o placar anterior herdado do LOOP-2 ("as 7 NÃO PEGAM; A5-A7
  // são cobertura ZERO"). Aquele número era verdadeiro quando foi tirado e
  // deixou de ser: as guardas de isolamento foram escritas depois
  // (`autogestao/__tests__/isolamento-de-tenant-e-aluno.test.ts` e
  // `aprendizagem-time/__tests__/isolamento-de-tenant.test.ts`), e apagar
  // qualquer um dos 7 filtros agora reprova de 2 a 3 testes nomeados.
  //
  // POR QUE ISTO IMPORTA MAIS QUE OS OUTROS EIXOS: neste caminho o cliente é
  // service role e a RLS é contornada de propósito — o `.eq()` da aplicação é
  // a ÚNICA fronteira entre dois clientes pagantes, e o que vaza é nome de
  // pessoa. Um placar desatualizado dizendo "não pega" aqui convidaria alguém
  // a reescrever a consulta sem rede.
  //
  // Um catálogo cujo placar envelhece em silêncio é o mesmo defeito que este
  // script persegue, uma camada acima: re-meça antes de citar.
  [
    "A1:sessions-tenant",
    AUTOGESTAO_FONTE,
    '        "id, chapter_id, status, created_at, completed_at, turn_number, interactions_remaining",\n      )\n      .eq("tenant_id", tenantId)\n      .eq("student_id", studentId)',
    '        "id, chapter_id, status, created_at, completed_at, turn_number, interactions_remaining",\n      )\n      .eq("student_id", studentId)',
  ],
  [
    "A2:sessions-student",
    AUTOGESTAO_FONTE,
    '        "id, chapter_id, status, created_at, completed_at, turn_number, interactions_remaining",\n      )\n      .eq("tenant_id", tenantId)\n      .eq("student_id", studentId)',
    '        "id, chapter_id, status, created_at, completed_at, turn_number, interactions_remaining",\n      )\n      .eq("tenant_id", tenantId)',
  ],
  [
    "A3:slide_reflections-tenant",
    AUTOGESTAO_FONTE,
    '.select("created_at")\n      .eq("tenant_id", tenantId)\n      .eq("student_id", studentId)',
    '.select("created_at")\n      .eq("student_id", studentId)',
  ],
  [
    "A4:chapters-tenant",
    AUTOGESTAO_FONTE,
    '.select(\'id, "order", title\')\n      .eq("tenant_id", tenantId)\n      .eq("course_id", courseId)',
    '.select(\'id, "order", title\')\n      .eq("course_id", courseId)',
  ],
  [
    "A5:capabilities-tenant",
    APRENDIZAGEM_FONTE,
    '.select("id, course_id, title, slug")\n      .eq("tenant_id", p.tenantId)\n      .eq("is_active", true)',
    '.select("id, course_id, title, slug")\n      .eq("is_active", true)',
  ],
  [
    "A6:capability_assessments-tenant",
    APRENDIZAGEM_FONTE,
    '.select("student_id, capability_id, new_state, is_current, created_at")\n      .eq("tenant_id", p.tenantId)\n      .in("capability_id", capacidadeIds)',
    '.select("student_id, capability_id, new_state, is_current, created_at")\n      .in("capability_id", capacidadeIds)',
  ],
  [
    "A7:users-tenant",
    APRENDIZAGEM_FONTE,
    '.select("id, full_name, report_name")\n      .eq("tenant_id", p.tenantId)\n      .is("deleted_at", null)',
    '.select("id, full_name, report_name")\n      .is("deleted_at", null)',
  ],

  // --- Eixo B — gate de acesso da rota (4, LOOP-2 §Eixo B) ------------------
  // Placar hoje: B1/B2 PEGAM (o gate de papel do gestor está pinado — 6
  // vermelhos cada). B3/B4 NÃO PEGAM (ramo "sem sessão" nunca exercido em
  // teste; `/jornada` sem cobertura de gate alguma).
  [
    "B1:hasAnyRole-gate",
    TRINCA_RECORTE,
    'if (!hasAnyRole({ roles: roleUnion }, ACESSO)) return redirect("/dashboard")',
    'if (false) return redirect("/dashboard")',
  ],
  [
    "B2:gate-na-porta-da-rota",
    ANALYTICS_PAGE,
    "  await garantirAcessoAnalytics()",
    "  // await garantirAcessoAnalytics()",
  ],
  [
    "B3:sem-sessao-vai-para-login",
    TRINCA_RECORTE,
    'if (!user || !profile) return redirect("/login")',
    'if (false) return redirect("/login")',
  ],
  [
    "B4:jornada-exige-login",
    JORNADA_RECORTE,
    'if (!user || !profile) return redirect("/login")',
    'if (false) return redirect("/login")',
  ],

  // --- Eixo C — limiares e classificador (10, LOOP-2 §Eixo C) ---------------
  // Placar hoje: C5-C11 PEGAM. C12-C17 NÃO PEGAM e são NÃO COBERTOS.
  //
  // ═══ C1, C2, C3 e C4 FORAM REMOVIDOS EM 2026-08-29 — NÃO OS RECRIE ═══════
  // Eles miravam `AMOSTRA_MIN_APRENDIZES`, `AMOSTRA_MIN_EVIDENCIAS`,
  // `TENDENCIA_MIN_PERIODOS` e `MIN_EVIDENCIAS_EMERGENTE` em `limiares.ts`.
  // A rodada anterior os classificou como NÃO PEGAM / MORTOS: zero consumidor
  // real, cópias literais das constantes vivas de `aprendizagem-time/base.ts`.
  //
  // O FIX-A apagou as quatro constantes do código (docs/auditoria/
  // consolidacao-2026-08-28/FIX-A-pipeline.md, item 6). **O mutante morreu
  // junto com o alvo**: não há mais o que perturbar, e mantê-los aqui faria o
  // motor reportar 4 × `INVALIDO` — quatro linhas de ruído que parecem defeito
  // do harness e não são.
  //
  // A cobertura NÃO diminuiu: C5, C6 e C7 mutam as MESMAS constantes na casa
  // viva (`base.ts`), e essas PEGAM. O que sumiu foi a sombra, não a régua.
  // Recriar C1-C4 apontando para `limiares.ts` só produz `INVALIDO` de novo.
  // ═══════════════════════════════════════════════════════════════════════
  [
    "C5:base-viva-aprendizes",
    APRENDIZAGEM_BASE,
    "export const AMOSTRA_MIN_APRENDIZES = 3",
    "export const AMOSTRA_MIN_APRENDIZES = 1",
  ],
  [
    "C6:base-viva-evidencias",
    APRENDIZAGEM_BASE,
    "export const AMOSTRA_MIN_EVIDENCIAS = 5",
    "export const AMOSTRA_MIN_EVIDENCIAS = 1",
  ],
  [
    "C7:base-viva-periodos",
    APRENDIZAGEM_BASE,
    "export const TENDENCIA_MIN_PERIODOS = 2",
    "export const TENDENCIA_MIN_PERIODOS = 1",
  ],
  [
    "C8:amostraSuficiente-sempre-true",
    APRENDIZAGEM_BASE,
    "  return alunosElegiveis >= AMOSTRA_MIN_APRENDIZES && evidenciasAvaliaveis >= AMOSTRA_MIN_EVIDENCIAS",
    "  return alunosElegiveis >= 0 && evidenciasAvaliaveis >= 0",
  ],
  [
    "C9:tendenciaDisponivel-sempre-true",
    APRENDIZAGEM_BASE,
    "  return periodosComparaveis >= TENDENCIA_MIN_PERIODOS",
    "  return true",
  ],
  [
    "C10:triangulacao-piso-demonstrada",
    LIMIARES,
    "export const MIN_EVIDENCIAS_POR_CATEGORIA_DEMONSTRADA = 2",
    "export const MIN_EVIDENCIAS_POR_CATEGORIA_DEMONSTRADA = 1",
  ],
  [
    "C11:piso-cognitivo-existe",
    AGREGADOR,
    '    (porCategoria.get("cognitive")?.length ?? 0) >= MIN_EVIDENCIAS_DESENVOLVIMENTO_COGNITIVA',
    '    (porCategoria.get("cognitive")?.length ?? 0) >= 0',
  ],
  [
    "C12:piso-cognitivo-vale-2",
    LIMIARES,
    "export const MIN_EVIDENCIAS_DESENVOLVIMENTO_COGNITIVA = 2",
    "export const MIN_EVIDENCIAS_DESENVOLVIMENTO_COGNITIVA = 1",
  ],
  [
    "C13:emerging-piso-de-volume",
    AGREGADOR,
    "  } else if (avaliaveis.length >= MIN_EVIDENCIAS_DESENVOLVIMENTO_COGNITIVA && algumaAplicacao) {",
    "  } else if (avaliaveis.length >= 0 && algumaAplicacao) {",
  ],
  [
    "C14:quiz-alto-eleva-profundidade",
    HEURISTICA,
    "    if (e.sinais.quizScorePct >= 0.8) depthLevel = Math.max(depthLevel, 2)",
    "    if (e.sinais.quizScorePct >= 0.8) depthLevel = Math.min(depthLevel, 2)",
  ],
  [
    "C15:quiz-baixo-rebaixa-a-partir-de-50pct",
    HEURISTICA,
    "    else if (e.sinais.quizScorePct < 0.5) depthLevel = Math.min(depthLevel, 1)",
    "    else if (e.sinais.quizScorePct < 0.05) depthLevel = Math.min(depthLevel, 1)",
  ],
  [
    "C16:min-alunos-por-capacidade",
    CAPACIDADES_EVOLUCAO,
    "const MIN_ALUNOS_POR_CAPACIDADE = 3",
    "const MIN_ALUNOS_POR_CAPACIDADE = 1",
  ],
  [
    "C17:max-linhas-evolucao",
    CAPACIDADES_EVOLUCAO,
    "const MAX_LINHAS = 4",
    "const MAX_LINHAS = 99",
  ],

  // --- Eixo D — séries temporais (4, LOOP-2 §Eixo D) ------------------------
  // Placar hoje: D1, D2, D4 NÃO PEGAM (NÃO COBERTOS — os módulos executam,
  // nenhuma asserção varia estes pontos). D3 PEGA.
  [
    "D1:janela-10-semanas",
    SEMANAS,
    "export const NUM_SEMANAS_SERIE = 10",
    "export const NUM_SEMANAS_SERIE = 4",
  ],
  [
    "D2:semana-comeca-na-segunda",
    SEMANAS,
    "  const deltaParaSegunda = diaSemana === 0 ? 6 : diaSemana - 1",
    "  const deltaParaSegunda = diaSemana",
  ],
  [
    "D3:janela-fechada-a-direita",
    SEMANAS,
    "    const fimMs = inicioMs + SEMANA_MS",
    "    const fimMs = inicioMs + SEMANA_MS * 2",
  ],
  [
    "D4:estado-coletivo-developing-ou-demonstrated",
    CAPACIDADES_EVOLUCAO,
    '  const ok = estadosPorAluno.filter((e) => e === "developing" || e === "demonstrated").length',
    '  const ok = estadosPorAluno.filter((e) => e === "demonstrated").length',
  ],

  // --- Eixo E — o vazio como caminho principal (7, LOOP-2 §Eixo E) ---------
  // Placar medido em 2026-08-29: os 7 ACUSAM.
  //   E1→7 · E2→1 · E3→1 · E4→1 · E5→1 · E6→7 · E7→1
  //
  // E4 ("erro ≠ vazio") era o furo estrutural do LOOP-2 — `blocoErro` não
  // executava em teste algum. Agora morre, e morre por UM único teste:
  //   `a-tela-diz-que-falhou.test.ts > [blocoErro] bloco em erro não carrega
  //    texto de amostra insuficiente nem motivoVazio`
  //
  // ⚠ RESSALVA DE PROCEDÊNCIA: esse teste foi escrito pela mesma mão que fez o
  // FIX-A, e quem registrou este placar é a mesma mão. Maker não é checker: um
  // mutante que só morre pelo teste do próprio autor mede a expectativa dele,
  // não a régua da casa. E4 vale como sinal, NÃO como prova independente —
  // fica devendo confirmação de outra mão (ou um segundo teste de outra
  // origem que também o mate).
  [
    "E1:blocoVazio-nao-pode-virar-ok",
    ESTADO_BLOCO,
    "  return { ...dados, estado: \"vazio\", erro: null, textoVazio: texto, motivoVazio: motivo }",
    "  return { ...dados, estado: \"ok\", erro: null, textoVazio: texto, motivoVazio: motivo }",
  ],
  [
    "E2:texto-do-vazio-e-literal",
    ESTADO_BLOCO,
    'export const TEXTO_AMOSTRA_INSUFICIENTE = "Amostra ainda insuficiente"',
    'export const TEXTO_AMOSTRA_INSUFICIENTE = ""',
  ],
  [
    "E3:sem-historico-vira-sem-tendencia",
    SERIE_PROFUNDIDADE,
    "  if (semanasComDado < 2) {",
    "  if (false) {",
  ],
  [
    "E4:erro-nao-pode-virar-vazio",
    ESTADO_BLOCO,
    "  return { ...dados, estado: \"erro\", erro, textoVazio: null, motivoVazio: null }",
    "  return { ...dados, estado: \"vazio\", erro, textoVazio: null, motivoVazio: null }",
  ],
  [
    "E5:mapa-de-calor-tem-piso-de-amostra",
    MAPA_DE_CALOR,
    "  if (carimbos.length < MAPA_DE_CALOR_MIN_ATIVIDADES) {",
    "  if (false) {",
  ],
  [
    "E6:piso-do-mapa-e-o-numero-declarado",
    PARAMETROS_AUTOGESTAO,
    "export const MAPA_DE_CALOR_MIN_ATIVIDADES = 20",
    "export const MAPA_DE_CALOR_MIN_ATIVIDADES = 9999",
  ],
  [
    "E7:semLastro-traz-motivo",
    MAPA_DE_CALOR,
    "    return semLastro(MOTIVO_MAPA_DE_CALOR_POUCA_ATIVIDADE)",
    '    return semLastro("")',
  ],

  // --- Amostra do LOOP-0c, 1 por forma (E→SUCESSO/ENGOLIDO/PARCIAL/NEGA) ----
  // PLACAR MEDIDO EM 2026-08-29: os 4 restantes dão **INVÁLIDO**, não SILÊNCIO.
  //
  // Foram catalogados como canários de defeitos NÃO corrigidos, e o resultado
  // esperado era silenciar. Entre a catalogação e esta medição, o FIX-B
  // corrigiu os quatro (ver FIX-B-rotas.md) — os trechos originais deixaram de
  // existir, e o canário perdeu o alvo. INVÁLIDO aqui é notícia BOA sobre o
  // código e notícia RUIM sobre o catálogo.
  //
  // DÍVIDA (para quem NÃO escreveu as correções): re-mirar os quatro contra a
  // forma corrigida — o mutante certo agora é o que REINTRODUZ o defeito no
  // código novo, e ele deve morrer nos testes que o FIX-B escreveu. Enquanto
  // não forem re-mirados, o eixo F não mede nada.
  //
  // (F2 saiu por motivo diferente, ver a nota logo abaixo.)
  [
    "F1:e-sucesso:apply-step4-sem-check",
    APPLY_ROUTE,
    '    await supabase\n      .from("course_blueprints")\n      .update({\n        status: "applied",',
    '    await supabase\n      .from("course_blueprints")\n      .update({\n        status: "nao-aplicado-mutante",',
  ],
  // ═══ F2 FOI REMOVIDO EM 2026-08-29, E DEIXA UMA DÍVIDA NOMEADA ═══════════
  // F2 mirava, em `montagem.ts`, o julgamento
  //     const estado: "ok" | "vazio" | "erro" = falhas.capacidades ? "erro" : ...
  // que só olhava UMA das 3-4 fontes. O FIX-A corrigiu o defeito e o trecho
  // deixou de existir: a decisão migrou para `decidirEstadoDaTela()` em
  // `aprendizagem-time/estado-tela.ts`, agora consultada pelas TRÊS montagens.
  // Mantê-lo aqui produziria `INVALIDO`, não um achado.
  //
  // DÍVIDA (para OUTRA mão, não a de quem escreveu o `estado-tela.ts`): falta o
  // mutante substituto contra a nova casa. O trecho a perturbar é
  //     const erro = primeiraFalha(falhas, fontes)
  // trocando por `const erro = falhas.capacidades ?? null`, que restaura
  // exatamente o defeito antigo. Ele DEVE ser morto por
  // `__tests__/a-tela-diz-que-falhou.test.ts`. Não o catalogo eu mesmo porque
  // escrevi tanto o arquivo quanto o teste — maker não é checker, e um mutante
  // calibrado por quem fez o conserto mede a própria expectativa.
  // ═══════════════════════════════════════════════════════════════════════
  [
    "F3:e-engolido:dispatchEvent-webhook-catch-vazio",
    GENERATE_ROUTE,
    "        }).catch(() => {})",
    "        }).catch((e) => { throw e })",
  ],
  [
    "F4:e-parcial:fetchAllRows-sem-sinal-de-truncamento",
    AGGREGATE_ROUTE,
    "    if (error || !data || data.length === 0) break",
    "    if (!data || data.length === 0) break",
  ],
  [
    "F5:e-nega:profile-sem-checar-erro-vira-403",
    COURSES_ROUTE,
    'return NextResponse.json({ error: "Permissão negada" }, { status: 403 })',
    'return NextResponse.json({ error: "Permissão negada" }, { status: 599 })',
  ],
]

/**
 * O conjunto que roda SEM argumento: os mutantes da rodada de origem (Padrões e
 * tendências). Preserva o comportamento documentado no topo do arquivo agora que
 * a lista cresceu com as frentes novas.
 *
 * Antes isto era `MUTANTES.slice(0, 31)` — um índice posicional, que silencia ao
 * quebrar: inserir um mutante no meio da lista empurra o corte e muda o conjunto
 * padrão sem que ninguém perceba. Agora o critério é a FORMA do rótulo: os das
 * frentes novas são todos `Letra+dígitos:` (`A1:`, `C5:`, `F3:`), os da rodada de
 * origem não são (`LARGURA`, `base:so-created_at`, `serie:eixo-no-pico`).
 * Acrescentar mutante em qualquer posição passa a ser inócuo.
 */
const ROTULO_DE_FRENTE_NOVA = /^[A-F]\d+:/
const ROTULOS_PADRAO = MUTANTES.filter(([r]) => !ROTULO_DE_FRENTE_NOVA.test(r)).map(([r]) => r)

const argv = process.argv.slice(2)
const arg = (nome) => argv.find((a) => a.startsWith(`--${nome}=`))?.split("=")[1]
const somente = arg("somente")
  ?.split(",")
  .map((s) => s.trim())
/** Escape explícito do operador. Sem ele, a suíte vem de `SUITE_DO_ARQUIVO`. */
const suiteForcada = arg("suite")
  ?.split(",")
  .map((s) => s.trim())
/** `--tudo` roda TODOS os mutantes, cada grupo contra a própria suíte (~8 min). */
const tudo = argv.includes("--tudo")

function suiteDoArquivo(arquivo) {
  if (suiteForcada) return suiteForcada
  const s = SUITE_DO_ARQUIVO.get(arquivo)
  if (!s) {
    // Erro duro de propósito: sem pareamento, o mutante rodaria contra a suíte
    // errada e sairia SILENCIO por não-execução — um achado falso, pior que
    // parar. Alvo novo entra em `SUITE_DO_ARQUIVO` junto com o mutante.
    console.error(`SEM SUITE PAREADA para ${arquivo.replace(`${RAIZ_REPO}/`, "")}`)
    console.error("acrescente o alvo em SUITE_DO_ARQUIVO antes de rodar.")
    process.exit(5)
  }
  return s
}

const sha = (arquivo) => createHash("sha256").update(readFileSync(arquivo)).digest("hex")

function rodar(suite) {
  try {
    return execFileSync("pnpm", ["exec", "vitest", "run", ...suite, "--reporter=basic"], {
      cwd: APP,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 600_000,
    })
  } catch (e) {
    return `${e.stdout ?? ""}${e.stderr ?? ""}`
  }
}

/** Nomes dos testes vermelhos. O CONJUNTO, não a contagem: o que importa é quais. */
function vermelhos(saida) {
  const nomes = new Set()
  for (const m of saida.matchAll(/^ FAIL {2}(.+?) > (.+)$/gm)) nomes.add(m[2].trim())
  return [...nomes]
}

const escolhidos = MUTANTES.filter(([r]) =>
  tudo ? true : somente ? somente.includes(r) : ROTULOS_PADRAO.includes(r),
)
if (escolhidos.length === 0) {
  console.error(`nenhum mutante casa com --somente=${somente?.join(",")}`)
  process.exit(2)
}

// --- backup e conferência de integridade -----------------------------------
const arquivos = [...new Set(escolhidos.map(([, f]) => f))]
const shaAntes = new Map(arquivos.map((f) => [f, sha(f)]))
for (const f of arquivos) copyFileSync(f, `${f}.mutacao-backup`)
console.log(`backup de ${arquivos.length} arquivo(s) em *.mutacao-backup`)
for (const [f, h] of shaAntes) console.log(`  ${h}  ${f.replace(`${RAIZ_REPO}/`, "")}`)

/**
 * Agrupa os escolhidos por suíte derivada do alvo. Um baseline POR GRUPO: o
 * conjunto de vermelhos de referência só faz sentido contra a mesma suíte que
 * roda o mutante, e é essa correspondência que o `--suite=` global de antes não
 * conseguia garantir.
 */
const grupos = new Map()
for (const m of escolhidos) {
  const suite = suiteDoArquivo(m[1])
  const chave = suite.join(" ")
  if (!grupos.has(chave)) grupos.set(chave, { suite, mutantes: [] })
  grupos.get(chave).mutantes.push(m)
}
console.log(`\n${escolhidos.length} mutante(s) em ${grupos.size} grupo(s) de suíte`)

const silenciosos = []
const naoMedidos = []
const invalidos = []
for (const { suite, mutantes } of grupos.values()) {
  console.log(`\n───── suíte: ${suite.join(" ")}  (${mutantes.length} mutante(s))`)
  const saidaBase = rodar(suite)
  console.log(`BASELINE  ${(saidaBase.match(/Tests {2}.*/)?.[0] ?? "?").trim()}`)
  const base = vermelhos(saidaBase)
  if (base.length > 0) {
    // Baseline sujo invalida ESTE grupo, não a rodada inteira: com vários
    // grupos, abortar tudo por causa de um faria uma suíte quebrada (ou um
    // colega editando aquela área agora) apagar a medição de todas as outras —
    // e o operador tenderia a deixar de rodar. Pula alto e segue.
    console.error(`BASELINE SUJO (${base.length} vermelho) — grupo NÃO MEDIDO, seguindo adiante.`)
    for (const n of base) console.error(`  · ${n}`)
    for (const [rotulo] of mutantes) naoMedidos.push([rotulo, "baseline sujo nesta suíte"])
    continue
  }

  for (const [rotulo, arquivo, de, para] of mutantes) {
    const original = readFileSync(arquivo, "utf8")
    if (!original.includes(de)) {
      // INVÁLIDO NÃO É SILÊNCIO. Silêncio diz algo sobre o CÓDIGO (o teste não
      // olha aquele ponto); inválido diz algo sobre o CATÁLOGO (o trecho mudou
      // de forma, ou o defeito foi corrigido e o canário perdeu o alvo). Somar
      // os dois é a mesma confusão morto × não-coberto que este script existe
      // para não cometer — e ela estava acontecendo AQUI DENTRO.
      console.log(`INVALIDO  ${rotulo}  —  trecho não encontrado (o código mudou de forma)`)
      invalidos.push([rotulo, "o trecho não existe mais — re-mire ou aposente o mutante"])
      continue
    }
    writeFileSync(arquivo, original.replace(de, para))
    const saida = rodar(suite)
    writeFileSync(arquivo, original)
    const novas = vermelhos(saida).filter((n) => !base.includes(n))
    console.log(
      `${(novas.length > 0 ? "ACUSA" : "SILENCIO").padEnd(9)} ${rotulo}  →  ${novas.length}`,
    )
    for (const n of novas.slice(0, 3)) console.log(`            · ${n}`)
    if (novas.length === 0) silenciosos.push([rotulo, "nenhum teste virou"])
  }
}

// --- restauração conferida --------------------------------------------------
let sujo = false
for (const f of arquivos) {
  if (sha(f) !== shaAntes.get(f)) {
    copyFileSync(`${f}.mutacao-backup`, f)
    if (sha(f) !== shaAntes.get(f)) {
      console.error(`ARQUIVO NÃO RESTAURADO: ${f}`)
      sujo = true
    }
  }
}
console.log(
  `\nrestauração conferida por sha256: ${sujo ? "FALHOU" : "ok, todos idênticos ao início"}`,
)

// Três listas, três significados diferentes, e nenhuma soma com a outra:
//   SILENCIOSO → achado sobre o CÓDIGO (morto, ou vivo e não coberto)
//   INVÁLIDO   → achado sobre o CATÁLOGO (o mutante perdeu o alvo)
//   NÃO MEDIDO → lacuna da RODADA (nem chegou a rodar)
console.log("\n===== SILENCIOSOS (achado: morto ou não coberto — diga qual) =====")
if (silenciosos.length === 0) console.log("nenhum")
for (const [r, m] of silenciosos) console.log(`- ${r}: ${m}`)

if (invalidos.length > 0) {
  console.log("\n===== INVÁLIDOS (achado sobre o CATÁLOGO, não sobre a cobertura) =====")
  for (const [r, m] of invalidos) console.log(`- ${r}: ${m}`)
}

if (naoMedidos.length > 0) {
  console.log("\n===== NÃO MEDIDOS (lacuna da rodada, NÃO é achado) =====")
  for (const [r, m] of naoMedidos) console.log(`- ${r}: ${m}`)
}

process.exit(sujo ? 4 : naoMedidos.length > 0 || invalidos.length > 0 ? 3 : 0)
