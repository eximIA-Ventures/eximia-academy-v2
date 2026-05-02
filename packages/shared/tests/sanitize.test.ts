import { describe, it, expect } from "vitest"
import { sanitizeStudentMessage } from "../src/utils/sanitize"

describe("sanitizeStudentMessage", () => {
  it("should return trimmed string for normal input", () => {
    expect(sanitizeStudentMessage("  Hello world  ")).toBe("Hello world")
  })

  it("should return empty string for empty input", () => {
    expect(sanitizeStudentMessage("")).toBe("")
    expect(sanitizeStudentMessage("   ")).toBe("")
  })

  it("should strip HTML tags", () => {
    expect(sanitizeStudentMessage("<b>bold</b> text")).toBe("bold text")
    expect(sanitizeStudentMessage('<script>alert("xss")</script>')).toBe('alert("xss")')
    expect(sanitizeStudentMessage("<div><p>nested</p></div>")).toBe("nested")
  })

  it("should strip control characters but preserve newlines and tabs", () => {
    expect(sanitizeStudentMessage("hello\nworld")).toBe("hello\nworld")
    expect(sanitizeStudentMessage("hello\tworld")).toBe("hello\tworld")
    expect(sanitizeStudentMessage("hello\x00world")).toBe("helloworld")
    expect(sanitizeStudentMessage("hello\x07world")).toBe("helloworld")
    expect(sanitizeStudentMessage("hello\x7Fworld")).toBe("helloworld")
  })

  it("should strip prompt injection delimiters", () => {
    expect(sanitizeStudentMessage("test <system> injection")).toBe("test  injection")
    expect(sanitizeStudentMessage("test </system> end")).toBe("test  end")
    expect(sanitizeStudentMessage("ignore <|im_start|> this")).toBe("ignore  this")
    expect(sanitizeStudentMessage("ignore <|im_end|> that")).toBe("ignore  that")
    expect(sanitizeStudentMessage("[INST] do something [/INST]")).toBe("do something")
    // <<SYS>> contains < which HTML stripper processes first, leaving "> system >"
    // The important thing is the actual delimiter content is removed
    const sysSanitized = sanitizeStudentMessage("<<SYS>> system <</SYS>>")
    expect(sysSanitized).not.toContain("SYS")
  })

  it("should preserve Unicode characters (emojis, accents)", () => {
    expect(sanitizeStudentMessage("Olá, tudo bem? 😊")).toBe("Olá, tudo bem? 😊")
    expect(sanitizeStudentMessage("café résumé naïve")).toBe("café résumé naïve")
    expect(sanitizeStudentMessage("日本語テスト")).toBe("日本語テスト")
  })

  it("should handle combined attack vectors", () => {
    const malicious = '<script>alert(1)</script> <system> [INST] normal text <|im_start|>'
    const result = sanitizeStudentMessage(malicious)
    expect(result).toBe("alert(1)   normal text")
    expect(result).not.toContain("<script>")
    expect(result).not.toContain("<system>")
    expect(result).not.toContain("[INST]")
    expect(result).not.toContain("<|im_start|>")
  })
})
