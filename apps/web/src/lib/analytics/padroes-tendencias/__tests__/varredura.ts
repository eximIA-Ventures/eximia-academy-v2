// ---------------------------------------------------------------------------
// Varredura de arquivos — os contratos cujo verificador é um `grep`.
// ---------------------------------------------------------------------------
// F-07, F-39, F-41 e F-43 declaram comandos `grep` como verificador. Aqui eles
// viram teste executável, para rodarem no mesmo gate que o resto.
//
// ARMADILHA CONHECIDA, e é a razão de os tokens serem montados por
// concatenação nos testes: um detector que procura um literal dentro da própria
// árvore ACHA A SI MESMO. O teste que proíbe a palavra X, escrito com a palavra
// X, reprova sozinho. Duas defesas, ambas ativas: (1) os tokens proibidos nunca
// aparecem inteiros no código dos testes; (2) `linhasDe` ignora linhas que
// citam o id do contrato, que é exatamente o `| grep -v "F-NN"` do comando
// original.
// ---------------------------------------------------------------------------

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join } from "node:path"

/**
 * A raiz de `apps/web`, subindo a partir do diretório de trabalho.
 *
 * `import.meta.url` não serve aqui: sob o ambiente jsdom do vitest ele não é
 * uma URL `file:`, e `fileURLToPath` explode. E a resolução LANÇA quando não
 * acha — um caminho errado que devolvesse "nenhum arquivo" faria toda varredura
 * passar por vacuidade, aprovando exatamente o que ela existe para reprovar.
 */
function raizDoWeb(): string {
  let dir = process.cwd()
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "src/lib/analytics/padroes-tendencias"))) return dir
    const acima = dirname(dir)
    if (acima === dir) break
    dir = acima
  }
  throw new Error(`varredura: não encontrei a raiz de apps/web a partir de ${process.cwd()}`)
}

const RAIZ = raizDoWeb()

/** Raiz da camada de dados desta tela. */
export const DIR_CAMADA = join(RAIZ, "src/lib/analytics/padroes-tendencias")

/** Raiz dos componentes desta tela. */
export const DIR_COMPONENTES = join(RAIZ, "src/components/analytics/padroes-tendencias")

/** Raiz da rota de preview desta tela. */
export const DIR_PREVIEW = join(RAIZ, "src/app/gauntlet-preview/padroes-tendencias")

function arquivosDe(dir: string): string[] {
  let entradas: string[]
  try {
    entradas = readdirSync(dir)
  } catch {
    return []
  }
  const saida: string[] = []
  for (const nome of entradas) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) {
      saida.push(...arquivosDe(caminho))
      continue
    }
    if (/\.(ts|tsx)$/.test(nome)) saida.push(caminho)
  }
  return saida
}

export interface LinhaDeArquivo {
  arquivo: string
  numero: number
  texto: string
}

/**
 * Todas as linhas dos diretórios, exceto as que citam `idParaIgnorar`.
 *
 * A exceção é o `| grep -v "F-NN"` do comando: a linha que DOCUMENTA a
 * proibição não pode ser contada como violação dela.
 */
export function linhasDe(dirs: readonly string[], idParaIgnorar?: string): LinhaDeArquivo[] {
  const saida: LinhaDeArquivo[] = []
  for (const dir of dirs) {
    for (const arquivo of arquivosDe(dir)) {
      const linhas = readFileSync(arquivo, "utf8").split("\n")
      linhas.forEach((texto, i) => {
        if (idParaIgnorar !== undefined && texto.includes(idParaIgnorar)) return
        saida.push({ arquivo, numero: i + 1, texto })
      })
    }
  }
  return saida
}

/** Linhas que casam com o padrão. O retorno é a EVIDÊNCIA, não só a contagem. */
export function casam(linhas: readonly LinhaDeArquivo[], padrao: RegExp): LinhaDeArquivo[] {
  return linhas.filter((l) => padrao.test(l.texto))
}

export function formatar(achados: readonly LinhaDeArquivo[]): string {
  return achados.map((a) => `${a.arquivo}:${a.numero}: ${a.texto.trim()}`).join("\n")
}

/** Quantos arquivos a varredura enxerga. Anti-vacuidade de toda proibição. */
export function quantidadeDeArquivos(dirs: readonly string[]): number {
  return dirs.reduce((total, dir) => total + arquivosDe(dir).length, 0)
}
