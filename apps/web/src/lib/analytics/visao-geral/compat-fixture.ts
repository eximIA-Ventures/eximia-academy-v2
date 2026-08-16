// ---------------------------------------------------------------------------
// PROVA MECÂNICA de que a camada de dados tem a mesma forma da fixture.
// ---------------------------------------------------------------------------
// "Manter a forma" é uma afirmação verificável, não uma intenção de comentário.
// Este arquivo não exporta nada em runtime: ele existe para o `tsc` reprovar
// quem divergir. Se alguém adicionar um campo obrigatório em `tipos.ts` que a
// fixture não tem, ou apertar um tipo que a fixture já violaria, o typecheck
// quebra AQUI, com o nome do campo — e não em produção, com a tela em branco.
//
// A direção da checagem é deliberada: `VISAO_GERAL_COMPLETA` (fixture) precisa
// ser um valor VÁLIDO do contrato desta camada. Ou seja, o contrato é o
// superconjunto, e a UI pode ser retipada para ele continuando a renderizar a
// fixture sem mudar uma linha de JSX.
//
// A ÚNICA divergência de forma, e o porquê: os quatro campos de variação
// (`deltaPp`, `deltaDirecao`, `deltaTom`, `deltaLabel`) aceitam `null` aqui e
// não aceitam na fixture. É exigência de I-3 — "No ritmo" não tem histórico de
// progresso em banco, e o alternativa a `null` seria exibir `0 pp`, que é uma
// afirmação sobre a equipe que o dado não sustenta. Alargar (fixture → camada)
// preserva a compatibilidade; apertar (camada → fixture) a quebraria.
//
// Import é TYPE-ONLY: nada de `components/` entra no bundle da camada de dados.
// ---------------------------------------------------------------------------

import type { VisaoGeralFixture } from "@/components/analytics/visao-geral/fixture"
import type { VisaoGeralDados } from "./tipos"

/** Falha de compilação se `T` não for atribuível a `U`. */
type Atribuivel<T extends U, U> = T

/**
 * A prova. Se a fixture deixar de ser um valor válido do contrato, esta linha
 * não compila.
 */
export type FixtureCabeNoContrato = Atribuivel<VisaoGeralFixture, VisaoGeralDados>
