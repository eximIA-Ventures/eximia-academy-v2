# Estudo — levar o mapa Archify ao visual jovial do mastermind

> Frente separada, pedida por Hugo Capitelli em 2026-07-29.
> Alvo: a identidade visual de `apps/hub-discovery/mastermind-otto-ROTEIRO.html` e da landing jovial do mastermind.
> Estado: **protótipo construído e rodando**, não proposta no papel.

## O que separa os dois hoje

O preset atual do mapa é `blueprint`. Ele não é feio, é de **outra família**. As distâncias reais, medidas no CSS dos dois lados:

| Dimensão | Blueprint (hoje) | Jovial (alvo) |
|:---|:---|:---|
| Fonte | `JetBrains Mono` em tudo | `Space Grotesk` (título) + `Plus Jakarta Sans` (corpo). Zero mono. |
| Preto | `#020617` slate | `#12102B` roxo-quase-preto. Nunca preto puro. |
| Cinza | `#94a3b8` neutro | não existe. Texto de apoio é lavanda `#56527A`. |
| Fundo | grade milimetrada 32px sobre azul de planta baixa | `#FBFAFF` liso, branco com gota de roxo |
| Cor | ciano/esmeralda de **severidade e categoria** | indigo/rosa/sol de **narrativa** |
| Raios | 0.1 a 0.35rem (quase reto) | 20px em cards, 999px em pills |
| Sombra | difusa, material design | `4px 4px 0` sólida, na cor do card. Serigrafia. |
| Bordas | `#e2e8f0` cinza | a própria tinta a 8%, `rgba(18,16,43,.08)` |

**O diagnóstico que importa:** o que torna o jovial jovial não é "ser colorido". É **onde** a cor entra. Cor forte só aparece como informação (a tarja que anuncia troca de tela, o grifo que marca a lacuna). Todo o resto é branco quente com muito ar. O blueprint faz o oposto: cor em todo lugar, como categoria.

## As quatro opções

| # | Opção | Como se faz | Esforço | Quebra a validação? | Fidelidade |
|:---|:---|:---|:---|:---|:---|
| A | Trocar `visual_preset` para `editorial` | 1 linha no JSON | minutos | Não | ~40%. Acerta o instinto (papel quente, acento narrativo, fim do mono) mas erra a paleta: serifa Georgia e vermelhão `#bb4c23`, nada de indigo/rosa. |
| B | **Script de tema pós-deliver** | `tema-jovial.mjs`, injeta um `<style>` que sobrescreve as CSS custom properties | **feito** | Não. Roda depois, não toca o JSON nem o validador. | **~80%.** Acerta paleta, tipografia, raios, sombra e mata a grade. |
| C | A + B | editorial como base + tema por cima | minutos | Não | ~82%. Ganho marginal sobre B: o editorial já derruba parte do chrome de engenharia. |
| D | Fork do renderer | reescrever `renderers/architecture/` | dias | Sim, congela a ferramenta na versão atual | ~100% e **não recomendo**. Perde toda atualização futura do Archify por ganho estético de 20%. |

## Recomendação: opção B

Já está construída e testada: `docs/architecture/tema-jovial.mjs`.

```bash
node docs/architecture/tema-jovial.mjs             # gera eximia-academy-archify-jovial.html
node docs/architecture/tema-jovial.mjs --inplace   # sobrescreve o artefato principal
```

O script é **idempotente** (verificado: duas execuções seguidas deixam uma única injeção) porque remove a marcação anterior antes de reinjetar.

Mapeamento de cor por papel, com intenção declarada:

| Tipo de nó | Cor jovial | Por quê |
|:---|:---|:---|
| frontend | indigo `#6966ED` | o que a pessoa toca |
| backend | rosa `#F953B2` | onde a decisão mora, a cor de energia da marca |
| database | laranja `#EF8E3F` | o que guarda |
| cloud | sol `#F4D13B` | o que é de fora e gerenciado |
| security | tinta `#12102B` | o porteiro, em tinta cheia, o mais forte da tela |
| external | lavanda `#56527A` | o que não é nosso |

