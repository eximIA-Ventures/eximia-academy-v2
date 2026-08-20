// ---------------------------------------------------------------------------
// O ÚNICO PONTO DE IA DAS TRÊS ABAS — e o modelo aqui é REDATOR, não analista.
// ---------------------------------------------------------------------------
// O que entra: números que a camada de dados JÁ calculou e que o gestor JÁ está
// vendo na gaveta, mais a frase que as regras §29 produzem sozinhas.
// O que sai: um parágrafo que costura esses números em linguagem de gestor.
// O que NUNCA acontece: o modelo calcular qualquer coisa.
//
// ═══ POR QUE ESTE PONTO, E NÃO OS OUTROS ═══════════════════════════════════
// A §29 permite regras determinísticas no MVP, e elas continuam sendo a fonte de
// TODA recomendação desta casa: são auditáveis, baratas e incapazes de alucinar.
// O caso de 2026-08-17 é a prova — a tela mandou "Apoiar 4 pessoas paradas" e as
// 4 tinham CONCLUÍDO; o defeito foi achado, nomeado e trancado por teste porque
// a regra estava escrita em algum lugar. Um modelo produziria o mesmo erro sobre
// pessoa real e não deixaria onde consertar.
//
// Sobra exatamente um trabalho que a regra faz mal: a gaveta "Todas as mudanças
// do período" mostra QUATRO variações isoladas (ativação, regularidade, sessões,
// módulos) e o gestor tem que costurá-las na cabeça. Costurar é REDAÇÃO. É o
// único lugar destas telas onde o modelo faz algo que a regra não faz.
//
// ═══ AS QUATRO GARANTIAS, E ONDE CADA UMA MORA ═════════════════════════════
//  1. marcada como INTERPRETAÇÃO — no componente (`gaveta.tsx`), com a frase da
//     regra visível ao lado, nunca no lugar dela;
//  2. o número vem da camada de dados — `conferirNumeros()` abaixo DESCARTA a
//     resposta inteira se aparecer um dígito que ninguém calculou. É gate
//     mecânico, não confiança no prompt;
//  3. falha degrada para a regra — todo caminho de erro devolve
//     `{ ok: false, motivo }` e a tela segue mostrando a leitura determinística.
//     Sem chave, sem rede, JSON torto, número inventado: mesma degradação;
//  4. custo conhecido e sem disparo automático — gpt-4o-mini, teto de 320 tokens
//     de saída e entrada limitada pelo schema: ~US$ 0,0002 por clique. Só roda
//     por clique explícito do gestor; nenhum render chama esta rota.
//
// ═══ POR QUE O CORPO NÃO É RECALCULADO NO SERVIDOR ═════════════════════════
// A rota `/api/analytics/insights` recalcula as métricas centrais e ignora o
// corpo, e ali isso faz sentido. Aqui não haveria o que proteger: os números que
// chegam são os que o próprio gestor autenticado acabou de ver na tela dele, e a
// resposta é prosa sobre eles. Um cliente que mentisse no corpo receberia de
// volta a própria mentira redigida — sem leitura de banco, sem alcançar dado de
// outra pessoa e sem ganhar permissão nenhuma. O que o schema fechado protege é
// o PROMPT (nada de texto arbitrário ou gigante viajando para o modelo), e é
// para isso que ele está dimensionado.
// ---------------------------------------------------------------------------

import { conferirNumeros } from "@/lib/analytics/gaveta/verificacao"
import { analyticsAggregateLimiter } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"

/** Teto de saída. ~320 tokens é um parágrafo longo; acima disso é divagação. */
const MAX_TOKENS_SAIDA = 320

const corpoSchema = z.object({
  fatos: z
    .array(z.object({ rotulo: z.string().max(80), valor: z.string().max(80) }))
    .min(1)
    .max(20),
  leituraDeterministica: z.string().min(1).max(800),
  acaoDeterministica: z.string().min(1).max(400),
  periodoDias: z.number().int().positive().max(400),
  totalRecorte: z.number().int().nonnegative().max(1_000_000),
})

/** Toda saída da rota tem esta forma: quem chama nunca precisa adivinhar. */
type Resposta =
  | { ok: true; texto: string }
  | { ok: false; motivo: "nao-configurada" | "indisponivel" | "numero-nao-verificado" }

function recusar(motivo: Extract<Resposta, { ok: false }>["motivo"], status = 200) {
  // Status 200 com `ok: false` é deliberado para os motivos de NEGÓCIO: a tela
  // não está quebrada, ela apenas continua com a regra. Erros de autenticação e
  // limite continuam sendo 401/403/429 de verdade, logo acima.
  return NextResponse.json<Resposta>({ ok: false, motivo }, { status })
}

