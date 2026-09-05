#!/usr/bin/env node
/**
 * tema-jovial.mjs — reaplica a identidade visual "jovial" do mastermind
 * sobre o HTML entregue pelo Archify.
 *
 * POR QUE ESTE SCRIPT EXISTE:
 * o `archify deliver` SOBRESCREVE o HTML inteiro a cada execução. Qualquer
 * CSS editado à mão no artefato é perdido na próxima regeneração. Este script
 * torna o tema reaplicável em um comando, então o tema deixa de ser um hack
 * frágil e vira uma etapa de build.
 *
 * USO:
 *   node docs/architecture/tema-jovial.mjs            # gera o -jovial.html
 *   node docs/architecture/tema-jovial.mjs --inplace  # sobrescreve o próprio artefato
 *
 * ORDEM CORRETA: archify deliver  ->  este script.  Nunca o contrário.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
/**
 * Alvo do tema. Sem argumento, continua sendo o mapa de runtime, exatamente
 * como antes (nenhum comando existente muda de comportamento).
 *
 *   node tema-jovial.mjs                                   -> mapa de runtime
 *   node tema-jovial.mjs --src eximia-academy-conceitos.html -> mapa de conceitos
 *   node tema-jovial.mjs --inplace                         -> sobrescreve o proprio alvo
 *
 * O painel "Na vida real" casa por id de componente. O mapa de conceitos tem
 * outros ids, entao o painel simplesmente NAO abre lá (o lookup falha e o
 * elemento fica hidden). Degradacao graciosa de proposito, nao esquecimento.
 */
const iSrc = process.argv.indexOf("--src");
const ARQUIVO = iSrc > -1 && process.argv[iSrc + 1] ? process.argv[iSrc + 1] : "eximia-academy-archify.html";
const SRC = join(HERE, ARQUIVO);
const INPLACE = process.argv.includes("--inplace");
const OUT = INPLACE ? SRC : join(HERE, ARQUIVO.replace(/\.html$/, "-jovial.html"));

/* ══════════════════════════════════════════════════════════════════════════
   CAMADA 0 — CORTE DO CORDÃO COM A REDE
   ──────────────────────────────────────────────────────────────────────────
   Não é movimento, é a pré-condição de tudo que vem depois: a peça precisa
   funcionar com o Wi-Fi do evento no chão.

   O ACHADO: o próprio template JÁ carrega a fonte dele de forma NÃO-bloqueante
   (`media="print" onload="this.media='all'"`, e documenta o porquê em
   comentário: "a blackholed network must not block first paint").
   Quem introduziu a regressão foi ESTE arquivo: a versão anterior injetava um
   <link rel="stylesheet"> cru, bloqueante, para o Google Fonts. A restrição de
   "zero dependência externa em runtime" estava violada por código NOSSO.

   A correção assíncrona (copiar o media=print do template) faria a peça
   FUNCIONAR sem rede, mas PERDER a tipografia — e a tipografia é metade da
   tese visual. Por isso a escolha é embutir: os woff2 viram base64 dentro do
   próprio <style>, e TODOS os <link> de fonte (os do template e os nossos)
   saem do HTML. Zero fetch, zero rede, tipografia intacta.

   Os dois arquivos são VARIÁVEIS (um woff2 por família cobre todos os pesos),
   subset latin — que já contém ã, ç, õ, · e › usados na peça. ~50 KB no total.
   ══════════════════════════════════════════════════════════════════════════ */
const FONTES_DIR = join(HERE, "fontes");
const FONTES_ARQUIVOS = {
  jakarta: "plus-jakarta-sans-latin-var.woff2",
  grotesk: "space-grotesk-latin-var.woff2",
};

function lerFonteBase64(nome) {
  try {
    return readFileSync(join(FONTES_DIR, nome)).toString("base64");
  } catch (_) {
    console.error(`[tema-jovial] ERRO: nao achei a fonte ${nome} em docs/architecture/fontes/.`);
    console.error("[tema-jovial] A peca precisa das fontes EM DISCO para ser autocontida.");
    console.error("[tema-jovial] Baixe os woff2 (subset latin) do Google Fonts para essa pasta e rode de novo.");
    process.exit(1);
  }
}

const B64_JAKARTA = lerFonteBase64(FONTES_ARQUIVOS.jakarta);
const B64_GROTESK = lerFonteBase64(FONTES_ARQUIVOS.grotesk);

// Faixa latin do Google Fonts. Fora dela, o navegador cai para o próximo item
// da pilha em vez de desenhar tofu — o que é o comportamento correto.
const UR_LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329," +
  "U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";

// Tokens extraídos do CSS real de apps/hub-discovery/mastermind-otto-ROTEIRO.html
// e da landing jovial do mastermind. Não invente cor aqui: se mudar lá, mude aqui.
/**
 * NOTA DE ESPECIFICIDADE — a razão de este arquivo ser assim.
 *
 * A primeira versão deste tema NÃO funcionou, e falhou em silêncio.
 * O preset do Archify declara as variáveis em `[data-preset="blueprint"][data-theme="light"]`,
 * que é especificidade (0,2,0). O override usava `html[data-theme="light"]`, que é (0,1,1).
 * (0,2,0) vence (0,1,1), então o tema perdia a cascata sem emitir erro nenhum.
 *
 * Correção, em duas camadas de cinto e suspensório:
 *   1. seletor `html[data-preset][data-preset][data-theme="X"]` = (0,3,1), acima de qualquer
 *      combinação que o template use hoje. Repetir o atributo é CSS válido e soma especificidade.
 *   2. `!important` em toda declaração, que vence especificidade independentemente.
 * Usar `[data-preset]` por PRESENÇA (não por valor) faz o tema sobreviver se o Senhor
 * trocar o preset pelo seletor da barra de ferramentas durante a apresentação.
 */
