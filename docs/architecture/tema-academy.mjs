#!/usr/bin/env node
/**
 * tema-academy.mjs — aplica a identidade OFICIAL da exímIA Academy (rampa Brasa)
 * sobre um HTML entregue pelo Archify, e injeta o painel "Na vida real".
 *
 * Irmão do tema-jovial.mjs. A diferença é só a paleta e o mapa de traduções:
 * o jovial é a identidade do mastermind (indigo/rosa), este é a marca do
 * produto (laranja brasa sobre papel quente).
 *
 * Tokens copiados de apps/academy-landing-v2/app/src/app/globals.css.
 * Se a marca mudar lá, mude aqui.
 *
 * USO:
 *   node tema-academy.mjs --src eximia-academy-conceitos.html
 *   node tema-academy.mjs                     # default: o mapa de conceitos
 *   node tema-academy.mjs --src X.html --inplace
 *
 * ORDEM: archify deliver -> este script. Nunca o contrário (deliver sobrescreve).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const iSrc = process.argv.indexOf("--src");
const ARQUIVO =
  iSrc > -1 && process.argv[iSrc + 1] ? process.argv[iSrc + 1] : "eximia-academy-conceitos.html";
const SRC = join(HERE, ARQUIVO);
const INPLACE = process.argv.includes("--inplace");
const OUT = INPLACE ? SRC : join(HERE, ARQUIVO.replace(/\.html$/, "-academy.html"));

const FONTES_DIR = join(HERE, "fontes");

function fonteBase64(nome) {
  try {
    return readFileSync(join(FONTES_DIR, nome)).toString("base64");
  } catch (_) {
    console.error(`[tema-academy] ERRO: nao achei ${nome} em docs/architecture/fontes/.`);
    process.exit(1);
  }
}

// Reaproveita as mesmas fontes já em disco (o tema-jovial as baixou).
// Zero requisição de rede, mesma decisão do irmão.
const B64_JAKARTA = fonteBase64("plus-jakarta-sans-latin-var.woff2");
const B64_GROTESK = fonteBase64("space-grotesk-latin-var.woff2");

const UR_LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329," +
  "U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";

// Especificidade acima do preset do Archify, que declara em (0,2,0).
const S_LIGHT = 'html[data-preset][data-preset][data-theme="light"]';
const S_DARK = 'html[data-preset][data-preset][data-theme="dark"]';
const S_ANY = "html[data-preset][data-preset]";

/**
 * Tradução de cada conceito para o mundo real. É o conteúdo do card da direita.
 * id do componente -> [título curto, explicação, nota opcional]
 * Os ids têm que bater com components[].id de eximia-academy-conceitos.json.
 */
