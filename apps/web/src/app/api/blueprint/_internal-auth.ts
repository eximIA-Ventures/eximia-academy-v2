/**
 * Cabeçalho interno exigido pelo microserviço blueprint (D15).
 *
 * O microserviço não confia em nada além deste token: `allow_origin_regex` +
 * `Depends` checando `X-Internal-Token` é a única autenticação entre o Next e
 * ele (ver `microservice/app/auth.py`). Sem `INTERNAL_AUTH_TOKEN` no ambiente
 * do serviço web, todo proxy falharia com 401 do microserviço, um erro que
 * não diz nada sobre a causa real — por isso este helper falha ALTO e CEDO,
 * com uma mensagem que aponta a env que falta, em vez de deixar o 401 do
 * microserviço se propagar sem contexto para quem está depurando.
 */
export function cabecalhoInternoObrigatorio(): Record<string, string> {
  const token = process.env.INTERNAL_AUTH_TOKEN
  if (!token) {
    throw new Error(
      "INTERNAL_AUTH_TOKEN não está definido no serviço web. O microserviço blueprint " +
        "exige o cabeçalho X-Internal-Token (D15) e rejeita qualquer chamada sem ele; " +
        "defina INTERNAL_AUTH_TOKEN com o mesmo valor configurado no microserviço.",
    )
  }
  return { "X-Internal-Token": token }
}