## ⚠ O alerta que não pode ser esquecido

**`archify deliver` sobrescreve o HTML inteiro.** Qualquer tema aplicado é perdido na próxima regeneração do mapa. A ordem é sempre:

```
1. editar o JSON
2. archify validate
3. archify deliver
4. node tema-jovial.mjs      <- SEMPRE por último
```

Se o mapa for regenerado na véspera da apresentação e o passo 4 for esquecido, Hugo sobe ao palco com o blueprint azul. Por isso o tema é um script versionado e não um CSS editado à mão: um comando esquecido é recuperável, um CSS perdido não.

## Três erros cometidos aqui, registrados para não se repetirem

**1. Especificidade CSS, o erro que falhou em silêncio.**
A primeira versão do tema não aplicou nada, e não emitiu erro nenhum. O preset declara as variáveis em `[data-preset="blueprint"][data-theme="light"]`, especificidade **(0,2,0)**. O override usava `html[data-theme="light"]`, **(0,1,1)**. O preset venceu a cascata.
Correção em duas camadas: seletor `html[data-preset][data-preset][data-theme="X"]` = **(0,3,1)**, mais `!important` em toda declaração. Usar `[data-preset]` por *presença* e não por valor faz o tema sobreviver se o preset for trocado pela barra de ferramentas no meio da apresentação.

**2. "Jovial" não é "colorido", e eu inverti isso.**
A segunda versão pintou os cinco nós de tipo `backend` de rosa e a região de creme. O resultado foi uma tela inundada de cor, o oposto exato do DNA extraído do roteiro. O princípio correto: **cor forte só entra como informação**, o resto é branco arroxeado com ar. A paleta final gasta cor em três lugares apenas: tinta cheia no `Next Middleware` (o porteiro), indigo no `apps/web` (o que a pessoa toca) e rosa no caminho em ênfase (por onde a decisão corre). Amarelo não entra em caixa nenhuma: no roteiro o sol é grifo de lacuna.

**3. Um defeito do artefato que o blueprint escondia.**
O retângulo do `security-group` começava em `y=16` e o rótulo da região tem baseline em `y=18`: a borda cortava o texto ao meio. Não era o tema, era o `pad: 14` da fronteira no JSON. Corrigido para `pad: 4`, com `deliver` revalidado em 9/9. Existia desde a primeira versão do mapa.

## Verificação feita (e a que não foi feita)

**Feita, com Chrome headless:**
- valor computado das variáveis no navegador: `db:#F5A968 · bg:#12102B · back:#FF8ACB · injetado:sim` — prova de que o override venceu a cascata, em vez de suposição;
- captura de tela renderizada e inspecionada nos **dois temas**, claro e escuro;
- idempotência do script (duas execuções, uma única injeção);
- legibilidade do rótulo da região corrigida por tema (uma cor só não serve a dois fundos).

**Não feita:** conferência em projetor real, com a compressão de compartilhamento de tela do evento. É o único teste que sobra, e ele é do Senhor.

## Risco que permanece

1. **Fonte via rede.** O tema puxa Google Fonts. Se o Wi-Fi do evento falhar, o fallback declarado é sans humanista de sistema, nunca volta para mono. Se o Senhor quiser risco zero, o caminho é embutir a fonte em base64 (~150KB a mais).
2. **Degradação silenciosa.** Se um seletor do template mudar numa atualização do Archify, o tema volta ao blueprint em parte da tela sem falhar alto. Foi exatamente o modo de falha do erro nº 1. Rodar uma captura de conferência sempre que a ferramenta for atualizada.
3. **Fidelidade não é 100%.** As ilustrações Noodle, as rotações de 1,2°, o grifo amarelo e o respiro de 120px do jovial não têm onde morar num SVG gerado. O mapa ficou *da mesma família* do roteiro, não idêntico a ele.