const VIDA_REAL_MAPA = {
  "capacidade_instalada": [
    "Academia paga, sem treinar",
    "A mensalidade sai todo mês. O corpo é que não muda.",
    "Não falta treinamento. Falta capacidade.",
  ],
  "ilusao_dominio": [
    "Assistir aula de natação",
    "Você entende cada movimento e sai se sentindo capaz. Depois cai na água.",
    "Quanto mais fácil parece, menos fica.",
  ],
  "dificuldade_desejavel": [
    "O músculo cresce no esforço",
    "Ninguém ganha força vendo alguém levantar o peso. O que fixa é a tentativa.",
  ],
  "metodo_socratico": [
    "O professor devolve a pergunta",
    "Você chega esperando a resposta e sai com a pergunta que te faz achar sozinho.",
  ],
  "dialogo_socratico": [
    "A conversa que não entrega",
    "A IA conduz por perguntas até a pessoa chegar sozinha. Nunca dá a resposta de bandeja.",
    "Roda em produção hoje.",
  ],
  "cenarios_praticos": [
    "O simulador de voo",
    "Ninguém aprende a pousar lendo o manual. O aluno decide, e a IA avalia a decisão.",
    "Roda em produção hoje.",
  ],
  "quiz_adaptativo": [
    "A prova que mede o degrau",
    "Três formatos de pergunta já rodam. A dificuldade se ajustar sozinha ainda é desenho.",
    "Parte disto é método, não software rodando.",
  ],
  "atividades_rubrica": [
    "Trabalho entregue, com gabarito",
    "A pessoa produz algo de verdade e é corrigida por critério escrito, não por impressão.",
    "Roda em produção hoje.",
  ],
  "taxonomia_bloom": [
    "Cada músculo, seu exercício",
    "Decorar, aplicar e criar são esforços diferentes. Cada um pede uma interação diferente.",
    "É código: existe um mapa Bloom para interação no repositório.",
  ],
  "gerador_validador": [
    "Cozinheiro não é o crítico",
    "Um agente escreve a pergunta. Outro, separado, confere antes de ela chegar no aluno.",
    "Roda em produção hoje.",
  ],
  "lms_contraponto": [
    "A catraca conta entrada",
    "Ela sabe quantas vezes você passou pela porta. Não sabe se você ficou mais forte.",
    "A régua muda: de quem concluiu para quem ficou mais capaz.",
  ],
  "hci": [
    "Exame de sangue, não balança",
    "A barra de progresso é a balança: sobe sem dizer o que mudou.",
    "Método desenhado. Ainda não há cálculo de HCI no código.",
  ],
  "elo_evidencia": [
    "Prova de que saiu do papel",
    "Não conclui quem não trouxer prova de que aplicou no trabalho.",
    "O gestor validar é desenho, é o próximo elo a fechar. Hoje não é software.",
  ],
  "contrato_transferencia": [
    "Combinar o placar antes do jogo",
    "Antes da trilha, fica escrito o que será aplicado no trabalho e como isso será registrado.",
    "Sem isso, vira curso. Método desenhado.",
  ],
  "conclusao_consciente": [
    "Carteira, não certificado",
    "Terminar sabendo dirigir, não terminar o curso de direção.",
    "Antes do método: 22% de progresso médio, em 43 alunos.",
  ],
  "dave_ulrich": [
    "A IA deve deixar a empresa capaz",
    "Não é tornar o RH mais rápido. É tornar a organização mais capaz.",
  ],
};

