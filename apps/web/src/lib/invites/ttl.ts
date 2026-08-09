/**
 * TTL de exibição do convite (CFG-2.2, AC7).
 *
 * ## O que este número É
 *
 * O prazo a partir do qual a tela de Usuários passa a chamar um convite não
 * aceito de "Convite expirado" em vez de "Convite pendente". É uma decisão de
 * PRODUTO sobre quando parar de esperar e sugerir o reenvio.
 *
 * ## O que este número NÃO É (e por que o comentário é obrigatório)
 *
 * NÃO é o TTL técnico do link de convite do Supabase. Esse vive na configuração
 * do projeto (tela de Auth do painel, `MAILER_OTP_EXP` / "Email OTP expiration")
 * e **ainda não foi lido no projeto de produção** (`vaguswivhqnlbgqvnjch`) — o
 * campo `expires_at` do link não existe na API (`convites-desenho.md` §4), então
 * não há como descobrir o valor real pelo código.
 *
 * A única pista em disco é `supabase/config.toml:217` (`otp_expiry = 3600`), que
 * é a configuração do ambiente LOCAL de desenvolvimento, não a de produção.
 *
 * **Enquanto os dois valores não forem conferidos lado a lado, este número é
 * provisório e deve ser realinhado.** A divergência é assimétrica:
 *   - TTL de exibição MAIOR que o real → dizemos "pendente" para um link que já
 *     morreu (o admin descobre quando a pessoa reclama);
 *   - TTL de exibição MENOR que o real → dizemos "expirado" para um link ainda
 *     vivo (o admin reenvia à toa, o que é inofensivo e idempotente).
 *
 * 7 dias é o horizonte humano de "esse convite foi esquecido", não uma leitura
 * do servidor. Alterar aqui é alterar em produção: é constante de aplicação, não
 * de banco, e não exige migration (AC10).
 */
export const INVITE_TTL_DAYS = 7

/** Mesmo TTL em milissegundos — usado pela derivação de estado. */
export const INVITE_TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