const S_LIGHT = 'html[data-preset][data-preset][data-theme="light"]';
const S_DARK = 'html[data-preset][data-preset][data-theme="dark"]';
const S_ANY = "html[data-preset][data-preset]";
// Botão "Live/Still" da barra e suspensões do motionGovernor escrevem isto no <html>.
// Toda regra de movimento daqui precisa de uma guarda com este seletor, senão o
// botão de pausa da barra fica quebrado EM SILÊNCIO (o tema injeta depois do
// </style> do template, então entre dois !important comparáveis o nosso vence).
const S_STILL = 'html[data-preset][data-preset][data-motion="still"]';

const JOVIAL = `
<!-- ARCHIFY:TEMA-JOVIAL:START (injetado por tema-jovial.mjs) -->
<style id="tema-jovial">
/* ══ CAMADA 0 · tipografia embutida, zero rede ═══════════════════════════
   font-display:block é seguro AQUI porque não há fetch: a fonte já está no
   documento, então o "bloco" dura um frame e nunca vira texto invisível. */
@font-face{
  font-family:'Plus Jakarta Sans';
  font-style:normal;
  font-weight:400 800;
  font-display:block;
  src:url(data:font/woff2;base64,${B64_JAKARTA}) format('woff2');
  unicode-range:${UR_LATIN};
}
@font-face{
  font-family:'Space Grotesk';
  font-style:normal;
  font-weight:500 700;
  font-display:block;
  src:url(data:font/woff2;base64,${B64_GROTESK}) format('woff2');
  unicode-range:${UR_LATIN};
}

/* ══ PRINCÍPIO DA PALETA, aprendido errando ══════════════════════════════
   A primeira tentativa pintou os 5 nós "backend" de rosa e a região de creme.
   O resultado foi uma tela inundada de cor: o oposto do jovial.
   O DNA do roteiro é claro: cor forte só entra como INFORMAÇÃO (a tarja que
   anuncia, o grifo que marca), e todo o resto é branco arroxeado com ar.
   Logo, aqui: a MAIORIA dos nós fica quieta em lavanda lavada, e a cor é
   gasta em três lugares só, cada um com uma razão narrativa:
     · tinta cheia   -> Next Middleware (security). É o porteiro, o mais forte da tela.
     · indigo        -> apps/web (frontend). É o que a pessoa toca.
     · rosa          -> o caminho em ênfase. É por onde a decisão corre.
   Nada de amarelo: no roteiro o sol é grifo de lacuna, não cor de caixa.  */

/* ── Paleta clara: o modo que vai ao palco ── */
${S_LIGHT}{
  --bg:#FBFAFF !important;
  --grid:rgba(18,16,43,.04) !important;
  --text:#12102B !important;
  --text-muted:#56527A !important;
  --text-dim:#7B76A0 !important;
  --text-faint:#7B76A0 !important;
  --panel:#FFFFFF !important;
  --panel-border:rgba(18,16,43,.08) !important;
  --lane-fill:rgba(105,102,237,.04) !important;
  --lane-stroke:rgba(105,102,237,.26) !important;
  --arrow:rgba(86,82,122,.55) !important;
  --arrow-emphasis:#F953B2 !important;
  --mask:#FBFAFF !important;

  /* quietos, a maioria */
  --backend-fill:rgba(105,102,237,.05) !important;   --backend-stroke:#9793C4 !important;
  --database-fill:rgba(192,122,78,.06) !important;   --database-stroke:#C07A4E !important;
  --cloud-fill:rgba(191,160,42,.07) !important;      --cloud-stroke:#BFA02A !important;
  --messagebus-fill:rgba(86,82,122,.06) !important;  --messagebus-stroke:rgba(86,82,122,.42) !important;
  --external-fill:#FFFFFF !important;                --external-stroke:#56527A !important;
  /* os dois que ganham voz */
  --frontend-fill:rgba(105,102,237,.12) !important;  --frontend-stroke:#6966ED !important;
  --security-fill:rgba(18,16,43,.06) !important;     --security-stroke:#12102B !important;

  --toolbar-bg:rgba(255,255,255,.94) !important;
  --toolbar-border:rgba(18,16,43,.08) !important;
  --toolbar-text:#12102B !important;
  --toolbar-hover:#FFFFFF !important;
  --toolbar-menu-bg:#FFFFFF !important;
}

/* ── Paleta escura: tinta roxa, nunca preto puro nem slate ── */
${S_DARK}{
  --bg:#12102B !important;
  --grid:rgba(255,255,255,.04) !important;
  --text:#FCFCFE !important;
  --text-muted:#B9B4D8 !important;
  --text-dim:#8781A8 !important;
  --text-faint:#8781A8 !important;
  --panel:rgba(255,255,255,.05) !important;
  --panel-border:rgba(255,255,255,.12) !important;
  --lane-fill:rgba(105,102,237,.08) !important;
  --lane-stroke:rgba(155,153,245,.30) !important;
  --arrow:rgba(185,180,216,.55) !important;
  --arrow-emphasis:#FF8ACB !important;
  --mask:#12102B !important;

  --backend-fill:rgba(155,153,245,.10) !important;   --backend-stroke:#B0ACD8 !important;
  --database-fill:rgba(224,164,106,.10) !important;  --database-stroke:#E0A46A !important;
  --cloud-fill:rgba(244,209,59,.10) !important;      --cloud-stroke:#F4D13B !important;
  --messagebus-fill:rgba(255,255,255,.06) !important;--messagebus-stroke:rgba(185,180,216,.50) !important;
  --external-fill:rgba(255,255,255,.04) !important;  --external-stroke:#8781A8 !important;
  --frontend-fill:rgba(105,102,237,.28) !important;  --frontend-stroke:#9B99F5 !important;
  --security-fill:rgba(252,252,254,.10) !important;  --security-stroke:#FCFCFE !important;

  --toolbar-bg:rgba(18,16,43,.90) !important;
  --toolbar-border:rgba(255,255,255,.12) !important;
  --toolbar-text:#FCFCFE !important;
  --toolbar-hover:rgba(18,16,43,.98) !important;
  --toolbar-menu-bg:#1B1840 !important;
}

/* ── A região tinha fill âmbar CHUMBADO no template (rgba(251,191,36,.05)),
   que sobre canvas claro vira creme e inunda o diagrama inteiro.
   Variável nenhuma resolve isso, tem que sobrescrever a regra. ── */
${S_ANY} svg .c-region{
  fill:rgba(105,102,237,.035) !important;
  stroke:rgba(105,102,237,.30) !important;
}
${S_ANY} svg .c-security-group{
  fill:rgba(18,16,43,.025) !important;
  stroke:rgba(18,16,43,.22) !important;
}
/* O rótulo da região herda a cor do traço da região, que é fraca de propósito.
   O traço pode ser sutil; o texto tem que ser lido do fundo da sala.
   Precisa ser por tema: uma cor só serve a um fundo só. */
${S_LIGHT} svg .t-cloud{ fill:rgba(86,82,122,.92) !important; }
${S_DARK} svg .t-cloud{ fill:rgba(198,193,228,.88) !important; }

/* ── Tipografia: sai a monoespaçada de terminal, entra a dupla do roteiro ──
   O template declara 'JetBrains Mono' em UM lugar só (body); todo o resto
   herda. Como sobrescrevemos body aqui, remover o link do JetBrains no
   pipeline não deixa nenhum elemento órfão.
   Fallback de sistema deliberado: se o @font-face embutido falhar por algum
   motivo, a peça continua em sans humanista, nunca volta para mono.
   Plus Jakarta Sans é MAIS ESTREITA que JetBrains Mono, então a troca reduz
   o risco de estouro de texto nas caixas, nunca aumenta. */
${S_ANY} body,
${S_ANY} .diagram-container,
${S_ANY} svg text,
${S_ANY} .card,
${S_ANY} .toolbar{
  font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif !important;
}
${S_ANY} h1, ${S_ANY} h2, ${S_ANY} .title, ${S_ANY} .card-title,
${S_ANY} .subtitle, ${S_ANY} .header-row{
  font-family:'Space Grotesk',ui-sans-serif,system-ui,sans-serif !important;
  letter-spacing:-.01em !important;
}

/* ── Mata a grade milimetrada de planta baixa ──
   É o sinal visual mais forte de "papel de engenheiro". O jovial é liso.
   O ::after do .diagram-container é onde o preset desenha a grade. */
${S_ANY} body,
${S_ANY} .diagram-container,
${S_ANY} .stage,
${S_ANY} .canvas{ background-image:none !important; }
${S_ANY} .diagram-container::after{ display:none !important; content:none !important; }

/* ── O carimbo "BLUEPRINT / REV 01" não pertence a esta narrativa ──
   Ele vem de html[data-preset="blueprint"] .header-row::after. */
${S_ANY} .header-row::after{ display:none !important; content:none !important; }
${S_ANY} .preset-stamp{ display:none !important; }

/* ── Movimento perpétuo do template: desligado ──────────────────────────
   O .pulse-dot do cabeçalho tem animation:pulse 2s infinite. Numa sessão
   de 30 minutos por compartilhamento de tela, é um ponto piscando sem parar
   no canto do olho da plateia, competindo com a fala do Hugo do começo ao
   fim, e obrigando o encoder de vídeo a redesenhar aquela região o tempo
   todo. Movimento só se paga quando significa alguma coisa; este não
   significa nada. Vira um ponto sólido, que é o que ele já aparentava ser. */
${S_ANY} .pulse-dot{ animation:none !important; opacity:1 !important; }

/* ── Raios e sombra de serigrafia (offset sólido, zero blur) ── */
${S_ANY} .card{
  border-radius:20px !important;
  border:1.5px solid rgba(18,16,43,.08) !important;
  box-shadow:4px 4px 0 #6966ED !important;
}
${S_ANY} .card:nth-of-type(2){ box-shadow:4px 4px 0 #F953B2 !important; }
${S_ANY} .card:nth-of-type(3){ box-shadow:4px 4px 0 #F4D13B !important; }
${S_ANY} .card:nth-of-type(4){ box-shadow:4px 4px 0 #56527A !important; }
${S_ANY} .card::before{ display:none !important; }
/* Sem esticar: cada card fica da altura do próprio conteúdo. Sem isto, a
   grade estica todos até o mais alto e os curtos ficam com um vazio embaixo. */
${S_ANY} .cards{ align-items:start !important; }

/* ── Card "Na vida real", canto direito ──────────────────────────────────
   Aparece junto com o Passaporte Semântico quando um nó é clicado, e troca
   de conteúdo conforme o nó. É o que traduz a peça técnica em metáfora do
   mundo real na hora exata em que o Senhor lê o nome dela em voz alta.
   Fica visível TAMBÉM no Presentation Stage (ao contrário dos cards de baixo,
   que o template esconde com display:none quando data-present="true").      */
#vida-real{
  position:fixed; right:28px; top:210px; width:330px; max-height:62vh;
  overflow:auto; z-index:60; padding:22px 24px 24px;
  border-radius:20px; border:1.5px solid rgba(18,16,43,.10);
  background:#FFFFFF; box-shadow:4px 4px 0 #F953B2;
  font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif;
}
#vida-real[hidden]{ display:none !important; }
#vida-real .vr-eyebrow{
  display:block; font-family:'Space Grotesk',sans-serif; font-weight:700;
  font-size:11px; letter-spacing:.14em; text-transform:uppercase;
  color:#F953B2; margin-bottom:10px;
}
#vida-real .vr-title{
  display:block; font-family:'Space Grotesk',sans-serif; font-weight:700;
  font-size:21px; line-height:1.2; letter-spacing:-.01em;
  color:#12102B; margin-bottom:10px;
}
#vida-real .vr-body{
  margin:0; font-size:15px; line-height:1.6; color:#56527A;
}
#vida-real .vr-tec{
  display:block; margin-top:14px; padding-top:12px;
  border-top:1px solid rgba(18,16,43,.08);
  font-size:12.5px; color:#7B76A0;
}
html[data-theme="dark"] #vida-real{
  background:#1B1840; border-color:rgba(255,255,255,.14);
  box-shadow:4px 4px 0 #FF8ACB;
}
html[data-theme="dark"] #vida-real .vr-eyebrow{ color:#FF8ACB; }
html[data-theme="dark"] #vida-real .vr-title{ color:#FCFCFE; }
html[data-theme="dark"] #vida-real .vr-body{ color:#C6C1E4; }
html[data-theme="dark"] #vida-real .vr-tec{
  color:#9C96C4; border-top-color:rgba(255,255,255,.12);
}

/* ── RECUO PROGRESSIVO, não sumiço (seguro de palco, não estética) ────────
   A versão anterior escondia o card inteiro abaixo de 1180px. Aumentar o zoom
   do navegador para 110–125% é o gesto mais comum que existe em
   compartilhamento de tela, e num monitor de 1440 o zoom de 125% dá 1152px de
   viewport: o card da metáfora SUMIA em silêncio no meio da fala, e o Senhor
   lia em voz alta uma frase que a sala não estava vendo.
   Agora ele encolhe, e só desaparece abaixo de 900px (onde não cabe mesmo). */
@media (max-width:880px){
  #vida-real{ width:290px; right:16px; padding:18px 20px 20px; }
  #vida-real .vr-title{ font-size:19px; }
  #vida-real .vr-body{ font-size:14px; line-height:1.55; }
  #vida-real .vr-tec{ font-size:12px; }
}
@media (max-width:900px){ #vida-real{ display:none !important; } }

/* ── Os painéis fogem do nó ───────────────────────────────────────────────
   Medido no mapa irmão em 16 conceitos: o Passaporte é ancorado no canto do
   diagrama, então tapava o nó recém-clicado (dois casos a 100%) e o card
   tapava outros. Geometria fixa não resolve, porque a altura do Passaporte
   muda a cada nó. O lado passa a ser decidido em tempo real pelo solver do
   JS, e os dois painéis empilham numa coluna só, no lado livre.           */
${S_ANY} .focus-chip{ overflow:auto !important; }
${S_ANY}[data-painel-lado="direita"] .focus-chip{ left:auto !important; right:1rem !important; }
${S_ANY}[data-painel-lado="esquerda"] .focus-chip{ left:1rem !important; right:auto !important; }

${S_ANY} .diagram-container,
${S_ANY} .toolbar{ border-radius:20px !important; }

/* NÃO arredondar em 999px nada que seja PAINEL.
   Erro cometido e corrigido: a classe .focus-chip tem cara de "chip" pelo nome,
   mas é o Passaporte Semântico inteiro (class="focus-chip relationship-lens").
   Com border-radius 999px ele virou uma elipse gigante com o texto vazando.
   Pílula é para etiqueta de uma linha, nunca para caixa de conteúdo. */

/* ══════════════════════════════════════════════════════════════════════════
   MOVIMENTO — a partir daqui, tudo vive dentro de
   @media (prefers-reduced-motion: no-preference).
   Quem pede menos movimento recebe a peça ESTÁTICA e FUNCIONAL: nenhuma regra
   abaixo desenha estado, todas só descrevem o caminho até ele.

   ORÇAMENTO DECLARADO: duas fontes de movimento novo, ambas consequência de um
   gesto que o Senhor já faz no roteiro, ambas abaixo de 600ms, ambas
   terminando em imobilidade total. Zero loop, zero iteration-count infinite.
   Somando o roteiro real (3 viradas + 6 a 10 cliques), o movimento ADICIONADO
   fica em torno de 6s dentro de 1800s de fala. A rota (tecla R) não recebe
   NADA: ela já carrega ~1,9s de coreografia própria do template.

   CANAIS PERMITIDOS, e só estes três:
     · opacity        — área grande, atravessa a compressão do compartilhamento
     · stroke-width   — aresta, e codec preserva aresta
     · transform:translate em painel OPACO fora do SVG
   Proibido por decisão: scale, font-size, width/height, stroke-dasharray e
   qualquer geometria autoral do SVG. Os nós contêm <text font-size="7">, e
   qualquer reamostragem vira borrão depois do encode.
   ══════════════════════════════════════════════════════════════════════════ */
@media (prefers-reduced-motion: no-preference){

  /* ══ CAMADA 1 · A PASSAGEM DE BASTÃO ═══════════════════════════════════
     Na virada de capítulo (tecla ] ou clique no índice), os nós que ENTRAM
     acendem escalonados na ordem do focus[] do JSON — que É a ordem em que o
     Senhor narra. O olho da sala chega em cada caixa no instante em que o
     nome dela é dito.

     Automação acende tudo junto (interruptor).
     Orquestração acende em ordem (regente dando a entrada).

     O gancho --story-step já é escrito pelo template (renderStoryTrail) e não
     era lido por CSS nenhum: é um hook de ordenação de graça.

     Quem SAI cai primeiro, sem custo nenhum: clearStoryTrail() apaga o
     --story-step dos nós do capítulo anterior ANTES de renderStoryTrail
     escrever os novos, então os nós data-chapter-role="leave" ficam com
     delay 0 e escurecem imediatamente enquanto os novos ainda estão subindo.

     Janela total 550ms, calibrada contra os ~530ms reais do handoff
     (setTimeout de 110ms + câmera de 420ms). Termina antes de a câmera pousar.

     Escopo travado em svg[data-chapter-handoff]: fora da virada de capítulo,
     as transições do template ficam exatamente como estão.                */
  ${S_ANY} svg[data-chapter-handoff] [data-node-id]{
    transition:opacity 200ms cubic-bezier(.22,1,.36,1) !important;
    transition-delay:calc(min(var(--story-step, 0), 11) * 32ms) !important;
  }
  /* As setas entram em BLOCO, depois das caixas. Elas são a ligação, e ligação
     só faz sentido depois que existem as duas pontas. */
  ${S_ANY} svg[data-chapter-handoff] [data-edge-from]{
    transition:opacity 200ms cubic-bezier(.22,1,.36,1) !important;
    transition-delay:300ms !important;
  }
  /* GUARDA OBRIGATÓRIA — sem ela o botão Live/Still da barra quebra em
     silêncio. O template mata essas transitions em html[data-motion="still"]
     com !important, mas este bloco é injetado DEPOIS da folha dele: entre
     dois !important comparáveis, o nosso venceria.
     (E nunca escreva a tag de fechamento de style dentro de um comentário CSS:
     o parser de HTML encerra o elemento ali, comentário ou não, e todo o resto
     do tema some em silêncio. Já aconteceu neste arquivo. A guarda no fim do
     script existe por causa disso.) */
  ${S_STILL} svg[data-chapter-handoff] [data-node-id],
  ${S_STILL} svg[data-chapter-handoff] [data-edge-from]{
    transition:none !important;
    transition-delay:0ms !important;
  }

  /* ══ CAMADA 2 · O NÓ ATENDE COM ARESTA, NÃO COM BRILHO ═════════════════
     Substitui o cue visual mais fraco da peça. Hoje o nó selecionado ganha só
     drop-shadow(0 0 10px), e o preset blueprint (o que vai ao palco) rebaixa
     isso para 3px: três pixels de halo indigo sobre #FBFAFF não sobrevivem ao
     encoder. Brilho é gradiente de baixo contraste em área grande — a primeira
     informação que um codec descarta quando o bitrate aperta.
     Espessura de traço é ARESTA, e perder aresta é o artefato mais visível que
     existe, então o codec a preserva.

     A escala é a que a CASA já definiu: o template usa 3 e 3.4 de stroke-width
     para enfatizar origem e destino de rota. O pico de 3.2 cai DENTRO dessa
     régua, não é número inventado.

     UMA regra, DOIS comportamentos corretos, sem nenhum if:
       · virada de capítulo -> --story-step existe -> vira cascata junto com a Camada 1
       · clique num nó      -> releaseForNode() roda showAll() e apaga o
                               --story-step -> fallback 0 -> pulso imediato

     vector-effect:non-scaling-stroke porque .c-security e irmãs NÃO o têm:
     sem ele o traço escala com o zoom da câmera e engorda demais no
     Presentation Stage (tecla F). Com ele, a espessura fica constante em
     pixels de TELA — que é exatamente o que o compartilhamento pede.

     Sem !important no stroke-width de repouso, DE PROPÓSITO: declaração
     !important vence valor de @keyframes na cascata, e o pulso morreria em
     silêncio. A especificidade já é suficiente (nenhuma regra do template
     toca stroke-width em filho de nó), e CSS vence atributo de apresentação.

     O clone de exportação remove data-focus-selected, então nada disto vaza
     para o PNG/SVG.                                                        */
  @keyframes jov-atende{
    0%{ stroke-width:1.5 }
    45%{ stroke-width:3.2 }   /* <- ÚNICO número marcado para calibrar no ensaio (2.9 / 3.2 / 3.5) */
    100%{ stroke-width:2.2 }
  }
  ${S_ANY} svg[data-focus-active] [data-focus-selected] > :is(rect, circle, polygon):not(.c-mask){
    stroke-width:2.2;
    vector-effect:non-scaling-stroke;
    animation:jov-atende 320ms cubic-bezier(.22,1,.36,1) 1 both;
    animation-delay:calc(min(var(--story-step, 0), 11) * 32ms);
  }
  ${S_STILL} svg[data-focus-active] [data-focus-selected] > :is(rect, circle, polygon):not(.c-mask){
    animation:none !important;
  }

  /* ══ CAMADA 3 · OS DOIS PAINÉIS ENTRAM NA ORDEM DA FALA ════════════════
     Hoje o Passaporte (esquerda) e o card "Na vida real" (direita) nascem no
     MESMO frame em lados opostos da tela, e o olho da sala escolhe sozinho
     por onde começar — metade lendo na ordem errada enquanto o Senhor fala.

     A solução é por SUBTRAÇÃO: não animamos NADA no #focus-chip. Ele já não
     tem animation nenhuma, então já aparece em t=0. Basta animar o SEGUNDO
     painel com atraso para o escalonamento existir.

     Uma animação em vez de duas, mesmo efeito percebido — e some o risco de
     animar transform sobre backdrop-filter:blur(16px) (que é o que o
     .focus-chip tem), o que forçaria recomposição de camada desfocada por
     frame num notebook que já está codificando vídeo ao vivo.
     O #vida-real tem fundo sólido e filtro nenhum: ali o translate é grátis. */
  @keyframes jov-vr-entra{
    from{ opacity:0; transform:translateX(10px) }
    to{ opacity:1; transform:none }
  }
  #vida-real:not([hidden]){
    animation:jov-vr-entra 240ms cubic-bezier(.22,1,.36,1) 110ms both;
  }
  ${S_STILL} #vida-real:not([hidden]),
  html[data-motion="still"] #vida-real:not([hidden]){
    animation:none !important;
  }
}
</style>
<!-- ARCHIFY:TEMA-JOVIAL:END -->
`;

