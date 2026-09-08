#!/usr/bin/env node
// Bootstrap do primeiro super_admin num projeto Supabase NOVO (D13, Forma B).
//
// O que faz, na ordem:
//   1. insere o e-mail em public.bootstrap_super_admins (service_role);
//   2. cria a conta em auth.users via Admin API (auto-confirmada) — esse INSERT
//      dispara o gatilho trg_bootstrap_super_admin, que promove a conta;
//   3. se a conta ja existia (gatilho nao dispara em UPDATE), chama
//      promover_super_admin(email) como rede;
//   4. confere em public.users que role = super_admin e tenant_id IS NULL.
//
// Uso:
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/bootstrap-super-admin.mjs <email> [senha]
//
// Sem senha, gera uma e imprime UMA vez. Nunca grava segredo em disco.
import { createClient } from "@supabase/supabase-js"
import { randomBytes } from "node:crypto"

const [email, senhaArg] = process.argv.slice(2)
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!email || !url || !key) {
  console.error("uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/bootstrap-super-admin.mjs <email> [senha]")
  process.exit(2)
}
const senha = senhaArg ?? randomBytes(18).toString("base64url")
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const { error: e1 } = await sb.from("bootstrap_super_admins").upsert({ email, motivo: "bootstrap do ambiente novo (scripts/bootstrap-super-admin.mjs)" }, { onConflict: "email" })
if (e1) { console.error("falha em bootstrap_super_admins:", e1.message); process.exit(1) }

let criado = false
const { data: u, error: e2 } = await sb.auth.admin.createUser({ email, password: senha, email_confirm: true })
if (e2) {
  if (!/already|exists|registered/i.test(e2.message)) { console.error("falha ao criar auth.users:", e2.message); process.exit(1) }
  console.log("conta ja existia em auth.users; promovendo pela rede promover_super_admin()")
} else {
  criado = true
  console.log("auth.users criado:", u.user.id)
}

const { data: promovido, error: e3 } = await sb.rpc("promover_super_admin", { p_email: email })
if (e3) { console.error("falha em promover_super_admin:", e3.message); process.exit(1) }
console.log("promover_super_admin ->", promovido)

const { data: perfil, error: e4 } = await sb.from("users").select("id, email, role, tenant_id, status").eq("email", email).maybeSingle()
if (e4 || !perfil) { console.error("perfil nao encontrado em public.users:", e4?.message ?? "sem linha"); process.exit(1) }
console.log("public.users:", perfil)
if (perfil.role !== "super_admin" || perfil.tenant_id !== null) { console.error("PERFIL NAO E super_admin — veja o gatilho trg_bootstrap_super_admin"); process.exit(1) }

console.log("\nOK. Entre em /login com:")
console.log("  e-mail:", email)
if (criado) console.log("  senha :", senha, senhaArg ? "" : "(gerada agora — guarde, nao sera mostrada de novo)")
