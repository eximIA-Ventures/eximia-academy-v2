import { readFileSync } from 'fs'

const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf-8')
for (const line of envFile.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RESEND_KEY = process.env.RESEND_API_KEY
const CORY_TENANT = 'a9d56b85-ee0e-4295-8db2-5fbcb3fd7a32'

async function getUsers() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/users?tenant_id=eq.${CORY_TENANT}&status=eq.active&select=id,full_name,email,role&order=full_name`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  )
  return res.json()
}

async function sendEmail(to, name) {
  const firstName = name?.split(' ')[0] || 'Colaborador'

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <img src="https://argos.eximiaacademy.com.br/logos/argos-color.png" alt="Argos Consultoria" style="height: 48px;" />
        <p style="margin: 8px 0 0; font-size: 18px; font-weight: 700; color: #C67B3C;">Academy</p>
      </div>

      <h1 style="font-size: 22px; font-weight: 700; color: #1a1a1a; margin: 0 0 16px;">
        Novo link de acesso
      </h1>

      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 12px;">
        Olá, ${firstName}!
      </p>

      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 12px;">
        Estamos atualizando a plataforma de treinamento da <strong>Cory Alimentos</strong> em parceria com a <strong>Argos Consultoria</strong>.
      </p>

      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">
        A partir de agora, o acesso à plataforma Academy será pelo novo endereço:
      </p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="https://argos.eximiaacademy.com.br"
           style="display: inline-block; background: #C67B3C; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 15px; font-weight: 600;">
          Acessar a plataforma
        </a>
      </div>

      <div style="background: #f7f4ef; border-radius: 12px; padding: 16px 20px; margin: 24px 0;">
        <p style="font-size: 13px; color: #666; margin: 0 0 4px; font-weight: 600;">Novo link:</p>
        <p style="font-size: 15px; color: #1a1a1a; margin: 0; font-weight: 700;">
          <a href="https://argos.eximiaacademy.com.br" style="color: #C67B3C; text-decoration: none;">argos.eximiaacademy.com.br</a>
        </p>
      </div>

      <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 0 0 8px;">
        Suas credenciais de acesso (email e senha) continuam as mesmas. Caso tenha dificuldades, entre em contato com o suporte.
      </p>

      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />

      <p style="font-size: 11px; color: #999; text-align: center; margin: 0;">
        © 2026 Argos Consultoria · Powered by exímIA Academy<br/>
        suporte@eximiaventures.com.br
      </p>
    </div>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Argos Academy <noreply@eximiaacademy.com.br>',
      to: [to],
      subject: 'Novo link de acesso — Argos Academy',
      html,
    }),
  })

  const data = await res.json()
  return { ok: res.ok, data }
}

async function main() {
  const users = await getUsers()
  console.log(`Found ${users.length} users in Cory tenant\n`)

  // Preview first
  console.log('Recipients:')
  for (const u of users) {
    console.log(`  ${u.full_name.padEnd(40)} ${u.email}`)
  }

  // Check for --send flag
  if (!process.argv.includes('--send')) {
    console.log(`\nDRY RUN — ${users.length} emails would be sent.`)
    console.log('Run with --send to actually send emails.')
    return
  }

  console.log(`\nSending ${users.length} emails...\n`)

  let success = 0
  let failed = 0

  for (const u of users) {
    try {
      const result = await sendEmail(u.email, u.full_name)
      if (result.ok) {
        console.log(`  ✓ ${u.full_name} (${u.email})`)
        success++
      } else {
        console.log(`  ✗ ${u.full_name} (${u.email}): ${JSON.stringify(result.data)}`)
        failed++
      }
    } catch (err) {
      console.log(`  ✗ ${u.full_name} (${u.email}): ${err.message}`)
      failed++
    }

    // Rate limit: 2 per second
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\nDone! ${success} sent, ${failed} failed.`)
}

main().catch(console.error)
