// Recebe o VALOR, nunca o nome da variável: o Next.js só substitui
// `process.env.NEXT_PUBLIC_*` quando o acesso é literal no call site,
// então ler via `process.env[nome]` aqui dentro quebraria o bundle do browser.
export function requiredEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`)
  }
  return value
}