const TEMA = `
<!-- ARCHIFY:TEMA-ACADEMY:START (injetado por tema-academy.mjs) -->
<style id="tema-academy">
@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-weight:400 800;font-display:block;
  src:url(data:font/woff2;base64,${B64_JAKARTA}) format('woff2');unicode-range:${UR_LATIN};}
@font-face{font-family:'Space Grotesk';font-style:normal;font-weight:500 700;font-display:block;
  src:url(data:font/woff2;base64,${B64_GROTESK}) format('woff2');unicode-range:${UR_LATIN};}

/* ══ RAMPA BRASA, a marca do produto ═════════════════════════════════════
   Mesma disciplina do tema irmão: a MAIORIA dos nós fica quieta em papel
   quente, e o laranja é gasto onde significa algo. A diferença é que aqui o
   âmbar tem trabalho: ele marca o que ainda é MÉTODO DESENHADO, não software
   rodando. Cor como aviso de honestidade, não como enfeite.                */
${S_LIGHT}{
  --bg:#faf9f7 !important;              /* paper */
  --grid:rgba(28,25,23,.04) !important;
  --text:#1c1917 !important;            /* ink */
  --text-muted:#57534e !important;      /* ink-soft */
  --text-dim:#8a827a !important;
  --text-faint:#8a827a !important;
  --panel:#ffffff !important;
  --panel-border:#e7e2da !important;    /* line */
  --lane-fill:rgba(255,107,44,.035) !important;
  --lane-stroke:rgba(255,107,44,.26) !important;
  --arrow:rgba(87,83,78,.55) !important;
  --arrow-emphasis:#f0540f !important;  /* brasa-600, o caminho principal */
  --mask:#faf9f7 !important;

  /* quietos: papel com contorno de tinta suave */
  --backend-fill:rgba(255,171,126,.10) !important;  --backend-stroke:#c84208 !important;
  --database-fill:rgba(28,25,23,.04) !important;    --database-stroke:#8a827a !important;
  --messagebus-fill:rgba(28,25,23,.04) !important;  --messagebus-stroke:#8a827a !important;
  --external-fill:#ffffff !important;               --external-stroke:#b8afa6 !important;
  /* os que ganham voz */
  --frontend-fill:rgba(255,107,44,.12) !important;  --frontend-stroke:#ff6b2c !important;
  --security-fill:rgba(28,25,23,.06) !important;    --security-stroke:#1c1917 !important;
  /* âmbar = AVISO. É o que ainda é desenho, não software. */
  --cloud-fill:rgba(255,205,176,.28) !important;    --cloud-stroke:#a0370c !important;

  --toolbar-bg:rgba(255,255,255,.94) !important;
  --toolbar-border:#e7e2da !important;
  --toolbar-text:#1c1917 !important;
  --toolbar-hover:#ffffff !important;
  --toolbar-menu-bg:#ffffff !important;
}
${S_DARK}{
  --bg:#140d07 !important;              /* night */
  --grid:rgba(255,255,255,.04) !important;
  --text:#faf9f7 !important;
  --text-muted:#d6cec5 !important;
  --text-dim:#b8afa6 !important;
  --text-faint:#b8afa6 !important;
  --panel:rgba(255,255,255,.05) !important;
  --panel-border:rgba(255,255,255,.12) !important;
  --lane-fill:rgba(255,107,44,.08) !important;
  --lane-stroke:rgba(255,138,80,.34) !important;
  --arrow:rgba(184,175,166,.55) !important;
  --arrow-emphasis:#ff8a50 !important;
  --mask:#140d07 !important;

  --backend-fill:rgba(255,138,80,.16) !important;   --backend-stroke:#ffab7e !important;
  --database-fill:rgba(255,255,255,.06) !important; --database-stroke:#b8afa6 !important;
  --messagebus-fill:rgba(255,255,255,.06) !important;--messagebus-stroke:#b8afa6 !important;
  --external-fill:rgba(255,255,255,.04) !important; --external-stroke:#b8afa6 !important;
  --frontend-fill:rgba(255,107,44,.26) !important;  --frontend-stroke:#ff6b2c !important;
  --security-fill:rgba(250,249,247,.10) !important; --security-stroke:#faf9f7 !important;
  --cloud-fill:rgba(255,171,126,.22) !important;    --cloud-stroke:#ffcdb0 !important;

  --toolbar-bg:rgba(20,13,7,.90) !important;
  --toolbar-border:rgba(255,255,255,.12) !important;
  --toolbar-text:#faf9f7 !important;
  --toolbar-hover:rgba(20,13,7,.98) !important;
  --toolbar-menu-bg:#1f1209 !important;
}

/* Tipografia da casa, com fallback de sistema se algo der errado. */
${S_ANY} body, ${S_ANY} .diagram-container, ${S_ANY} svg text,
${S_ANY} .card, ${S_ANY} .toolbar{
  font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,-apple-system,sans-serif !important;
}
${S_ANY} h1, ${S_ANY} h2, ${S_ANY} .title, ${S_ANY} .card-title,
${S_ANY} .subtitle, ${S_ANY} .header-row{
  font-family:'Space Grotesk',ui-sans-serif,system-ui,sans-serif !important;
  letter-spacing:-.01em !important;
}

/* Sai a grade de planta baixa e o carimbo do preset. */
${S_ANY} body, ${S_ANY} .diagram-container, ${S_ANY} .stage, ${S_ANY} .canvas{
  background-image:none !important;
}
${S_ANY} .diagram-container::after{ display:none !important; content:none !important; }
${S_ANY} .header-row::after{ display:none !important; content:none !important; }
${S_ANY} .preset-stamp{ display:none !important; }
${S_ANY} .pulse-dot{ animation:none !important; opacity:1 !important; }

/* Região e grupo, em papel quente. */
${S_ANY} svg .c-region{ fill:rgba(255,107,44,.03) !important; stroke:rgba(255,107,44,.28) !important; }
${S_ANY} svg .c-security-group{ fill:rgba(28,25,23,.02) !important; stroke:rgba(28,25,23,.20) !important; }
${S_LIGHT} svg .t-cloud{ fill:rgba(87,83,78,.92) !important; }
${S_DARK} svg .t-cloud{ fill:rgba(214,206,197,.88) !important; }

/* Cards: raio e sombra da marca (radius-card 1rem, sombra brasa). */
${S_ANY} .cards{ align-items:start !important; }
${S_ANY} .card{
  border-radius:1rem !important;
  border:1.5px solid #e7e2da !important;
  box-shadow:0 8px 24px -8px rgba(255,107,44,.40) !important;
}
${S_ANY} .card::before{ display:none !important; }
${S_ANY} .diagram-container, ${S_ANY} .toolbar{ border-radius:1rem !important; }

/* ── Card "Na vida real", painel próprio ─────────────────────────────────
   TENTATIVA DESCARTADA, registrada para ninguém repetir: cheguei a fundir
   esta seção DENTRO do Passaporte, para acabar de vez com a colisão entre as
   duas caixas. O texto ficou melhor, mas a página TRAVOU: o template reage ao
   tamanho do próprio Passaporte (a câmera reenquadra), e o meu conteúdo dentro
   dele criava um laço de realimentação sem fim. Chrome pendurado três vezes.
   Página travada no palco é inaceitável; sobreposição parcial de painel não é.
   Então voltou a ser painel próprio, e a colisão é resolvida pelo solver de
   posição no JS abaixo, que testa os lados e escolhe o livre.              */
#vida-real{
  position:fixed; right:28px; top:210px; width:340px; max-height:56vh;
  overflow:auto; z-index:60; padding:20px 22px 22px;
  border-radius:1rem; border:1.5px solid #e7e2da; background:#ffffff;
  box-shadow:0 8px 24px -8px rgba(255,107,44,.50);
  font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif;
}
#vida-real[hidden]{ display:none !important; }
#vida-real .vr-eyebrow{
  display:block; font-family:'Space Grotesk',sans-serif; font-weight:700;
  font-size:11px; letter-spacing:.14em; text-transform:uppercase;
  color:#f0540f; margin-bottom:9px;
}
#vida-real .vr-title{
  display:block; font-family:'Space Grotesk',sans-serif; font-weight:700;
  font-size:20px; line-height:1.2; letter-spacing:-.01em; color:#1c1917; margin-bottom:9px;
}
#vida-real .vr-body{ margin:0; font-size:14.5px; line-height:1.55; color:#57534e; }
#vida-real .vr-tec{
  display:block; margin-top:12px; padding-top:11px; border-top:1px solid #e7e2da;
  font-size:12px; line-height:1.5; color:#8a827a;
}
html[data-theme="dark"] #vida-real{
  background:#1f1209; border-color:rgba(255,255,255,.14);
  box-shadow:0 8px 24px -8px rgba(255,107,44,.55);
}
html[data-theme="dark"] #vida-real .vr-eyebrow{ color:#ff8a50; }
html[data-theme="dark"] #vida-real .vr-title{ color:#faf9f7; }
html[data-theme="dark"] #vida-real .vr-body{ color:#d6cec5; }
html[data-theme="dark"] #vida-real .vr-tec{ color:#b8afa6; border-top-color:rgba(255,255,255,.12); }
@media (max-width:880px){ #vida-real{ display:none !important; } }

/* Os painéis fogem do nó: o lado é decidido em tempo real pelo solver do JS. */
${S_ANY} .focus-chip{ overflow:auto !important; }
${S_ANY}[data-painel-lado="direita"] .focus-chip{ left:auto !important; right:1rem !important; }
${S_ANY}[data-painel-lado="esquerda"] .focus-chip{ left:1rem !important; right:auto !important; }
</style>
<!-- ARCHIFY:TEMA-ACADEMY:END -->
`;