/**
 * Metáfora do mundo real por nó. É o conteúdo do card do canto direito.
 * Formato: id do componente -> [título curto, explicação, nota técnica opcional]
 * O id TEM que bater com components[].id do JSON. Se um nó for renomeado lá,
 * atualize aqui, senão o card simplesmente não abre para aquele nó.
 */
const VIDA_REAL_MAPA = {
  browser: ["A porta da rua", "Qualquer pessoa chega até ela. Não é aqui que se decide quem entra."],
  middleware: ["A portaria", "Confere o crachá antes de deixar subir, e decide quais andares você pode apertar.", "Nada carrega antes dela. É a fronteira de confiança real."],
  redis: ["A catraca", "Impede que uma pessoa só passe quinhentas vezes e trave a fila de todo mundo.", "O chat do aluno tem cota própria: dez por minuto, com chave separada."],
  web_app: ["O balcão de atendimento", "É a única parte que a pessoa realmente vê. Todo o resto acontece atrás."],
  api_routes: ["A central de pedidos", "Cada pedido é encaminhado para o setor certo, e cada setor tem porta própria."],
  agents_pkg: ["O professor que responde com pergunta", "É ele que faz o aluno pensar em vez de copiar.", "Sem esta peça, a plataforma seria um ChatGPT com a nossa logo em cima."],
  course_designer: ["O coordenador pedagógico", "Transforma a planta do curso em grade de aula, capítulo por capítulo."],
  llm_providers: ["Os consultores externos", "Alugados por hora. Quem decide qual deles chamar é a casa, pelo plano do cliente, não eles."],
  docling: ["O estagiário que lê a papelada", "Recebe o PDF e o slide, devolve em texto que a máquina entende."],
  blueprint_ms: ["O arquiteto", "Desenha a planta antes de a obra começar.", "Trabalha numa sala separada: processo próprio, em Python."],
  supabase_storage: ["O almoxarifado", "Guarda o áudio, o PDF e o slide de cada aula."],
  supabase_db: ["O arquivo com cadeado", "Cada pasta só abre para quem é dono dela.", "A regra de quem vê o quê é do banco, não da tela."],
};

