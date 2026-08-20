// ---------------------------------------------------------------------------
// "Padrões e tendências" (Analytics do gestor) — os limiares desta tela.
// ---------------------------------------------------------------------------
// Fonte dos números: SPEC-FUNCIONAL.md §16 a §21 e CONTRATO-padroes.md.
//
// O QUE NÃO ESTÁ AQUI, DE PROPÓSITO: tudo que a Visão geral já declarou. Este
// arquivo IMPORTA e reexporta `MS_DIA`, `MS_SEMANA`, `RELEVANCIA_ABS_PESSOAS`,
// `RELEVANCIA_ABS_RETOMADA` e `SINAIS_MAX` em vez de redeclará-los. Uma segunda
// cópia de um limiar é a origem da tela que diz dois números para a mesma
// coisa, e o cabeçalho de `visao-geral/parametros.ts` já avisa disso.
//
// `SEM_ACESSO_DAYS` continua canônico em `@/lib/student-triage` e não aparece
// nem aqui nem lá — pelo mesmo motivo.
// ---------------------------------------------------------------------------

export {
  MS_DIA,
  MS_SEMANA,
  RELEVANCIA_ABS_PESSOAS,
  RELEVANCIA_ABS_RETOMADA,
  REGULARIDADE_MIN_DIAS_NA_SEMANA,
  /** §18: "Máximo 3". O valor da Visão geral já é 3 — reusado, nunca copiado. */
  SINAIS_MAX,
} from "../visao-geral/parametros"

// --- §16 "Principais mudanças no período" ----------------------------------
/**
 * §16 literal: "Máximo 4 mudanças relevantes".
 *
 * A Visão geral declara `MUDANCAS_MAX = 3` para o bloco §9 dela, e esse valor
 * NÃO é editado: são duas telas com duas réguas. Esta declara a sua.
 */
export const MUDANCAS_MAX = 4

/** §16 + §8.2: uma variação de regularidade só é notícia a partir de 5 p.p. */
export const REGULARIDADE_DELTA_MIN_PP = 5
/**
 * ...E de 2 pessoas. Com 20 pessoas no recorte, UMA pessoa move 5 p.p.; sem o
 * critério em pessoas, uma pessoa vira manchete.
 */
export const REGULARIDADE_DELTA_MIN_PESSOAS = 2

/** §16 tipo "Queda acentuada em N módulos": quantos módulos fazem um grupo. */
export const MODULOS_EM_QUEDA_MIN = 2

/** Quantas semanas da série precisam subir em fila para a tela dizer "consistente". */
export const CONSISTENCIA_SEMANAS = 3

// --- §17 "Evolução do ritmo" ----------------------------------------------
/** Piso: a §32 exige DOIS períodos para se falar em tendência. */
export const SERIE_SEMANAS_MIN = 2
/** Teto: 90 dias dariam 24 pontos ilegíveis num card de 3 colunas. */
export const SERIE_SEMANAS_MAX = 12
/** Menos que isto com atividade e o bloco cai em estado vazio (§32). */
export const SERIE_SEMANAS_COM_ATIVIDADE_MIN = 2

/** 6 marcas no eixo y ⇔ 5 divisões. Medido no PNG: 0/40/80/120/160/200. */
export const EIXO_Y_DIVISOES = 5
/**
 * Teto de divisões do eixo ANCORADO NO RECORTE (`dominioDaSerie`, serie.ts).
 *
 * `EIXO_Y_DIVISOES` acima é fixo em 5 e continua valendo para o ramo em que o
 * PICO manda (F-14, contrato). Quando o teto é o tamanho do recorte, o número de
 * divisões deixa de ser constante e passa a ser DERIVADO, porque a alternativa é
 * marca fracionária: com 6 pessoas e 5 divisões, os rótulos seriam 1,2 / 2,4 /
 * 3,6 — e fração de pessoa não existe. 6 é o maior número de divisões que ainda
 * lê como grade e não como pauta: acima disso a linha de grade compete com a
 * barra pela atenção.
 */
export const EIXO_Y_DIVISOES_MAX = 6
/**
 * Passos "redondos" aceitáveis. 190 → ceil(190/5)=38 → 40 → topo 200.
 *
 * O `40` NÃO estava nesta lista, e a ausência dele era um defeito real medido
 * por F-14: com a lista sem o 40, `ceil(190/5) = 38` subia para 50 e o eixo saía
 * 0/50/100/150/200/250 — cinco marcas diferentes das do PNG aprovado.
 *
 * [AUTO-DECISÃO] O CONTRATO se contradiz num parágrafo só: enumera
 * `[1,2,5,10,20,25,50,…]` e, na frase seguinte, exige "redondo 40 → topo 200,
 * ticks 0/40/80/120/160/200. Bate exatamente com o PNG". A régua visual (V-26)
 * é independente e também exige as seis marcas com 40. Dois sinais contra um:
 * o `40` entra. Registrado para subir ao dono, porque quem construiu não
 * reescreve a régua que o mede — aqui o que mudou foi o PARÂMETRO, não o
 * verificador.
 */
export const EIXO_Y_REDONDOS: readonly number[] = [1, 2, 5, 10, 20, 25, 40, 50, 100, 200, 500, 1000]

// --- §18 "Sinais emergentes" ----------------------------------------------
/** §18 literal: "deve ocorrer em ≥2 períodos consecutivos". */
export const RECORRENCIA_MIN_SEMANAS = 2

// --- §19 "Onde o ritmo caiu mais" ------------------------------------------
/** §19 literal: "Máximo 4 módulos". */
export const GARGALOS_MAX = 4
/**
 * Base mínima no período anterior para um módulo entrar na comparação.
 *
 * Com 1 pessoa, alguém sair vira "−100%" e o gestor recebe alarme de uma
 * pessoa. Mesmo raciocínio de `RELEVANCIA_ABS_PESSOAS` na Visão geral.
 */
export const MODULO_BASE_MIN = 3
/** §16: o que conta como "queda acentuada" num módulo. */
export const QUEDA_ACENTUADA_REL = -0.15
/** Piso do comprimento da barra: a menor queda tem que continuar visível. */
export const BARRA_FRACAO_PISO = 0.15
