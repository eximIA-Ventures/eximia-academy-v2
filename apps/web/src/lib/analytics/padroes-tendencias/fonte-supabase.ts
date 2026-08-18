// ---------------------------------------------------------------------------
// A leitura de banco desta tela — reuso INTEGRAL, zero consulta nova.
// ---------------------------------------------------------------------------
// Decisão IDS: REUSAR. `lerFonteVisaoGeral` já lê exatamente as oito chaves de
// que esta tela precisa (roster, sessões, reflexões, matrículas, cursos,
// participação, acionamentos, capítulos), já pagina, já escopa por tenant e
// por recorte, e já obedece I-4 desestruturando `error` em TODA leitura.
//
// Escrever uma segunda leitura aqui criaria duas verdades sobre o mesmo banco:
// a mesma pessoa poderia entrar num recorte numa aba e sair dele na outra, sem
// que ninguém tivesse mudado nada. Este arquivo existe só para dar NOME local à
// porta, e para que o resto da camada não importe direto de `visao-geral/`.
//
// O `.env.local` deste repo aponta para PRODUÇÃO. Esta camada é somente
// leitura: não há caminho de escrita aqui, nem no que ela importa.
// ---------------------------------------------------------------------------

export { lerFonteVisaoGeral as lerFontePadroes } from "../visao-geral/fonte-supabase"
export type { ClienteLeitura, ParametrosLeitura } from "../visao-geral/fonte-supabase"