const VIDA_REAL = `
<!-- ARCHIFY:TEMA-JOVIAL:START (painel "na vida real", injetado por tema-jovial.mjs) -->
<script id="tema-jovial-vida-real">
(function(){
  var MAPA = ${JSON.stringify(VIDA_REAL_MAPA)};
  function init(){
    var chip = document.getElementById('focus-chip');
    var idEl = document.getElementById('focus-id');
    if(!chip || !idEl){ return; }
    var box = document.createElement('aside');
    box.id = 'vida-real';
    box.className = 'no-print';
    box.hidden = true;
    box.setAttribute('aria-live','polite');
    var eyebrow = document.createElement('span');
    eyebrow.className = 'vr-eyebrow'; eyebrow.textContent = 'Na vida real';
    var titulo = document.createElement('strong'); titulo.className = 'vr-title';
    var corpo = document.createElement('p'); corpo.className = 'vr-body';
    var tec = document.createElement('span'); tec.className = 'vr-tec';
    box.appendChild(eyebrow); box.appendChild(titulo); box.appendChild(corpo); box.appendChild(tec);
    document.body.appendChild(box);

    // CAMADA 3, segunda metade. A animacao CSS de entrada so dispara quando o
    // atributo hidden alterna. Na TROCA de no, que e o caso MAIS FREQUENTE do
    // roteiro, o hidden nunca alterna: o card so troca de texto, sem nenhum
    // sinal visual de que mudou. WAAPI nativa cobre esse buraco.
    // Sem o guarda de ultimoId, o MutationObserver (que observa subtree,
    // childList e characterData) redisparava a animacao no meio dela mesma e o
    // painel tremia.
    var ultimoId = null;
    var anim = null;
    function podeAnimar(){
      if(typeof box.animate !== 'function'){ return false; }
      if(document.documentElement.getAttribute('data-motion') === 'still'){ return false; }
      try{
        if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){ return false; }
      }catch(_){}
      return true;
    }

    function areaComum(a, b){
      var ox = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      var oy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return ox * oy;
    }

    /* SOLVER DE POSIÇÃO, terceira e última versão. As duas anteriores falharam:
       a primeira sobrepunha quando não havia espaço, e a segunda entrava em
       LAÇO, porque posicionar() mexe na altura do Passaporte e o ResizeObserver
       observa o Passaporte. Ele se autodisparava, e o estado final passava a
       depender do tamanho da janela: passava na minha medição em 1440x900 e
       falhava numa janela menor.

       Duas mudanças fecham a porta:
       1. GUARDA DE RE-ENTRÂNCIA: a função não roda dentro de si mesma, então a
          mudança de altura que ELA causa não a chama de volta.
       2. UMA MEDIÇÃO SÓ: a posição do card vem da altura CALCULADA, não de
          medir o Passaporte depois de capá-lo. Some a dependência de layout
          intermediário, que era o que variava com a janela. */
    var posicionando = false;

    function posicionar(id){
      if(posicionando){ return; }
      posicionando = true;

      var raiz = document.documentElement;
      var n = document.querySelector('[data-node-id="' + id + '"]');
      var alvo = n ? n.getBoundingClientRect() : null;
      var melhor = null;

      ['direita', 'esquerda'].forEach(function(lado){
        raiz.setAttribute('data-painel-lado', lado);
        chip.style.removeProperty('max-height');
        var c0 = chip.getBoundingClientRect();   // altura NATURAL, sem teto
        if(!c0.width){ return; }

        var larg = Math.max(c0.width, 300);
        box.style.width = Math.round(larg) + 'px';
        var alt = box.offsetHeight || 240;

        // Espaço que sobra para o Passaporte depois de reservar folga e card.
        var teto = Math.max(150, window.innerHeight - c0.top - 12 - alt - 16);
        var usada = Math.min(teto, c0.height);   // se couber inteiro, sem teto
        var topo = c0.top + usada + 12;

        var r = { left:c0.left, right:c0.left + larg, top:topo, bottom:topo + alt };
        var custo = alvo ? areaComum(alvo, { left:c0.left, right:c0.right, top:c0.top, bottom:c0.top + usada }) + areaComum(alvo, r) : 0;
        if(!melhor || custo < melhor.custo){
          melhor = { lado:lado, topo:topo, esq:c0.left, larg:larg, custo:custo, teto:teto, precisaTeto:c0.height > teto };
        }
      });

      if(melhor){
        raiz.setAttribute('data-painel-lado', melhor.lado);
        if(melhor.precisaTeto){
          chip.style.setProperty('max-height', Math.round(melhor.teto) + 'px', 'important');
        } else {
          chip.style.removeProperty('max-height');
        }
        box.style.top = Math.round(melhor.topo) + 'px';
        box.style.left = Math.round(melhor.esq) + 'px';
        box.style.right = 'auto';
        box.style.width = Math.round(melhor.larg) + 'px';
      }

      // Solta depois de o layout assentar, para o observador não realimentar.
      setTimeout(function(){ posicionando = false; }, 60);
    }

    /* Guarda de re-entrância: o observador vigia a subárvore do Passaporte e o
       solver escreve atributo no <html>. A memória do último id evita refazer
       tudo a cada mutação que o template emite. */
    var ultimoId = null;
    var escrevendo = false;

    function sync(){
      if(escrevendo){ return; }
      var aberto = !chip.hasAttribute('hidden');
      var id = (idEl.textContent || '').trim();
      var d = MAPA[id];
      if(aberto && d){
        if(id === ultimoId && !box.hidden){ return; }
        escrevendo = true;
        titulo.textContent = d[0];
        corpo.textContent = d[1];
        if(d[2]){ tec.textContent = d[2]; tec.style.display = 'block'; }
        else { tec.textContent = ''; tec.style.display = 'none'; }
        box.hidden = false;
        ultimoId = id;
        posicionar(id);
        setTimeout(function(){ escrevendo = false; }, 0);
      } else {
        box.hidden = true;
        ultimoId = null;
      }
    }
    window.addEventListener('resize', function(){
      if(!box.hidden && ultimoId){ posicionar(ultimoId); }
    });


    /* CORRIDA COM O TEMPLATE, a causa do card cobrir o rodapé do Passaporte.
       O observador dispara quando o Passaporte deixa de estar oculto, mas o
       template ainda vai PREENCHER o conteúdo dele depois disso (a lista de
       conexões entra por último). Eu media um painel curto, encostava o card
       na base dele, e então o painel crescia por baixo do card.
       Conserto: observar o TAMANHO do painel e só reposicionar. Chamar
       posicionar(), nunca sync(), é o que impede laço: posicionar não escreve
       nada dentro do painel, então não realimenta o observador. */
    if(typeof ResizeObserver === 'function'){
      new ResizeObserver(function(){
        if(!box.hidden && ultimoId){ posicionar(ultimoId); }
      }).observe(chip);
    }
    // Cinto extra, para navegador sem ResizeObserver e para conteúdo tardio.
    [120, 320, 700].forEach(function(ms){
      setTimeout(function(){ if(!box.hidden && ultimoId){ posicionar(ultimoId); } }, ms);
    });

    new MutationObserver(sync).observe(chip, {
      attributes: true, attributeFilter: ['hidden'],
      subtree: true, childList: true, characterData: true
    });
    sync();
  }
  if(document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
</script>
<!-- ARCHIFY:TEMA-JOVIAL:END -->
`;

