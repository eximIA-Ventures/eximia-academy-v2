import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * TESTE VERMELHO — POP-FIX-001, run 2026-08-12-epic8-oauth-e-saml-nao-documentados, Passo 2.
 *
 * ALVO DO POP: `docs/epics/epic-8-autenticacao-enterprise.md`. O alvo é markdown, então
 * por POP-FIX-001 §4.1 ("Hook .cjs, skill, rule, POP") o gate é um script de asserção que
 * roda o ARTEFATO contra ENTRADA CONHECIDA. A entrada conhecida aqui é o próprio
 * código-fonte da aplicação: o documento afirma um estado do mundo, e o mundo está no
 * repositório ao lado.
 *
 * O QUE ESTE TESTE MEDE, LITERALMENTE: a coerência entre as AFIRMAÇÕES DE ESTADO escritas
 * no epic-8 e a PRESENÇA DA IMPLEMENTAÇÃO no fonte. Ele confronta célula de tabela contra
 * símbolo em arquivo.
 *
 * O QUE ELE NÃO MEDE, e nenhuma linha aqui finge medir:
 *  - se o fluxo OAuth/SAML FUNCIONA em runtime (não há provider configurado, nem IdP de
 *    teste, nem servidor de pé nesta run);
 *  - se o botão chega ao usuário final. Ele NÃO chega, e isso está registrado em
 *    `02-modo-de-falha.md` como correção ao achado herdado: `login-form.tsx` define
 *    `handleGoogleLogin` que nenhum JSX referencia (linha 352: "Google OAuth — disabled
 *    until provider is configured") e `login/page.tsx:15` passa `ssoProviderId={null}`
 *    literal, então o botão SSO também não renderiza. O que está VIVO e alcançável sem
 *    passar pela tela de login é o outro lado: `api/auth/callback/route.ts` (provisiona
 *    com `service_role`) e `api/admin/sso/route.ts` (cria provider SAML de verdade).
 *
 * O modo de falha caracterizado é DRIFT DE DOCUMENTO AUTORITATIVO: o documento que define
 * a superfície de credencial declara, em tempo presente, um mundo menor que o real. Isso é
 * observável no fonte, e é o que este arquivo prova.
 *
 * PROVA DE QUE OS DETECTORES NÃO SÃO CONSTANTES: os dois blocos "controle positivo" e
 * "controle negativo" abaixo. O positivo exige que o parser do markdown extraia as células
 * conhecidas e que os detectores de código devolvam `true` para as vias que o documento
 * ACERTA (password, invite). O negativo exige `false` para símbolos de auth que
 * comprovadamente não existem no repo (`signInWithOtp`, `signInAnonymously`,
 * `signInWithIdToken`, `linkIdentity` — 0 arquivos cada). Sem os dois, um detector
 * quebrado pintaria o repositório inteiro de vermelho e o vermelho não provaria nada.
 *
 * `[VETO]` do POP: este arquivo NÃO corrige nada. Correção do documento é Passo 5, depois
 * da causa raiz provada por alternância no Passo 3.
 */

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const REPO_ROOT = join(WEB_ROOT, "..", "..")
const EPIC = join(REPO_ROOT, "docs", "epics", "epic-8-autenticacao-enterprise.md")

function readWeb(relFromWebRoot: string): string {
  const abs = join(WEB_ROOT, relFromWebRoot)
  if (!existsSync(abs)) throw new Error(`arquivo inexistente: ${relFromWebRoot}`)
  return readFileSync(abs, "utf8")
}

function readEpic(): string {
  if (!existsSync(EPIC)) throw new Error(`epic-8 inexistente em ${EPIC}`)
  return readFileSync(EPIC, "utf8")
}

/* ------------------------------------------------------------------ parser --

   O documento é a entrada; estas funções o leem como dado, não como prosa.
   Cada uma isola UMA afirmação de estado, pelo rótulo literal da linha.            */

/** Célula da direita da linha `| **Auth Atual** | ... |` da tabela Epic Context. */
function cellAuthAtual(doc: string): string | null {
  const m = doc.match(/^\|\s*\*\*Auth Atual\*\*\s*\|\s*(.+?)\s*\|\s*$/m)
  return m ? m[1] : null
}

/** Coluna `Status` da tabela "Existing System Context", por nome do componente. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function statusExistingSystem(doc: string, componente: string): string | null {
  const linha = new RegExp(`^\\|\\s*${escapeRegExp(componente)}\\s*\\|\\s*([^|]+?)\\s*\\|`, "m")
  const m = doc.match(linha)
  return m ? m[1] : null
}

/** O `**Status:**` do cabeçalho do épico. */
function statusDoEpico(doc: string): string | null {
  const m = doc.match(/^\*\*Status:\*\*\s*(.+?)\s*$/m)
  return m ? m[1] : null
}

/** `**Status:**` de um arquivo de story. */
function statusDaStory(relFromRepoRoot: string): string | null {
  const abs = join(REPO_ROOT, relFromRepoRoot)
  if (!existsSync(abs)) return null
  const m = readFileSync(abs, "utf8").match(/^\*\*Status:\*\*\s*(.+?)\s*$/m)
  return m ? m[1] : null
}

/* ------------------------------------------------------- vias de credencial --

   Cada via é (a) um detector no FONTE e (b) o padrão que teria de aparecer na
   célula "Auth Atual" para que a via conte como ENUMERADA pelo documento.
   A separação é o ponto: implementado e declarado são duas medidas independentes. */

interface Via {
  id: string
  descricao: string
  /** true se a via existe no código. */
  implementada: () => boolean
  /** o que teria de constar na célula "Auth Atual" para a via estar enumerada. */
  enunciadaPor: RegExp
}

const VIAS: Via[] = [
  {
    id: "password",
    descricao: "email/senha — (auth)/entrar/actions.ts:17 e components/auth/login-form.tsx:135",
    implementada: () =>
      /auth\.signInWithPassword\(/.test(readWeb("src/app/(auth)/entrar/actions.ts")) &&
      /auth\.signInWithPassword\(/.test(readWeb("src/components/auth/login-form.tsx")),
    enunciadaPor: /email\s*\/\s*password|e-?mail e senha/i,
  },
  {
    id: "invite",
    descricao:
      "convite por e-mail — api/admin/users/invite-user.ts:45 (inviteUserByEmail) e o aceite em (auth)/accept-invite",
    implementada: () =>
      /auth\.admin\.inviteUserByEmail\(/.test(readWeb("src/app/api/admin/users/invite-user.ts")) &&
      /auth\.verifyOtp\(/.test(readWeb("src/app/(auth)/accept-invite/page.tsx")),
    enunciadaPor: /invite|convite/i,
  },
  {
    id: "oauth_google",
    descricao:
      "Google OAuth — signInWithOAuth em login-form.tsx:90 e o ramo provider==='google' de api/auth/callback/route.ts:35-104, que INSERE em public.users com service_role",
    implementada: () =>
      /auth\.signInWithOAuth\(/.test(readWeb("src/components/auth/login-form.tsx")) &&
      /app_metadata\?\.provider === "google"/.test(readWeb("src/app/api/auth/callback/route.ts")),
    enunciadaPor: /oauth|google/i,
  },
  {
    id: "saml_sso",
    descricao:
      "SAML SSO — signInWithSSO em login-form.tsx:111, a API de provider em api/admin/sso/route.ts (244 linhas, fala com /auth/v1/admin/sso via service_role) e o auto-provisioning de api/auth/callback/route.ts:106-170",
    implementada: () =>
      /auth\.signInWithSSO\(/.test(readWeb("src/components/auth/login-form.tsx")) &&
      existsSync(join(WEB_ROOT, "src/app/api/admin/sso/route.ts")) &&
      /sso:saml|isSaml/.test(readWeb("src/app/api/auth/callback/route.ts")),
    enunciadaPor: /saml|sso/i,
  },
  {
    id: "password_reset_self",
    descricao:
      "redefinição de senha self-service — resetPasswordForEmail em login-form.tsx:187 e auth.updateUser({password}) em (auth)/reset-password/page.tsx:39",
    implementada: () =>
      /auth\.resetPasswordForEmail\(/.test(readWeb("src/components/auth/login-form.tsx")) &&
      /auth\.updateUser\(\s*\{\s*password/.test(readWeb("src/app/(auth)/reset-password/page.tsx")),
    enunciadaPor: /reset|redefini|recupera/i,
  },
  {
    id: "admin_recovery_link",
    descricao:
      "link de recuperação emitido por admin — auth.admin.generateLink({type:'recovery'}) em api/admin/users/[userId]/reset-password/route.ts:51",
    implementada: () => {
      const src = readWeb("src/app/api/admin/users/[userId]/reset-password/route.ts")
      return /auth\.admin\.generateLink\(/.test(src) && /type:\s*"recovery"/.test(src)
    },
    enunciadaPor: /recovery|recupera|generateLink/i,
  },
]

/** Símbolos de auth que comprovadamente NÃO existem no repo — controle negativo. */
const AUSENTES = ["signInWithOtp", "signInAnonymously", "signInWithIdToken", "linkIdentity"]

const ARQUIVOS_DE_AUTH = [
  "src/app/(auth)/entrar/actions.ts",
  "src/components/auth/login-form.tsx",
  "src/app/api/auth/callback/route.ts",
  "src/app/(auth)/accept-invite/page.tsx",
  "src/app/(auth)/reset-password/page.tsx",
  "src/app/api/admin/sso/route.ts",
  "src/app/api/admin/users/invite-user.ts",
  "src/app/api/admin/users/[userId]/reset-password/route.ts",
]

/* --------------------------------------------------------------------------- */

describe("controle positivo — o parser lê as células que existem", () => {
  it("extrai a célula **Auth Atual** da tabela Epic Context", () => {
    expect(cellAuthAtual(readEpic())).toBe("Email/password + invite-only (Supabase Auth)")
  })

  it("extrai o **Status:** do cabeçalho do épico", () => {
    expect(statusDoEpico(readEpic())).toBe("Draft")
  })

  it("extrai a coluna Status da tabela Existing System Context", () => {
    const doc = readEpic()
    expect(statusExistingSystem(doc, "Supabase Auth (email/password)")).toBe("Implemented")
    expect(statusExistingSystem(doc, "Google OAuth")).toBe("Not configured")
    expect(statusExistingSystem(doc, "SAML SSO")).toBe("Not configured")
  })
})

/**
 * Resolve a via pelo id e AFIRMA que ela existe. Um `!` aqui silenciaria a única
 * coisa que importaria descobrir: que o id foi digitado errado e o teste está
 * medindo `undefined` em vez da via.
 */
function via(id: string): Via {
  const encontrada = VIAS.find((v) => v.id === id)
  if (!encontrada) throw new Error(`via "${id}" não declarada em VIAS`)
  return encontrada
}

describe("controle positivo — os detectores de código devolvem true no que o doc acerta", () => {
  it.each(["password", "invite"])("via %s está implementada e o detector a enxerga", (id) => {
    expect(via(id).implementada()).toBe(true)
  })
})

describe("controle negativo — os detectores devolvem false no que não existe", () => {
  it.each(AUSENTES)("%s não aparece em nenhum arquivo de auth", (simbolo) => {
    const achados = ARQUIVOS_DE_AUTH.filter((rel) => readWeb(rel).includes(simbolo))
    expect(achados).toEqual([])
  })
})

/* ------------------------------------------------------------- os vermelhos - */

describe("epic-8 Existing System Context — status declarado contra implementação medida", () => {
  it("Google OAuth: o documento não pode dizer 'Not configured' com a via no fonte", () => {
    const alvo = via("oauth_google")
    const declarado = statusExistingSystem(readEpic(), "Google OAuth")
    expect(
      { implementada: alvo.implementada(), declarado },
      `epic-8 linha 44 declara 'Not configured'. No fonte: ${alvo.descricao}`,
    ).not.toMatchObject({ implementada: true, declarado: "Not configured" })
  })

  it("SAML SSO: o documento não pode dizer 'Not configured' com a via no fonte", () => {
    const alvo = via("saml_sso")
    const declarado = statusExistingSystem(readEpic(), "SAML SSO")
    expect(
      { implementada: alvo.implementada(), declarado },
      `epic-8 linha 45 declara 'Not configured'. No fonte: ${alvo.descricao}`,
    ).not.toMatchObject({ implementada: true, declarado: "Not configured" })
  })
})

describe("epic-8 Epic Context — a célula 'Auth Atual' é a enumeração autoritativa da superfície de credencial", () => {
  it("toda via de credencial implementada aparece enumerada em 'Auth Atual'", () => {
    const celula = cellAuthAtual(readEpic()) ?? ""
    const implementadas = VIAS.filter((v) => v.implementada())
    const omitidas = implementadas
      .filter((v) => !v.enunciadaPor.test(celula))
      .map((v) => `${v.id} — ${v.descricao}`)

    expect(
      omitidas,
      `A célula diz literalmente "${celula}", que enumera ${
        implementadas.length - omitidas.length
      } das ${implementadas.length} vias vivas. Modelagem de ameaça feita a partir desta linha revisa uma superfície menor que a real.`,
    ).toEqual([])
  })
})

describe("epic-8 — escrita com service_role no caminho de autenticação não é mencionada", () => {
  it("se o callback provisiona com service_role, o épico tem de dizê-lo", () => {
    const callback = readWeb("src/app/api/auth/callback/route.ts")
    const provisionaComServiceRole =
      /createServiceClient\(\)/.test(callback) &&
      /serviceClient\s*\.?\s*\n?\s*\.from\("users"\)\s*\n?\s*\.insert\(/.test(
        callback.replace(/\s+/g, " "),
      )
    const doc = readEpic()
    const mencionaNoDoc = /service[_ ]role|createServiceClient/i.test(doc)

    expect(
      { provisionaComServiceRole, mencionaNoDoc },
      "api/auth/callback/route.ts:86 e :156 fazem serviceClient.from('users').insert(...) — " +
        "escrita privilegiada que ignora RLS, no ramo Google e no ramo SAML. No SAML o " +
        "tenant é resolvido por reverse lookup de settings.sso_provider_id sobre TODOS os " +
        "tenants (linhas 137-149). O épico não contém a expressão 'service_role' em lugar nenhum.",
    ).not.toMatchObject({ provisionaComServiceRole: true, mencionaNoDoc: false })
  })
})

describe("epic-8 — o Status do épico contra o Status das stories filhas", () => {
  it("épico não fica 'Draft' com as duas stories fora de Draft", () => {
    const s81 = statusDaStory("docs/stories/epic-8/story-8.1-google-oauth.md")
    const s82 = statusDaStory("docs/stories/epic-8/story-8.2-saml-sso-enterprise.md")
    const epico = statusDoEpico(readEpic())

    expect(
      { epico, s81, s82 },
      "O épico se declara 'Draft' (linha 7) enquanto 8.1 e 8.2 estão 'Ready for Review' e " +
        "o código das duas está na árvore. Quem lê o cabeçalho conclui que nada foi feito.",
    ).not.toMatchObject({ epico: "Draft", s81: "Ready for Review", s82: "Ready for Review" })
  })
})