const PAINEL = `
<!-- ARCHIFY:TEMA-ACADEMY:START (painel na vida real) -->
<script id="tema-academy-vida-real">
(function(){
  var MAPA = ${JSON.stringify(VIDA_REAL_MAPA)};
  function init(){
    var chip = document.getElementById('focus-chip');
    var idEl = document.getElementById('focus-id');
    if(!chip || !idEl){ return; }
    var box = document.createElement('aside');
    box.id = 'vida-real'; box.className = 'no-print'; box.hidden = true;
    box.setAttribute('aria-live','polite');
    var eyebrow = document.createElement('span');
    eyebrow.className='vr-eyebrow'; eyebrow.textContent='Na vida real';
    var titulo = document.createElement('strong'); titulo.className='vr-title';
    var corpo = document.createElement('p'); corpo.className='vr-body';
    var tec = document.createElement('span'); tec.className='vr-tec';
    box.appendChild(eyebrow); box.appendChild(titulo); box.appendChild(corpo); box.appendChild(tec);
    document.body.appendChild(box);

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
       solver mexe em atributo do <html>. Sem a memória do último id, isto vira
       trabalho repetido a cada mutação do template. */
    var ultimoId = null;
    var escrevendo = false;

    function sync(){
      if(escrevendo){ return; }
      var aberto = !chip.hasAttribute('hidden');
      var id = (idEl.textContent||'').trim();
      var d = MAPA[id];
      if(aberto && d){
        if(id === ultimoId && !box.hidden){ return; }
        escrevendo = true;
        titulo.textContent = d[0]; corpo.textContent = d[1];
        if(d[2]){ tec.textContent = d[2]; tec.style.display='block'; }
        else { tec.textContent=''; tec.style.display='none'; }
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

    new MutationObserver(sync).observe(chip,{attributes:true,attributeFilter:['hidden'],subtree:true,childList:true,characterData:true});
    sync();
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',init); }
  else { init(); }
})();
</script>
<!-- ARCHIFY:TEMA-ACADEMY:END -->
`;