const html = readFileSync(SRC, "utf8");

if (!html.includes("</head>") || !html.includes("</body>")) {
  console.error("[tema-jovial] ERRO: nao achei </head> ou </body> no artefato. O Archify mudou o template?");
  process.exit(1);
}

// Remove uma injeção anterior antes de reinjetar (idempotente).
const limpo = html.replace(
  /<!-- ARCHIFY:TEMA-JOVIAL:START[\s\S]*?ARCHIFY:TEMA-JOVIAL:END -->\n?/g,
  "",
);

// CAMADA 0, segunda metade: corta TODO <link> de fonte remota — os do template
// (JetBrains Mono, preconnect) e qualquer resquício nosso. Depois disto o
// documento não tem mais nenhuma requisição de rede em runtime.
const semRede = limpo
  .replace(/[ \t]*<link\b[^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*>[ \t]*\n?/g, "")
  .replace(/[ \t]*<noscript>\s*<\/noscript>[ \t]*\n?/g, "");

const comTema = semRede
  .replace("</head>", `${JOVIAL}</head>`)
  .replace("</body>", `${VIDA_REAL}</body>`);

/* GUARDA DE INTEGRIDADE DO BLOCO — a lição mais cara deste arquivo.
   Uma tag de fechamento de style escrita dentro de um COMENTÁRIO CSS encerra o
   elemento ali mesmo: o parser de HTML não lê comentário de CSS. O resultado é
   o pior modo de falha possível — metade do tema vira texto solto no DOM, e
   nada reclama. Foi exatamente o que aconteceu na primeira versão da camada de
   movimento, e o sintoma (chaves desbalanceadas) só apareceu ao contar.
   Duas checagens baratas fecham a porta para sempre. */
const TAG_STYLE = "sty" + "le"; // partido de propósito: nem o literal deste script pode virar tag
const blocoStyle = new RegExp(`<${TAG_STYLE} id="tema-jovial">([\\s\\S]*?)</${TAG_STYLE}>`).exec(comTema);
if (!blocoStyle) {
  console.error("[tema-jovial] ERRO: o bloco de estilo do tema nao sobreviveu a injecao.");
  process.exit(1);
}
const cssInjetado = blocoStyle[1];
const cssSemComentarios = cssInjetado.replace(/\/\*[\s\S]*?\*\//g, "");
const abre = (cssSemComentarios.match(/\{/g) || []).length;
const fecha = (cssSemComentarios.match(/\}/g) || []).length;
if (abre !== fecha) {
  console.error(`[tema-jovial] ERRO: CSS do tema desbalanceado (${abre} "{" para ${fecha} "}").`);
  console.error("[tema-jovial] Causa classica: uma tag de fechamento de style escrita dentro de um comentario CSS,");
  console.error("[tema-jovial] que trunca o bloco em silencio. Procure por ela.");
  process.exit(1);
}
// As 3 camadas de movimento precisam estar presentes E dentro do gate de
// prefers-reduced-motion. Se uma sumir, o build falha em voz alta.
const ANCORAS = [
  "@media (prefers-reduced-motion: no-preference)",
  "svg[data-chapter-handoff] [data-node-id]", // camada 1
  "jov-atende", // camada 2
  "jov-vr-entra", // camada 3
  '[data-motion="still"]', // as guardas do botao Live/Still
];
const faltando = ANCORAS.filter((a) => !cssInjetado.includes(a));
if (faltando.length) {
  console.error(`[tema-jovial] ERRO: faltou no CSS injetado: ${faltando.join(", ")}`);
  process.exit(1);
}

/* GUARDA DE REGRESSÃO — o script vira o verificador de si mesmo.
   Se um <link>, <script>, <img> ou <iframe> ainda apontar para a rede, a peça
   deixou de ser autocontida e o build FALHA em voz alta, não em silêncio.
   (Um <a href="https://..."> de ajuda é link de navegação, não dependência de
   runtime, e por isso não conta.) */
const DEP_REMOTA = /<(?:link|script|img|iframe)\b[^>]*(?:href|src)\s*=\s*["']https?:/i;
const violacao = comTema.match(DEP_REMOTA);
if (violacao) {
  console.error("[tema-jovial] ERRO: a peca ficou com dependencia externa em runtime.");
  console.error(`[tema-jovial] trecho: ${violacao[0].slice(0, 160)}`);
  console.error("[tema-jovial] A restricao e dura: se o Wi-Fi do evento cair, a peca tem que funcionar.");
  process.exit(1);
}

writeFileSync(OUT, comTema, "utf8");

const kbFontes = Math.round((B64_JAKARTA.length + B64_GROTESK.length) / 1024);
console.log(`[tema-jovial] tema aplicado -> ${OUT}`);
console.log(`[tema-jovial] fontes embutidas em base64: 2 arquivos, ~${kbFontes} KB. Zero requisicao de rede.`);
console.log(`[tema-jovial] card "na vida real": ${Object.keys(VIDA_REAL_MAPA).length} nos mapeados`);
console.log("[tema-jovial] movimento: cascata de capitulo, pulso de aresta no no, entrada do card. Tudo sob prefers-reduced-motion.");
console.log("[tema-jovial] lembrete: rode DEPOIS de cada `archify deliver`, nunca antes.");