const SISTEMA = `Você redige uma leitura executiva para um gestor de treinamento corporativo, em português do Brasil.

REGRAS ABSOLUTAS:
- Você NÃO faz cálculo. Não some, não subtraia, não divida, não calcule porcentagem, média ou variação.
- Use APENAS os números que aparecem literalmente na lista de fatos. Nenhum número novo pode aparecer no seu texto.
- Se quiser expressar uma relação que exigiria conta, descreva em palavras sem número.
- Não invente nomes de pessoas, módulos ou áreas. Não cite aluno individual.
- Vocabulário de APOIO, nunca de cobrança: "perdendo ritmo", "precisa de apoio", "sustentou o ritmo". Nunca "cobrar", "advertir", "penalizar".
- Não faça ranking de pessoas nem julgue desempenho individual.

FORMATO: um único parágrafo corrido, 2 a 4 frases, no máximo 600 caracteres. Sem título, sem lista, sem markdown.
TAREFA: costurar as variações num diagnóstico único e legível — o que está acontecendo com o time e o que isso implica.`

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // I-4: o erro da consulta é lido, não descartado. Falha de leitura do perfil
  // NÃO pode virar "papel ausente" e cair no 403 genérico — são coisas
  // diferentes e o gestor merece saber qual delas aconteceu.
  const { data: profile, error: erroPerfil } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()
  if (erroPerfil) {
    console.error("[leitura-do-periodo] falha ao ler o perfil:", erroPerfil)
    return NextResponse.json({ error: "Não foi possível verificar seu acesso" }, { status: 500 })
  }
  if (
    !profile?.role ||
    !["leader", "manager", "admin", "instructor", "super_admin"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let tenantId = profile.tenant_id
  if (!tenantId) {
    const { cookies: getCookies } = await import("next/headers")
    const cookieStore = await getCookies()
    tenantId = cookieStore.get("x-sa-active-tenant")?.value ?? null
  }
  if (!tenantId) return NextResponse.json({ error: "Nenhum tenant ativo" }, { status: 400 })

  if (analyticsAggregateLimiter) {
    const { success } = await analyticsAggregateLimiter.limit(tenantId)
    if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 })
  }

  const analisado = corpoSchema.safeParse(await request.json().catch(() => null))
  if (!analisado.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  const leitura = analisado.data

  const apiKey = process.env.OPENAI_API_KEY
  // Garantia 3, primeiro degrau: sem chave a tela não quebra nem mente — ela
  // simplesmente segue com a frase da regra, que sempre esteve visível.
  if (!apiKey) return recusar("nao-configurada")

  const listaDeFatos = leitura.fatos.map((f) => `- ${f.rotulo}: ${f.valor}`).join("\n")
  const usuario = `RECORTE: últimos ${leitura.periodoDias} dias, ${leitura.totalRecorte} pessoas.

FATOS (a ÚNICA fonte de números que você pode citar):
${listaDeFatos}

LEITURA DAS REGRAS (já correta; reescreva-a de forma mais fluida e conectada, sem contradizê-la):
${leitura.leituraDeterministica}

AÇÃO SUGERIDA PELAS REGRAS (pode ser incorporada ao final):
${leitura.acaoDeterministica}`

  try {
    const resposta = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SISTEMA },
          { role: "user", content: usuario },
        ],
        // Temperatura baixa: aqui se quer fidelidade ao dado, não variedade.
        temperature: 0.3,
        max_tokens: MAX_TOKENS_SAIDA,
      }),
      // Sem teto de tempo, uma tela de gestor fica pendurada num fornecedor.
      signal: AbortSignal.timeout(15_000),
    })

    if (!resposta.ok) {
      console.error("[leitura-do-periodo] OpenAI respondeu", resposta.status)
      return recusar("indisponivel")
    }

    const dados = await resposta.json()
    const texto: string = (dados?.choices?.[0]?.message?.content ?? "").trim()
    if (!texto) return recusar("indisponivel")

    // ═══ GARANTIA 2, o gate ═══════════════════════════════════════════════
    // Aqui o texto é descartado INTEIRO se o modelo imprimiu um dígito que a
    // camada de dados nunca produziu. Não se edita a saída para "consertar":
    // isso seria a casa assinando um texto que ela não verificou.
    const veredicto = conferirNumeros(texto, leitura)
    if (!veredicto.ok) {
      console.warn("[leitura-do-periodo] descartada, números sem lastro:", veredicto.inventados)
      return recusar("numero-nao-verificado")
    }

    return NextResponse.json<Resposta>({ ok: true, texto })
  } catch (erro) {
    // Rede caída, timeout, JSON torto: todos caem no mesmo lugar, e o lugar é a
    // regra determinística. Nenhum deles derruba a gaveta.
    console.error("[leitura-do-periodo] falha ao consultar o modelo:", erro)
    return recusar("indisponivel")
  }
}