const html = readFileSync(SRC, "utf8");
if (!html.includes("</head>") || !html.includes("</body>")) {
  console.error("[tema-academy] ERRO: nao achei </head> ou </body>. O Archify mudou o template?");
  process.exit(1);
}

// Idempotente: remove injeção anterior (deste tema e do irmão) antes de reinjetar,
// e derruba todo <link> de fonte externa, para a peça não depender de rede.
const limpo = html
  .replace(/<!-- ARCHIFY:TEMA-(ACADEMY|JOVIAL):START[\s\S]*?ARCHIFY:TEMA-\1:END -->\n?/g, "")
  .replace(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>\n?/g, "");

writeFileSync(OUT, limpo.replace("</head>", `${TEMA}</head>`).replace("</body>", `${PAINEL}</body>`), "utf8");

// Só conta o que BAIXA recurso no load. <a href> externo é link de leitura,
// não dependência de runtime: o template do Archify tem um para a doc dele.
const rede = /<(?:link|script|img|iframe|source|video|audio)[^>]+(?:href|src)\s*=\s*["']https?:\/\//i.test(
  readFileSync(OUT, "utf8"),
);
console.log(`[tema-academy] rampa Brasa aplicada -> ${OUT}`);
console.log(`[tema-academy] traducoes "na vida real": ${Object.keys(VIDA_REAL_MAPA).length} conceitos`);
console.log(`[tema-academy] dependencia de rede: ${rede ? "SIM (revisar!)" : "nenhuma"}`);
