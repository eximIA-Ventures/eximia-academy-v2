import { describe, expect, it } from "vitest"
import { MAX_IMPORT_ROWS, classifyImportRows, parseUsersCsv } from "../bulk-import"

// =============================================================================
// IMPORT EM MASSA — a decisão, provada pelo caminho de ERRO (CFG-6.1).
//
// O caminho feliz de um import é trivial e não é o que assusta: o que assusta é
// a planilha com a linha repetida, o e-mail já cadastrado, a coluna faltando e a
// linha em branco no meio. Cada um desses casos precisa ter comportamento
// DEFINIDO e visível — nunca "cria assim mesmo" e nunca "some sem avisar".
//
// A invariante que amarra tudo: `toCreate + skipped === total`. Nenhuma linha
// desaparece em silêncio.
// =============================================================================

function rowsOf(csv: string) {
  const parsed = parseUsersCsv(csv)
  if (!parsed.ok) throw new Error(`esperava parse ok, veio: ${parsed.error}`)
  return parsed.rows
}

describe("leitura do arquivo", () => {
  it("lê cabeçalho com vírgula", () => {
    const rows = rowsOf("nome,email,papel\nMaria Silva,maria@x.com,Estudante")

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ full_name: "Maria Silva", email: "maria@x.com", line: 2 })
  })

  it("lê cabeçalho com ponto e vírgula (Excel pt-BR)", () => {
    const rows = rowsOf("nome;email;papel\nJoão Souza;joao@x.com;Gestor")

    expect(rows[0]).toMatchObject({ full_name: "João Souza", email: "joao@x.com", role: "Gestor" })
  })

  it("respeita aspas: vírgula dentro do nome não vira coluna nova", () => {
    const rows = rowsOf('nome,email\n"Silva, Maria",maria@x.com')

    expect(rows[0].full_name).toBe("Silva, Maria")
    expect(rows[0].email).toBe("maria@x.com")
  })

  it("aceita cabeçalho com acento, caixa e espaço diferentes", () => {
    const rows = rowsOf("Nome Completo;E-mail;Função\nAna;ana@x.com;Admin")

    expect(rows[0]).toMatchObject({ full_name: "Ana", email: "ana@x.com", role: "Admin" })
  })

  it("ignora linhas em branco no meio sem contá-las como erro", () => {
    const rows = rowsOf("nome,email\nA,a@x.com\n\n\nB,b@x.com")

    expect(rows.map((r) => r.email)).toEqual(["a@x.com", "b@x.com"])
    // O número da linha continua sendo o do ARQUIVO, para o admin achar no Excel.
    expect(rows[1].line).toBe(5)
  })

  it("recusa arquivo sem coluna de e-mail em vez de adivinhar", () => {
    const parsed = parseUsersCsv("nome,telefone\nMaria,999")

    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error).toContain("e-mail")
  })

  it("recusa arquivo sem coluna de nome", () => {
    const parsed = parseUsersCsv("email\nmaria@x.com")

    expect(parsed.ok).toBe(false)
  })

  it("recusa arquivo só com cabeçalho", () => {
    const parsed = parseUsersCsv("nome,email")

    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error).toContain("Nenhuma linha")
  })

  it("recusa arquivo vazio", () => {
    expect(parseUsersCsv("   \n  ").ok).toBe(false)
  })

  it("recusa lote acima do teto, em vez de disparar centenas de convites", () => {
    const linhas = Array.from(
      { length: MAX_IMPORT_ROWS + 1 },
      (_, i) => `Pessoa ${i},p${i}@x.com`,
    ).join("\n")
    const parsed = parseUsersCsv(`nome,email\n${linhas}`)

    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error).toContain(String(MAX_IMPORT_ROWS))
  })

  it("engole o BOM do Excel sem quebrar o primeiro cabeçalho", () => {
    const rows = rowsOf("﻿nome,email\nMaria,maria@x.com")

    expect(rows[0].email).toBe("maria@x.com")
  })
})

describe("classificação — cada linha ignorada tem motivo", () => {
  it("o caminho feliz cria e normaliza o e-mail", () => {
    const c = classifyImportRows(rowsOf("nome,email\nMaria, Maria@X.com "), [])

    expect(c.counts).toMatchObject({ total: 1, toCreate: 1 })
    expect(c.toCreate[0].email).toBe("maria@x.com")
    expect(c.toCreate[0].role).toBe("student")
  })

  it("papel em branco vira Estudante; papel desconhecido é ERRO, não default", () => {
    const c = classifyImportRows(
      rowsOf("nome,email,papel\nA,a@x.com,\nB,b@x.com,Diretor Supremo"),
      [],
    )

    expect(c.toCreate).toHaveLength(1)
    expect(c.toCreate[0].role).toBe("student")
    expect(c.skipped[0]).toMatchObject({ line: 3, reason: "invalid" })
    expect(c.skipped[0].detail).toContain("Diretor Supremo")
  })

  it("e-mail repetido no arquivo: vale a PRIMEIRA, a segunda é ignorada com motivo", () => {
    const c = classifyImportRows(
      rowsOf("nome,email\nMaria Primeira,dup@x.com\nMaria Segunda,DUP@x.com"),
      [],
    )

    expect(c.counts.toCreate).toBe(1)
    expect(c.toCreate[0].full_name).toBe("Maria Primeira")
    expect(c.counts.duplicateInFile).toBe(1)
    expect(c.skipped[0]).toMatchObject({ line: 3, reason: "duplicate_in_file" })
  })

  it("e-mail que já existe na empresa é ignorado, nunca sobrescrito", () => {
    const c = classifyImportRows(rowsOf("nome,email\nMaria,ja@x.com"), ["JA@x.com"])

    expect(c.counts.toCreate).toBe(0)
    expect(c.counts.alreadyExists).toBe(1)
    expect(c.skipped[0].reason).toBe("already_exists")
  })

  it("e-mail malformado e nome em branco caem como inválidos", () => {
    const c = classifyImportRows(
      rowsOf("nome,email\nSem Arroba,nao-e-email\n,semnome@x.com\nVazio,"),
      [],
    )

    expect(c.counts.toCreate).toBe(0)
    expect(c.counts.invalid).toBe(3)
    expect(c.skipped.map((s) => s.line)).toEqual([2, 3, 4])
  })

  it("nenhuma linha desaparece: criadas + ignoradas === total lido", () => {
    const csv = [
      "nome,email,papel",
      "Boa,boa@x.com,Estudante",
      "Repetida,boa@x.com,",
      "Existente,ja@x.com,",
      "Quebrada,arroba-nenhum,",
      ",sem-nome@x.com,",
    ].join("\n")

    const c = classifyImportRows(rowsOf(csv), ["ja@x.com"])

    expect(c.counts.total).toBe(5)
    expect(c.toCreate.length + c.skipped.length).toBe(c.counts.total)
    expect(c.counts).toMatchObject({
      toCreate: 1,
      duplicateInFile: 1,
      alreadyExists: 1,
      invalid: 2,
    })
  })

  it("classificar duas vezes o mesmo arquivo dá o mesmo resultado (é pura)", () => {
    const rows = rowsOf("nome,email\nA,a@x.com\nB,b@x.com")

    expect(classifyImportRows(rows, [])).toEqual(classifyImportRows(rows, []))
  })
})
